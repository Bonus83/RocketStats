import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function getRocketLeagueProcessStartTime(): Promise<number | undefined> {
  if (process.platform !== "win32") {
    return undefined;
  }

  const script = [
    "$ErrorActionPreference = 'Stop'",
    "$game = @(Get-Process -Name 'RocketLeague' -ErrorAction SilentlyContinue)",
    "if ($game.Count -gt 1) { throw 'More than one Rocket League process is running.' }",
    "if ($game.Count -eq 1) { $game[0].StartTime.ToUniversalTime().ToString('o') }"
  ].join("; ");
  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script],
    { timeout: 5_000, windowsHide: true }
  );
  const value = stdout.trim();
  if (!value) {
    return undefined;
  }
  const startedAt = Date.parse(value);
  if (!Number.isFinite(startedAt)) {
    throw new Error("Could not determine when Rocket League started.");
  }
  return startedAt;
}
