import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { isSelectablePlaylist } from "./playlists.js";
import { DEFAULT_RECORDS, MatchRecord, PersistedState, QueueType, RankRecord } from "./types.js";

const INITIAL_STATE: PersistedState = {
  schemaVersion: 1,
  accounts: {},
  matches: [],
  pendingReconnect: []
};

export class AccountStore {
  private saveQueue: Promise<void> = Promise.resolve();

  constructor(private readonly statePath: string) {}

  async load(): Promise<PersistedState> {
    if (!existsSync(this.statePath)) {
      return structuredClone(INITIAL_STATE);
    }

    const content = await readFile(this.statePath, "utf8");
    const parsed = JSON.parse(content) as PersistedState;
    return this.normalize(parsed);
  }

  async save(state: PersistedState): Promise<void> {
    const snapshot = structuredClone(state);
    const operation = this.saveQueue.then(() => this.writeSnapshot(snapshot));
    this.saveQueue = operation.then(
      () => undefined,
      () => undefined
    );
    await operation;
  }

  private async writeSnapshot(state: PersistedState): Promise<void> {
    await mkdir(dirname(this.statePath), { recursive: true });
    const tempPath = `${this.statePath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await writeFile(tempPath, JSON.stringify(state, null, 2), "utf8");
      await rename(tempPath, this.statePath);
    } catch (error) {
      try {
        await unlink(tempPath);
      } catch (cleanupError) {
        if (!isMissingFileError(cleanupError)) {
          throw new AggregateError(
            [error, cleanupError],
            `Failed to persist state and remove temporary file '${tempPath}'.`
          );
        }
      }
      throw error;
    }
  }

  private normalize(input: PersistedState): PersistedState {
    const normalized = structuredClone(INITIAL_STATE);
    if (input.activeAccountId) {
      normalized.activeAccountId = input.activeAccountId;
    }
    if (input.statsScope === "all" || input.statsScope === "mode") {
      normalized.statsScope = input.statsScope;
    }
    if (input.statsPeriod === "session" || input.statsPeriod === "cleared" || input.statsPeriod === "alltime") {
      normalized.statsPeriod = input.statsPeriod;
    }
    if (typeof input.sessionStartedAt === "number" && Number.isFinite(input.sessionStartedAt)) {
      normalized.sessionStartedAt = input.sessionStartedAt;
    }
    normalized.matches = input.matches ?? [];
    normalized.pendingReconnect = input.pendingReconnect ?? [];

    for (const [accountId, account] of Object.entries(input.accounts ?? {})) {
      const normalizedAccount = {
        ...account,
        rankByPlaylist: (account.rankByPlaylist ?? []).map((rank) => ({
          ...rank,
          ...(Array.isArray(rank.history)
            ? {
                history: rank.history.filter(
                  (point) => Number.isFinite(point?.at) && Number.isFinite(point?.mmr)
                )
              }
            : {})
        })),
        streak: account.streak ?? { type: "none", count: 0 },
        records: {
          ...DEFAULT_RECORDS,
          ...(account.records ?? {})
        },
        updatedAt: account.updatedAt ?? Date.now()
      };
      if (normalizedAccount.lastMmrPlaylist === "unknown") {
        const recovered = recoverLastKnownPlaylist(
          accountId,
          normalizedAccount.rankByPlaylist,
          normalized.matches
        );
        if (recovered !== undefined) {
          normalizedAccount.lastMmrPlaylist = recovered;
        }
      }
      normalized.accounts[accountId] = normalizedAccount;
    }

    return normalized;
  }
}

function recoverLastKnownPlaylist(
  accountId: string,
  ranks: RankRecord[],
  matches: MatchRecord[]
): QueueType | undefined {
  let latestPlaylist: QueueType | undefined;
  let latestAt = -Infinity;
  const observed = (playlist: QueueType, at: number): void => {
    if (Number.isFinite(at) && at > latestAt) {
      latestAt = at;
      latestPlaylist = playlist;
    }
  };

  for (const match of matches) {
    if (match.accountId === accountId && isSelectablePlaylist(match.queueType)) {
      observed(match.queueType, match.endedAt ?? match.startedAt);
    }
  }

  const modesWithMmr = new Set<QueueType>();
  for (const rank of ranks) {
    if (!isSelectablePlaylist(rank.playlist) || typeof rank.mmr !== "number" || !Number.isFinite(rank.mmr)) {
      continue;
    }
    modesWithMmr.add(rank.playlist);
    for (const point of Array.isArray(rank.history) ? rank.history : []) {
      observed(rank.playlist, point.at);
    }
  }

  return latestPlaylist ?? (modesWithMmr.size === 1 ? modesWithMmr.values().next().value : undefined);
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT";
}
