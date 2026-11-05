import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const { PluginState } = await import(
  "../com.rocketstats.livestats.sdPlugin/bin/core/plugin-state.js"
);
const { renderAction, renderMmrCardSvg } = await import(
  "../com.rocketstats.livestats.sdPlugin/bin/render/key-renderer.js"
);
const { RenderBus } = await import(
  "../com.rocketstats.livestats.sdPlugin/bin/streamdeck/render-bus.js"
);
const { RANK_ICON_ORDER, rankIconPath } = await import(
  "../com.rocketstats.livestats.sdPlugin/bin/core/rank-icons.js"
);
const { estimateRank } = await import(
  "../com.rocketstats.livestats.sdPlugin/bin/core/rank-estimator.js"
);
const { createEmptySnapshot } = await import(
  "../com.rocketstats.livestats.sdPlugin/bin/core/types.js"
);

const pluginDirectory = new URL("../com.rocketstats.livestats.sdPlugin/", import.meta.url);

function decodeSvg(dataUrl) {
  assert.match(dataUrl, /^data:image\/svg\+xml;base64,/);
  return Buffer.from(dataUrl.split(",")[1], "base64").toString("utf8");
}

function keyTarget() {
  const calls = { titles: [], images: [] };
  return {
    calls,
    setTitle: (value) => { calls.titles.push(value); },
    setImage: (value) => { calls.images.push(value); }
  };
}

test("every estimated rank maps to a generated rank icon", async () => {
  assert.equal(RANK_ICON_ORDER.length, 23);
  assert.equal(rankIconPath(undefined), "imgs/ranks/rank-00.png");
  assert.equal(rankIconPath("Platinum I"), "imgs/ranks/rank-10.png");
  assert.equal(rankIconPath("Supersonic Legend"), "imgs/ranks/rank-22.png");
  for (const playlist of ["ranked_1v1", "ranked_2v2", "ranked_3v3", "ranked_heatseeker"]) {
    for (const mmr of [0, 500, 900, 1200, 1500, 2000]) {
      assert.notEqual(rankIconPath(estimateRank(playlist, mmr)), "imgs/ranks/rank-00.png");
    }
  }
  for (const [index] of RANK_ICON_ORDER.entries()) {
    await access(new URL(`imgs/ranks/rank-${String(index).padStart(2, "0")}.png`, pluginDirectory));
  }
});

test("rank key shows the icon, name and tier of the selected mode", async () => {
  const snapshot = createEmptySnapshot();
  const model = renderAction("rank", snapshot, {
    mmrValue: "1356",
    mmrRankLabel: "Champion III",
    mmrDivision: 2,
    mmrPlaylist: "ranked_2v2",
    mmrByPlaylist: { ranked_1v1: { value: "700", rankLabel: "Platinum II", division: 3 } }
  });
  const svg = decodeSvg(model.image);
  assert.match(svg, /fill="#C38BFF">CHAMPION</);
  assert.match(svg, /fill="#C38BFF">III DIV 2</);
  const icon = /href="data:image\/png;base64,([^"]+)"/.exec(svg);
  assert.ok(icon);
  assert.deepEqual(
    Buffer.from(icon[1], "base64"),
    await readFile(new URL("imgs/ranks/rank-18.png", pluginDirectory))
  );
  assert.match(
    decodeSvg(renderAction("rank", snapshot, { mmrValue: "---", mmrRankLabel: "Champion III" }).image),
    />---</
  );
  assert.match(
    decodeSvg(renderAction("rank", snapshot, { mmrValue: "1000", mmrRankLabel: "Unknown Rank" }).image),
    />---</
  );

  const bus = new RenderBus();
  const auto = keyTarget();
  const fixed = keyTarget();
  bus.bind("rank", auto, {});
  bus.bind("rank", fixed, { playlistMode: "manual", playlist: "ranked_1v1" });
  bus.publish(model);
  bus.publish(model);
  assert.deepEqual(auto.calls.titles, [""]);
  assert.deepEqual(auto.calls.images, [model.image]);
  const fixedSvg = decodeSvg(fixed.calls.images[0]);
  assert.match(fixedSvg, /fill="#75E0F5">PLATINUM</);
  assert.match(fixedSvg, /fill="#75E0F5">II DIV 3</);
  const fixedIcon = /href="data:image\/png;base64,([^"]+)"/.exec(fixedSvg);
  assert.ok(fixedIcon);
  assert.deepEqual(
    Buffer.from(fixedIcon[1], "base64"),
    await readFile(new URL("imgs/ranks/rank-11.png", pluginDirectory))
  );

  bus.publish(renderAction("rank", snapshot, {
    mmrValue: "1380",
    mmrRankLabel: "Champion III",
    mmrDivision: 3,
    mmrPlaylist: "ranked_2v2",
    mmrByPlaylist: { ranked_1v1: { value: "700", rankLabel: "Platinum II", division: 3 } }
  }));
  assert.match(decodeSvg(auto.calls.images.at(-1)), />III DIV 3</);
  assert.equal(fixed.calls.images.length, 1);

  bus.publish(renderAction("rank", snapshot, {
    mmrValue: "900",
    mmrRankLabel: "Diamond I",
    mmrPlaylist: "ranked_2v2",
    mmrByPlaylist: { ranked_1v1: { value: "700", rankLabel: "Platinum II", division: 3 } }
  }));
  assert.match(decodeSvg(auto.calls.images.at(-1)), /fill="#70B5FF">DIAMOND</);
  assert.equal(fixed.calls.images.length, 1);

  const unavailable = keyTarget();
  bus.bind("rank", unavailable, { playlistMode: "manual", playlist: "ranked_3v3" });
  assert.match(decodeSvg(unavailable.calls.images[0]), />---</);
});

test("rank card uses matching colors and explicitly marks an unavailable division", () => {
  const colors = {
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
  for (const rank of RANK_ICON_ORDER) {
    const match = /^(.*) (I{1,3})$/.exec(rank);
    const name = match?.[1] ?? rank;
    const tier = match?.[2];
    const svg = decodeSvg(renderAction("rank", createEmptySnapshot(), {
      mmrValue: "1000",
      mmrRankLabel: rank
    }).image);
    const labels = name === "Supersonic Legend"
      ? ["SUPERSONIC", "LEGEND"]
      : [name.toUpperCase(), ...(tier ? [`${tier} DIV ?`] : [])];
    for (const label of labels) {
      assert.ok(svg.includes(`fill="${colors[name]}">${label}</text>`), rank);
    }
    if (!tier) {
      assert.doesNotMatch(svg, />[^<]*DIV[^<]*<\/text>/);
    }
  }
});

test("estimated divisions are marked and legible on automatic and fixed rank keys", () => {
  const snapshot = createEmptySnapshot();
  const estimated = renderAction("rank", snapshot, {
    mmrValue: "1140",
    mmrRankLabel: "Champion I",
    mmrDivision: 3,
    mmrDivisionEstimated: true,
    mmrByPlaylist: {
      ranked_3v3: { value: "1140", rankLabel: "Champion I", division: 3, divisionEstimated: true }
    }
  });
  const svg = decodeSvg(estimated.image);
  assert.match(svg, /font-size="18" fill="#C38BFF">I DIV ~3</);

  const exact = renderAction("rank", snapshot, {
    mmrValue: "1140",
    mmrRankLabel: "Champion I",
    mmrDivision: 3
  });
  assert.match(decodeSvg(exact.image), />I DIV 3</);
  assert.notEqual(exact.image, estimated.image);

  const bus = new RenderBus();
  const fixed = keyTarget();
  bus.bind("rank", fixed, { playlistMode: "manual", playlist: "ranked_3v3" });
  bus.publish(estimated);
  assert.match(decodeSvg(fixed.calls.images.at(-1)), />I DIV ~3</);
});

test("combined MMR key draws value and wins/losses like the reference card", () => {
  const svg = decodeSvg(renderMmrCardSvg({
    titleBase: "MMR", playlist: "ranked_2v2", value: "728", wins: 4, losses: 2
  }));
  assert.match(svg, />MMR 2v2</);
  assert.match(svg, />728</);
  assert.match(svg, /fill="#3EDB8D">4W</);
  assert.match(svg, /fill="#FF4D4D">2L</);

  const model = renderAction("mmr-wl", createEmptySnapshot(), {
    mmrValue: "722", mmrPlaylist: "ranked_dropshot", wins: 1, losses: 3,
    mmrByPlaylist: { ranked_2v2: { value: "1100", rankLabel: "Champion I" } }
  });
  assert.equal(model.title, "");
  assert.match(decodeSvg(model.image), />722</);

  const bus = new RenderBus();
  const fixed = keyTarget();
  bus.bind("mmr-wl", fixed, { playlistMode: "manual", playlist: "ranked_2v2" });
  bus.publish(model);
  const rendered = decodeSvg(fixed.calls.images.at(-1));
  assert.match(rendered, />MMR 2v2</);
  assert.match(rendered, />1100</);
  assert.match(rendered, />1W</);
  assert.deepEqual(fixed.calls.titles, [""]);
});

test("win/loss counts follow the scope and resets", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "rocketstats-wl-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const state = new PluginState({
    statePath: join(directory, "state.json"),
    identityGraceWindowMs: 90_000,
    reconnectWindowMs: 600_000
  });
  await state.initialize();
  state.resolveIdentity({ accountId: "Steam|1|0", observedAt: Date.now() });
  let clock = 1_000;
  for (const [queueType, outcome] of [
    ["ranked_2v2", "win"], ["ranked_2v2", "loss"], ["ranked_1v1", "win"], ["ranked_2v2", "win"]
  ]) {
    clock += 1_000;
    await state.recordMatchResult({ matchId: `m${clock}`, queueType, outcome, completedAt: clock });
  }
  await state.setLastMmrPlaylist("ranked_2v2");

  assert.deepEqual(state.getWinLossCounts(), { wins: 3, losses: 1 });
  await state.toggleStatsScope();
  assert.deepEqual(state.getWinLossCounts(), { wins: 2, losses: 1 });
  await state.resetStats();
  assert.deepEqual(state.getWinLossCounts(), { wins: 0, losses: 0 });
  await state.toggleStatsScope();
  assert.deepEqual(state.getWinLossCounts(), { wins: 1, losses: 0 });
});

test("ping key colours value and ms by latency", () => {
  const svgFor = (pingMs) => {
    const snapshot = createEmptySnapshot();
    snapshot.localPlayer = { ...(snapshot.localPlayer ?? {}), pingMs };
    return decodeSvg(renderAction("ping", snapshot, { locale: "de" }).image);
  };
  assert.match(svgFor(23), /fill="#3EDB8D">23<tspan[^>]*>ms</);
  assert.match(svgFor(50), /fill="#F5A623">50</);
  assert.match(svgFor(99), /fill="#F5A623">99</);
  assert.match(svgFor(100), /fill="#FF4D4D">100</);
  assert.match(svgFor(undefined), /fill="#FFFFFF">--<\/text>/);
  assert.match(svgFor(23), />PING</);
});
