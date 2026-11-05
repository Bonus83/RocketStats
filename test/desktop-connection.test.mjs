import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";
import connectionModule from "../desktop/connection-state.cjs";
import { createDesktopDom } from "./fixtures/desktop-dom.mjs";

const { createConnectionState } = connectionModule;
const refused = "connect ECONNREFUSED 127.0.0.1:49123";

function initialState(connection, startupError) {
  return {
    locale: "en", port: 49123, connection, startupError, models: [],
    update: { phase: "unconfigured", version: "0.1.0", source: null },
    autoCheckUpdates: true
  };
}

async function loadRenderer(connection, getState = async () => initialState(connection.getState())) {
  const { document, getElement, setTimeout, clearTimeout } = createDesktopDom();
  const listeners = {};
  const bridge = {
    onModel() {}, onUpdate() {},
    onStatus(callback) { listeners.status = callback; },
    onError(callback) { listeners.error = callback; },
    getState
  };
  const source = await readFile(new URL("../desktop/renderer.js", import.meta.url), "utf8");
  vm.runInNewContext(source, {
    document, setTimeout, clearTimeout,
    window: { rocketStatsDesktop: bridge, confirm: () => true }
  });
  return { getElement, listeners };
}

test("connection state retains transport errors until reconnection and emits ordered snapshots", () => {
  const events = [];
  const connection = createConnectionState((event) => events.push(event));
  assert.deepEqual(connection.getState(), { status: "connecting", error: null, revision: 0 });

  connection.setError(refused);
  connection.setStatus("disconnected");
  connection.setStatus("connecting");
  assert.equal(connection.getState().error, refused);
  connection.setStatus("connected");
  assert.deepEqual(connection.getState(), { status: "connected", error: null, revision: 4 });

  connection.setError("connection reset");
  connection.setStatus("disconnected");
  assert.equal(connection.getState().error, "connection reset");
  connection.setStatus("connected");
  assert.equal(connection.getState().error, null);
  assert.deepEqual(events.map((event) => event.revision), [1, 2, 3, 4, 5, 6, 7]);

  events.at(-1).error = "mutated";
  assert.equal(connection.getState().error, null);
});

test("connection refusal is hidden only when Rocket League is not running", async () => {
  let running = false;
  let checks = 0;
  const connection = createConnectionState(() => {}, {
    isGameRunning: async () => { checks += 1; return running; },
    onProcessCheckError: (error) => assert.fail(error.message)
  });
  connection.setStatus("disconnected");
  await connection.setError(refused, "ECONNREFUSED");
  assert.equal(connection.getState().error, null);

  running = true;
  connection.setStatus("connecting");
  await connection.setError(refused, "ECONNREFUSED");
  connection.setStatus("disconnected");
  assert.equal(connection.getState().error, refused);

  running = false;
  await connection.setError(refused, "ECONNREFUSED");
  assert.equal(connection.getState().error, null);
  await connection.setError("socket permission denied", "EACCES");
  assert.equal(connection.getState().error, "socket permission denied");
  await connection.setError(refused);
  assert.equal(connection.getState().error, refused);
  assert.equal(checks, 3);
});

test("unknown game status keeps the connection error and reports the failed process check", async () => {
  const errors = [];
  const connection = createConnectionState(() => {}, {
    isGameRunning: async () => { throw new Error("Process query failed"); },
    onProcessCheckError: (error) => errors.push(error.message)
  });
  await connection.setError(refused, "ECONNREFUSED");
  assert.equal(connection.getState().error, refused);
  assert.deepEqual(errors, ["Process query failed"]);

  const unavailable = createConnectionState(() => {});
  await unavailable.setError(refused, "ECONNREFUSED");
  assert.equal(unavailable.getState().error, refused);

  const invalid = createConnectionState(() => {}, {
    isGameRunning: async () => undefined,
    onProcessCheckError: (error) => errors.push(error.message)
  });
  await invalid.setError(refused, "ECONNREFUSED");
  assert.equal(invalid.getState().error, refused);
  assert.match(errors.at(-1), /invalid result/);
});

test("late process checks cannot restore or hide newer connection errors", async () => {
  const checks = [];
  const connection = createConnectionState(() => {}, {
    isGameRunning: () => new Promise((resolve) => checks.push(resolve)),
    onProcessCheckError: (error) => assert.fail(error.message)
  });
  const first = connection.setError(refused, "ECONNREFUSED");
  connection.setStatus("connected");
  checks.shift()(true);
  await first;
  assert.equal(connection.getState().error, null);

  connection.setStatus("disconnected");
  const second = connection.setError(refused, "ECONNREFUSED");
  connection.setStatus("connecting");
  await connection.setError("new connection error", "EACCES");
  checks.shift()(false);
  await second;
  assert.equal(connection.getState().error, "new connection error");
});

test("the desktop process check suppresses only expected closed-game refusals", async () => {
  const mainUrl = new URL("../desktop/main.cjs", import.meta.url);
  const realRequire = createRequire(mainUrl);
  const errors = [];
  let running = false;
  let processError;
  let malformedOutput = false;
  let localizedOutput = false;
  let checks = 0;
  const app = {
    setName() {}, requestSingleInstanceLock: () => true,
    getPath: () => "unused-user-data", whenReady: () => new Promise(() => {}), on() {}
  };
  const context = vm.createContext({
    __dirname: dirname(fileURLToPath(mainUrl)),
    console: { error: (...args) => errors.push(args) },
    process: { platform: "win32" },
    require(id) {
      if (id === "electron") {
        return {
          app, BrowserWindow: class {}, dialog: {}, ipcMain: { handle() {} }
        };
      }
      if (id === "node:child_process") {
        return {
          execFile(command, args, options, callback) {
            assert.equal(command, "tasklist");
            const filtered = args[0] === "/FI";
            assert.deepEqual(
              [...args],
              filtered
                ? ["/FI", "IMAGENAME eq RocketLeague.exe", "/FO", "CSV", "/NH"]
                : ["/FO", "CSV", "/NH"]
            );
            assert.ok(options.timeout > 0 && options.timeout <= 2500);
            checks += 1;
            let output;
            if (malformedOutput) output = "Unexpected tasklist output";
            else if (filtered && running) output = '"RocketLeague.exe","123","Console","1","50,000 K"';
            else if (filtered) output = localizedOutput ? "INFORMACIÓN: No hay tareas." : "INFO: No tasks.";
            else output = '"System","4","Services","0","2,000 K"';
            setImmediate(() => callback(processError, output, ""));
          }
        };
      }
      return realRequire(id);
    }
  });
  vm.runInContext(await readFile(mainUrl, "utf8"), context, { filename: fileURLToPath(mainUrl) });
  const reportError = vm.runInContext("handleServiceError", context);
  const connection = vm.runInContext("connectionState", context);
  await reportError(refused, "connection", "ECONNREFUSED");
  assert.equal(connection.getState().error, null);
  running = true;
  await reportError(refused, "connection", "ECONNREFUSED");
  assert.equal(connection.getState().error, refused);
  running = false;
  await reportError(refused, "connection", "ECONNREFUSED");
  assert.equal(connection.getState().error, null);

  localizedOutput = true;
  const checksBeforeFallback = checks;
  await reportError(refused, "connection", "ECONNREFUSED");
  assert.equal(connection.getState().error, null);
  assert.equal(checks, checksBeforeFallback + 2);
  localizedOutput = false;
  malformedOutput = true;
  await reportError(refused, "connection", "ECONNREFUSED");
  assert.equal(connection.getState().error, refused);
  assert.match(String(errors.at(-1)[1]), /invalid result/);
  malformedOutput = false;
  processError = new Error("tasklist failed asynchronously");
  await reportError(refused, "connection", "ECONNREFUSED");
  assert.equal(connection.getState().error, refused);
  assert.match(String(errors.at(-1)[1]), /failed asynchronously/);
  const checksBeforeOtherError = checks;
  await reportError("socket permission denied", "connection", "EACCES");
  assert.equal(connection.getState().error, "socket permission denied");
  assert.equal(checks, checksBeforeOtherError);
});

test("closed-game refusal does not show a warning but unrelated errors stay visible", async () => {
  let dispatch = () => {};
  const connection = createConnectionState((event) => dispatch(event), {
    isGameRunning: async () => false,
    onProcessCheckError: (error) => assert.fail(error.message)
  });
  const { getElement, listeners } = await loadRenderer(connection);
  dispatch = listeners.status;
  await new Promise((resolve) => setImmediate(resolve));
  connection.setStatus("disconnected");
  await connection.setError(refused, "ECONNREFUSED");
  assert.equal(getElement("error-panel").hidden, true);
  assert.equal(getElement("connection-label").textContent, "Stats API disconnected");

  listeners.error("The game log could not be read.");
  await connection.setError(refused, "ECONNREFUSED");
  assert.equal(getElement("error-panel").hidden, false);
  assert.equal(getElement("error-text").textContent, "The game log could not be read.");
});

test("desktop removes a resolved connection error but preserves unrelated errors", async () => {
  let dispatch = () => {};
  const connection = createConnectionState((event) => dispatch(event));
  const { getElement, listeners } = await loadRenderer(connection);
  dispatch = listeners.status;
  await new Promise((resolve) => setImmediate(resolve));

  connection.setError(refused);
  connection.setStatus("disconnected");
  assert.equal(getElement("error-panel").hidden, false);
  assert.equal(getElement("error-text").textContent, refused);

  connection.setStatus("connected");
  assert.equal(getElement("connection-label").textContent, "Stats API connected");
  assert.equal(getElement("error-panel").hidden, true);
  assert.equal(getElement("error-text").textContent, "");

  listeners.error("The game log could not be read.");
  connection.setStatus("disconnected");
  connection.setError(refused);
  connection.setStatus("connected");
  assert.equal(getElement("error-panel").hidden, false);
  assert.equal(getElement("error-text").textContent, "The game log could not be read.");
});

test("a stale initial snapshot cannot restore a cleared connection error", async () => {
  let dispatch = () => {};
  const connection = createConnectionState((event) => dispatch(event));
  connection.setError(refused);
  connection.setStatus("disconnected");
  const stale = connection.getState();
  let resolveInitial;
  const { getElement, listeners } = await loadRenderer(
    connection,
    () => new Promise((resolve) => { resolveInitial = resolve; })
  );
  dispatch = listeners.status;
  connection.setStatus("connected");
  resolveInitial(initialState(stale));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(getElement("connection-label").textContent, "Stats API connected");
  assert.equal(getElement("error-panel").hidden, true);
});

test("the initial snapshot shows current errors without overriding newer runtime errors", async () => {
  const connection = createConnectionState(() => {});
  connection.setError(refused);
  connection.setStatus("disconnected");
  const { getElement } = await loadRenderer(connection);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(getElement("error-panel").hidden, false);
  assert.equal(getElement("error-text").textContent, refused);

  let resolveInitial;
  const other = await loadRenderer(
    connection,
    () => new Promise((resolve) => { resolveInitial = resolve; })
  );
  other.listeners.error("A newer runtime error.");
  resolveInitial(initialState(connection.getState(), "An older startup error."));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(other.getElement("error-text").textContent, "A newer runtime error.");
});

test("the dashboard no longer includes the read-only information banner", async () => {
  const html = await readFile(new URL("../desktop/index.html", import.meta.url), "utf8");
  const renderer = await readFile(new URL("../desktop/renderer.js", import.meta.url), "utf8");
  assert.doesNotMatch(html, /feed-note|Read-only local feed/i);
  assert.doesNotMatch(renderer, /feed-note/);
});
