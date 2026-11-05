import { PluginLocale } from "../core/types.js";
import { isSelectablePlaylist } from "../core/playlists.js";

export type BannerStat = "goals" | "assists" | "saves" | "shots" | "demos" | "score" | "ping";

export interface RocketStatsActionSettings {
  locale?: PluginLocale;
  playlist?: string;
  eventBannerStats?: BannerStat[];
  animateEvents?: boolean;
}

const LOCALES = new Set<PluginLocale>(["de", "en", "pl", "fr", "es", "pt", "ru"]);
const BANNER_STATS = new Set<BannerStat>([
  "goals",
  "assists",
  "saves",
  "shots",
  "demos",
  "score",
  "ping"
]);

export function normalizeActionSettings(input: unknown): RocketStatsActionSettings {
  if (!input || typeof input !== "object") {
    return {};
  }

  const raw = input as Record<string, unknown>;
  const settings: RocketStatsActionSettings = {};
  if (typeof raw.locale === "string" && LOCALES.has(raw.locale as PluginLocale)) {
    settings.locale = raw.locale as PluginLocale;
  }
  if (raw.playlistMode === "manual" && isSelectablePlaylist(raw.playlist)) {
    settings.playlist = raw.playlist;
  }
  if (typeof raw.animateEvents === "boolean") {
    settings.animateEvents = raw.animateEvents;
  }
  if (Array.isArray(raw.eventBannerStats)) {
    const stats = raw.eventBannerStats.filter(
      (item): item is BannerStat => typeof item === "string" && BANNER_STATS.has(item as BannerStat)
    );
    if (stats.length > 0) {
      settings.eventBannerStats = stats.slice(0, 3);
    }
  }
  return settings;
}
