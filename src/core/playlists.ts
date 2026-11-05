import { QueueType } from "./types.js";

const PLAYLIST_TYPES = new Map<number, QueueType>([
  [1, "casual"],
  [2, "casual"],
  [3, "casual"],
  [4, "casual"],
  [10, "ranked_1v1"],
  [11, "ranked_2v2"],
  [13, "ranked_3v3"],
  [61, "ranked_4v4"],
  [22, "tournament"],
  [27, "ranked_hoops"],
  [28, "ranked_rumble"],
  [29, "ranked_dropshot"],
  [30, "ranked_snow_day"],
  [63, "ranked_heatseeker"],
  [34, "tournament"]
]);

const SELECTABLE_PLAYLISTS = new Set<string>(PLAYLIST_TYPES.values());

export function queueTypeFromPlaylistId(value: unknown): QueueType | undefined {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    return undefined;
  }
  return PLAYLIST_TYPES.get(value) ?? "unknown";
}

export function isSelectablePlaylist(value: unknown): value is QueueType {
  return typeof value === "string" && SELECTABLE_PLAYLISTS.has(value);
}

const MAX_TITLE_CHARS = 7;

// Stream Deck key titles truncate after ~7 characters at the default font size.
export function mmrKeyTitle(base: string, playlist: string | undefined): string {
  const label = shortPlaylistLabel(playlist);
  const combined = `${base} ${label}`;
  return combined.length <= MAX_TITLE_CHARS ? combined : label;
}

export function shortPlaylistLabel(playlist: string | undefined): string {
  switch (playlist) {
    case "ranked_1v1": return "1v1";
    case "ranked_2v2": return "2v2";
    case "ranked_3v3": return "3v3";
    case "ranked_4v4": return "4v4";
    case "ranked_hoops": return "HOOPS";
    case "ranked_rumble": return "RUMBLE";
    case "ranked_dropshot": return "DROP";
    case "ranked_snow_day": return "SNOW";
    case "ranked_heatseeker": return "HEAT";
    case "casual": return "CASUAL";
    case "tournament": return "TOUR";
    default: return "?";
  }
}
