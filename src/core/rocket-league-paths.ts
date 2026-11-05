import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { posix, win32 } from "node:path";

export interface RocketLeaguePathOptions {
  platform?: NodeJS.Platform;
  homeDirectory?: string;
  windowsDocumentsDirectory?: () => string;
}

function getWindowsDocumentsDirectory(): string {
  return execFileSync(
    "powershell.exe",
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); [Environment]::GetFolderPath('MyDocuments')"
    ],
    { encoding: "utf8", windowsHide: true, timeout: 5000 }
  ).trim();
}

export function getRocketLeaguePaths(options: RocketLeaguePathOptions = {}): {
  configPath: string;
  logPath: string;
} {
  const platform = options.platform ?? process.platform;
  const path = platform === "win32" ? win32 : posix;
  const documentsDirectory = platform === "win32"
    ? (options.windowsDocumentsDirectory ?? getWindowsDocumentsDirectory)()
    : path.join(options.homeDirectory ?? homedir(), "Documents");

  if (!path.isAbsolute(documentsDirectory)) {
    throw new Error("Unable to resolve an absolute Rocket League Documents directory.");
  }

  const gameDirectory = path.join(documentsDirectory, "My Games", "Rocket League", "TAGame");
  return {
    configPath: path.join(gameDirectory, "Config", "TAStatsAPI.ini"),
    logPath: path.join(gameDirectory, "Logs", "Launch.log")
  };
}
