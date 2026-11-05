import { watchFile, unwatchFile, type Stats } from "node:fs";
import { open, stat, type FileHandle } from "node:fs/promises";
import { StringDecoder } from "node:string_decoder";
import { queueTypeFromPlaylistId } from "../core/playlists.js";
import { QueueType } from "../core/types.js";

export interface RocketLeagueLogQueue {
  queueType: QueueType;
  mmr?: number;
  matchId?: string;
}

interface PendingQueue {
  mmr?: number;
  playlistCount?: number;
  partyMemberCount?: number;
}

interface LogIdentity {
  accountId: string | undefined;
  invalid: boolean;
}

export function parsePrimaryAccountIdentity(line: string): LogIdentity | undefined {
  if (!line.includes("Party: HandleLocalPlayerLoginStatusChanged")) {
    return undefined;
  }
  if (!/\bIsPrimary=(?:True|1)\b/i.test(line)) {
    return undefined;
  }
  const status = line.match(/\bLoginStatus=([A-Za-z_]+)/i)?.[1];
  if (!status) {
    return undefined;
  }
  if (status.toLowerCase() !== "ls_loggedin") {
    return { accountId: undefined, invalid: false };
  }
  const accountId = line.match(/\bPlayerID=\(?([A-Za-z][A-Za-z0-9_]*\|[^|\s,)]+\|\d+)\)?/i)?.[1];
  const identifier = accountId?.split("|")[1];
  if (!accountId || /^unknown\|/i.test(accountId) || !identifier || /^0+$/.test(identifier)) {
    return { accountId: undefined, invalid: true };
  }
  return { accountId, invalid: false };
}

export class RocketLeagueLogParser {
  private pendingQueue: PendingQueue | undefined;
  private reservedQueue: RocketLeagueLogQueue | undefined;
  private serverMapLoaded = false;

  consumeLine(line: string): RocketLeagueLogQueue | undefined {
    if (line.includes("OnlineGameMatchmaking_X::RecordStart")) {
      this.pendingQueue = {};
      this.reservedQueue = undefined;
      this.serverMapLoaded = false;
      return undefined;
    }

    if (this.reservedQueue) {
      if (/\bLog: LoadMap:\s*\d{1,3}(?:\.\d{1,3}){3}:\d+\//.test(line)) {
        this.serverMapLoaded = true;
      }
      const matchId = this.serverMapLoaded
        ? line.match(/\bScriptLog: MatchGUID:\s*([0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i)?.[1]
        : undefined;
      if (matchId) {
        const queue = { ...this.reservedQueue, matchId };
        this.reservedQueue = undefined;
        this.serverMapLoaded = false;
        return queue;
      }
    }

    if (!this.pendingQueue) {
      return undefined;
    }

    const mmrMatch = line.match(/Pre-divide PartyLeaderMMR:\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)/i);
    if (mmrMatch) {
      const internalMmr = Number(mmrMatch[1]);
      if (Number.isFinite(internalMmr)) {
        this.pendingQueue.mmr = Math.round(internalMmr * 20 + 100);
      }
    }

    const playlistCount = line.match(/PreferredPlaylists\.Length=\((\d+)\)/);
    const partyMemberCount = line.match(/GetOrderedPartyMemberIDs\(\)\.Length=\((\d+)\)/);
    if (playlistCount && partyMemberCount) {
      this.pendingQueue.playlistCount = Number(playlistCount[1]);
      this.pendingQueue.partyMemberCount = Number(partyMemberCount[1]);
    }

    if (!line.includes("Party: HandleServerReserved")) {
      return undefined;
    }

    const playlistMatch = line.match(/\bPlaylist=(\d+)/);
    const queueType = playlistMatch
      ? queueTypeFromPlaylistId(Number(playlistMatch[1]))
      : undefined;
    const pending = this.pendingQueue;
    this.pendingQueue = undefined;

    if (!queueType) {
      return undefined;
    }

    const hasSoloMmr = queueType.startsWith("ranked_") &&
      pending.mmr !== undefined &&
      pending.playlistCount === 1 &&
      pending.partyMemberCount === 1;
    const queue: RocketLeagueLogQueue = {
      queueType,
      ...(hasSoloMmr ? { mmr: pending.mmr } : {})
    };
    this.reservedQueue = queue;
    return queue;
  }

  reset(): void {
    this.pendingQueue = undefined;
    this.reservedQueue = undefined;
    this.serverMapLoaded = false;
  }
}

export class RocketLeagueLogWatcher {
  private readonly parser = new RocketLeagueLogParser();
  private decoder = new StringDecoder("utf8");
  private offset = 0;
  private fileIdentity: string | undefined;
  private anchor: Buffer = Buffer.alloc(0);
  private identityGeneration = 0;
  private incompleteLine = "";
  private initialized = false;
  private started = false;
  private readQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly filePath: string,
    private readonly onQueue: (queue: RocketLeagueLogQueue) => void,
    private readonly onError: (error: Error) => void,
    private readonly intervalMs = 500,
    private readonly onIdentity?: (accountId: string | undefined) => void
  ) {}

  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;
    watchFile(
      this.filePath,
      { interval: this.intervalMs, persistent: false },
      this.handleFileChange
    );

    try {
      const file = await open(this.filePath, "r");
      try {
        const current = await file.stat();
        this.offset = current.size;
        this.fileIdentity = getFileIdentity(current);
        this.anchor = await readAnchor(file, this.offset);
      } finally {
        await file.close();
      }
    } catch (error) {
      if (!hasErrorCode(error, "ENOENT")) {
        this.stop();
        throw error;
      }
    }
    this.initialized = true;
    const initialRead = this.readQueue.then(() => this.readAppendedLines());
    this.readQueue = initialRead;
    try {
      await initialRead;
    } catch (error) {
      this.stop();
      throw error;
    }
  }

  async recoverIdentityAfter(processStartedAt: number): Promise<void> {
    if (!Number.isFinite(processStartedAt)) {
      throw new RangeError("Rocket League process start time must be valid.");
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      let file: FileHandle;
      try {
        file = await open(this.filePath, "r");
      } catch (error) {
        if (hasErrorCode(error, "ENOENT")) {
          return;
        }
        throw error;
      }

      try {
        const current = await file.stat();
        if (current.mtimeMs < processStartedAt || current.size === 0) {
          return;
        }
        const generation = this.identityGeneration;
        const recovered = await readLastPrimaryIdentity(file, current.size);
        const latest = await stat(this.filePath);
        if (
          this.started &&
          generation === this.identityGeneration &&
          getFileIdentity(current) === getFileIdentity(latest) &&
          current.size === latest.size &&
          current.mtimeMs === latest.mtimeMs
        ) {
          if (recovered) {
            this.emitIdentity(recovered);
          }
          return;
        }
      } finally {
        await file.close();
      }
    }
    throw new Error("Could not safely recover the primary account while the game log was changing.");
  }

  stop(): void {
    if (!this.started) {
      return;
    }
    this.started = false;
    this.initialized = false;
    unwatchFile(this.filePath, this.handleFileChange);
  }

  async stopAndDrain(): Promise<void> {
    this.stop();
    await this.readQueue;
  }

  private readonly handleFileChange = (current: Stats, previous: Stats): void => {
    if (
      !this.initialized ||
      (current.size === previous.size &&
        current.mtimeMs === previous.mtimeMs &&
        current.ino === previous.ino)
    ) {
      return;
    }

    this.readQueue = this.readQueue
      .then(() => this.readAppendedLines())
      .catch((error: unknown) => {
        this.onError(toError(error));
      });
  };

  private async readAppendedLines(): Promise<void> {
    if (!this.started) {
      return;
    }

    let file;
    try {
      file = await open(this.filePath, "r");
    } catch (error) {
      if (hasErrorCode(error, "ENOENT")) {
        this.resetFilePosition();
        return;
      }
      throw error;
    }

    try {
      const current = await file.stat();
      const currentIdentity = getFileIdentity(current);
      if (
        (this.fileIdentity !== undefined && currentIdentity !== this.fileIdentity) ||
        current.size < this.offset ||
        (this.offset > 0 && !this.anchor.equals(await readAnchor(file, this.offset)))
      ) {
        this.resetFilePosition();
        this.fileIdentity = currentIdentity;
      } else if (this.fileIdentity === undefined) {
        this.fileIdentity = currentIdentity;
      }

      while (this.offset < current.size) {
        const buffer = Buffer.alloc(Math.min(64 * 1024, current.size - this.offset));
        const { bytesRead } = await file.read(
          buffer,
          0,
          buffer.length,
          this.offset
        );
        if (bytesRead === 0) {
          break;
        }
        this.offset += bytesRead;
        this.consumeText(this.decoder.write(buffer.subarray(0, bytesRead)));
      }
      this.anchor = await readAnchor(file, this.offset);
    } finally {
      await file.close();
    }
  }

  private consumeText(text: string): void {
    const lines = `${this.incompleteLine}${text}`.split(/\r?\n/);
    this.incompleteLine = lines.pop() ?? "";
    for (const line of lines) {
      const identity = parsePrimaryAccountIdentity(line);
      if (identity) {
        this.emitIdentity(identity);
      }
      const queue = this.parser.consumeLine(line);
      if (queue) {
        this.onQueue(queue);
      }
    }
  }

  private resetFilePosition(): void {
    this.offset = 0;
    this.anchor = Buffer.alloc(0);
    this.incompleteLine = "";
    this.parser.reset();
    this.decoder = new StringDecoder("utf8");
    this.identityGeneration += 1;
    this.onIdentity?.(undefined);
  }

  private emitIdentity(identity: LogIdentity): void {
    this.identityGeneration += 1;
    if (identity.invalid) {
      this.onError(new Error("The primary game account could not be read from the login event."));
    }
    this.onIdentity?.(identity.accountId);
  }
}

async function readAnchor(file: FileHandle, offset: number): Promise<Buffer> {
  const length = Math.min(offset, 256);
  const buffer = Buffer.alloc(length);
  const { bytesRead } = await file.read(buffer, 0, length, offset - length);
  return buffer.subarray(0, bytesRead);
}

async function readLastPrimaryIdentity(
  file: FileHandle,
  size: number
): Promise<LogIdentity | undefined> {
  const decoder = new StringDecoder("utf8");
  let offset = 0;
  let incompleteLine = "";
  let latest: LogIdentity | undefined;
  while (offset < size) {
    const buffer = Buffer.alloc(Math.min(64 * 1024, size - offset));
    const { bytesRead } = await file.read(buffer, 0, buffer.length, offset);
    if (bytesRead === 0) {
      break;
    }
    offset += bytesRead;
    const lines = `${incompleteLine}${decoder.write(buffer.subarray(0, bytesRead))}`.split(/\r?\n/);
    incompleteLine = lines.pop() ?? "";
    for (const line of lines) {
      latest = parsePrimaryAccountIdentity(line) ?? latest;
    }
  }
  return latest;
}

function getFileIdentity(file: Stats): string {
  return `${file.dev}:${file.ino}:${file.birthtimeMs}`;
}

function hasErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error &&
    "code" in error &&
    error.code === code;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
