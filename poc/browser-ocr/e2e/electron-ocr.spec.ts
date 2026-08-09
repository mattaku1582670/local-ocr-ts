import { _electron as electron, expect, test } from "@playwright/test";

const APPLICATION_PROTOCOL = "local-ocr:";
const APPLICATION_HOST = "app";
const DETECTION_MODEL_PATH = "/assets/models/PP-OCRv5_mobile_det_onnx_infer.tar";
const RECOGNITION_MODEL_PATH = "/assets/models/PP-OCRv5_mobile_rec_onnx_infer.tar";

test("runs Worker OCR inside a sandboxed Electron renderer", async () => {
  const electronApplication = await electron.launch({
    args: ["dist-electron/main.mjs"],
  });

  try {
    const window = await electronApplication.firstWindow();
    const externalRequests: string[] = [];
    const failedRequests: string[] = [];
    const localRequestPaths = new Set<string>();
    const pageErrors: string[] = [];
    const workerUrls: string[] = [];

    window.on("request", (request) => {
      const url = new URL(request.url());
      if (url.protocol === APPLICATION_PROTOCOL && url.host === APPLICATION_HOST) {
        localRequestPaths.add(url.pathname);
      } else if (url.protocol === "http:" || url.protocol === "https:") {
        externalRequests.push(url.href);
      }
    });
    window.on("requestfailed", (request) => failedRequests.push(request.url()));
    window.on("pageerror", (error) => pageErrors.push(error.message));
    window.on("worker", (worker) => workerUrls.push(worker.url()));

    const mainWindowState = await electronApplication.evaluate(({ BrowserWindow }) => {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow === undefined) {
        throw new Error("ELECTRON_E2E_WINDOW_MISSING");
      }
      return {
        devToolsOpened: mainWindow.webContents.isDevToolsOpened(),
        url: mainWindow.webContents.getURL(),
      };
    });
    expect(mainWindowState).toEqual({
      devToolsOpened: false,
      url: "local-ocr://app/",
    });

    const rendererBoundary = await window.evaluate(() => {
      const desktopApi = Reflect.get(globalThis, "localOcrDesktop");
      return {
        desktopRuntime:
          typeof desktopApi === "object" && desktopApi !== null
            ? Reflect.get(desktopApi, "runtime")
            : null,
        sandboxed:
          typeof desktopApi === "object" && desktopApi !== null
            ? Reflect.get(desktopApi, "sandboxed")
            : null,
        processType: typeof Reflect.get(globalThis, "process"),
        requireType: typeof Reflect.get(globalThis, "require"),
      };
    });
    expect(rendererBoundary).toEqual({
      desktopRuntime: "electron",
      sandboxed: true,
      processType: "undefined",
      requireType: "undefined",
    });
    const applicationUrl = new URL(window.url());
    expect(applicationUrl.protocol).toBe(APPLICATION_PROTOCOL);
    expect(applicationUrl.host).toBe(APPLICATION_HOST);

    const deniedWindowOpenReturnedNull = await window.evaluate(
      () => globalThis.open("data:text/html,blocked", "_blank") === null,
    );
    expect(deniedWindowOpenReturnedNull).toBe(true);
    await window.evaluate(() => globalThis.location.assign("data:text/html,blocked"));
    await window.waitForTimeout(250);
    expect(window.url()).toBe("local-ocr://app/");
    const windowCount = await electronApplication.evaluate(
      ({ BrowserWindow }) => BrowserWindow.getAllWindows().length,
    );
    expect(windowCount).toBe(1);

    const status = window.getByRole("status");
    await window.getByRole("button", { name: "英数字サンプルでOCR" }).click();
    await expect(status).toHaveAttribute("data-state", "working");
    await expect(status).toHaveAttribute("data-state", "success");
    await expect(window.getByTestId("recognized-text")).toContainText("LOCAL OCR");
    await expect(window.getByTestId("recognized-text")).toContainText("TEST ABC 123");
    await expect(window.getByTestId("result-json")).toContainText('"requestedBackend": "wasm"');
    await expect(window.getByTestId("result-json")).toContainText('"executionMode": "worker"');

    await window.getByRole("button", { name: "日本語サンプルでOCR" }).click();
    await expect(status).toHaveAttribute("data-state", "working");
    await expect(status).toHaveAttribute("data-state", "success");
    await expect(window.getByTestId("recognized-text")).toHaveText("日本語の文字認識\n東京 2026");

    expect(localRequestPaths).toContain(DETECTION_MODEL_PATH);
    expect(localRequestPaths).toContain(RECOGNITION_MODEL_PATH);
    expect(
      Array.from(localRequestPaths).some(
        (requestPath) => requestPath.startsWith("/assets/wasm/") && requestPath.endsWith(".wasm"),
      ),
    ).toBe(true);
    expect(workerUrls.some((url) => url.includes("worker-entry"))).toBe(true);
    expect(externalRequests).toEqual([]);
    expect(failedRequests).toEqual([]);
    expect(pageErrors).toEqual([]);
  } finally {
    await electronApplication.close();
  }
});
