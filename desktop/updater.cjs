const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const CHECKABLE = new Set(["idle", "current", "available", "error"]);

function createUpdateController({ updater, version, source, disabledReason, onState, beforeInstall }) {
  let state = {
    phase: disabledReason || "idle",
    version,
    source,
    availableVersion: null,
    percent: null,
    error: null
  };
  let interval;
  const listeners = [];
  const publish = (next) => {
    state = { ...state, ...next };
    onState({ ...state });
    return { ...state };
  };
  const errorMessage = (error) => error instanceof Error ? error.message : String(error);
  const fail = (error) => publish({
    phase: "error", availableVersion: null, percent: null, error: errorMessage(error)
  });
  const listen = (event, handler) => {
    updater.on(event, handler);
    listeners.push([event, handler]);
  };

  if (!disabledReason) {
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.allowPrerelease = false;
    updater.allowDowngrade = false;
    listen("error", fail);
    listen("update-available", (info) => {
      if (state.phase === "checking") {
        publish({ phase: "available", availableVersion: info.version, error: null });
      }
    });
    listen("update-not-available", () => {
      if (state.phase === "checking") {
        publish({ phase: "current", availableVersion: null, error: null });
      }
    });
    listen("download-progress", (progress) => {
      if (state.phase === "downloading" && Number.isFinite(progress.percent)) {
        publish({ percent: Math.min(100, Math.max(0, progress.percent)) });
      }
    });
    listen("update-downloaded", (info) => {
      if (state.phase === "downloading") {
        publish({ phase: "downloaded", availableVersion: info.version, percent: 100, error: null });
      }
    });
  }

  const controller = {
    getState: () => ({ ...state }),
    async check() {
      if (!CHECKABLE.has(state.phase)) throw new Error("Update check is not available in the current state.");
      publish({ phase: "checking", availableVersion: null, percent: null, error: null });
      try {
        const result = await updater.checkForUpdates();
        if (!result || state.phase === "checking") {
          throw new Error("The update provider did not return an update result.");
        }
      } catch (error) {
        fail(error);
      }
      return { ...state };
    },
    async download() {
      if (state.phase !== "available") throw new Error("Check for an available update before downloading.");
      publish({ phase: "downloading", percent: 0, error: null });
      try {
        await updater.downloadUpdate();
        if (state.phase === "downloading") {
          throw new Error("The updater did not confirm a verified download.");
        }
      } catch (error) {
        fail(error);
      }
      return { ...state };
    },
    async install() {
      if (state.phase !== "downloaded") throw new Error("A verified update must be downloaded before installing.");
      publish({ phase: "installing", error: null });
      try {
        await beforeInstall();
      } catch (error) {
        return publish({ phase: "downloaded", error: errorMessage(error) });
      }
      try {
        updater.quitAndInstall(false, true);
      } catch (error) {
        fail(error);
      }
      return { ...state };
    },
    configureAutomaticChecks(enabled) {
      if (interval) clearInterval(interval);
      interval = undefined;
      if (!enabled || disabledReason) return;
      if (CHECKABLE.has(state.phase)) void controller.check();
      interval = setInterval(() => {
        if (CHECKABLE.has(state.phase)) void controller.check();
      }, CHECK_INTERVAL_MS);
      interval.unref();
    },
    dispose() {
      if (interval) clearInterval(interval);
      for (const [event, handler] of listeners) updater.removeListener(event, handler);
    }
  };
  return controller;
}

module.exports = { createUpdateController };
