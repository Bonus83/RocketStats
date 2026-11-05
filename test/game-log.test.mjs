import test from "node:test";
import assert from "node:assert/strict";
import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:net";

const {
  RocketLeagueLogParser,
  RocketLeagueLogWatcher,
  parsePrimaryAccountIdentity
} = await import(
  "../com.rocketstats.livestats.sdPlugin/bin/connector/rocket-league-log-watcher.js"
);
const { PluginState } = await import(
  "../com.rocketstats.livestats.sdPlugin/bin/core/plugin-state.js"
);
const { LiveRuntime } = await import(
  "../com.rocketstats.livestats.sdPlugin/bin/runtime/live-runtime.js"
);

function matchmakingLines({ mmr = "62.8112", playlistCount = 1, partySize = 1, playlist = 11 } = {}) {
  return [
    "[0789.48] Matchmaking: OnlineGameMatchmaking_X::RecordStart",
    `[0789.48] Matchmaking: Pre-divide PartyLeaderMMR: ${mmr}`,
    "[0789.48] Matchmaking: Post-divide PartyLeaderMMR: 999.0",
    `[0789.48] Matchmaking: PreferredRegions.Length=(5) PreferredPlaylists.Length=(${playlistCount}) Party.GetOrderedPartyMemberIDs().Length=(${partySize})`,
    `[0799.09] Party: HandleServerReserved (Reservation=(ServerName="server",Playlist=${playlist},ReservationID="test-reservation",DSRToken="x"`
  ];
}

function loginLine(accountId, { primary = true, status = "LS_LoggedIn" } = {}) {
  return `[0009.00] Party: HandleLocalPlayerLoginStatusChanged PlayerName=Player PlayerID=${accountId} LoginStatus=${status} IsPrimary=${primary ? "True" : "False"} IsInParty=False`;
}

test("log parser reads solo ranked MMR and its playlist", () => {
  const parser = new RocketLeagueLogParser();
  let queue;
  for (const line of matchmakingLines()) {
    queue = parser.consumeLine(line) ?? queue;
  }
  assert.deepEqual(queue, { queueType: "ranked_2v2", mmr: 1356 });
});

test("log parser never assigns party MMR or casual MMR", () => {
  const parser = new RocketLeagueLogParser();
  let partyQueue;
  for (const line of matchmakingLines({ partySize: 2 })) {
    partyQueue = parser.consumeLine(line) ?? partyQueue;
  }
  assert.deepEqual(partyQueue, { queueType: "ranked_2v2" });

  parser.reset();
  let multiPlaylistQueue;
  for (const line of matchmakingLines({ playlistCount: 2 })) {
    multiPlaylistQueue = parser.consumeLine(line) ?? multiPlaylistQueue;
  }
  assert.deepEqual(multiPlaylistQueue, { queueType: "ranked_2v2" });

  parser.reset();
  let casualQueue;
  for (const line of matchmakingLines({ playlist: 2 })) {
    casualQueue = parser.consumeLine(line) ?? casualQueue;
  }
  assert.deepEqual(casualQueue, { queueType: "casual" });
});

test("log parser recognizes extra ranked playlists without inventing unknown-mode MMR", () => {
  const parser = new RocketLeagueLogParser();
  let queue;
  for (const [playlist, queueType] of [[27, "ranked_hoops"], [63, "ranked_heatseeker"]]) {
    queue = undefined;
    for (const line of matchmakingLines({ playlist })) {
      queue = parser.consumeLine(line) ?? queue;
    }
    assert.deepEqual(queue, { queueType, mmr: 1356 });
  }
  for (const options of [{ partySize: 2 }, { playlistCount: 2 }]) {
    queue = undefined;
    for (const line of matchmakingLines({ playlist: 63, ...options })) {
      queue = parser.consumeLine(line) ?? queue;
    }
    assert.deepEqual(queue, { queueType: "ranked_heatseeker" });
  }
  queue = undefined;
  for (const line of matchmakingLines({ playlist: 999 })) {
    queue = parser.consumeLine(line) ?? queue;
  }
  assert.deepEqual(queue, { queueType: "unknown" });
});

test("log parser binds a reservation to a GUID only after loading a network match", () => {
  const parser = new RocketLeagueLogParser();
  for (const line of matchmakingLines()) parser.consumeLine(line);
  const guid = "0123456789ABCDEF0123456789ABCDEF";
  assert.equal(parser.consumeLine(`[0080.00] ScriptLog: MatchGUID: ${guid}`), undefined);
  assert.equal(parser.consumeLine("[0081.00] Log: LoadMap: Stadium_P"), undefined);
  assert.equal(parser.consumeLine(`[0082.00] ScriptLog: MatchGUID: ${guid}`), undefined);
  assert.equal(parser.consumeLine("[0083.00] Log: LoadMap: 127.0.0.1:7777/Stadium_P"), undefined);
  assert.deepEqual(parser.consumeLine(`[0084.00] ScriptLog: MatchGUID: ${guid}`), {
    queueType: "ranked_2v2",
    mmr: 1356,
    matchId: guid
  });
  assert.equal(parser.consumeLine(`[0085.00] ScriptLog: MatchGUID: ${guid}`), undefined);
});

test("only primary login events provide a verified local account", () => {
  const account = "Steam|76561198000000001|0";
  assert.deepEqual(parsePrimaryAccountIdentity(loginLine(account)), {
    accountId: account,
    invalid: false
  });
  assert.equal(parsePrimaryAccountIdentity(loginLine(account, { primary: false })), undefined);
  assert.deepEqual(parsePrimaryAccountIdentity(loginLine(account, { status: "LS_NotLoggedIn" })), {
    accountId: undefined,
    invalid: false
  });
  assert.deepEqual(parsePrimaryAccountIdentity(loginLine("Unknown|0|0")), {
    accountId: undefined,
    invalid: true
  });
  assert.deepEqual(parsePrimaryAccountIdentity(loginLine("Steam|0|0")), {
    accountId: undefined,
    invalid: true
  });
  assert.equal(parsePrimaryAccountIdentity("Party: unrelated"), undefined);
});

test("identity recovery reads only a current game's primary login, not historical queues", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rocketstats-log-recover-"));
  const filePath = join(directory, "Launch.log");
  const accountA = "Steam|76561198000000001|0";
  const accountB = "Steam|76561198000000002|0";
  await writeFile(filePath, `${loginLine(accountA)}\n${matchmakingLines().join("\n")}\n`);
  const queues = [];
  const identities = [];
  const errors = [];
  const watcher = new RocketLeagueLogWatcher(
    filePath,
    (queue) => queues.push(queue),
    (error) => errors.push(error),
    20,
    (accountId) => identities.push(accountId)
  );
  try {
    await watcher.start();
    await watcher.recoverIdentityAfter(Date.now() + 60_000);
    assert.deepEqual(identities, []);
    await watcher.recoverIdentityAfter(Date.now() - 60_000);
    assert.deepEqual(identities, [accountA]);
    assert.deepEqual(queues, []);

    await appendFile(filePath, `${loginLine(accountB)}\n${matchmakingLines({ playlist: 10 }).join("\n")}\n`);
    const deadline = Date.now() + 2_000;
    while ((queues.length === 0 || identities.length < 2) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.deepEqual(identities, [accountA, accountB]);
    assert.deepEqual(queues, [{ queueType: "ranked_1v1", mmr: 1356 }]);
    assert.deepEqual(errors, []);
  } finally {
    watcher.stop();
    await rm(directory, { recursive: true, force: true });
  }
});

test("log watcher detects a rapidly rewritten file even when its size increases", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rocketstats-log-rewrite-"));
  const filePath = join(directory, "Launch.log");
  const accountA = "Steam|76561198000000001|0";
  const accountB = "Steam|76561198000000002|0";
  await writeFile(filePath, `${loginLine(accountA)}\n`);
  const queues = [];
  const identities = [];
  const errors = [];
  const watcher = new RocketLeagueLogWatcher(
    filePath,
    (queue) => queues.push(queue),
    (error) => errors.push(error),
    20,
    (accountId) => identities.push(accountId)
  );
  try {
    await watcher.start();
    await writeFile(filePath, `${loginLine(accountB)}\n${matchmakingLines({ playlist: 13 }).join("\n")}\n`);
    const deadline = Date.now() + 2_000;
    while ((queues.length === 0 || !identities.includes(accountB)) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.deepEqual(identities, [undefined, accountB]);
    assert.deepEqual(queues, [{ queueType: "ranked_3v3", mmr: 1356 }]);
    assert.deepEqual(errors, []);
  } finally {
    watcher.stop();
    await rm(directory, { recursive: true, force: true });
  }
});

test("log watcher tails an existing game log without replaying old queue events", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rocketstats-log-"));
  const filePath = join(directory, "Launch.log");
  await writeFile(filePath, matchmakingLines().join("\n") + "\n");
  const queues = [];
  const errors = [];
  const watcher = new RocketLeagueLogWatcher(
    filePath,
    (queue) => queues.push(queue),
    (error) => errors.push(error),
    20
  );

  try {
    await watcher.start();
    await appendFile(filePath, `${matchmakingLines({ playlist: 10 }).join("\n")}\n`);
    const deadline = Date.now() + 2_000;
    while (queues.length === 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    assert.deepEqual(errors, []);
    assert.deepEqual(queues, [{ queueType: "ranked_1v1", mmr: 1356 }]);
  } finally {
    watcher.stop();
    await rm(directory, { recursive: true, force: true });
  }
});

test("restarting a stopped log watcher processes new lines without replaying old events", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rocketstats-log-resume-"));
  const filePath = join(directory, "Launch.log");
  const account = "Steam|76561198000000002|0";
  await writeFile(filePath, `${matchmakingLines().join("\n")}\n`);
  const queues = [];
  const identities = [];
  const errors = [];
  const watcher = new RocketLeagueLogWatcher(
    filePath,
    (queue) => queues.push(queue),
    (error) => errors.push(error),
    20,
    (accountId) => identities.push(accountId)
  );
  try {
    await watcher.start();
    await watcher.stopAndDrain();
    await appendFile(filePath, `${loginLine(account)}\n${matchmakingLines({ playlist: 10 }).join("\n")}\n`);
    await watcher.start();
    assert.deepEqual(identities, [account]);
    assert.deepEqual(queues, [{ queueType: "ranked_1v1", mmr: 1356 }]);

    await watcher.stopAndDrain();
    const newAccount = "Steam|76561198000000003|0";
    await writeFile(filePath, `${loginLine(newAccount)}\n${matchmakingLines({ playlist: 13 }).join("\n")}\n`);
    await watcher.start();
    assert.deepEqual(identities, [account, undefined, newAccount]);
    assert.deepEqual(queues, [
      { queueType: "ranked_1v1", mmr: 1356 },
      { queueType: "ranked_3v3", mmr: 1356 }
    ]);
    assert.deepEqual(errors, []);
  } finally {
    await watcher.stopAndDrain();
    await rm(directory, { recursive: true, force: true });
  }
});

test("log watcher detects the game log when it appears after startup", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rocketstats-log-create-"));
  const filePath = join(directory, "Launch.log");
  const queues = [];
  const errors = [];
  const watcher = new RocketLeagueLogWatcher(
    filePath,
    (queue) => queues.push(queue),
    (error) => errors.push(error),
    20
  );

  try {
    await watcher.start();
    await writeFile(filePath, `${matchmakingLines({ playlist: 13 }).join("\n")}\n`);
    const deadline = Date.now() + 2_000;
    while (queues.length === 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    assert.deepEqual(errors, []);
    assert.deepEqual(queues, [{ queueType: "ranked_3v3", mmr: 1356 }]);
  } finally {
    watcher.stop();
    await rm(directory, { recursive: true, force: true });
  }
});

test("log MMR is saved to the freshly identified game account", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rocketstats-log-account-"));
  const state = new PluginState({
    statePath: join(directory, "state.json"),
    identityGraceWindowMs: 90_000,
    reconnectWindowMs: 600_000
  });
  await state.initialize();

  let client;
  const server = createServer((socket) => {
    client = socket;
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  let renderCount = 0;
  const runtime = new LiveRuntime(state, { render() { renderCount += 1; } }, {
    host: "127.0.0.1",
    port: address.port,
    reconnectDelayMs: 100,
    actionKinds: ["mmr"],
    locale: "en",
    mmrPlaylist: "ranked_2v2",
    eventBannerStats: [],
    animateEvents: false
  });

  async function sendIdentity(accountId, name) {
    const deadline = Date.now() + 2_000;
    while (!client && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.ok(client, "runtime should connect to the test feed");
    const previousRenderCount = renderCount;
    client.write(JSON.stringify({
      Event: "UpdateState",
      MatchGuid: `match-${accountId}`,
      Data: {
        Game: { PlaylistId: 11 },
        Players: [{
          IsLocalPlayer: true,
          PrimaryId: accountId,
          Name: name,
          TeamNum: 0,
          Score: 0,
          Goals: 0,
          Assists: 0,
          Saves: 0,
          Shots: 0,
          Boost: 0,
          Speed: 0
        }]
      }
    }));

    const identityDeadline = Date.now() + 2_000;
    while (
      renderCount === previousRenderCount &&
      Date.now() < identityDeadline
    ) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.ok(renderCount > previousRenderCount, "the match snapshot should be processed");
    assert.equal(state.getStateSnapshot().activeAccountId, accountId);
  }

  try {
    runtime.start();
    runtime.recordGameLogQueue({ queueType: "ranked_2v2", mmr: 1356 });
    await sendIdentity("account-a", "Player A");
    assert.equal(state.getMmrSummary("ranked_2v2").value, "1356");
    assert.equal(state.getMmrSummary("ranked_2v2").rankLabel, "Champion III");

    runtime.recordGameLogIdentity("account-b");
    runtime.recordGameLogQueue({ queueType: "ranked_2v2", mmr: 1200 });
    await sendIdentity("account-b", "Player B");
    assert.equal(state.getMmrSummary("ranked_2v2").value, "1200");
    assert.equal(state.getMmrSummary("ranked_2v2").rankLabel, "Champion II");

    const accounts = state.getStateSnapshot().accounts;
    assert.equal(accounts["account-a"].rankByPlaylist[0].mmr, 1356);
    assert.equal(accounts["account-b"].rankByPlaylist[0].mmr, 1200);

    const persistenceDeadline = Date.now() + 2_000;
    let persisted;
    while (Date.now() < persistenceDeadline) {
      try {
        const saved = JSON.parse(await readFile(join(directory, "state.json"), "utf8"));
        if (
          saved.accounts["account-a"]?.rankByPlaylist[0]?.mmr === 1356 &&
          saved.accounts["account-a"]?.rankByPlaylist[0]?.estimatedRank === "Champion III" &&
          saved.accounts["account-b"]?.rankByPlaylist[0]?.mmr === 1200 &&
          saved.accounts["account-b"]?.rankByPlaylist[0]?.estimatedRank === "Champion II"
        ) {
          persisted = saved;
          break;
        }
      } catch (error) {
        assert.ok(error instanceof Error && "code" in error && error.code === "ENOENT");
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.ok(persisted, "both accounts' MMR values should be persisted");
    assert.equal(persisted.accounts["account-a"].rankByPlaylist[0].mmr, 1356);
    assert.equal(persisted.accounts["account-a"].rankByPlaylist[0].estimatedRank, "Champion III");
    assert.equal(persisted.accounts["account-b"].rankByPlaylist[0].mmr, 1200);
    assert.equal(persisted.accounts["account-b"].rankByPlaylist[0].estimatedRank, "Champion II");
  } finally {
    runtime.stop();
    client?.destroy();
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
