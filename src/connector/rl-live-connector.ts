import { Socket } from "node:net";
import { StringDecoder } from "node:string_decoder";
import { LiveMatchSnapshot, LivePlayerStats, QueueType, Team } from "../core/types.js";
import { OfficialStatsNormalizer } from "./official-stats-normalizer.js";

const MAX_READ_BUFFER_LENGTH = 1024 * 1024;

export interface RlLiveConnectorOptions {
  host: string;
  port: number;
  reconnectDelayMs: number;
}

type TeamWire = "blue" | "orange";

interface WirePayload {
  matchId?: string;
  inMatch?: boolean;
  overtime?: boolean;
  paused?: boolean;
  clockSeconds?: number;
  score?: {
    blue?: number;
    orange?: number;
  };
  myTeam?: TeamWire;
  localPlayer?: {
    accountId?: string;
    name?: string;
    team?: TeamWire;
    score?: number;
    goals?: number;
    assists?: number;
    saves?: number;
    shots?: number;
    demos?: number;
    touches?: number;
    flipResets?: number;
    boost?: number;
    speedKph?: number;
    supersonic?: boolean;
    pingMs?: number;
    hasBallPossession?: boolean;
  };
  lastGoal?: {
    scorer?: string;
    speedKph?: number;
    team?: TeamWire;
    occurredAt?: number;
  };
  updatedAt?: number;
  queueType?: QueueType;
  matchResult?: "win" | "loss";
  leftEarly?: boolean;
  rankedReconnectResultApplied?: boolean;
  matchmaking?: {
    isSearching?: boolean;
    playlists?: string[];
    elapsedSeconds?: number;
    banRemainingSeconds?: number;
  };
  latestEvent?: {
    type?: "goal" | "demo" | "save" | "crossbar" | "overtime" | "result";
    label?: string;
    value?: string;
    occurredAt?: number;
  };
}

type Status = "connecting" | "connected" | "disconnected";
type SnapshotHandler = (snapshot: LiveMatchSnapshot) => void;
type ErrorHandler = (error: Error) => void;
type StatusHandler = (status: Status) => void;

export class RlLiveConnector {
  private socket: Socket | undefined;
  private reconnectTimer: NodeJS.Timeout | undefined;
  private readBuffer = "";
  private decoder = new StringDecoder("utf8");
  private readonly officialNormalizer = new OfficialStatsNormalizer();
  private destroyed = false;
  private started = false;

  private readonly snapshotHandlers: SnapshotHandler[] = [];
  private readonly errorHandlers: ErrorHandler[] = [];
  private readonly statusHandlers: StatusHandler[] = [];

  constructor(private readonly options: RlLiveConnectorOptions) {}

  onSnapshot(handler: SnapshotHandler): void {
    this.snapshotHandlers.push(handler);
  }

  onError(handler: ErrorHandler): void {
    this.errorHandlers.push(handler);
  }

  onStatus(handler: StatusHandler): void {
    this.statusHandlers.push(handler);
  }

  start(): void {
    if (this.destroyed) {
      throw new Error("Connector was stopped and cannot be restarted.");
    }
    this.started = true;
    this.connect();
  }

  reconfigurePort(port: number): void {
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new RangeError("RL Stats API port must be an integer between 1 and 65535.");
    }
    if (this.options.port === port) {
      return;
    }
    this.options.port = port;
    if (!this.started) {
      return;
    }
    if (this.socket) {
      this.socket.destroy();
    } else {
      this.connect();
    }
  }

  configureManualPlayerName(name: string | undefined): void {
    this.officialNormalizer.configureManualPlayerName(name);
  }

  configureVerifiedAccountId(accountId: string | undefined): void {
    this.officialNormalizer.configureVerifiedAccountId(accountId);
  }

  stop(): void {
    this.destroyed = true;
    this.started = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.socket?.destroy();
    this.socket = undefined;
    this.emitStatus("disconnected");
  }

  private connect(): void {
    this.emitStatus("connecting");
    const socket = new Socket();
    this.socket = socket;
    this.readBuffer = "";
    this.decoder = new StringDecoder("utf8");

    socket.on("connect", () => {
      this.officialNormalizer.reset();
      this.emitStatus("connected");
    });

    socket.on("data", (chunk: Buffer) => {
      this.onData(chunk);
    });

    socket.on("error", (err: Error) => {
      this.emitError(err);
    });

    socket.on("close", () => {
      this.emitStatus("disconnected");
      if (!this.destroyed) {
        this.reconnectTimer = setTimeout(() => this.connect(), this.options.reconnectDelayMs);
      }
    });

    socket.connect(this.options.port, this.options.host);
  }

  private emitSnapshot(snapshot: LiveMatchSnapshot): void {
    for (const handler of this.snapshotHandlers) {
      handler(snapshot);
    }
  }

  private emitError(error: Error): void {
    for (const handler of this.errorHandlers) {
      handler(error);
    }
  }

  private emitStatus(status: Status): void {
    for (const handler of this.statusHandlers) {
      handler(status);
    }
  }

  private onData(chunk: Buffer): void {
    this.readBuffer += this.decoder.write(chunk);
    if (this.readBuffer.length > MAX_READ_BUFFER_LENGTH) {
      this.readBuffer = "";
      this.emitError(new Error("RL Stats API payload exceeded the 1 MiB buffer limit."));
      return;
    }

    while (this.readBuffer.length > 0) {
      const firstNonWhitespace = this.readBuffer.search(/\S/);
      if (firstNonWhitespace < 0) {
        this.readBuffer = "";
        return;
      }
      if (firstNonWhitespace > 0) {
        this.readBuffer = this.readBuffer.slice(firstNonWhitespace);
      }
      if (this.readBuffer[0] !== "{") {
        const nextObject = this.readBuffer.indexOf("{");
        if (nextObject < 0) {
          if (this.readBuffer.length > MAX_READ_BUFFER_LENGTH / 2) {
            this.emitError(new Error("Unable to resynchronize with RL Stats API JSON stream."));
            this.readBuffer = "";
          }
          return;
        }
        this.emitError(new Error("Discarded invalid data before an RL Stats API JSON object."));
        this.readBuffer = this.readBuffer.slice(nextObject);
      }

      const frameEnd = findJsonObjectEnd(this.readBuffer);
      if (frameEnd === undefined) {
        return;
      }

      const json = this.readBuffer.slice(0, frameEnd);
      this.readBuffer = this.readBuffer.slice(frameEnd);
      this.processJson(json);
    }
  }

  private processJson(json: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      this.emitError(new Error("Invalid JSON object received from RL Stats API."));
      return;
    }

    let snapshot: LiveMatchSnapshot | undefined;
    try {
      snapshot = this.normalizePayload(parsed) ?? this.officialNormalizer.normalize(parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.emitError(new Error(`Invalid RL Stats API event data: ${message}`));
      return;
    }
    if (!snapshot) {
      return;
    }

    this.emitSnapshot(snapshot);
  }

  private normalizePayload(parsed: unknown): LiveMatchSnapshot | undefined {
    if (!parsed || typeof parsed !== "object") {
      return undefined;
    }
    const candidate = parsed as Record<string, unknown>;
    if (![
      "matchId",
      "inMatch",
      "overtime",
      "paused",
      "clockSeconds",
      "score",
      "myTeam",
      "localPlayer",
      "lastGoal",
      "matchmaking"
    ].some((key) => key in candidate)) {
      return undefined;
    }
    const wire = parsed as WirePayload;
    const snapshot: LiveMatchSnapshot = {
      matchId: wire.matchId ?? "unknown",
      isInMatch: Boolean(wire.inMatch),
      isOvertime: Boolean(wire.overtime),
      isPaused: Boolean(wire.paused),
      gameClockSeconds: this.toNonNegativeNumber(wire.clockSeconds, 0),
      blueScore: this.toNonNegativeNumber(wire.score?.blue, 0),
      orangeScore: this.toNonNegativeNumber(wire.score?.orange, 0),
      isSearching: Boolean(wire.matchmaking?.isSearching),
      searchingPlaylists: Array.isArray(wire.matchmaking?.playlists)
        ? wire.matchmaking.playlists.filter((item): item is string => typeof item === "string")
        : [],
      searchElapsedSeconds: this.toNonNegativeNumber(wire.matchmaking?.elapsedSeconds, 0),
      banRemainingSeconds: this.toNonNegativeNumber(wire.matchmaking?.banRemainingSeconds, 0),
      leftEarly: Boolean(wire.leftEarly),
      rankedReconnectResultApplied: Boolean(wire.rankedReconnectResultApplied),
      updatedAt: this.toNonNegativeNumber(wire.updatedAt, Date.now())
    };
    if (wire.queueType) {
      snapshot.queueType = wire.queueType;
    }
    if (wire.matchResult === "win" || wire.matchResult === "loss") {
      snapshot.result = wire.matchResult;
    }

    const myTeam = this.toTeam(wire.myTeam);
    if (myTeam) {
      snapshot.myTeam = myTeam;
    }

    if (wire.localPlayer?.name && wire.localPlayer.team) {
      snapshot.localPlayer = this.normalizePlayer(wire.localPlayer);
      snapshot.identityObserved = true;
    }
    snapshot.gameStateLoaded = snapshot.isInMatch;

    if (wire.lastGoal?.scorer && wire.lastGoal.team) {
      snapshot.lastGoal = {
        scorer: wire.lastGoal.scorer,
        team: wire.lastGoal.team,
        occurredAt: this.toNonNegativeNumber(wire.lastGoal.occurredAt, snapshot.updatedAt)
      };
      if (typeof wire.lastGoal.speedKph === "number") {
        snapshot.lastGoal.speedKph = wire.lastGoal.speedKph;
      }
    }
    if (wire.latestEvent?.type) {
      snapshot.latestEvent = {
        type: wire.latestEvent.type,
        occurredAt: this.toNonNegativeNumber(wire.latestEvent.occurredAt, snapshot.updatedAt)
      };
      if (wire.latestEvent.label) {
        snapshot.latestEvent.label = wire.latestEvent.label;
      }
      if (wire.latestEvent.value) {
        snapshot.latestEvent.value = wire.latestEvent.value;
      }
    }

    return snapshot;
  }

  private normalizePlayer(player: NonNullable<WirePayload["localPlayer"]>): LivePlayerStats {
    const team = this.toTeam(player.team) ?? "blue";
    const normalized: LivePlayerStats = {
      name: player.name ?? "Unknown",
      team,
      score: this.toNonNegativeNumber(player.score, 0),
      goals: this.toNonNegativeNumber(player.goals, 0),
      assists: this.toNonNegativeNumber(player.assists, 0),
      saves: this.toNonNegativeNumber(player.saves, 0),
      shots: this.toNonNegativeNumber(player.shots, 0),
      demos: this.toNonNegativeNumber(player.demos, 0),
      touches: this.toNonNegativeNumber(player.touches, 0),
      flipResets: this.toNonNegativeNumber(player.flipResets, 0),
      boost: this.clamp(this.toNonNegativeNumber(player.boost, 0), 0, 100),
      speedKph: this.toNonNegativeNumber(player.speedKph, 0),
      supersonic: Boolean(player.supersonic),
      hasBallPossession: Boolean(player.hasBallPossession)
    };
    if (player.accountId) {
      normalized.accountId = player.accountId;
    }
    if (typeof player.pingMs === "number") {
      normalized.pingMs = player.pingMs;
    }
    return normalized;
  }

  private toTeam(value?: TeamWire): Team | undefined {
    if (value === "blue" || value === "orange") {
      return value;
    }
    return undefined;
  }

  private toNonNegativeNumber(value: unknown, fallback: number): number {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return fallback;
    }
    return value < 0 ? 0 : value;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}

function findJsonObjectEnd(buffer: string): number | undefined {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < buffer.length; index += 1) {
    const character = buffer[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === "\"") {
        inString = false;
      }
      continue;
    }

    if (character === "\"") {
      inString = true;
    } else if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return index + 1;
      }
    }
  }
  return undefined;
}
