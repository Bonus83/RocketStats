import { getRocketLeaguePaths } from "../core/rocket-league-paths.js";
import { PluginLocale } from "../core/types.js";
import { PluginState } from "../core/plugin-state.js";
import { RocketLeagueLogWatcher } from "../connector/rocket-league-log-watcher.js";
import { getRocketLeagueProcessStartTime } from "../core/rocket-league-process.js";
import { LiveRuntime, LiveConnectionStatus } from "../runtime/live-runtime.js";
import { ActionKind, KeyRenderModel } from "../render/key-renderer.js";

export interface DesktopServiceOptions {
  statePath: string;
  locale: PluginLocale;
  port: number;
  onModel: (model: KeyRenderModel) => void;
  onStatus: (status: LiveConnectionStatus) => void;
  onError: (message: string) => void;
}

export interface DesktopService {
  stop(): void;
  prepareForUpdate(): Promise<void>;
  configureLocale(locale: PluginLocale): void;
  configurePort(port: number): void;
  toggleStatsScope(): Promise<void>;
  resetStats(): Promise<void>;
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
  const recoverIdentity = (): void => {
    if (process.platform !== "win32" || !logWatcher || identityRecoveryInProgress) {
      return;
    }
    identityRecoveryInProgress = true;
    void (async () => {
      const processStartedAt = await getRocketLeagueProcessStartTime();
      if (processStartedAt !== undefined) {
        await logWatcher?.recoverIdentityAfter(processStartedAt);
      }
    })().catch((error: unknown) => {
      options.onError(error instanceof Error ? error.message : String(error));
    }).finally(() => {
      identityRecoveryInProgress = false;
    });
  };

  const runtime = new LiveRuntime(state, { render: options.onModel }, {
    host: "127.0.0.1",
    port: options.port,
    reconnectDelayMs: 3_000,
    actionKinds: ACTION_KINDS,
    locale: options.locale,
    mmrPlaylist: "auto",
    eventBannerStats: ["goals", "assists", "saves"],
    animateEvents: true,
    onError: (error) => options.onError(error.message),
    onConnected: recoverIdentity,
    onConnectionStatus: options.onStatus
  });

  try {
    const logPath = process.env.RL_LOG_PATH ??
      (process.platform === "win32" ? getRocketLeaguePaths().logPath : undefined);
    if (logPath) {
      logWatcher = new RocketLeagueLogWatcher(
        logPath,
        (queue) => runtime.recordGameLogQueue(queue),
        (error) => options.onError(error.message),
        500,
        (accountId) => runtime.recordGameLogIdentity(accountId)
      );
      await logWatcher.start();
    }
  } catch (error) {
    options.onError(
      `The read-only Rocket League log watcher could not start: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    logWatcher?.stop();
    logWatcher = undefined;
  }

  runtime.start();

  return {
    stop: () => {
      runtime.stop();
      logWatcher?.stop();
    },
    prepareForUpdate: async () => {
      runtime.stop();
      await logWatcher?.stopAndDrain();
      await state.persistActiveAccount();
    },
    configureLocale: (locale) => runtime.configureLocale(locale),
    configurePort: (port) => runtime.configurePort(port),
    toggleStatsScope: () => runtime.toggleStatsScope(),
    resetStats: () => runtime.resetStats()
  };
}
