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

async function loadDashboard(locale, mmrHistory, session = null, accounts = null, confirm = () => true) {
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
  const sessionCalls = [];
  const accountCalls = [];
  let accountState = accounts;
  const bridge = {
    onModel(callback) { listeners.model = callback; },
    onStatus() {}, onError() {}, onUpdate() {},
    onSession(callback) { listeners.session = callback; },
    onPlatformAccounts(callback) { listeners.accounts = callback; },
    toggleScope: async () => { calls.scope += 1; },
    resetStats: async () => { calls.reset += 1; },
    setStatsPeriod: async (period) => {
      sessionCalls.push(["period", period]);
      return { ...session, period };
    },
    decideSession: async (startNew) => {
      sessionCalls.push(["decide", startNew]);
      return { ...session, promptPending: false, matchCount: startNew ? 0 : session.matchCount };
    },
    addPlatformAccount: async (accountId) => {
      accountCalls.push(["add", accountId]);
      if (!accountId.includes("|")) throw new Error("Invalid platform ID");
      accountState = {
        ...accountState,
        accounts: [...accountState.accounts, { accountId, matchesSeen: 0, managed: true, suggested: false }]
      };
      return accountState;
    },
    selectPlatformAccount: async (accountId, correctInferred) => {
      accountCalls.push(correctInferred ? ["select", accountId, true] : ["select", accountId]);
      accountState = {
        ...accountState, selectedAccountId: accountId, activeAccountId: accountId,
        selectionSource: "manual", selectionRequired: false
      };
      return accountState;
    },
    removePlatformAccount: async (accountId) => {
      accountCalls.push(["remove", accountId]);
      accountState = {
        ...accountState,
        accounts: accountState.accounts.map((account) =>
          account.accountId === accountId ? { ...account, managed: false } : account
        )
      };
      return accountState;
    },
    ...(mmrHistory ? { getMmrHistory: async () => mmrHistory } : {}),
    getState: async () => ({
      locale, port: 49123, autoCheckUpdates: false, session, accounts,
      connection: { status: "connected", error: null, revision: 0 },
      update: { phase: "idle", version: "0.1.0" },
      models: [...retained, ...removed].map((action) => model(action))
    })
  };
  vm.runInNewContext(source, {
    document: dom.document, setTimeout: dom.setTimeout, clearTimeout: dom.clearTimeout,
    window: { rocketStatsDesktop: bridge, confirm }
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(dom.getElement("error-panel").hidden, true);
  return { ...dom, html, listeners, calls, sessionCalls, accountCalls };
}

test("desktop shows possible accounts and manages multiple IDs without deleting match data", async () => {
  const a = "Steam|76561198000000001|0";
  const b = "Epic|friend|0";
  const added = "Steam|76561198000000003|0";
  const h = await loadDashboard("de", undefined, null, {
    accounts: [
      { accountId: a, name: "Me", matchesSeen: 2, managed: false, suggested: true },
      { accountId: b, name: "Friend", matchesSeen: 2, managed: true, suggested: true }
    ],
    selectionRequired: true
  });
  assert.match(h.getElement("accounts-status").textContent, /Mehrere mögliche Konten/);
  assert.deepEqual(h.getElement("accounts-select").children.map((option) => option.value), [a, b]);
  const select = h.getElement("accounts-select");
  select.value = b;
  select.listeners.get("change")({ target: select });
  await h.getElement("accounts-use").listeners.get("click")();
  assert.match(h.getElement("accounts-status").textContent, /Manuell ausgewählt: Friend/);
  await h.getElement("accounts-remove").listeners.get("click")();
  h.getElement("accounts-add-input").value = added;
  await h.getElement("accounts-add-form").listeners.get("submit")({ preventDefault() {} });
  assert.deepEqual(h.accountCalls, [["select", b], ["remove", b], ["add", added]]);
  assert.equal(h.getElement("accounts-select").value, added);
  assert.equal(h.getElement("accounts-add-input").value, "");

  h.getElement("accounts-add-input").value = "bad-id";
  await h.getElement("accounts-add-form").listeners.get("submit")({ preventDefault() {} });
  assert.equal(h.getElement("error-panel").hidden, false);
  assert.match(h.getElement("error-text").textContent, /Konto konnte nicht geändert werden/);
});

test("desktop confirms corrections and passes the explicit correction flag", async () => {
  const a = "Steam|76561198000000001|0";
  const b = "Epic|friend|0";
  let confirmed = false;
  const h = await loadDashboard("en", undefined, null, {
    accounts: [
      { accountId: a, name: "Inferred", matchesSeen: 2, managed: true, suggested: false },
      { accountId: b, name: "Actual", matchesSeen: 1, managed: false, suggested: false }
    ],
    activeAccountId: a, selectedAccountId: a, selectionSource: "inferred", selectionRequired: false
  }, () => confirmed);
  const select = h.getElement("accounts-select");
  const correct = h.getElement("accounts-correct");
  assert.equal(correct.hidden, true);
  select.value = b;
  select.listeners.get("change")({ target: select });
  assert.equal(correct.hidden, false);
  assert.equal(correct.disabled, false);
  await correct.listeners.get("click")();
  assert.deepEqual(h.accountCalls, []);
  confirmed = true;
  await correct.listeners.get("click")();
  assert.deepEqual(h.accountCalls, [["select", b, true]]);
  assert.equal(correct.hidden, true);
});

test("account controls are localized and a verified account cannot be removed", async () => {
  const accountId = "Steam|76561198000000001|0";
  for (const locale of ["de", "en", "pl", "fr", "es", "pt", "ru"]) {
    const h = await loadDashboard(locale, undefined, null, {
      accounts: [{ accountId, name: "Me", matchesSeen: 1, managed: true, suggested: false }],
      activeAccountId: accountId, selectedAccountId: accountId, verifiedAccountId: accountId,
      selectionSource: "verified", selectionRequired: false
    });
    assert.notEqual(h.getElement("accounts-heading").textContent, "accountHeading");
    assert.notEqual(h.getElement("accounts-hint").textContent, "accountHint");
    assert.equal(h.getElement("accounts-remove").disabled, true);
    assert.match(h.getElement("accounts-status").textContent, /Me/);
  }
});

test("desktop asks on start whether to continue the last session and switches the period", async () => {
  const h = await loadDashboard("de", undefined, {
    period: "session", startedAt: 1000, matchCount: 3, promptPending: true
  });
  assert.equal(h.getElement("session-panel").hidden, false);
  assert.match(h.getElement("session-text").textContent, /3 Spiele/);
  const select = h.getElement("period-select");
  assert.deepEqual(select.children.map((option) => option.value), ["session", "cleared", "alltime"]);
  assert.deepEqual(
    select.children.map((option) => option.textContent),
    ["Aktuelle Session", "Seit Zurücksetzen", "Gesamt"]
  );
  assert.equal(select.value, "session");

  await h.getElement("session-continue").listeners.get("click")();
  assert.equal(h.getElement("session-panel").hidden, true);
  await select.listeners.get("change")({ target: { value: "alltime" } });
  assert.equal(select.value, "alltime");
  await h.getElement("new-session-button").listeners.get("click")();
  assert.deepEqual(h.sessionCalls, [["decide", false], ["period", "alltime"], ["decide", true]]);

  h.listeners.session({ period: "cleared", startedAt: 2000, matchCount: 2, promptPending: true });
  assert.equal(h.getElement("session-panel").hidden, false);
  await h.getElement("session-new").listeners.get("click")();
  assert.equal(h.getElement("session-panel").hidden, true);
});

test("desktop disables period controls until the service is ready", async () => {
  const h = await loadDashboard("en");
  assert.equal(h.getElement("period-select").disabled, true);
  assert.equal(h.getElement("new-session-button").disabled, true);
  assert.equal(h.getElement("session-panel").hidden, true);
});

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
