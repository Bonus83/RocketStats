import {
  AccountIdentitySignal,
  createEmptySnapshot,
  LiveMatchSnapshot,
  PluginLocale,
  QueueType
} from "../core/types.js";
import { PluginState } from "../core/plugin-state.js";
import { RlLiveConnector, LiveErrorKind } from "../connector/rl-live-connector.js";
import { RocketLeagueLogQueue } from "../connector/rocket-league-log-watcher.js";
import { estimateRank } from "../core/rank-estimator.js";
import {
  renderAction,
  ActionKind,
  KeyRenderModel
} from "../render/key-renderer.js";

export interface ActionSink {
  render(model: KeyRenderModel): void;
}

export type LiveConnectionStatus = "connecting" | "connected" | "disconnected";
export type LiveMatchStatus = "in-match" | "not-in-match" | "unknown";
export type { LiveErrorKind } from "../connector/rl-live-connector.js";

export interface LiveRuntimeOptions {
  host: string;
  port: number;
  reconnectDelayMs: number;
  actionKinds: ActionKind[];
  locale: PluginLocale;
  mmrPlaylist: string;
  eventBannerStats: Array<"goals" | "assists" | "saves" | "shots" | "demos" | "score" | "ping">;
  animateEvents: boolean;
  onError?: (error: Error, kind: LiveErrorKind) => void;
  onConnected?: () => void;
  onConnectionStatus?: (status: LiveConnectionStatus) => void;
}

interface PendingMatchQueue {
  queue: RocketLeagueLogQueue;
  accountId: string | undefined;
  matchGeneration: number;
  observedAt: number;
}

const MAX_PENDING_QUEUE_AGE_MS = 5 * 60_000;
const MAX_MATCH_STATUS_AGE_MS = 15_000;

export class LiveRuntime {
  private readonly connector: RlLiveConnector;
  private readonly reportError: (error: unknown, kind?: LiveErrorKind) => void;
  private lastRecordedEarlyLeaveMatchId: string | undefined;
  private currentPort: number;
  private manualDisplayName: string | undefined;
  private verifiedLogAccountId: string | undefined;
  private observedAccountId: string | undefined;
  private matchAccountId: string | undefined;
  private matchQueueType: QueueType | undefined;
  private matchGeneration = 0;
  private pendingQueue: PendingMatchQueue | undefined;
  private logReservation: { queue: RocketLeagueLogQueue; accountId: string | undefined } | undefined;
  private connectorConnected = false;
  private latestSnapshot: LiveMatchSnapshot | undefined;

  constructor(
    private readonly pluginState: PluginState,
    private readonly sink: ActionSink,
    private readonly options: LiveRuntimeOptions
  ) {
    this.currentPort = this.options.port;
    this.reportError = (error: unknown, kind: LiveErrorKind = "other"): void => {
      const normalized = error instanceof Error ? error : new Error(String(error));
      if (this.options.onError) {
        this.options.onError(normalized, kind);
        return;
      }
      process.stderr.write(`[rocketstats:error] ${normalized.message}\n`);
    };
    this.connector = new RlLiveConnector({
      host: this.options.host,
      port: this.options.port,
      reconnectDelayMs: this.options.reconnectDelayMs
    });

    this.connector.onSnapshot((snapshot) => this.handleSnapshot(snapshot));

    this.connector.onError((error, kind) => {
      this.reportError(error, kind);
    });
    this.connector.onStatus((status) => {
      this.options.onConnectionStatus?.(status);
      if (status === "connected") {
        this.connectorConnected = true;
        this.options.onConnected?.();
      } else if (status === "disconnected" && this.connectorConnected) {
        this.connectorConnected = false;
        this.recordGameLogIdentity(undefined);
        this.observedAccountId = undefined;
        this.matchAccountId = undefined;
        this.pendingQueue = undefined;
        this.latestSnapshot = undefined;
      }
    });
  }

  start(): void {
    if (!this.pluginState.hasActiveAccount()) {
      this.pluginState.resolveIdentity({ observedAt: Date.now() });
    }
    this.renderActions(this.latestSnapshot ?? createEmptySnapshot());
    this.connector.start();
  }

  stop(): void {
    this.connector.stop();
  }

  getMatchStatus(): LiveMatchStatus {
    const snapshot = this.latestSnapshot;
    if (!this.connectorConnected || !snapshot || snapshot.matchStatusObservedAt === undefined) {
      return "unknown";
    }
    const age = Date.now() - snapshot.matchStatusObservedAt;
    if (age < 0 || age > MAX_MATCH_STATUS_AGE_MS) {
      return "unknown";
    }
    return snapshot.isInMatch ? "in-match" : "not-in-match";
  }

  async toggleStatsScope(): Promise<void> {
    await this.pluginState.toggleStatsScope();
    this.renderActions(this.latestSnapshot ?? createEmptySnapshot());
  }

  async resetStats(): Promise<void> {
    if (!this.pluginState.hasActiveAccount()) {
      return;
    }
    await this.pluginState.resetStats();
    this.renderActions(this.latestSnapshot ?? createEmptySnapshot());
  }

  configurePort(port: number): void {
    if (this.currentPort === port) {
      return;
    }
    this.connector.reconfigurePort(port);
    this.currentPort = port;
  }

  configureLocale(locale: PluginLocale): void {
    if (this.options.locale === locale) {
      return;
    }
    this.options.locale = locale;
    this.renderActions(this.latestSnapshot ?? createEmptySnapshot());
  }

  configureManualDisplayName(displayName: string | undefined): void {
    const normalized = displayName?.trim();
    this.manualDisplayName = normalized ? normalized.slice(0, 64) : undefined;
    this.connector.configureManualPlayerName(this.manualDisplayName);
  }

  recordGameLogQueue(queue: RocketLeagueLogQueue): void {
    if (queue.matchId) {
      this.applyLoadedLogQueue(queue);
      const pending = this.pendingQueue;
      if (
        !pending ||
        pending.queue.queueType !== queue.queueType ||
        pending.queue.mmr !== queue.mmr
      ) {
        return;
      }
      pending.queue = queue;
      if (
        this.latestSnapshot?.isInMatch &&
        this.sameMatchId(this.latestSnapshot.matchId, queue.matchId)
      ) {
        pending.matchGeneration = this.matchGeneration;
        if (
          this.matchAccountId &&
          this.pluginState.getActiveAccount().accountId === this.matchAccountId
        ) {
          this.updateLoadedPlaylist(this.latestSnapshot);
          this.renderActions(this.latestSnapshot);
        }
      }
      return;
    }

    const awaitingGameState = this.latestSnapshot?.isInMatch === true &&
      this.latestSnapshot.gameStateLoaded !== true;
    this.logReservation = { queue, accountId: this.verifiedLogAccountId };
    this.pendingQueue = {
      queue,
      accountId: this.verifiedLogAccountId ?? this.observedAccountId,
      matchGeneration: this.matchGeneration + (awaitingGameState ? 0 : 1),
      observedAt: Date.now()
    };
  }

  recordGameLogIdentity(accountId: string | undefined): void {
    if (this.verifiedLogAccountId === accountId) {
      return;
    }
    this.verifiedLogAccountId = accountId;
    this.connector.configureVerifiedAccountId(accountId);
    if (!accountId) {
      this.matchAccountId = undefined;
      return;
    }

    if (this.matchAccountId !== accountId) {
      this.matchAccountId = undefined;
    }
    this.observedAccountId = accountId;
    this.selectIdentity({ accountId, observedAt: Date.now() });
    const snapshot = { ...(this.latestSnapshot ?? createEmptySnapshot()) };
    if (snapshot.localPlayer?.accountId !== accountId) {
      delete snapshot.localPlayer;
      delete snapshot.myTeam;
    }
    this.renderActions(snapshot);
  }

  private handleSnapshot(snapshot: LiveMatchSnapshot): void {
    const previous = this.latestSnapshot;
    if (
      snapshot.isInMatch &&
      (snapshot.matchCreated || !previous?.isInMatch ||
        (snapshot.matchId !== "unknown" && snapshot.matchId !== previous.matchId))
    ) {
      this.matchGeneration += 1;
      const reconnecting = previous?.leftEarly &&
        previous.matchId === snapshot.matchId &&
        snapshot.rankedReconnectResultApplied;
      if (!reconnecting) {
        this.matchAccountId = undefined;
        this.matchQueueType = undefined;
      }
    }

    if (snapshot.identityObserved && snapshot.localPlayer) {
      const local = snapshot.localPlayer;
      if (
        local.accountId &&
        this.verifiedLogAccountId &&
        local.accountId !== this.verifiedLogAccountId
      ) {
        this.verifiedLogAccountId = undefined;
        this.connector.configureVerifiedAccountId(undefined);
        this.reportError(new Error("The feed and game log reported different local accounts."));
      }
      const signal: AccountIdentitySignal = { observedAt: snapshot.updatedAt };
      if (local.accountId) {
        signal.accountId = local.accountId;
        signal.liveDisplayName = local.name;
      } else if (local.matchedByManualName && this.manualDisplayName) {
        signal.manualDisplayName = this.manualDisplayName;
        signal.manualMatch = true;
      }
      if (signal.accountId || signal.manualMatch) {
        const accountId = this.selectIdentity(signal);
        this.observedAccountId = accountId;
        if (snapshot.isInMatch) {
          this.matchAccountId = accountId;
        }
      }
    }

    const matchAccountConfirmed = this.matchAccountId !== undefined &&
      this.pluginState.hasActiveAccount() &&
      this.pluginState.getActiveAccount().accountId === this.matchAccountId;
    if (matchAccountConfirmed) {
      void this.pluginState.updateAccountFromSnapshot(snapshot).catch(this.reportError);
      this.updateLoadedPlaylist(snapshot);

      const queueType = this.matchQueueType ?? snapshot.queueType ?? "unknown";
      if (snapshot.result) {
        void this.pluginState.recordMatchResult({
          matchId: snapshot.matchId,
          queueType,
          outcome: snapshot.result,
          completedAt: snapshot.updatedAt
        }).catch(this.reportError);
        this.lastRecordedEarlyLeaveMatchId = undefined;
      } else if (
        snapshot.leftEarly &&
        this.lastRecordedEarlyLeaveMatchId !== snapshot.matchId
      ) {
        void this.pluginState.recordEarlyLeave(
          snapshot.matchId,
          queueType,
          snapshot.updatedAt
        ).catch(this.reportError);
        this.lastRecordedEarlyLeaveMatchId = snapshot.matchId;
      }
    }

    this.latestSnapshot = snapshot;
    this.renderActions(snapshot);
  }

  private selectIdentity(signal: AccountIdentitySignal): string {
    const previousAccountId = this.pluginState.hasActiveAccount()
      ? this.pluginState.getActiveAccount().accountId
      : undefined;
    const identity = this.pluginState.resolveIdentity(signal);
    if (identity.accountId !== previousAccountId) {
      void this.pluginState.persistActiveAccount().catch(this.reportError);
    }
    return identity.accountId;
  }

  private updateLoadedPlaylist(snapshot: LiveMatchSnapshot): void {
    if (!snapshot.isInMatch || !snapshot.gameStateLoaded) {
      return;
    }

    let pending = this.pendingQueue;
    if (pending && (
      Date.now() - pending.observedAt > MAX_PENDING_QUEUE_AGE_MS ||
      pending.matchGeneration < this.matchGeneration
    )) {
      this.pendingQueue = undefined;
      pending = undefined;
    }
    const applicable = pending?.matchGeneration === this.matchGeneration
      ? pending
      : undefined;
    const pendingMatchesMatch = applicable &&
      (!applicable.queue.matchId || this.sameMatchId(snapshot.matchId, applicable.queue.matchId));
    const explicitQueue = snapshot.playlistId !== undefined
      ? snapshot.queueType ?? "unknown"
      : snapshot.queueType !== "unknown" ? snapshot.queueType : undefined;
    const pendingMatchesAccount = applicable &&
      (!applicable.accountId || applicable.accountId === this.matchAccountId);
    const queueType = explicitQueue ??
      (pendingMatchesAccount && pendingMatchesMatch ? applicable.queue.queueType : undefined);
    if (!queueType) {
      return;
    }

    this.matchQueueType = queueType;
    if (this.pluginState.getLastMmrPlaylist() !== queueType) {
      void this.pluginState.setLastMmrPlaylist(queueType).catch(this.reportError);
    }

    if (!applicable || !pendingMatchesMatch) {
      return;
    }
    this.pendingQueue = undefined;
    if (pendingMatchesAccount && applicable.queue.queueType === queueType &&
      applicable.queue.mmr !== undefined) {
      void this.pluginState.setPlaylistRank(
        queueType,
        applicable.queue.mmr,
        estimateRank(queueType, applicable.queue.mmr)
      ).catch(this.reportError);
    }
  }

  // The game log alone proves a loaded match once the server map and its GUID follow the reservation,
  // so the Stats API feed is not required to attribute the solo-queue MMR to the signed-in account.
  private applyLoadedLogQueue(queue: RocketLeagueLogQueue): void {
    const reservation = this.logReservation;
    this.logReservation = undefined;
    const accountId = this.verifiedLogAccountId;
    if (
      !queue.matchId ||
      !reservation ||
      !accountId ||
      reservation.accountId !== accountId ||
      reservation.queue.queueType !== queue.queueType ||
      reservation.queue.mmr !== queue.mmr ||
      !this.pluginState.hasActiveAccount() ||
      this.pluginState.getActiveAccount().accountId !== accountId
    ) {
      return;
    }

    const snapshot = this.latestSnapshot;
    if (snapshot?.isInMatch && snapshot.matchId !== "unknown") {
      if (!this.sameMatchId(snapshot.matchId, queue.matchId)) {
        return;
      }
      if (snapshot.playlistId !== undefined && snapshot.queueType !== queue.queueType) {
        return;
      }
      if (this.matchAccountId !== undefined && this.matchAccountId !== accountId) {
        return;
      }
    }

    if (this.pluginState.getLastMmrPlaylist() !== queue.queueType) {
      void this.pluginState.setLastMmrPlaylist(queue.queueType).catch(this.reportError);
    }
    if (queue.mmr !== undefined) {
      void this.pluginState.setPlaylistRank(
        queue.queueType,
        queue.mmr,
        estimateRank(queue.queueType, queue.mmr)
      ).catch(this.reportError);
    }
    this.renderActions(this.latestSnapshot ?? createEmptySnapshot());
  }

  private renderActions(snapshot: LiveMatchSnapshot): void {
    const streakValue = this.pluginState.getStreakLabel();
    const mmrPlaylist = this.options.mmrPlaylist === "auto"
      ? this.pluginState.getLastMmrPlaylist()
      : this.options.mmrPlaylist;
    const mmrSummary = this.pluginState.getMmrSummary(mmrPlaylist);
    const mmrByPlaylist = this.pluginState.getMmrSummaries();
    const recordsLabel = this.pluginState.getRecordsLabel();
    const { wins, losses } = this.pluginState.getWinLossCounts();

    for (const action of this.options.actionKinds) {
      const model = renderAction(action, snapshot, {
        locale: this.options.locale,
        streakValue,
        mmrValue: mmrSummary.value,
        mmrRankLabel: mmrSummary.rankLabel,
        mmrDivision: mmrSummary.division,
        mmrDivisionEstimated: mmrSummary.divisionEstimated,
        mmrPlaylist,
        mmrByPlaylist,
        eventBannerStats: this.options.eventBannerStats,
        animateEvents: this.options.animateEvents,
        recordsLabel,
        statsScope: this.pluginState.getStatsScope(),
        statsMode: this.pluginState.getStatsMode(),
        wins,
        losses
      });
      this.sink.render(model);
    }
  }

  private sameMatchId(left: string, right: string): boolean {
    const normalize = (value: string): string => value.replace(/[{}-]/g, "").toLowerCase();
    return left !== "unknown" && normalize(left) === normalize(right);
  }
}
