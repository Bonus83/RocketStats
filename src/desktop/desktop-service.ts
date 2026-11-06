import { getRocketLeaguePaths } from "../core/rocket-league-paths.js";
import { MmrHistoryPoint, PluginLocale } from "../core/types.js";
import { PluginState } from "../core/plugin-state.js";
import { RocketLeagueLogWatcher } from "../connector/rocket-league-log-watcher.js";
import { getRocketLeagueProcessStartTime } from "../core/rocket-league-process.js";
import { LiveRuntime, LiveConnectionStatus, LiveErrorKind, LiveMatchStatus } from "../runtime/live-runtime.js";
import { ActionKind, KeyRenderModel } from "../render/key-renderer.js";

export interface DesktopServiceOptions {
  statePath: string;
  locale: PluginLocale;
  port: number;
  onModel: (model: KeyRenderModel) => void;
  onStatus: (status: LiveConnectionStatus) => void;
  onError: (message: string, kind: LiveErrorKind, code?: string) => void;
}

export interface DesktopService {
  stop(): void;
  getMatchStatus(): LiveMatchStatus;
  prepareForUpdate(): Promise<void>;
  resumeAfterUpdateFailure(): Promise<void>;
  configureLocale(locale: PluginLocale): void;
  configurePort(port: number): void;
  toggleStatsScope(): Promise<void>;
  resetStats(): Promise<void>;
  getMmrHistory(): Record<string, MmrHistoryPoint[]>;
}

const ACTION_KINDS: ActionKind[] = [
  "score", "timer", "boost", "event-banner", "last-goal", "streak", "mmr",
  "queue-status", "ban-countdown", "speed", "ping", "possession", "records",
  "goals", "assists", "saves", "shots", "demos", "flip-resets", "touches",
  "player-score", "stats-scope", "stats-reset", "rank", "mmr-wl"
];

export async function startDesktopService(
  options: DesktopServiceOptions
): Promise<DesktopService> {
  const state = new PluginState({
    statePath: options.statePath,
    identityGraceWindowMs: 90_000,
    reconnectWindowMs: 10 * 60_000
  });
  await state.initialize();

  let logWatcher: RocketLeagueLogWatcher | undefined;
  let identityRecoveryInProgress = false;
  let stopped = false;
  let suspendedForUpdate = false;
  let currentLocale = options.locale;
  let currentPort = options.port;
  const recoverIdentity = (): void => {
    if (stopped || process.platform !== "win32" || !logWatcher || identityRecoveryInProgress) {
      return;
    }
    identityRecoveryInProgress = true;
    void (async () => {
      const processStartedAt = await getRocketLeagueProcessStartTime();
      if (processStartedAt !== undefined && !stopped) {
        await logWatcher?.recoverIdentityAfter(processStartedAt);
      }
    })().catch((error: unknown) => {
      if (stopped) {
        return;
      }
      options.onError(error instanceof Error ? error.message : String(error), "other");
    }).finally(() => {
      identityRecoveryInProgress = false;
    });
  };

  const createRuntime = (): LiveRuntime => new LiveRuntime(state, { render: options.onModel }, {
    host: "127.0.0.1",
    port: currentPort,
    reconnectDelayMs: 3_000,
    actionKinds: ACTION_KINDS,
    locale: currentLocale,
    mmrPlaylist: "auto",
    eventBannerStats: ["goals", "assists", "saves"],
    animateEvents: true,
    onError: (error, kind) => options.onError(
      error.message,
      kind,
      "code" in error && typeof error.code === "string" ? error.code : undefined
    ),
    onConnected: recoverIdentity,
    onConnectionStatus: options.onStatus
  });
  let runtime = createRuntime();

  const resumeAfterUpdateFailure = async (): Promise<void> => {
    if (!suspendedForUpdate || stopped) {
      return;
    }
    runtime = createRuntime();
    let watcherError: Error | undefined;
    try {
      await logWatcher?.start();
    } catch (error) {
      watcherError = error instanceof Error ? error : new Error(String(error));
      logWatcher?.stop();
      logWatcher = undefined;
    }
    if (stopped) {
      logWatcher?.stop();
      return;
    }
    try {
      runtime.start();
    } catch (error) {
      logWatcher?.stop();
      throw error;
    }
    suspendedForUpdate = false;
    if (watcherError) {
      throw new Error(`Could not resume the Rocket League log watcher: ${watcherError.message}`);
    }
  };

  try {
    const logPath = process.env.RL_LOG_PATH ??
      (process.platform === "win32" ? getRocketLeaguePaths().logPath : undefined);
    if (logPath) {
      logWatcher = new RocketLeagueLogWatcher(
        logPath,
        (queue) => runtime.recordGameLogQueue(queue),
        (error) => options.onError(error.message, "other"),
        500,
        (accountId) => runtime.recordGameLogIdentity(accountId)
      );
      await logWatcher.start();
    }
  } catch (error) {
    options.onError(
      `The read-only Rocket League log watcher could not start: ${
        error instanceof Error ? error.message : String(error)
      }`,
      "other"
    );
    logWatcher?.stop();
    logWatcher = undefined;
  }

  runtime.start();

  return {
    stop: () => {
      stopped = true;
      runtime.stop();
      logWatcher?.stop();
    },
    getMatchStatus: () => runtime.getMatchStatus(),
    prepareForUpdate: async () => {
      if (stopped || suspendedForUpdate) {
        throw new Error("The desktop service is not available for update preparation.");
      }
      suspendedForUpdate = true;
      try {
        runtime.stop();
        await logWatcher?.stopAndDrain();
        await state.persistActiveAccount();
      } catch (error) {
        try {
          await resumeAfterUpdateFailure();
        } catch (recoveryError) {
          throw new AggregateError(
            [error, recoveryError],
            `Update preparation failed: ${error instanceof Error ? error.message : String(error)}. ` +
              `Live tracking could not fully resume: ${
                recoveryError instanceof Error ? recoveryError.message : String(recoveryError)
              }`
          );
        }
        throw error;
      }
    },
    resumeAfterUpdateFailure,
    configureLocale: (locale) => {
      runtime.configureLocale(locale);
      currentLocale = locale;
    },
    configurePort: (port) => {
      runtime.configurePort(port);
      currentPort = port;
    },
    toggleStatsScope: () => runtime.toggleStatsScope(),
    resetStats: () => runtime.resetStats(),
    getMmrHistory: () => state.getMmrHistory()
  };
}
