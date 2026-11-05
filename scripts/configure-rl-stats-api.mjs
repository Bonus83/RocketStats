import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { getRocketLeaguePaths } from "../src/core/rocket-league-paths.ts";
import {
  isStatsApiIniConfigured,
  RL_STATS_API_PACKET_RATE,
  RL_STATS_API_PORT,
  updateStatsApiIni
} from "./rl-stats-api-config.mjs";


function readArguments(args) {
  const options = { checkOnly: false, configPath: undefined };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--check") {
      options.checkOnly = true;
    } else if (args[index] === "--config" && args[index + 1]) {
      options.configPath = resolve(args[index + 1]);
      index += 1;
    } else {
      throw new Error(
        `Unknown argument "${args[index]}". Use --check or --config <path>.`
      );
    }
  }
  options.configPath ??= getRocketLeaguePaths().configPath;
  return options;
}

function assertGameClosed() {
  if (process.platform !== "win32") {
    throw new Error("This setup command currently supports Windows only.");
  }
  const output = execFileSync(
    "tasklist",
    ["/FI", "IMAGENAME eq RocketLeague.exe", "/NH"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
  if (/^\s*RocketLeague\.exe\s/im.test(output)) {
    throw new Error("Close Rocket League before changing its Stats API configuration.");
  }
}

async function main() {
  const options = readArguments(process.argv.slice(2));
  let configExists = true;
  const original = await readFile(options.configPath, "utf8").catch((error) => {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      configExists = false;
      return "";
    }
    throw error;
  });
  const updated = updateStatsApiIni(original);

  if (options.checkOnly) {
    if (isStatsApiIniConfigured(original)) {
      console.log(`Rocket League Stats API configuration is ready: ${options.configPath}`);
      return;
    }
    throw new Error(
      `Stats API settings are missing or differ in ${options.configPath}. Run without --check after closing Rocket League.`
    );
  }

  assertGameClosed();
  await mkdir(dirname(options.configPath), { recursive: true });
  if (configExists) {
    const timestamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
    const backupPath = `${options.configPath}.${timestamp}.bak`;
    await copyFile(options.configPath, backupPath);
    console.log(`Backup created: ${backupPath}`);
  }

  const temporaryPath = `${options.configPath}.rocketstats-tmp`;
  await writeFile(temporaryPath, updated, "utf8");
  await rename(temporaryPath, options.configPath);
  console.log(
    `Configured Rocket League Stats API on port ${RL_STATS_API_PORT} (${RL_STATS_API_PACKET_RATE} packets/second): ${options.configPath}`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Stats API setup failed: ${message}`);
  process.exitCode = 1;
});
