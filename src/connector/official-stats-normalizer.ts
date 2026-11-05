import {
  createEmptySnapshot,
  LiveMatchSnapshot,
  LiveGameplayEventType,
  LivePlayerStats,
  MatchOutcome,
  Team
} from "../core/types.js";
import { queueTypeFromPlaylistId } from "../core/playlists.js";

type JsonRecord = Record<string, unknown>;

export class OfficialStatsNormalizer {
  private snapshot: LiveMatchSnapshot = createEmptySnapshot();
  private matchFinished = false;
  private manualPlayerName: string | undefined;
  private verifiedAccountId: string | undefined;

  configureManualPlayerName(name: string | undefined): void {
    const normalized = name?.trim();
    this.manualPlayerName = normalized ? normalized.toLowerCase() : undefined;
  }

  configureVerifiedAccountId(accountId: string | undefined): void {
    if (this.verifiedAccountId !== accountId) {
      delete this.snapshot.localPlayer;
      delete this.snapshot.myTeam;
    }
    this.verifiedAccountId = accountId;
  }

  reset(): void {
    this.snapshot = createEmptySnapshot();
    this.matchFinished = false;
  }

  normalize(input: unknown, now = Date.now()): LiveMatchSnapshot | undefined {
    if (!isRecord(input)) {
      return undefined;
    }

    const eventName = stringValue(input.Event) ?? stringValue(input.event);
    if (!eventName) {
      return undefined;
    }

    const data = this.readData(input.Data ?? input.data);
    if (!data) {
      return undefined;
    }

    const timestamp = parseTimestamp(input.Timestamp ?? input.timestamp) ?? now;
    const matchId = stringValue(data.MatchGuid) ?? stringValue(input.MatchGuid) ??
      stringValue(input.matchGuid) ?? this.snapshot.matchId;

    if (matchId !== this.snapshot.matchId && matchId !== "unknown") {
      this.snapshot = {
        ...createEmptySnapshot(),
        matchId,
        updatedAt: timestamp
      };
      this.matchFinished = false;
    } else {
      this.snapshot = { ...this.snapshot, updatedAt: timestamp };
    }
    delete this.snapshot.identityObserved;
    delete this.snapshot.matchCreated;

    switch (eventName) {
      case "UpdateState":
        this.applyUpdateState(data);
        break;
      case "ClockUpdatedSeconds":
        this.snapshot.gameClockSeconds = nonNegativeNumber(data.TimeSeconds, this.snapshot.gameClockSeconds);
        this.snapshot.isOvertime = booleanValue(data.bOvertime, this.snapshot.isOvertime);
        break;
      case "GoalScored":
        this.applyGoal(data, timestamp);
        break;
      case "StatfeedEvent":
        this.applyStatfeed(data, timestamp);
        break;
      case "CrossbarHit":
        this.snapshot.latestEvent = {
          type: "crossbar",
          occurredAt: timestamp
        };
        break;
      case "MatchCreated":
        this.snapshot.matchCreated = true;
        this.beginMatch(true);
        break;
      case "MatchInitialized":
        this.beginMatch(!this.snapshot.isInMatch);
        break;
      case "RoundStarted":
      case "CountdownBegin":
        this.snapshot.isInMatch = true;
        this.snapshot.queueType ??= "unknown";
        break;
      case "MatchPaused":
        this.snapshot.isPaused = true;
        break;
      case "MatchUnpaused":
        this.snapshot.isPaused = false;
        break;
      case "MatchEnded":
        this.matchFinished = true;
        this.snapshot.rankedReconnectResultApplied =
          this.snapshot.leftEarly || this.snapshot.rankedReconnectResultApplied;
        this.snapshot.leftEarly = false;
        this.snapshot.isInMatch = false;
        this.applyMatchResult(data);
        this.snapshot.latestEvent = {
          type: "result",
          occurredAt: timestamp
        };
        break;
      case "MatchDestroyed":
        this.matchFinished = true;
        if (this.snapshot.isInMatch && !this.snapshot.result) {
          this.snapshot.leftEarly = true;
          this.snapshot.queueType ??= "unknown";
        }
        this.snapshot.isInMatch = false;
        break;
      default:
        return undefined;
    }

    return structuredClone(this.snapshot);
  }

  private readData(input: unknown): JsonRecord | undefined {
    if (typeof input === "string") {
      const parsed: unknown = JSON.parse(input);
      return isRecord(parsed) ? parsed : undefined;
    }
    return isRecord(input) ? input : undefined;
  }

  private applyUpdateState(data: JsonRecord): void {
    if (!this.matchFinished) {
      this.snapshot.isInMatch = true;
    }
    this.snapshot.queueType ??= "unknown";

    const game = asRecord(data.Game);
    if (game) {
      this.snapshot.gameStateLoaded = true;
      const playlistId = typeof game.PlaylistId === "number" ? game.PlaylistId : undefined;
      const queueType = queueTypeFromPlaylistId(playlistId);
      if (queueType !== undefined && playlistId !== undefined) {
        this.snapshot.queueType = queueType;
        this.snapshot.playlistId = playlistId;
      }
      const teams = Array.isArray(game.Teams) ? game.Teams : [];
      for (const teamValue of teams) {
        const team = asRecord(teamValue);
        if (!team) {
          continue;
        }
        const teamColor = teamFromNumber(team.TeamNum);
        if (teamColor === "blue") {
          this.snapshot.blueScore = nonNegativeNumber(team.Score, this.snapshot.blueScore);
        } else if (teamColor === "orange") {
          this.snapshot.orangeScore = nonNegativeNumber(team.Score, this.snapshot.orangeScore);
        }
      }
      this.snapshot.isOvertime = booleanValue(
        game.bOvertime ?? game.IsOvertime,
        this.snapshot.isOvertime
      );
      if (typeof game.TimeSeconds === "number") {
        this.snapshot.gameClockSeconds = nonNegativeNumber(game.TimeSeconds, this.snapshot.gameClockSeconds);
      }
    }

    const players = (Array.isArray(data.Players) ? data.Players : [])
      .map(asRecord)
      .filter((player): player is JsonRecord => player !== undefined);
    delete this.snapshot.localPlayer;
    delete this.snapshot.myTeam;
    const explicitlyLocalPlayers = players.filter(isLocalPlayer);
    if (explicitlyLocalPlayers.length === 1) {
      const explicitlyLocal = explicitlyLocalPlayers[0];
      if (!explicitlyLocal) {
        return;
      }
      const localPlayer = normalizePlayer(explicitlyLocal);
      if (!localPlayer) {
        return;
      }
      this.snapshot.localPlayer = localPlayer;
      this.snapshot.myTeam = localPlayer.team;
      this.snapshot.identityObserved = true;
      return;
    }

    if (explicitlyLocalPlayers.length > 0) {
      return;
    }

    const matchingPlayers = this.verifiedAccountId
      ? players.filter((player) => stringValue(player.PrimaryId) === this.verifiedAccountId)
      : players.filter((player) =>
        this.manualPlayerName !== undefined &&
        stringValue(player.Name)?.trim().toLowerCase() === this.manualPlayerName
      );
    if (matchingPlayers.length !== 1) {
      return;
    }

    const matchingPlayer = matchingPlayers[0];
    if (!matchingPlayer) {
      return;
    }
    const localPlayer = normalizePlayer(matchingPlayer);
    if (localPlayer) {
      if (!this.verifiedAccountId) {
        delete localPlayer.accountId;
        localPlayer.matchedByManualName = true;
      }
      this.snapshot.localPlayer = localPlayer;
      this.snapshot.myTeam = localPlayer.team;
      this.snapshot.identityObserved = true;
    }
  }

  private beginMatch(reset: boolean): void {
    this.matchFinished = false;
    if (reset && !this.snapshot.leftEarly) {
      this.snapshot.queueType = "unknown";
      delete this.snapshot.playlistId;
      delete this.snapshot.gameStateLoaded;
      delete this.snapshot.localPlayer;
      delete this.snapshot.myTeam;
    }
    this.snapshot.rankedReconnectResultApplied =
      this.snapshot.leftEarly || this.snapshot.rankedReconnectResultApplied;
    this.snapshot.leftEarly = false;
    this.snapshot.isInMatch = true;
    this.snapshot.queueType ??= "unknown";
    delete this.snapshot.result;
  }

  private applyGoal(data: JsonRecord, timestamp: number): void {
    const scorer = asRecord(data.Scorer);
    const team = scorer ? teamFromNumber(scorer.TeamNum) : undefined;
    if (!scorer || !team) {
      return;
    }

    const name = stringValue(scorer.Name);
    if (!name) {
      return;
    }

    const goalSpeed = numberValue(data.GoalSpeed);
    this.snapshot.lastGoal = {
      scorer: name,
      team,
      occurredAt: timestamp,
      ...(goalSpeed === undefined ? {} : { speedKph: goalSpeed })
    };
    this.snapshot.latestEvent = {
      type: "goal",
      label: name,
      ...(goalSpeed === undefined ? {} : { value: `${Math.round(goalSpeed)} km/h` }),
      occurredAt: timestamp
    };
  }

  private applyStatfeed(data: JsonRecord, timestamp: number): void {
    const statName = (stringValue(data.EventName) ?? "").toLowerCase();
    const type = (stringValue(data.Type) ?? "").toLowerCase();
    let eventType: Extract<LiveGameplayEventType, "demo" | "save"> | undefined;
    if (statName.includes("demolish") || type.includes("demolition")) {
      eventType = "demo";
    } else if (statName.includes("save")) {
      eventType = "save";
    }
    if (!eventType) {
      return;
    }

    const player = asRecord(data.MainTarget);
    const label = player ? stringValue(player.Name) : undefined;
    this.snapshot.latestEvent = {
      type: eventType,
      ...(label ? { label } : {}),
      occurredAt: timestamp
    };
  }

  private applyMatchResult(data: JsonRecord): void {
    const winnerTeam = teamFromNumber(data.WinnerTeamNum);
    const localTeam = this.snapshot.myTeam;
    if (!winnerTeam || !localTeam) {
      delete this.snapshot.result;
      return;
    }
    const outcome: MatchOutcome = winnerTeam === localTeam ? "win" : "loss";
    if (outcome === "win" || outcome === "loss") {
      this.snapshot.result = outcome;
    }
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): JsonRecord | undefined {
  return isRecord(value) ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function nonNegativeNumber(value: unknown, fallback: number): number {
  const parsed = numberValue(value);
  return parsed === undefined ? fallback : Math.max(0, parsed);
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function parseTimestamp(value: unknown): number | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function teamFromNumber(value: unknown): Team | undefined {
  if (value === 0) {
    return "blue";
  }
  if (value === 1) {
    return "orange";
  }
  return undefined;
}

function isLocalPlayer(player: JsonRecord): boolean {
  return player.IsLocalPlayer === true ||
    player.bIsLocalPlayer === true ||
    player.IsLocal === true ||
    player.bLocal === true;
}

function normalizePlayer(player: JsonRecord): LivePlayerStats | undefined {
  const name = stringValue(player.Name);
  const team = teamFromNumber(player.TeamNum);
  if (!name || !team) {
    return undefined;
  }

  const normalized: LivePlayerStats = {
    name,
    team,
    score: nonNegativeNumber(player.Score, 0),
    goals: nonNegativeNumber(player.Goals, 0),
    assists: nonNegativeNumber(player.Assists, 0),
    saves: nonNegativeNumber(player.Saves, 0),
    shots: nonNegativeNumber(player.Shots, 0),
    demos: nonNegativeNumber(player.Demos, 0),
    touches: nonNegativeNumber(player.Touches, 0),
    flipResets: nonNegativeNumber(player.FlipResets, 0),
    boost: Math.min(100, nonNegativeNumber(player.Boost, 0)),
    speedKph: nonNegativeNumber(player.Speed, 0),
    supersonic: player.bIsSuperSonic === true || player.Supersonic === true,
    hasBallPossession: player.HasBallPossession === true
  };
  const accountId = stringValue(player.PrimaryId);
  if (accountId) {
    normalized.accountId = accountId;
  }
  const ping = numberValue(player.Ping);
  if (ping !== undefined) {
    normalized.pingMs = ping;
  }
  return normalized;
}
