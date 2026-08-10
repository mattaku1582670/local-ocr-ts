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
  files: Object.freeze({
    openImages: () => ipcRenderer.invoke(IPC_CHANNELS.file.openImages) as Promise<unknown>,
    saveText: (request: unknown) =>
      ipcRenderer.invoke(IPC_CHANNELS.file.saveText, request) as Promise<unknown>,
    saveJson: (request: unknown) =>
      ipcRenderer.invoke(IPC_CHANNELS.file.saveJson, request) as Promise<unknown>,
  }),
  clipboard: Object.freeze({
    readImage: () => ipcRenderer.invoke(IPC_CHANNELS.clipboard.readImage) as Promise<unknown>,
  }),
});

contextBridge.exposeInMainWorld("desktopApi", desktopApi);
