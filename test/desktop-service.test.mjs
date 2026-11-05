import assert from "node:assert/strict";
import { createServer } from "node:net";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import test from "node:test";
import { startDesktopService } from "../com.rocketstats.livestats.sdPlugin/bin/desktop/desktop-service.js";

async function waitFor(predicate, message) {
  const deadline = Date.now() + 7000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(message);
}

test("standalone service reuses dashboard models and reconnects only to loopback", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rocketstats-desktop-"));
  const originalLogPath = process.env.RL_LOG_PATH;
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  process.env.RL_LOG_PATH = join(directory, "Launch.log");

  const models = new Map();
  const statuses = [];
  let service;
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    service = await startDesktopService({
      statePath: join(directory, "state.json"),
      locale: "en",
      port: address.port,
      onModel: (model) => models.set(model.action, model),
      onStatus: (status) => statuses.push(status),
      onError: (message) => assert.fail(message)
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(models.get("score")?.title, "SCORE");
    assert.ok(models.has("rank"));
    assert.ok(models.has("mmr-wl"));
    assert.ok(!models.has("hud-toggle"));
    assert.ok(statuses.includes("connected"));

    service.configureLocale("de");
    assert.equal(models.get("score")?.title, "SPIELSTAND");
    await service.toggleStatsScope();
    assert.equal(models.get("stats-scope")?.footerKey, "scopeMode");
    await service.resetStats();
    await service.prepareForUpdate();
    const savedState = JSON.parse(await readFile(join(directory, "state.json"), "utf8"));
    assert.equal(savedState.statsScope, "mode");
  } finally {
    service?.stop();
    server.close();
    await once(server, "close");
    if (originalLogPath === undefined) {
      delete process.env.RL_LOG_PATH;
    } else {
      process.env.RL_LOG_PATH = originalLogPath;
    }
    await rm(directory, { recursive: true, force: true });
  }
});

test("desktop distinguishes connection failures from feed errors after reconnecting", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rocketstats-desktop-reconnect-"));
  const originalLogPath = process.env.RL_LOG_PATH;
  const server = createServer((socket) => socket.write('{"invalid":}'));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  process.env.RL_LOG_PATH = join(directory, "Launch.log");

  const errors = [];
  const statuses = [];
  let service;
  try {
    service = await startDesktopService({
      statePath: join(directory, "state.json"),
      locale: "en",
      port: address.port,
      onModel() {},
      onStatus: (status) => statuses.push(status),
      onError: (message, kind) => errors.push({ message, kind })
    });

    await waitFor(
      () => errors.some((error) => error.kind === "connection" && /ECONNREFUSED/.test(error.message)) &&
        statuses.includes("disconnected"),
      "Expected a refused connection and disconnected status."
    );
    server.listen(address.port, "127.0.0.1");
    await once(server, "listening");
    await waitFor(
      () => statuses.includes("connected") &&
        errors.some((error) => error.kind === "other" && /Invalid JSON object/.test(error.message)),
      "Expected reconnection and a separately classified invalid-feed error."
    );
  } finally {
    service?.stop();
    if (server.listening) {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
    if (originalLogPath === undefined) {
      delete process.env.RL_LOG_PATH;
    } else {
      process.env.RL_LOG_PATH = originalLogPath;
    }
    await rm(directory, { recursive: true, force: true });
  }
});
