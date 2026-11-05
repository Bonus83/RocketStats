import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import configModule from "../desktop/update-config.cjs";
import updaterModule from "../desktop/updater.cjs";
import { createDesktopDom } from "./fixtures/desktop-dom.mjs";

const { parseUpdateConfig, desktopBuildConfig, updateDisabledReason } = configModule;
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
    return ["downloaded-installer"];
  };
  quitAndInstall(...args) { this.installs.push(args); }
}

function controllerFor(updater, extra = {}) {
  return createUpdateController({
    updater, version: "0.1.0", source: "example-owner/desktop-releases",
    onState: () => {}, beforeInstall: async () => {}, ...extra
  });
}

test("release config supports unsigned releases and optional pinned publishers", () => {
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
  const unsignedBuild = desktopBuildConfig(sourceOnly, true);
  assert.equal(unsignedBuild.forceCodeSigning, false);
  assert.equal(unsignedBuild.win.verifyUpdateCodeSignature, false);
  assert.equal("publisherName" in unsignedBuild.win, false);
  assert.deepEqual(unsignedBuild.publish, [{
    provider: "github", owner: "example-owner", repo: "desktop-releases",
    private: false, releaseType: "release"
  }]);
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

test("the configured GitHub source enables installed Windows updates without a certificate", async () => {
  const input = JSON.parse(await readFile(new URL("../desktop/update-config.json", import.meta.url), "utf8"));
  const config = parseUpdateConfig(input);
  assert.deepEqual(config, { owner: "Bonus83", repo: "RocketStats", publisherNames: [] });
  assert.equal(updateDisabledReason(config, true, "win32"), undefined);
  assert.equal(updateDisabledReason(config, false, "win32"), "development");
  assert.equal(updateDisabledReason(config, true, "linux"), "unsupported");
  assert.equal(updateDisabledReason(null, true, "win32"), "unconfigured");
  assert.equal(desktopBuildConfig(config, true).publish[0].repo, "RocketStats");
  const updater = new FakeUpdater();
  const controller = controllerFor(updater, {
    source: `${config.owner}/${config.repo}`,
    publisherVerification: config.publisherNames.length > 0,
    disabledReason: updateDisabledReason(config, true, "win32")
  });
  controller.configureAutomaticChecks(true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(controller.getState().phase, "available");
  assert.equal(controller.getState().publisherVerification, false);
  assert.equal(updater.checks, 1);
  assert.equal(updater.downloads, 0);
  assert.equal(updater.installs.length, 0);
  await controller.download();
  assert.equal(controller.getState().phase, "downloaded");
  assert.equal(updater.installs.length, 0);
  controller.dispose();
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
  assert.equal(controller.getState().publisherVerification, false);
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

test("offline and checksum failures are explicit and cannot install", async () => {
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
    const error = new Error("Installer checksum does not match");
    updater.emit("error", error);
    throw error;
  };
  await controller.download();
  assert.equal(controller.getState().phase, "error");
  assert.match(controller.getState().error, /checksum/);
  await assert.rejects(controller.install(), /downloaded/);
  assert.equal(updater.installs.length, 0);
  controller.dispose();
});

test("publisher verification failures remain errors when signing is configured", async () => {
  const updater = new FakeUpdater();
  const controller = controllerFor(updater, { publisherVerification: true });
  assert.equal(controller.getState().publisherVerification, true);
  await controller.check();
  updater.downloadUpdate = async () => {
    const error = new Error("Installer publisher signature does not match");
    updater.emit("error", error);
    throw error;
  };
  await controller.download();
  assert.equal(controller.getState().phase, "error");
  assert.match(controller.getState().error, /publisher signature/);
  await assert.rejects(controller.install(), /downloaded/);
  assert.equal(updater.installs.length, 0);
  controller.dispose();
});

test("game-running and persistence failures keep the downloaded update available for retry", async () => {
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

test("update UI localizes all seven languages and gates download and restart controls", async () => {
  const { document, getElement, setTimeout, clearTimeout } = createDesktopDom();
  let onUpdate;
  let installations = 0;
  let confirmed = false;
  let confirmation = "";
  const initialUpdate = { phase: "unconfigured", version: "0.1.0", source: null, publisherVerification: false };
  const bridge = {
    onModel() {}, onStatus() {}, onError() {},
    onUpdate(callback) { onUpdate = callback; },
    getState: async () => ({
      locale: "de", port: 49123,
      connection: { status: "disconnected", error: null, revision: 0 }, models: [],
      update: initialUpdate, autoCheckUpdates: true
    }),
    installUpdate: async () => { installations += 1; return { ...initialUpdate, phase: "installing" }; },
    setLocale: async (locale) => ({ locale })
  };
  const source = await readFile(new URL("../desktop/renderer.js", import.meta.url), "utf8");
  const texts = vm.runInNewContext(`${source}\nTEXT;`, {
    document, setTimeout, clearTimeout,
    window: { rocketStatsDesktop: bridge, confirm: (message) => { confirmation = message; return confirmed; } }
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(getElement("update-check").disabled, true);
  assert.equal(getElement("update-install").hidden, true);
  const keys = Object.keys(texts.en).filter((key) => key.startsWith("update"));
  for (const locale of ["de", "en", "pl", "fr", "es", "pt", "ru"]) {
    for (const key of keys) assert.ok(texts[locale][key], `${locale}: ${key}`);
    await getElement("locale-select").listeners.get("change")({ target: { value: locale } });
    assert.equal(getElement("update-check").textContent, texts[locale].updateCheck);
    assert.equal(getElement("update-show").textContent, texts[locale].updateShow);
    assert.equal(getElement("update-close").attributes.get("aria-label"), texts[locale].updateClose);
    assert.equal(getElement("menu-toggle").attributes.get("aria-label"), texts[locale].menu);
    onUpdate({
      phase: "available", version: "0.1.0", source: "Bonus83/RocketStats",
      publisherVerification: false, availableVersion: "0.2.0"
    });
    assert.equal("updateUnsigned" in texts[locale], false);
    onUpdate({
      phase: "downloaded", version: "0.1.0", source: "Bonus83/RocketStats",
      publisherVerification: false, availableVersion: "0.2.0", percent: 100
    });
    await getElement("update-install").listeners.get("click")();
    assert.equal(confirmation, texts[locale].updateConfirm);
  }
  onUpdate({
    phase: "available", version: "0.1.0", source: "Bonus83/RocketStats",
    publisherVerification: false, availableVersion: "0.2.0"
  });
  assert.equal(getElement("update-download").hidden, false);
  assert.equal(getElement("update-install").hidden, true);
  onUpdate({
    phase: "downloading", version: "0.1.0", source: "Bonus83/RocketStats",
    publisherVerification: false, availableVersion: "0.2.0", percent: 42
  });
  assert.equal(getElement("update-progress").value, 42);
  assert.equal(getElement("update-check").disabled, true);
  onUpdate({
    phase: "downloaded", version: "0.1.0", source: "Bonus83/RocketStats",
    publisherVerification: false, availableVersion: "0.2.0", percent: 100
  });
  assert.equal(getElement("update-install").disabled, false);
  await getElement("update-install").listeners.get("click")();
  assert.equal(installations, 0);
  assert.equal(confirmation, texts.ru.updateConfirm);
  confirmed = true;
  await getElement("update-install").listeners.get("click")();
  assert.equal(installations, 1);
  onUpdate({
    phase: "downloaded", version: "0.1.0", source: "Bonus83/RocketStats",
    publisherVerification: true, availableVersion: "0.2.0", percent: 100
  });
  confirmed = false;
  await getElement("update-install").listeners.get("click")();
  assert.equal(confirmation, texts.ru.updateConfirm);
  assert.equal(installations, 1);
  onUpdate({ phase: "idle", version: "0.1.0", source: "Bonus83/RocketStats" });
});
