import assert from "node:assert/strict";
import os from "node:os";

import { _electron as electron } from "@playwright/test";

const IMAGE_COUNT = 20;
const OCR_TIMEOUT_MS = 180_000;

const electronApplication = await electron.launch({
  args: ["dist-electron/main.mjs"],
});

try {
  const window = await electronApplication.firstWindow();
  window.setDefaultTimeout(OCR_TIMEOUT_MS);
  await window.waitForLoadState("domcontentloaded");
  await window.waitForFunction(
    () => Number(document.getElementById("ui-heartbeat")?.textContent) > 0,
  );

  const externalRequests = [];
  const failedRequests = [];
  const pageErrors = [];
  const workerUrls = [];
  window.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol === "http:" || url.protocol === "https:") {
      externalRequests.push(url.href);
    }
  });
  window.on("requestfailed", (request) => failedRequests.push(request.url()));
  window.on("pageerror", (error) => pageErrors.push(error.message));
  window.on("worker", (worker) => workerUrls.push(worker.url()));

  const initialMemory = await collectAppMemory(electronApplication);
  const runs = [];
  for (let index = 1; index <= IMAGE_COUNT; index += 1) {
    const pngBase64 = await createFullHdImage(window, index);
    runs.push(
      await measureOcrRun(electronApplication, window, {
        buffer: Buffer.from(pngBase64, "base64"),
        mimeType: "image/png",
        name: `continuous-${String(index).padStart(2, "0")}.png`,
      }),
    );
  }

  await window.waitForTimeout(2_000);
  const settledMemory = await collectAppMemory(electronApplication);
  assert.equal(runs.length, IMAGE_COUNT);
  assert.ok(
    runs.every((run) => run.blockCount > 0),
    "CONTINUOUS_OCR_EMPTY_RESULT",
  );
  assert.ok(
    runs.every((run) => run.heartbeatDelta > 0),
    "CONTINUOUS_OCR_UI_HEARTBEAT_STOPPED",
  );
  assert.deepEqual(externalRequests, []);
  assert.deepEqual(failedRequests, []);
  assert.deepEqual(pageErrors, []);
  assert.ok(
    workerUrls.some((workerUrl) => workerUrl.includes("worker-entry")),
    "CONTINUOUS_OCR_WORKER_NOT_STARTED",
  );

  const wallTimes = runs.map((run) => run.wallTimeMs);
  const engineTimes = runs.map((run) => run.engineDurationMs);
  const report = {
    schemaVersion: 1,
    measuredAt: new Date().toISOString(),
    host: {
      cpu: os.cpus()[0]?.model.trim() ?? "unknown",
      logicalCpuCount: os.cpus().length,
      release: os.release(),
      totalMemoryMiB: round(os.totalmem() / (1024 * 1024)),
    },
    image: {
      count: IMAGE_COUNT,
      format: "image/png",
      height: 1080,
      uniqueSequenceLabels: true,
      width: 1920,
    },
    initialMemory,
    runs,
    summary: {
      completedCount: runs.length,
      crashed: false,
      engineDurationMedianMs: median(engineTimes),
      externalRequestCount: externalRequests.length,
      failedRequestCount: failedRequests.length,
      finalMinusFirstPrivateMiB: round(
        settledMemory.privateMiB - (runs[0]?.memory.afterPrivateMiB ?? settledMemory.privateMiB),
      ),
      finalMinusFirstWorkingSetMiB: round(
        settledMemory.workingSetMiB -
          (runs[0]?.memory.afterWorkingSetMiB ?? settledMemory.workingSetMiB),
      ),
      pageErrorCount: pageErrors.length,
      peakPrivateMiB: Math.max(...runs.map((run) => run.memory.peakPrivateMiB)),
      peakWorkingSetMiB: Math.max(...runs.map((run) => run.memory.peakWorkingSetMiB)),
      settledMemory,
      wallTimeMaximumMs: Math.max(...wallTimes),
      wallTimeMedianMs: median(wallTimes),
      workerCountObserved: workerUrls.length,
    },
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  await electronApplication.close();
}

async function createFullHdImage(page, sequence) {
  return await page.evaluate((imageNumber) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1920;
    canvas.height = 1080;
    const context = canvas.getContext("2d");
    if (context === null) {
      throw new Error("CONTINUOUS_OCR_CANVAS_CONTEXT_MISSING");
    }

    context.fillStyle = "#f4f6f8";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ffffff";
    context.fillRect(80, 70, 1760, 940);
    context.strokeStyle = "#b7c0ca";
    context.lineWidth = 2;
    context.strokeRect(80, 70, 1760, 940);
    context.fillStyle = "#16202a";
    context.font = '700 54px "Yu Gothic UI", "Segoe UI", sans-serif';
    context.fillText(`Local OCR 連続処理 ${String(imageNumber).padStart(2, "0")}`, 150, 170);
    context.font = '400 34px "Yu Gothic UI", "Segoe UI", sans-serif';
    const lines = [
      "日本語と英数字を完全オフラインで認識します。",
      `Document ID: CONTINUOUS-${String(imageNumber).padStart(2, "0")} / 20`,
      "モデル・辞書・WASMはすべてローカルに同梱します。",
      "Security: sandbox=true, contextIsolation=true",
      "画像データと認識結果を外部へ送信しません。",
      "東京都千代田区 Sample ABC 12345 合計 12,345円",
      "PNG / JPEG / WebP / BMP   TXT / JSON",
    ];
    lines.forEach((line, index) => {
      context.fillText(line, 150, 280 + index * 100);
    });
    return canvas.toDataURL("image/png").split(",")[1] ?? "";
  }, sequence);
}

async function measureOcrRun(electronApp, page, imageFile) {
  let sampling = true;
  const memorySamples = [];
  const heartbeatBefore = Number(await page.locator("#ui-heartbeat").textContent());
  const sampler = (async () => {
    while (sampling) {
      memorySamples.push(await collectAppMemory(electronApp));
      await delay(100);
    }
  })();

  const startedAt = performance.now();
  try {
    await page.locator("#image-input").setInputFiles(imageFile);
    await page.waitForFunction(
      () => document.getElementById("status")?.dataset.state === "working",
    );
    await page.waitForFunction(() => {
      const state = document.getElementById("status")?.dataset.state;
      return state === "success" || state === "error";
    });
    const status = page.locator("#status");
    assert.equal(
      await status.getAttribute("data-state"),
      "success",
      `CONTINUOUS_OCR_FAILED: ${(await status.textContent()) ?? ""}`,
    );
  } finally {
    sampling = false;
    await sampler;
  }

  const result = JSON.parse((await page.locator("#result-json").textContent()) ?? "null");
  assert.equal(result?.image?.width, 1920);
  assert.equal(result?.image?.height, 1080);
  assert.equal(result?.runtime?.requestedBackend, "wasm");
  assert.equal(result?.runtime?.executionMode, "worker");
  const afterMemory = await collectAppMemory(electronApp);
  memorySamples.push(afterMemory);
  const heartbeatAfter = Number(await page.locator("#ui-heartbeat").textContent());
  return {
    blockCount: result.blocks.length,
    engineDurationMs: round(result.durationMs),
    heartbeatDelta: heartbeatAfter - heartbeatBefore,
    imageBytes: imageFile.buffer.byteLength,
    memory: {
      afterPrivateMiB: afterMemory.privateMiB,
      afterWorkingSetMiB: afterMemory.workingSetMiB,
      peakPrivateMiB: Math.max(...memorySamples.map((sample) => sample.privateMiB)),
      peakWorkingSetMiB: Math.max(...memorySamples.map((sample) => sample.workingSetMiB)),
      processCountMaximum: Math.max(...memorySamples.map((sample) => sample.processCount)),
    },
    wallTimeMs: round(performance.now() - startedAt),
  };
}

async function collectAppMemory(electronApp) {
  return await electronApp.evaluate(({ app }) => {
    const metrics = app.getAppMetrics();
    return {
      privateMiB: roundMiB(
        metrics.reduce((total, metric) => total + metric.memory.privateBytes, 0),
      ),
      processCount: metrics.length,
      workingSetMiB: roundMiB(
        metrics.reduce((total, metric) => total + metric.memory.workingSetSize, 0),
      ),
    };

    function roundMiB(kibibytes) {
      return Math.round((kibibytes / 1024) * 100) / 100;
    }
  });
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
