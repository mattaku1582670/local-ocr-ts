import { app } from "electron";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { registerApplicationProtocol, registerApplicationScheme } from "./appProtocol.js";
import { createMainWindow } from "./createWindow.js";
import { registerIpc } from "./ipc/registerIpc.js";
import { createRuntimePathContext, resolveDataDirectory } from "./portablePaths.js";
import { LocalLogger } from "./services/logService.js";
import { SettingsService } from "./services/settingsService.js";
import { WindowStateService } from "./services/windowStateService.js";

interface RuntimeServices {
  logger: LocalLogger;
  windowState: WindowStateService;
}

let runtimeServices: RuntimeServices | undefined;
const currentDirectory = fileURLToPath(new URL(".", import.meta.url));
const rendererDirectory = join(currentDirectory, "../../dist");

registerApplicationScheme();
app.commandLine.appendSwitch("disable-background-networking");

async function openMainWindow(): Promise<void> {
  if (!runtimeServices) throw new Error("Runtime services are not initialized");
  const initialState = await runtimeServices.windowState.load();
  createMainWindow({
    initialState,
    saveState: async (state) => {
      await runtimeServices?.windowState.save(state);
    },
  });
}

async function bootstrap(): Promise<void> {
  registerApplicationProtocol(rendererDirectory);
  const dataDirectory = await resolveDataDirectory(createRuntimePathContext(app));
  const settingsService = new SettingsService(dataDirectory.path);
  const loadedSettings = await settingsService.load();
  const logger = new LocalLogger(join(dataDirectory.path, "logs"), {
    enabled: loadedSettings.settings.loggingEnabled,
    debugEnabled: !app.isPackaged,
  });
  const windowState = new WindowStateService(dataDirectory.path);
  runtimeServices = { logger, windowState };

  registerIpc({ logger, settings: settingsService });
  await logger.info("app.start", {
    appVersion: app.getVersion(),
    ...(process.platform === "win32" ? { platform: "win32" as const } : {}),
    ...(process.arch === "x64" || process.arch === "arm64" || process.arch === "ia32"
      ? { arch: process.arch }
      : {}),
    dataSource: dataDirectory.source,
    settingsSource: loadedSettings.source,
  });
  await openMainWindow();
}

const acquiredSingleInstanceLock = app.requestSingleInstanceLock();

if (!acquiredSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const window = createMainWindow.getCurrent();
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.focus();
  });

  void app
    .whenReady()
    .then(bootstrap)
    .catch(() => {
      console.error("APP_START_FAILED");
      app.quit();
    });

  app.on("activate", () => {
    if (!createMainWindow.getCurrent()) void openMainWindow();
  });
}

app.on("before-quit", () => {
  void runtimeServices?.logger.info("app.stop", { stage: "shutdown" });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
