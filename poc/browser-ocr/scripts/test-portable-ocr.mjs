import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const APPLICATION_URL = "local-ocr://app/";
const DETECTION_MODEL_PATH = "/assets/models/PP-OCRv5_mobile_det_onnx_infer.tar";
const RECOGNITION_MODEL_PATH = "/assets/models/PP-OCRv5_mobile_rec_onnx_infer.tar";
const OCR_TIMEOUT_MS = 90_000;

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const executablePath = await resolveExecutablePath(process.argv.slice(2));
const debugPort = await reserveLoopbackPort();
const endpoint = `http://127.0.0.1:${String(debugPort)}`;

let browser = null;
let launcher = null;
let page = null;
const externalRequests = [];
const failedRequests = [];
const localRequestPaths = new Set();
const localResponses = [];
const pageErrors = [];
const workerUrls = [];

try {
  launcher = spawn(executablePath, [`--remote-debugging-port=${String(debugPort)}`], {
    env: {
      ...process.env,
      NO_PROXY: "127.0.0.1,localhost",
      no_proxy: "127.0.0.1,localhost",
    },
    stdio: "ignore",
    windowsHide: true,
  });

  const webSocketDebuggerUrl = await waitForDebugEndpoint(endpoint, launcher, 60_000);
  browser = await chromium.connectOverCDP(webSocketDebuggerUrl);
  const context = browser.contexts()[0];
  assert.ok(context, "PORTABLE_E2E_CONTEXT_MISSING");
  page = await waitForApplicationPage(context, 30_000);
  page.setDefaultTimeout(OCR_TIMEOUT_MS);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => {
    const heartbeat = document.getElementById("ui-heartbeat")?.textContent;
    return heartbeat !== undefined && Number(heartbeat) > 0;
  });

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol === "local-ocr:" && url.host === "app") {
      localRequestPaths.add(url.pathname);
    } else if (url.protocol === "http:" || url.protocol === "https:") {
      externalRequests.push(url.href);
    }
  });
  page.on("requestfailed", (request) => failedRequests.push(request.url()));
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.protocol === "local-ocr:" && url.host === "app") {
      localResponses.push({ path: url.pathname, status: response.status() });
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("worker", (worker) => workerUrls.push(worker.url()));

  assert.equal(page.url(), APPLICATION_URL);
  const rendererBoundary = await page.evaluate(() => {
    const desktopApi = Reflect.get(globalThis, "localOcrDesktop");
    return {
      desktopRuntime:
        typeof desktopApi === "object" && desktopApi !== null
          ? Reflect.get(desktopApi, "runtime")
          : null,
      processType: typeof Reflect.get(globalThis, "process"),
      requireType: typeof Reflect.get(globalThis, "require"),
      sandboxed:
        typeof desktopApi === "object" && desktopApi !== null
          ? Reflect.get(desktopApi, "sandboxed")
          : null,
    };
  });
  assert.deepEqual(rendererBoundary, {
    desktopRuntime: "electron",
    processType: "undefined",
    requireType: "undefined",
    sandboxed: true,
  });

  await page.locator("#latin-sample-button").click();
  await waitForOcrCompletion(page);
  const latinText = await page.locator("#recognized-text").textContent();
  assert.match(latinText ?? "", /LOCAL OCR/);
  assert.match(latinText ?? "", /TEST ABC 123/);
  const latinResult = JSON.parse((await page.locator("#result-json").textContent()) ?? "null");
  assert.equal(latinResult?.runtime?.requestedBackend, "wasm");
  assert.equal(latinResult?.runtime?.executionMode, "worker");

  await page.locator("#japanese-sample-button").click();
  await waitForOcrCompletion(page);
  assert.equal(await page.locator("#recognized-text").textContent(), "日本語の文字認識\n東京 2026");

  assert.ok(localRequestPaths.has(DETECTION_MODEL_PATH), "PORTABLE_DETECTION_MODEL_NOT_REQUESTED");
  assert.ok(
    localRequestPaths.has(RECOGNITION_MODEL_PATH),
    "PORTABLE_RECOGNITION_MODEL_NOT_REQUESTED",
  );
  assert.ok(
    Array.from(localRequestPaths).some(
      (requestPath) => requestPath.startsWith("/assets/wasm/") && requestPath.endsWith(".wasm"),
    ),
    "PORTABLE_WASM_NOT_REQUESTED",
  );
  assert.ok(
    workerUrls.some((workerUrl) => workerUrl.includes("worker-entry")),
    "PORTABLE_OCR_WORKER_NOT_STARTED",
  );
  assert.deepEqual(externalRequests, []);
  assert.deepEqual(failedRequests, []);
  assert.deepEqual(pageErrors, []);

  process.stdout.write(
    `Portable OCR passed for ${path.basename(executablePath)}: local models/WASM, Worker, English and Japanese; no external requests.\n`,
  );
} catch (error) {
  const statusSnapshot =
    page === null || page.isClosed()
      ? null
      : await page
          .locator("#status")
          .evaluate((element) => ({
            state: element.dataset.state ?? null,
            text: element.textContent,
          }))
          .catch(() => null);
  process.stderr.write(
    `${JSON.stringify(
      {
        diagnostic: "PORTABLE_OCR_E2E_FAILED",
        externalRequestCount: externalRequests.length,
        failedRequests,
        localRequestPaths: Array.from(localRequestPaths),
        localResponses,
        pageErrors,
        status: statusSnapshot,
        workerUrls,
      },
      null,
      2,
    )}\n`,
  );
  throw error;
} finally {
  if (browser !== null) {
    await browser.close().catch(() => undefined);
  }
  if (launcher !== null && launcher.exitCode === null) {
    const exitedGracefully = await waitForChildExit(launcher, 15_000);
    if (!exitedGracefully && launcher.pid !== undefined) {
      await terminateProcessTree(launcher.pid);
    }
  }
}

async function resolveExecutablePath(args) {
  const executableFlagIndex = args.indexOf("--executable");
  if (executableFlagIndex !== -1) {
    const suppliedPath = args[executableFlagIndex + 1];
    if (suppliedPath === undefined) {
      throw new Error("PORTABLE_EXECUTABLE_ARGUMENT_MISSING");
    }
    const resolvedPath = path.resolve(suppliedPath);
    await assertPortableExecutable(resolvedPath);
    return resolvedPath;
  }

  const releaseDirectory = path.join(projectRoot, "release");
  const entries = await readdir(releaseDirectory, { withFileTypes: true });
  const candidates = entries.filter(
    (entry) => entry.isFile() && entry.name.endsWith("-x64-portable.exe"),
  );
  if (candidates.length !== 1 || candidates[0] === undefined) {
    throw new Error(`PORTABLE_EXE_COUNT_INVALID: ${String(candidates.length)}`);
  }
  const resolvedPath = path.join(releaseDirectory, candidates[0].name);
  await assertPortableExecutable(resolvedPath);
  return resolvedPath;
}

async function assertPortableExecutable(candidatePath) {
  const details = await stat(candidatePath);
  if (!details.isFile() || path.extname(candidatePath).toLowerCase() !== ".exe") {
    throw new Error(`PORTABLE_EXECUTABLE_INVALID: ${candidatePath}`);
  }
}

async function reserveLoopbackPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address !== null && typeof address === "object", "PORTABLE_DEBUG_PORT_MISSING");
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

async function waitForDebugEndpoint(endpointUrl, child, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`PORTABLE_EXITED_BEFORE_READY: ${String(child.exitCode)}`);
    }
    try {
      const response = await fetch(`${endpointUrl}/json/version`);
      if (response.ok) {
        const version = await response.json();
        if (typeof version.webSocketDebuggerUrl === "string") {
          return version.webSocketDebuggerUrl;
        }
      }
    } catch {
      // The portable launcher needs time to extract and start Electron.
    }
    await delay(250);
  }
  throw new Error("PORTABLE_DEBUG_ENDPOINT_TIMEOUT");
}

async function waitForApplicationPage(context, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const page = context.pages().find((candidate) => candidate.url() === APPLICATION_URL);
    if (page !== undefined) {
      return page;
    }
    await delay(100);
  }
  throw new Error("PORTABLE_APPLICATION_PAGE_TIMEOUT");
}

async function waitForOcrCompletion(page) {
  await page.waitForFunction(() => document.getElementById("status")?.dataset.state === "working");
  await page.waitForFunction(() => {
    const state = document.getElementById("status")?.dataset.state;
    return state === "success" || state === "error";
  });
  const status = page.locator("#status");
  const state = await status.getAttribute("data-state");
  assert.equal(state, "success", `PORTABLE_OCR_FAILED: ${(await status.textContent()) ?? ""}`);
}

async function waitForChildExit(child, timeoutMs) {
  if (child.exitCode !== null) {
    return true;
  }
  return await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

async function terminateProcessTree(processId) {
  await new Promise((resolve) => {
    execFile("taskkill.exe", ["/PID", String(processId), "/T", "/F"], () => resolve());
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
