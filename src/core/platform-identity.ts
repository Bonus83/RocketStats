import { ObservedIdentityMatch, PersistedState, PlatformAccountCandidate } from "./types.js";

export function platformAccountId(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const accountId = value.trim();
  const match = /^([A-Za-z][A-Za-z0-9_]*)\|([^|\s,()]{1,128})\|(\d{1,4})$/.exec(accountId);
  if (!match || ["unknown", "bot"].includes(match[1]?.toLowerCase() ?? "") ||
      /^0+$/.test(match[2] ?? "")) {
    return undefined;
  }
  return accountId;
}

export function matchingIdentityCandidates(matches: ObservedIdentityMatch[]): string[] {
  if (matches.length === 0) {
    return [];
  }
  let candidates = new Set(matches[0]?.players.map((player) => player.accountId));
  for (const match of matches.slice(1)) {
    const players = new Set(match.players.map((player) => player.accountId));
    candidates = new Set([...candidates].filter((id) => players.has(id)));
  }
  return [...candidates];
}

export function identitySearchMatches(state: PersistedState): ObservedIdentityMatch[] {
  const byId = new Map((state.identityMatches ?? []).map((match) => [match.matchId, match]));
  return (state.identitySearchMatchIds ?? [])
    .map((id) => byId.get(id))
    .filter((match): match is ObservedIdentityMatch => match !== undefined && match.players.length > 0);
}

export function listPlatformCandidates(state: PersistedState): PlatformAccountCandidate[] {
  const observed = new Map<string, { name: string; matches: Set<string> }>();
  for (const match of state.identityMatches ?? []) {
    for (const player of match.players) {
      const current = observed.get(player.accountId) ?? { name: player.name, matches: new Set<string>() };
      current.name = player.name;
      current.matches.add(match.matchId);
      observed.set(player.accountId, current);
    }
  }

  const search = identitySearchMatches(state);
  const matching = matchingIdentityCandidates(search);
  const suggested = new Set(matching.length > 0
    ? matching
    : search.at(-1)?.players.map((player) => player.accountId) ?? []);
  const managed = new Set(state.managedPlatformIds ?? []);
  const ids = new Set([...managed, ...observed.keys()]);
  return [...ids].map((accountId) => {
    const observation = observed.get(accountId);
    const name = observation?.name ?? state.accounts[accountId]?.displayName;
    return {
      accountId,
      ...(name ? { name } : {}),
      matchesSeen: observation?.matches.size ?? 0,
      managed: managed.has(accountId),
      suggested: suggested.has(accountId)
    };
  }).sort((left, right) =>
    Number(right.suggested) - Number(left.suggested) ||
    Number(right.managed) - Number(left.managed) ||
    right.matchesSeen - left.matchesSeen ||
    left.accountId.localeCompare(right.accountId)
  );
}
