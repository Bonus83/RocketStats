import { homedir } from "node:os";
import streamDeck from "@elgato/streamdeck";
import { PluginLocale } from "./core/types.js";
import { getRocketLeaguePaths } from "./core/rocket-league-paths.js";
import { getRocketLeagueProcessStartTime } from "./core/rocket-league-process.js";
import { getStatePath } from "./core/storage-path.js";
import { PluginState } from "./core/plugin-state.js";
import { RlControlClient } from "./control/rl-control-client.js";
import { ConsoleActionSink } from "./runtime/console-action-sink.js";
import { LiveRuntime } from "./runtime/live-runtime.js";
import { RocketLeagueLogWatcher } from "./connector/rocket-league-log-watcher.js";
import { MultiSink } from "./runtime/multi-sink.js";
import { StreamDeckActionSink } from "./runtime/streamdeck-action-sink.js";
import {
  AssistsAction,
  BanCountdownAction,
  BoostAction,
  DemosAction,
  EventBannerAction,
  FlipResetsAction,
  GoalsAction,
  HudToggleAction,
  LastGoalAction,
  MmrAction,
  MmrWinLossAction,
  PingAction,
  PlayerScoreAction,
  PossessionAction,
  QueueStatusAction,
  RankAction,
  RecordsAction,
  SavesAction,
  ScoreAction,
  ShotsAction,
  SpeedAction,
  StatsResetAction,
  StatsScopeAction,
  StreakAction,
  TouchesAction,
  TimerAction
} from "./streamdeck/actions.js";
import { RenderBus } from "./streamdeck/render-bus.js";
import { startStreamDeckRuntime } from "./streamdeck/startup.js";

const statePath = getStatePath({
  platform: process.platform,
  homeDirectory: homedir(),
  ...(process.env.APPDATA ? { appData: process.env.APPDATA } : {}),
  ...(process.env.XDG_STATE_HOME
    ? { xdgStateHome: process.env.XDG_STATE_HOME }
    : {})
});

export const pluginState = new PluginState({
  statePath,
  identityGraceWindowMs: 90_000,
  reconnectWindowMs: 10 * 60_000
});

const controlClient = new RlControlClient({
  host: "127.0.0.1",
  port: Number(process.env.RL_CONTROL_PORT ?? "49124"),
  timeoutMs: 1_500
});
let runtime: LiveRuntime;
let gameLogWatcher: RocketLeagueLogWatcher | undefined;
let identityRecoveryInProgress = false;
const renderBus = new RenderBus();
const sink = new MultiSink([
  new StreamDeckActionSink(renderBus),
  new ConsoleActionSink()
]);

function parseLocale(input: string | undefined): PluginLocale {
  switch (input) {
    case "de":
    case "en":
    case "pl":
    case "fr":
    case "es":
    case "pt":
    case "ru":
      return input;
    default:
      return "en";
  }
}

function parseEventBannerStats(
  raw: string | undefined
): Array<"goals" | "assists" | "saves" | "shots" | "demos" | "score" | "ping"> {
  const allowed = new Set(["goals", "assists", "saves", "shots", "demos", "score", "ping"]);
  const parsed = (raw ?? "goals,assists,saves")
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is "goals" | "assists" | "saves" | "shots" | "demos" | "score" | "ping" => allowed.has(item));
  return parsed.length > 0 ? parsed.slice(0, 3) : ["goals", "assists", "saves"];
}

function parseBoolean(input: string | undefined, fallback: boolean): boolean {
  if (input === undefined) {
    return fallback;
  }
  const normalized = input.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
    return false;
  }
  return fallback;
}

function validPort(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 65535
    ? value
    : undefined;
}

function recoverGameLogIdentity(): void {
  const watcher = gameLogWatcher;
  if (!watcher || identityRecoveryInProgress) {
    return;
  }
  identityRecoveryInProgress = true;
  void (async () => {
    const processStartedAt = await getRocketLeagueProcessStartTime();
    if (processStartedAt !== undefined) {
      await watcher.recoverIdentityAfter(processStartedAt);
    }
  })().catch((error: unknown) => {
    process.stderr.write(
      `[rocketstats:log] ${error instanceof Error ? error.message : String(error)}\n`
    );
  }).finally(() => {
    identityRecoveryInProgress = false;
  });
}

function applyGlobalSettings(settings: Record<string, unknown>): void {
  const apiPort = validPort(settings.apiPort);
  const controlPort = validPort(settings.controlPort);
  if (apiPort !== undefined) {
    runtime.configurePort(apiPort);
  }
  if (controlPort !== undefined) {
    controlClient.configurePort(controlPort);
  }
  runtime.configureManualDisplayName(
    typeof settings.manualDisplayName === "string" ? settings.manualDisplayName : undefined
  );
}

streamDeck.settings.onDidReceiveGlobalSettings((ev) => {
  applyGlobalSettings(ev.settings);
});

runtime = new LiveRuntime(pluginState, sink, {
  host: "127.0.0.1",
  port: Number(process.env.RL_STATS_PORT ?? "49123"),
  reconnectDelayMs: 3_000,
  actionKinds: [
    "score",
    "timer",
    "boost",
    "event-banner",
    "last-goal",
    "streak",
    "mmr",
    "queue-status",
    "ban-countdown",
    "speed",
    "ping",
    "possession",
    "records",
    "goals",
    "assists",
    "saves",
    "shots",
    "demos",
    "flip-resets",
    "touches",
    "player-score",
    "stats-scope",
    "stats-reset",
    "rank",
    "mmr-wl"
  ],
  locale: parseLocale(process.env.ROCKETSTATS_LOCALE),
  mmrPlaylist: process.env.ROCKETSTATS_MMR_PLAYLIST ?? "auto",
  eventBannerStats: parseEventBannerStats(process.env.ROCKETSTATS_EVENT_STATS),
  animateEvents: parseBoolean(process.env.ROCKETSTATS_ANIMATE_EVENTS, true),
  onConnected: recoverGameLogIdentity
});

export async function startPlugin(): Promise<void> {
  await startStreamDeckRuntime({
    initialize: () => pluginState.initialize(),
    registerActions: () => {
      streamDeck.actions.registerAction(new ScoreAction(renderBus));
      streamDeck.actions.registerAction(new TimerAction(renderBus));
      streamDeck.actions.registerAction(new BoostAction(renderBus));
      streamDeck.actions.registerAction(new EventBannerAction(renderBus));
      streamDeck.actions.registerAction(new LastGoalAction(renderBus));
      streamDeck.actions.registerAction(new StreakAction(renderBus));
      streamDeck.actions.registerAction(new MmrAction(renderBus));
      streamDeck.actions.registerAction(new QueueStatusAction(renderBus));
      streamDeck.actions.registerAction(new BanCountdownAction(renderBus));
      streamDeck.actions.registerAction(new SpeedAction(renderBus));
      streamDeck.actions.registerAction(new PingAction(renderBus));
      streamDeck.actions.registerAction(new PossessionAction(renderBus));
      streamDeck.actions.registerAction(new RecordsAction(renderBus));
      streamDeck.actions.registerAction(new GoalsAction(renderBus));
      streamDeck.actions.registerAction(new AssistsAction(renderBus));
      streamDeck.actions.registerAction(new SavesAction(renderBus));
      streamDeck.actions.registerAction(new ShotsAction(renderBus));
      streamDeck.actions.registerAction(new DemosAction(renderBus));
      streamDeck.actions.registerAction(new FlipResetsAction(renderBus));
      streamDeck.actions.registerAction(new TouchesAction(renderBus));
      streamDeck.actions.registerAction(new PlayerScoreAction(renderBus));
      streamDeck.actions.registerAction(new StatsScopeAction(renderBus, runtime));
      streamDeck.actions.registerAction(new StatsResetAction(renderBus, runtime));
      streamDeck.actions.registerAction(new RankAction(renderBus));
      streamDeck.actions.registerAction(new MmrWinLossAction(renderBus));
      streamDeck.actions.registerAction(new HudToggleAction(controlClient));
    },
    connect: () => streamDeck.connect(),
    loadSettings: async () => {
      const globalSettings = await streamDeck.settings.getGlobalSettings();
      applyGlobalSettings(globalSettings);
    },
    startRuntime: () => runtime.start()
  });

  try {
    const gameLogPath = process.env.RL_LOG_PATH ??
      (process.platform === "win32" ? getRocketLeaguePaths().logPath : undefined);
    if (gameLogPath) {
      gameLogWatcher = new RocketLeagueLogWatcher(
        gameLogPath,
        (queue) => runtime.recordGameLogQueue(queue),
        (error) => process.stderr.write(`[rocketstats:log] ${error.message}\n`),
        500,
        (accountId) => runtime.recordGameLogIdentity(accountId)
      );
      await gameLogWatcher.start();
      recoverGameLogIdentity();
    }
  } catch (error) {
    process.stderr.write(
      `[rocketstats:log] ${error instanceof Error ? error.message : String(error)}\n`
    );
  }
}

await startPlugin();
