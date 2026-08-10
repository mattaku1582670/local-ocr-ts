import { BrowserWindow } from "electron";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { configureWebContentsSecurity } from "./security.js";
import { APPLICATION_URL } from "./appProtocol.js";
import type { WindowState } from "./services/windowStateService.js";

const currentDirectory = fileURLToPath(new URL(".", import.meta.url));
let mainWindow: BrowserWindow | null = null;

interface MainWindowFactory {
  (options?: MainWindowOptions): BrowserWindow;
  getCurrent: () => BrowserWindow | null;
}

interface MainWindowOptions {
  initialState?: WindowState;
  saveState?: (state: WindowState) => Promise<void>;
}

export const createMainWindow: MainWindowFactory = (options = {}) => {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;

  const developmentUrl = process.env.VITE_DEV_SERVER_URL;
  const initialState = options.initialState;
  mainWindow = new BrowserWindow({
    ...(initialState?.x === undefined ? {} : { x: initialState.x }),
    ...(initialState?.y === undefined ? {} : { y: initialState.y }),
    width: initialState?.width ?? 1280,
    height: initialState?.height ?? 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: "#eef2f8",
    webPreferences: {
      preload: join(currentDirectory, "../preload/index.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      devTools: developmentUrl !== undefined,
    },
  });

  configureWebContentsSecurity(mainWindow.webContents);
  if (initialState?.isMaximized) mainWindow.maximize();
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  let stateSaved = false;
  mainWindow.on("close", (event) => {
    if (!options.saveState || stateSaved || !mainWindow) return;
    event.preventDefault();
    const bounds = mainWindow.getNormalBounds();
    const state: WindowState = {
      version: 1,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: mainWindow.isMaximized(),
    };
    void options.saveState(state).finally(() => {
      stateSaved = true;
      mainWindow?.destroy();
    });
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (developmentUrl) {
    void mainWindow.loadURL(developmentUrl);
  } else {
    void mainWindow.loadURL(APPLICATION_URL);
  }

  return mainWindow;
};

createMainWindow.getCurrent = (): BrowserWindow | null => mainWindow;
