import { app } from "electron";
import { createMainWindow } from "./createWindow.js";

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

  void app.whenReady().then(() => {
    createMainWindow();

    app.on("activate", () => {
      if (!createMainWindow.getCurrent()) createMainWindow();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
