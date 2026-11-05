import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { join } from "node:path";

test("Stats API diagnostic reports event names without logging player data", async () => {
  const secretName = "DoNotPrintThisPlayerName";
  const frames = [
    JSON.stringify({
      Event: "UpdateState",
      Data: { Players: [{ Name: secretName, PrimaryId: "private-account-id" }] }
    }),
    JSON.stringify({ Event: "ClockUpdatedSeconds", Data: { TimeSeconds: 30 } })
  ].join("");
  const server = createServer((socket) => {
    socket.write(frames.slice(0, 29));
    socket.end(frames.slice(29));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to allocate test TCP port");
  }

  const script = join(process.cwd(), "scripts", "diagnose-stats-api.mjs");
  const child = spawn(process.execPath, [
    script,
    "--port",
    String(address.port),
    "--duration-ms",
    "250"
  ]);
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
  child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });

  const exitCode = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Diagnostic process timed out"));
    }, 3000);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      resolve(code);
    });
  });
  await new Promise((resolve) => server.close(resolve));

  assert.equal(exitCode, 0, stderr);
  assert.match(stdout, /UpdateState \(1\)/);
  assert.match(stdout, /ClockUpdatedSeconds \(1\)/);
  assert.doesNotMatch(stdout, new RegExp(secretName));
  assert.doesNotMatch(stdout, /private-account-id/);
});
