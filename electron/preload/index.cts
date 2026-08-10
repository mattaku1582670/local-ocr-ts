import { contextBridge, ipcRenderer } from "electron";
import IPC_CHANNELS = require("../shared/ipcChannels.cjs");

const desktopApi = Object.freeze({
  versions: Object.freeze({
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  }),
  settings: Object.freeze({
    load: () => ipcRenderer.invoke(IPC_CHANNELS.settings.load) as Promise<unknown>,
    save: (settings: unknown) =>
      ipcRenderer.invoke(IPC_CHANNELS.settings.save, settings) as Promise<unknown>,
  }),
});

contextBridge.exposeInMainWorld("desktopApi", desktopApi);
