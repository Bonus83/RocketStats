#!/usr/bin/env node
// Fast helpers for small changes: targeted type-check and targeted tests.
import { execFileSync, spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

const TEST_GROUPS = {
  ui: ["desktop-connection", "desktop-dashboard"],
  update: ["desktop-updater", "desktop-update-balloon", "desktop-update-install"],
  service: ["desktop-service"],
  core: ["core", "auto-mmr", "game-log"],
};

// Source path prefix -> test groups that cover it.
const SOURCE_MAP = [
  ["desktop/updater.cjs", ["update"]],
  ["desktop/renderer.js", ["ui", "update"]],
  ["desktop/index.html", ["ui"]],
  ["desktop/styles.css", ["ui"]],
  ["desktop/", ["ui"]],
  ["src/desktop/", ["service"]],
  ["src/runtime/", ["service", "core"]],
  ["src/connector/", ["core", "service"]],
  ["src/core/", ["core", "service"]],
  ["src/", ["core"]],
];

function allTests() {
  return readdirSync(path.join(root, "test"))
    .filter((name) => name.endsWith(".test.mjs"))
    .map((name) => name.slice(0, -".test.mjs".length));
}

function resolveTests(args) {
  const names = new Set();
  for (const arg of args) {
    if (arg === "all") allTests().forEach((name) => names.add(name));
    else if (TEST_GROUPS[arg]) TEST_GROUPS[arg].forEach((name) => names.add(name));
    else if (allTests().includes(arg)) names.add(arg);
    else throw new Error(`Unknown test group or file: ${arg}. Groups: ${Object.keys(TEST_GROUPS).join(", ")}, all`);
  }
  return [...names];
}

function changedFiles() {
  const output = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: root, encoding: "utf8" });
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3).replace(/^.* -> /, "").replace(/\\/g, "/"));
}

function affected() {
  const files = changedFiles();
  const tests = new Set();
  let needsCheck = false;
  for (const file of files) {
    if (file.startsWith("src/")) needsCheck = true;
    const match = file.match(/^test\/(.+)\.test\.mjs$/);
    if (match) {
      tests.add(match[1]);
      continue;
    }
    const entry = SOURCE_MAP.find(([prefix]) => file.startsWith(prefix));
    if (entry) entry[1].forEach((group) => TEST_GROUPS[group].forEach((name) => tests.add(name)));
  }
  return { files, tests: [...tests], needsCheck };
}

// Type-checks and emits only the desktop dependency graph; never touches bin/index.js.
function check() {
  const ts = require("typescript");
  const configPath = path.join(root, "tsconfig.json");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
  const host = ts.createCompilerHost({});
  const { options, errors } = ts.convertCompilerOptionsFromJson(config.config.compilerOptions, root, configPath);
  if (errors.length) throw new Error(ts.formatDiagnostics(errors, host));
  const program = ts.createProgram([path.join(root, "src", "desktop", "desktop-service.ts")], options);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length) {
    console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, host));
    return false;
  }
  const outRoot = path.join(root, "com.rocketstats.livestats.sdPlugin", "bin");
  let count = 0;
  const result = program.emit(undefined, (file, text, bom) => {
    const rel = path.relative(outRoot, path.resolve(file));
    if (rel.startsWith("..") || path.isAbsolute(rel) || rel === "index.js" || !rel.endsWith(".js")) {
      throw new Error(`Unexpected output path: ${rel}`);
    }
    ts.sys.writeFile(file, text, bom);
    count += 1;
  });
  if (result.emitSkipped || result.diagnostics.length) {
    console.error(ts.formatDiagnosticsWithColorAndContext(result.diagnostics, host));
    return false;
  }
  console.log(`check: TypeScript ${ts.version} OK, ${count} files emitted`);
  return true;
}

function runTests(names) {
  if (!names.length) {
    console.log("test: nothing to run");
    return true;
  }
  const files = names.map((name) => path.join("test", `${name}.test.mjs`));
  console.log(`test: ${names.join(", ")}`);
  const result = spawnSync(process.execPath, ["--test", "--test-reporter=dot", ...files], { cwd: root, stdio: "inherit" });
  return result.status === 0;
}

function usage() {
  console.log(`Usage: node scripts/dev.mjs <command>

  check              Type-check and emit the desktop TypeScript graph
  test <group|file>  Run test groups (${Object.keys(TEST_GROUPS).join(", ")}, all) or single test files
  affected           Show changed files and the tests that cover them
  verify             check (if src/ changed) + affected tests`);
}

const [command, ...args] = process.argv.slice(2);
let ok = true;
try {
  switch (command) {
    case "check":
      ok = check();
      break;
    case "test":
      ok = runTests(resolveTests(args.length ? args : ["all"]));
      break;
    case "affected": {
      const { files, tests, needsCheck } = affected();
      console.log(`changed (${files.length}):\n  ${files.join("\n  ")}`);
      console.log(`type-check needed: ${needsCheck ? "yes" : "no"}`);
      console.log(`tests: ${tests.join(", ") || "none"}`);
      break;
    }
    case "verify": {
      const { tests, needsCheck } = affected();
      ok = (!needsCheck || check()) && runTests(tests);
      break;
    }
    default:
      usage();
      ok = command === undefined || command === "help";
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  ok = false;
}
process.exit(ok ? 0 : 1);
