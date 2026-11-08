import { LiveGameplayEventType, LiveMatchSnapshot, MmrSummary, PluginLocale, QueueType, RankDivision, StatsScope, Team } from "../core/types.js";
import { mmrKeyTitle, shortPlaylistLabel } from "../core/playlists.js";
import { MessageKey, msg } from "../i18n/messages.js";
import { renderRankCardSvg } from "./rank-card.js";

export type ActionKind =
  | "score"
  | "timer"
  | "boost"
  | "event-banner"
  | "last-goal"
  | "streak"
  | "mmr"
  | "queue-status"
  | "ban-countdown"
  | "speed"
  | "ping"
  | "possession"
  | "records"
  | "goals"
  | "assists"
  | "saves"
  | "shots"
  | "demos"
  | "flip-resets"
  | "touches"
  | "player-score"
  | "stats-scope"
  | "stats-reset"
  | "rank"
  | "mmr-wl";

export interface KeyRenderModel {
  action: ActionKind;
  title: string;
  value: string;
  footer: string;
  accent: string;
  titleKey?: MessageKey | undefined;
  valueKey?: MessageKey | undefined;
  footerKey?: MessageKey | undefined;
  /** Keys with an image show only the image; their title is cleared. */
  image?: string;
  wins?: number;
  losses?: number;
  pingMs?: number;
  lastGoalScorer?: string | undefined;
  lastGoalSpeedKph?: number | undefined;
  statsScope?: StatsScope;
  statsMode?: QueueType | undefined;
  mmrByPlaylist?: Record<string, MmrSummary>;
  mmrPlaylist?: string | undefined;
  mmrTitleBase?: string;
  eventType?: LiveGameplayEventType;
  eventId?: number;
  animateEvents?: boolean;
  eventStatValues?: Record<
    "goals" | "assists" | "saves" | "shots" | "demos" | "score" | "ping",
    string
  >;
  eventSpeed?: string;
}

export interface RenderContext {
  locale: PluginLocale;
  streakValue: string;
  mmrValue: string;
  mmrRankLabel: string;
  mmrDivision: RankDivision | undefined;
  mmrDivisionEstimated: boolean | undefined;
  mmrPlaylist: string | undefined;
  mmrByPlaylist: Record<string, MmrSummary>;
  eventBannerStats: Array<"goals" | "assists" | "saves" | "shots" | "demos" | "score" | "ping">;
  animateEvents: boolean;
  recordsLabel: string;
  longestWinStreak: number;
  longestLossStreak: number;
  statsScope: StatsScope;
  statsMode: QueueType | undefined;
  wins: number;
  losses: number;
}

const TEAM_ACCENT: Record<Team, string> = {
  blue: "#2F77FF",
  orange: "#D07A21"
};

const DEFAULT_CONTEXT: RenderContext = {
  locale: "en",
  streakValue: "W0/L0",
  mmrValue: "---",
  mmrRankLabel: "",
  mmrDivision: undefined,
  mmrDivisionEstimated: undefined,
  mmrPlaylist: undefined,
  mmrByPlaylist: {},
  eventBannerStats: ["goals", "assists", "saves"],
  animateEvents: true,
  recordsLabel: "W0 L0",
  longestWinStreak: 0,
  longestLossStreak: 0,
  statsScope: "all",
  statsMode: undefined,
  wins: 0,
  losses: 0
};

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

export function streakColor(value: string): string {
  if (/^W[1-9]/.test(value)) return "#3EDB8D";
  if (/^L[1-9]/.test(value)) return "#FF4D4D";
  return "#FFFFFF";
}

/** Streak key artwork: title, coloured streak value and optional mode line (144x144). */
export function renderStreakCardSvg(title: string, value: string, footer: string): string {
  const titleSize = title.length > 7 ? 18 : 22;
  const valueSize = value.length <= 3 ? 52 : value.length === 4 ? 40 : 32;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">` +
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#14213A"/><stop offset="1" stop-color="#0A111F"/>` +
    `</linearGradient></defs>` +
    `<rect width="144" height="144" fill="url(#bg)"/>` +
    `<text x="72" y="36" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" ` +
    `font-weight="700" font-size="${titleSize}" fill="#8E9BB3">${escapeXml(title)}</text>` +
    `<text x="72" y="${footer ? 93 : 100}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" ` +
    `font-weight="900" font-style="italic" font-size="${valueSize}" fill="${streakColor(value)}">${escapeXml(value)}</text>` +
    (footer
      ? `<text x="72" y="128" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" ` +
        `font-weight="700" font-size="20" fill="#8E9BB3">${escapeXml(footer)}</text>`
      : "") +
    `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

export function pingColor(pingMs: number | undefined): string {
  if (pingMs === undefined) return "#FFFFFF";
  if (pingMs < 50) return "#3EDB8D";
  if (pingMs < 100) return "#F5A623";
  return "#FF4D4D";
}

/** Ping key artwork: title and coloured value with "ms" right behind it (144x144). */
export function renderPingCardSvg(title: string, pingMs: number | undefined, unit: string): string {
  const value = pingMs === undefined ? "--" : `${Math.round(pingMs)}`;
  const color = pingColor(pingMs);
  const valueSize = value.length <= 2 ? 50 : value.length === 3 ? 42 : 34;
  const unitPart = pingMs === undefined
    ? ""
    : `<tspan font-size="${Math.round(valueSize * 0.5)}" font-style="normal" dx="3">${escapeXml(unit.toLowerCase())}</tspan>`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">` +
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#14213A"/><stop offset="1" stop-color="#0A111F"/>` +
    `</linearGradient></defs>` +
    `<rect width="144" height="144" fill="url(#bg)"/>` +
    `<text x="72" y="36" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" ` +
    `font-weight="700" font-size="22" fill="#8E9BB3">${escapeXml(title)}</text>` +
    `<text x="72" y="100" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" ` +
    `font-weight="900" font-style="italic" font-size="${valueSize}" fill="${color}">${escapeXml(value)}${unitPart}</text>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

/** Last-goal key artwork: scorer and goal speed in a compact card (144x144). */
export function renderLastGoalCardSvg(
  title: string,
  scorer: string | undefined,
  speedKph: number | undefined,
  unit: string
): string {
  const safeScorer = scorer?.trim() || "--";
  const safeSpeed = speedKph === undefined ? "--" : `${Math.round(speedKph)}`;
  const scorerSize = safeScorer.length > 12 ? 15 : 19;
  const speedSize = safeSpeed.length > 3 ? 34 : 42;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">` +
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#14213A"/><stop offset="1" stop-color="#0A111F"/>` +
    `</linearGradient></defs>` +
    `<rect x="2" y="2" width="140" height="140" rx="14" fill="url(#bg)" stroke="#34415A" stroke-width="2"/>` +
    `<text x="72" y="25" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" ` +
    `font-weight="700" font-size="12" fill="#8E9BB3">${escapeXml(title)}</text>` +
    `<text x="72" y="53" text-anchor="middle" textLength="124" lengthAdjust="spacingAndGlyphs" ` +
    `font-family="Arial, Helvetica, sans-serif" font-weight="700" font-style="italic" ` +
    `font-size="${scorerSize}" fill="#F4F7FB">${escapeXml(safeScorer)}</text>` +
    `<text x="72" y="101" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" ` +
    `font-weight="900" font-style="italic" font-size="${speedSize}" fill="#923DE1">${escapeXml(safeSpeed)}</text>` +
    `<text x="72" y="126" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" ` +
    `font-weight="700" font-size="14" fill="#8E9BB3">${escapeXml(unit.toLowerCase())}</text>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

/** Scope toggle artwork: a two-way switch "all" / current mode with the active side lit (144x144). */
export function renderScopeCardSvg(
  allLabel: string,
  modeLabel: string,
  modeCaption: string,
  scope: StatsScope
): string {
  const active = "#3EDB8D";
  const allActive = scope === "all";
  const pill = (y: number, label: string, on: boolean): string => {
    const size = label.length > 7 ? 15 : label.length > 5 ? 18 : 20;
    return (
      `<rect x="14" y="${y}" width="116" height="34" rx="17" ` +
      (on
        ? `fill="${active}" />`
        : `fill="none" stroke="#2C3A55" stroke-width="2"/>`) +
      `<text x="72" y="${y + 23}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" ` +
      `font-weight="900" font-size="${size}" fill="${on ? "#0A111F" : "#5E6B85"}">${escapeXml(label)}</text>`
    );
  };
  const modeText = modeLabel === "?" ? modeCaption : modeLabel;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">` +
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#14213A"/><stop offset="1" stop-color="#0A111F"/>` +
    `</linearGradient></defs>` +
    `<rect width="144" height="144" fill="url(#bg)"/>` +
    `<text x="72" y="32" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" ` +
    `font-weight="700" font-size="22" fill="#8E9BB3">` +
    `<tspan fill="#3EDB8D">W</tspan><tspan fill="#8E9BB3">/</tspan><tspan fill="#FF4D4D">L</tspan></text>` +
    pill(46, allLabel, allActive) +
    pill(90, modeText, !allActive) +
    `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

export function renderRecordsCardSvg(
  title: string,
  longestWinStreak: number,
  longestLossStreak: number,
  footer: string
): string {
  const titleSize = title.length > 16 ? 12 : title.length > 12 ? 14 : 16;
  const valueSize = `W${longestWinStreak}  L${longestLossStreak}`.length > 9
    ? 22
    : `W${longestWinStreak}  L${longestLossStreak}`.length > 7 ? 26 : 32;
  const footerSvg = footer
    ? `<text x="72" y="128" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" ` +
      `font-weight="600" font-size="12" fill="#8E9BB3">${escapeXml(footer)}</text>`
    : "";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">` +
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#14213A"/><stop offset="1" stop-color="#0A111F"/>` +
    `</linearGradient></defs>` +
    `<rect width="144" height="144" fill="url(#bg)"/>` +
    `<text x="72" y="36" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" ` +
    `font-weight="700" font-size="${titleSize}" fill="#8E9BB3">${escapeXml(title)}</text>` +
    `<text x="72" y="94" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" ` +
    `font-weight="900" font-size="${valueSize}">` +
    `<tspan fill="#3EDB8D">W${longestWinStreak}</tspan>` +
    `<tspan fill="#8E9BB3" xml:space="preserve">  </tspan>` +
    `<tspan fill="#FF4D4D">L${longestLossStreak}</tspan></text>` +
    footerSvg +
    `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

export interface MmrCardInput {
  titleBase: string;
  playlist: string | undefined;
  value: string;
  wins: number;
  losses: number;
}

/** Combined MMR + win/loss key artwork as an SVG data URL (144x144). */
export function renderMmrCardSvg(input: MmrCardInput): string {
  const title = input.playlist
    ? `${input.titleBase} ${shortPlaylistLabel(input.playlist)}`
    : input.titleBase;
  const titleSize = title.length > 7 ? 18 : 22;
  const valueSize = input.value.length <= 3 ? 52 : input.value.length === 4 ? 44 : 36;
  const winLossSize = `${input.wins}W ${input.losses}L`.length > 7 ? 19 : 24;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">` +
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#14213A"/><stop offset="1" stop-color="#0A111F"/>` +
    `</linearGradient></defs>` +
    `<rect width="144" height="144" fill="url(#bg)"/>` +
    `<text x="72" y="36" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" ` +
    `font-weight="700" font-size="${titleSize}" fill="#8E9BB3">${escapeXml(title)}</text>` +
    `<text x="72" y="93" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" ` +
    `font-weight="900" font-style="italic" font-size="${valueSize}" fill="#FFFFFF">${escapeXml(input.value)}</text>` +
    `<text x="72" y="128" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" ` +
    `font-weight="900" font-size="${winLossSize}">` +
    `<tspan fill="#3EDB8D">${input.wins}W</tspan><tspan fill="#FFFFFF" xml:space="preserve">  </tspan>` +
    `<tspan fill="#FF4D4D">${input.losses}L</tspan></text>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

function scopeFooter(ctx: RenderContext): string {
  return ctx.statsScope === "mode" ? shortPlaylistLabel(ctx.statsMode) : "";
}

export function renderAction(
  action: ActionKind,
  snapshot: LiveMatchSnapshot,
  context: Partial<RenderContext> = {}
): KeyRenderModel {
  const ctx: RenderContext = { ...DEFAULT_CONTEXT, ...context };
  switch (action) {
    case "score":
      return renderScore(snapshot, ctx.locale);
    case "timer":
      return renderTimer(snapshot, ctx.locale);
    case "boost":
      return renderBoost(snapshot, ctx.locale);
    case "event-banner":
      return renderEventBanner(snapshot, ctx.locale, ctx.eventBannerStats, ctx.animateEvents);
    case "last-goal":
      return {
        action: "last-goal",
        title: "",
        value: snapshot.lastGoal?.scorer ?? "--",
        footer: snapshot.lastGoal?.speedKph === undefined
          ? `-- ${msg(ctx.locale, "kmh").toLowerCase()}`
          : `${Math.round(snapshot.lastGoal.speedKph)} ${msg(ctx.locale, "kmh").toLowerCase()}`,
        accent: "#923DE1",
        image: renderLastGoalCardSvg(
          msg(ctx.locale, "lastGoal"),
          snapshot.lastGoal?.scorer,
          snapshot.lastGoal?.speedKph,
          msg(ctx.locale, "kmh")
        ),
        ...(snapshot.lastGoal ? { lastGoalScorer: snapshot.lastGoal.scorer } : {}),
        ...(snapshot.lastGoal?.speedKph === undefined
          ? {}
          : { lastGoalSpeedKph: snapshot.lastGoal.speedKph })
      };
    case "streak":
      return {
        action: "streak",
        title: msg(ctx.locale, "streak"),
        value: ctx.streakValue,
        footer: scopeFooter(ctx),
        accent: streakColor(ctx.streakValue),
        titleKey: "streak",
        image: renderStreakCardSvg(msg(ctx.locale, "streak"), ctx.streakValue, scopeFooter(ctx))
      };
    case "mmr":
      return {
        action: "mmr",
        title: mmrKeyTitle(msg(ctx.locale, "mmr"), ctx.mmrPlaylist),
        value: ctx.mmrValue,
        footer: ctx.mmrValue === "---" ? "" : ctx.mmrRankLabel,
        accent: "#2F77FF",
        mmrByPlaylist: ctx.mmrByPlaylist,
        mmrPlaylist: ctx.mmrPlaylist,
        mmrTitleBase: msg(ctx.locale, "mmr"),
        titleKey: "mmr"
      };
    case "queue-status":
      return renderQueueStatus(snapshot, ctx.locale);
    case "ban-countdown":
      return renderBanCountdown(snapshot, ctx.locale);
    case "speed":
      return renderSpeed(snapshot, ctx.locale);
    case "ping":
      return renderPing(snapshot, ctx.locale);
    case "possession":
      return renderPossession(snapshot, ctx.locale);
    case "records":
      return {
        action: "records",
        title: msg(ctx.locale, "records"),
        value: ctx.recordsLabel,
        footer: scopeFooter(ctx),
        accent: "#3EDB8D",
        image: renderRecordsCardSvg(
          msg(ctx.locale, "longestStreaks"),
          ctx.longestWinStreak,
          ctx.longestLossStreak,
          scopeFooter(ctx)
        ),
        titleKey: "records"
      };
    case "stats-scope": {
      const image = renderScopeCardSvg(
        msg(ctx.locale, "scopeAll"),
        shortPlaylistLabel(ctx.statsMode),
        msg(ctx.locale, "scopeMode"),
        ctx.statsScope
      );
      return ctx.statsScope === "all"
        ? {
          action: "stats-scope",
          title: "W/L",
          value: msg(ctx.locale, "scopeAll"),
          footer: "",
          accent: "#3EDB8D",
          valueKey: "scopeAll",
          image,
          statsScope: ctx.statsScope,
          statsMode: ctx.statsMode
        }
        : {
          action: "stats-scope",
          title: "W/L",
          value: shortPlaylistLabel(ctx.statsMode),
          footer: msg(ctx.locale, "scopeMode"),
          accent: "#3EDB8D",
          footerKey: "scopeMode",
          image,
          statsScope: ctx.statsScope,
          statsMode: ctx.statsMode
        };
    }
    case "stats-reset":
      return {
        action: "stats-reset",
        title: msg(ctx.locale, "reset"),
        value: "W/L",
        footer: ctx.statsScope === "all"
          ? msg(ctx.locale, "scopeAll")
          : shortPlaylistLabel(ctx.statsMode),
        accent: "#D63031",
        titleKey: "reset",
        footerKey: ctx.statsScope === "all" ? "scopeAll" : undefined
      };
    case "rank":
      return {
        action: "rank",
        title: "",
        value: "",
        footer: "",
        accent: "#2F77FF",
        image: renderRankCardSvg(
          ctx.mmrValue === "---" ? undefined : ctx.mmrRankLabel,
          ctx.mmrDivision,
          ctx.mmrDivisionEstimated
        ),
        mmrByPlaylist: ctx.mmrByPlaylist,
        mmrPlaylist: ctx.mmrPlaylist
      };
    case "mmr-wl":
      return {
        action: "mmr-wl",
        title: "",
        value: ctx.mmrValue,
        footer: "",
        accent: "#2F77FF",
        image: renderMmrCardSvg({
          titleBase: msg(ctx.locale, "mmr"),
          playlist: ctx.mmrPlaylist,
          value: ctx.mmrValue,
          wins: ctx.wins,
          losses: ctx.losses
        }),
        wins: ctx.wins,
        losses: ctx.losses,
        mmrByPlaylist: ctx.mmrByPlaylist,
        mmrPlaylist: ctx.mmrPlaylist
      };
    case "goals":
      return renderPlayerStat("goals", "goals", snapshot.localPlayer?.goals, "#3EDB8D", ctx.locale);
    case "assists":
      return renderPlayerStat("assists", "assists", snapshot.localPlayer?.assists, "#4AA8FF", ctx.locale);
    case "saves":
      return renderPlayerStat("saves", "saves", snapshot.localPlayer?.saves, "#B369E3", ctx.locale);
    case "shots":
      return renderPlayerStat("shots", "shots", snapshot.localPlayer?.shots, "#F2BE3E", ctx.locale);
    case "demos":
      return renderPlayerStat("demos", "demos", snapshot.localPlayer?.demos, "#EC5E53", ctx.locale);
    case "flip-resets":
      return renderPlayerStat("flip-resets", "flipResets", snapshot.localPlayer?.flipResets, "#23C2D1", ctx.locale);
    case "touches":
      return renderPlayerStat("touches", "touches", snapshot.localPlayer?.touches, "#2BD49C", ctx.locale);
    case "player-score":
      return renderPlayerStat("player-score", "playerScore", snapshot.localPlayer?.score, "#F5F7FA", ctx.locale);
    default:
      return {
        action,
        title: msg(ctx.locale, "unknown"),
        value: "-",
        footer: "",
        accent: "#7A869E"
      };
  }
}

function renderScore(snapshot: LiveMatchSnapshot, locale: PluginLocale): KeyRenderModel {
  return {
    action: "score",
    title: msg(locale, "score"),
    value: `${snapshot.blueScore} - ${snapshot.orangeScore}`,
    footer: snapshot.isInMatch ? msg(locale, "live") : msg(locale, "notInMatch"),
    accent: snapshot.myTeam ? TEAM_ACCENT[snapshot.myTeam] : "#7A869E",
    titleKey: "score",
    footerKey: snapshot.isInMatch ? "live" : "notInMatch"
  };
}

function renderTimer(snapshot: LiveMatchSnapshot, locale: PluginLocale): KeyRenderModel {
  const mins = Math.floor(snapshot.gameClockSeconds / 60);
  const secs = Math.floor(snapshot.gameClockSeconds % 60);
  const clock = `${mins}:${secs.toString().padStart(2, "0")}`;
  const mode = snapshot.isPaused ? msg(locale, "paused") : snapshot.isOvertime ? "OT" : msg(locale, "timeLeft");

  return {
    action: "timer",
    title: msg(locale, "timer"),
    value: clock,
    footer: mode,
    accent: snapshot.isOvertime ? "#3EDB8D" : "#E8ECF6",
    titleKey: "timer",
    footerKey: snapshot.isPaused ? "paused" : snapshot.isOvertime ? undefined : "timeLeft"
  };
}

function renderBoost(snapshot: LiveMatchSnapshot, locale: PluginLocale): KeyRenderModel {
  const player = snapshot.localPlayer;
  const boost = player?.boost ?? 0;
  return {
    action: "boost",
    title: msg(locale, "boost"),
    value: player ? `${Math.round(boost)}` : "--",
    footer: !player
      ? msg(locale, "playerNotFound")
      : player.supersonic
        ? msg(locale, "supersonic")
        : "%",
    accent: !player ? "#7A869E" : boost >= 60 ? "#3EDB8D" : boost >= 30 ? "#F2BE3E" : "#EC5E53",
    titleKey: "boost",
    footerKey: !player ? "playerNotFound" : player.supersonic ? "supersonic" : undefined
  };
}

function renderEventBanner(
  snapshot: LiveMatchSnapshot,
  locale: PluginLocale,
  selectedStats: RenderContext["eventBannerStats"],
  animateEvents: boolean
): KeyRenderModel {
  const statSummary = summarizeStats(snapshot, selectedStats);
  const eventStatValues = getEventStatValues(snapshot);
  if (snapshot.latestEvent && snapshot.latestEvent.type !== "goal") {
    return {
      action: "event-banner",
      title: msg(locale, snapshot.latestEvent.type),
      value: snapshot.latestEvent.label ?? msg(locale, "event"),
      footer: snapshot.latestEvent.value ?? statSummary,
      accent: "#3EDB8D",
      eventType: snapshot.latestEvent.type,
      eventId: snapshot.latestEvent.occurredAt,
      animateEvents,
      titleKey: snapshot.latestEvent.type,
      eventStatValues
    };
  }
  if (!snapshot.lastGoal) {
    return {
      action: "event-banner",
      title: msg(locale, "event"),
      value: snapshot.isInMatch ? msg(locale, "live") : msg(locale, "waiting"),
      footer: statSummary || snapshot.localPlayer?.name || msg(locale, "playerNotFound"),
      accent: "#3EDB8D",
      eventStatValues,
      titleKey: "event",
      footerKey: statSummary ? undefined : snapshot.localPlayer?.name ? undefined : "playerNotFound"
    };
  }

  const speed = snapshot.lastGoal.speedKph
    ? `${Math.round(snapshot.lastGoal.speedKph)} ${msg(locale, "kmh")}`
    : "-";
  return {
    action: "event-banner",
    title: msg(locale, "lastGoal"),
    value: snapshot.lastGoal.scorer,
    footer: statSummary ? `${speed} ${statSummary}`.trim() : speed,
    accent: TEAM_ACCENT[snapshot.lastGoal.team],
    eventType: "goal",
    eventId: snapshot.lastGoal.occurredAt,
    animateEvents,
    titleKey: "lastGoal",
    eventStatValues,
    eventSpeed: speed
  };
}

function renderQueueStatus(snapshot: LiveMatchSnapshot, locale: PluginLocale): KeyRenderModel {
  const elapsed = formatSeconds(snapshot.searchElapsedSeconds);
  return {
    action: "queue-status",
    title: msg(locale, "queue"),
    value: snapshot.isSearching ? msg(locale, "searching") : msg(locale, "idle"),
    footer: snapshot.isSearching ? elapsed : snapshot.searchingPlaylists.join(", ").slice(0, 12),
    accent: snapshot.isSearching ? "#3EDB8D" : "#7A869E",
    titleKey: "queue",
    footerKey: snapshot.isSearching ? "searching" : "idle"
  };
}

function renderBanCountdown(snapshot: LiveMatchSnapshot, locale: PluginLocale): KeyRenderModel {
  return {
    action: "ban-countdown",
    title: msg(locale, "ban"),
    value: snapshot.banRemainingSeconds > 0 ? formatSeconds(snapshot.banRemainingSeconds) : msg(locale, "clear"),
    footer: snapshot.banRemainingSeconds > 0 ? msg(locale, "timeLeft") : "",
    accent: snapshot.banRemainingSeconds > 0 ? "#EC5E53" : "#3EDB8D",
    titleKey: "ban",
    footerKey: snapshot.banRemainingSeconds > 0 ? "timeLeft" : "clear"
  };
}

function renderSpeed(snapshot: LiveMatchSnapshot, locale: PluginLocale): KeyRenderModel {
  const player = snapshot.localPlayer;
  const kph = Math.round(player?.speedKph ?? 0);
  return {
    action: "speed",
    title: msg(locale, "speed"),
    value: player ? `${kph} ${msg(locale, "kmh")}` : "--",
    footer: !player
      ? msg(locale, "playerNotFound")
      : player.supersonic
        ? msg(locale, "supersonic")
        : "",
    accent: !player ? "#7A869E" : player.supersonic ? "#3EDB8D" : "#2F77FF",
    titleKey: "speed",
    footerKey: !player ? "playerNotFound" : player.supersonic ? "supersonic" : undefined
  };
}

function renderPing(snapshot: LiveMatchSnapshot, locale: PluginLocale): KeyRenderModel {
  const ping = snapshot.localPlayer?.pingMs;
  const pingMs = typeof ping === "number" ? ping : undefined;
  return {
    action: "ping",
    title: msg(locale, "ping"),
    value: pingMs === undefined ? "--" : `${Math.round(pingMs)}`,
    footer: msg(locale, "ms"),
    accent: pingColor(pingMs),
    titleKey: "ping",
    image: renderPingCardSvg(msg(locale, "ping"), pingMs, msg(locale, "ms")),
    ...(pingMs === undefined ? {} : { pingMs })
  };
}

function renderPossession(snapshot: LiveMatchSnapshot, locale: PluginLocale): KeyRenderModel {
  const player = snapshot.localPlayer;
  return {
    action: "possession",
    title: msg(locale, "possession"),
    value: !player
      ? "--"
      : player.hasBallPossession
        ? msg(locale, "yes")
        : msg(locale, "no"),
    footer: player?.name ?? msg(locale, "playerNotFound"),
    accent: player?.hasBallPossession ? "#3EDB8D" : "#7A869E",
    titleKey: "possession",
    footerKey: player ? undefined : "playerNotFound"
  };
}

function formatSeconds(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function renderPlayerStat(
  action: Extract<
    ActionKind,
    "goals" | "assists" | "saves" | "shots" | "demos" | "flip-resets" | "touches" | "player-score"
  >,
  titleKey: MessageKey,
  value: number | undefined,
  accent: string,
  locale: PluginLocale
): KeyRenderModel {
  const available = value !== undefined;
  return {
    action,
    title: msg(locale, titleKey),
    value: available ? `${Math.max(0, Math.round(value))}` : "--",
    footer: available ? "" : msg(locale, "playerNotFound"),
    accent,
    titleKey,
    footerKey: available ? undefined : "playerNotFound"
  };
}

function summarizeStats(
  snapshot: LiveMatchSnapshot,
  selectedStats: RenderContext["eventBannerStats"]
): string {
  if (!snapshot.localPlayer) {
    return "";
  }
  const map: Record<RenderContext["eventBannerStats"][number], string> = {
    goals: `G${snapshot.localPlayer.goals}`,
    assists: `A${snapshot.localPlayer.assists}`,
    saves: `S${snapshot.localPlayer.saves}`,
    shots: `Sh${snapshot.localPlayer.shots}`,
    demos: `D${snapshot.localPlayer.demos}`,
    score: `Sc${snapshot.localPlayer.score}`,
    ping: `P${Math.round(snapshot.localPlayer.pingMs ?? 0)}`
  };
  return selectedStats
    .slice(0, 3)
    .map((key) => map[key])
    .join(" ");
}

function getEventStatValues(
  snapshot: LiveMatchSnapshot
): NonNullable<KeyRenderModel["eventStatValues"]> {
  const player = snapshot.localPlayer;
  if (!player) {
    return {
      goals: "--",
      assists: "--",
      saves: "--",
      shots: "--",
      demos: "--",
      score: "--",
      ping: "--"
    };
  }
  return {
    goals: `G${player.goals}`,
    assists: `A${player.assists}`,
    saves: `S${player.saves}`,
    shots: `Sh${player.shots}`,
    demos: `D${player.demos}`,
    score: `Sc${player.score}`,
    ping: `P${Math.round(player.pingMs ?? 0)}`
  };
}
