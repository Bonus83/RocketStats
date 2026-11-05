import { readFile } from "node:fs/promises";
import { build, Platform, Arch } from "electron-builder";
import { parseUpdateConfig, desktopBuildConfig } from "../desktop/update-config.cjs";

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
  await build({
    targets: Platform.WINDOWS.createTarget(["nsis"], Arch.x64),
    config: desktopBuildConfig(config, args.includes("--release")),
    publish: "never"
  });
}

main().catch((error) => {
  console.error(`Desktop build failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
