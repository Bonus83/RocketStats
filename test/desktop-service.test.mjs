import assert from "node:assert/strict";
import { createServer } from "node:net";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import test from "node:test";
import { startDesktopService } from "../com.rocketstats.livestats.sdPlugin/bin/desktop/desktop-service.js";

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
