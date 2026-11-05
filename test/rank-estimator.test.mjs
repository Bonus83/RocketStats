import test from "node:test";
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const { estimateRank, estimateRankDetails, parseRankDistributions } = await import(
  "../com.rocketstats.livestats.sdPlugin/bin/core/rank-estimator.js"
);
const source = JSON.parse(await readFile(new URL(
  "../com.rocketstats.livestats.sdPlugin/data/rank-distributions.json", import.meta.url
), "utf8"));

test("rank estimate uses the selected ranked playlist thresholds", () => {
  assert.equal(estimateRank("ranked_1v1", 1_348), "Supersonic Legend");
  assert.equal(estimateRank("ranked_2v2", 1_434), "Champion III");
  assert.equal(estimateRank("ranked_2v2", 1_435), "Grand Champion I");
  assert.equal(estimateRank("ranked_3v3", 1_315), "Champion III");
  assert.equal(estimateRank("ranked_1v1", 1_342), "Supersonic Legend");
  assert.equal(estimateRank("ranked_2v2", 1_342), "Champion III");
  assert.equal(estimateRank("ranked_3v3", 1_869), "Grand Champion III");
  assert.equal(estimateRank("ranked_3v3", 1_870), "Supersonic Legend");
});

test("rank estimate is unavailable for unsupported playlists or invalid MMR", () => {
  assert.equal(estimateRank("casual", 1_200), undefined);
  assert.equal(estimateRank("ranked_2v2", Number.NaN), undefined);
  assert.equal(estimateRankDetails("ranked_2v2", Number.POSITIVE_INFINITY), undefined);
});

test("division estimates preserve unambiguous inclusive table ranges", () => {
  for (const [mmr, division] of [
    [1315, 1], [1333, 1], [1334, 2], [1367, 2], [1368, 3], [1397, 3], [1402, 4], [1419, 4]
  ]) {
    assert.deepEqual(estimateRankDetails("ranked_2v2", mmr), { rankLabel: "Champion III", division });
  }
  assert.deepEqual(estimateRankDetails("ranked_2v2", 1333.49), { rankLabel: "Champion III", division: 1 });
  assert.deepEqual(estimateRankDetails("ranked_2v2", 1333.5), { rankLabel: "Champion III", division: 2 });
  assert.deepEqual(estimateRankDetails("ranked_2v2", 700), { rankLabel: "Platinum I", division: 4 });
});

test("overlaps and gaps use marked estimates only within complete ordered ranges", () => {
  for (const [mmr, division] of [
    [1075, 1], [1093, 1], [1094, 2], [1127, 2], [1128, 3], [1140, 3], [1161, 3], [1180, 4]
  ]) {
    assert.deepEqual(estimateRankDetails("ranked_3v3", mmr), {
      rankLabel: "Champion I", division, divisionEstimated: true
    });
  }
  assert.deepEqual(estimateRankDetails("ranked_3v3", 1162), {
    rankLabel: "Champion I", division: 4
  });
  assert.deepEqual(estimateRankDetails("ranked_3v3", 1356), {
    rankLabel: "Champion III", division: 2, divisionEstimated: true
  });
  assert.deepEqual(estimateRankDetails("ranked_1v1", 700), {
    rankLabel: "Platinum II", division: 2, divisionEstimated: true
  });
  assert.deepEqual(estimateRankDetails("ranked_2v2", 773), {
    rankLabel: "Platinum III", division: 1, divisionEstimated: true
  });
  assert.deepEqual(estimateRankDetails("ranked_2v2", 1400), {
    rankLabel: "Champion III", division: 4, divisionEstimated: true
  });
  assert.deepEqual(estimateRankDetails("ranked_2v2", 119), {
    rankLabel: "Bronze I", division: 2, divisionEstimated: true
  });
  assert.deepEqual(estimateRankDetails("ranked_2v2", 1425), { rankLabel: "Champion III" });
});

test("extra modes use their own tables and SSL never gets a division", () => {
  assert.deepEqual(estimateRankDetails("ranked_4v4", 600), { rankLabel: "Gold III", division: 2 });
  assert.deepEqual(estimateRankDetails("ranked_4v4", 639), { rankLabel: "Gold III" });
  assert.deepEqual(estimateRankDetails("ranked_4v4", 640), { rankLabel: "Platinum I", division: 2 });
  assert.deepEqual(estimateRankDetails("ranked_4v4", 1040), { rankLabel: "Champion III", division: 2 });
  assert.deepEqual(estimateRankDetails("ranked_4v4", 1159), { rankLabel: "Grand Champion II", division: 2 });
  assert.equal(estimateRankDetails("ranked_4v4", 1161), undefined);
  assert.deepEqual(estimateRankDetails("ranked_hoops", 1000), { rankLabel: "Champion II", division: 3 });
  assert.deepEqual(estimateRankDetails("ranked_rumble", 1000), { rankLabel: "Champion I", division: 2 });
  assert.deepEqual(estimateRankDetails("ranked_dropshot", 722), { rankLabel: "Platinum III", division: 3 });
  assert.deepEqual(estimateRankDetails("ranked_snow_day", 1000), { rankLabel: "Champion II", division: 3 });
  assert.deepEqual(estimateRankDetails("tournament", 1356), { rankLabel: "Champion III", division: 2 });
  assert.deepEqual(estimateRankDetails("ranked_2v2", 5000), { rankLabel: "Supersonic Legend" });
  assert.deepEqual(estimateRankDetails("ranked_2v2", -500), { rankLabel: "Bronze I" });
});

test("Heatseeker uses its own ranges and marks gap and overlap estimates", () => {
  assert.deepEqual(estimateRankDetails("ranked_heatseeker", 1000), {
    rankLabel: "Champion I", division: 4
  });
  assert.deepEqual(estimateRankDetails("ranked_heatseeker", 1079), {
    rankLabel: "Champion III", division: 2, divisionEstimated: true
  });
  assert.deepEqual(estimateRankDetails("ranked_heatseeker", 1080), {
    rankLabel: "Champion III", division: 2
  });
  assert.deepEqual(estimateRankDetails("ranked_heatseeker", 1186), {
    rankLabel: "Grand Champion II", division: 1, divisionEstimated: true
  });
  assert.deepEqual(estimateRankDetails("ranked_heatseeker", 1303), {
    rankLabel: "Grand Champion III", division: 4
  });
  assert.deepEqual(estimateRankDetails("ranked_heatseeker", 1304), { rankLabel: "Supersonic Legend" });
});

test("rank source tables retain playlist provenance and can change independently of code", () => {
  const parsed = parseRankDistributions(source);
  assert.deepEqual([...parsed.keys()].sort(), [
    "ranked_1v1", "ranked_2v2", "ranked_3v3", "ranked_4v4", "ranked_dropshot",
    "ranked_heatseeker", "ranked_hoops", "ranked_rumble", "ranked_snow_day", "tournament"
  ]);
  assert.equal(parsed.get("ranked_4v4").find((rank) => rank.rankLabel === "Gold III").lowerBound, 597);
  assert.equal(parsed.get("ranked_4v4").some((rank) => rank.rankLabel === "Grand Champion III"), false);
  assert.deepEqual(source.playlists.ranked_1v1.ranks["Champion III"],
    [[1100, 1118], [1100, 1137], [1100, 1156], [1100, 1172]]);
  assert.deepEqual(source.playlists.ranked_2v2.ranks["Champion III"],
    [[1315, 1333], [1334, 1367], [1368, 1397], [1402, 1419]]);
  assert.equal(source.playlists.ranked_heatseeker.trackerPlaylistId, 63);
  assert.deepEqual(source.playlists.ranked_heatseeker.ranks["Champion III"],
    [[1075, 1078], [1080, 1097], [1098, 1115], [1117, 1132]]);
  const revised = structuredClone(source);
  revised.playlists.ranked_2v2.ranks["Champion III"][0][0] = 1320;
  assert.equal(parseRankDistributions(revised).get("ranked_2v2")
    .find((rank) => rank.rankLabel === "Champion III").lowerBound, 1320);
});

test("malformed rank updates fail explicitly instead of producing guessed ranks", () => {
  for (const change of [
    (data) => { data.schemaVersion = 2; },
    (data) => { data.capturedAt = "invalid"; },
    (data) => { data.divisionOrder = [4, 3, 2, 1]; },
    (data) => { data.playlists.ranked_2v2.trackerPlaylistId = 10; },
    (data) => { data.playlists.ranked_2v2.sourceUrl = source.playlists.ranked_1v1.sourceUrl; },
    (data) => { delete data.playlists.ranked_2v2.ranks["Champion I"]; },
    (data) => { data.playlists.ranked_2v2.ranks["Champion I"][0] = [1200, 1000]; },
    (data) => { data.playlists.ranked_2v2.ranks["Champion I"][0] = [Number.NaN, 1100]; },
    (data) => { data.playlists.ranked_2v2.ranks["Champion I"][0] = [100, 1100]; }
  ]) {
    const invalid = structuredClone(source);
    change(invalid);
    assert.throws(() => parseRankDistributions(invalid));
  }
});

test("a fresh estimator loads edited installed tables without rebuilding code", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "rocketstats-rank-table-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const core = join(directory, "bin", "core");
  const data = join(directory, "data", "rank-distributions.json");
  await mkdir(core, { recursive: true });
  await mkdir(join(directory, "data"));
  await writeFile(join(directory, "package.json"), '{"type":"module"}');
  for (const name of ["rank-estimator.js", "rank-icons.js", "playlists.js"]) {
    await copyFile(new URL(`../com.rocketstats.livestats.sdPlugin/bin/core/${name}`, import.meta.url),
      join(core, name));
  }
  await writeFile(data, JSON.stringify(source));
  const moduleUrl = pathToFileURL(join(core, "rank-estimator.js")).href;
  const before = await import(`${moduleUrl}?version=before`);
  assert.deepEqual(before.estimateRankDetails("ranked_2v2", 1336), {
    rankLabel: "Champion III", division: 2
  });

  const updated = structuredClone(source);
  updated.playlists.ranked_2v2.ranks["Champion III"][0][1] = 1339;
  updated.playlists.ranked_2v2.ranks["Champion III"][1][0] = 1340;
  await writeFile(data, JSON.stringify(updated));
  const after = await import(`${moduleUrl}?version=after`);
  assert.deepEqual(after.estimateRankDetails("ranked_2v2", 1336), {
    rankLabel: "Champion III", division: 1
  });

  updated.playlists.ranked_2v2.ranks["Champion III"] = [
    [1315, 1339], [1315, 1333], [1368, 1397], [1402, 1419]
  ];
  await writeFile(data, JSON.stringify(updated));
  const unordered = await import(`${moduleUrl}?version=unordered`);
  assert.deepEqual(unordered.estimateRankDetails("ranked_2v2", 1332), { rankLabel: "Champion III" });

  updated.playlists.ranked_2v2.ranks["Champion III"] = [
    [1315, 1339], [1315, 1367], null, [1402, 1419]
  ];
  await writeFile(data, JSON.stringify(updated));
  const incomplete = await import(`${moduleUrl}?version=incomplete`);
  assert.deepEqual(incomplete.estimateRankDetails("ranked_2v2", 1332), { rankLabel: "Champion III" });
});
