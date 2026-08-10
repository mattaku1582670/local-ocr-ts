import type { WebContents } from "electron";

export function isNavigationAllowed(currentUrl: string, targetUrl: string): boolean {
  return currentUrl.length > 0 && targetUrl === currentUrl;
}

export function configureWebContentsSecurity(webContents: WebContents): void {
  webContents.on("will-navigate", (event, targetUrl) => {
    if (!isNavigationAllowed(webContents.getURL(), targetUrl)) event.preventDefault();
  });

  webContents.setWindowOpenHandler(() => ({ action: "deny" }));
}
