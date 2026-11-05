import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { queueTypeFromPlaylistId } from "./playlists.js";
import { RANK_ICON_ORDER } from "./rank-icons.js";
import { RankDivision } from "./types.js";

interface DivisionRange {
  division: RankDivision;
  min: number;
  max: number;
}

interface RankBand {
  rankLabel: string;
  lowerBound: number;
  ranges: DivisionRange[];
}

export interface RankEstimate {
  rankLabel: string;
  division?: RankDivision;
  divisionEstimated?: boolean;
}

const DIVISIONS = [1, 2, 3, 4] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseRankDistributions(input: unknown): ReadonlyMap<string, readonly RankBand[]> {
  if (!isRecord(input) || input.schemaVersion !== 1 ||
    typeof input.capturedAt !== "string" || !Number.isFinite(Date.parse(input.capturedAt)) ||
    input.source !== "https://rocketleague.tracker.network/rocket-league/distribution" ||
    !Array.isArray(input.divisionOrder) || input.divisionOrder.join(",") !== DIVISIONS.join(",") ||
    !isRecord(input.playlists) || Object.keys(input.playlists).length === 0) {
    throw new Error("Invalid rank-distributions.json metadata or playlist table.");
  }

  const tables = new Map<string, RankBand[]>();
  for (const [playlist, table] of Object.entries(input.playlists)) {
    if (!isRecord(table) || typeof table.trackerPlaylistId !== "number" ||
      queueTypeFromPlaylistId(table.trackerPlaylistId) !== playlist ||
      playlist === "casual" || playlist === "unknown" ||
      table.sourceUrl !== `${input.source}?playlist=${table.trackerPlaylistId}` ||
      !isRecord(table.ranks) || Object.keys(table.ranks).length !== RANK_ICON_ORDER.length) {
      throw new Error(`Invalid rank distribution for playlist "${playlist}".`);
    }

    const bands: RankBand[] = [];
    for (const rankLabel of RANK_ICON_ORDER) {
      const row = table.ranks[rankLabel];
      if (!Array.isArray(row) || row.length !== DIVISIONS.length) {
        throw new Error(`Expected four division cells for ${playlist}: ${rankLabel}.`);
      }
      const ranges: DivisionRange[] = [];
      for (const [index, division] of DIVISIONS.entries()) {
        const range: unknown = row[index];
        if (range === null) {
          continue;
        }
        if (!Array.isArray(range) || range.length !== 2 ||
          typeof range[0] !== "number" || typeof range[1] !== "number" ||
          !Number.isSafeInteger(range[0]) || !Number.isSafeInteger(range[1]) ||
          range[0] > range[1]) {
          throw new Error(`Invalid MMR range for ${playlist}: ${rankLabel}, division ${division}.`);
        }
        ranges.push({ division, min: range[0], max: range[1] });
      }
      // Unranked players have ratings too; their samples cannot identify a ranked tier.
      if (rankLabel === "Unranked") {
        continue;
      }
      const first = ranges[0];
      if (!first) {
        continue;
      }
      const previous = bands.at(-1);
      if (previous && first.min <= previous.lowerBound) {
        throw new Error(`Missing or unordered ranked interval for ${playlist}: ${rankLabel}.`);
      }
      bands.push({ rankLabel, lowerBound: first.min, ranges });
    }
    tables.set(playlist, bands);
  }
  return tables;
}

const tablePath = resolve(
  dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "rank-distributions.json"
);
const tables = parseRankDistributions(JSON.parse(readFileSync(tablePath, "utf8")));

function estimateDivisionFromUpperBounds(band: RankBand, rating: number): RankDivision | undefined {
  if (band.ranges.length !== DIVISIONS.length || rating < band.lowerBound) {
    return undefined;
  }
  let previousMax = Number.NEGATIVE_INFINITY;
  let division: RankDivision | undefined;
  for (const range of band.ranges) {
    if (range.max <= previousMax) {
      return undefined;
    }
    if (division === undefined && rating <= range.max) {
      division = range.division;
    }
    previousMax = range.max;
  }
  return division;
}

export function estimateRankDetails(playlist: string, mmr: number): RankEstimate | undefined {
  if (!Number.isFinite(mmr)) {
    return undefined;
  }
  const bands = tables.get(playlist);
  if (!bands) {
    return undefined;
  }
  const rating = Math.round(mmr);
  let selected = bands[0];
  for (const band of bands) {
    if (rating >= band.lowerBound) {
      selected = band;
    }
  }
  if (!selected) {
    return undefined;
  }
  if (selected.rankLabel === "Supersonic Legend") {
    return { rankLabel: selected.rankLabel };
  }
  if (selected === bands.at(-1) &&
    rating > Math.max(...selected.ranges.map((range) => range.max))) {
    return undefined;
  }

  // Listed ranges overlap and leave gaps; only a single match is unambiguous.
  const matches = bands.flatMap((band) => band.ranges
    .filter((range) => rating >= range.min && rating <= range.max)
    .map((range) => ({ rankLabel: band.rankLabel, division: range.division })));
  const match = matches[0];
  if (matches.length === 1 && match?.rankLabel === selected.rankLabel) {
    return { rankLabel: selected.rankLabel, division: match.division };
  }
  const division = estimateDivisionFromUpperBounds(selected, rating);
  return division === undefined
    ? { rankLabel: selected.rankLabel }
    : { rankLabel: selected.rankLabel, division, divisionEstimated: true };
}

export function estimateRank(playlist: string, mmr: number): string | undefined {
  return estimateRankDetails(playlist, mmr)?.rankLabel;
}
