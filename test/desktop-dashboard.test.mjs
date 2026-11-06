import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { createDesktopDom } from "./fixtures/desktop-dom.mjs";

const retained = ["rank", "mmr-wl", "streak", "records", "ban-countdown"];
const removed = [
  "mmr", "score", "timer", "boost", "event-banner", "last-goal", "queue-status",
  "speed", "ping", "possession", "goals", "assists", "saves", "shots",
  "demos", "flip-resets", "touches", "player-score"
];
const model = (action, value = action) => ({ action, title: action, value });

async function loadDashboard(locale, mmrHistory) {
  const [html, source] = await Promise.all([
    readFile(new URL("../desktop/index.html", import.meta.url), "utf8"),
    readFile(new URL("../desktop/renderer.js", import.meta.url), "utf8")
  ]);
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  const dom = createDesktopDom();
  dom.document.getElementById = (id) => {
    assert.ok(ids.has(id), `Renderer references a missing element: ${id}`);
    return dom.getElement(id);
  };
  const listeners = {};
  const calls = { scope: 0, reset: 0 };
  const bridge = {
    onModel(callback) { listeners.model = callback; },
    onStatus() {}, onError() {}, onUpdate() {},
    toggleScope: async () => { calls.scope += 1; },
    resetStats: async () => { calls.reset += 1; },
    ...(mmrHistory ? { getMmrHistory: async () => mmrHistory } : {}),
    getState: async () => ({
      locale, port: 49123, autoCheckUpdates: false,
      connection: { status: "connected", error: null, revision: 0 },
      update: { phase: "idle", version: "0.1.0" },
      models: [...retained, ...removed].map((action) => model(action))
    })
  };
  vm.runInNewContext(source, {
    document: dom.document, setTimeout: dom.setTimeout, clearTimeout: dom.clearTimeout,
    window: { rocketStatsDesktop: bridge, confirm: () => true }
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(dom.getElement("error-panel").hidden, true);
  return { ...dom, html, listeners, calls };
}

test("desktop displays account statistics without live match or player-stat sections in all languages", async () => {
  for (const locale of ["de", "en", "pl", "fr", "es", "pt", "ru"]) {
    const h = await loadDashboard(locale);
    assert.equal(h.document.documentElement.lang, locale);
    assert.doesNotMatch(h.html, /id="(?:match|stats)-(?:grid|heading|eyebrow)"/);
    assert.deepEqual(
      h.getElement("ranked-grid").children.map((card) => card.children[0].textContent),
      retained
    );
    const initialCards = h.getElement("ranked-grid").children;
    for (const action of removed) h.listeners.model(model(action, "live update"));
    assert.equal(h.getElement("ranked-grid").children, initialCards);

    h.listeners.model(model("rank", "1500"));
    assert.equal(h.getElement("ranked-grid").children[0].children[1].textContent, "1500");
    h.listeners.model(model("ban-countdown", "00:30"));
    assert.equal(h.getElement("ranked-grid").children.at(-1).children[1].textContent, "00:30");
  }
});

test("desktop keeps win/loss scope and reset controls after removing live data", async () => {
  const h = await loadDashboard("en");
  h.listeners.model({ ...model("stats-scope", "2v2"), footerKey: "scopeMode" });
  assert.equal(h.getElement("scope-value").textContent, "Current mode \u00b7 2v2");
  await h.getElement("scope-button").listeners.get("click")();
  await h.getElement("reset-button").listeners.get("click")();
  assert.deepEqual(h.calls, { scope: 1, reset: 1 });
});

test("desktop draws the MMR history per mode and switches between modes", async () => {
  const history = {
    ranked_2v2: [{ at: 1, mmr: 900 }, { at: 3, mmr: 950 }, { at: 5, mmr: 930 }],
    ranked_3v3: [{ at: 2, mmr: 700 }]
  };
  const h = await loadDashboard("de", history);
  h.advanceTime(0);
  await new Promise((resolve) => setImmediate(resolve));

  const select = h.getElement("history-select");
  assert.deepEqual(select.children.map((option) => option.value), ["ranked_2v2", "ranked_3v3"]);
  assert.equal(select.value, "ranked_2v2");
  const chart = h.getElement("history-chart");
  assert.equal(chart.children.filter((node) => node.tagName === "circle").length, 3);
  assert.equal(h.getElement("history-summary").textContent, "930 (+30) · Min 900 · Max 950 · 3 Werte");
  assert.equal(h.getElement("history-empty").hidden, true);

  select.listeners.get("change")({ target: { value: "ranked_3v3" } });
  assert.equal(chart.children.filter((node) => node.tagName === "circle").length, 1);
  assert.match(h.getElement("history-summary").textContent, /^700 \(\+0\)/);
});

test("desktop shows an empty MMR history hint when no values exist", async () => {
  const h = await loadDashboard("en", {});
  h.advanceTime(0);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.getElement("history-empty").hidden, false);
  assert.equal(h.getElement("history-empty").textContent, "No MMR values for this mode yet.");
  assert.equal(h.getElement("history-select").disabled, true);
});
