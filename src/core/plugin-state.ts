import { AccountStore } from "./account-store.js";
import { IdentityResolver } from "./identity-resolver.js";
import { StreakEngine } from "./streak-engine.js";
import { estimateRankDetails } from "./rank-estimator.js";
import {
  identitySearchMatches,
  listPlatformCandidates,
  matchingIdentityCandidates,
  platformAccountId
} from "./platform-identity.js";
import {
  AccountIdentitySignal,
  AccountStats,
  ActiveAccountIdentity,
  DEFAULT_RECORDS,
  LiveMatchSnapshot,
  MatchRecord,
  MmrHistoryPoint,
  MmrSummary,
  ObservedIdentityMatch,
  ObservedMatchPlayer,
  PersistedState,
  PlatformAccountsSnapshot,
  PlayerMatchPerformance,
  QueueType,
  RankRecord,
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

export interface IdentityObservationResult {
  saved?: Promise<void>;
  inferredAccountId?: string;
  accountsChanged?: boolean;
}

export class PluginState {
  private readonly store: AccountStore;

  private readonly identityResolver: IdentityResolver;

  private readonly streakEngine: StreakEngine;

  private readonly retryableRemovals = new Set<string>();

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

  getSelectedPlatformId(): string | undefined {
    return this.state.selectedPlatformId;
  }

  getPlatformAccounts(verifiedAccountId?: string): PlatformAccountsSnapshot {
    const accounts = listPlatformCandidates(this.state);
    const activeAccountId = platformAccountId(this.state.activeAccountId);
    const selectedAccountId = this.state.selectedPlatformId;
    const validVerified = platformAccountId(verifiedAccountId);
    const suggestedCount = accounts.filter((account) => account.suggested).length;
    return {
      accounts,
      ...(activeAccountId ? { activeAccountId } : {}),
      ...(selectedAccountId ? { selectedAccountId } : {}),
      ...(validVerified ? { verifiedAccountId: validVerified } : {}),
      ...(this.state.platformSelectionSource
        ? { selectionSource: validVerified ? "verified" : this.state.platformSelectionSource }
        : validVerified ? { selectionSource: "verified" } : {}),
      selectionRequired: !validVerified && suggestedCount > 1
    };
  }

  async addPlatformAccount(value: string): Promise<void> {
    const accountId = platformAccountId(value);
    if (!accountId) {
      throw new Error("A platform ID must have the format Platform|ID|number.");
    }
    const managed = this.state.managedPlatformIds ??= [];
    if (!managed.includes(accountId)) {
      managed.push(accountId);
    }
    await this.store.save(this.state);
  }

  async selectPlatformAccount(
    value: string,
    source: "manual" | "inferred" | "verified",
    currentMatchId?: string,
    correctInferred = false
  ): Promise<void> {
    const accountId = platformAccountId(value);
    if (!accountId) {
      throw new Error("A platform ID must have the format Platform|ID|number.");
    }
    const candidates = listPlatformCandidates(this.state);
    if (source !== "verified" && !candidates.some((candidate) => candidate.accountId === accountId)) {
      throw new Error("Add the platform ID before selecting it.");
    }
    const previousSelected = this.state.selectedPlatformId;
    if (
      correctInferred &&
      (source !== "manual" || !previousSelected || previousSelected === accountId ||
        this.state.platformSelectionSource !== "inferred")
    ) {
      throw new Error("There is no different automatic account selection to correct.");
    }
    const previousState = this.state;
    this.state = structuredClone(previousState);
    try {
      const managed = this.state.managedPlatformIds ??= [];
      if (!managed.includes(accountId)) {
        managed.push(accountId);
      }
      const name = candidates.find((candidate) => candidate.accountId === accountId)?.name;
      this.ensureAccount(accountId, name);
      this.state.activeAccountId = accountId;
      this.state.selectedPlatformId = accountId;
      this.state.platformSelectionSource = source;
      const searchIds = new Set(this.state.identitySearchMatchIds ?? []);
      if (correctInferred) {
        const inferred = [...(this.state.identityMatches ?? [])]
          .filter((match) => match.resolutionSource === "inferred" && match.resolvedAccountId === previousSelected)
          .sort((left, right) => right.startedAt - left.startedAt);
        for (const match of inferred) {
          this.revokeTentativeMatch(match);
          if (match.players.some((player) => player.accountId === accountId)) {
            match.resolvedAccountId = accountId;
            match.resolutionSource = "manual";
          } else {
            searchIds.add(match.matchId);
          }
        }
      }
      for (const match of this.state.identityMatches ?? []) {
        if (!match.players.some((player) => player.accountId === accountId)) continue;
        if (match.resolvedAccountId && match.resolvedAccountId !== accountId) {
          if (source !== "verified" || match.matchId !== currentMatchId || match.resolutionSource === "verified") {
            continue;
          }
          this.revokeTentativeMatch(match);
        }
        if (
          !match.resolvedAccountId &&
          (source === "manual" ||
            (source === "inferred" && searchIds.has(match.matchId) && !match.matchId.startsWith("local:")) ||
            (source === "verified" && match.matchId === currentMatchId))
        ) {
          match.resolvedAccountId = accountId;
          match.resolutionSource = source;
        } else if (match.resolvedAccountId === accountId && source === "verified" && match.matchId === currentMatchId) {
          match.resolutionSource = "verified";
        }
      }
      this.state.identitySearchMatchIds = [...searchIds].filter((id) =>
        !(this.state.identityMatches ?? []).find((match) => match.matchId === id)?.resolvedAccountId
      );
      this.applyObservedMatches(accountId);
    } catch (error) {
      this.state = previousState;
      throw error;
    }
    await this.store.save(this.state);
  }

  async removePlatformAccount(value: string): Promise<void> {
    const accountId = platformAccountId(value);
    if (!accountId) {
      throw new Error("A platform ID must have the format Platform|ID|number.");
    }
    const managed = this.state.managedPlatformIds ?? [];
    if (!managed.includes(accountId)) {
      if (!this.retryableRemovals.has(accountId)) {
        throw new Error("This platform ID is not in the account list.");
      }
    } else {
      this.state.managedPlatformIds = managed.filter((id) => id !== accountId);
      if (this.state.selectedPlatformId === accountId) {
        delete this.state.selectedPlatformId;
        delete this.state.platformSelectionSource;
        this.ensureAccount("unknown", "Unknown");
        this.state.activeAccountId = "unknown";
      }
      this.retryableRemovals.add(accountId);
    }
    await this.store.save(this.state);
    this.retryableRemovals.delete(accountId);
  }

  hasIdentityMatch(matchId: string): boolean {
    return (this.state.identityMatches ?? []).some((match) => match.matchId === matchId);
  }

  renameIdentityMatch(previousId: string, matchId: string): Promise<void> | undefined {
    const matches = this.state.identityMatches ?? [];
    const previous = matches.find((match) => match.matchId === previousId);
    if (!previous || previousId === matchId) {
      return undefined;
    }
    if (matches.some((match) => match.matchId === matchId)) {
      throw new Error(`Cannot merge duplicate match observations for '${matchId}'.`);
    }
    previous.matchId = matchId;
    this.state.identitySearchMatchIds = (this.state.identitySearchMatchIds ?? [])
      .map((id) => id === previousId ? matchId : id);
    for (const match of this.state.matches) {
      if (match.matchId === previousId) {
        match.matchId = matchId;
      }
    }
    for (const pending of this.state.pendingReconnect) {
      if (pending.originalMatchId === previousId) {
        pending.originalMatchId = matchId;
      }
    }
    return this.store.save(this.state);
  }

  observeIdentityMatch(
    matchId: string,
    snapshot: LiveMatchSnapshot,
    search: boolean,
    soloMmr?: ObservedIdentityMatch["soloMmr"]
  ): IdentityObservationResult {
    const players = snapshot.players ?? [];
    const counts = new Map<string, number>();
    for (const player of players) {
      const id = platformAccountId(player.accountId);
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const validPlayers = players.filter((player) => {
      const id = platformAccountId(player.accountId);
      return id !== undefined && counts.get(id) === 1 && player.isBot !== true;
    });
    const matches = this.state.identityMatches ??= [];
    let match = matches.find((entry) => entry.matchId === matchId);
    if (!match && validPlayers.length === 0) {
      return {};
    }
    if (!match) {
      match = {
        matchId,
        startedAt: snapshot.updatedAt,
        updatedAt: snapshot.updatedAt,
        queueType: snapshot.queueType ?? "unknown",
        players: []
      };
      matches.push(match);
    }
    const before = JSON.stringify(match);
    const wasCompleted = match.completedAt !== undefined;
    const previousCandidates = JSON.stringify(match.players.map((player) => [player.accountId, player.name]));
    if (snapshot.queueType && snapshot.queueType !== "unknown") {
      match.queueType = snapshot.queueType;
    } else if (soloMmr && match.queueType === "unknown") {
      match.queueType = soloMmr.playlist;
    }
    if (soloMmr && !match.soloMmr) {
      match.soloMmr = soloMmr;
    }

    for (const player of validPlayers) {
      const accountId = platformAccountId(player.accountId);
      if (!accountId) continue;
      let observed = match.players.find((entry) => entry.accountId === accountId);
      if (!observed) {
        observed = {
          accountId,
          name: player.name,
          team: player.team,
          score: 0,
          goals: 0,
          assists: 0,
          saves: 0,
          shots: 0,
          demos: 0,
          touches: 0,
          flipResets: 0
        };
        match.players.push(observed);
      }
      observed.name = player.name;
      observed.team = player.team;
      for (const key of ["score", "goals", "assists", "saves", "shots", "demos", "touches", "flipResets"] as const) {
        observed[key] = Math.max(observed[key], player[key]);
      }
    }

    const goal = snapshot.lastGoal;
    if (goal?.speedKph !== undefined && Number.isFinite(goal.speedKph) && goal.speedKph > 0) {
      const scorers = match.players.filter((player) => player.name === goal.scorer && player.team === goal.team);
      const scorer = scorers.length === 1 ? scorers[0] : undefined;
      if (scorer) {
        scorer.fastestGoalKph = Math.max(scorer.fastestGoalKph ?? 0, goal.speedKph);
      }
    }
    if (snapshot.winnerTeam) {
      match.winnerTeam = snapshot.winnerTeam;
      match.completedAt ??= snapshot.updatedAt;
    } else if (snapshot.leftEarly) {
      match.earlyLeaveAt ??= snapshot.updatedAt;
      match.completedAt ??= snapshot.updatedAt;
    } else if (snapshot.isInMatch && match.earlyLeaveAt !== undefined && !match.winnerTeam) {
      delete match.completedAt;
    }
    const selected = this.state.selectedPlatformId;
    if (
      !match.resolvedAccountId && selected &&
      snapshot.localPlayer?.accountId === selected &&
      match.players.some((player) => player.accountId === selected)
    ) {
      match.resolvedAccountId = selected;
      match.resolutionSource = snapshot.localPlayer.matchedBySelectedAccount
        ? this.state.platformSelectionSource ?? "manual"
        : "verified";
    }

    let searchChanged = false;
    const searchIds = this.state.identitySearchMatchIds ??= [];
    if (search && !searchIds.includes(matchId)) {
      searchIds.push(matchId);
      searchChanged = true;
    }
    let inferredAccountId: string | undefined;
    const candidatesChanged = previousCandidates !==
      JSON.stringify(match.players.map((player) => [player.accountId, player.name]));
    if (search && (searchChanged || candidatesChanged || wasCompleted !== (match.completedAt !== undefined))) {
      const completed = identitySearchMatches(this.state)
        .filter((entry) => entry.completedAt !== undefined && entry.players.length >= 2 &&
          !entry.matchId.startsWith("local:"));
      if (completed.length >= 2) {
        const candidates = matchingIdentityCandidates(completed);
        if (candidates.length === 1) {
          inferredAccountId = candidates[0];
        } else if (candidates.length === 0) {
          this.state.identitySearchMatchIds = [completed[completed.length - 1]!.matchId];
          searchChanged = true;
        }
      }
    }

    const changed = before !== JSON.stringify(match) || searchChanged;
    const accountsChanged = searchChanged || candidatesChanged;
    if (!changed) {
      return inferredAccountId ? { inferredAccountId } : {};
    }
    match.updatedAt = snapshot.updatedAt;
    if (selected && match.resolvedAccountId === selected) {
      this.applyObservedMatches(selected, matchId);
    }
    const saved = this.store.save(this.state);
    return {
      saved,
      ...(inferredAccountId ? { inferredAccountId } : {}),
      ...(accountsChanged ? { accountsChanged: true } : {})
    };
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
      if (
        snapshot.lastGoal?.speedKph &&
        snapshot.lastGoal.scorer === snapshot.localPlayer.name &&
        snapshot.lastGoal.team === snapshot.localPlayer.team &&
        (!snapshot.players || snapshot.players.filter((player) =>
          player.name === snapshot.lastGoal?.scorer && player.team === snapshot.lastGoal.team
        ).length === 1)
      ) {
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
    return new Set(this.state.matches.filter((match) =>
      !match.supersededByMatchId &&
      (match.outcome === "win" || match.outcome === "loss") &&
      (match.endedAt ?? match.startedAt) >= start
    ).map((match) => match.matchId)).size;
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
    const history = rank.history ?? [];
    if (!history.length && rank.mmr !== undefined && Number.isFinite(rank.mmr) && rank.mmr !== mmr) {
      history.push({ at: Math.min(account.updatedAt, now), mmr: rank.mmr });
    }
    rank.mmr = mmr;
    if (estimatedRank) {
      rank.estimatedRank = estimatedRank;
    }
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
    const account = this.getActiveAccount();
    const entries: Array<[string, MmrHistoryPoint[]]> = [];
    for (const rank of account.rankByPlaylist) {
      if (rank.history?.length) {
        entries.push([rank.playlist, rank.history.map((point) => ({ ...point }))]);
      } else if (rank.mmr !== undefined && Number.isFinite(rank.mmr)) {
        // MMR stored before the history existed: show it as the first known point.
        entries.push([rank.playlist, [{ at: account.updatedAt, mmr: rank.mmr }]]);
      }
    }
    return Object.fromEntries(entries);
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

  private applyObservedMatches(accountId: string, matchId?: string): void {
    const account = this.state.accounts[accountId];
    if (!account) {
      return;
    }
    const observations = [...(this.state.identityMatches ?? [])]
      .filter((match) => matchId === undefined || match.matchId === matchId)
      .sort((left, right) => left.startedAt - right.startedAt);
    let latestPlaylist: Exclude<QueueType, "unknown"> | undefined;
    let changed = false;
    for (const observation of observations) {
      if (observation.resolvedAccountId !== accountId) continue;
      const player = observation.players.find((entry) => entry.accountId === accountId);
      if (!player) continue;

      if (observation.queueType !== "unknown") {
        latestPlaylist = observation.queueType;
      }
      if (observation.soloMmr && observation.rankBefore === undefined) {
        const previousRank = account.rankByPlaylist.find((rank) =>
          rank.playlist === observation.soloMmr?.playlist
        );
        const previousHistory = previousRank?.history?.map((point) => ({ ...point })) ?? [];
        const rankBefore: RankRecord | null = previousRank
          ? {
              playlist: previousRank.playlist,
              ...(previousRank.mmr === undefined ? {} : { mmr: previousRank.mmr }),
              ...(previousRank.estimatedRank === undefined ? {} : { estimatedRank: previousRank.estimatedRank })
            }
          : null;
        const rankChanged = this.applyObservedMmr(account, observation.soloMmr);
        if (rankChanged) {
          const history = account.rankByPlaylist.find((rank) =>
            rank.playlist === observation.soloMmr?.playlist
          )?.history ?? [];
          const sample = { at: observation.soloMmr.observedAt, mmr: observation.soloMmr.value };
          observation.rankBefore = rankBefore;
          observation.rankHistoryDelta = {
            evicted: subtractHistory(previousHistory, history),
            introduced: subtractHistory(subtractHistory(history, previousHistory), [sample])
          };
          observation.mmrPlaylistBefore = account.lastMmrPlaylist ?? null;
        }
        changed = rankChanged || changed;
      }
      const existing = this.state.matches.find((match) =>
        match.accountId === accountId && match.matchId === observation.matchId
      );
      const recordsBefore = observation.recordsBefore ? undefined : structuredClone(account.records);
      const performanceChanged = this.updatePerformanceRecords(account, player);
      if (recordsBefore && (performanceChanged || (observation.completedAt !== undefined && !existing))) {
        observation.recordsBefore = recordsBefore;
      }
      changed = performanceChanged || changed;
      if (observation.completedAt === undefined) continue;

      const match: MatchRecord = {
        matchId: observation.matchId,
        accountId,
        queueType: observation.queueType,
        startedAt: observation.startedAt,
        outcome: "unknown",
        endedNormally: false,
        wasEarlyLeave: false,
        wasRankedReconnect: observation.earlyLeaveAt !== undefined,
        ...(observation.excludedFromStats ? { excludedFromStats: true } : {})
      };
      if (observation.winnerTeam) {
        const outcome = player.team === observation.winnerTeam ? "win" : "loss";
        if (existing?.isProvisional && !this.state.pendingReconnect.some((pending) =>
          pending.accountId === accountId &&
          pending.originalMatchId === observation.matchId &&
          pending.expiresAt >= observation.completedAt!
        )) {
          Object.assign(existing, {
            outcome,
            endedAt: observation.completedAt,
            endedNormally: true,
            wasEarlyLeave: false,
            wasRankedReconnect: true,
            isProvisional: false
          });
          this.state.pendingReconnect = this.state.pendingReconnect.filter((pending) =>
            pending.accountId !== accountId || pending.originalMatchId !== observation.matchId
          );
          changed = true;
        } else {
          const mutation = this.streakEngine.applyFinalResult(
            account.streak,
            this.state.matches,
            this.state.pendingReconnect,
            match,
            outcome,
            observation.completedAt
          );
          if (mutation.changed) {
            this.state.matches = mutation.records;
            this.state.pendingReconnect = mutation.pendingReconnect;
            changed = true;
          }
        }
      } else if (observation.earlyLeaveAt !== undefined) {
        const mutation = this.streakEngine.applyEarlyLeave(
          account.streak,
          this.state.matches,
          this.state.pendingReconnect,
          match,
          observation.earlyLeaveAt
        );
        if (mutation.changed) {
          this.state.matches = mutation.records;
          this.state.pendingReconnect = mutation.pendingReconnect;
          changed = true;
        }
      }

      const recorded = this.state.matches.find((entry) =>
        entry.accountId === accountId && entry.matchId === observation.matchId
      );
      if (recorded) {
        const performance = matchPerformance(player);
        if (JSON.stringify(recorded.performance) !== JSON.stringify(performance)) {
          recorded.performance = performance;
          changed = true;
        }
      }
    }
    if (!account.lastMmrPlaylist && latestPlaylist) {
      account.lastMmrPlaylist = latestPlaylist;
      changed = true;
    }
    if (changed) {
      this.updateStreakRecords(account);
      account.updatedAt = observations.reduce(
        (latest, entry) => Math.max(latest, entry.updatedAt),
        account.updatedAt
      );
    }
  }

  private revokeTentativeMatch(observation: ObservedIdentityMatch): void {
    const accountId = observation.resolvedAccountId;
    if (!accountId) return;
    const account = this.state.accounts[accountId];
    const player = observation.players.find((entry) => entry.accountId === accountId);
    const existing = this.state.matches.find((match) =>
      match.matchId === observation.matchId && match.accountId === accountId
    );
    const before = observation.recordsBefore;
    if ((existing || before) && (!account || !player || !before)) {
      throw new Error(`Cannot safely correct the account for match '${observation.matchId}'.`);
    }
    if (account && player && before) {
      if (existing) {
        if (existing.excludedFromStats) {
          observation.excludedFromStats = true;
        }
        this.state.matches = this.state.matches.filter((match) => match !== existing);
        this.state.pendingReconnect = this.state.pendingReconnect.filter((pending) =>
          pending.accountId !== accountId || pending.originalMatchId !== observation.matchId
        );
      }
      for (const [recordKey, playerKey] of [
        ["maxGoalsPerMatch", "goals"],
        ["maxAssistsPerMatch", "assists"],
        ["maxSavesPerMatch", "saves"],
        ["maxScorePerMatch", "score"]
      ] as const) {
        if (account.records[recordKey] <= player[playerKey]) {
          account.records[recordKey] = Math.max(
            before[recordKey],
            ...this.state.matches.filter((match) => match.accountId === accountId)
              .map((match) => match.performance?.[playerKey] ?? 0)
          );
        }
      }
      if (
        player.fastestGoalKph !== undefined &&
        (account.records.fastestGoalKph ?? 0) <= player.fastestGoalKph
      ) {
        const fastest = Math.max(
          before.fastestGoalKph ?? 0,
          ...this.state.matches.filter((match) => match.accountId === accountId)
            .map((match) => match.performance?.fastestGoalKph ?? 0)
        );
        if (fastest > 0) account.records.fastestGoalKph = fastest;
        else delete account.records.fastestGoalKph;
      }
      this.updateStreakRecords(account);
    }
    if (account && observation.soloMmr && observation.rankBefore !== undefined) {
      const sample = observation.soloMmr;
      const index = account.rankByPlaylist.findIndex((rank) => rank.playlist === sample.playlist);
      const current = account.rankByPlaylist[index];
      if (current) {
        const delta = observation.rankHistoryDelta;
        if (delta) {
          const remaining = subtractHistory(current.history ?? [], [
            { at: sample.observedAt, mmr: sample.value },
            ...delta.introduced
          ]);
          const restored = [...remaining, ...delta.evicted]
            .sort((left, right) => left.at - right.at)
            .slice(-MMR_HISTORY_LIMIT);
          if (remaining.some((point) => point.at > sample.observedAt) ||
              (observation.rankBefore === null && remaining.length > 0)) {
            current.history = restored;
            const latest = restored.at(-1);
            if (latest) current.mmr = latest.mmr;
          } else if (observation.rankBefore === null) {
            account.rankByPlaylist.splice(index, 1);
          } else {
            account.rankByPlaylist[index] = {
              ...structuredClone(observation.rankBefore),
              ...(restored.length ? { history: restored } : {})
            };
          }
        } else {
          const remaining = (current.history ?? []).filter((point) =>
            point.at !== sample.observedAt || point.mmr !== sample.value
          );
          if (remaining.some((point) => point.at > sample.observedAt)) {
            current.history = remaining;
            const latest = remaining[remaining.length - 1];
            if (latest) current.mmr = latest.mmr;
          } else if (observation.rankBefore === null) {
            account.rankByPlaylist.splice(index, 1);
          } else {
            account.rankByPlaylist[index] = structuredClone(observation.rankBefore);
          }
        }
      }
      if (account.lastMmrPlaylist === sample.playlist && observation.mmrPlaylistBefore !== undefined) {
        if (observation.mmrPlaylistBefore === null) delete account.lastMmrPlaylist;
        else account.lastMmrPlaylist = observation.mmrPlaylistBefore;
      }
    }
    delete observation.resolvedAccountId;
    delete observation.resolutionSource;
    delete observation.recordsBefore;
    delete observation.rankBefore;
    delete observation.rankHistoryDelta;
    delete observation.mmrPlaylistBefore;
  }

  private applyObservedMmr(
    account: AccountStats,
    sample: NonNullable<ObservedIdentityMatch["soloMmr"]>
  ): boolean {
    let rank = account.rankByPlaylist.find((entry) => entry.playlist === sample.playlist);
    if (!rank) {
      rank = { playlist: sample.playlist };
      account.rankByPlaylist.push(rank);
    }
    const history = rank.history ?? [];
    if (history.some((point) => point.at === sample.observedAt && point.mmr === sample.value)) {
      return false;
    }
    const previous = history.reduce<MmrHistoryPoint | undefined>((latest, point) =>
      point.at <= sample.observedAt && (!latest || point.at > latest.at) ? point : latest,
      undefined
    );
    const next = history.reduce<MmrHistoryPoint | undefined>((earliest, point) =>
      point.at > sample.observedAt && (!earliest || point.at < earliest.at) ? point : earliest,
      undefined
    );
    if (previous?.mmr === sample.value || (!previous && next?.mmr === sample.value)) {
      return false;
    }
    const previousLatestAt = history.reduce((latest, point) => Math.max(latest, point.at), -Infinity);
    if (rank.mmr !== undefined && history.length === 0 && rank.mmr !== sample.value) {
      history.push({ at: account.updatedAt, mmr: rank.mmr });
      if (account.updatedAt <= sample.observedAt) {
        rank.mmr = sample.value;
      }
    } else if (rank.mmr === undefined || (history.length > 0 && previousLatestAt <= sample.observedAt)) {
      rank.mmr = sample.value;
    }
    if (rank.mmr === undefined) {
      rank.mmr = sample.value;
    }
    history.push({ at: sample.observedAt, mmr: sample.value });
    history.sort((left, right) => left.at - right.at);
    rank.history = history
      .filter((point, index) => index === 0 || history[index - 1]?.mmr !== point.mmr)
      .slice(-MMR_HISTORY_LIMIT);
    return true;
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

function subtractHistory(points: MmrHistoryPoint[], removed: MmrHistoryPoint[]): MmrHistoryPoint[] {
  const counts = new Map<string, number>();
  for (const point of removed) {
    const key = `${point.at}\0${point.mmr}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return points.filter((point) => {
    const key = `${point.at}\0${point.mmr}`;
    const count = counts.get(key) ?? 0;
    if (count === 0) return true;
    counts.set(key, count - 1);
    return false;
  });
}

function matchPerformance(player: ObservedMatchPlayer): PlayerMatchPerformance {
  return {
    score: player.score,
    goals: player.goals,
    assists: player.assists,
    saves: player.saves,
    shots: player.shots,
    demos: player.demos,
    touches: player.touches,
    flipResets: player.flipResets,
    ...(player.fastestGoalKph === undefined ? {} : { fastestGoalKph: player.fastestGoalKph })
  };
}
