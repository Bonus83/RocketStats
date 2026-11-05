import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RANK_ICON_ORDER, rankIconIndex, rankIconPath } from "../core/rank-icons.js";
import { RankDivision } from "../core/types.js";

const RANK_COLORS: Record<string, string> = {
  Unranked: "#A4AFBE",
  Bronze: "#D59663",
  Silver: "#D4DFEC",
  Gold: "#F4CE5E",
  Platinum: "#75E0F5",
  Diamond: "#70B5FF",
  Champion: "#C38BFF",
  "Grand Champion": "#FF7889",
  "Supersonic Legend": "#E8DAFF"
};

const pluginDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const cardCache = new Map<string, string>();

export function renderRankCardSvg(
  rankLabel: string | undefined,
  division?: RankDivision,
  divisionEstimated = false
): string {
  const index = rankIconIndex(rankLabel);
  const knownRank = rankLabel === RANK_ICON_ORDER[index];
  const hasDivisions = knownRank && index > 0 && index < RANK_ICON_ORDER.length - 1;
  const estimated = hasDivisions && division !== undefined && divisionEstimated;
  const cacheKey = `${knownRank ? index : -1}:${hasDivisions ? division ?? "?" : ""}:${estimated}`;
  const cached = cardCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const rank = RANK_ICON_ORDER[index] ?? RANK_ICON_ORDER[0];
  const match = /^(.*) (I{1,3})$/.exec(rank);
  const name = match?.[1] ?? rank;
  const tier = match?.[2];
  const color = RANK_COLORS[name];
  if (!color) {
    throw new Error(`Missing card color for rank "${name}".`);
  }

  const iconPath = resolve(pluginDirectory, ...rankIconPath(rank).split("/"));
  const icon = readFileSync(iconPath).toString("base64");
  const primary = !knownRank
    ? "---"
    : name === "Supersonic Legend" ? "SUPERSONIC" : name.toUpperCase();
  const secondary = name === "Supersonic Legend"
    ? "LEGEND"
    : tier ? `${tier} DIV ${estimated ? "~" : ""}${division ?? "?"}` : undefined;
  const nameSize = primary.length > 12 ? 14 : 18;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">` +
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#14213A"/><stop offset="1" stop-color="#0A111F"/>` +
    `</linearGradient></defs>` +
    `<rect width="144" height="144" fill="url(#bg)"/>` +
    `<image x="24" y="5" width="96" height="96" href="data:image/png;base64,${icon}"/>` +
    `<text x="72" y="${secondary ? 116 : 125}" text-anchor="middle" ` +
    `font-family="Arial, Helvetica, sans-serif" font-weight="800" font-style="italic" ` +
    `font-size="${nameSize}" fill="${color}">${primary}</text>` +
    (secondary
      ? `<text x="72" y="137" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" ` +
        `font-weight="700" font-size="${tier ? 18 : 16}" fill="${color}">${secondary}</text>`
      : "") +
    `</svg>`;
  const card = `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
  cardCache.set(cacheKey, card);
  return card;
}
