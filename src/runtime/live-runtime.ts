import { randomUUID } from "node:crypto";
import {
  AccountIdentitySignal,
  createEmptySnapshot,
  LiveMatchSnapshot,
  ObservedIdentityMatch,
  PlatformAccountsSnapshot,
  PluginLocale,
  QueueType,
  StatsPeriod
} from "../core/types.js";
import { PluginState } from "../core/plugin-state.js";
import { platformAccountId } from "../core/platform-identity.js";
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
  onPlatformAccounts?: (accounts: PlatformAccountsSnapshot) => void;
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
  private verifiedFeedAccountId: string | undefined;
  private observedAccountId: string | undefined;
  private matchAccountId: string | undefined;
  private matchQueueType: QueueType | undefined;
  private matchGeneration = 0;
  private pendingQueue: PendingMatchQueue | undefined;
  private logReservation: { queue: RocketLeagueLogQueue; accountId: string | undefined } | undefined;
  private connectorConnected = false;
  private latestSnapshot: LiveMatchSnapshot | undefined;
  private currentMatchStorageId: string | undefined;
  private lastAccountsSignature = "";
  private lastVerifiedBinding = "";

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
        this.verifiedFeedAccountId = undefined;
        this.observedAccountId = undefined;
        this.lastVerifiedBinding = "";
        this.matchAccountId = undefined;
        this.pendingQueue = undefined;
        this.latestSnapshot = undefined;
        this.currentMatchStorageId = undefined;
        this.notifyPlatformAccounts();
      }
    });
  }

  start(): void {
    if (!this.pluginState.hasActiveAccount()) {
      this.pluginState.resolveIdentity({ observedAt: Date.now() });
    }
    this.connector.configureSelectedAccountId(this.pluginState.getSelectedPlatformId());
    this.notifyPlatformAccounts();
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

  async setStatsPeriod(period: StatsPeriod): Promise<void> {
    await this.pluginState.setStatsPeriod(period);
    this.renderActions(this.latestSnapshot ?? createEmptySnapshot());
  }

  async cycleStatsPeriod(): Promise<void> {
    await this.pluginState.cycleStatsPeriod();
    this.renderActions(this.latestSnapshot ?? createEmptySnapshot());
  }

  async startNewSession(): Promise<void> {
    await this.pluginState.startNewSession();
    this.renderActions(this.latestSnapshot ?? createEmptySnapshot());
  }

  getSessionInfo(): { period: StatsPeriod; startedAt: number | undefined; matchCount: number } {
    return {
      period: this.pluginState.getStatsPeriod(),
      startedAt: this.pluginState.getSessionStartedAt(),
      matchCount: this.pluginState.getSessionMatchCount()
    };
  }

  getPlatformAccounts(): PlatformAccountsSnapshot {
    return this.pluginState.getPlatformAccounts(
      this.verifiedLogAccountId ?? this.verifiedFeedAccountId
    );
  }

  async addPlatformAccount(accountId: string): Promise<void> {
    try {
      await this.pluginState.addPlatformAccount(accountId);
    } finally {
      this.notifyPlatformAccounts();
    }
  }

  async selectPlatformAccount(accountId: string, correctInferred = false): Promise<void> {
    const verified = this.verifiedLogAccountId ?? this.verifiedFeedAccountId;
    if (verified && verified !== accountId.trim()) {
      throw new Error("The account currently reported by the game takes priority.");
    }
    try {
      await this.pluginState.selectPlatformAccount(accountId, "manual", undefined, correctInferred);
    } finally {
      this.synchronizeSelectedPlatform();
    }
    const currentVerified = this.verifiedLogAccountId ?? this.verifiedFeedAccountId;
    if (currentVerified && currentVerified !== accountId.trim()) {
      throw new Error("The game account changed while the selection was being saved.");
    }
  }

  async removePlatformAccount(accountId: string): Promise<void> {
    const verified = this.verifiedLogAccountId ?? this.verifiedFeedAccountId;
    if (verified === accountId.trim()) {
      throw new Error("The account currently reported by the game cannot be removed.");
    }
    const wasSelected = this.pluginState.getSelectedPlatformId() === accountId.trim();
    try {
      await this.pluginState.removePlatformAccount(accountId);
    } finally {
      this.connector.configureSelectedAccountId(this.pluginState.getSelectedPlatformId());
      if (wasSelected && !this.pluginState.getSelectedPlatformId() &&
          !this.verifiedLogAccountId && !this.verifiedFeedAccountId) {
        this.matchAccountId = undefined;
        this.observedAccountId = undefined;
      }
      this.notifyPlatformAccounts();
      this.renderActions(this.latestSnapshot ?? createEmptySnapshot());
    }
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
      this.verifiedFeedAccountId = undefined;
      this.observedAccountId = undefined;
      this.notifyPlatformAccounts();
      return;
    }

    if (this.matchAccountId !== accountId) {
      this.matchAccountId = undefined;
    }
    this.observedAccountId = accountId;
    this.selectIdentity({ accountId, observedAt: Date.now() });
    this.rememberVerifiedAccount(
      accountId,
      this.latestSnapshot?.isInMatch ? this.currentMatchStorageId : undefined
    );
    const snapshot = { ...(this.latestSnapshot ?? createEmptySnapshot()) };
    if (snapshot.localPlayer?.accountId !== accountId) {
      delete snapshot.localPlayer;
      delete snapshot.myTeam;
    }
    this.renderActions(snapshot);
  }

  private handleSnapshot(snapshot: LiveMatchSnapshot): void {
    const previous = this.latestSnapshot;
    const newMatch = snapshot.isInMatch &&
      (snapshot.matchCreated || !previous?.isInMatch ||
        (snapshot.matchId !== "unknown" && snapshot.matchId !== previous.matchId &&
          previous.matchId !== "unknown"));
    if (newMatch) {
      this.matchGeneration += 1;
      const reconnecting = previous?.leftEarly &&
        previous.matchId === snapshot.matchId &&
        snapshot.rankedReconnectResultApplied;
      if (!reconnecting) {
        this.matchAccountId = undefined;
        this.matchQueueType = undefined;
        this.currentMatchStorageId = snapshot.matchId === "unknown"
          ? `local:${randomUUID()}`
          : snapshot.matchId;
      }
    }
    if (snapshot.isInMatch && !this.currentMatchStorageId) {
      this.currentMatchStorageId = snapshot.matchId === "unknown"
        ? `local:${randomUUID()}`
        : snapshot.matchId;
    } else if (
      this.currentMatchStorageId?.startsWith("local:") &&
      snapshot.matchId !== "unknown"
    ) {
      try {
        const saved = this.pluginState.renameIdentityMatch(this.currentMatchStorageId, snapshot.matchId);
        void saved?.catch(this.reportError);
        this.currentMatchStorageId = snapshot.matchId;
      } catch (error) {
        this.reportError(error);
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
      if (local.matchedBySelectedAccount && local.accountId) {
        const selected = this.pluginState.getSelectedPlatformId();
        if (selected === local.accountId) {
          const current = this.pluginState.getPlatformAccounts().selectionSource;
          if (!this.pluginState.hasActiveAccount() ||
              this.pluginState.getActiveAccount().accountId !== selected) {
            void this.pluginState.selectPlatformAccount(
              selected,
              current === "inferred" ? "inferred" : "manual"
            ).catch(this.reportError);
          }
          this.observedAccountId = selected;
          if (snapshot.isInMatch) this.matchAccountId = selected;
        }
      } else if (local.accountId) {
        this.verifiedFeedAccountId = local.accountId;
        signal.accountId = local.accountId;
        signal.liveDisplayName = local.name;
      } else if (local.matchedByManualName && this.manualDisplayName) {
        signal.manualDisplayName = this.manualDisplayName;
        signal.manualMatch = true;
      }
      if (signal.accountId || signal.manualMatch) {
        const accountId = this.selectIdentity(signal);
        this.observedAccountId = accountId;
        if (signal.accountId) {
          this.rememberVerifiedAccount(accountId, snapshot.isInMatch ? this.currentMatchStorageId : undefined);
        }
        if (snapshot.isInMatch) {
          this.matchAccountId = accountId;
        }
      }
    }

    const matchAccountConfirmed = this.matchAccountId !== undefined &&
      this.pluginState.hasActiveAccount() &&
      this.pluginState.getActiveAccount().accountId === this.matchAccountId;
    const storageId = this.currentMatchStorageId ?? snapshot.matchId;
    const searching = !matchAccountConfirmed || snapshot.localPlayer?.matchedByManualName === true;
    if (
      storageId !== "unknown" &&
      (searching || snapshot.localPlayer?.matchedBySelectedAccount === true ||
        this.pluginState.hasIdentityMatch(storageId))
    ) {
      try {
        const observation = this.pluginState.observeIdentityMatch(
          storageId,
          snapshot,
          searching,
          this.pendingSoloMmr(snapshot)
        );
        void observation.saved?.catch(this.reportError);
        const inferred = observation.inferredAccountId;
        if (inferred && searching && !this.verifiedLogAccountId && !this.verifiedFeedAccountId) {
          void this.pluginState.selectPlatformAccount(inferred, "inferred").catch((error: unknown) => {
            this.synchronizeSelectedPlatform();
            this.reportError(error);
          });
          if (this.pluginState.getSelectedPlatformId() === inferred) {
            this.connector.configureSelectedAccountId(inferred);
            this.observedAccountId = inferred;
          }
        }
        if (observation.accountsChanged || inferred) {
          this.notifyPlatformAccounts();
        }
      } catch (error) {
        this.reportError(error);
      }
    }
    if (matchAccountConfirmed) {
      if (!snapshot.localPlayer?.matchedBySelectedAccount) {
        void this.pluginState.updateAccountFromSnapshot(snapshot).catch(this.reportError);
      }
      this.updateLoadedPlaylist(snapshot);

      const queueType = this.matchQueueType ?? snapshot.queueType ?? "unknown";
      if (snapshot.result) {
        void this.pluginState.recordMatchResult({
          matchId: storageId,
          queueType,
          outcome: snapshot.result,
          completedAt: snapshot.updatedAt
        }).catch(this.reportError);
        this.lastRecordedEarlyLeaveMatchId = undefined;
      } else if (
        snapshot.leftEarly &&
        this.lastRecordedEarlyLeaveMatchId !== storageId
      ) {
        void this.pluginState.recordEarlyLeave(
          storageId,
          queueType,
          snapshot.updatedAt
        ).catch(this.reportError);
        this.lastRecordedEarlyLeaveMatchId = storageId;
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

  private rememberVerifiedAccount(accountId: string, matchId?: string): void {
    if (!platformAccountId(accountId)) {
      return;
    }
    const binding = `${accountId}\0${matchId ?? ""}`;
    if (this.lastVerifiedBinding === binding && this.pluginState.getSelectedPlatformId() === accountId) {
      return;
    }
    const accounts = this.pluginState.getPlatformAccounts();
    if (
      this.lastVerifiedBinding !== binding ||
      accounts.selectedAccountId !== accountId ||
      accounts.selectionSource !== "verified" ||
      !accounts.accounts.some((entry) => entry.accountId === accountId && entry.managed)
    ) {
      this.lastVerifiedBinding = binding;
      void this.pluginState.selectPlatformAccount(accountId, "verified", matchId).catch((error: unknown) => {
        this.synchronizeSelectedPlatform();
        this.reportError(error);
      });
      this.connector.configureSelectedAccountId(this.pluginState.getSelectedPlatformId());
    }
    this.notifyPlatformAccounts();
  }

  private synchronizeSelectedPlatform(): void {
    const selected = this.pluginState.getSelectedPlatformId();
    const verified = this.verifiedLogAccountId ?? this.verifiedFeedAccountId;
    this.connector.configureSelectedAccountId(selected);
    const snapshot = this.latestSnapshot;
    if (snapshot?.isInMatch && selected && (!verified || verified === selected)) {
      const matches = snapshot.players?.filter((player) => player.accountId === selected) ?? [];
      if (matches.length === 1 && matches[0]) {
        this.matchAccountId = selected;
        this.observedAccountId = selected;
        this.latestSnapshot = {
          ...snapshot,
          localPlayer: {
            ...matches[0],
            ...(!verified ? { matchedBySelectedAccount: true } : {})
          },
          myTeam: matches[0].team
        };
        this.updateLoadedPlaylist(this.latestSnapshot);
      } else {
        this.matchAccountId = undefined;
        this.observedAccountId = verified;
      }
    } else {
      this.observedAccountId = verified ?? selected;
      if (snapshot?.isInMatch) this.matchAccountId = undefined;
    }
    this.notifyPlatformAccounts();
    this.renderActions(this.latestSnapshot ?? createEmptySnapshot());
  }

  private notifyPlatformAccounts(): void {
    if (!this.options.onPlatformAccounts) {
      return;
    }
    const accounts = this.getPlatformAccounts();
    const signature = JSON.stringify(accounts);
    if (signature !== this.lastAccountsSignature) {
      this.lastAccountsSignature = signature;
      this.options.onPlatformAccounts(accounts);
    }
  }

  private pendingSoloMmr(snapshot: LiveMatchSnapshot): ObservedIdentityMatch["soloMmr"] {
    const pending = this.pendingQueue;
    const selected = this.pluginState.getSelectedPlatformId();
    const selectedPending = pending?.accountId !== undefined &&
      !this.verifiedLogAccountId && !this.verifiedFeedAccountId &&
      pending.accountId === selected &&
      snapshot.localPlayer?.matchedBySelectedAccount === true &&
      snapshot.localPlayer.accountId === selected;
    if (
      !pending || (pending.accountId !== undefined && !selectedPending) ||
      pending.matchGeneration !== this.matchGeneration ||
      Date.now() - pending.observedAt > MAX_PENDING_QUEUE_AGE_MS ||
      !snapshot.isInMatch || !snapshot.gameStateLoaded ||
      pending.queue.queueType === "unknown" ||
      pending.queue.mmr === undefined || !Number.isFinite(pending.queue.mmr) ||
      (snapshot.queueType !== "unknown" && snapshot.queueType !== pending.queue.queueType) ||
      (pending.queue.matchId && !this.sameMatchId(snapshot.matchId, pending.queue.matchId))
    ) {
      return undefined;
    }
    return {
      value: pending.queue.mmr,
      observedAt: pending.observedAt,
      playlist: pending.queue.queueType
    };
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
    if (queueType !== "unknown" && this.pluginState.getLastMmrPlaylist() !== queueType) {
      void this.pluginState.setLastMmrPlaylist(queueType).catch(this.reportError);
    }

    if (!applicable || !pendingMatchesMatch) {
      return;
    }
    this.pendingQueue = undefined;
    if (queueType !== "unknown" && pendingMatchesAccount && applicable.queue.queueType === queueType &&
      applicable.queue.mmr !== undefined &&
      !snapshot.localPlayer?.matchedBySelectedAccount) {
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

    if (queue.queueType !== "unknown" && this.pluginState.getLastMmrPlaylist() !== queue.queueType) {
      void this.pluginState.setLastMmrPlaylist(queue.queueType).catch(this.reportError);
    }
    if (queue.queueType !== "unknown" && queue.mmr !== undefined) {
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
    const recordStreaks = this.pluginState.getRecordStreaks();
    const recordsLabel = `W${recordStreaks.longestWinStreak} L${recordStreaks.longestLossStreak}`;
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
        ...recordStreaks,
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
