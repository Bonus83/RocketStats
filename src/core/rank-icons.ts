/** Order of the icons in assets/ranks/rank-sheet.png (row by row, left to right). */
export const RANK_ICON_ORDER = [
  "Unranked",
  "Bronze I",
  "Bronze II",
  "Bronze III",
  "Silver I",
  "Silver II",
  "Silver III",
  "Gold I",
  "Gold II",
  "Gold III",
  "Platinum I",
  "Platinum II",
  "Platinum III",
  "Diamond I",
  "Diamond II",
  "Diamond III",
  "Champion I",
  "Champion II",
  "Champion III",
  "Grand Champion I",
  "Grand Champion II",
  "Grand Champion III",
  "Supersonic Legend"
] as const;

export function rankIconIndex(rankLabel: string | undefined): number {
  const index = RANK_ICON_ORDER.indexOf((rankLabel ?? "") as (typeof RANK_ICON_ORDER)[number]);
  return index < 0 ? 0 : index;
}

/** Image path relative to the plugin folder; the files are rendered at full key resolution. */
export function rankIconPath(rankLabel: string | undefined): string {
  return `imgs/ranks/rank-${String(rankIconIndex(rankLabel)).padStart(2, "0")}.png`;
}
