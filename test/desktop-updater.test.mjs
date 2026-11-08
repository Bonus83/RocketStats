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
    onState: () => {}, beforeInstall: async () => {},
    getMatchStatus: () => "not-in-match", resumeAfterInstallFailure: async () => {}, ...extra
  });
}

test("release config supports unsigned releases and optional pinned publishers", () => {
  const empty = { owner: "", repo: "", publisherNames: [] };
  assert.equal(parseUpdateConfig(empty), null);
  assert.equal(desktopBuildConfig(null, false).publish, null);
  assert.match(desktopBuildConfig(null, false).extraMetadata.buildDate, /^\d{4}-\d\d-\d\dT/);
  const buildDate = "2026-11-08T18:51:15.000Z";
  assert.deepEqual(desktopBuildConfig(null, false, buildDate).extraMetadata, { buildDate });
  assert.throws(() => desktopBuildConfig(null, false, "not-a-date"), /build date/);
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
    await assert.rejects(controller.install("not-in-match"), /downloaded/);
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
  await assert.rejects(controller.install("not-in-match"), /downloaded/);
  await controller.download();
  assert.equal(controller.getState().phase, "downloaded");
  assert.ok(states.some((state) => state.phase === "downloading" && state.percent === 42));
  assert.equal(updater.installs.length, 0);
  const installation = controller.install("not-in-match");
  assert.equal(controller.getState().phase, "installing");
  assert.equal(updater.installs.length, 0);
  releaseFlush();
  await installation;
  assert.deepEqual(updater.installs, [[true, true]]);
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
  await assert.rejects(controller.install("not-in-match"), /downloaded/);
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
  await assert.rejects(controller.install("not-in-match"), /downloaded/);
  assert.equal(updater.installs.length, 0);
  controller.dispose();
});

test("persistence failures keep the downloaded update available for retry", async () => {
  const updater = new FakeUpdater();
  let blocked = true;
  const controller = controllerFor(updater, {
    beforeInstall: async () => {
      if (blocked) throw new Error("Could not save account state");
    }
  });
  await controller.check();
  await controller.download();
  await controller.install("not-in-match");
  assert.equal(controller.getState().phase, "downloaded");
  assert.match(controller.getState().error, /Could not save account state/);
  assert.equal(updater.installs.length, 0);
  blocked = false;
  await controller.install("not-in-match");
  assert.equal(updater.installs.length, 1);
  controller.dispose();
});

test("installation rechecks match status and requires a fresh confirmation if it changed", async () => {
  const updater = new FakeUpdater();
  let matchStatus = "not-in-match";
  let flushes = 0;
  const controller = controllerFor(updater, {
    getMatchStatus: () => matchStatus,
    beforeInstall: async () => { flushes += 1; }
  });
  await controller.check();
  await controller.download();
  assert.equal(controller.getMatchStatus(), "not-in-match");
  await assert.rejects(controller.install(), /confirmed match status/);
  await assert.rejects(controller.install("invalid"), /confirmed match status/);

  matchStatus = "in-match";
  assert.deepEqual(await controller.install("not-in-match"), {
    needsConfirmation: true, matchStatus: "in-match"
  });
  assert.equal(controller.getState().phase, "downloaded");
  assert.equal(flushes, 0);
  assert.equal(updater.installs.length, 0);

  matchStatus = "unknown";
  assert.deepEqual(await controller.install("in-match"), {
    needsConfirmation: true, matchStatus: "unknown"
  });
  assert.equal(flushes, 0);
  await controller.install("unknown");
  assert.equal(flushes, 1);
  assert.deepEqual(updater.installs, [[true, true]]);
  controller.dispose();
});

test("invalid match status is surfaced instead of assuming no match", async () => {
  const updater = new FakeUpdater();
  const controller = controllerFor(updater, { getMatchStatus: () => undefined });
  await controller.check();
  await controller.download();
  assert.throws(() => controller.getMatchStatus(), /Invalid match status/);
  await assert.rejects(controller.install("not-in-match"), /Invalid match status/);
  assert.equal(updater.installs.length, 0);
  controller.dispose();
});

test("an installer launch failure resumes tracking and reports any recovery failure", async () => {
  for (const recoveryFails of [false, true]) {
    const updater = new FakeUpdater();
    updater.quitAndInstall = () => { throw new Error("Installer launch failed"); };
    let recoveries = 0;
    const controller = controllerFor(updater, {
      resumeAfterInstallFailure: async () => {
        recoveries += 1;
        if (recoveryFails) throw new Error("Feed restart failed");
      }
    });
    await controller.check();
    await controller.download();
    await controller.install("not-in-match");
    assert.equal(recoveries, 1);
    assert.equal(controller.getState().phase, "error");
    assert.match(controller.getState().error, /Installer launch failed/);
    if (recoveryFails) assert.match(controller.getState().error, /Feed restart failed/);
    controller.dispose();
  }
});

test("updater error events during installation resume tracking exactly once", async () => {
  for (const timing of ["preparation", "synchronous", "asynchronous", "event-and-throw"]) {
    const updater = new FakeUpdater();
    let recoveries = 0;
    let launches = 0;
    let signalFailure;
    const failed = new Promise((resolve) => { signalFailure = resolve; });
    const error = new Error(`Installer ${timing} failure`);
    const controller = controllerFor(updater, {
      onState: (state) => { if (state.phase === "error") signalFailure(state); },
      beforeInstall: async () => {
        if (timing === "preparation") updater.emit("error", error);
      },
      resumeAfterInstallFailure: async () => { recoveries += 1; }
    });
    updater.quitAndInstall = () => {
      launches += 1;
      if (timing === "asynchronous") {
        setImmediate(() => updater.emit("error", error));
      } else {
        updater.emit("error", error);
        if (timing === "event-and-throw") throw error;
      }
    };
    try {
      await controller.check();
      await controller.download();
      await controller.install("not-in-match");
      const state = await failed;
      assert.equal(recoveries, 1, timing);
      assert.equal(launches, timing === "preparation" ? 0 : 1, timing);
      assert.match(state.error, new RegExp(`Installer ${timing} failure`));
    } finally {
      controller.dispose();
    }
  }
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
  let matchStatus = "not-in-match";
  const initialUpdate = { phase: "unconfigured", version: "0.1.0", source: null, publisherVerification: false };
  const bridge = {
    onModel() {}, onStatus() {}, onError() {},
    onUpdate(callback) { onUpdate = callback; },
    getState: async () => ({
      locale: "de", port: 49123,
      connection: { status: "disconnected", error: null, revision: 0 }, models: [],
      update: initialUpdate, autoCheckUpdates: true
    }),
    getUpdateMatchStatus: async () => matchStatus,
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
    for (const [status, warning] of [
      ["not-in-match", ""],
      ["in-match", texts[locale].updateMatchActive],
      ["unknown", texts[locale].updateMatchUnknown]
    ]) {
      matchStatus = status;
      await getElement("update-install").listeners.get("click")();
      assert.equal(confirmation, [warning, texts[locale].updateConfirm].filter(Boolean).join("\n\n"));
    }
  }
  matchStatus = "not-in-match";
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
