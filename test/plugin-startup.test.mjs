import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { createServer as createTcpServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startStreamDeckRuntime } from "../src/streamdeck/startup.ts";

function sendWebSocketJson(socket, value) {
  const payload = Buffer.from(JSON.stringify(value));
  const header = payload.length < 126 ? Buffer.alloc(2) : Buffer.alloc(4);
  header[0] = 0x81;
  if (payload.length < 126) {
    header[1] = payload.length;
  } else {
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  }
  socket.write(Buffer.concat([header, payload]));
}

function readWebSocketMessages(socket, onMessage) {
  let buffer = Buffer.alloc(0);
  socket.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 2) {
      const opcode = buffer[0] & 0x0f;
      const masked = (buffer[1] & 0x80) !== 0;
      let length = buffer[1] & 0x7f;
      let offset = 2;
      if (length === 126) {
        if (buffer.length < 4) return;
        length = buffer.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        throw new Error("Unexpectedly large WebSocket message in startup test");
      }
      if (masked) offset += 4;
      if (buffer.length < offset + length) return;
      const payload = Buffer.from(buffer.subarray(offset, offset + length));
      if (masked) {
        const mask = buffer.subarray(offset - 4, offset);
        for (let index = 0; index < payload.length; index += 1) {
          payload[index] ^= mask[index % 4];
        }
      }
      buffer = buffer.subarray(offset + length);
      if (opcode === 1) onMessage(JSON.parse(payload.toString("utf8")));
    }
  });
}

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server.address().port;
}

test("startup stops if the Stream Deck connection fails", async () => {
  const steps = [];
  await assert.rejects(startStreamDeckRuntime({
    initialize: async () => { steps.push("initialize"); },
    registerActions: () => { steps.push("register"); },
    connect: async () => {
      steps.push("connect");
      throw new Error("connection failed");
    },
    loadSettings: async () => { steps.push("settings"); },
    startRuntime: () => { steps.push("runtime"); }
  }), /connection failed/);
  assert.deepEqual(steps, ["initialize", "register", "connect"]);
});

test("Stream Deck startup restores settings and renders live data", async (t) => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "rocketstats-startup-"));
  const gameLog = join(temporaryDirectory, "Launch.log");
  await writeFile(gameLog, "");

  let shuttingDown = false;
  const gameSockets = new Set();
  const game = createTcpServer((socket) => {
    gameSockets.add(socket);
    socket.once("close", () => gameSockets.delete(socket));
    socket.on("error", (error) => { if (!shuttingDown) fail(error); });
    socket.write(`${JSON.stringify({
      matchId: "startup-test",
      inMatch: true,
      score: { blue: 3, orange: 1 }
    })}\n`);
  });
  const streamDeck = createHttpServer();
  const deckSockets = new Set();
  const messages = [];
  let complete;
  let fail;
  const rendered = new Promise((resolve, reject) => {
    complete = resolve;
    fail = reject;
  });
  let child;
  let timeout;
  let stdout = "";
  let stderr = "";

  t.after(async () => {
    shuttingDown = true;
    clearTimeout(timeout);
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill();
      await once(child, "exit");
    }
    for (const socket of [...gameSockets, ...deckSockets]) socket.destroy();
    await Promise.all([
      new Promise((resolve) => game.close(resolve)),
      new Promise((resolve) => streamDeck.close(resolve))
    ]);
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  const gamePort = await listen(game);
  const deckPort = await listen(streamDeck);
  streamDeck.on("upgrade", (request, socket) => {
    deckSockets.add(socket);
    socket.once("close", () => deckSockets.delete(socket));
    socket.on("error", (error) => { if (!shuttingDown) fail(error); });
    const accept = createHash("sha1")
      .update(`${request.headers["sec-websocket-key"]}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest("base64");
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`
    );
    readWebSocketMessages(socket, (message) => {
      messages.push(message);
      if (message.event === "registerPlugin") {
        sendWebSocketJson(socket, {
          event: "willAppear",
          action: "com.rocketstats.livestats.score",
          context: "score-context",
          device: "test-device",
          payload: {
            controller: "Keypad",
            coordinates: { column: 0, row: 0 },
            isInMultiAction: false,
            resources: {},
            settings: {}
          }
        });
      } else if (message.event === "getGlobalSettings") {
        sendWebSocketJson(socket, {
          event: "didReceiveGlobalSettings",
          ...(message.id ? { id: message.id } : {}),
          payload: { settings: { apiPort: gamePort } }
        });
      } else if (
        message.event === "setTitle" &&
        message.context === "score-context" &&
        message.payload.title.includes("3 - 1")
      ) {
        complete();
      }
    });
  });

  const pluginDirectory = join(process.cwd(), "com.rocketstats.livestats.sdPlugin");
  const manifest = JSON.parse(await readFile(join(pluginDirectory, "manifest.json"), "utf8"));
  const info = {
    application: {
      font: "Arial",
      language: "en",
      platform: process.platform === "darwin" ? "mac" : "windows",
      platformVersion: "10",
      version: "7.5.1"
    },
    colors: {},
    devicePixelRatio: 1,
    devices: [{
      id: "test-device",
      name: "Test Stream Deck",
      size: { columns: 5, rows: 3 },
      type: 0
    }],
    plugin: { uuid: manifest.UUID, version: manifest.Version }
  };
  const env = {
    ...process.env,
    APPDATA: temporaryDirectory,
    HOME: temporaryDirectory,
    USERPROFILE: temporaryDirectory,
    XDG_STATE_HOME: temporaryDirectory,
    RL_LOG_PATH: gameLog,
    RL_STATS_PORT: "1",
    ROCKETSTATS_LOCALE: "en"
  };
  delete env.ROCKETSTATS_BOOT;
  child = spawn(process.execPath, [
    join(process.cwd(), "test", "fixtures", "streamdeck-startup.mjs"),
    "-port", String(deckPort),
    "-pluginUUID", "plugin-context",
    "-registerEvent", "registerPlugin",
    "-info", JSON.stringify(info)
  ], { cwd: pluginDirectory, env });
  child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
  child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
  child.on("error", fail);
  child.on("exit", (code, signal) => {
    fail(new Error(`Plugin exited before rendering (code ${code}, signal ${signal}): ${stderr} ${stdout}`));
  });
  timeout = setTimeout(
    () => fail(new Error(`Plugin did not render a score. Events: ${messages.map((m) => m.event).join(", ")}. ${stderr} ${stdout}`)),
    8000
  );

  await rendered;
  assert.equal(messages[0].event, "registerPlugin");
  assert.ok(messages.some((message) => message.event === "getGlobalSettings"));
});
