import { _electron as electron, expect, test } from "@playwright/test";

test("secure Electron shell starts the renderer", async () => {
  const application = await electron.launch({
    args: ["."],
    env: {
      ...process.env,
      NODE_ENV: "test",
    },
  });

  try {
    const page = await application.firstWindow();
    const applicationRequests: string[] = [];
    const externalRequests: string[] = [];
    const pageErrors: string[] = [];
    const workerUrls: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.protocol === "local-ocr:" && url.host === "app") {
        applicationRequests.push(url.pathname);
      }
      if (url.protocol === "http:" || url.protocol === "https:") {
        externalRequests.push(url.href);
      }
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("worker", (worker) => workerUrls.push(worker.url()));

    await expect(page).toHaveTitle("Local OCR");
    await expect(page.getByRole("heading", { name: "Local OCR" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "OCR操作" })).toBeVisible();
    await expect(page.getByRole("button", { name: "画像を開く" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "貼り付け" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "画像をドロップまたは選択" })).toBeVisible();

    const securityState = await page.evaluate(() => ({
      hasNodeRequire: Object.hasOwn(globalThis, "require"),
      hasDesktopApi: typeof window.desktopApi === "object",
      hasFileApi: typeof window.desktopApi.files.openImages === "function",
      hasClipboardApi: typeof window.desktopApi.clipboard.readImage === "function",
    }));

    expect(securityState).toEqual({
      hasNodeRequire: false,
      hasDesktopApi: true,
      hasFileApi: true,
      hasClipboardApi: true,
    });

    const openedWindow = await page.evaluate(() => window.open("https://example.com"));
    expect(openedWindow).toBeNull();

    const csp = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute("content");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("connect-src 'self'");

    const exifOrientedSize = await page.evaluate(async () => {
      const canvas = new OffscreenCanvas(80, 40);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("EXIF_E2E_CANVAS_CONTEXT_MISSING");
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "black";
      context.fillRect(4, 4, 24, 12);
      const source = new Uint8Array(
        await (await canvas.convertToBlob({ type: "image/jpeg" })).arrayBuffer(),
      );
      const orientationSixApp1 = new Uint8Array([
        0xff, 0xe1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x49, 0x49, 0x2a, 0x00, 0x08,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, 0x06, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      ]);
      const jpeg = new Uint8Array(source.length + orientationSixApp1.length);
      jpeg.set(source.slice(0, 2), 0);
      jpeg.set(orientationSixApp1, 2);
      jpeg.set(source.slice(2), 2 + orientationSixApp1.length);
      const bitmap = await createImageBitmap(new Blob([jpeg], { type: "image/jpeg" }), {
        imageOrientation: "from-image",
      });
      const dimensions = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return dimensions;
    });
    expect(exifOrientedSize).toEqual({ width: 40, height: 80 });

    await expect(page.getByText("OCRエンジン: ready")).toBeVisible({ timeout: 25_000 });
    expect(applicationRequests).toContain("/assets/models/PP-OCRv5_mobile_det_onnx_infer.tar");
    expect(applicationRequests).toContain("/assets/models/PP-OCRv5_mobile_rec_onnx_infer.tar");
    expect(
      applicationRequests.some(
        (path) => path.startsWith("/assets/wasm/") && path.endsWith(".wasm"),
      ),
    ).toBe(true);
    expect(workerUrls.some((url) => url.includes("paddleOcr.worker"))).toBe(true);
    expect(externalRequests).toEqual([]);
    expect(pageErrors).toEqual([]);

    const ocrWorker = page.workers().find((worker) => worker.url().includes("paddleOcr.worker"));
    if (!ocrWorker) throw new Error("OCR_E2E_WORKER_MISSING");
    const liveOcrResult = await ocrWorker.evaluate(async () => {
      interface TestRequest {
        type: "RECOGNIZE";
        requestId: number;
        image: ImageBitmap;
        minimumConfidence: number;
        preprocessPreset: "none" | "document" | "screenshot";
      }
      interface TestResult {
        rawText: string;
        blocks: { confidence: number | null }[];
        image: { width: number; height: number };
        runtime: { requestedBackend: string; executionMode: string };
      }
      type TestResponse =
        | { type: "PROGRESS"; requestId: number }
        | { type: "RESULT"; requestId: number; result: TestResult }
        | { type: "ERROR"; requestId: number; error: { message: string } };
      const scope = globalThis as unknown as {
        onmessage: ((event: MessageEvent<TestRequest>) => void) | null;
        postMessage: (message: TestResponse) => void;
      };
      async function recognize(
        preprocessPreset: TestRequest["preprocessPreset"],
        requestId: number,
      ): Promise<TestResult> {
        const canvas = new OffscreenCanvas(480, 120);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("OCR_E2E_CANVAS_CONTEXT_MISSING");
        context.fillStyle = "white";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "black";
        context.font = "bold 42px sans-serif";
        context.fillText("LOCAL OCR 123", 24, 76);

        const originalPostMessage = scope.postMessage.bind(scope);
        return new Promise<TestResult>((resolve, reject) => {
          const timeout = setTimeout(() => {
            scope.postMessage = originalPostMessage;
            reject(new Error("OCR_E2E_RECOGNITION_TIMEOUT"));
          }, 20_000);
          scope.postMessage = (message) => {
            originalPostMessage(message);
            if (message.requestId !== requestId) return;
            if (message.type === "ERROR") {
              clearTimeout(timeout);
              scope.postMessage = originalPostMessage;
              reject(new Error(message.error.message));
            }
            if (message.type === "RESULT") {
              clearTimeout(timeout);
              scope.postMessage = originalPostMessage;
              resolve(message.result);
            }
          };
          scope.onmessage?.({
            data: {
              type: "RECOGNIZE",
              requestId,
              image: canvas.transferToImageBitmap(),
              minimumConfidence: 0,
              preprocessPreset,
            },
          } as MessageEvent<TestRequest>);
        });
      }

      return {
        none: await recognize("none", 900_001),
        document: await recognize("document", 900_002),
        screenshot: await recognize("screenshot", 900_003),
      };
    });
    for (const result of Object.values(liveOcrResult)) {
      expect(result.rawText.toUpperCase()).toContain("LOCAL OCR");
      expect(result.blocks.length).toBeGreaterThan(0);
      expect(
        result.blocks.every(
          (block) => block.confidence === null || (block.confidence >= 0 && block.confidence <= 1),
        ),
      ).toBe(true);
      expect(result.image).toEqual({ width: 480, height: 120 });
      expect(result.runtime).toMatchObject({
        requestedBackend: "wasm",
        executionMode: "worker",
      });
    }
    expect(externalRequests).toEqual([]);
    expect(pageErrors).toEqual([]);

    const settingsRoundTrip = await page.evaluate(async () => {
      type SettingsValue = { autoOcrAfterPaste: boolean } & Record<string, unknown>;
      const original = (await window.desktopApi.settings.load()) as SettingsValue;
      const updated: SettingsValue = {
        ...original,
        autoOcrAfterPaste: !original.autoOcrAfterPaste,
      };
      const saved = (await window.desktopApi.settings.save(updated)) as SettingsValue;
      const reloaded = (await window.desktopApi.settings.load()) as SettingsValue;
      await window.desktopApi.settings.save(original);
      return {
        expected: updated.autoOcrAfterPaste,
        saved: saved.autoOcrAfterPaste,
        reloaded: reloaded.autoOcrAfterPaste,
      };
    });
    expect(settingsRoundTrip.saved).toBe(settingsRoundTrip.expected);
    expect(settingsRoundTrip.reloaded).toBe(settingsRoundTrip.expected);
  } finally {
    await application.close();
  }
});

test("image preview remains operable at 200 percent display scaling", async () => {
  const application = await electron.launch({
    args: [".", "--force-device-scale-factor=2"],
    env: {
      ...process.env,
      NODE_ENV: "test",
    },
  });

  try {
    const page = await application.firstWindow();
    const devicePixelRatio = await page.evaluate(() => window.devicePixelRatio);
    expect(devicePixelRatio).toBeGreaterThanOrEqual(2);

    await page.getByRole("button", { name: "画像をドロップまたは選択" }).evaluate((zone) => {
      const binary = atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      );
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], "display-scale.png", { type: "image/png" }));
      zone.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: transfer }));
    });

    await expect(page.getByRole("img", { name: "display-scale.pngのプレビュー" })).toBeVisible();
    await expect(page.getByRole("toolbar", { name: "画像プレビュー操作" })).toBeVisible();
    await expect(page.getByRole("button", { name: "右へ90度回転" })).toBeVisible();
  } finally {
    await application.close();
  }
});
