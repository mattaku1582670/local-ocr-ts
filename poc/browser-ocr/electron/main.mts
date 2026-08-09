import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { app, BrowserWindow, net, protocol, session } from "electron";

const APPLICATION_SCHEME = "local-ocr";
const APPLICATION_HOST = "app";
const APPLICATION_URL = `${APPLICATION_SCHEME}://${APPLICATION_HOST}/`;
const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rendererDirectory = path.join(projectDirectory, "dist");
const packagedOcrAssetsDirectory = path.join(process.resourcesPath, "ocr-assets");

protocol.registerSchemesAsPrivileged([
  {
    scheme: APPLICATION_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      codeCache: true,
    },
  },
]);

app.commandLine.appendSwitch("disable-background-networking");

void app
  .whenReady()
  .then(async () => {
    registerLocalProtocol();
    configureSessionSecurity();
    await createMainWindow();
  })
  .catch(() => {
    process.stderr.write("ELECTRON_STARTUP_FAILED\n");
    app.exit(1);
  });

app.on("window-all-closed", () => {
  app.quit();
});

function registerLocalProtocol(): void {
  protocol.handle(APPLICATION_SCHEME, async (request) => {
    if (request.method !== "GET") {
      return new Response(null, { status: 405 });
    }

    const assetPath = resolveLocalAssetPath(request.url);
    if (assetPath === null) {
      return new Response(null, { status: 404 });
    }

    return net.fetch(pathToFileURL(assetPath).href);
  });
}

function configureSessionSecurity(): void {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ["http://*/*", "https://*/*"] },
    (_details, callback) => {
      callback({ cancel: true });
    },
  );
}

async function createMainWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(projectDirectory, "dist-electron", "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      devTools: false,
    },
  });

  window.webContents.on("will-navigate", (event, navigationUrl) => {
    if (!isApplicationUrl(navigationUrl)) {
      event.preventDefault();
    }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });

  await window.loadURL(APPLICATION_URL);
  window.show();
}

function resolveLocalAssetPath(requestUrl: string): string | null {
  const url = new URL(requestUrl);
  if (url.protocol !== `${APPLICATION_SCHEME}:` || url.host !== APPLICATION_HOST) {
    return null;
  }

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }

  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  if (relativePath.includes("\0")) {
    return null;
  }

  const assetLocation = resolveAssetLocation(relativePath);
  const assetPath = path.resolve(assetLocation.root, assetLocation.relativePath);
  const pathFromAssetRoot = path.relative(assetLocation.root, assetPath);
  if (pathFromAssetRoot.startsWith("..") || path.isAbsolute(pathFromAssetRoot)) {
    return null;
  }
  return assetPath;
}

function resolveAssetLocation(relativePath: string): {
  readonly root: string;
  readonly relativePath: string;
} {
  if (app.isPackaged && relativePath.startsWith("assets/models/")) {
    return {
      root: packagedOcrAssetsDirectory,
      relativePath: relativePath.slice("assets/".length),
    };
  }
  if (app.isPackaged && relativePath.startsWith("assets/wasm/")) {
    return {
      root: packagedOcrAssetsDirectory,
      relativePath: relativePath.slice("assets/".length),
    };
  }
  return { root: rendererDirectory, relativePath };
}

function isApplicationUrl(navigationUrl: string): boolean {
  const url = new URL(navigationUrl);
  return url.protocol === `${APPLICATION_SCHEME}:` && url.host === APPLICATION_HOST;
}
