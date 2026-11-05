import assert from "node:assert/strict";
import { createServer } from "node:net";
import { mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import test from "node:test";
import { startDesktopService } from "../com.rocketstats.livestats.sdPlugin/bin/desktop/desktop-service.js";
import { OfficialStatsNormalizer } from "../com.rocketstats.livestats.sdPlugin/bin/connector/official-stats-normalizer.js";

async function waitFor(predicate, message) {
  const deadline = performance.now() + 7000;
  while (performance.now() < deadline) {
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

test("official match status uses only explicit lifecycle observations", () => {
  const normalizer = new OfficialStatsNormalizer();
  const clock = normalizer.normalize({ Event: "ClockUpdatedSeconds", Data: {} }, 1000);
  assert.equal(clock.matchStatusObservedAt, undefined);
  const created = normalizer.normalize({ Event: "MatchCreated", Data: {} }, 2000);
  assert.equal(created.isInMatch, true);
  assert.equal(created.matchStatusObservedAt, 2000);
  const anotherClock = normalizer.normalize({ Event: "ClockUpdatedSeconds", Data: {} }, 2500);
  assert.equal(anotherClock.matchStatusObservedAt, 2000);
  const ended = normalizer.normalize({ Event: "MatchEnded", Data: {} }, 3000);
  assert.equal(ended.isInMatch, false);
  assert.equal(ended.matchStatusObservedAt, 3000);
  normalizer.reset();
  assert.equal(
    normalizer.normalize({ Event: "ClockUpdatedSeconds", Data: {} }, 4000).matchStatusObservedAt,
    undefined
  );
});

test("desktop match status follows fresh feed events and becomes unknown on disconnect", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rocketstats-match-status-"));
  const originalLogPath = process.env.RL_LOG_PATH;
  const originalNow = Date.now;
  const clients = new Set();
  let client;
  const server = createServer((socket) => {
    client = socket;
    clients.add(socket);
    socket.on("close", () => clients.delete(socket));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  process.env.RL_LOG_PATH = join(directory, "Launch.log");

  const statuses = [];
  const errors = [];
  let renders = 0;
  let service;
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    service = await startDesktopService({
      statePath: join(directory, "state.json"),
      locale: "en",
      port: address.port,
      onModel: () => { renders += 1; },
      onStatus: (status) => statuses.push(status),
      onError: (message, kind) => errors.push({ message, kind })
    });
    await waitFor(() => client && statuses.includes("connected"), "Expected the test feed to connect.");
    assert.equal(service.getMatchStatus(), "unknown");

    let now = originalNow();
    Date.now = () => now;
    const send = async (payload) => {
      const previous = renders;
      client.write(JSON.stringify(payload));
      await waitFor(() => renders > previous, "Expected the feed event to be rendered.");
    };
    await send({ Event: "ClockUpdatedSeconds", Data: { TimeSeconds: 299 } });
    assert.equal(service.getMatchStatus(), "unknown");
    await send({ Event: "MatchCreated", MatchGuid: "status-match", Data: {} });
    assert.equal(service.getMatchStatus(), "in-match");
    now += 15_000;
    assert.equal(service.getMatchStatus(), "in-match");
    now += 1;
    assert.equal(service.getMatchStatus(), "unknown");
    await send({ Event: "UpdateState", MatchGuid: "status-match", Data: { Game: {}, Players: [] } });
    assert.equal(service.getMatchStatus(), "in-match");
    await send({ Event: "MatchEnded", MatchGuid: "status-match", Data: {} });
    assert.equal(service.getMatchStatus(), "not-in-match");
    await send({ matchId: "legacy", inMatch: true });
    assert.equal(service.getMatchStatus(), "in-match");
    await send({ matchId: "legacy", inMatch: false });
    assert.equal(service.getMatchStatus(), "not-in-match");
    await send({ matchId: "legacy", score: { blue: 1 } });
    assert.equal(service.getMatchStatus(), "unknown");
    await send({ Event: "MatchCreated", MatchGuid: "second-match", Data: {} });
    assert.equal(service.getMatchStatus(), "in-match");

    const previousClient = client;
    previousClient.destroy();
    await waitFor(
      () => statuses.includes("disconnected") && service.getMatchStatus() === "unknown",
      "Expected a disconnected feed to have unknown match status."
    );
    await waitFor(
      () => client !== previousClient && statuses.filter((status) => status === "connected").length >= 2,
      "Expected the feed to reconnect."
    );
    assert.equal(service.getMatchStatus(), "unknown");
    await send({ Event: "MatchCreated", MatchGuid: "reconnected", Data: {} });
    assert.equal(service.getMatchStatus(), "in-match");
    service.stop();
    assert.equal(service.getMatchStatus(), "unknown");
    assert.deepEqual(errors.filter((error) => error.kind !== "connection"), []);
  } finally {
    Date.now = originalNow;
    service?.stop();
    for (const socket of clients) socket.destroy();
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

test("a failed update state save resumes the live feed before allowing a retry", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rocketstats-update-recovery-"));
  const originalLogPath = process.env.RL_LOG_PATH;
  const blocker = join(directory, "not-a-directory");
  const statePath = join(blocker, "state.json");
  const clients = new Set();
  let client;
  const acceptClient = (socket) => {
    client = socket;
    clients.add(socket);
    socket.on("close", () => clients.delete(socket));
  };
  const server = createServer(acceptClient);
  const otherServer = createServer(acceptClient);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  otherServer.listen(0, "127.0.0.1");
  await once(otherServer, "listening");
  process.env.RL_LOG_PATH = join(directory, "Launch.log");
  const statuses = [];
  const scoreTitles = [];
  let service;
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    service = await startDesktopService({
      statePath, locale: "en", port: address.port,
      onModel: (model) => { if (model.action === "score") scoreTitles.push(model.title); },
      onStatus: (status) => statuses.push(status),
      onError: (message) => assert.fail(message)
    });
    await waitFor(() => client && statuses.includes("connected"), "Expected the test feed to connect.");
    await writeFile(blocker, "blocks the state directory");
    await assert.rejects(service.prepareForUpdate());
    await waitFor(
      () => statuses.filter((status) => status === "connected").length >= 2,
      "The live feed should reconnect after a failed state save."
    );
    client.write(JSON.stringify({ Event: "MatchCreated", MatchGuid: "resumed", Data: {} }));
    await waitFor(() => service.getMatchStatus() === "in-match", "Expected match tracking to resume.");

    await unlink(blocker);
    await service.prepareForUpdate();
    assert.ok(JSON.parse(await readFile(statePath, "utf8")).accounts);
    const otherAddress = otherServer.address();
    assert.ok(otherAddress && typeof otherAddress !== "string");
    service.configureLocale("de");
    service.configurePort(otherAddress.port);
    await service.resumeAfterUpdateFailure();
    await waitFor(
      () => statuses.filter((status) => status === "connected").length >= 3 &&
        client?.localPort === otherAddress.port,
      "The live feed should reconnect on the configured port if launching the installer fails."
    );
    assert.equal(scoreTitles.at(-1), "SPIELSTAND");
    client.write(JSON.stringify({ Event: "MatchCreated", MatchGuid: "resumed-again", Data: {} }));
    await waitFor(() => service.getMatchStatus() === "in-match", "Expected match tracking after installer failure.");
    await service.prepareForUpdate();
    service.stop();
    await service.resumeAfterUpdateFailure();
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(statuses.filter((status) => status === "connected").length, 3);
  } finally {
    service?.stop();
    for (const socket of clients) socket.destroy();
    server.close();
    await once(server, "close");
    otherServer.close();
    await once(otherServer, "close");
    if (originalLogPath === undefined) {
      delete process.env.RL_LOG_PATH;
    } else {
      process.env.RL_LOG_PATH = originalLogPath;
    }
    await rm(directory, { recursive: true, force: true });
  }
});

test("a failed update save reports a failed tracking restart as well", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rocketstats-update-restart-error-"));
  const originalLogPath = process.env.RL_LOG_PATH;
  const blocker = join(directory, "not-a-directory");
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  process.env.RL_LOG_PATH = join(directory, "Launch.log");
  let failRender = false;
  let service;
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    service = await startDesktopService({
      statePath: join(blocker, "state.json"), locale: "en", port: address.port,
      onModel() { if (failRender) throw new Error("Feed rendering failed"); },
      onStatus() {},
      onError: (message) => assert.fail(message)
    });
    await writeFile(blocker, "blocks the state directory");
    failRender = true;
    await assert.rejects(
      service.prepareForUpdate(),
      (error) => error instanceof AggregateError &&
        /Update preparation failed/.test(error.message) &&
        /Live tracking could not fully resume: Feed rendering failed/.test(error.message)
    );
    failRender = false;
    await service.resumeAfterUpdateFailure();
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
      onError: (message, kind, code) => errors.push({ message, kind, code })
    });

    await waitFor(
      () => errors.some((error) => error.kind === "connection" && /ECONNREFUSED/.test(error.message)) &&
        statuses.includes("disconnected"),
      "Expected a refused connection and disconnected status."
    );
    assert.equal(errors.find((error) => error.kind === "connection")?.code, "ECONNREFUSED");
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
