import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rename, rm, rmdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";

const { PluginState } = await import(
  "../com.rocketstats.livestats.sdPlugin/bin/core/plugin-state.js"
);
const { LiveRuntime } = await import(
  "../com.rocketstats.livestats.sdPlugin/bin/runtime/live-runtime.js"
);

const A = "Steam|76561198000000001|0";
const B = "Epic|player-b|0";
const C = "Steam|76561198000000003|0";
const D = "Steam|76561198000000004|0";
const E = "Steam|76561198000000005|0";

function player(id, name, team, stats = {}) {
  return { PrimaryId: id, Name: name, TeamNum: team, ...stats };
}

async function waitFor(predicate, message) {
  const deadline = Date.now() + 2_000;
  while (!predicate() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.ok(predicate(), message);
}

async function createHarness(t) {
  const directory = await mkdtemp(join(tmpdir(), "rocketstats-platform-"));
  const options = {
    statePath: join(directory, "state.json"),
    identityGraceWindowMs: 90_000,
    reconnectWindowMs: 600_000
  };
  const state = new PluginState(options);
  await state.initialize();
  const sockets = new Set();
  let client;
  const server = createServer((socket) => {
    client = socket;
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const models = [];
  const errors = [];
  const accountEvents = [];
  const runtime = new LiveRuntime(state, { render: (model) => models.push(model) }, {
    host: "127.0.0.1",
    port: address.port,
    reconnectDelayMs: 100,
    actionKinds: ["streak"],
    locale: "en",
    mmrPlaylist: "auto",
    eventBannerStats: [],
    animateEvents: false,
    onError: (error) => errors.push(error),
    onPlatformAccounts: (accounts) => accountEvents.push(accounts)
  });
  runtime.start();
  await waitFor(() => client, "the runtime connects");

  t.after(async () => {
    runtime.stop();
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
    await state.persistActiveAccount();
    await rm(directory, { recursive: true, force: true });
  });

  async function send(event, matchId, data = {}) {
    const before = models.length;
    client.write(JSON.stringify({ Event: event, ...(matchId ? { MatchGuid: matchId } : {}), Data: data }));
    await waitFor(() => models.length > before, `${event} is processed`);
  }
  async function update(matchId, players, playlistId = 11) {
    await send("UpdateState", matchId, {
      Game: { PlaylistId: playlistId, Teams: [{ TeamNum: 0 }, { TeamNum: 1 }] },
      Players: players
    });
  }
  async function match(matchId, players, winner = 0, playlistId = 11) {
    await send("MatchCreated", matchId);
    await update(matchId, players, playlistId);
    await send("MatchEnded", matchId, { WinnerTeamNum: winner });
  }
  return { state, runtime, options, errors, accountEvents, send, update, match };
}

test("party candidates retain separate match statistics until a user chooses an ID", async (t) => {
  const h = await createHarness(t);
  await h.match("party-1", [
    player(A, "Me", 0, { Goals: 1, Shots: 4, Score: 400 }),
    player(B, "Teammate", 0, { Goals: 2, Assists: 1, Demos: 3, Score: 650 }),
    player(C, "Opponent", 1, { Saves: 2, Score: 100 })
  ]);
  await h.match("party-2", [
    player(A, "Me", 0, { Goals: 3, Score: 700 }),
    player(B, "Teammate", 0, { Saves: 4, FlipResets: 1, Score: 500 }),
    player(D, "Other opponent", 1, { Goals: 1, Score: 300 })
  ]);
  const pending = h.runtime.getPlatformAccounts();
  assert.equal(pending.selectionRequired, true);
  assert.deepEqual(pending.accounts.filter((account) => account.suggested).map((account) => account.accountId).sort(), [A, B].sort());
  assert.equal(h.state.getStateSnapshot().matches.length, 0);
  assert.equal(h.state.getStateSnapshot().identityMatches.length, 2);

  await h.runtime.selectPlatformAccount(B);
  assert.equal(h.state.getActiveAccount().accountId, B);
  assert.deepEqual(h.state.getWinLossCounts(), { wins: 2, losses: 0 });
  assert.equal(h.state.getActiveAccount().records.maxGoalsPerMatch, 2);
  assert.equal(h.state.getActiveAccount().records.maxSavesPerMatch, 4);
  const bMatches = h.state.getStateSnapshot().matches.filter((match) => match.accountId === B);
  assert.equal(bMatches.length, 2);
  assert.equal(bMatches[0].performance.demos, 3);
  assert.equal(bMatches[1].performance.flipResets, 1);
  assert.equal(h.runtime.getPlatformAccounts().accounts.find((account) => account.accountId === A).managed, false);

  await h.runtime.selectPlatformAccount(A);
  assert.deepEqual(h.state.getWinLossCounts(), { wins: 0, losses: 0 });
  await h.match("a-solo", [
    player(A, "Me", 0, { Goals: 3 }),
    player(D, "Opponent", 1)
  ], 0, 10);
  assert.deepEqual(h.state.getWinLossCounts(), { wins: 1, losses: 0 });
  assert.equal(h.state.getActiveAccount().records.maxGoalsPerMatch, 3);
  assert.equal(h.state.getSessionMatchCount(), 3);
  await h.state.persistActiveAccount();
  const restored = new PluginState(h.options);
  await restored.initialize();
  assert.equal(restored.getSelectedPlatformId(), A);
  assert.deepEqual(restored.getWinLossCounts(), { wins: 1, losses: 0 });
  assert.deepEqual(restored.getPlatformAccounts().accounts.filter((account) => account.managed).map((account) => account.accountId).sort(), [A, B].sort());
  assert.deepEqual(h.errors, []);
});

test("unresolved player statistics survive a restart and are assigned after selection", async (t) => {
  const h = await createHarness(t);
  await h.match("pending-restart", [
    player(A, "Me", 0, { Goals: 1 }),
    player(B, "Teammate", 0, { Goals: 3, Saves: 2, Score: 600 }),
    player(C, "Opponent", 1, { Shots: 4 })
  ]);
  await h.state.persistActiveAccount();

  const restored = new PluginState(h.options);
  await restored.initialize();
  assert.equal(restored.getSelectedPlatformId(), undefined);
  assert.equal(restored.getPlatformAccounts().selectionRequired, true);
  assert.equal(restored.getStateSnapshot().identityMatches[0].players.find((entry) => entry.accountId === B).goals, 3);
  await restored.selectPlatformAccount(B, "manual");
  assert.deepEqual(restored.getWinLossCounts(), { wins: 1, losses: 0 });
  assert.equal(restored.getActiveAccount().records.maxGoalsPerMatch, 3);
  assert.equal(restored.getActiveAccount().records.maxSavesPerMatch, 2);
  assert.deepEqual(h.errors, []);
});

test("different opponents narrow a party to the recurring local candidate without counting duplicate snapshots", async (t) => {
  const h = await createHarness(t);
  await h.match("first", [player(A, "Me", 0), player(B, "Friend", 0), player(C, "Opponent", 1)]);
  await h.match("second", [player(A, "Me", 0), player(B, "Friend", 0), player(D, "Opponent", 1)]);
  await h.send("MatchCreated", "solo");
  await h.update("solo", [player(A, "Me", 0, { Goals: 2 }), player(E, "Opponent", 1)]);
  await h.update("solo", [player(A, "Me", 0, { Goals: 2 }), player(E, "Opponent", 1)]);
  assert.equal(h.runtime.getPlatformAccounts().selectedAccountId, undefined);
  await h.send("MatchEnded", "solo", { WinnerTeamNum: 1 });
  assert.equal(h.runtime.getPlatformAccounts().selectedAccountId, A);
  assert.equal(h.runtime.getPlatformAccounts().selectionSource, "inferred");
  assert.deepEqual(h.state.getWinLossCounts(), { wins: 2, losses: 1 });
  assert.equal(h.state.getActiveAccount().records.maxGoalsPerMatch, 2);
  assert.equal(h.runtime.getPlatformAccounts().accounts.find((account) => account.accountId === A).matchesSeen, 3);
  assert.deepEqual(h.errors, []);
});

test("the verified game account overrides a selected ID and a typed name", async (t) => {
  const h = await createHarness(t);
  await h.runtime.addPlatformAccount(A);
  await h.runtime.selectPlatformAccount(A);
  h.runtime.configureManualDisplayName("Me");
  await h.send("MatchCreated", "switch");
  await h.update("switch", [
    player(A, "Me", 0, { Goals: 9 }),
    player(B, "Actual", 1, { Goals: 1 })
  ]);
  assert.equal(h.state.getActiveAccount().accountId, A);
  h.runtime.recordGameLogIdentity(B);
  await h.update("switch", [
    player(A, "Me", 0, { Goals: 9 }),
    player(B, "Actual", 1, { Goals: 1 })
  ]);
  await h.send("MatchEnded", "switch", { WinnerTeamNum: 1 });
  assert.equal(h.state.getActiveAccount().accountId, B);
  assert.equal(h.state.getActiveAccount().records.maxGoalsPerMatch, 1);
  assert.deepEqual(h.state.getWinLossCounts(), { wins: 1, losses: 0 });
  assert.equal(h.state.getStateSnapshot().matches.some((match) => match.accountId === A), false);
  await assert.rejects(h.runtime.selectPlatformAccount(A), /takes priority/);
  assert.deepEqual(h.errors, []);
});

test("live personal records update immediately and move when the game verifies another account", async (t) => {
  const h = await createHarness(t);
  await h.runtime.addPlatformAccount(A);
  await h.runtime.selectPlatformAccount(A);
  await h.send("MatchCreated", "live-record-correction");
  await h.update("live-record-correction", [
    player(A, "Selected", 0, { Goals: 5, Score: 800 }),
    player(B, "Actual", 1, { Saves: 3, Score: 450 })
  ]);
  assert.equal(h.state.getActiveAccount().records.maxGoalsPerMatch, 5);
  assert.equal(h.state.getStateSnapshot().matches.length, 0);

  h.runtime.recordGameLogIdentity(B);
  await h.update("live-record-correction", [
    player(A, "Selected", 0, { Goals: 5, Score: 800 }),
    player(B, "Actual", 1, { Saves: 3, Score: 450 })
  ]);
  const saved = h.state.getStateSnapshot();
  assert.equal(saved.accounts[A].records.maxGoalsPerMatch, 0);
  assert.equal(saved.accounts[A].records.maxScorePerMatch, 0);
  assert.equal(saved.accounts[B].records.maxSavesPerMatch, 3);
  assert.equal(saved.accounts[B].records.maxScorePerMatch, 450);
  await h.send("MatchEnded", "live-record-correction", { WinnerTeamNum: 1 });
  assert.deepEqual(h.state.getWinLossCounts(), { wins: 1, losses: 0 });
  assert.deepEqual(h.errors, []);
});

test("early leave is corrected by a reconnect before an account is selected", async (t) => {
  const h = await createHarness(t);
  await h.send("MatchCreated", "reconnect");
  await h.update("reconnect", [player(A, "Me", 0, { Saves: 1 }), player(C, "Opponent", 1)]);
  await h.send("MatchDestroyed", "reconnect");
  await h.send("MatchInitialized", "reconnect");
  await h.update("reconnect", [player(A, "Me", 0, { Saves: 3 }), player(C, "Opponent", 1)]);
  await h.send("MatchEnded", "reconnect", { WinnerTeamNum: 0 });
  await h.runtime.selectPlatformAccount(A);
  assert.deepEqual(h.state.getWinLossCounts(), { wins: 1, losses: 0 });
  const matches = h.state.getStateSnapshot().matches.filter((match) => match.accountId === A);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].wasRankedReconnect, true);
  assert.equal(matches[0].performance.saves, 3);
  assert.deepEqual(h.errors, []);
});

test("unknown, zero, duplicate and absent platform IDs are not account candidates", async (t) => {
  const h = await createHarness(t);
  await h.match("invalid", [
    player("Unknown|123|0", "Unknown", 0),
    player("Steam|0|0", "Zero", 0),
    player(A, "Duplicate one", 0),
    player(A, "Duplicate two", 1),
    player("Bot|123|0", "Bot", 1),
    player("Steam|456|0", "Flagged bot", 1, { bIsBot: true }),
    player(undefined, "No ID", 1)
  ]);
  assert.deepEqual(h.runtime.getPlatformAccounts().accounts, []);
  await assert.rejects(h.runtime.addPlatformAccount("Steam|0|0"), /platform ID/);
  assert.deepEqual(h.errors, []);
});

test("matches without a GUID remain separate and acquire their real GUID if it arrives later", async (t) => {
  const h = await createHarness(t);
  await h.send("MatchCreated");
  await h.update(undefined, [player(A, "Me", 0), player(C, "Opponent", 1)]);
  await h.update("actual-id", [player(A, "Me", 0), player(C, "Opponent", 1)]);
  await h.send("MatchEnded", "actual-id", { WinnerTeamNum: 0 });
  const observations = h.state.getStateSnapshot().identityMatches;
  assert.equal(observations.length, 1);
  assert.equal(observations[0].matchId, "actual-id");

  await h.send("MatchCreated");
  await h.update(undefined, [player(A, "Me", 0), player(D, "Opponent", 1)]);
  await h.send("MatchEnded", undefined, { WinnerTeamNum: 1 });
  const next = h.state.getStateSnapshot().identityMatches;
  assert.equal(next.length, 2);
  assert.notEqual(next[0].matchId, next[1].matchId);
  assert.equal(h.runtime.getPlatformAccounts().selectedAccountId, undefined);
  assert.deepEqual(h.errors, []);
});

test("format changes to the same match GUID do not count as separate matches", async (t) => {
  const h = await createHarness(t);
  const compact = "0123456789ABCDEF0123456789ABCDEF";
  const formatted = "{01234567-89ab-cdef-0123-456789abcdef}";
  await h.send("MatchCreated", compact);
  await h.update(compact, [player(A, "Me", 0), player(C, "Opponent", 1)]);
  await h.update(formatted, [player(A, "Me", 0, { Goals: 2 }), player(C, "Opponent", 1)]);
  await h.send("MatchEnded", formatted, { WinnerTeamNum: 0 });
  const observations = h.state.getStateSnapshot().identityMatches;
  assert.equal(observations.length, 1);
  assert.equal(observations[0].matchId, compact);
  assert.equal(observations[0].players.find((entry) => entry.accountId === A).goals, 2);
  assert.equal(h.runtime.getPlatformAccounts().accounts.find((entry) => entry.accountId === A).matchesSeen, 1);
  assert.deepEqual(h.errors, []);
});

test("a user can correct an unverified inference without retaining the wrong account's matches", async (t) => {
  const h = await createHarness(t);
  await h.match("inferred-1", [
    player(A, "Observed", 0, { Goals: 1 }),
    player(B, "Actual", 0, { Goals: 2 }),
    player(C, "Opponent", 1)
  ]);
  await h.match("inferred-2", [
    player(A, "Observed", 0, { Goals: 4 }),
    player(B, "Actual", 0, { Saves: 3 }),
    player(D, "Opponent", 1)
  ]);
  await h.match("inferred-3", [
    player(A, "Observed", 0, { Goals: 5 }),
    player(E, "Opponent", 1)
  ], 1);
  assert.equal(h.state.getActiveAccount().accountId, A);
  assert.deepEqual(h.state.getWinLossCounts(), { wins: 2, losses: 1 });
  assert.equal(h.state.getActiveAccount().records.maxGoalsPerMatch, 5);

  await h.runtime.selectPlatformAccount(B, true);
  assert.equal(h.state.getActiveAccount().accountId, B);
  assert.deepEqual(h.state.getWinLossCounts(), { wins: 2, losses: 0 });
  assert.equal(h.state.getActiveAccount().records.maxGoalsPerMatch, 2);
  assert.equal(h.state.getActiveAccount().records.maxSavesPerMatch, 3);
  const saved = h.state.getStateSnapshot();
  assert.equal(saved.matches.some((match) => match.accountId === A), false);
  assert.equal(saved.accounts[A].records.maxGoalsPerMatch, 0);
  assert.equal(saved.identityMatches.find((match) => match.matchId === "inferred-3").resolvedAccountId, undefined);
  assert.equal(h.runtime.getPlatformAccounts().selectionRequired, true);
  assert.deepEqual(h.errors, []);
});

test("correcting an inferred account preserves cleared-match markers and all-time history", async (t) => {
  const h = await createHarness(t);
  await h.match("cleared-1", [
    player(A, "Observed", 0), player(B, "Actual", 0, { Goals: 2 }), player(C, "Opponent", 1)
  ]);
  await h.match("cleared-2", [player(A, "Observed", 0), player(D, "Opponent", 1)], 1);
  assert.equal(h.state.getActiveAccount().accountId, A);
  await h.state.resetStats();
  assert.deepEqual(h.state.getWinLossCounts(), { wins: 0, losses: 0 });

  await h.runtime.selectPlatformAccount(B, true);
  assert.deepEqual(h.state.getWinLossCounts(), { wins: 0, losses: 0 });
  const match = h.state.getStateSnapshot().matches.find((entry) => entry.accountId === B);
  assert.equal(match.excludedFromStats, true);
  assert.equal(h.state.getActiveAccount().records.maxGoalsPerMatch, 2);
  await h.state.setStatsPeriod("alltime");
  assert.deepEqual(h.state.getWinLossCounts(), { wins: 1, losses: 0 });
  await h.state.setStatsPeriod("cleared");
  await h.state.persistActiveAccount();

  const restored = new PluginState(h.options);
  await restored.initialize();
  assert.deepEqual(restored.getWinLossCounts(), { wins: 0, losses: 0 });
  assert.equal(restored.getStateSnapshot().matches.find((entry) => entry.accountId === B).excludedFromStats, true);
  assert.deepEqual(h.errors, []);
});

test("a failed correction leaves the entire in-memory state unchanged", async (t) => {
  const h = await createHarness(t);
  await h.match("rollback-1", [player(A, "Observed", 0), player(B, "Actual", 0), player(C, "Opponent", 1)]);
  await h.match("rollback-2", [player(A, "Observed", 0), player(D, "Opponent", 1)], 1);
  await h.state.persistActiveAccount();
  const damaged = h.state.getStateSnapshot();
  delete damaged.identityMatches.find((match) => match.matchId === "rollback-1").recordsBefore;
  await writeFile(h.options.statePath, JSON.stringify(damaged), "utf8");

  const restored = new PluginState(h.options);
  await restored.initialize();
  const before = restored.getStateSnapshot();
  await assert.rejects(restored.selectPlatformAccount(B, "manual", undefined, true), /Cannot safely correct/);
  assert.deepEqual(restored.getStateSnapshot(), before);
  assert.deepEqual(JSON.parse(await readFile(h.options.statePath, "utf8")), damaged);
});

test("failed account saves report errors and can be retried without losing changes", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "rocketstats-platform-save-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const statePath = join(directory, "state.json");
  const backupPath = join(directory, "state-backup.json");
  const options = { statePath, identityGraceWindowMs: 90_000, reconnectWindowMs: 600_000 };
  const state = new PluginState(options);
  await state.initialize();

  await mkdir(statePath);
  await assert.rejects(state.addPlatformAccount(A));
  await rmdir(statePath);
  await state.addPlatformAccount(A);

  await rename(statePath, backupPath);
  await mkdir(statePath);
  await assert.rejects(state.selectPlatformAccount(A, "manual"));
  await rmdir(statePath);
  await rename(backupPath, statePath);
  await state.selectPlatformAccount(A, "manual");

  await rename(statePath, backupPath);
  await mkdir(statePath);
  await assert.rejects(state.removePlatformAccount(A));
  await rmdir(statePath);
  await rename(backupPath, statePath);
  await state.removePlatformAccount(A);

  const restored = new PluginState(options);
  await restored.initialize();
  assert.equal(restored.getSelectedPlatformId(), undefined);
  assert.equal(restored.getPlatformAccounts().accounts.some((entry) => entry.managed), false);
});

test("runtime and account controls remain synchronized after failed account saves", async (t) => {
  const h = await createHarness(t);
  const backupPath = `${h.options.statePath}.backup`;
  await h.runtime.addPlatformAccount(A);
  await h.runtime.addPlatformAccount(B);
  await h.runtime.selectPlatformAccount(A);

  await rename(h.options.statePath, backupPath);
  await mkdir(h.options.statePath);
  await assert.rejects(h.runtime.selectPlatformAccount(B));
  assert.equal(h.runtime.getPlatformAccounts().selectedAccountId, B);
  assert.equal(h.accountEvents.at(-1).selectedAccountId, B);
  await rmdir(h.options.statePath);
  await rename(backupPath, h.options.statePath);
  await h.state.persistActiveAccount();

  await h.match("save-failure", [player(A, "Other", 0), player(B, "Selected", 1)], 1);
  assert.equal(h.state.getActiveAccount().accountId, B);
  assert.deepEqual(h.state.getWinLossCounts(), { wins: 1, losses: 0 });
  await h.state.persistActiveAccount();

  await rename(h.options.statePath, backupPath);
  await mkdir(h.options.statePath);
  await assert.rejects(h.runtime.removePlatformAccount(B));
  assert.equal(h.runtime.getPlatformAccounts().selectedAccountId, undefined);
  assert.equal(h.accountEvents.at(-1).selectedAccountId, undefined);
  await rmdir(h.options.statePath);
  await rename(backupPath, h.options.statePath);
  await h.runtime.removePlatformAccount(B);
  const restored = new PluginState(h.options);
  await restored.initialize();
  assert.equal(restored.getSelectedPlatformId(), undefined);
  assert.equal(restored.getStateSnapshot().matches.some((match) => match.accountId === B), true);
  assert.deepEqual(h.errors, []);
});

test("solo MMR observations are stored by mode until the recurring account is identified", async (t) => {
  const h = await createHarness(t);
  h.runtime.recordGameLogQueue({ queueType: "ranked_1v1", mmr: 900 });
  await h.match("mmr-one", [player(A, "Me", 0), player(C, "Opponent", 1)], 0, 10);
  assert.deepEqual(h.state.getMmrHistory(), {});
  h.runtime.recordGameLogQueue({ queueType: "ranked_2v2", mmr: 1200 });
  await h.match("mmr-two", [player(A, "Me", 0), player(D, "Opponent", 1)], 1, 11);
  assert.equal(h.state.getActiveAccount().accountId, A);
  assert.equal(h.state.getMmrSummary("ranked_1v1").value, "900");
  assert.equal(h.state.getMmrSummary("ranked_2v2").value, "1200");
  assert.equal(h.state.getMmrHistory().ranked_1v1[0].mmr, 900);
  assert.equal(h.state.getMmrHistory().ranked_2v2[0].mmr, 1200);
  assert.deepEqual(h.errors, []);
});

test("correcting an inference restores the old account's MMR and streak baseline", async (t) => {
  const h = await createHarness(t);
  const earlier = Date.now() - 10_000;
  await h.runtime.addPlatformAccount(A);
  await h.runtime.selectPlatformAccount(A);
  await h.state.setPlaylistRank("ranked_2v2", 1100, undefined, earlier);
  await h.state.recordMatchResult({
    matchId: "prior", queueType: "ranked_2v2", outcome: "win", completedAt: earlier + 1
  });
  await h.runtime.removePlatformAccount(A);

  h.runtime.recordGameLogQueue({ queueType: "ranked_2v2", mmr: 1200 });
  await h.match("rank-correction-1", [player(A, "Observed", 0), player(B, "Actual", 1)], 0);
  await h.match("rank-correction-2", [player(A, "Observed", 0), player(D, "Opponent", 1)], 1);
  assert.equal(h.state.getActiveAccount().accountId, A);
  assert.equal(h.state.getMmrSummary("ranked_2v2").value, "1200");
  assert.equal(h.state.getStreakLabel(), "L1");

  await h.runtime.selectPlatformAccount(B, true);
  assert.equal(h.state.getMmrSummary("ranked_2v2").value, "1200");
  assert.equal(h.state.getStreakLabel(), "L1");
  const saved = h.state.getStateSnapshot();
  assert.equal(saved.accounts[A].rankByPlaylist.find((rank) => rank.playlist === "ranked_2v2").mmr, 1100);
  assert.deepEqual(saved.accounts[A].streak, { type: "win", count: 1 });
  assert.equal(saved.accounts[A].records.longestWinStreak, 1);
  assert.equal(saved.matches.filter((match) => match.accountId === A).length, 1);
  assert.deepEqual(h.errors, []);
});

test("MMR rollback metadata stays compact and restores a full 500-point history after restart", async (t) => {
  const h = await createHarness(t);
  const earlier = Date.now() - 10_000;
  const history = Array.from({ length: 500 }, (_, index) => ({
    at: earlier + index, mmr: 1000 + index
  }));
  await h.runtime.addPlatformAccount(A);
  await h.runtime.selectPlatformAccount(A);
  const account = h.state.getActiveAccount();
  account.updatedAt = earlier + 499;
  account.lastMmrPlaylist = "ranked_2v2";
  account.rankByPlaylist = [{ playlist: "ranked_2v2", mmr: 1499, history }];
  await h.state.persistActiveAccount();
  await h.runtime.removePlatformAccount(A);

  h.runtime.recordGameLogQueue({ queueType: "ranked_2v2", mmr: 1500 });
  await h.match("bounded-mmr-1", [player(A, "Observed", 0), player(B, "Actual", 1)], 0);
  h.runtime.recordGameLogQueue({ queueType: "ranked_2v2", mmr: 1501 });
  await h.match("bounded-mmr-2", [player(A, "Observed", 0), player(C, "Opponent", 1)], 1);
  assert.equal(h.state.getMmrSummary("ranked_2v2").value, "1501");
  const observations = h.state.getStateSnapshot().identityMatches;
  for (const observation of observations) {
    assert.equal(observation.rankBefore.history, undefined);
    assert.equal(observation.rankHistoryDelta.evicted.length, 1);
    assert.ok(JSON.stringify(observation.rankHistoryDelta).length < 200);
  }
  await h.state.persistActiveAccount();
  const restored = new PluginState(h.options);
  await restored.initialize();
  await restored.selectPlatformAccount(B, "manual", undefined, true);
  const corrected = restored.getStateSnapshot();
  assert.equal(corrected.accounts[A].rankByPlaylist[0].mmr, 1499);
  assert.deepEqual(corrected.accounts[A].rankByPlaylist[0].history, history);
  assert.equal(restored.getMmrSummary("ranked_2v2").value, "1500");
  assert.deepEqual(h.errors, []);
});

test("correcting a legacy MMR sample restores the original scalar without synthetic history", async (t) => {
  const h = await createHarness(t);
  await h.runtime.addPlatformAccount(A);
  await h.runtime.selectPlatformAccount(A);
  const account = h.state.getActiveAccount();
  account.updatedAt = Date.now() - 10_000;
  account.rankByPlaylist = [{ playlist: "ranked_2v2", mmr: 1100, estimatedRank: "Diamond" }];
  await h.state.persistActiveAccount();
  await h.runtime.removePlatformAccount(A);

  h.runtime.recordGameLogQueue({ queueType: "ranked_2v2", mmr: 1200 });
  await h.match("legacy-mmr-1", [player(A, "Observed", 0), player(B, "Actual", 1)], 0);
  await h.match("legacy-mmr-2", [player(A, "Observed", 0), player(C, "Opponent", 1)], 1);
  assert.equal(h.state.getMmrSummary("ranked_2v2").value, "1200");
  await h.runtime.selectPlatformAccount(B, true);
  assert.deepEqual(h.state.getStateSnapshot().accounts[A].rankByPlaylist, [
    { playlist: "ranked_2v2", mmr: 1100, estimatedRank: "Diamond" }
  ]);
  assert.equal(h.state.getMmrSummary("ranked_2v2").value, "1200");
  assert.deepEqual(h.errors, []);
});

test("unchanged observed MMR does not create duplicate history points", async (t) => {
  const h = await createHarness(t);
  await h.runtime.addPlatformAccount(A);
  await h.runtime.selectPlatformAccount(A);
  await h.state.setPlaylistRank("ranked_2v2", 1100, undefined, Date.now() - 10_000);
  await h.runtime.removePlatformAccount(A);
  h.runtime.recordGameLogQueue({ queueType: "ranked_2v2", mmr: 1100 });
  await h.match("same-mmr-1", [player(A, "Observed", 0), player(B, "Actual", 1)], 0);
  await h.match("same-mmr-2", [player(A, "Observed", 0), player(C, "Opponent", 1)], 1);
  assert.equal(h.state.getMmrHistory().ranked_2v2.length, 1);
  await h.runtime.selectPlatformAccount(B, true);
  assert.equal(h.state.getStateSnapshot().accounts[A].rankByPlaylist[0].history.length, 1);
  assert.equal(h.state.getMmrSummary("ranked_2v2").value, "1100");
  assert.deepEqual(h.errors, []);
});

test("correcting an inference keeps newer independently recorded MMR changes", async (t) => {
  const h = await createHarness(t);
  await h.runtime.addPlatformAccount(A);
  await h.runtime.selectPlatformAccount(A);
  await h.state.setPlaylistRank("ranked_2v2", 1100, undefined, Date.now() - 10_000);
  await h.runtime.removePlatformAccount(A);
  h.runtime.recordGameLogQueue({ queueType: "ranked_2v2", mmr: 1200 });
  await h.match("newer-mmr-1", [player(A, "Observed", 0), player(B, "Actual", 1)], 0);
  h.runtime.recordGameLogQueue({ queueType: "ranked_2v2", mmr: 1300 });
  await h.match("newer-mmr-2", [player(A, "Observed", 0), player(C, "Opponent", 1)], 1);
  await h.state.setPlaylistRank("ranked_2v2", 1400, undefined, Date.now() + 1_000);
  await h.runtime.selectPlatformAccount(B, true);
  const rank = h.state.getStateSnapshot().accounts[A].rankByPlaylist[0];
  assert.equal(rank.mmr, 1400);
  assert.deepEqual(rank.history.map((point) => point.mmr), [1100, 1400]);
  assert.deepEqual(h.errors, []);
});

test("backfilled MMR points do not duplicate a later unchanged rating", async (t) => {
  const h = await createHarness(t);
  const now = Date.now();
  const originalHistory = [{ at: now - 10_000, mmr: 800 }, { at: now + 10_000, mmr: 900 }];
  await h.runtime.addPlatformAccount(A);
  await h.runtime.selectPlatformAccount(A);
  const account = h.state.getActiveAccount();
  account.updatedAt = now + 10_000;
  account.rankByPlaylist = [{
    playlist: "ranked_2v2", mmr: 900, history: structuredClone(originalHistory)
  }];
  await h.state.persistActiveAccount();
  await h.runtime.removePlatformAccount(A);
  h.runtime.recordGameLogQueue({ queueType: "ranked_2v2", mmr: 900 });
  await h.match("backfill-mmr-1", [player(A, "Observed", 0), player(B, "Actual", 1)], 0);
  await h.match("backfill-mmr-2", [player(A, "Observed", 0), player(C, "Opponent", 1)], 1);
  assert.deepEqual(h.state.getMmrHistory().ranked_2v2.map((point) => point.mmr), [800, 900]);
  await h.runtime.selectPlatformAccount(B, true);
  assert.deepEqual(h.state.getStateSnapshot().accounts[A].rankByPlaylist[0].history, originalHistory);
  assert.deepEqual(h.errors, []);
});

test("verified identity corrects tentative solo MMR and an early-leave result", async (t) => {
  const h = await createHarness(t);
  await h.runtime.addPlatformAccount(A);
  await h.runtime.selectPlatformAccount(A);
  h.runtime.recordGameLogQueue({ queueType: "ranked_2v2", mmr: 1234 });
  await h.send("MatchCreated", "correction");
  await h.update("correction", [
    player(A, "Selected", 0, { Goals: 5, Score: 800 }),
    player(B, "Actual", 1, { Saves: 2, Score: 300 })
  ]);
  assert.equal(h.state.getMmrSummary("ranked_2v2").value, "1234");
  await h.send("MatchDestroyed", "correction");
  assert.deepEqual(h.state.getWinLossCounts(), { wins: 0, losses: 1 });
  await h.send("MatchInitialized", "correction");
  h.runtime.recordGameLogIdentity(B);
  await h.update("correction", [
    player(A, "Selected", 0, { Goals: 5, Score: 800 }),
    player(B, "Actual", 1, { Saves: 2, Score: 300 })
  ]);
  await h.send("MatchEnded", "correction", { WinnerTeamNum: 1 });
  assert.equal(h.state.getActiveAccount().accountId, B);
  assert.equal(h.state.getMmrSummary("ranked_2v2").value, "1234");
  assert.deepEqual(h.state.getWinLossCounts(), { wins: 1, losses: 0 });
  const state = h.state.getStateSnapshot();
  assert.equal(state.matches.some((match) => match.accountId === A), false);
  assert.equal(state.accounts[A].records.maxGoalsPerMatch, 0);
  assert.equal(state.accounts[A].rankByPlaylist.length, 0);
  assert.equal(state.matches.find((match) => match.accountId === B).wasRankedReconnect, true);
  assert.deepEqual(h.errors, []);
});

test("removing a managed platform ID persists without erasing its match history", async (t) => {
  const h = await createHarness(t);
  await h.match("remove-test", [player(A, "Me", 0), player(C, "Opponent", 1)]);
  await h.runtime.selectPlatformAccount(A);
  await h.runtime.removePlatformAccount(A);
  await h.state.persistActiveAccount();
  const restored = new PluginState(h.options);
  await restored.initialize();
  const saved = restored.getStateSnapshot();
  assert.equal(saved.managedPlatformIds.includes(A), false);
  assert.equal(saved.matches.filter((match) => match.accountId === A).length, 1);
  assert.equal(restored.getPlatformAccounts().accounts.find((account) => account.accountId === A).managed, false);
  assert.deepEqual(h.errors, []);
});
