import assert from "node:assert/strict";
import os from "node:os";

import { _electron as electron } from "@playwright/test";

const WARM_RUN_COUNT = 3;
const presets = {
  a4: {
    detailedRequirementTargetMs: 20_000,
    height: 3508,
    id: "a4",
    lineCount: 26,
    width: 2480,
  },
  "full-hd": {
    detailedRequirementTargetMs: 10_000,
    height: 1080,
    id: "full-hd",
    lineCount: 8,
    width: 1920,
  },
};
const preset = readPreset(process.argv.slice(2));
const OCR_TIMEOUT_MS = preset.id === "a4" ? 300_000 : 180_000;

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

  const pngBase64 = await createPerformanceImage(window, preset);
  const imageFile = {
    buffer: Buffer.from(pngBase64, "base64"),
    mimeType: "image/png",
    name: `${preset.id}-performance.png`,
  };

  const initialMemory = await collectAppMemory(electronApplication);
  const coldRun = await measureOcrRun(electronApplication, window, imageFile, "cold", preset);
  const warmRuns = [];
  for (let index = 0; index < WARM_RUN_COUNT; index += 1) {
    warmRuns.push(
      await measureOcrRun(
        electronApplication,
        window,
        imageFile,
        `warm-${String(index + 1)}`,
        preset,
      ),
    );
  }

  const warmWallTimes = warmRuns.map((run) => run.wallTimeMs);
  const warmEngineTimes = warmRuns.map((run) => run.engineDurationMs);
  const report = {
    schemaVersion: 1,
    measuredAt: new Date().toISOString(),
    host: {
      cpu: os.cpus()[0]?.model ?? "unknown",
      logicalCpuCount: os.cpus().length,
      platform: os.platform(),
      release: os.release(),
      totalMemoryMiB: bytesToMiB(os.totalmem()),
    },
    image: {
      bytes: imageFile.buffer.byteLength,
      format: imageFile.mimeType,
      height: preset.height,
      preset: preset.id,
      width: preset.width,
    },
    initialMemory,
    coldRun,
    warmRuns,
    warmSummary: {
      engineDurationMedianMs: median(warmEngineTimes),
      engineDurationMaximumMs: Math.max(...warmEngineTimes),
      wallTimeMedianMs: median(warmWallTimes),
      wallTimeMaximumMs: Math.max(...warmWallTimes),
      detailedRequirementTargetMs: preset.detailedRequirementTargetMs,
      withinDetailedRequirement: warmWallTimes.every(
        (duration) => duration <= preset.detailedRequirementTargetMs,
      ),
      withinDevelopmentPlan5Seconds:
        preset.id === "full-hd" ? warmWallTimes.every((duration) => duration <= 5_000) : null,
    },
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  await electronApplication.close();
}

async function createPerformanceImage(page, imagePreset) {
  return await page.evaluate((configuration) => {
    const canvas = document.createElement("canvas");
    canvas.width = configuration.width;
    canvas.height = configuration.height;
    const context = canvas.getContext("2d");
    if (context === null) {
      throw new Error("FULL_HD_CANVAS_CONTEXT_MISSING");
    }

    context.fillStyle = "#f4f6f8";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ffffff";
    const pageMargin = Math.round(canvas.width * 0.04);
    context.fillRect(
      pageMargin,
      pageMargin,
      canvas.width - pageMargin * 2,
      canvas.height - pageMargin * 2,
    );
    context.strokeStyle = "#b7c0ca";
    context.lineWidth = 2;
    context.strokeRect(
      pageMargin,
      pageMargin,
      canvas.width - pageMargin * 2,
      canvas.height - pageMargin * 2,
    );
    context.fillStyle = "#16202a";
    context.font = '700 54px "Yu Gothic UI", "Segoe UI", sans-serif';
    context.fillText("Local OCR 性能評価", pageMargin + 70, pageMargin + 100);
    context.font = '600 40px "Yu Gothic UI", "Segoe UI", sans-serif';
    context.fillText(
      `${String(configuration.width)} × ${String(configuration.height)} ${configuration.id}`,
      pageMargin + 70,
      pageMargin + 190,
    );
    context.font = '400 32px "Yu Gothic UI", "Segoe UI", sans-serif';
    const sourceLines = [
      "日本語と英数字を完全オフラインで認識します。",
      "Document ID: OCR-2026-0815 / Version 1.0",
      "モデル・辞書・WASMはすべてローカルに同梱します。",
      "Security: sandbox=true, contextIsolation=true",
      "画像データと認識結果を外部へ送信しません。",
      "Status: READY    Progress: 100%    Confidence: 0.98",
      "東京都千代田区  Sample ABC 12345  合計 12,345円",
      "PNG / JPEG / WebP / BMP   TXT / JSON",
    ];
    const lines = Array.from(
      { length: configuration.lineCount },
      (_, index) => `${sourceLines[index % sourceLines.length] ?? ""}  ${String(index + 1)}`,
    );
    const contentTop = pageMargin + 280;
    const availableHeight = canvas.height - contentTop - pageMargin - 50;
    const lineHeight = Math.min(76, Math.floor(availableHeight / configuration.lineCount));
    lines.forEach((line, index) => {
      context.fillText(line, pageMargin + 70, contentTop + index * lineHeight);
    });
    return canvas.toDataURL("image/png").split(",")[1] ?? "";
  }, imagePreset);
}

async function measureOcrRun(electronApp, page, imageFile, label, imagePreset) {
  let sampling = true;
  const memorySamples = [];
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
      `FULL_HD_OCR_FAILED: ${(await status.textContent()) ?? ""}`,
    );
  } finally {
    sampling = false;
    await sampler;
  }
  const wallTimeMs = performance.now() - startedAt;
  const normalizedResult = JSON.parse((await page.locator("#result-json").textContent()) ?? "null");
  assert.equal(normalizedResult?.image?.width, imagePreset.width);
  assert.equal(normalizedResult?.image?.height, imagePreset.height);
  assert.equal(normalizedResult?.runtime?.requestedBackend, "wasm");
  assert.equal(normalizedResult?.runtime?.executionMode, "worker");
  assert.ok(normalizedResult?.blocks?.length > 0, "FULL_HD_OCR_RESULT_EMPTY");

  const finalMemory = await collectAppMemory(electronApp);
  memorySamples.push(finalMemory);
  return {
    blockCount: normalizedResult.blocks.length,
    engineDurationMs: round(normalizedResult.durationMs),
    label,
    memory: {
      peakPrivateMiB: Math.max(...memorySamples.map((sample) => sample.privateMiB)),
      peakWorkingSetMiB: Math.max(...memorySamples.map((sample) => sample.workingSetMiB)),
      processCountMaximum: Math.max(...memorySamples.map((sample) => sample.processCount)),
    },
    wallTimeMs: round(wallTimeMs),
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
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

function bytesToMiB(bytes) {
  return round(bytes / (1024 * 1024));
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function readPreset(args) {
  const presetFlagIndex = args.indexOf("--preset");
  const requestedPreset = presetFlagIndex === -1 ? "full-hd" : args[presetFlagIndex + 1];
  if (requestedPreset !== "full-hd" && requestedPreset !== "a4") {
    throw new Error(`PERFORMANCE_PRESET_INVALID: ${String(requestedPreset)}`);
  }
  return presets[requestedPreset];
}
