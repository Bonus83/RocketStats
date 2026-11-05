import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:net";

const { IdentityResolver } = await import(
  "../com.rocketstats.livestats.sdPlugin/bin/core/identity-resolver.js"
);
const { AccountStore } = await import(
  "../com.rocketstats.livestats.sdPlugin/bin/core/account-store.js"
);
const { StreakEngine } = await import(
  "../com.rocketstats.livestats.sdPlugin/bin/core/streak-engine.js"
);
const { PluginState } = await import(
  "../com.rocketstats.livestats.sdPlugin/bin/core/plugin-state.js"
);
const { renderAction } = await import(
  "../com.rocketstats.livestats.sdPlugin/bin/render/key-renderer.js"
);
const { RlLiveConnector } = await import(
  "../com.rocketstats.livestats.sdPlugin/bin/connector/rl-live-connector.js"
);
const { OfficialStatsNormalizer } = await import(
  "../com.rocketstats.livestats.sdPlugin/bin/connector/official-stats-normalizer.js"
);
const { RlControlClient } = await import(
  "../com.rocketstats.livestats.sdPlugin/bin/control/rl-control-client.js"
);
const { RenderBus } = await import(
  "../com.rocketstats.livestats.sdPlugin/bin/streamdeck/render-bus.js"
);
const { normalizeActionSettings } = await import(
  "../com.rocketstats.livestats.sdPlugin/bin/streamdeck/action-settings.js"
);
const { updateStatsApiIni, isStatsApiIniConfigured } = await import(
  "../scripts/rl-stats-api-config.mjs"
);

test("live account identity overrides manual fallback", () => {
  const resolver = new IdentityResolver({ graceWindowMs: 30_000 });
  const manual = resolver.resolve({
    manualDisplayName: "TypedName",
    observedAt: 1000
  });
  assert.equal(manual.source, "manual_fallback");

  const live = resolver.resolve({
    accountId: "epic_123",
    liveDisplayName: "LiveName",
    manualDisplayName: "TypedName",
    observedAt: 2000
  });
  assert.equal(live.source, "live_account");
  assert.equal(live.displayName, "LiveName");
  assert.equal(live.accountId, "epic_123");
});

test("live account ID overrides manual identity even when its display name is absent", () => {
  const resolver = new IdentityResolver({ graceWindowMs: 30_000 });
  resolver.resolve({
    accountId: "epic_old",
    liveDisplayName: "OldName",
    observedAt: 1000
  });

  const current = resolver.resolve({
    accountId: "epic_current",
    manualDisplayName: "TypedName",
    observedAt: 2000
  });
  assert.equal(current.source, "live_account");
  assert.equal(current.accountId, "epic_current");
  assert.equal(current.displayName, "epic_current");
});

test("an explicitly verified account wins even when a manual name also matches", () => {
  const resolver = new IdentityResolver({ graceWindowMs: 30_000 });
  const identity = resolver.resolve({
    accountId: "actual-account",
    manualDisplayName: "Other Player",
    manualMatch: true,
    observedAt: 2000
  });
  assert.equal(identity.accountId, "actual-account");
  assert.equal(identity.source, "live_account");
});

test("manual-name match switches from stale live identity to the fallback account", () => {
  const resolver = new IdentityResolver({ graceWindowMs: 30_000 });
  resolver.resolve({
    accountId: "previous-account",
    liveDisplayName: "Previous Player",
    observedAt: 1000
  });
  const selected = resolver.resolve({
    manualDisplayName: "Selected Player",
    manualMatch: true,
    observedAt: 2000
  });
  assert.equal(selected.source, "manual_fallback");
  assert.equal(selected.accountId, "manual:selected player");
});

test("manual player fallback requires one exact name match and never claims a live account ID", () => {
  const normalizer = new OfficialStatsNormalizer();
  normalizer.configureManualPlayerName("typedname");
  const matched = normalizer.normalize({
    Event: "UpdateState",
    MatchGuid: "manual-match",
    Data: {
      Players: [
        { PrimaryId: "account-a", Name: "Other Player", TeamNum: 0 },
        {
          PrimaryId: "account-b",
          Name: "TypedName",
          TeamNum: 1,
          Score: 200,
          Goals: 1
        }
      ]
    }
  }, 1000);
  assert.equal(matched.localPlayer.name, "TypedName");
  assert.equal(matched.localPlayer.matchedByManualName, true);
  assert.equal(matched.localPlayer.accountId, undefined);
  assert.equal(matched.myTeam, "orange");

  const verifiedWins = normalizer.normalize({
    Event: "UpdateState",
    Data: {
      Players: [
        {
          PrimaryId: "verified-account",
          Name: "Verified Player",
          TeamNum: 0,
          IsLocalPlayer: true
        },
        { Name: "TypedName", TeamNum: 1 }
      ]
    }
  }, 2000);
  assert.equal(verifiedWins.localPlayer.name, "Verified Player");
  assert.equal(verifiedWins.localPlayer.accountId, "verified-account");
  assert.equal(verifiedWins.localPlayer.matchedByManualName, undefined);

  const ambiguous = new OfficialStatsNormalizer();
  ambiguous.configureManualPlayerName("SameName");
  const noGuess = ambiguous.normalize({
    Event: "UpdateState",
    Data: {
      Players: [
        { PrimaryId: "one", Name: "SameName", TeamNum: 0 },
        { PrimaryId: "two", Name: "samename", TeamNum: 1 }
      ]
    }
  }, 3000);
  assert.equal(noGuess.localPlayer, undefined);
});

test("Stats API setup keeps unrelated INI sections and is idempotent", () => {
  const original = [
    "[General]",
    "KeepThis=1",
    "",
    "[TAGame.MatchStatsExporter_TA]",
    "Port=49000",
    "",
    "[Other]",
    "KeepThat=2",
    ""
  ].join("\r\n");
  const configured = updateStatsApiIni(original);
  assert.match(configured, /\[General\]\r\nKeepThis=1/);
  assert.match(configured, /\[TAGame\.MatchStatsExporter_TA\]\r\nPort=49123\r\nPacketSendRate=30\r\n\r\n\[Other\]/);
  assert.match(configured, /\[Other\]\r\nKeepThat=2/);
  assert.equal(isStatsApiIniConfigured(configured), true);
  assert.equal(updateStatsApiIni(configured), configured);

  const newConfig = updateStatsApiIni("");
  assert.equal(newConfig, "[TAGame.MatchStatsExporter_TA]\nPort=49123\nPacketSendRate=30\n");
});

test("account store serializes concurrent atomic saves", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rocketstats-store-tests-"));
  const file = join(dir, "nested", "state.json");
  try {
    const store = new AccountStore(file);
    const writes = Array.from({ length: 20 }, (_, index) => {
      const state = {
        schemaVersion: 1,
        activeAccountId: `account-${index}`,
        accounts: {},
        matches: [],
        pendingReconnect: []
      };
      return store.save(state);
    });
    await Promise.all(writes);

    const loaded = await store.load();
    assert.equal(loaded.activeAccountId, "account-19");
    const persisted = JSON.parse(await readFile(file, "utf8"));
    assert.equal(persisted.activeAccountId, "account-19");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("streak engine replaces provisional early-leave result after reconnect", () => {
  const engine = new StreakEngine(60_000);
  const baseStreak = { type: "none", count: 0 };
  const now = 1_000_000;

  const earlyLeave = engine.applyEarlyLeave(
    baseStreak,
    [],
    [],
    {
      matchId: "m-1",
      accountId: "acc-1",
      queueType: "ranked_2v2",
      startedAt: now - 10_000,
      outcome: "unknown",
      endedNormally: false,
      wasEarlyLeave: true,
      wasRankedReconnect: false
    },
    now
  );

  assert.deepEqual(earlyLeave.streak, { type: "loss", count: 1 });
  assert.equal(earlyLeave.pendingReconnect.length, 1);
  assert.equal(earlyLeave.records.at(-1)?.isProvisional, true);

  const duplicateLeave = engine.applyEarlyLeave(
    earlyLeave.streak,
    earlyLeave.records,
    earlyLeave.pendingReconnect,
    {
      matchId: "m-1",
      accountId: "acc-1",
      queueType: "ranked_2v2",
      startedAt: now - 10_000,
      outcome: "unknown",
      endedNormally: false,
      wasEarlyLeave: true,
      wasRankedReconnect: false
    },
    now + 1
  );
  assert.equal(duplicateLeave.changed, false);
  assert.equal(duplicateLeave.records.length, 1);
  assert.equal(duplicateLeave.pendingReconnect.length, 1);

  const corrected = engine.applyFinalResult(
    earlyLeave.streak,
    earlyLeave.records,
    earlyLeave.pendingReconnect,
    {
      matchId: "m-1",
      accountId: "acc-1",
      queueType: "ranked_2v2",
      startedAt: now - 10_000,
      outcome: "unknown",
      endedNormally: true,
      wasEarlyLeave: false,
      wasRankedReconnect: true
    },
    "win",
    now + 5000
  );

  assert.deepEqual(corrected.streak, { type: "win", count: 1 });
  assert.equal(corrected.pendingReconnect.length, 0);
  assert.equal(corrected.records.length, 1);
  assert.equal(corrected.records[0].outcome, "win");
  assert.equal(corrected.records[0].isProvisional, undefined);

  const duplicateResult = engine.applyFinalResult(
    corrected.streak,
    corrected.records,
    corrected.pendingReconnect,
    {
      matchId: "m-1",
      accountId: "acc-1",
      queueType: "ranked_2v2",
      startedAt: now - 10_000,
      outcome: "unknown",
      endedNormally: true,
      wasEarlyLeave: false,
      wasRankedReconnect: true
    },
    "win",
    now + 6000
  );
  assert.equal(duplicateResult.changed, false);
  assert.deepEqual(duplicateResult.streak, { type: "win", count: 1 });
  assert.equal(duplicateResult.records.length, 1);
});

test("plugin state keeps streaks separated by account", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rocketstats-tests-"));
  const file = join(dir, "state.json");

  try {
    const state = new PluginState({
      statePath: file,
      identityGraceWindowMs: 10_000,
      reconnectWindowMs: 30_000
    });
    await state.initialize();

    state.resolveIdentity({
      accountId: "a",
      liveDisplayName: "A",
      observedAt: 1000
    });
    await state.recordMatchResult({
      matchId: "a-1",
      queueType: "ranked_2v2",
      outcome: "win",
      completedAt: 2000
    });

    state.resolveIdentity({
      accountId: "b",
      liveDisplayName: "B",
      observedAt: 3000
    });
    await state.recordMatchResult({
      matchId: "b-1",
      queueType: "ranked_2v2",
      outcome: "loss",
      completedAt: 4000
    });

    const snapshot = state.getStateSnapshot();
    assert.deepEqual(snapshot.accounts.a.streak, { type: "win", count: 1 });
    assert.deepEqual(snapshot.accounts.b.streak, { type: "loss", count: 1 });

    const reloaded = new PluginState({
      statePath: file,
      identityGraceWindowMs: 10_000,
      reconnectWindowMs: 30_000
    });
    await reloaded.initialize();

    const restoredA = reloaded.resolveIdentity({
      accountId: "a",
      manualDisplayName: "TypedName",
      observedAt: 5000
    });
    assert.equal(restoredA.source, "live_account");
    assert.equal(reloaded.getStreakLabel(), "W1");
    assert.equal(reloaded.getStateSnapshot().accounts.a.displayName, "A");

    reloaded.resolveIdentity({
      accountId: "b",
      manualDisplayName: "AnotherTypedName",
      observedAt: 6000
    });
    assert.equal(reloaded.getStreakLabel(), "L1");
    assert.equal(reloaded.getStateSnapshot().accounts.b.displayName, "B");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("ranked reconnect correction recomputes longest streak records", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rocketstats-reconnect-record-tests-"));
  const state = new PluginState({
    statePath: join(dir, "state.json"),
    identityGraceWindowMs: 10_000,
    reconnectWindowMs: 30_000
  });
  try {
    await state.initialize();
    state.resolveIdentity({ accountId: "account-a", liveDisplayName: "A", observedAt: 1000 });
    await state.recordMatchResult({
      matchId: "loss-1",
      queueType: "ranked_2v2",
      outcome: "loss",
      completedAt: 1000
    });
    await state.recordMatchResult({
      matchId: "loss-2",
      queueType: "ranked_2v2",
      outcome: "loss",
      completedAt: 2000
    });
    await state.recordEarlyLeave("reconnect-match", "ranked_2v2", 3000);
    assert.equal(state.getStateSnapshot().accounts["account-a"].records.longestLossStreak, 3);

    await state.recordMatchResult({
      matchId: "reconnect-match",
      queueType: "ranked_2v2",
      outcome: "win",
      completedAt: 5000
    });

    const account = state.getStateSnapshot().accounts["account-a"];
    assert.deepEqual(account.streak, { type: "win", count: 1 });
    assert.equal(account.records.longestLossStreak, 2);
    assert.equal(account.records.longestWinStreak, 1);
    assert.equal(state.getStateSnapshot().pendingReconnect.length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("renderer formats overtime timer and supersonic boost", () => {
  const snapshot = {
    matchId: "match-1",
    isInMatch: true,
    isOvertime: true,
    isPaused: false,
    gameClockSeconds: 154,
    blueScore: 2,
    orangeScore: 1,
    isSearching: false,
    searchingPlaylists: [],
    searchElapsedSeconds: 0,
    banRemainingSeconds: 0,
    leftEarly: false,
    rankedReconnectResultApplied: false,
    myTeam: "blue",
    localPlayer: {
      name: "Player",
      team: "blue",
      score: 100,
      goals: 1,
      assists: 0,
      saves: 2,
      shots: 4,
      demos: 0,
      touches: 12,
      flipResets: 0,
      boost: 76,
      speedKph: 89,
      supersonic: true,
      hasBallPossession: true
    },
    updatedAt: 42
  };

  const timer = renderAction("timer", snapshot);
  assert.equal(timer.value, "2:34");
  assert.equal(timer.footer, "OT");

  const boost = renderAction("boost", snapshot);
  assert.equal(boost.value, "76");
  assert.equal(boost.footer, "SUPERSONIC");
});

test("renderer distinguishes unavailable player data from zero values", () => {
  const snapshot = {
    matchId: "no-local-player",
    isInMatch: true,
    isOvertime: false,
    isPaused: false,
    gameClockSeconds: 30,
    blueScore: 0,
    orangeScore: 0,
    isSearching: false,
    searchingPlaylists: [],
    searchElapsedSeconds: 0,
    banRemainingSeconds: 0,
    leftEarly: false,
    rankedReconnectResultApplied: false,
    latestEvent: { type: "demo", occurredAt: 100 },
    updatedAt: 100
  };
  const boost = renderAction("boost", snapshot, { locale: "de" });
  const speed = renderAction("speed", snapshot, { locale: "de" });
  const possession = renderAction("possession", snapshot, { locale: "de" });
  const goals = renderAction("goals", snapshot, { locale: "de" });
  const event = renderAction("event-banner", snapshot, {
    locale: "de",
    animateEvents: false
  });

  assert.equal(boost.value, "--");
  assert.equal(boost.footer, "SPIELER FEHLT");
  assert.equal(speed.value, "--");
  assert.equal(speed.footer, "SPIELER FEHLT");
  assert.equal(possession.value, "--");
  assert.equal(possession.footer, "SPIELER FEHLT");
  assert.equal(goals.value, "--");
  assert.equal(goals.footer, "SPIELER FEHLT");
  assert.deepEqual(event.eventStatValues, {
    goals: "--",
    assists: "--",
    saves: "--",
    shots: "--",
    demos: "--",
    score: "--",
    ping: "--"
  });
});

test("connector preserves support for line-delimited snapshot adapters", async () => {
  const payload = JSON.stringify({
    matchId: "m-stream",
    inMatch: true,
    overtime: false,
    paused: false,
    clockSeconds: 111,
    score: { blue: 3, orange: 1 },
    matchmaking: {
      isSearching: true,
      playlists: ["ranked_2v2", "ranked_3v3"],
      elapsedSeconds: 45,
      banRemainingSeconds: 120
    },
    queueType: "ranked_2v2",
    myTeam: "blue",
    localPlayer: {
      accountId: "epic_9",
      name: "LiveName",
      team: "blue",
      boost: 42,
      speedKph: 120
    },
    updatedAt: 555
  });

  const server = createServer((socket) => {
    socket.write(`${payload}\n`);
    socket.end();
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to allocate test TCP port");
  }

  const connector = new RlLiveConnector({
    host: "127.0.0.1",
    port: address.port,
    reconnectDelayMs: 500
  });

  const snapshot = await new Promise((resolve, reject) => {
    connector.onSnapshot((data) => {
      connector.stop();
      resolve(data);
    });
    connector.onError(reject);
    connector.start();
  });

  assert.equal(snapshot.matchId, "m-stream");
  assert.equal(snapshot.localPlayer.accountId, "epic_9");
  assert.equal(snapshot.localPlayer.boost, 42);
  assert.equal(snapshot.blueScore, 3);
  assert.equal(snapshot.isSearching, true);
  assert.equal(snapshot.searchElapsedSeconds, 45);
  assert.equal(snapshot.banRemainingSeconds, 120);
  assert.equal(snapshot.queueType, "ranked_2v2");
  server.close();
});

test("official API normalizer maps events without guessing the local player", () => {
  const normalizer = new OfficialStatsNormalizer();
  assert.throws(() => normalizer.normalize({
    Event: "UpdateState",
    Data: "{invalid-json"
  }), SyntaxError);
  const initial = normalizer.normalize({
    Event: "UpdateState",
    MatchGuid: "official-match",
    Data: JSON.stringify({
      Game: {
        Teams: [
          { TeamNum: 0, Score: 2 },
          { TeamNum: 1, Score: 1 }
        ]
      },
      Players: [
        { PrimaryId: "account-a", Name: "Player A", TeamNum: 0, Score: 400 },
        { PrimaryId: "account-b", Name: "Player B", TeamNum: 1, Score: 300 }
      ]
    })
  }, 1000);

  assert.equal(initial.matchId, "official-match");
  assert.equal(initial.blueScore, 2);
  assert.equal(initial.orangeScore, 1);
  assert.equal(initial.localPlayer, undefined);
  assert.equal(initial.myTeam, undefined);

  const clock = normalizer.normalize({
    Event: "ClockUpdatedSeconds",
    Data: { TimeSeconds: 300, bOvertime: true }
  }, 2000);
  assert.equal(clock.gameClockSeconds, 300);
  assert.equal(clock.isOvertime, true);

  const goal = normalizer.normalize({
    Event: "GoalScored",
    Data: {
      GoalSpeed: 123.4,
      Scorer: { Name: "Player A", TeamNum: 0 }
    }
  }, 3000);
  assert.deepEqual(goal.lastGoal, {
    scorer: "Player A",
    team: "blue",
    occurredAt: 3000,
    speedKph: 123.4
  });

  const demo = normalizer.normalize({
    Event: "StatfeedEvent",
    Data: {
      EventName: "Demolish",
      MainTarget: { Name: "Player A" },
      SecondaryTarget: { Name: "Player B" }
    }
  }, 4000);
  assert.equal(demo.latestEvent.type, "demo");
  assert.equal(demo.latestEvent.label, "Player A");

  const paused = normalizer.normalize({ Event: "MatchPaused", Data: {} }, 5000);
  assert.equal(paused.isPaused, true);
  const resumed = normalizer.normalize({ Event: "MatchUnpaused", Data: {} }, 6000);
  assert.equal(resumed.isPaused, false);

  normalizer.normalize({
    Event: "UpdateState",
    Data: {
      Players: [
        { PrimaryId: "account-a", Name: "Player A", TeamNum: 0, IsLocalPlayer: true }
      ]
    }
  }, 7000);
  const ended = normalizer.normalize({
    Event: "MatchEnded",
    Data: { WinnerTeamNum: 0 }
  }, 8000);
  assert.equal(ended.result, "win");
  assert.equal(ended.isInMatch, false);
});

test("official API lifecycle marks early leaves and preserves reconnect identity", () => {
  const normalizer = new OfficialStatsNormalizer();
  normalizer.normalize({
    Event: "MatchCreated",
    MatchGuid: "reconnect-match",
    Data: {}
  }, 1000);
  normalizer.normalize({
    Event: "UpdateState",
    MatchGuid: "reconnect-match",
    Data: {
      Players: [
        {
          PrimaryId: "account-a",
          Name: "Player A",
          TeamNum: 0,
          IsLocalPlayer: true
        }
      ]
    }
  }, 2000);

  const left = normalizer.normalize({
    Event: "MatchDestroyed",
    MatchGuid: "reconnect-match",
    Data: {}
  }, 3000);
  assert.equal(left.isInMatch, false);
  assert.equal(left.leftEarly, true);
  assert.equal(left.queueType, "unknown");

  const rejoined = normalizer.normalize({
    Event: "MatchCreated",
    MatchGuid: "reconnect-match",
    Data: {}
  }, 4000);
  assert.equal(rejoined.isInMatch, true);
  assert.equal(rejoined.leftEarly, false);
  assert.equal(rejoined.rankedReconnectResultApplied, true);

  const result = normalizer.normalize({
    Event: "MatchEnded",
    MatchGuid: "reconnect-match",
    Data: { WinnerTeamNum: 0 }
  }, 5000);
  assert.equal(result.result, "win");
  assert.equal(result.queueType, "unknown");
});

test("connector frames consecutive official Stats API JSON objects across chunks", async () => {
  const messages = [
    JSON.stringify({
      Event: "UpdateState",
      MatchGuid: "official-match",
      Data: {
        Game: {
          Teams: [{ TeamNum: 0, Score: 1 }, { TeamNum: 1, Score: 0 }]
        },
        Players: [
          {
            PrimaryId: "account-a",
            Name: "Player {A} \"One\"",
            TeamNum: 0,
            IsLocalPlayer: true,
            Score: 250,
            Boost: 52
          }
        ]
      }
    }),
    JSON.stringify({
      Event: "ClockUpdatedSeconds",
      Data: { TimeSeconds: 58, bOvertime: false }
    }),
    JSON.stringify({
      Event: "GoalScored",
      Data: {
        GoalSpeed: 119,
        Scorer: { Name: "Player {A} \"One\"", TeamNum: 0 }
      }
    })
  ];
  const wire = messages.join("");
  const server = createServer((socket) => {
    socket.write(wire.slice(0, 17));
    socket.write(wire.slice(17, 91));
    socket.end(wire.slice(91));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to allocate test TCP port");
  }

  const connector = new RlLiveConnector({
    host: "127.0.0.1",
    port: address.port,
    reconnectDelayMs: 500
  });

  const snapshot = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for Stats API event")), 2000);
    connector.onSnapshot((data) => {
      if (!data.lastGoal) {
        return;
      }
      clearTimeout(timeout);
      connector.stop();
      resolve(data);
    });
    connector.onError(reject);
    connector.start();
  });

  assert.equal(snapshot.matchId, "official-match");
  assert.equal(snapshot.blueScore, 1);
  assert.equal(snapshot.localPlayer.name, "Player {A} \"One\"");
  assert.equal(snapshot.localPlayer.accountId, "account-a");
  assert.equal(snapshot.localPlayer.boost, 52);
  assert.equal(snapshot.gameClockSeconds, 58);
  assert.equal(snapshot.lastGoal.speedKph, 119);
  server.close();
});

test("connector rejects invalid port configuration", () => {
  const connector = new RlLiveConnector({
    host: "127.0.0.1",
    port: 49123,
    reconnectDelayMs: 100
  });
  assert.throws(() => connector.reconfigurePort(0), RangeError);
  assert.throws(() => connector.reconfigurePort(65536), RangeError);
});

test("renderer applies locale and queue/ban labels", () => {
  const snapshot = {
    matchId: "match-2",
    isInMatch: false,
    isOvertime: false,
    isPaused: false,
    gameClockSeconds: 0,
    blueScore: 0,
    orangeScore: 0,
    isSearching: true,
    searchingPlaylists: ["ranked_2v2", "ranked_3v3"],
    searchElapsedSeconds: 91,
    banRemainingSeconds: 0,
    leftEarly: false,
    rankedReconnectResultApplied: false,
    updatedAt: 44
  };

  const score = renderAction("score", snapshot, { locale: "de" });
  assert.equal(score.title, "SPIELSTAND");

  const queue = renderAction("queue-status", snapshot, { locale: "de" });
  assert.equal(queue.value, "SUCHT");
  assert.equal(queue.footer, "1:31");
});

test("renderer localizes stats and event labels in every supported locale", () => {
  const expected = {
    en: { goals: "GOALS", speed: "SPEED", demo: "DEMO", possession: "POSSESSION" },
    de: { goals: "TORE", speed: "TEMPO", demo: "DEMO", possession: "BALLBESITZ" },
    pl: { goals: "GOLE", speed: "PRĘDKOŚĆ", demo: "DEMOLKA", possession: "POSIADANIE" },
    fr: { goals: "BUTS", speed: "VITESSE", demo: "DESTRUCTION", possession: "POSSESSION" },
    es: { goals: "GOLES", speed: "VELOCIDAD", demo: "DESTRUCCIÓN", possession: "POSESIÓN" },
    pt: { goals: "GOLS", speed: "VELOCIDADE", demo: "DESTRUIÇÃO", possession: "POSSE" },
    ru: { goals: "ГОЛЫ", speed: "СКОРОСТЬ", demo: "ДЕМО", possession: "ВЛАДЕНИЕ" }
  };
  const snapshot = {
    matchId: "localized-match",
    isInMatch: true,
    isOvertime: false,
    isPaused: false,
    gameClockSeconds: 30,
    blueScore: 0,
    orangeScore: 0,
    isSearching: false,
    searchingPlaylists: [],
    searchElapsedSeconds: 0,
    banRemainingSeconds: 0,
    leftEarly: false,
    rankedReconnectResultApplied: false,
    latestEvent: { type: "demo", occurredAt: 100 },
    updatedAt: 100
  };

  for (const [locale, labels] of Object.entries(expected)) {
    assert.equal(renderAction("goals", snapshot, { locale }).title, labels.goals);
    assert.equal(renderAction("speed", snapshot, { locale }).title, labels.speed);
    assert.equal(renderAction("possession", snapshot, { locale }).title, labels.possession);
    assert.equal(renderAction("event-banner", snapshot, {
      locale,
      animateEvents: false
    }).title, labels.demo);
  }
});

test("records tile shows streak, per-match stats, and fastest-goal speed", () => {
  const snapshot = {
    matchId: "records-tile",
    isInMatch: false,
    isOvertime: false,
    isPaused: false,
    gameClockSeconds: 0,
    blueScore: 0,
    orangeScore: 0,
    isSearching: false,
    searchingPlaylists: [],
    searchElapsedSeconds: 0,
    banRemainingSeconds: 0,
    leftEarly: false,
    rankedReconnectResultApplied: false,
    updatedAt: 0
  };
  const rendered = renderAction("records", snapshot, {
    recordsLabel: "W2 L1"
  });
  assert.equal(rendered.title, "RECORDS");
  assert.equal(rendered.value, "W2 L1");
  assert.equal(rendered.footer, "");

  const streak = renderAction("streak", snapshot, { streakValue: "L1" });
  assert.equal(streak.value, "L1");
  assert.equal(streak.footer, "");
});

test("event banner shows selected three stats", () => {
  const snapshot = {
    matchId: "match-3",
    isInMatch: true,
    isOvertime: false,
    isPaused: false,
    gameClockSeconds: 50,
    blueScore: 1,
    orangeScore: 1,
    isSearching: false,
    searchingPlaylists: [],
    searchElapsedSeconds: 0,
    banRemainingSeconds: 0,
    leftEarly: false,
    rankedReconnectResultApplied: false,
    localPlayer: {
      name: "StatsPlayer",
      team: "blue",
      score: 321,
      goals: 2,
      assists: 1,
      saves: 3,
      shots: 4,
      demos: 1,
      touches: 8,
      flipResets: 0,
      boost: 20,
      speedKph: 80,
      supersonic: false,
      hasBallPossession: false
    },
    updatedAt: 55
  };
  const banner = renderAction("event-banner", snapshot, {
    eventBannerStats: ["goals", "assists", "demos"]
  });
  assert.equal(banner.footer, "G2 A1 D1");
});

test("event banner renders non-goal gameplay event", () => {
  const snapshot = {
    matchId: "match-4",
    isInMatch: true,
    isOvertime: false,
    isPaused: false,
    gameClockSeconds: 80,
    blueScore: 1,
    orangeScore: 1,
    isSearching: false,
    searchingPlaylists: [],
    searchElapsedSeconds: 0,
    banRemainingSeconds: 0,
    leftEarly: false,
    rankedReconnectResultApplied: false,
    latestEvent: {
      type: "demo",
      label: "DEMOLITION",
      value: "Enemy down",
      occurredAt: 88
    },
    updatedAt: 88
  };
  const banner = renderAction("event-banner", snapshot, { animateEvents: false });
  assert.equal(banner.title, "DEMO");
  assert.equal(banner.value, "DEMOLITION");
});

test("event banner marks a last goal as an animatable event", () => {
  const snapshot = {
    matchId: "match-goal",
    isInMatch: true,
    isOvertime: false,
    isPaused: false,
    gameClockSeconds: 30,
    blueScore: 1,
    orangeScore: 0,
    isSearching: false,
    searchingPlaylists: [],
    searchElapsedSeconds: 0,
    banRemainingSeconds: 0,
    leftEarly: false,
    rankedReconnectResultApplied: false,
    lastGoal: {
      scorer: "GoalPlayer",
      team: "blue",
      speedKph: 120,
      occurredAt: 1234
    },
    updatedAt: 1234
  };
  const banner = renderAction("event-banner", snapshot, { animateEvents: true });

  assert.equal(banner.eventType, "goal");
  assert.equal(banner.eventId, 1234);
  assert.equal(banner.animateEvents, true);
});

test("renderer exposes per-stat player tiles", () => {
  const snapshot = {
    matchId: "match-5",
    isInMatch: true,
    isOvertime: false,
    isPaused: false,
    gameClockSeconds: 99,
    blueScore: 1,
    orangeScore: 0,
    isSearching: false,
    searchingPlaylists: [],
    searchElapsedSeconds: 0,
    banRemainingSeconds: 0,
    leftEarly: false,
    rankedReconnectResultApplied: false,
    localPlayer: {
      name: "TilePlayer",
      team: "blue",
      score: 450,
      goals: 2,
      assists: 3,
      saves: 1,
      shots: 5,
      demos: 4,
      touches: 9,
      flipResets: 2,
      boost: 80,
      speedKph: 120,
      supersonic: true,
      hasBallPossession: true
    },
    updatedAt: 99
  };
  assert.equal(renderAction("goals", snapshot).value, "2");
  assert.equal(renderAction("assists", snapshot).value, "3");
  assert.equal(renderAction("saves", snapshot).value, "1");
  assert.equal(renderAction("shots", snapshot).value, "5");
  assert.equal(renderAction("demos", snapshot).value, "4");
  assert.equal(renderAction("flip-resets", snapshot).value, "2");
  assert.equal(renderAction("touches", snapshot).value, "9");
  assert.equal(renderAction("player-score", snapshot).value, "450");
});

test("plugin state updates records and mmr summary", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rocketstats-tests-"));
  const file = join(dir, "state.json");
  try {
    const state = new PluginState({
      statePath: file,
      identityGraceWindowMs: 10_000,
      reconnectWindowMs: 30_000
    });
    await state.initialize();
    state.resolveIdentity({
      accountId: "acc-records",
      liveDisplayName: "RecordPlayer",
      observedAt: 500
    });
    await state.updateAccountFromSnapshot({
      matchId: "m-rec",
      isInMatch: true,
      isOvertime: false,
      isPaused: false,
      gameClockSeconds: 10,
      blueScore: 1,
      orangeScore: 0,
      localPlayer: {
        accountId: "acc-records",
        name: "RecordPlayer",
        team: "blue",
        score: 550,
        goals: 3,
        assists: 2,
        saves: 4,
        shots: 6,
        demos: 1,
        touches: 30,
        flipResets: 1,
        boost: 67,
        speedKph: 120,
        supersonic: true,
        pingMs: 23,
        hasBallPossession: true
      },
      lastGoal: {
        scorer: "RecordPlayer",
        team: "blue",
        speedKph: 111,
        occurredAt: 505
      },
      isSearching: false,
      searchingPlaylists: [],
      searchElapsedSeconds: 0,
      banRemainingSeconds: 90,
      leftEarly: false,
      rankedReconnectResultApplied: false,
      updatedAt: 510
    });
    await state.setPlaylistRank("ranked_2v2", 1250, "Champion I");
    const summary = state.getMmrSummary("ranked_2v2");
    assert.equal(summary.value, "1250");
    assert.equal(summary.rankLabel, "Champion II");
    assert.equal(summary.division, 3);
    const restored = new PluginState({
      statePath: file,
      identityGraceWindowMs: 10_000,
      reconnectWindowMs: 30_000
    });
    await restored.initialize();
    assert.deepEqual(restored.getMmrSummary("ranked_2v2"), {
      value: "1250", rankLabel: "Champion II", division: 3
    });
    assert.deepEqual(restored.getMmrSummaries().ranked_2v2, restored.getMmrSummary("ranked_2v2"));
    assert.equal(state.getRecordsLabel(), "W0 L0");
    const snapshot = state.getStateSnapshot();
    assert.equal(snapshot.accounts["acc-records"].records.maxGoalsPerMatch, 3);
    assert.equal(snapshot.accounts["acc-records"].records.fastestGoalKph, 111);
    assert.ok(snapshot.accounts["acc-records"].banCountdownUntil > 510);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("control client sends hud command payload", async () => {
  let received = "";
  const server = createServer((socket) => {
    socket.on("data", (chunk) => {
      received += chunk.toString("utf8");
    });
    socket.on("end", () => {
      socket.end();
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to allocate TCP port");
  }
  const client = new RlControlClient({
    host: "127.0.0.1",
    port: address.port,
    timeoutMs: 500
  });
  await client.toggleHud();
  assert.equal(received.includes("\"command\":\"toggle_hud\""), true);
  server.close();
});

test("control client surfaces an unavailable HUD bridge", async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to allocate TCP port");
  }
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });

  const client = new RlControlClient({
    host: "127.0.0.1",
    port: address.port,
    timeoutMs: 500
  });
  await assert.rejects(client.toggleHud());
});

test("action settings are validated and restricted to three banner stats", () => {
  const settings = normalizeActionSettings({
    locale: "de",
    playlist: "ranked_3v3",
    playlistMode: "manual",
    animateEvents: false,
    eventBannerStats: ["goals", "demos", "ping", "not-a-stat"]
  });
  assert.equal(settings.locale, "de");
  assert.equal(settings.playlist, "ranked_3v3");
  assert.equal(settings.animateEvents, false);
  assert.deepEqual(settings.eventBannerStats, ["goals", "demos", "ping"]);
  assert.deepEqual(normalizeActionSettings({ locale: "xx", eventBannerStats: [] }), {});
});

test("render bus applies per-action language, event and playlist settings", () => {
  const bus = new RenderBus();
  const titles = [];
  const target = { setTitle: (value) => { titles.push(value); } };

  bus.bind("event-banner", target, {
    locale: "de",
    eventBannerStats: ["goals", "ping"],
    animateEvents: false
  });
  bus.publish({
    action: "event-banner",
    title: "▶ DEMO",
    value: "Enemy down",
    footer: "G2 A1",
    accent: "#3EDB8D",
    eventType: "demo",
    eventStatValues: {
      goals: "G2",
      assists: "A1",
      saves: "S0",
      shots: "Sh4",
      demos: "D1",
      score: "Sc300",
      ping: "P25"
    }
  });
  assert.equal(titles[0], "DEMO\nEnemy down\nG2 P25");

  const mmrTarget = { setTitle: (value) => { titles.push(value); } };
  bus.bind("mmr", mmrTarget, { playlist: "ranked_3v3", playlistMode: "manual" });
  bus.publish({
    action: "mmr",
    title: "MMR",
    value: "1200",
    footer: "Diamond I",
    accent: "#2F77FF",
    mmrByPlaylist: {
      ranked_2v2: { value: "1200", rankLabel: "Diamond I" },
      ranked_3v3: { value: "1420", rankLabel: "Champion I" }
    }
  });
  assert.equal(titles[1], "MMR 3v3\n1420\nChampion I");
});

test("render bus pulses a new goal event once and then settles", async () => {
  const bus = new RenderBus();
  const titles = [];
  const target = { setTitle: (value) => { titles.push(value); } };
  const model = {
    action: "event-banner",
    title: "LAST GOAL",
    titleKey: "lastGoal",
    value: "Player",
    footer: "120 km/h",
    accent: "#2F77FF",
    eventType: "goal",
    eventId: 1234,
    animateEvents: true
  };
  bus.bind("event-banner", target, { animateEvents: true });
  bus.publish(model);
  assert.match(titles[0], /^▶ LAST GOAL/);

  bus.publish(model);
  assert.equal(titles.length, 1, "the same event should not restart its animation");

  await new Promise((resolve) => setTimeout(resolve, 1_600));
  assert.equal(titles.at(-1), "LAST GOAL\nPlayer\n120 km/h");
  assert.ok(titles.length > 1, "the event title should update during the pulse");

  bus.publish(model);
  assert.equal(titles.at(-1), "LAST GOAL\nPlayer\n120 km/h");
  assert.equal(titles.length, 8, "a completed event should not animate again");
  bus.unbind("event-banner", target);
});

test("disabling banner animation stops an active pulse", async () => {
  const bus = new RenderBus();
  const titles = [];
  const target = { setTitle: (value) => { titles.push(value); } };
  const model = {
    action: "event-banner",
    title: "DEMO",
    value: "Enemy",
    footer: "",
    accent: "#3EDB8D",
    eventType: "demo",
    eventId: 55,
    animateEvents: true
  };
  bus.bind("event-banner", target, { animateEvents: true });
  bus.publish(model);
  assert.match(titles[0], /^▶ DEMO/);

  bus.bind("event-banner", target, { animateEvents: false });
  bus.publish(model);
  assert.equal(titles.at(-1), "DEMO\nEnemy");
  const titleCount = titles.length;
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(titles.length, titleCount);
  bus.unbind("event-banner", target);
});
