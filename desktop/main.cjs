const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { execFileSync } = require("node:child_process");
const {
  copyFile, mkdir, readFile, rename, writeFile
} = require("node:fs/promises");
const { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { createConnectionState } = require("./connection-state.cjs");
const { parseUpdateConfig, updateDisabledReason } = require("./update-config.cjs");
const { createUpdateController } = require("./updater.cjs");

const APP_NAME = "RocketStats Desktop";
const LOCALES = new Set(["de", "en", "pl", "fr", "es", "pt", "ru"]);
const DEFAULT_PORT = 49123;

app.setName(APP_NAME);
const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();

let mainWindow;
let service;
let updateController;
let locale;
let port;
let autoCheckUpdates = true;
let startupError;
let apiSetupInProgress = false;
const models = new Map();
const settingsPath = path.join(app.getPath("userData"), "settings.json");

function systemLocale() {
  const candidate = app.getLocale().split(/[-_]/, 1)[0].toLowerCase();
  return LOCALES.has(candidate) ? candidate : "en";
}

function loadSettings() {
  if (!existsSync(settingsPath)) {
    return { locale: systemLocale(), port: DEFAULT_PORT, autoCheckUpdates: true };
  }
  const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
  if (
    typeof settings !== "object" ||
    settings === null ||
    !LOCALES.has(settings.locale) ||
    !Number.isInteger(settings.port) ||
    settings.port < 1 ||
    settings.port > 65535 ||
    (settings.autoCheckUpdates !== undefined && typeof settings.autoCheckUpdates !== "boolean")
  ) {
    throw new Error("RocketStats Desktop settings are invalid. Fix or remove settings.json.");
  }
  return {
    locale: settings.locale,
    port: settings.port,
    autoCheckUpdates: settings.autoCheckUpdates ?? true
  };
}

function saveSettings() {
  mkdirSync(path.dirname(settingsPath), { recursive: true });
  const temporaryPath = `${settingsPath}.tmp`;
  writeFileSync(temporaryPath, JSON.stringify({ locale, port, autoCheckUpdates }, null, 2), "utf8");
  renameSync(temporaryPath, settingsPath);
}

function assertRocketLeagueClosed(message) {
  const output = execFileSync(
    "tasklist",
    ["/FI", "IMAGENAME eq RocketLeague.exe", "/NH"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true }
  );
  if (/^\s*RocketLeague\.exe\s/im.test(output)) throw new Error(message);
}

function requireUpdateController(event) {
  if (
    !mainWindow || event.sender !== mainWindow.webContents ||
    event.senderFrame !== mainWindow.webContents.mainFrame
  ) {
    throw new Error("Updates can only be controlled from the desktop dashboard.");
  }
  if (!updateController) throw new Error("The updater is still starting.");
  return updateController;
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

const connectionState = createConnectionState((connection) => send("desktop:status", connection));

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 720,
    minHeight: 600,
    backgroundColor: "#080d16",
    title: APP_NAME,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url !== pathToFileURL(path.join(__dirname, "index.html")).href) {
      event.preventDefault();
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = undefined;
  });
  void mainWindow.loadFile(path.join(__dirname, "index.html"));
}

ipcMain.handle("desktop:get-state", () => ({
  models: [...models.values()],
  connection: connectionState.getState(),
  locale,
  port,
  startupError,
  autoCheckUpdates,
  update: updateController?.getState() ?? { phase: "starting", version: app.getVersion() }
}));

ipcMain.handle("desktop:check-update", (event) => requireUpdateController(event).check());
ipcMain.handle("desktop:download-update", (event) => requireUpdateController(event).download());
ipcMain.handle("desktop:install-update", (event) => requireUpdateController(event).install());
ipcMain.handle("desktop:set-auto-updates", (event, enabled) => {
  const controller = requireUpdateController(event);
  if (typeof enabled !== "boolean") throw new TypeError("Automatic update checking must be a boolean.");
  const previous = autoCheckUpdates;
  autoCheckUpdates = enabled;
  try {
    saveSettings();
  } catch (error) {
    autoCheckUpdates = previous;
    throw error;
  }
  controller.configureAutomaticChecks(enabled);
  return { autoCheckUpdates };
});

ipcMain.handle("desktop:set-locale", (_event, value) => {
  if (!service) throw new Error("RocketStats Desktop is still starting.");
  if (typeof value !== "string" || !LOCALES.has(value)) {
    throw new TypeError("Unsupported application language.");
  }
  locale = value;
  service.configureLocale(value);
  saveSettings();
  return { locale };
});

ipcMain.handle("desktop:set-port", (_event, value) => {
  if (!service) throw new Error("RocketStats Desktop is still starting.");
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new RangeError("Stats API port must be an integer between 1 and 65535.");
  }
  port = value;
  service.configurePort(value);
  saveSettings();
  return { port };
});

ipcMain.handle("desktop:toggle-scope", async () => {
  if (!service) throw new Error("RocketStats Desktop is still starting.");
  await service.toggleStatsScope();
});

ipcMain.handle("desktop:reset-stats", async () => {
  if (!service) throw new Error("RocketStats Desktop is still starting.");
  await service.resetStats();
});

ipcMain.handle("desktop:configure-api", async () => {
  if (!service) throw new Error("RocketStats Desktop is still starting.");
  if (apiSetupInProgress) {
    throw new Error("Stats API setup is already in progress.");
  }
  if (process.platform !== "win32") {
    throw new Error("The guided Stats API setup currently supports Windows only.");
  }
  apiSetupInProgress = true;
  try {
    assertRocketLeagueClosed(
      "Close Rocket League before changing its Stats API configuration."
    );

    const pathsUrl = pathToFileURL(path.resolve(
      __dirname,
      "..",
      "com.rocketstats.livestats.sdPlugin",
      "bin",
      "core",
      "rocket-league-paths.js"
    )).href;
    const configUrl = pathToFileURL(path.resolve(
      __dirname,
      "..",
      "scripts",
      "rl-stats-api-config.mjs"
    )).href;
    const [{ getRocketLeaguePaths }, apiConfig] = await Promise.all([
      import(pathsUrl),
      import(configUrl)
    ]);
    const configPath = getRocketLeaguePaths().configPath;
    let original = "";
    let configExists = true;
    try {
      original = await readFile(configPath, "utf8");
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        configExists = false;
      } else {
        throw error;
      }
    }

    if (apiConfig.isStatsApiIniConfigured(original)) {
      port = apiConfig.RL_STATS_API_PORT;
      service.configurePort(port);
      saveSettings();
      return { alreadyConfigured: true, port };
    }

    await mkdir(path.dirname(configPath), { recursive: true });
    let backupPath;
    if (configExists) {
      const timestamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
      backupPath = `${configPath}.${timestamp}.bak`;
      await copyFile(configPath, backupPath);
    }
    const temporaryPath = `${configPath}.rocketstats-tmp`;
    await writeFile(temporaryPath, apiConfig.updateStatsApiIni(original), "utf8");
    await rename(temporaryPath, configPath);

    port = apiConfig.RL_STATS_API_PORT;
    service.configurePort(port);
    saveSettings();
    return {
      alreadyConfigured: false,
      port,
      backupCreated: backupPath !== undefined
    };
  } finally {
    apiSetupInProgress = false;
  }
});

app.whenReady().then(async () => {
  if (!singleInstance) return;
  try {
    ({ locale, port, autoCheckUpdates } = loadSettings());
    const config = parseUpdateConfig(JSON.parse(readFileSync(
      path.join(__dirname, "update-config.json"), "utf8"
    )));
    const disabledReason = updateDisabledReason(config, app.isPackaged, process.platform);
    updateController = createUpdateController({
      updater: disabledReason ? null : require("electron-updater").autoUpdater,
      version: app.getVersion(),
      source: config ? `${config.owner}/${config.repo}` : null,
      publisherVerification: Boolean(config?.publisherNames.length),
      disabledReason,
      onState: (update) => send("desktop:update", update),
      beforeInstall: async () => {
        if (!service) throw new Error("RocketStats Desktop is still starting.");
        assertRocketLeagueClosed("Close Rocket League before installing an update.");
        await service.prepareForUpdate();
      }
    });
    createWindow();
    const moduleUrl = pathToFileURL(
      path.resolve(__dirname, "..", "com.rocketstats.livestats.sdPlugin", "bin", "desktop", "desktop-service.js")
    ).href;
    const { startDesktopService } = await import(moduleUrl);
    service = await startDesktopService({
      statePath: path.join(app.getPath("userData"), "state.json"),
      locale,
      port,
      onModel: (model) => {
        models.set(model.action, model);
        send("desktop:model", model);
      },
      onStatus: (nextStatus) => connectionState.setStatus(nextStatus),
      onError: (message, kind) => {
        if (kind === "connection") {
          connectionState.setError(message);
        } else {
          startupError = message;
          send("desktop:error", message);
        }
      }
    });
    updateController.configureAutomaticChecks(autoCheckUpdates);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    dialog.showErrorBox(`${APP_NAME} could not start`, message);
    app.quit();
  }
});

app.on("before-quit", () => {
  updateController?.dispose();
  service?.stop();
});

app.on("second-instance", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.on("window-all-closed", () => {
  app.quit();
});
