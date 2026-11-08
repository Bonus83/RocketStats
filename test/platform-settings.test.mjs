import test from "node:test";
import assert from "node:assert/strict";

const { PlatformSettingsBridge } = await import(
  "../com.rocketstats.livestats.sdPlugin/bin/streamdeck/platform-settings.js"
);
const ACCOUNT = "Steam|76561198000000001|0";

async function waitFor(predicate) {
  const deadline = Date.now() + 2_000;
  while (!predicate() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.ok(predicate(), "the settings bridge should finish processing");
}

function harness() {
  let settings = { apiPort: 49123, controlPort: 49124, manualDisplayName: "Local" };
  let accounts = {
    accounts: [{ accountId: ACCOUNT, name: "Player", matchesSeen: 2, managed: false, suggested: true }],
    selectionRequired: true
  };
  const writes = [];
  const calls = [];
  const errors = [];
  let bridge;
  const gateway = {
    get: async () => structuredClone(settings),
    set: async (value) => {
      settings = structuredClone(value);
      writes.push(settings);
    }
  };
  const actions = {
    get: () => structuredClone(accounts),
    add: async (id) => {
      calls.push(["add", id]);
      if (id === "invalid") throw new Error("Invalid platform ID");
      accounts.accounts = accounts.accounts.map((account) =>
        account.accountId === id ? { ...account, managed: true } : account
      );
      bridge.update(accounts);
    },
    select: async (id, correctInferred) => {
      calls.push(correctInferred ? ["select", id, true] : ["select", id]);
      accounts = { ...accounts, activeAccountId: id, selectedAccountId: id, selectionRequired: false };
      bridge.update(accounts);
    },
    remove: async (id) => { calls.push(["remove", id]); }
  };
  bridge = new PlatformSettingsBridge(gateway, actions, (error) => errors.push(error.message));
  return {
    bridge, writes, calls, errors,
    current: () => settings,
    send(command) {
      settings = { ...settings, platformAccountCommand: command };
      bridge.receive(structuredClone(settings));
    }
  };
}

test("Stream Deck settings expose candidates and process account commands without losing settings", async () => {
  const h = harness();
  h.bridge.start(h.current());
  await waitFor(() => h.current().platformAccounts);
  assert.equal(h.current().platformAccounts.accounts[0].accountId, ACCOUNT);
  assert.equal(h.current().apiPort, 49123);
  assert.equal(h.current().manualDisplayName, "Local");

  const command = { requestId: "selection-1", action: "select", accountId: ACCOUNT };
  h.send(command);
  h.bridge.receive({ ...h.current(), platformAccountCommand: command });
  await waitFor(() => h.current().platformAccountResult?.requestId === command.requestId);
  assert.deepEqual(h.calls, [["select", ACCOUNT]]);
  assert.equal(h.current().platformAccounts.selectedAccountId, ACCOUNT);
  assert.equal(h.current().platformAccountCommand, undefined);
  assert.equal(h.current().apiPort, 49123);
  assert.deepEqual(h.errors, []);
});

test("Stream Deck forwards an explicitly confirmed inference correction", async () => {
  const h = harness();
  h.bridge.start(h.current());
  await waitFor(() => h.current().platformAccounts);
  h.send({ requestId: "correction", action: "select", accountId: ACCOUNT, correctInferred: true });
  await waitFor(() => h.current().platformAccountResult?.requestId === "correction");
  assert.deepEqual(h.calls, [["select", ACCOUNT, true]]);
  assert.deepEqual(h.errors, []);
});

test("Stream Deck account commands report errors and acknowledge each queued request", async () => {
  const h = harness();
  h.bridge.start(h.current());
  await waitFor(() => h.current().platformAccounts);
  h.send({ requestId: "bad", action: "add", accountId: "invalid" });
  h.send({ requestId: "good", action: "add", accountId: ACCOUNT });
  await waitFor(() => h.writes.some((value) => value.platformAccountResult?.requestId === "good"));
  const failed = h.writes.find((value) => value.platformAccountResult?.requestId === "bad");
  assert.match(failed.platformAccountResult.error, /Invalid platform ID/);
  assert.ok(h.writes.some((value) => value.platformAccountResult?.requestId === "good"));
  assert.deepEqual(h.calls, [["add", "invalid"], ["add", ACCOUNT]]);
  assert.deepEqual(h.errors, ["Invalid platform ID"]);
  assert.equal(h.current().platformAccountCommand, undefined);
  assert.equal(h.current().platformAccounts.accounts[0].managed, true);
});
