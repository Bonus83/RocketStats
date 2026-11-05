import test from "node:test";
import assert from "node:assert/strict";

const { getStatePath } = await import(
  "../com.rocketstats.livestats.sdPlugin/bin/core/storage-path.js"
);

test("state path uses the Windows roaming application-data directory", () => {
  assert.equal(
    getStatePath({
      platform: "win32",
      homeDirectory: "C:\\Users\\Player",
      appData: "D:\\Roaming"
    }),
    "D:\\Roaming\\RocketStatsElgato\\state.json"
  );
  assert.equal(
    getStatePath({
      platform: "win32",
      homeDirectory: "C:\\Users\\Player"
    }),
    "C:\\Users\\Player\\AppData\\Roaming\\RocketStatsElgato\\state.json"
  );
});

test("state path uses the macOS Application Support directory", () => {
  assert.equal(
    getStatePath({
      platform: "darwin",
      homeDirectory: "/Users/player"
    }),
    "/Users/player/Library/Application Support/RocketStatsElgato/state.json"
  );
});

test("state path honors an absolute XDG state directory on Linux", () => {
  assert.equal(
    getStatePath({
      platform: "linux",
      homeDirectory: "/home/player",
      xdgStateHome: "/mnt/state"
    }),
    "/mnt/state/RocketStatsElgato/state.json"
  );
  assert.equal(
    getStatePath({
      platform: "linux",
      homeDirectory: "/home/player",
      xdgStateHome: "relative/state"
    }),
    "/home/player/.local/state/RocketStatsElgato/state.json"
  );
});
