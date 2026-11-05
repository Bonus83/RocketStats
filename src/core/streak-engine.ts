import { MatchOutcome, MatchRecord, PendingReconnect, StreakState } from "./types.js";

export interface StreakMutationResult {
  streak: StreakState;
  records: MatchRecord[];
  pendingReconnect: PendingReconnect[];
  changed: boolean;
}

interface ApplyResultInput {
  streak: StreakState;
  records: MatchRecord[];
  pendingReconnect: PendingReconnect[];
  match: MatchRecord;
  outcome: Exclude<MatchOutcome, "unknown">;
}

export class StreakEngine {
  constructor(private readonly reconnectWindowMs: number) {}

  applyEarlyLeave(
    streak: StreakState,
    records: MatchRecord[],
    pendingReconnect: PendingReconnect[],
    match: MatchRecord,
    now: number
  ): StreakMutationResult {
    const existing = records.find(
      (record) => record.matchId === match.matchId && record.accountId === match.accountId
    );
    if (existing) {
      return {
        streak: { ...streak },
        records: [...records],
        pendingReconnect: [...pendingReconnect],
        changed: false
      };
    }

    const updatedMatch: MatchRecord = {
      ...match,
      outcome: "loss",
      endedNormally: false,
      wasEarlyLeave: true,
      isProvisional: true,
      endedAt: now
    };

    const next = this.applyResult({
      streak,
      records,
      pendingReconnect,
      match: updatedMatch,
      outcome: "loss"
    });

    next.pendingReconnect.push({
      accountId: match.accountId,
      originalMatchId: match.matchId,
      createdAt: now,
      expiresAt: now + this.reconnectWindowMs
    });

    return next;
  }

  applyFinalResult(
    streak: StreakState,
    records: MatchRecord[],
    pendingReconnect: PendingReconnect[],
    match: MatchRecord,
    outcome: Exclude<MatchOutcome, "unknown">,
    now: number
  ): StreakMutationResult {
    const existingFinal = records.find(
      (record) =>
        record.matchId === match.matchId &&
        record.accountId === match.accountId &&
        record.isProvisional !== true
    );
    if (existingFinal) {
      if (existingFinal.outcome !== outcome) {
        throw new Error(`Conflicting final result for match '${match.matchId}'.`);
      }
      return {
        streak: { ...streak },
        records: [...records],
        pendingReconnect: [...pendingReconnect],
        changed: false
      };
    }

    const pending = pendingReconnect.find(
      (item) =>
        item.accountId === match.accountId &&
        item.originalMatchId === match.matchId &&
        item.expiresAt >= now
    );

    if (!pending) {
      return this.applyResult({
        streak,
        records,
        pendingReconnect,
        match: {
          ...match,
          outcome,
          endedNormally: true,
          endedAt: now
        },
        outcome
      });
    }

    const provisional = records.find(
      (record) =>
        record.matchId === match.matchId &&
        record.accountId === match.accountId &&
        record.isProvisional === true
    );

    if (!provisional) {
      return this.applyResult({
        streak,
        records,
        pendingReconnect: pendingReconnect.filter(
          (entry) => !(entry.accountId === pending.accountId && entry.originalMatchId === pending.originalMatchId)
        ),
        match: {
          ...match,
          outcome,
          endedNormally: true,
          endedAt: now
        },
        outcome
      });
    }

    const rolledBack = this.rollbackProvisional(streak, provisional.outcome);
    const cleanedRecords = records.filter((item) => item !== provisional);

    const final: MatchRecord = {
      ...match,
      startedAt: provisional.startedAt,
      outcome,
      endedNormally: true,
      wasEarlyLeave: false,
      wasRankedReconnect: true,
      endedAt: now,
      ...(provisional.excludedFromStats ? { excludedFromStats: true } : {})
    };

    const applied = this.applyResult({
      streak: rolledBack,
      records: cleanedRecords,
      pendingReconnect: pendingReconnect.filter(
        (entry) => !(entry.accountId === pending.accountId && entry.originalMatchId === pending.originalMatchId)
      ),
      match: final,
      outcome
    });

    return applied;
  }

  private applyResult(input: ApplyResultInput): StreakMutationResult {
    const nextStreak = this.advanceStreak(input.streak, input.outcome);
    const nextRecord: MatchRecord = {
      ...input.match,
      outcome: input.outcome
    };

    return {
      streak: nextStreak,
      records: [...input.records, nextRecord],
      pendingReconnect: [...input.pendingReconnect],
      changed: true
    };
  }

  private advanceStreak(streak: StreakState, outcome: Exclude<MatchOutcome, "unknown">): StreakState {
    if (streak.type === outcome) {
      return { type: outcome, count: streak.count + 1 };
    }

    return { type: outcome, count: 1 };
  }

  private rollbackProvisional(
    streak: StreakState,
    provisionalOutcome: MatchOutcome
  ): StreakState {
    if (provisionalOutcome === "unknown" || streak.type !== provisionalOutcome) {
      return streak;
    }

    if (streak.count <= 1) {
      return { type: "none", count: 0 };
    }

    return {
      type: streak.type,
      count: streak.count - 1
    };
  }
}
