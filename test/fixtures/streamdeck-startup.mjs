import { join } from "node:path";
import streamDeck from "@elgato/streamdeck";
import { PluginState } from "../../com.rocketstats.livestats.sdPlugin/bin/core/plugin-state.js";
import { LiveRuntime } from "../../com.rocketstats.livestats.sdPlugin/bin/runtime/live-runtime.js";
import { StreamDeckActionSink } from "../../com.rocketstats.livestats.sdPlugin/bin/runtime/streamdeck-action-sink.js";
import { ScoreAction } from "../../com.rocketstats.livestats.sdPlugin/bin/streamdeck/actions.js";
import { RenderBus } from "../../com.rocketstats.livestats.sdPlugin/bin/streamdeck/render-bus.js";
import { startStreamDeckRuntime } from "../../src/streamdeck/startup.ts";

const state = new PluginState({
  statePath: join(process.env.APPDATA, "state.json"),
  identityGraceWindowMs: 90_000,
  reconnectWindowMs: 600_000
});
const bus = new RenderBus();
const runtime = new LiveRuntime(state, new StreamDeckActionSink(bus), {
  host: "127.0.0.1",
  port: Number(process.env.RL_STATS_PORT),
  reconnectDelayMs: 3000,
  actionKinds: ["score"],
  locale: "en",
  mmrPlaylist: "ranked_2v2",
  eventBannerStats: ["goals", "assists", "saves"],
  animateEvents: false
});

await startStreamDeckRuntime({
  initialize: () => state.initialize(),
  registerActions: () => streamDeck.actions.registerAction(new ScoreAction(bus)),
  connect: () => streamDeck.connect(),
  loadSettings: async () => {
    const settings = await streamDeck.settings.getGlobalSettings();
    runtime.configurePort(settings.apiPort);
  },
  startRuntime: () => runtime.start()
});
