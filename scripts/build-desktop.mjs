import { readFile } from "node:fs/promises";
import { build, Platform, Arch } from "electron-builder";
import { parseUpdateConfig, desktopBuildConfig } from "../desktop/update-config.cjs";

const MAX_BUILD_ATTEMPTS = 3;

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--release")) {
    throw new Error("Use build-desktop.mjs with no arguments, or --release.");
  }
  const config = parseUpdateConfig(JSON.parse(await readFile(
    new URL("../desktop/update-config.json", import.meta.url), "utf8"
  )));
  if (!config && !args.includes("--release")) {
    console.log("Building a local installer without an update source. Automatic updates are disabled.");
  }
  if (config && config.publisherNames.length === 0) {
    console.warn("Building without publisher-signature verification. Updates rely on the security of the GitHub release repository.");
  }
  const options = {
    targets: Platform.WINDOWS.createTarget(["nsis"], Arch.x64),
    config: desktopBuildConfig(config, args.includes("--release")),
    publish: "never"
  };
  await buildWithRetry(options);
}

async function buildWithRetry(options) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await build(options);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt >= MAX_BUILD_ATTEMPTS || !/Response code 50[234]\b/.test(message)) {
        throw error;
      }
      const delayMs = 5_000 * attempt;
      console.warn(
        `Desktop build received a transient HTTP error (attempt ${attempt}/${MAX_BUILD_ATTEMPTS}); ` +
        `retrying in ${delayMs / 1_000}s: ${message}`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

main().catch((error) => {
  console.error(`Desktop build failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
