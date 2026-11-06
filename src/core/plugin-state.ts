import { AccountStore } from "./account-store.js";
import { IdentityResolver } from "./identity-resolver.js";
import { StreakEngine } from "./streak-engine.js";
import { estimateRankDetails } from "./rank-estimator.js";
import {
  AccountIdentitySignal,
  AccountStats,
  ActiveAccountIdentity,
  DEFAULT_RECORDS,
  LiveMatchSnapshot,
  MatchRecord,
  MmrHistoryPoint,
  MmrSummary,
  PersistedState,
  QueueType,
  StatsPeriod,
  STATS_PERIODS,
  StatsScope
} from "./types.js";

const MMR_HISTORY_LIMIT = 500;

export interface PluginStateOptions {
  statePath: string;
  identityGraceWindowMs: number;
  reconnectWindowMs: number;
}

export interface MatchResultInput {
  matchId: string;
  queueType: MatchRecord["queueType"];
  outcome: "win" | "loss";
  completedAt: number;
}

export interface MatchPerformanceInput {
  goals: number;
  assists: number;
  saves: number;
  score: number;
  fastestGoalKph?: number;
}

export class PluginState {
  private readonly store: AccountStore;

  private readonly identityResolver: IdentityResolver;

  private readonly streakEngine: StreakEngine;

  private state: PersistedState = {
    schemaVersion: 1,
    accounts: {},
    matches: [],
    pendingReconnect: []
  };

  constructor(private readonly options: PluginStateOptions) {
    this.store = new AccountStore(options.statePath);
    this.identityResolver = new IdentityResolver({
      graceWindowMs: options.identityGraceWindowMs
    });
    this.streakEngine = new StreakEngine(options.reconnectWindowMs);
  }

  async initialize(): Promise<void> {
    this.state = await this.store.load();
  }

  resolveIdentity(signal: AccountIdentitySignal): ActiveAccountIdentity {
    const identity = this.identityResolver.resolve(signal);
    this.state.activeAccountId = identity.accountId;
    const storedDisplayName = signal.liveDisplayName ??
      (identity.source === "manual_fallback" || identity.source === "none"
        ? identity.displayName
        : undefined);
    this.ensureAccount(identity.accountId, storedDisplayName);
    return identity;
  }

  async recordEarlyLeave(matchId: string, queueType: MatchRecord["queueType"], now: number): Promise<void> {
    const account = this.getActiveAccount();
    const match: MatchRecord = {
      matchId,
      accountId: account.accountId,
      queueType,
      startedAt: now,
      outcome: "unknown",
      endedNormally: false,
      wasEarlyLeave: true,
      wasRankedReconnect: false
    };

    const mutation = this.streakEngine.applyEarlyLeave(
      account.streak,
      this.state.matches,
      this.state.pendingReconnect,
      match,
      now
    );
    if (!mutation.changed) {
      return;
    }

    account.streak = mutation.streak;
    account.updatedAt = now;
    this.state.matches = mutation.records;
    this.state.pendingReconnect = mutation.pendingReconnect;
    this.updateStreakRecords(account);
    await this.store.save(this.state);
  }

  async recordMatchResult(input: MatchResultInput): Promise<void> {
    const account = this.getActiveAccount();
    const match: MatchRecord = {
      matchId: input.matchId,
      accountId: account.accountId,
      queueType: input.queueType,
      startedAt: input.completedAt,
      outcome: "unknown",
      endedNormally: true,
      wasEarlyLeave: false,
      wasRankedReconnect: false
    };

    const mutation = this.streakEngine.applyFinalResult(
      account.streak,
      this.state.matches,
      this.state.pendingReconnect,
      match,
      input.outcome,
      input.completedAt
    );
    if (!mutation.changed) {
      return;
    }

    account.streak = mutation.streak;
    account.updatedAt = input.completedAt;
    this.state.matches = mutation.records;
    this.state.pendingReconnect = mutation.pendingReconnect;
    this.updateStreakRecords(account);
    await this.store.save(this.state);
  }

  async updateAccountFromSnapshot(snapshot: LiveMatchSnapshot): Promise<void> {
    const account = this.getActiveAccount();
    let changed = false;

    if (snapshot.localPlayer) {
      const performance: MatchPerformanceInput = {
        goals: snapshot.localPlayer.goals,
        assists: snapshot.localPlayer.assists,
        saves: snapshot.localPlayer.saves,
        score: snapshot.localPlayer.score
      };
      if (snapshot.lastGoal?.speedKph) {
        performance.fastestGoalKph = snapshot.lastGoal.speedKph;
      }
      changed = this.updatePerformanceRecords(account, performance) || changed;
    }

    const nextBanUntil = snapshot.banRemainingSeconds > 0
      ? snapshot.updatedAt + snapshot.banRemainingSeconds * 1000
      : undefined;
    if (nextBanUntil && account.banCountdownUntil !== nextBanUntil) {
      account.banCountdownUntil = nextBanUntil;
      changed = true;
    }
    if (!nextBanUntil && account.banCountdownUntil !== undefined) {
      delete account.banCountdownUntil;
      changed = true;
    }

    if (changed) {
      account.updatedAt = snapshot.updatedAt;
      await this.store.save(this.state);
    }
  }

  getStreakLabel(): string {
    const streak = this.getScopedStreaks().streak;
    if (streak.type === "none") {
      return "W0/L0";
    }
    return streak.type === "win" ? `W${streak.count}` : `L${streak.count}`;
  }

  getStatsScope(): StatsScope {
    return this.state.statsScope ?? "all";
  }

  async setStatsScope(scope: StatsScope): Promise<void> {
    if (this.getStatsScope() === scope) {
      return;
    }
    this.state.statsScope = scope;
    await this.store.save(this.state);
  }

  async toggleStatsScope(): Promise<StatsScope> {
    const next: StatsScope = this.getStatsScope() === "all" ? "mode" : "all";
    await this.setStatsScope(next);
    return next;
  }

  getStatsPeriod(): StatsPeriod {
    return this.state.statsPeriod ?? "cleared";
  }

  async setStatsPeriod(period: StatsPeriod): Promise<void> {
    if (!STATS_PERIODS.includes(period) || this.getStatsPeriod() === period) {
      return;
    }
    this.state.statsPeriod = period;
    await this.store.save(this.state);
  }

  async cycleStatsPeriod(): Promise<StatsPeriod> {
    const index = STATS_PERIODS.indexOf(this.getStatsPeriod());
    const next = STATS_PERIODS[(index + 1) % STATS_PERIODS.length] ?? "cleared";
    await this.setStatsPeriod(next);
    return next;
  }

  /** Start of the current session; undefined until a session was started explicitly. */
  getSessionStartedAt(): number | undefined {
    return this.state.sessionStartedAt;
  }

  /** Counted matches (all accounts) finished since the current session started. */
  getSessionMatchCount(): number {
    const start = this.state.sessionStartedAt ?? 0;
    return this.state.matches.filter((match) =>
      !match.supersededByMatchId &&
      (match.outcome === "win" || match.outcome === "loss") &&
      (match.endedAt ?? match.startedAt) >= start
    ).length;
  }

  async startNewSession(now = Date.now()): Promise<void> {
    this.state.sessionStartedAt = now;
    await this.store.save(this.state);
  }

  private isInStatsPeriod(match: MatchRecord): boolean {
    const period = this.getStatsPeriod();
    if (period === "alltime") {
      return true;
    }
    if (match.excludedFromStats) {
      return false;
    }
    return period !== "session" ||
      (match.endedAt ?? match.startedAt) >= (this.state.sessionStartedAt ?? 0);
  }

  /** The mode used by the "mode" scope: the last loaded playlist of the active account. */
  getStatsMode(): QueueType | undefined {
    return this.hasActiveAccount() ? this.getActiveAccount().lastMmrPlaylist : undefined;
  }

  /**
   * Removes the active account's win/loss history for the current scope: everything,
   * or only the matches of the current mode. MMR and other records stay untouched.
   */
  async resetStats(): Promise<void> {
    const account = this.getActiveAccount();
    const scope = this.getStatsScope();
    const mode = this.getStatsMode();
    if (scope === "mode" && mode === undefined) {
      return;
    }
    this.state.matches = this.state.matches.map((match) =>
      match.accountId === account.accountId &&
      (scope === "all" || match.queueType === mode)
        ? { ...match, excludedFromStats: true }
        : match
    );
    this.updateStreakRecords(account);
    account.updatedAt = Date.now();
    await this.store.save(this.state);
  }

  private getScopedStreaks(): ReturnType<PluginState["computeStreaks"]> {
    const account = this.getActiveAccount();
    if (this.getStatsScope() === "all") {
      if (this.getStatsPeriod() !== "cleared") {
        return this.computeStreaks(account.accountId, undefined, true);
      }
      return {
        streak: account.streak,
        longestWinStreak: account.records.longestWinStreak,
        longestLossStreak: account.records.longestLossStreak
      };
    }
    const mode = account.lastMmrPlaylist;
    return mode === undefined
      ? { streak: { type: "none", count: 0 }, longestWinStreak: 0, longestLossStreak: 0 }
      : this.computeStreaks(account.accountId, mode, true);
  }

  getMmrSummary(playlist?: string): MmrSummary {
    const account = this.getActiveAccount();
    const selected = playlist ?? account.lastMmrPlaylist ?? "unknown";
    const rank = account.rankByPlaylist.find((entry) => entry.playlist === selected);
    if (rank?.mmr === undefined) {
      return { value: "---", rankLabel: "" };
    }
    return this.summarizeRank(rank.playlist, rank.mmr);
  }

  getMmrSummaries(): Record<string, MmrSummary> {
    const account = this.getActiveAccount();
    return Object.fromEntries(
      account.rankByPlaylist.map((rank) => [
        rank.playlist,
        rank.mmr === undefined
          ? { value: "---", rankLabel: "" }
          : this.summarizeRank(rank.playlist, rank.mmr)
      ])
    );
  }

  private summarizeRank(playlist: string, mmr: number): MmrSummary {
    const estimate = estimateRankDetails(playlist, mmr);
    return {
      value: `${Math.round(mmr)}`,
      rankLabel: estimate?.rankLabel ?? "",
      ...(estimate?.division === undefined ? {} : { division: estimate.division }),
      ...(estimate?.divisionEstimated ? { divisionEstimated: true } : {})
    };
  }

  getLastMmrPlaylist(): QueueType | undefined {
    return this.getActiveAccount().lastMmrPlaylist;
  }

  async setLastMmrPlaylist(playlist: Exclude<QueueType, "unknown">): Promise<void> {
    const account = this.getActiveAccount();
    if (account.lastMmrPlaylist === playlist) {
      return;
    }
    account.lastMmrPlaylist = playlist;
    account.updatedAt = Date.now();
    await this.store.save(this.state);
  }

  async persistActiveAccount(): Promise<void> {
    await this.store.save(this.state);
  }

  hasActiveAccount(): boolean {
    return this.state.activeAccountId !== undefined &&
      this.state.accounts[this.state.activeAccountId] !== undefined;
  }

  getRecordsLabel(): string {
    const records = this.getScopedStreaks();
    return `W${records.longestWinStreak} L${records.longestLossStreak}`;
  }

  /** Wins and losses of the active account in the current scope, honouring resets. */
  getWinLossCounts(): { wins: number; losses: number } {
    if (!this.hasActiveAccount()) {
      return { wins: 0, losses: 0 };
    }
    const account = this.getActiveAccount();
    const mode = this.getStatsScope() === "mode" ? account.lastMmrPlaylist : undefined;
    if (this.getStatsScope() === "mode" && mode === undefined) {
      return { wins: 0, losses: 0 };
    }
    let wins = 0;
    let losses = 0;
    for (const match of this.state.matches) {
      if (
        match.accountId !== account.accountId ||
        match.supersededByMatchId ||
        !this.isInStatsPeriod(match) ||
        (mode !== undefined && match.queueType !== mode)
      ) {
        continue;
      }
      if (match.outcome === "win") {
        wins += 1;
      } else if (match.outcome === "loss") {
        losses += 1;
      }
    }
    return { wins, losses };
  }

  async setPlaylistRank(
    playlist: string,
    mmr: number,
    estimatedRank?: string,
    now = Date.now()
  ): Promise<void> {
    const account = this.getActiveAccount();
    let rank = account.rankByPlaylist.find((item) => item.playlist === playlist);
    if (!rank) {
      rank = { playlist };
      account.rankByPlaylist.push(rank);
    }
    rank.mmr = mmr;
    if (estimatedRank) {
      rank.estimatedRank = estimatedRank;
    }
    const history = rank.history ?? [];
    if (history.at(-1)?.mmr !== mmr) {
      history.push({ at: now, mmr });
      rank.history = history.slice(-MMR_HISTORY_LIMIT);
    }
    account.updatedAt = now;
    await this.store.save(this.state);
  }

  /** MMR history of the active account, one series per playlist, oldest point first. */
  getMmrHistory(): Record<string, MmrHistoryPoint[]> {
    if (!this.hasActiveAccount()) {
      return {};
    }
    return Object.fromEntries(
      this.getActiveAccount()
        .rankByPlaylist.filter((rank) => rank.history?.length)
        .map((rank) => [rank.playlist, rank.history!.map((point) => ({ ...point }))])
    );
  }

  getActiveAccount(): AccountStats {
    const accountId = this.state.activeAccountId;
    if (!accountId) {
      throw new Error("No active account resolved. Resolve identity first.");
    }

    const account = this.state.accounts[accountId];
    if (!account) {
      throw new Error(`Missing state for active account '${accountId}'.`);
    }
    return account;
  }

  getStateSnapshot(): PersistedState {
    return structuredClone(this.state);
  }

  private ensureAccount(accountId: string, displayName?: string): void {
    const existing = this.state.accounts[accountId];
    if (existing) {
      if (displayName) {
        existing.displayName = displayName;
      }
      return;
    }

    this.state.accounts[accountId] = {
      accountId,
      rankByPlaylist: [],
      streak: { type: "none", count: 0 },
      records: structuredClone(DEFAULT_RECORDS),
      updatedAt: Date.now()
    };
    if (displayName) {
      this.state.accounts[accountId].displayName = displayName;
    }
  }

  private updateStreakRecords(account: AccountStats): void {
    const summary = this.computeStreaks(account.accountId);
    account.streak = summary.streak;
    account.records.longestWinStreak = summary.longestWinStreak;
    account.records.longestLossStreak = summary.longestLossStreak;
  }

  private computeStreaks(accountId: string, queueType?: QueueType, usePeriod = false): {
    streak: AccountStats["streak"];
    longestWinStreak: number;
    longestLossStreak: number;
  } {
    const matches = this.state.matches
      .filter((match) =>
        match.accountId === accountId &&
        !match.supersededByMatchId &&
        (usePeriod ? this.isInStatsPeriod(match) : !match.excludedFromStats) &&
        (queueType === undefined || match.queueType === queueType)
      )
      .sort((left, right) =>
        left.startedAt - right.startedAt ||
        (left.endedAt ?? left.startedAt) - (right.endedAt ?? right.startedAt) ||
        left.matchId.localeCompare(right.matchId)
      );
    let streak: AccountStats["streak"] = { type: "none", count: 0 };
    let longestWinStreak = 0;
    let longestLossStreak = 0;

    for (const match of matches) {
      if (match.outcome !== "win" && match.outcome !== "loss") {
        continue;
      }
      streak = streak.type === match.outcome
        ? { type: match.outcome, count: streak.count + 1 }
        : { type: match.outcome, count: 1 };
      if (streak.type === "win") {
        longestWinStreak = Math.max(longestWinStreak, streak.count);
      } else {
        longestLossStreak = Math.max(longestLossStreak, streak.count);
      }
    }

    return { streak, longestWinStreak, longestLossStreak };
  }

  private updatePerformanceRecords(account: AccountStats, performance: MatchPerformanceInput): boolean {
    const records = account.records;
    const before = JSON.stringify(records);

    records.maxGoalsPerMatch = Math.max(records.maxGoalsPerMatch, performance.goals);
    records.maxAssistsPerMatch = Math.max(records.maxAssistsPerMatch, performance.assists);
    records.maxSavesPerMatch = Math.max(records.maxSavesPerMatch, performance.saves);
    records.maxScorePerMatch = Math.max(records.maxScorePerMatch, performance.score);
    if (performance.fastestGoalKph) {
      records.fastestGoalKph = Math.max(records.fastestGoalKph ?? 0, performance.fastestGoalKph);
    }

    return before !== JSON.stringify(records);
  }
}
