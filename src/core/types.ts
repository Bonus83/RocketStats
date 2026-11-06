export type Team = "blue" | "orange";

export type MatchOutcome = "win" | "loss" | "unknown";

export type StreakType = "win" | "loss" | "none";

export type IdentitySource = "live_account" | "manual_fallback" | "none";

export type QueueType =
  | "casual"
  | "ranked_1v1"
  | "ranked_2v2"
  | "ranked_3v3"
  | "ranked_4v4"
  | "ranked_hoops"
  | "ranked_rumble"
  | "ranked_dropshot"
  | "ranked_snow_day"
  | "ranked_heatseeker"
  | "tournament"
  | "unknown";

export type PluginLocale = "de" | "en" | "pl" | "fr" | "es" | "pt" | "ru";

export interface AccountIdentitySignal {
  accountId?: string;
  liveDisplayName?: string;
  manualDisplayName?: string;
  manualMatch?: boolean;
  observedAt: number;
}

export interface ActiveAccountIdentity {
  accountId: string;
  displayName: string;
  source: IdentitySource;
  observedAt: number;
}

export interface StreakState {
  type: StreakType;
  count: number;
}

export interface MatchRecord {
  matchId: string;
  accountId: string;
  queueType: QueueType;
  startedAt: number;
  endedAt?: number;
  outcome: MatchOutcome;
  endedNormally: boolean;
  wasEarlyLeave: boolean;
  wasRankedReconnect: boolean;
  supersededByMatchId?: string;
  isProvisional?: boolean;
  /** Set by a stats reset; the match is kept only so repeated result events cannot re-add it. */
  excludedFromStats?: boolean;
}

export interface MmrHistoryPoint {
  at: number;
  mmr: number;
}

export interface RankRecord {
  playlist: string;
  mmr?: number;
  estimatedRank?: string;
  history?: MmrHistoryPoint[];
}

export type RankDivision = 1 | 2 | 3 | 4;

export interface MmrSummary {
  value: string;
  rankLabel: string;
  division?: RankDivision;
  divisionEstimated?: boolean;
}

export interface PersonalRecords {
  fastestGoalKph?: number;
  longestWinStreak: number;
  longestLossStreak: number;
  maxGoalsPerMatch: number;
  maxAssistsPerMatch: number;
  maxSavesPerMatch: number;
  maxScorePerMatch: number;
}

export interface AccountStats {
  accountId: string;
  displayName?: string;
  rankByPlaylist: RankRecord[];
  lastMmrPlaylist?: QueueType;
  streak: StreakState;
  banCountdownUntil?: number;
  records: PersonalRecords;
  updatedAt: number;
}

export interface PendingReconnect {
  accountId: string;
  originalMatchId: string;
  createdAt: number;
  expiresAt: number;
}

export type StatsScope = "all" | "mode";

/** Time range of the W/L statistics: current session, since the last reset, or everything. */
export type StatsPeriod = "session" | "cleared" | "alltime";

export const STATS_PERIODS: readonly StatsPeriod[] = ["session", "cleared", "alltime"];

export interface PersistedState {
  schemaVersion: 1;
  activeAccountId?: string;
  statsScope?: StatsScope;
  statsPeriod?: StatsPeriod;
  sessionStartedAt?: number;
  accounts: Record<string, AccountStats>;
  matches: MatchRecord[];
  pendingReconnect: PendingReconnect[];
}

export interface LiveGoalEvent {
  scorer: string;
  speedKph?: number;
  team: Team;
  occurredAt: number;
}

export type LiveGameplayEventType =
  | "goal"
  | "demo"
  | "save"
  | "crossbar"
  | "overtime"
  | "result";

export interface LiveGameplayEvent {
  type: LiveGameplayEventType;
  label?: string;
  value?: string;
  occurredAt: number;
}

export interface LivePlayerStats {
  accountId?: string;
  name: string;
  matchedByManualName?: boolean;
  team: Team;
  score: number;
  goals: number;
  assists: number;
  saves: number;
  shots: number;
  demos: number;
  touches: number;
  flipResets: number;
  boost: number;
  speedKph: number;
  supersonic: boolean;
  pingMs?: number;
  hasBallPossession: boolean;
}

export interface LiveMatchSnapshot {
  matchId: string;
  isInMatch: boolean;
  /** Local time when the feed last established whether a match was active. */
  matchStatusObservedAt?: number;
  isOvertime: boolean;
  isPaused: boolean;
  gameClockSeconds: number;
  blueScore: number;
  orangeScore: number;
  myTeam?: Team;
  localPlayer?: LivePlayerStats;
  lastGoal?: LiveGoalEvent;
  latestEvent?: LiveGameplayEvent;
  queueType?: QueueType;
  playlistId?: number;
  gameStateLoaded?: boolean;
  identityObserved?: boolean;
  matchCreated?: boolean;
  isSearching: boolean;
  searchingPlaylists: string[];
  searchElapsedSeconds: number;
  banRemainingSeconds: number;
  result?: Exclude<MatchOutcome, "unknown">;
  leftEarly: boolean;
  rankedReconnectResultApplied: boolean;
  updatedAt: number;
}

export function createEmptySnapshot(): LiveMatchSnapshot {
  return {
    matchId: "unknown",
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
}

export const DEFAULT_RECORDS: PersonalRecords = {
  longestWinStreak: 0,
  longestLossStreak: 0,
  maxGoalsPerMatch: 0,
  maxAssistsPerMatch: 0,
  maxSavesPerMatch: 0,
  maxScorePerMatch: 0
};
