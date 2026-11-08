const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const CHECKABLE = new Set(["idle", "current", "available", "error"]);
const MATCH_STATUSES = new Set(["in-match", "not-in-match", "unknown"]);

function createUpdateController({
  updater, version, source, publisherVerification = false, disabledReason, onState, beforeInstall,
  getMatchStatus, resumeAfterInstallFailure
}) {
  let state = {
    phase: disabledReason || "idle",
    version,
    source,
    publisherVerification,
    availableVersion: null,
    percent: null,
    error: null
  };
  let interval;
  let installationPrepared = false;
  let installationErrors = [];
  let installationRecovery;
  const listeners = [];
  const publish = (next) => {
    state = { ...state, ...next };
    onState({ ...state });
    return { ...state };
  };
  const errorMessage = (error) => error instanceof Error ? error.message : String(error);
  const readMatchStatus = () => {
    const status = getMatchStatus();
    if (!MATCH_STATUSES.has(status)) throw new Error("Invalid match status returned by the desktop service.");
    return status;
  };
  const fail = (error) => publish({
    phase: "error", availableVersion: null, percent: null, error: errorMessage(error)
  });
  const recordInstallationError = (error) => {
    if (!installationErrors.includes(error)) installationErrors.push(error);
  };
  const recoverFailedInstallation = () => {
    if (!installationRecovery) {
      installationRecovery = (async () => {
        try {
          await resumeAfterInstallFailure();
        } catch (error) {
          installationErrors.push(new Error(`Live tracking could not fully resume: ${errorMessage(error)}`));
        }
        const error = installationErrors.length === 1
          ? installationErrors[0]
          : new AggregateError(installationErrors, installationErrors.map(errorMessage).join("; "));
        return fail(error);
      })();
    }
    return installationRecovery;
  };
  const listen = (event, handler) => {
    updater.on(event, handler);
    listeners.push([event, handler]);
  };

  if (!disabledReason) {
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.allowPrerelease = false;
    updater.allowDowngrade = false;
    listen("error", (error) => {
      if (state.phase !== "installing") {
        fail(error);
        return;
      }
      recordInstallationError(error);
      if (installationPrepared) {
        void recoverFailedInstallation().catch((recoveryError) => {
          console.error("Could not report update installation failure:", recoveryError);
        });
      }
    });
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
          throw new Error("The updater did not confirm the completed download.");
        }
      } catch (error) {
        fail(error);
      }
      return { ...state };
    },
    getMatchStatus() {
      if (state.phase !== "downloaded") throw new Error("An update must be downloaded before installing.");
      return readMatchStatus();
    },
    async install(confirmedStatus) {
      if (state.phase !== "downloaded") throw new Error("An update must be downloaded before installing.");
      if (!MATCH_STATUSES.has(confirmedStatus)) throw new TypeError("A confirmed match status is required.");
      const currentStatus = readMatchStatus();
      if (currentStatus !== confirmedStatus) {
        return { needsConfirmation: true, matchStatus: currentStatus };
      }
      installationPrepared = false;
      installationErrors = [];
      installationRecovery = undefined;
      publish({ phase: "installing", error: null });
      try {
        await beforeInstall();
      } catch (error) {
        recordInstallationError(error);
        return publish({
          phase: "downloaded",
          error: installationErrors.map(errorMessage).join("; ")
        });
      }
      installationPrepared = true;
      if (installationErrors.length) return recoverFailedInstallation();
      try {
        updater.quitAndInstall(true, true);
      } catch (error) {
        recordInstallationError(error);
        return recoverFailedInstallation();
      }
      return installationRecovery ? installationRecovery : { ...state };
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
