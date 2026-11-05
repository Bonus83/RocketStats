import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import updaterModule from "../desktop/updater.cjs";
import { createDesktopDom } from "./fixtures/desktop-dom.mjs";

const { createUpdateController } = updaterModule;

function update(phase, extra = {}) {
  return {
    phase, version: "0.1.0", source: "Bonus83/RocketStats",
    publisherVerification: false, availableVersion: null, percent: null, error: null,
    ...extra
  };
}

function initialState(currentUpdate) {
  return {
    locale: "en", port: 49123, models: [], autoCheckUpdates: true,
    connection: { status: "connected", error: null, revision: 0 },
    update: currentUpdate
  };
}

async function createHarness(currentUpdate, getState = async () => initialState(currentUpdate)) {
  const dom = createDesktopDom();
  dom.getElement("update-balloon").hidden = true;
  const listeners = {};
  const bridge = {
    onModel() {}, onStatus() {}, onError() {},
    onUpdate(callback) { listeners.update = callback; },
    getState,
    checkUpdate: async () => currentUpdate,
    downloadUpdate: async () => currentUpdate,
    getUpdateMatchStatus: async () => "not-in-match",
    installUpdate: async () => currentUpdate,
    setAutoUpdates: async (enabled) => ({ autoCheckUpdates: enabled })
  };
  let confirmed = false;
  let confirmation = "";
  const confirmationHistory = [];
  const confirmationChoices = [];
  const source = await readFile(new URL("../desktop/renderer.js", import.meta.url), "utf8");
  vm.runInNewContext(source, {
    document: dom.document, setTimeout: dom.setTimeout, clearTimeout: dom.clearTimeout,
    window: {
      rocketStatsDesktop: bridge,
      confirm(message) {
        confirmation = message;
        confirmationHistory.push(message);
        return confirmationChoices.length ? confirmationChoices.shift() : confirmed;
      }
    }
  });
  return {
    ...dom, bridge, listeners,
    confirm(value) { confirmed = value; },
    confirmNext(...values) { confirmationChoices.push(...values); },
    confirmation: () => confirmation,
    confirmations: () => [...confirmationHistory]
  };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test("automatic startup checks show current and available results in the balloon", async () => {
  for (const [event, phase, version] of [
    ["update-not-available", "current", "0.1.0"],
    ["update-available", "available", "0.2.0"]
  ]) {
    const updater = new EventEmitter();
    let checks = 0;
    updater.checkForUpdates = async () => {
      checks += 1;
      updater.emit(event, { version });
      return { updateInfo: { version } };
    };
    let dispatch = () => {};
    const controller = createUpdateController({
      updater, version: "0.1.0", source: "Bonus83/RocketStats",
      onState: (state) => dispatch(state), beforeInstall: async () => {}
    });
    try {
      const h = await createHarness(controller.getState(), async () => initialState(controller.getState()));
      dispatch = h.listeners.update;
      await settle();
      assert.equal(h.getElement("update-balloon").hidden, true);
      controller.configureAutomaticChecks(true);
      await settle();
      assert.equal(checks, 1);
      assert.equal(controller.getState().phase, phase);
      assert.equal(h.getElement("update-balloon").hidden, false);
      assert.match(
        h.getElement("update-status").textContent,
        phase === "current" ? /latest version/ : /0\.2\.0/
      );
      assert.equal(updater.autoDownload, false);
      assert.equal(updater.autoInstallOnAppQuit, false);
    } finally {
      controller.dispose();
    }
  }
});

test("startup shows the current version briefly and the menu can reopen it", async () => {
  const h = await createHarness(update("current"));
  await settle();
  assert.equal(h.getElement("update-balloon").hidden, false);
  assert.equal(h.getElement("update-status").textContent, "You are using the latest version.");
  assert.equal(h.getElement("update-version").textContent, "v0.1.0");
  assert.equal(h.getElement("menu-update-version").textContent, "v0.1.0");

  h.advanceTime(7999);
  assert.equal(h.getElement("update-balloon").hidden, false);
  h.advanceTime(1);
  assert.equal(h.getElement("update-balloon").hidden, true);

  h.getElement("app-menu").open = true;
  h.getElement("update-show").listeners.get("click")();
  assert.equal(h.getElement("app-menu").open, false);
  assert.equal(h.getElement("update-balloon").hidden, false);
  h.advanceTime(8000);
  assert.equal(h.getElement("update-balloon").hidden, true);
});

test("a current-version balloon remains open while it is being used", async () => {
  const h = await createHarness(update("current"));
  await settle();
  const balloon = h.getElement("update-balloon");
  balloon.matches = (selector) => selector === ":hover";
  h.advanceTime(8000);
  assert.equal(balloon.hidden, false);

  h.document.activeElement = balloon;
  h.getElement("update-close").listeners.get("click")();
  assert.equal(balloon.hidden, true);
  assert.equal(h.getElement("menu-toggle").focused, true);
});

test("available updates remain actionable after dismissal without automatic installation", async () => {
  const available = update("available", { availableVersion: "0.2.0" });
  const h = await createHarness(available);
  await settle();
  assert.equal(h.getElement("update-balloon").hidden, false);
  assert.match(h.getElement("update-status").textContent, /0\.2\.0/);
  assert.equal(h.getElement("update-download").hidden, false);
  h.advanceTime(30000);
  assert.equal(h.getElement("update-balloon").hidden, false);

  h.getElement("update-close").listeners.get("click")();
  h.getElement("app-menu").open = true;
  h.getElement("update-show").listeners.get("click")();
  assert.equal(h.getElement("update-balloon").hidden, false);
  let downloads = 0;
  h.bridge.downloadUpdate = async () => {
    downloads += 1;
    return update("downloading", { availableVersion: "0.2.0", percent: 0 });
  };
  await h.getElement("update-download").listeners.get("click")();
  assert.equal(downloads, 1);
  assert.equal(h.getElement("update-check").disabled, true);
  h.getElement("update-close").listeners.get("click")();
  h.listeners.update(update("downloading", { availableVersion: "0.2.0", percent: 42 }));
  assert.equal(h.getElement("update-balloon").hidden, true);
  assert.equal(h.getElement("update-progress").value, 42);
  h.getElement("app-menu").open = true;
  h.getElement("update-show").listeners.get("click")();
  assert.equal(h.getElement("update-balloon").hidden, false);
  h.getElement("update-close").listeners.get("click")();

  h.listeners.update(update("downloaded", { availableVersion: "0.2.0", percent: 100 }));
  assert.equal(h.getElement("update-balloon").hidden, false);
  assert.equal(h.getElement("update-install").hidden, false);
  let installations = 0;
  h.bridge.installUpdate = async () => {
    installations += 1;
    return update("installing", { availableVersion: "0.2.0", percent: 100 });
  };
  await h.getElement("update-install").listeners.get("click")();
  assert.equal(installations, 0);
  assert.equal(
    h.confirmation(),
    "Install this update and restart RocketStats? Your account data will be kept."
  );
  h.confirm(true);
  await h.getElement("update-install").listeners.get("click")();
  assert.equal(installations, 1);

  h.listeners.update(update("downloaded", {
    availableVersion: "0.2.0", percent: 100, error: "Could not save account state."
  }));
  assert.equal(h.getElement("update-error").hidden, false);
  assert.equal(h.getElement("update-error").textContent, "Could not save account state.");
  assert.equal(h.getElement("update-install").disabled, false);
});

test("match and unknown-status warnings allow canceling or explicitly continuing", async () => {
  for (const [status, expectedWarning] of [
    ["in-match", /A match is in progress/],
    ["unknown", /match status could not be determined/]
  ]) {
    const h = await createHarness(update("downloaded", { availableVersion: "0.2.0" }));
    await settle();
    h.bridge.getUpdateMatchStatus = async () => status;
    const attempts = [];
    h.bridge.installUpdate = async (confirmedStatus) => {
      attempts.push(confirmedStatus);
      return update("installing");
    };
    await h.getElement("update-install").listeners.get("click")();
    assert.match(h.confirmation(), expectedWarning);
    assert.match(h.confirmation(), /result may be missed/);
    assert.equal(attempts.length, 0);
    h.confirm(true);
    await h.getElement("update-install").listeners.get("click")();
    assert.deepEqual(attempts, [status]);
  }
});

test("a match starting during confirmation requires a new warning and consent", async () => {
  const h = await createHarness(update("downloaded", { availableVersion: "0.2.0" }));
  await settle();
  let matchStatus = "not-in-match";
  const attempts = [];
  h.bridge.getUpdateMatchStatus = async () => matchStatus;
  h.bridge.installUpdate = async (confirmedStatus) => {
    attempts.push(confirmedStatus);
    if (confirmedStatus !== matchStatus) {
      return { needsConfirmation: true, matchStatus };
    }
    return update("installing");
  };
  h.confirmNext(true, false);
  const initialConfirm = h.bridge.installUpdate;
  h.bridge.installUpdate = async (confirmedStatus) => {
    if (confirmedStatus === "not-in-match") matchStatus = "in-match";
    return initialConfirm(confirmedStatus);
  };
  await h.getElement("update-install").listeners.get("click")();
  assert.deepEqual(attempts, ["not-in-match"]);
  assert.equal(h.confirmations().length, 2);
  assert.match(h.confirmations()[1], /A match is in progress/);
  h.confirm(true);
  await h.getElement("update-install").listeners.get("click")();
  assert.deepEqual(attempts, ["not-in-match", "in-match"]);
});

test("a failed match-status lookup shows an error without installing", async () => {
  const h = await createHarness(update("downloaded"));
  await settle();
  let installs = 0;
  h.bridge.getUpdateMatchStatus = async () => { throw new Error("Match status unavailable"); };
  h.bridge.installUpdate = async () => { installs += 1; return update("installing"); };
  h.confirm(true);
  await h.getElement("update-install").listeners.get("click")();
  assert.equal(installs, 0);
  assert.match(h.getElement("update-error").textContent, /Match status unavailable/);
  assert.equal(h.getElement("update-install").disabled, false);
});

test("manual checks and automatic-check settings stay in the menu", async () => {
  const h = await createHarness(update("idle"));
  await settle();
  assert.equal(h.getElement("update-balloon").hidden, true);
  let checks = 0;
  h.bridge.checkUpdate = async () => {
    checks += 1;
    h.listeners.update(update("checking"));
    h.listeners.update(update("current"));
    return update("current");
  };
  h.getElement("app-menu").open = true;
  await h.getElement("update-check").listeners.get("click")();
  assert.equal(checks, 1);
  assert.equal(h.getElement("app-menu").open, false);
  assert.equal(h.getElement("update-balloon").hidden, false);
  assert.equal(h.getElement("update-status").textContent, "You are using the latest version.");

  const automatic = h.getElement("update-auto");
  automatic.checked = false;
  await automatic.listeners.get("change")({ target: automatic });
  assert.equal(automatic.checked, false);
  h.getElement("update-close").listeners.get("click")();
  h.bridge.setAutoUpdates = async () => { throw new Error("Could not save setting"); };
  automatic.checked = true;
  await automatic.listeners.get("change")({ target: automatic });
  assert.equal(automatic.checked, false);
  assert.equal(h.getElement("update-balloon").hidden, false);
  assert.match(h.getElement("update-error").textContent, /Could not save setting/);
  h.advanceTime(10000);
  assert.equal(h.getElement("update-balloon").hidden, false);
});

test("new startup update events are not overwritten by an older initial snapshot", async () => {
  let resolveInitial;
  const initial = new Promise((resolve) => { resolveInitial = resolve; });
  const h = await createHarness(update("idle"), () => initial);
  h.listeners.update(update("current"));
  resolveInitial(initialState(update("idle")));
  await settle();
  assert.equal(h.getElement("update-balloon").hidden, false);
  assert.equal(h.getElement("update-status").textContent, "You are using the latest version.");

  h.listeners.update(update("error", { error: "Offline" }));
  h.advanceTime(10000);
  assert.equal(h.getElement("update-balloon").hidden, false);
  assert.equal(h.getElement("update-error").textContent, "Offline");
});

test("an older check response cannot replace newer download progress", async () => {
  const h = await createHarness(update("idle"));
  await settle();
  let resolveCheck;
  h.bridge.checkUpdate = () => new Promise((resolve) => { resolveCheck = resolve; });
  const checking = h.getElement("update-check").listeners.get("click")();
  h.listeners.update(update("checking"));
  h.listeners.update(update("available", { availableVersion: "0.2.0" }));
  h.listeners.update(update("downloading", { availableVersion: "0.2.0", percent: 42 }));
  resolveCheck(update("available", { availableVersion: "0.2.0" }));
  await checking;

  assert.match(h.getElement("update-status").textContent, /Downloading/);
  assert.equal(h.getElement("update-progress").value, 42);
  assert.equal(h.getElement("update-check").disabled, true);
});

test("automatic checks can stay disabled, and unavailable updates remain explainable", async () => {
  const idle = update("idle");
  const h = await createHarness(idle, async () => ({
    ...initialState(idle), autoCheckUpdates: false
  }));
  await settle();
  assert.equal(h.getElement("update-balloon").hidden, true);
  assert.equal(h.getElement("update-auto").checked, false);
  assert.equal(h.getElement("update-check").disabled, false);

  h.listeners.update(update("development"));
  assert.equal(h.getElement("update-check").disabled, true);
  assert.equal(h.getElement("update-auto").disabled, true);
  h.getElement("update-show").listeners.get("click")();
  assert.equal(h.getElement("update-balloon").hidden, false);
  assert.equal(h.getElement("update-status").textContent, "Updates are disabled in development mode.");
});

test("an actual publisher-verification failure remains visible", async () => {
  const h = await createHarness(update("idle"));
  await settle();
  h.listeners.update(update("error", {
    publisherVerification: true,
    error: "Installer publisher signature does not match."
  }));
  assert.equal(h.getElement("update-balloon").hidden, false);
  assert.equal(h.getElement("update-error").textContent, "Installer publisher signature does not match.");
});

test("update controls are in the menu and the dashboard has no update panel", async () => {
  const html = await readFile(new URL("../desktop/index.html", import.meta.url), "utf8");
  const menuStart = html.indexOf('<details id="app-menu"');
  const menuEnd = html.indexOf("</details>", menuStart);
  for (const id of ["update-check", "update-show", "update-auto"]) {
    const position = html.indexOf(`id="${id}"`);
    assert.ok(position > menuStart && position < menuEnd, `${id} must be in the menu`);
  }
  assert.ok(html.indexOf('id="update-balloon"') < html.indexOf("<main>"));
  assert.doesNotMatch(html, /<section class="updates"/);
  assert.doesNotMatch(html, /update-security/);
});
