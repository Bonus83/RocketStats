import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const { PluginState } = await import(
  "../com.rocketstats.livestats.sdPlugin/bin/core/plugin-state.js"
);
const { renderAction } = await import(
  "../com.rocketstats.livestats.sdPlugin/bin/render/key-renderer.js"
);
const { RenderBus } = await import(
  "../com.rocketstats.livestats.sdPlugin/bin/streamdeck/render-bus.js"
);
const { createEmptySnapshot } = await import(
  "../com.rocketstats.livestats.sdPlugin/bin/core/types.js"
);

const ACCOUNT = "Steam|76561198000000001|0";
const OTHER = "Steam|76561198000000002|0";

async function createState(t) {
  const directory = await mkdtemp(join(tmpdir(), "rocketstats-scope-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const statePath = join(directory, "state.json");
  const options = { statePath, identityGraceWindowMs: 90_000, reconnectWindowMs: 600_000 };
  const state = new PluginState(options);
  await state.initialize();
  state.resolveIdentity({ accountId: ACCOUNT, observedAt: Date.now() });
  return { state, reload: async () => {
    const restored = new PluginState(options);
    await restored.initialize();
    return restored;
  } };
}

let clock = 1_000;
async function play(state, queueType, outcome) {
  clock += 1_000;
  await state.recordMatchResult({ matchId: `m${clock}`, queueType, outcome, completedAt: clock });
}

test("streak and records can be limited to the current mode and toggled back", async (t) => {
  const { state, reload } = await createState(t);
  await play(state, "ranked_2v2", "win");
  await play(state, "ranked_2v2", "win");
  await play(state, "ranked_1v1", "loss");
  await play(state, "ranked_2v2", "win");
  await state.setLastMmrPlaylist("ranked_2v2");

  assert.equal(state.getStatsScope(), "all");
  assert.equal(state.getStreakLabel(), "W1");
  assert.equal(state.getRecordsLabel(), "W2 L1");

  assert.equal(await state.toggleStatsScope(), "mode");
  assert.equal(state.getStreakLabel(), "W3");
  assert.equal(state.getRecordsLabel(), "W3 L0");

  await state.setLastMmrPlaylist("ranked_1v1");
  assert.equal(state.getStreakLabel(), "L1");
  assert.equal(state.getRecordsLabel(), "W0 L1");

  await state.setLastMmrPlaylist("ranked_3v3");
  assert.equal(state.getStreakLabel(), "W0/L0");

  const restored = await reload();
  assert.equal(restored.getStatsScope(), "mode");
  assert.equal(await state.toggleStatsScope(), "all");
  assert.equal(state.getStreakLabel(), "W1");
});

test("reset clears the scoped win/loss history and repeated result events cannot restore it", async (t) => {
  const { state, reload } = await createState(t);
  await play(state, "ranked_2v2", "win");
  await play(state, "ranked_1v1", "loss");
  await play(state, "ranked_1v1", "loss");
  await state.setPlaylistRank("ranked_1v1", 900);
  await state.setLastMmrPlaylist("ranked_1v1");

  await state.setStatsScope("mode");
  await state.resetStats();
  assert.equal(state.getStreakLabel(), "W0/L0");
  await state.setStatsScope("all");
  assert.equal(state.getRecordsLabel(), "W1 L0");
  assert.equal(state.getStreakLabel(), "W1");

  await state.recordMatchResult({ matchId: `m${clock}`, queueType: "ranked_1v1", outcome: "loss", completedAt: clock + 5 });
  assert.equal(state.getStreakLabel(), "W1");

  state.resolveIdentity({ accountId: OTHER, observedAt: Date.now() });
  await play(state, "ranked_2v2", "loss");
  state.resolveIdentity({ accountId: ACCOUNT, observedAt: Date.now() });

  await state.resetStats();
  assert.equal(state.getStreakLabel(), "W0/L0");
  assert.equal(state.getRecordsLabel(), "W0 L0");
  assert.equal(state.getMmrSummary("ranked_1v1").value, "900");

  await play(state, "ranked_2v2", "win");
  assert.equal(state.getStreakLabel(), "W1");

  const restored = await reload();
  assert.equal(restored.getStreakLabel(), "W1");
  restored.resolveIdentity({ accountId: OTHER, observedAt: Date.now() });
  assert.equal(restored.getStreakLabel(), "L1");
});

test("scope and reset keys render the current scope in the key language", () => {
  const snapshot = createEmptySnapshot();
  const all = renderAction("stats-scope", snapshot, { statsScope: "all" });
  assert.equal(all.value, "ALL");
  const mode = renderAction("stats-scope", snapshot, { statsScope: "mode", statsMode: "ranked_2v2" });
  assert.equal(mode.value, "2v2");
  assert.equal(mode.footer, "MODE");

  const streak = renderAction("streak", snapshot, { statsScope: "mode", statsMode: "ranked_2v2", streakValue: "W3" });
  assert.equal(streak.title, "STREAK");
  assert.equal(streak.footer, "2v2");
  const dropMmr = renderAction("mmr", snapshot, { mmrValue: "722", mmrPlaylist: "ranked_dropshot" });
  assert.equal(dropMmr.title, "DROP");

  const bus = new RenderBus();
  const titles = new Map();
  const images = new Map();
  const target = (name) => ({
    setTitle: (value) => { titles.set(name, value); },
    setImage: (value) => { images.set(name, value); }
  });
  bus.bind("stats-scope", target("scope"), { locale: "de" });
  bus.bind("stats-reset", target("reset"), { locale: "de" });
  bus.bind("streak", target("streak"), { locale: "de" });
  bus.publish(all);
  bus.publish(renderAction("stats-reset", snapshot, { statsScope: "all" }));
  bus.publish(streak);
  assert.equal(titles.get("scope"), "");
  const scopeSvg = Buffer.from(images.get("scope").split(",")[1], "base64").toString("utf8");
  assert.match(scopeSvg, /fill="#3EDB8D" \/><text[^>]*fill="#0A111F">GESAMT</);
  assert.equal(titles.get("reset"), "RESET\nW/L\nGESAMT");
  assert.equal(titles.get("streak"), "");
  const streakSvg = Buffer.from(images.get("streak").split(",")[1], "base64").toString("utf8");
  assert.match(streakSvg, />SERIE</);
  assert.match(streakSvg, /fill="#3EDB8D">W3</);
  assert.match(streakSvg, />2v2</);
  const lossSvg = Buffer.from(
    renderAction("streak", snapshot, { streakValue: "L2" }).image.split(",")[1], "base64"
  ).toString("utf8");
  assert.match(lossSvg, /fill="#FF4D4D">L2</);

  const mmr = renderAction("mmr", snapshot, { mmrValue: "---", mmrPlaylist: "ranked_2v2" });
  assert.equal(mmr.footer, "");
});
