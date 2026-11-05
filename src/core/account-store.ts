import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { DEFAULT_RECORDS, PersistedState } from "./types.js";

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
    normalized.matches = input.matches ?? [];
    normalized.pendingReconnect = input.pendingReconnect ?? [];

    for (const [accountId, account] of Object.entries(input.accounts ?? {})) {
      normalized.accounts[accountId] = {
        ...account,
        rankByPlaylist: account.rankByPlaylist ?? [],
        streak: account.streak ?? { type: "none", count: 0 },
        records: {
          ...DEFAULT_RECORDS,
          ...(account.records ?? {})
        },
        updatedAt: account.updatedAt ?? Date.now()
      };
    }

    return normalized;
  }
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT";
}
