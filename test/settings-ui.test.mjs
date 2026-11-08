import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

await import("../com.rocketstats.livestats.sdPlugin/ui/settings-i18n.js");
const translations = globalThis.RocketStatsSettingsI18n;
const settingsHtml = await readFile(
  join(
    process.cwd(),
    "com.rocketstats.livestats.sdPlugin",
    "ui",
    "settings.html"
  ),
  "utf8"
);

test("settings UI has complete translations for all seven locales", () => {
  const locales = ["de", "en", "pl", "fr", "es", "pt", "ru"];
  const requiredKeys = new Set([
    ...[...settingsHtml.matchAll(/data-i18n="([^"]+)"/g)].map((match) => match[1]),
    ...[...settingsHtml.matchAll(/showStatus\("([^"]+)"/g)].map((match) => match[1])
  ]);
  assert.deepEqual(Object.keys(translations).sort(), [...locales].sort());

  for (const locale of locales) {
    for (const key of requiredKeys) {
      assert.equal(typeof translations[locale][key], "string", `${locale}.${key} must be translated`);
      assert.ok(translations[locale][key].length > 0, `${locale}.${key} must not be empty`);
    }
  }
  assert.match(settingsHtml, /<option value="ranked_4v4" data-i18n="ranked4v4">/);
  assert.match(settingsHtml, /<option value="ranked_heatseeker" data-i18n="rankedHeatseeker">/);
});

test("settings UI inline JavaScript parses", () => {
  const scripts = [...settingsHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new Function(scripts[0][1]));
});

test("legacy MMR settings migrate to auto and deliberate fixed selections remain explicit", () => {
  class Element {
    value = "";
    checked = false;
    disabled = false;
    hidden = false;
    children = [];
    listeners = new Map();
    classList = { toggle() {} };
    replaceChildren(...children) { this.children = children; }
    addEventListener(event, callback) { this.listeners.set(event, callback); }
    change() { this.listeners.get("change")(); }
    click() { this.listeners.get("click")(); }
  }
  const fields = Object.fromEntries([
    "locale", "playlist", "apiPort", "controlPort", "manualDisplayName", "animateEvents", "status",
    "platformAccountSelect", "platformAccountInput", "platformAccountUse", "platformAccountCorrect", "platformAccountRemove",
    "platformAccountAdd", "platformAccountStatus"
  ].map((key) => [key, new Element()]));
  const stats = ["goals", "assists", "saves", "shots", "demos", "score", "ping"]
    .map((value) => Object.assign(new Element(), { value }));
  const document = {
    documentElement: { lang: "" },
    getElementById: (id) => fields[id],
    createElement: () => new Element(),
    querySelectorAll: (selector) => selector === "[data-banner-stat]" ? stats : []
  };
  let socket;
  class FakeWebSocket {
    static OPEN = 1;
    readyState = FakeWebSocket.OPEN;
    listeners = new Map();
    sent = [];
    constructor() { socket = this; }
    addEventListener(event, callback) { this.listeners.set(event, callback); }
    send(message) { this.sent.push(JSON.parse(message)); }
    emit(event, data = {}) { this.listeners.get(event)(data); }
  }
  let confirmed = false;
  const window = { RocketStatsSettingsI18n: translations, confirm: () => confirmed };
  const script = [...settingsHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
  runInNewContext(script, { document, window, WebSocket: FakeWebSocket, setTimeout, clearTimeout });
  assert.equal(fields.locale.value, "en");
  assert.equal(fields.playlist.value, "auto");
  assert.equal(fields.apiPort.value, 49123);
  fields.playlist.value = "ranked_1v1";
  fields.playlist.change();
  assert.equal(fields.status.textContent, translations.en.socketNotReady);
  fields.playlist.value = "auto";
  window.connectElgatoStreamDeckSocket(1234, "plugin", "register", {}, { context: "key" });
  socket.emit("open");
  socket.emit("message", {
    data: JSON.stringify({ event: "didReceiveGlobalSettings", payload: { settings: {} } })
  });
  socket.emit("message", {
    data: JSON.stringify({
      event: "didReceiveSettings",
      payload: { settings: { playlist: "ranked_2v2" } }
    })
  });
  assert.equal(fields.playlist.value, "auto");

  fields.playlist.value = "ranked_3v3";
  fields.playlist.change();
  assert.equal(socket.sent.at(-1).event, "setSettings");
  assert.equal(socket.sent.at(-1).payload.playlistMode, "manual");
  assert.equal(socket.sent.at(-1).payload.playlist, "ranked_3v3");

  fields.playlist.value = "ranked_4v4";
  fields.playlist.change();
  assert.equal(socket.sent.at(-1).payload.playlist, "ranked_4v4");

  fields.playlist.value = "ranked_heatseeker";
  fields.playlist.change();
  assert.equal(socket.sent.at(-1).payload.playlistMode, "manual");
  assert.equal(socket.sent.at(-1).payload.playlist, "ranked_heatseeker");
  socket.emit("message", {
    data: JSON.stringify({
      event: "didReceiveSettings",
      payload: { settings: { playlist: "ranked_heatseeker", playlistMode: "manual" } }
    })
  });
  assert.equal(fields.playlist.value, "ranked_heatseeker");

  socket.emit("message", {
    data: JSON.stringify({
      event: "didReceiveSettings",
      payload: { settings: { playlist: "ranked_1v1", playlistMode: "manual" } }
    })
  });
  assert.equal(fields.playlist.value, "ranked_1v1");
  fields.playlist.value = "auto";
  fields.playlist.change();
  assert.equal(socket.sent.at(-1).payload.playlistMode, "auto");
  assert.equal(socket.sent.at(-1).payload.playlist, "auto");

  const first = "Steam|76561198000000001|0";
  const second = "Epic|friend|0";
  const candidates = {
    accounts: [
      { accountId: first, name: "Me", matchesSeen: 2, managed: false, suggested: true },
      { accountId: second, name: "Friend", matchesSeen: 2, managed: true, suggested: true }
    ],
    selectionRequired: true
  };
  socket.emit("message", {
    data: JSON.stringify({ event: "didReceiveGlobalSettings", payload: { settings: {
      apiPort: 49123, controlPort: 49124, manualDisplayName: "", platformAccounts: candidates
    } } })
  });
  assert.equal(fields.platformAccountStatus.textContent, translations.en.platformPending);
  assert.deepEqual(fields.platformAccountSelect.children.map((option) => option.value), [first, second]);
  fields.platformAccountSelect.value = second;
  fields.platformAccountSelect.change();
  fields.platformAccountUse.click();
  const command = socket.sent.at(-1);
  assert.equal(command.event, "setGlobalSettings");
  assert.equal(command.payload.platformAccountCommand.action, "select");
  assert.equal(command.payload.platformAccountCommand.accountId, second);
  assert.equal(command.payload.platformAccounts.accounts.length, 2);
  assert.equal(fields.platformAccountUse.disabled, true);
  socket.emit("message", {
    data: JSON.stringify({ event: "didReceiveGlobalSettings", payload: { settings: {
      ...command.payload,
      platformAccounts: { ...candidates, selectionRequired: false, activeAccountId: second },
      platformAccountResult: { requestId: command.payload.platformAccountCommand.requestId }
    } } })
  });
  assert.equal(fields.status.textContent, translations.en.platformSaved);
  assert.equal(fields.platformAccountUse.disabled, false);

  socket.emit("message", {
    data: JSON.stringify({ event: "didReceiveGlobalSettings", payload: { settings: {
      ...command.payload,
      platformAccounts: {
        ...candidates, selectionRequired: false, activeAccountId: first,
        selectedAccountId: first, selectionSource: "inferred"
      }
    } } })
  });
  fields.platformAccountSelect.value = second;
  fields.platformAccountSelect.change();
  assert.equal(fields.platformAccountCorrect.hidden, false);
  assert.equal(fields.platformAccountCorrect.disabled, false);
  const sentBeforeCorrection = socket.sent.length;
  fields.platformAccountCorrect.click();
  assert.equal(socket.sent.length, sentBeforeCorrection);
  confirmed = true;
  fields.platformAccountCorrect.click();
  const correction = socket.sent.at(-1);
  assert.equal(correction.payload.platformAccountCommand.action, "select");
  assert.equal(correction.payload.platformAccountCommand.accountId, second);
  assert.equal(correction.payload.platformAccountCommand.correctInferred, true);
  socket.emit("message", {
    data: JSON.stringify({ event: "didReceiveGlobalSettings", payload: { settings: {
      ...correction.payload,
      platformAccounts: {
        ...candidates, selectionRequired: false, activeAccountId: second,
        selectedAccountId: second, selectionSource: "manual"
      },
      platformAccountResult: { requestId: correction.payload.platformAccountCommand.requestId }
    } } })
  });
  assert.equal(fields.platformAccountCorrect.hidden, true);
  fields.apiPort.value = 49125;
  fields.apiPort.change();
  assert.equal(socket.sent.at(-1).payload.platformAccounts.activeAccountId, second);
  assert.equal(socket.sent.at(-1).payload.apiPort, 49125);
});
