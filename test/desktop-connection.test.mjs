import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
