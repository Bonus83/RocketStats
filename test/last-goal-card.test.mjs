import test from "node:test";
import assert from "node:assert/strict";

const { renderAction } = await import(
  "../com.rocketstats.livestats.sdPlugin/bin/render/key-renderer.js"
);
const { RenderBus } = await import(
  "../com.rocketstats.livestats.sdPlugin/bin/streamdeck/render-bus.js"
);
const { createEmptySnapshot } = await import(
  "../com.rocketstats.livestats.sdPlugin/bin/core/types.js"
);

function decodeSvg(dataUrl) {
  assert.match(dataUrl, /^data:image\/svg\+xml;base64,/);
  return Buffer.from(dataUrl.split(",")[1], "base64").toString("utf8");
}

test("last-goal key renders scorer and shot speed in the reference card layout", () => {
  const snapshot = createEmptySnapshot();
  snapshot.lastGoal = {
    scorer: "Player1",
    speedKph: 104,
    team: "blue",
    occurredAt: 123
  };

  const model = renderAction("last-goal", snapshot, { locale: "en" });
  const svg = decodeSvg(model.image);
  assert.equal(model.title, "");
  assert.match(svg, />LAST GOAL</);
  assert.match(svg, />Player1</);
  assert.match(svg, /fill="#923DE1">104</);
  assert.match(svg, />km\/h</);
});

test("last-goal key has safe placeholders before the first goal", () => {
  const svg = decodeSvg(renderAction("last-goal", createEmptySnapshot()).image);
  assert.match(svg, />LAST GOAL</);
  assert.match(svg, />--</);
  assert.match(svg, />km\/h</);
});

test("last-goal key honors per-action locale and escapes scorer names", () => {
  const snapshot = createEmptySnapshot();
  snapshot.lastGoal = {
    scorer: "Player <One>",
    speedKph: 98,
    team: "orange",
    occurredAt: 124
  };
  const model = renderAction("last-goal", snapshot);
  const calls = { images: [], titles: [] };
  const target = {
    setTitle: (value) => { calls.titles.push(value); },
    setImage: (value) => { calls.images.push(value); }
  };
  const bus = new RenderBus();
  bus.bind("last-goal", target, { locale: "de" });
  bus.publish(model);

  const svg = decodeSvg(calls.images.at(-1));
  assert.match(svg, />LETZTES TOR</);
  assert.match(svg, />Player &#60;One&#62;</);
  assert.match(svg, />km\/h</);
  assert.deepEqual(calls.titles, [""]);
});
