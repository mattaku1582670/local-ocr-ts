import { contextBridge } from "electron";

const desktopApi = Object.freeze({
  versions: Object.freeze({
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  }),
});

contextBridge.exposeInMainWorld("desktopApi", desktopApi);
