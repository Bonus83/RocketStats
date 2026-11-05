import test from "node:test";
import assert from "node:assert/strict";
import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:net";

const { OfficialStatsNormalizer } = await import(
  "../com.rocketstats.livestats.sdPlugin/bin/connector/official-stats-normalizer.js"
);
const { RocketLeagueLogParser, RocketLeagueLogWatcher } = await import(
  "../com.rocketstats.livestats.sdPlugin/bin/connector/rocket-league-log-watcher.js"
);
const { PluginState } = await import(
  "../com.rocketstats.livestats.sdPlugin/bin/core/plugin-state.js"
);
const { LiveRuntime } = await import(
  "../com.rocketstats.livestats.sdPlugin/bin/runtime/live-runtime.js"
);
const { RenderBus } = await import(
  "../com.rocketstats.livestats.sdPlugin/bin/streamdeck/render-bus.js"
);

const ACCOUNT_A = "Steam|76561198000000001|0";
const ACCOUNT_B = "Steam|76561198000000002|0";

async function waitFor(predicate, message) {
  const deadline = Date.now() + 2_000;
  while (!predicate() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.ok(predicate(), message);
}

function player(accountId, name = "Player") {
  return { PrimaryId: accountId, Name: name, TeamNum: 0 };
}

async function createHarness(t) {
  const directory = await mkdtemp(join(tmpdir(), "rocketstats-auto-mmr-"));
  const statePath = join(directory, "state.json");
  const state = new PluginState({
    statePath,
    identityGraceWindowMs: 90_000,
    reconnectWindowMs: 600_000
  });
  await state.initialize();

  const sockets = new Set();
  let client;
  const server = createServer((socket) => {
    if (!client || client.destroyed) client = socket;
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  const bus = new RenderBus();
  const models = [];
  const titles = [];
  const errors = [];
  const runtime = new LiveRuntime(state, {
    render(model) {
      models.push(model);
      bus.publish(model);
    }
  }, {
    host: "127.0.0.1",
    port: address.port,
    reconnectDelayMs: 100,
    actionKinds: ["mmr", "rank"],
    locale: "de",
    mmrPlaylist: "auto",
    eventBannerStats: [],
    animateEvents: false,
    onError: (error) => errors.push(error)
  });
  bus.bind("mmr", { setTitle: (value) => { titles.push(value); } });
  runtime.start();
  await waitFor(() => client, "the runtime should connect to the test feed");

  t.after(async () => {
    runtime.stop();
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
    await state.persistActiveAccount();
    await rm(directory, { recursive: true, force: true });
  });

  async function send(event, matchId, data = {}) {
    const before = models.length;
    client.write(JSON.stringify({ Event: event, MatchGuid: matchId, Data: data }));
    await waitFor(() => models.length > before, `${event} should be processed`);
  }

  async function update(matchId, playlistId, players = [player(ACCOUNT_A)]) {
    const game = { Teams: [{ TeamNum: 0, Score: 0 }, { TeamNum: 1, Score: 0 }] };
    if (playlistId !== undefined) game.PlaylistId = playlistId;
    await send("UpdateState", matchId, { Game: game, Players: players });
  }

  async function reconnect() {
    const previous = client;
    previous.destroy();
    await waitFor(() => client !== previous && !client.destroyed, "the feed should reconnect");
  }

  return { state, statePath, runtime, bus, titles, models, errors, send, update, reconnect, port: address.port };
}

test("Stats API playlist IDs map to the actual loaded modes", () => {
  const expected = new Map([
    [1, "casual"], [2, "casual"], [3, "casual"], [4, "casual"],
    [10, "ranked_1v1"], [11, "ranked_2v2"], [13, "ranked_3v3"], [61, "ranked_4v4"],
    [22, "tournament"], [27, "ranked_hoops"], [28, "ranked_rumble"],
    [29, "ranked_dropshot"], [30, "ranked_snow_day"], [34, "tournament"], [63, "ranked_heatseeker"],
    [999, "unknown"]
  ]);
  for (const [playlistId, queueType] of expected) {
    const normalizer = new OfficialStatsNormalizer();
    const snapshot = normalizer.normalize({
      Event: "UpdateState",
      MatchGuid: `playlist-${playlistId}`,
      Data: { Game: { PlaylistId: playlistId }, Players: [] }
    });
    assert.equal(snapshot.queueType, queueType, `playlist ${playlistId}`);
    assert.equal(snapshot.playlistId, playlistId);
    assert.equal(snapshot.gameStateLoaded, true);
  }

  for (const invalid of [0, -1, 1.5, "11", null]) {
    const normalizer = new OfficialStatsNormalizer();
    const snapshot = normalizer.normalize({
      Event: "UpdateState",
      Data: { Game: { PlaylistId: invalid }, Players: [] }
    });
    assert.equal(snapshot.queueType, "unknown");
    assert.equal(snapshot.playlistId, undefined);
  }
});

test("verified game account wins over a typed name without guessing from camera target", () => {
  const normalizer = new OfficialStatsNormalizer();
  normalizer.configureManualPlayerName("Other");
  normalizer.configureVerifiedAccountId(ACCOUNT_A);
  const snapshot = normalizer.normalize({
    Event: "UpdateState",
    Data: {
      Game: { PlaylistId: 11, Target: { Name: "Other" }, bHasTarget: true },
      Players: [player(ACCOUNT_A, "Actual"), player(ACCOUNT_B, "Other")]
    }
  });
  assert.equal(snapshot.localPlayer.accountId, ACCOUNT_A);
  assert.equal(snapshot.localPlayer.name, "Actual");
  assert.equal(snapshot.identityObserved, true);

  const absent = normalizer.normalize({
    Event: "UpdateState",
    Data: { Game: {}, Players: [player(ACCOUNT_B, "Other")] }
  });
  assert.equal(absent.localPlayer, undefined);
  assert.equal(absent.identityObserved, undefined);

  const duplicates = normalizer.normalize({
    Event: "UpdateState",
    Data: { Game: {}, Players: [player(ACCOUNT_A, "One"), player(ACCOUNT_A, "Two")] }
  });
  assert.equal(duplicates.localPlayer, undefined);
});

test("automatic MMR changes only on a loaded mode and restores cached values", async (t) => {
  const h = await createHarness(t);
  h.runtime.configureManualDisplayName("Other");
  h.runtime.recordGameLogIdentity(ACCOUNT_A);
  h.runtime.recordGameLogQueue({ queueType: "ranked_1v1", mmr: 1100 });
  assert.equal(h.titles.at(-1), "MMR ?\n---");

  await h.send("MatchCreated", "one");
  assert.equal(h.titles.at(-1), "MMR ?\n---");
  await h.update("one", 10, [player(ACCOUNT_A, "Actual"), player(ACCOUNT_B, "Other")]);
  assert.equal(h.state.getActiveAccount().accountId, ACCOUNT_A);
  assert.equal(h.titles.at(-1), "MMR 1v1\n1100\nChampion III");

  h.runtime.recordGameLogQueue({ queueType: "ranked_2v2", mmr: 1200 });
  assert.equal(h.state.getMmrSummary("ranked_2v2").value, "---");
  await h.send("MatchEnded", "one", { WinnerTeamNum: 0 });
  await h.update("one", 10);
  assert.equal(h.titles.at(-1), "MMR 1v1\n1100\nChampion III");

  await h.send("MatchCreated", "two");
  assert.equal(h.titles.at(-1), "MMR 1v1\n1100\nChampion III");
  await h.update("two", 11);
  assert.equal(h.titles.at(-1), "MMR 2v2\n1200\nChampion II");

  await h.send("MatchEnded", "two", { WinnerTeamNum: 0 });
  await h.send("MatchCreated", "three");
  await h.update("three", 13);
  assert.equal(h.titles.at(-1), "MMR 3v3\n---");

  await h.send("MatchEnded", "three", { WinnerTeamNum: 0 });
  await h.send("MatchCreated", "four");
  await h.update("four", 10);
  assert.equal(h.titles.at(-1), "MMR 1v1\n1100\nChampion III");

  await h.state.persistActiveAccount();
  const restored = new PluginState({
    statePath: h.statePath,
    identityGraceWindowMs: 90_000,
    reconnectWindowMs: 600_000
  });
  await restored.initialize();
  assert.equal(restored.getLastMmrPlaylist(), "ranked_1v1");
  assert.equal(restored.getMmrSummary("ranked_2v2").value, "1200");

  const restoredBus = new RenderBus();
  const restoredTitles = [];
  const restoredRuntime = new LiveRuntime(restored, {
    render: (model) => restoredBus.publish(model)
  }, {
    host: "127.0.0.1",
    port: h.port,
    reconnectDelayMs: 100,
    actionKinds: ["mmr"],
    locale: "de",
    mmrPlaylist: "auto",
    eventBannerStats: [],
    animateEvents: false,
    onError: () => {}
  });
  restoredRuntime.start();
  const target = { setTitle: (value) => { restoredTitles.push(value); } };
  restoredBus.bind("mmr", target, { playlist: "ranked_2v2" });
  assert.equal(restoredTitles.at(-1), "MMR 1v1\n1100\nChampion III");
  restoredBus.bind("mmr", target, { playlistMode: "manual", playlist: "ranked_2v2" });
  assert.equal(restoredTitles.at(-1), "MMR 2v2\n1200\nChampion II");
  restoredRuntime.stop();

  await h.send("MatchEnded", "four", { WinnerTeamNum: 0 });
  await h.send("MatchCreated", "five");
  await h.update("five", 0);
  assert.equal(h.titles.at(-1), "MMR 1v1\n1100\nChampion III");
  await h.update("five", 999);
  assert.equal(h.titles.at(-1), "MMR ?\n---");
  assert.deepEqual(h.errors, []);
});

test("4v4 MMR uses the loaded playlist and supports a manual playlist selection", async (t) => {
  const h = await createHarness(t);
  h.runtime.recordGameLogIdentity(ACCOUNT_A);
  h.runtime.recordGameLogQueue({ queueType: "ranked_4v4", mmr: 1_040 });
  await h.send("MatchCreated", "quads");
  await h.update("quads", 61);

  assert.equal(h.titles.at(-1), "MMR 4v4\n1040\nChampion III");
  assert.deepEqual(h.state.getMmrSummary("ranked_4v4"), {
    value: "1040",
    rankLabel: "Champion III",
    division: 2
  });

  const manualTitles = [];
  h.bus.bind("mmr", { setTitle: async (value) => { manualTitles.push(value); } }, {
    playlistMode: "manual",
    playlist: "ranked_4v4"
  });
  assert.equal(manualTitles.at(-1), "MMR 4v4\n1040\nChampion III");
  assert.deepEqual(h.errors, []);
});

test("Heatseeker automatically selects its rank icon and supports a fixed key", async (t) => {
  const h = await createHarness(t);
  const autoImages = [];
  const fixedImages = [];
  const fixedTitles = [];
  const target = (images) => ({
    setTitle: () => {},
    setImage: (image) => { images.push(image); }
  });
  const svg = (images) => Buffer.from(images.at(-1).split(",")[1], "base64").toString("utf8");
  const fixedSettings = { playlistMode: "manual", playlist: "ranked_heatseeker" };
  h.bus.bind("rank", target(autoImages));
  h.bus.bind("rank", target(fixedImages), fixedSettings);
  h.bus.bind("mmr", { setTitle: (value) => { fixedTitles.push(value); } }, fixedSettings);
  h.runtime.recordGameLogIdentity(ACCOUNT_A);
  h.runtime.recordGameLogQueue({ queueType: "ranked_heatseeker", mmr: 1_080 });
  await h.send("MatchCreated", "heatseeker");
  await h.update("heatseeker", 63);

  assert.equal(h.titles.at(-1), "HEAT\n1080\nChampion III");
  assert.equal(fixedTitles.at(-1), "HEAT\n1080\nChampion III");
  assert.deepEqual(h.state.getMmrSummary("ranked_heatseeker"), {
    value: "1080", rankLabel: "Champion III", division: 2
  });
  assert.match(svg(autoImages), />CHAMPION</);
  assert.match(svg(autoImages), />III DIV 2</);
  assert.equal(svg(fixedImages), svg(autoImages));
  const icon = /href="data:image\/png;base64,([^"]+)"/.exec(svg(autoImages));
  assert.ok(icon);
  assert.deepEqual(
    Buffer.from(icon[1], "base64"),
    await readFile(new URL("../com.rocketstats.livestats.sdPlugin/imgs/ranks/rank-18.png", import.meta.url))
  );

  await h.send("MatchEnded", "heatseeker", { WinnerTeamNum: 0 });
  h.runtime.recordGameLogQueue({ queueType: "ranked_2v2", mmr: 1_200 });
  await h.send("MatchCreated", "doubles-after-heatseeker");
  await h.update("doubles-after-heatseeker", 11);
  assert.equal(h.titles.at(-1), "MMR 2v2\n1200\nChampion II");
  assert.match(svg(autoImages), />II DIV 1</);
  assert.match(svg(fixedImages), />III DIV 2</);
  assert.equal(fixedTitles.at(-1), "HEAT\n1080\nChampion III");

  await h.state.persistActiveAccount();
  const restored = new PluginState({
    statePath: h.statePath,
    identityGraceWindowMs: 90_000,
    reconnectWindowMs: 600_000
  });
  await restored.initialize();
  assert.equal(restored.getLastMmrPlaylist(), "ranked_2v2");
  assert.deepEqual(restored.getMmrSummary("ranked_heatseeker"), {
    value: "1080", rankLabel: "Champion III", division: 2
  });
  assert.deepEqual(h.errors, []);
});

test("a reservation waits for a verified identity and a loaded matching match", async (t) => {
  const h = await createHarness(t);
  h.runtime.recordGameLogQueue({ queueType: "ranked_2v2", mmr: 1356 });
  await h.send("MatchCreated", "late-identity");
  await h.update("late-identity", 11, []);
  assert.equal(h.titles.at(-1), "MMR ?\n---");
  assert.equal(h.state.getStateSnapshot().accounts.unknown.rankByPlaylist.length, 0);

  h.runtime.recordGameLogIdentity(ACCOUNT_A);
  await h.update("late-identity", 11);
  assert.equal(h.titles.at(-1), "MMR 2v2\n1356\nChampion III");
  assert.equal(h.state.getMmrSummary("ranked_2v2").value, "1356");
});

test("live log and Stats API together select the signed-in account and its MMR", async (t) => {
  const h = await createHarness(t);
  const logPath = join(dirname(h.statePath), "Launch.log");
  await writeFile(logPath, "");
  const queues = [];
  const logErrors = [];
  const watcher = new RocketLeagueLogWatcher(
    logPath,
    (queue) => {
      queues.push(queue);
      h.runtime.recordGameLogQueue(queue);
    },
    (error) => logErrors.push(error),
    20,
    (accountId) => h.runtime.recordGameLogIdentity(accountId)
  );
  try {
    h.runtime.configureManualDisplayName("Other");
    await watcher.start();
    await appendFile(logPath, [
      `[0001.00] Party: HandleLocalPlayerLoginStatusChanged PlayerName=Actual PlayerID=${ACCOUNT_A} LoginStatus=LS_LoggedIn IsPrimary=True IsInParty=False`,
      "[0010.00] Matchmaking: OnlineGameMatchmaking_X::RecordStart",
      "[0010.00] Matchmaking: Pre-divide PartyLeaderMMR: 62.8112",
      "[0010.00] Matchmaking: PreferredPlaylists.Length=(1) Party.GetOrderedPartyMemberIDs().Length=(1)",
      "[0011.00] Party: HandleServerReserved (Reservation=(Playlist=11,ReservationID=\"test\"))",
      ""
    ].join("\n"));
    await waitFor(() => queues.length === 1, "the live reservation should be read");
    assert.equal(h.state.getActiveAccount().accountId, ACCOUNT_A);
    assert.equal(h.titles.at(-1), "MMR ?\n---");

    await h.send("MatchCreated", "live-match");
    await h.update("live-match", 11, [player(ACCOUNT_A, "Actual"), player(ACCOUNT_B, "Other")]);
    assert.equal(h.titles.at(-1), "MMR 2v2\n1356\nChampion III");
    assert.deepEqual(logErrors, []);
  } finally {
    watcher.stop();
  }
});

test("reservation after match creation supports feeds without a playlist field", async (t) => {
  const h = await createHarness(t);
  h.runtime.recordGameLogIdentity(ACCOUNT_A);
  await h.send("MatchCreated", "log-fallback");
  h.runtime.recordGameLogQueue({ queueType: "ranked_1v1", mmr: 900 });
  assert.equal(h.titles.at(-1), "MMR ?\n---");
  await h.update("log-fallback", undefined);
  assert.equal(h.titles.at(-1), "MMR 1v1\n900\nDiamond II");
});

test("a delayed log reservation is attached only after its GUID matches the loaded game", async (t) => {
  const h = await createHarness(t);
  const guid = "0123456789ABCDEF0123456789ABCDEF";
  const formattedGuid = "01234567-89ab-cdef-0123-456789abcdef";
  h.runtime.recordGameLogIdentity(ACCOUNT_A);
  await h.send("MatchCreated", formattedGuid);
  await h.update(formattedGuid, 11);
  assert.equal(h.titles.at(-1), "MMR 2v2\n---");

  const parser = new RocketLeagueLogParser();
  for (const line of [
    "[0010.00] Matchmaking: OnlineGameMatchmaking_X::RecordStart",
    "[0010.00] Matchmaking: Pre-divide PartyLeaderMMR: 62.8112",
    "[0010.00] Matchmaking: PreferredPlaylists.Length=(1) Party.GetOrderedPartyMemberIDs().Length=(1)",
    "[0011.00] Party: HandleServerReserved (Reservation=(Playlist=11,ReservationID=\"test\"))",
    "[0012.00] Log: LoadMap: 127.0.0.1:7777/Stadium_P",
    `[0013.00] ScriptLog: MatchGUID: ${guid}`
  ]) {
    const queue = parser.consumeLine(line);
    if (queue) h.runtime.recordGameLogQueue(queue);
  }
  assert.equal(h.titles.at(-1), "MMR 2v2\n1356\nChampion III");
});

test("a future reservation for the same playlist cannot update the current match", async (t) => {
  const h = await createHarness(t);
  const currentGuid = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  const nextGuid = "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
  h.runtime.recordGameLogIdentity(ACCOUNT_A);
  h.runtime.recordGameLogQueue({ queueType: "ranked_2v2", mmr: 1100 });
  await h.send("MatchCreated", currentGuid);
  await h.update(currentGuid, 11);
  assert.equal(h.titles.at(-1), "MMR 2v2\n1100\nChampion I");

  h.runtime.recordGameLogQueue({ queueType: "ranked_2v2", mmr: 1200 });
  h.runtime.recordGameLogQueue({ queueType: "ranked_2v2", mmr: 1200, matchId: nextGuid });
  await h.update(currentGuid, 11);
  assert.equal(h.titles.at(-1), "MMR 2v2\n1100\nChampion I");

  await h.send("MatchCreated", nextGuid);
  await h.update(nextGuid, 11);
  assert.equal(h.titles.at(-1), "MMR 2v2\n1200\nChampion II");
});

test("expired reservations cannot be assigned to a later match", async (t) => {
  const h = await createHarness(t);
  const realNow = Date.now;
  h.runtime.recordGameLogIdentity(ACCOUNT_A);
  h.runtime.recordGameLogQueue({ queueType: "ranked_2v2", mmr: 1300 });
  try {
    Date.now = () => realNow() + 5 * 60_000 + 1_000;
    await h.send("MatchCreated", "later");
    await h.update("later", 11);
    assert.equal(h.titles.at(-1), "MMR 2v2\n---");
    assert.equal(h.state.getMmrSummary("ranked_2v2").value, "---");
  } finally {
    Date.now = realNow;
  }
});

test("ranked reconnect still replaces an early-leave loss without a second player snapshot", async (t) => {
  const h = await createHarness(t);
  h.runtime.recordGameLogIdentity(ACCOUNT_A);
  h.runtime.recordGameLogQueue({ queueType: "ranked_1v1", mmr: 1100 });
  await h.send("MatchCreated", "reconnect");
  await h.update("reconnect", 10);
  await h.send("MatchDestroyed", "reconnect");
  assert.equal(h.state.getStreakLabel(), "L1");
  await h.send("MatchCreated", "reconnect");
  await h.send("MatchEnded", "reconnect", { WinnerTeamNum: 0 });
  assert.equal(h.state.getStreakLabel(), "W1");
  assert.equal(h.titles.at(-1), "MMR 1v1\n1100\nChampion III");
});

test("a new match without a GUID cannot inherit the previous match's identity", async (t) => {
  const h = await createHarness(t);
  h.runtime.recordGameLogIdentity(ACCOUNT_A);
  h.runtime.recordGameLogQueue({ queueType: "ranked_1v1", mmr: 1100 });
  await h.send("MatchCreated", "unknown");
  await h.update("unknown", 10);
  assert.equal(h.titles.at(-1), "MMR 1v1\n1100\nChampion III");

  h.runtime.recordGameLogQueue({ queueType: "ranked_2v2", mmr: 1200 });
  await h.send("MatchCreated", "unknown");
  await h.update("unknown", 11, []);
  assert.equal(h.titles.at(-1), "MMR 1v1\n1100\nChampion III");
  assert.equal(h.state.getMmrSummary("ranked_2v2").value, "---");
});

test("a feed reconnect starts a fresh match without losing the last stored MMR", async (t) => {
  const h = await createHarness(t);
  h.runtime.recordGameLogIdentity(ACCOUNT_A);
  h.runtime.recordGameLogQueue({ queueType: "ranked_1v1", mmr: 1100 });
  await h.send("MatchCreated", "unknown");
  await h.update("unknown", 10);
  await h.send("MatchEnded", "unknown", { WinnerTeamNum: 0 });
  await h.reconnect();
  assert.equal(h.titles.at(-1), "MMR 1v1\n1100\nChampion III");

  h.runtime.recordGameLogIdentity(ACCOUNT_A);
  h.runtime.recordGameLogQueue({ queueType: "ranked_2v2", mmr: 1200 });
  await h.update("unknown", 11);
  assert.equal(h.titles.at(-1), "MMR 2v2\n1200\nChampion II");
});

test("contradictory playlists and account switches never attach a queued MMR to another account", async (t) => {
  const h = await createHarness(t);
  h.runtime.recordGameLogIdentity(ACCOUNT_A);
  h.runtime.recordGameLogQueue({ queueType: "ranked_1v1", mmr: 1100 });
  await h.send("MatchCreated", "account-a");
  await h.update("account-a", 10);

  h.runtime.recordGameLogQueue({ queueType: "ranked_2v2", mmr: 1300 });
  h.runtime.recordGameLogIdentity(ACCOUNT_B);
  await h.send("MatchCreated", "account-b");
  await h.update("account-b", 11, [player(ACCOUNT_B)]);
  assert.equal(h.titles.at(-1), "MMR 2v2\n---");
  assert.equal(h.state.getMmrSummary("ranked_2v2").value, "---");
  assert.equal(h.state.getStateSnapshot().accounts[ACCOUNT_A].rankByPlaylist[0].mmr, 1100);

  h.runtime.recordGameLogQueue({ queueType: "ranked_1v1", mmr: 999 });
  await h.send("MatchCreated", "different-playlist");
  await h.update("different-playlist", 13, [player(ACCOUNT_B)]);
  assert.equal(h.titles.at(-1), "MMR 3v3\n---");
  assert.equal(h.state.getMmrSummary("ranked_1v1").value, "---");

  h.runtime.recordGameLogIdentity(ACCOUNT_A);
  assert.equal(h.titles.at(-1), "MMR 1v1\n1100\nChampion III");
  assert.equal(h.state.getLastMmrPlaylist(), "ranked_1v1");
  await h.state.persistActiveAccount();
  const persisted = new PluginState({
    statePath: h.statePath,
    identityGraceWindowMs: 90_000,
    reconnectWindowMs: 600_000
  });
  await persisted.initialize();
  const accounts = persisted.getStateSnapshot().accounts;
  assert.equal(accounts[ACCOUNT_A].lastMmrPlaylist, "ranked_1v1");
  assert.equal(accounts[ACCOUNT_B].lastMmrPlaylist, "ranked_3v3");
  assert.equal(accounts[ACCOUNT_B].rankByPlaylist.length, 0);
  assert.deepEqual(h.errors, []);
});

test("the game log alone stores solo MMR once the reserved match is loaded", async (t) => {
  const h = await createHarness(t);
  const parser = new RocketLeagueLogParser();
  h.runtime.recordGameLogIdentity(ACCOUNT_A);
  for (const line of [
    "[0039.37] Matchmaking: OnlineGameMatchmaking_X::RecordStart",
    "[0039.37] Matchmaking: Pre-divide PartyLeaderMMR: 46.0208",
    "[0039.37] Matchmaking: StartMatchmaking at 2026-11-05 10:23:38 in EU5 for playlists 92 on game server ",
    "[0039.37] Matchmaking: PreferredRegions.Length=(5) PreferredPlaylists.Length=(1) Party.GetOrderedPartyMemberIDs().Length=(1)",
    "[0044.13] Matchmaking: OnlineGameMatchmaking_X_0::Searching.Cancel()",
    "[0060.83] Matchmaking: OnlineGameMatchmaking_X::RecordStart",
    "[0060.83] Matchmaking: Pre-divide PartyLeaderMMR: 31.1147",
    "[0060.83] Matchmaking: StartMatchmaking at 2026-11-05 10:23:59 in EU5 for playlists 29 on game server ",
    "[0060.83] Matchmaking: PreferredRegions.Length=(5) PreferredPlaylists.Length=(1) Party.GetOrderedPartyMemberIDs().Length=(1)",
    "[0081.31] Party: HandleServerReserved (Reservation=(ServerName=\"EU9\",Playlist=29,Region=\"EU\"))",
    "[0084.36] Log: LoadMap: JoinGameTransition?game=TAGame.GameInfo_Transition_TA",
    "[0084.95] Log: LoadMap: 127.0.0.1:9076/ShatterShot_P?Name=Player?game=TAGame.GameInfo_Breakout_TA"
  ]) {
    const queue = parser.consumeLine(line);
    if (queue) h.runtime.recordGameLogQueue(queue);
  }
  assert.equal(h.state.getMmrSummary("ranked_dropshot").value, "---");

  const queue = parser.consumeLine("[0085.87] ScriptLog: MatchGUID: 0123456789ABCDEF0123456789ABCDEF");
  assert.ok(queue);
  h.runtime.recordGameLogQueue(queue);
  assert.equal(h.state.getLastMmrPlaylist(), "ranked_dropshot");
  assert.equal(h.state.getMmrSummary("ranked_dropshot").value, "722");
  assert.equal(h.titles.at(-1), "DROP\n722\nPlatinum III");
  assert.equal(h.state.getMmrSummary("ranked_dropshot").division, 3);
});

test("a log-loaded match is not attributed after the signed-in account changed", async (t) => {
  const h = await createHarness(t);
  h.runtime.recordGameLogIdentity(ACCOUNT_A);
  h.runtime.recordGameLogQueue({ queueType: "ranked_2v2", mmr: 1300 });
  h.runtime.recordGameLogIdentity(ACCOUNT_B);
  h.runtime.recordGameLogQueue({ queueType: "ranked_2v2", mmr: 1300, matchId: "C".repeat(32) });
  assert.equal(h.state.getActiveAccount().accountId, ACCOUNT_B);
  assert.equal(h.state.getMmrSummary("ranked_2v2").value, "---");
  assert.equal(h.state.getStateSnapshot().accounts[ACCOUNT_A].rankByPlaylist.length, 0);
});

test("MMR zero remains a value when an extra-mode rank is estimated from its table", async (t) => {
  const h = await createHarness(t);
  h.runtime.recordGameLogIdentity(ACCOUNT_A);
  h.runtime.recordGameLogQueue({ queueType: "ranked_hoops", mmr: 0 });
  await h.send("MatchCreated", "hoops");
  await h.update("hoops", 27);
  assert.equal(h.state.getMmrSummary("ranked_hoops").value, "0");
  assert.equal(h.titles.at(-1), "HOOPS\n0\nBronze I");
});

test("runtime rank divisions follow the loaded mode, manual override and active account", async (t) => {
  const h = await createHarness(t);
  const autoImages = [];
  const fixedImages = [];
  const target = (images) => ({
    setTitle: () => {},
    setImage: (image) => { images.push(image); }
  });
  const svg = (images) => Buffer.from(images.at(-1).split(",")[1], "base64").toString("utf8");
  h.bus.bind("rank", target(autoImages));
  h.bus.bind("rank", target(fixedImages), { playlistMode: "manual", playlist: "ranked_2v2" });
  h.runtime.recordGameLogIdentity(ACCOUNT_A);
  h.runtime.recordGameLogQueue({ queueType: "ranked_2v2", mmr: 1356 });
  await h.send("MatchCreated", "doubles");
  await h.update("doubles", 11);
  assert.match(svg(autoImages), />III DIV 2</);
  assert.match(svg(fixedImages), />III DIV 2</);

  h.runtime.recordGameLogQueue({ queueType: "ranked_1v1", mmr: 480 });
  await h.send("MatchCreated", "duel");
  await h.update("duel", 10);
  assert.match(svg(autoImages), />GOLD</);
  assert.match(svg(autoImages), />I DIV 3</);
  assert.match(svg(fixedImages), />CHAMPION</);
  assert.match(svg(fixedImages), />III DIV 2</);

  h.runtime.recordGameLogIdentity(ACCOUNT_B);
  h.runtime.recordGameLogQueue({ queueType: "ranked_2v2", mmr: 1200 });
  await h.send("MatchCreated", "other-account");
  await h.update("other-account", 11, [player(ACCOUNT_B)]);
  assert.match(svg(autoImages), />II DIV 1</);
  assert.match(svg(fixedImages), />II DIV 1</);
});

test("3v3 rank keys show a marked division when Tracker ranges overlap", async (t) => {
  const h = await createHarness(t);
  const autoImages = [];
  const fixedImages = [];
  const target = (images) => ({
    setTitle: () => {},
    setImage: (image) => { images.push(image); }
  });
  const svg = (images) => Buffer.from(images.at(-1).split(",")[1], "base64").toString("utf8");
  h.bus.bind("rank", target(autoImages));
  h.bus.bind("rank", target(fixedImages), { playlistMode: "manual", playlist: "ranked_3v3" });
  h.runtime.recordGameLogIdentity(ACCOUNT_A);
  h.runtime.recordGameLogQueue({ queueType: "ranked_3v3", mmr: 1140 });
  await h.send("MatchCreated", "overlapping-divisions");
  await h.update("overlapping-divisions", 13);

  const expected = { value: "1140", rankLabel: "Champion I", division: 3, divisionEstimated: true };
  assert.deepEqual(h.state.getMmrSummary("ranked_3v3"), expected);
  assert.match(svg(autoImages), />I DIV ~3</);
  assert.match(svg(fixedImages), />I DIV ~3</);

  await h.state.persistActiveAccount();
  const restored = new PluginState({
    statePath: h.statePath,
    identityGraceWindowMs: 90_000,
    reconnectWindowMs: 600_000
  });
  await restored.initialize();
  assert.deepEqual(restored.getMmrSummary("ranked_3v3"), expected);
  assert.deepEqual(h.errors, []);
});
