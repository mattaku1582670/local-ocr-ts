import { expect, test } from "@playwright/test";

const LOCAL_ORIGIN = "http://127.0.0.1:4174";
const OFFLINE_GUARD_PROBE_URL = "https://example.com/__local_ocr_offline_guard_probe__";
const DETECTION_MODEL_PATH = "/assets/models/PP-OCRv5_mobile_det_onnx_infer.tar";
const RECOGNITION_MODEL_PATH = "/assets/models/PP-OCRv5_mobile_rec_onnx_infer.tar";

test("starts, initializes local models, and recognizes Latin and Japanese text offline", async ({
  context,
  page,
}) => {
  const blockedExternalRequests: string[] = [];
  const attemptedExternalRequests: string[] = [];
  const failedRequests: string[] = [];
  const localRequestPaths = new Set<string>();
  const pageErrors: string[] = [];
  let offlineGuardProbeBlocked = false;

  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (isNetworkProtocol(url.protocol) && url.origin !== LOCAL_ORIGIN) {
      if (url.href === OFFLINE_GUARD_PROBE_URL) {
        offlineGuardProbeBlocked = true;
      } else {
        blockedExternalRequests.push(url.href);
      }
      await route.abort("internetdisconnected");
      return;
    }
    await route.continue();
  });

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin === LOCAL_ORIGIN) {
      localRequestPaths.add(url.pathname);
    } else if (isNetworkProtocol(url.protocol) && url.href !== OFFLINE_GUARD_PROBE_URL) {
      attemptedExternalRequests.push(url.href);
    }
  });
  page.on("requestfailed", (request) => {
    if (request.url() !== OFFLINE_GUARD_PROBE_URL) {
      failedRequests.push(request.url());
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const offlineGuardProbePage = await context.newPage();
  await expect(offlineGuardProbePage.goto(OFFLINE_GUARD_PROBE_URL)).rejects.toThrow();
  expect(offlineGuardProbeBlocked).toBe(true);
  await offlineGuardProbePage.close();
  await page.goto("/");
  const status = page.getByRole("status");
  await expect(status).toHaveAttribute("data-state", "idle");

  await page.getByRole("button", { name: "英数字サンプルでOCR" }).click();
  await expect(status).toHaveAttribute("data-state", "working");
  await expect(status).toHaveAttribute("data-state", "success");
  await expect(page.getByTestId("recognized-text")).toContainText("LOCAL OCR");
  await expect(page.getByTestId("recognized-text")).toContainText("TEST ABC 123");
  await expect(page.getByTestId("result-json")).toContainText('"requestedBackend": "wasm"');
  await expect(page.getByTestId("result-json")).toContainText('"executionMode": "worker"');

  await page.getByRole("button", { name: "日本語サンプルでOCR" }).click();
  await expect(status).toHaveAttribute("data-state", "working");
  await expect(status).toHaveAttribute("data-state", "success");
  await expect(page.getByTestId("recognized-text")).toHaveText("日本語の文字認識\n東京 2026");

  expect(localRequestPaths).toContain(DETECTION_MODEL_PATH);
  expect(localRequestPaths).toContain(RECOGNITION_MODEL_PATH);
  expect(
    Array.from(localRequestPaths).some(
      (requestPath) => requestPath.startsWith("/assets/wasm/") && requestPath.endsWith(".wasm"),
    ),
  ).toBe(true);
  expect(attemptedExternalRequests).toEqual([]);
  expect(blockedExternalRequests).toEqual([]);
  expect(failedRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});

function isNetworkProtocol(protocol: string): boolean {
  return protocol === "http:" || protocol === "https:";
}
