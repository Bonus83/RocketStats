import {
  AccountIdentitySignal,
  ActiveAccountIdentity,
  IdentitySource
} from "./types.js";

const MANUAL_PREFIX = "manual:";

export interface IdentityResolverOptions {
  graceWindowMs: number;
}

export class IdentityResolver {
  private readonly graceWindowMs: number;

  private lastLiveIdentity?: ActiveAccountIdentity;

  constructor(options: IdentityResolverOptions) {
    this.graceWindowMs = options.graceWindowMs;
  }

  resolve(signal: AccountIdentitySignal): ActiveAccountIdentity {
    if (signal.accountId) {
      const live = {
        accountId: signal.accountId,
        displayName: signal.liveDisplayName ||
          (this.lastLiveIdentity?.accountId === signal.accountId
            ? this.lastLiveIdentity.displayName
            : signal.accountId),
        source: "live_account" as IdentitySource,
        observedAt: signal.observedAt
      };
      this.lastLiveIdentity = live;
      return live;
    }

    if (signal.manualMatch && signal.manualDisplayName) {
      return {
        accountId: `${MANUAL_PREFIX}${signal.manualDisplayName.toLowerCase()}`,
        displayName: signal.manualDisplayName,
        source: "manual_fallback",
        observedAt: signal.observedAt
      };
    }

    if (
      this.lastLiveIdentity &&
      signal.observedAt - this.lastLiveIdentity.observedAt <= this.graceWindowMs
    ) {
      return {
        ...this.lastLiveIdentity,
        observedAt: signal.observedAt
      };
    }

    if (signal.manualDisplayName) {
      return {
        accountId: `${MANUAL_PREFIX}${signal.manualDisplayName.toLowerCase()}`,
        displayName: signal.manualDisplayName,
        source: "manual_fallback",
        observedAt: signal.observedAt
      };
    }

    return {
      accountId: "unknown",
      displayName: "Unknown",
      source: "none",
      observedAt: signal.observedAt
    };
  }
}
