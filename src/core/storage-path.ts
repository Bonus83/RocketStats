import { posix, win32 } from "node:path";

export interface StatePathOptions {
  platform: NodeJS.Platform;
  homeDirectory: string;
  appData?: string;
  xdgStateHome?: string;
}

export function getStatePath(options: StatePathOptions): string {
  if (options.platform === "win32") {
    const appData = options.appData ||
      win32.join(options.homeDirectory, "AppData", "Roaming");
    return win32.join(appData, "RocketStatsElgato", "state.json");
  }

  if (options.platform === "darwin") {
    return posix.join(
      options.homeDirectory,
      "Library",
      "Application Support",
      "RocketStatsElgato",
      "state.json"
    );
  }

  const stateDirectory = options.xdgStateHome && posix.isAbsolute(options.xdgStateHome)
    ? options.xdgStateHome
    : posix.join(options.homeDirectory, ".local", "state");
  return posix.join(stateDirectory, "RocketStatsElgato", "state.json");
}
