import { BrowserWindow } from "electron";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { configureWebContentsSecurity } from "./security.js";

const currentDirectory = fileURLToPath(new URL(".", import.meta.url));
let mainWindow: BrowserWindow | null = null;

interface MainWindowFactory {
  (): BrowserWindow;
  getCurrent: () => BrowserWindow | null;
}

export const createMainWindow: MainWindowFactory = () => {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;

  const developmentUrl = process.env.VITE_DEV_SERVER_URL;
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
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
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (developmentUrl) {
    void mainWindow.loadURL(developmentUrl);
  } else {
    void mainWindow.loadFile(join(currentDirectory, "../../dist/index.html"));
  }

  return mainWindow;
};

createMainWindow.getCurrent = (): BrowserWindow | null => mainWindow;
