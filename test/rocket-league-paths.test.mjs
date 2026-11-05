import test from "node:test";
import assert from "node:assert/strict";
import { getRocketLeaguePaths } from "../src/core/rocket-league-paths.ts";

test("Rocket League paths use the redirected Windows Documents folder", () => {
  const paths = getRocketLeaguePaths({
    platform: "win32",
    homeDirectory: "C:\\Users\\Player",
    windowsDocumentsDirectory: () => "D:\\OneDrive\\Dokumente"
  });
  assert.equal(
    paths.configPath,
    "D:\\OneDrive\\Dokumente\\My Games\\Rocket League\\TAGame\\Config\\TAStatsAPI.ini"
  );
  assert.equal(
    paths.logPath,
    "D:\\OneDrive\\Dokumente\\My Games\\Rocket League\\TAGame\\Logs\\Launch.log"
  );
});

test("Rocket League paths support Windows network Documents folders", () => {
  const paths = getRocketLeaguePaths({
    platform: "win32",
    windowsDocumentsDirectory: () => "\\\\server\\share\\Documents"
  });
  assert.equal(
    paths.configPath,
    "\\\\server\\share\\Documents\\My Games\\Rocket League\\TAGame\\Config\\TAStatsAPI.ini"
  );
});

test("Rocket League path resolution rejects missing or relative Windows Documents", () => {
  for (const documents of ["", "relative\\Documents"]) {
    assert.throws(
      () => getRocketLeaguePaths({
        platform: "win32",
        windowsDocumentsDirectory: () => documents
      }),
      /absolute Rocket League Documents directory/
    );
  }
});

test("non-Windows Rocket League paths do not call the Windows resolver", () => {
  const paths = getRocketLeaguePaths({
    platform: "linux",
    homeDirectory: "/home/player",
    windowsDocumentsDirectory: () => { throw new Error("unexpected Windows lookup"); }
  });
  assert.equal(
    paths.logPath,
    "/home/player/Documents/My Games/Rocket League/TAGame/Logs/Launch.log"
  );
});
