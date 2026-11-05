import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import configModule from "../desktop/update-config.cjs";
import updaterModule from "../desktop/updater.cjs";

const { parseUpdateConfig, desktopBuildConfig } = configModule;
const { createUpdateController } = updaterModule;
const releaseConfig = {
  owner: "example-owner", repo: "desktop-releases", publisherNames: ["Example Publisher"]
};

class FakeUpdater extends EventEmitter {
  checks = 0;
  downloads = 0;
  installs = [];
  checkForUpdates = async () => {
    this.checks += 1;
    this.emit("update-available", { version: "0.2.0" });
    return { updateInfo: { version: "0.2.0" } };
  };
  downloadUpdate = async () => {
    this.downloads += 1;
    this.emit("download-progress", { percent: 42 });
    this.emit("update-downloaded", { version: "0.2.0" });
    return ["verified-installer"];
  };
  quitAndInstall(...args) { this.installs.push(args); }
}

function controllerFor(updater, extra = {}) {
  return createUpdateController({
    updater, version: "0.1.0", source: "example-owner/desktop-releases",
    onState: () => {}, beforeInstall: async () => {}, ...extra
  });
}

test("release config selects the public source but requires pinned signing publishers for releases", () => {
  const empty = { owner: "", repo: "", publisherNames: [] };
  assert.equal(parseUpdateConfig(empty), null);
  assert.equal(desktopBuildConfig(null, false).publish, null);
  assert.throws(() => desktopBuildConfig(null, true), /requires/);
  for (const invalid of [
    { ...releaseConfig, owner: "" },
    { ...releaseConfig, repo: "../other" },
    { ...releaseConfig, owner: "https://github.com/example" },
    { ...releaseConfig, publisherNames: [" "] },
    { ...releaseConfig, token: "not-an-accepted-config-field" }
  ]) {
    assert.throws(() => parseUpdateConfig(invalid));
  }
  const sourceOnly = parseUpdateConfig({ ...releaseConfig, publisherNames: [] });
  assert.deepEqual(sourceOnly, {
    owner: "example-owner", repo: "desktop-releases", publisherNames: []
  });
  assert.equal(desktopBuildConfig(sourceOnly, false).publish, null);
  assert.throws(() => desktopBuildConfig(sourceOnly, true), /publisherNames/);
  const config = parseUpdateConfig(releaseConfig);
  const build = desktopBuildConfig(config, true);
  assert.equal(build.forceCodeSigning, true);
  assert.equal(build.win.verifyUpdateCodeSignature, true);
  assert.deepEqual(build.win.publisherName, ["Example Publisher"]);
  assert.deepEqual(build.publish, [{
    provider: "github", owner: "example-owner", repo: "desktop-releases",
    private: false, releaseType: "release"
  }]);
});

test("release build command rejects an unsigned source before packaging or publishing", async (t) => {
  const config = JSON.parse(await readFile(new URL("../desktop/update-config.json", import.meta.url), "utf8"));
  if (parseUpdateConfig(config)?.publisherNames.length) {
    t.skip("A signed release source has been configured; the unsigned-release CLI guard no longer applies.");
    return;
  }
  const script = new URL("../scripts/build-desktop.mjs", import.meta.url);
  const { fileURLToPath } = await import("node:url");
  const result = spawnSync(process.execPath, [fileURLToPath(script), "--release"], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /signed release requires|publisherNames/);
});

test("unconfigured and development builds do not make update requests", async () => {
  for (const disabledReason of ["unconfigured", "development", "unsupported"]) {
    const updater = new FakeUpdater();
    const controller = controllerFor(updater, { disabledReason });
    controller.configureAutomaticChecks(true);
    assert.equal(controller.getState().phase, disabledReason);
    await assert.rejects(controller.check(), /not available/);
    await assert.rejects(controller.download(), /available update/);
    await assert.rejects(controller.install(), /downloaded/);
    assert.equal(updater.checks, 0);
    assert.equal(updater.downloads, 0);
    assert.equal(updater.installs.length, 0);
    controller.dispose();
  }
});

test("updates require separate download and installation consent and flush before quit", async () => {
  const updater = new FakeUpdater();
  const states = [];
  let releaseFlush;
  const flush = new Promise((resolve) => { releaseFlush = resolve; });
  const controller = controllerFor(updater, {
    onState: (state) => states.push(state),
    beforeInstall: () => flush
  });
  assert.equal(updater.autoDownload, false);
  assert.equal(updater.autoInstallOnAppQuit, false);
  assert.equal(updater.allowPrerelease, false);
  assert.equal(updater.allowDowngrade, false);
  await controller.check();
  assert.equal(controller.getState().phase, "available");
  assert.equal(updater.downloads, 0);
  await assert.rejects(controller.install(), /downloaded/);
  await controller.download();
  assert.equal(controller.getState().phase, "downloaded");
  assert.ok(states.some((state) => state.phase === "downloading" && state.percent === 42));
  assert.equal(updater.installs.length, 0);
  const installation = controller.install();
  assert.equal(controller.getState().phase, "installing");
  assert.equal(updater.installs.length, 0);
  releaseFlush();
  await installation;
  assert.deepEqual(updater.installs, [[false, true]]);
  controller.dispose();
});

test("duplicate operations are blocked while an update check is pending", async () => {
  const updater = new FakeUpdater();
  let finish;
  updater.checkForUpdates = () => new Promise((resolve) => {
    finish = () => {
      updater.emit("update-not-available", { version: "0.1.0" });
      resolve({ updateInfo: { version: "0.1.0" } });
    };
  });
  const controller = controllerFor(updater);
  const check = controller.check();
  await assert.rejects(controller.check(), /not available/);
  await assert.rejects(controller.download(), /available update/);
  finish();
  await check;
  assert.equal(controller.getState().phase, "current");
  controller.dispose();
});

test("offline errors and signature verification failures are explicit and cannot install", async () => {
  const updater = new FakeUpdater();
  const controller = controllerFor(updater);
  updater.checkForUpdates = async () => { throw new Error("Offline"); };
  assert.equal((await controller.check()).error, "Offline");
  assert.equal(controller.getState().phase, "error");
  updater.checkForUpdates = async () => {
    updater.emit("update-available", { version: "0.2.0" });
    return { updateInfo: { version: "0.2.0" } };
  };
  await controller.check();
  updater.downloadUpdate = async () => {
    const error = new Error("Installer signature or checksum does not match");
    updater.emit("error", error);
    throw error;
  };
  await controller.download();
  assert.equal(controller.getState().phase, "error");
  assert.match(controller.getState().error, /signature or checksum/);
  await assert.rejects(controller.install(), /downloaded/);
  assert.equal(updater.installs.length, 0);
  controller.dispose();
});

test("game-running and persistence failures keep the verified update available for retry", async () => {
  const updater = new FakeUpdater();
  let blocked = true;
  const controller = controllerFor(updater, {
    beforeInstall: async () => {
      if (blocked) throw new Error("Close Rocket League or resolve the state-save error first");
    }
  });
  await controller.check();
  await controller.download();
  await controller.install();
  assert.equal(controller.getState().phase, "downloaded");
  assert.match(controller.getState().error, /Close Rocket League/);
  assert.equal(updater.installs.length, 0);
  blocked = false;
  await controller.install();
  assert.equal(updater.installs.length, 1);
  controller.dispose();
});

test("automatic checks start without downloading and can be disabled and disposed", async () => {
  const updater = new FakeUpdater();
  const controller = controllerFor(updater);
  controller.configureAutomaticChecks(true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(updater.checks, 1);
  assert.equal(updater.downloads, 0);
  controller.configureAutomaticChecks(false);
  controller.dispose();
  assert.equal(updater.listenerCount("error"), 0);
  assert.equal(updater.listenerCount("update-available"), 0);
});

test("an empty provider result is not reported as a successful update check", async () => {
  const updater = new FakeUpdater();
  updater.checkForUpdates = async () => null;
  const controller = controllerFor(updater);
  await controller.check();
  assert.equal(controller.getState().phase, "error");
  assert.match(controller.getState().error, /did not return/);
  controller.dispose();
});

function fakeElement() {
  return {
    hidden: false, disabled: false, checked: false, value: "", textContent: "",
    style: {}, classList: { add() {} }, listeners: new Map(),
    append() {}, replaceChildren() {},
    addEventListener(name, callback) { this.listeners.set(name, callback); }
  };
}

test("update UI localizes all seven languages and gates download and restart controls", async () => {
  const elements = new Map();
  const getElement = (id) => {
    if (!elements.has(id)) elements.set(id, fakeElement());
    return elements.get(id);
  };
  let onUpdate;
  let installations = 0;
  let confirmed = false;
  const initialUpdate = { phase: "unconfigured", version: "0.1.0", source: null };
  const bridge = {
    onModel() {}, onStatus() {}, onError() {},
    onUpdate(callback) { onUpdate = callback; },
    getState: async () => ({
      locale: "de", port: 49123, status: "disconnected", models: [],
      update: initialUpdate, autoCheckUpdates: true
    }),
    installUpdate: async () => { installations += 1; return { ...initialUpdate, phase: "installing" }; },
    setLocale: async (locale) => ({ locale })
  };
  const source = await readFile(new URL("../desktop/renderer.js", import.meta.url), "utf8");
  const texts = vm.runInNewContext(`${source}\nTEXT;`, {
    document: {
      getElementById: getElement, createElement: fakeElement, documentElement: { lang: "" }
    },
    window: { rocketStatsDesktop: bridge, confirm: () => confirmed }
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(getElement("update-check").disabled, true);
  assert.equal(getElement("update-install").hidden, true);
  const keys = Object.keys(texts.en).filter((key) => key.startsWith("update"));
  for (const locale of ["de", "en", "pl", "fr", "es", "pt", "ru"]) {
    for (const key of keys) assert.ok(texts[locale][key], `${locale}: ${key}`);
    await getElement("locale-select").listeners.get("change")({ target: { value: locale } });
    assert.equal(getElement("update-check").textContent, texts[locale].updateCheck);
  }
  onUpdate({ phase: "available", version: "0.1.0", availableVersion: "0.2.0" });
  assert.equal(getElement("update-download").hidden, false);
  assert.equal(getElement("update-install").hidden, true);
  onUpdate({ phase: "downloading", version: "0.1.0", availableVersion: "0.2.0", percent: 42 });
  assert.equal(getElement("update-progress").value, 42);
  assert.equal(getElement("update-check").disabled, true);
  onUpdate({ phase: "downloaded", version: "0.1.0", availableVersion: "0.2.0", percent: 100 });
  assert.equal(getElement("update-install").disabled, false);
  await getElement("update-install").listeners.get("click")();
  assert.equal(installations, 0);
  confirmed = true;
  await getElement("update-install").listeners.get("click")();
  assert.equal(installations, 1);
});
