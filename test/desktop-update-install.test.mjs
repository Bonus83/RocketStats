import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";
import updaterModule from "../desktop/updater.cjs";

const { createUpdateController } = updaterModule;
const mainUrl = new URL("../desktop/main.cjs", import.meta.url);
const realRequire = createRequire(mainUrl);

test("desktop update IPC checks match status without blocking a running game", async () => {
  const handlers = new Map();
  const errors = [];
  let running = false;
  let processError;
  let matchStatus = "unknown";
  let prepared = 0;
  let resumed = 0;
  const app = {
    setName() {}, requestSingleInstanceLock: () => true,
    getPath: () => "unused-user-data", whenReady: () => new Promise(() => {}),
    on() {}
  };
  const frame = {};
  const webContents = { mainFrame: frame };
  const context = vm.createContext({
    __dirname: dirname(fileURLToPath(mainUrl)),
    console: { error: (...args) => errors.push(args) },
    process,
    require(id) {
      if (id === "electron") {
        return { app, BrowserWindow: class {}, dialog: {}, ipcMain: {
          handle: (name, handler) => handlers.set(name, handler)
        } };
      }
      if (id === "node:child_process") {
        return {
          execFileSync(command, args) {
            assert.equal(command, "tasklist");
            assert.deepEqual([...args], ["/FI", "IMAGENAME eq RocketLeague.exe", "/NH"]);
            if (processError) throw processError;
            return running ? "RocketLeague.exe 123 Console 1 50,000 K" : "No tasks are running.";
          }
        };
      }
      return realRequire(id);
    },
    windowStub: { webContents },
    serviceStub: {
      getMatchStatus: () => matchStatus,
      prepareForUpdate: async () => { prepared += 1; },
      resumeAfterUpdateFailure: async () => { resumed += 1; }
    }
  });
  vm.runInContext(await readFile(mainUrl, "utf8"), context, { filename: fileURLToPath(mainUrl) });
  vm.runInContext("mainWindow = windowStub; service = serviceStub;", context);
  const getMatchStatus = vm.runInContext("getUpdateMatchStatus", context);
  const beforeInstall = vm.runInContext("prepareUpdateInstallation", context);
  const resumeAfterInstallFailure = vm.runInContext("resumeAfterUpdateFailure", context);
  const assertGameClosed = vm.runInContext("assertRocketLeagueClosed", context);

  assert.equal(getMatchStatus(), "not-in-match");
  running = true;
  assert.equal(getMatchStatus(), "unknown");
  matchStatus = "in-match";
  assert.equal(getMatchStatus(), "in-match");
  matchStatus = "not-in-match";
  assert.equal(getMatchStatus(), "not-in-match");
  matchStatus = "unknown";
  processError = new Error("tasklist failed");
  assert.equal(getMatchStatus(), "unknown");
  assert.match(String(errors[0][1]), /tasklist failed/);
  processError = undefined;
  assert.throws(() => assertGameClosed("Close the game for API setup."), /API setup/);

  const updater = new EventEmitter();
  updater.checkForUpdates = async () => {
    updater.emit("update-available", { version: "0.2.0" });
    return { updateInfo: { version: "0.2.0" } };
  };
  updater.downloadUpdate = async () => {
    updater.emit("update-downloaded", { version: "0.2.0" });
  };
  const installs = [];
  updater.quitAndInstall = (...args) => installs.push(args);
  const controller = createUpdateController({
    updater, version: "0.1.0", source: "example/repo", onState() {},
    getMatchStatus, beforeInstall, resumeAfterInstallFailure
  });
  context.testController = controller;
  vm.runInContext("updateController = testController;", context);
  await controller.check();
  await controller.download();

  const event = { sender: webContents, senderFrame: frame };
  matchStatus = "not-in-match";
  assert.equal(handlers.get("desktop:update-match-status")(event), "not-in-match");
  matchStatus = "in-match";
  assert.deepEqual(await handlers.get("desktop:install-update")(event, "not-in-match"), {
    needsConfirmation: true, matchStatus: "in-match"
  });
  assert.equal(prepared, 0);
  assert.equal(installs.length, 0);
  await handlers.get("desktop:install-update")(event, "in-match");
  assert.equal(prepared, 1);
  assert.deepEqual(installs, [[false, true]]);
  assert.throws(
    () => handlers.get("desktop:update-match-status")({ sender: {}, senderFrame: frame }),
    /only be controlled from the desktop dashboard/
  );
  controller.dispose();

  updater.quitAndInstall = () => { throw new Error("Installer could not start"); };
  const retryController = createUpdateController({
    updater, version: "0.1.0", source: "example/repo", onState() {},
    getMatchStatus, beforeInstall, resumeAfterInstallFailure
  });
  await retryController.check();
  await retryController.download();
  await retryController.install("in-match");
  assert.equal(prepared, 2);
  assert.equal(resumed, 1);
  assert.match(retryController.getState().error, /Installer could not start/);
  retryController.dispose();
});
