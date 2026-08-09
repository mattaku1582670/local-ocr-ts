import { contextBridge } from "electron";

contextBridge.exposeInMainWorld(
  "localOcrDesktop",
  Object.freeze({
    runtime: "electron",
    sandboxed: process.sandboxed === true,
  }),
);
