interface LocalOcrDesktopApi {
  readonly runtime: "electron";
  readonly sandboxed: boolean;
}

interface Window {
  readonly localOcrDesktop?: LocalOcrDesktopApi;
}
