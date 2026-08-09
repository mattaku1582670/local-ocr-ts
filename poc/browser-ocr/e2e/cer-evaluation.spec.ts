import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { _electron as electron, expect, test } from "@playwright/test";

import { calculateCer, calculateStrictCer } from "../src/evaluation/cer";

interface EvaluationCase {
  readonly category: string;
  readonly expectedText: string;
  readonly height: number;
  readonly id: string;
  readonly imageFile: string;
  readonly sha256: string;
  readonly width: number;
}

interface CaseResult {
  readonly averageConfidence: number | null;
  readonly category: string;
  readonly cer: number;
  readonly distance: number;
  readonly durationMs: number;
  readonly failed: boolean;
  readonly id: string;
  readonly referenceLength: number;
  readonly strictCer: number;
  readonly strictDistance: number;
  readonly strictReferenceLength: number;
}

const generatedDirectory = path.resolve("evaluation", "generated", "v1");

test("calculates a synthetic 50-image CER baseline", async () => {
  const manifest = parseManifest(
    JSON.parse(await readFile(path.join(generatedDirectory, "manifest.json"), "utf8")),
  );
  expect(manifest).toHaveLength(50);
  expect(new Set(manifest.map((item) => item.category)).size).toBe(8);

  const electronApplication = await electron.launch({ args: ["dist-electron/main.mjs"] });
  try {
    const window = await electronApplication.firstWindow();
    window.setDefaultTimeout(180_000);
    await window.waitForLoadState("domcontentloaded");
    await window.waitForFunction(
      () => Number(document.getElementById("ui-heartbeat")?.textContent) > 0,
    );
    const externalRequests: string[] = [];
    const failedRequests: string[] = [];
    const pageErrors: string[] = [];
    window.on("request", (request) => {
      const url = new URL(request.url());
      if (url.protocol === "http:" || url.protocol === "https:") {
        externalRequests.push(url.href);
      }
    });
    window.on("requestfailed", (request) => failedRequests.push(request.url()));
    window.on("pageerror", (error) => pageErrors.push(error.message));

    const caseResults: CaseResult[] = [];
    for (const evaluationCase of manifest) {
      const image = await readFile(path.join(generatedDirectory, evaluationCase.imageFile));
      expect(createHash("sha256").update(image).digest("hex")).toBe(evaluationCase.sha256);
      const startedAt = performance.now();
      await window.locator("#image-input").setInputFiles({
        buffer: image,
        mimeType: "image/png",
        name: evaluationCase.imageFile,
      });
      await window.waitForFunction(
        () => document.getElementById("status")?.dataset.state === "working",
      );
      await window.waitForFunction(() => {
        const state = document.getElementById("status")?.dataset.state;
        return state === "success" || state === "error";
      });
      const status = await window.locator("#status").getAttribute("data-state");
      if (status !== "success") {
        const normalizedReference = calculateCer(evaluationCase.expectedText, "");
        caseResults.push({
          averageConfidence: null,
          category: evaluationCase.category,
          cer: 1,
          distance: normalizedReference.referenceLength,
          durationMs: performance.now() - startedAt,
          failed: true,
          id: evaluationCase.id,
          referenceLength: normalizedReference.referenceLength,
          strictCer: 1,
          strictDistance: calculateStrictCer(evaluationCase.expectedText, "").distance,
          strictReferenceLength: calculateStrictCer(evaluationCase.expectedText, "")
            .referenceLength,
        });
        continue;
      }

      const result = JSON.parse((await window.locator("#result-json").textContent()) ?? "null");
      expect(result?.image).toEqual({ width: evaluationCase.width, height: evaluationCase.height });
      expect(result?.runtime?.executionMode).toBe("worker");
      const measurement = calculateCer(evaluationCase.expectedText, result.text ?? "");
      const strictMeasurement = calculateStrictCer(evaluationCase.expectedText, result.text ?? "");
      const confidences = result.blocks
        .map((block: { confidence?: unknown }) => block.confidence)
        .filter((confidence: unknown): confidence is number => typeof confidence === "number");
      caseResults.push({
        averageConfidence:
          confidences.length === 0
            ? null
            : confidences.reduce((total: number, confidence: number) => total + confidence, 0) /
              confidences.length,
        category: evaluationCase.category,
        cer: measurement.cer,
        distance: measurement.distance,
        durationMs: performance.now() - startedAt,
        failed: false,
        id: evaluationCase.id,
        referenceLength: measurement.referenceLength,
        strictCer: strictMeasurement.cer,
        strictDistance: strictMeasurement.distance,
        strictReferenceLength: strictMeasurement.referenceLength,
      });
    }

    expect(externalRequests).toEqual([]);
    expect(failedRequests).toEqual([]);
    expect(pageErrors).toEqual([]);
    const categories = Array.from(new Set(caseResults.map((result) => result.category))).map(
      (category) =>
        summarize(
          caseResults.filter((result) => result.category === category),
          category,
        ),
    );
    const report = {
      categories,
      cases: caseResults,
      generatedAt: new Date().toISOString(),
      limitations: [
        "Synthetic baseline only.",
        "Real screenshots and photographed documents remain required before final Gate approval.",
      ],
      normalization: "Unicode NFKC; collapse all whitespace runs to one ASCII space; trim edges.",
      schemaVersion: 1,
      summary: summarize(caseResults, "all"),
    };
    await writeFile(
      path.join(generatedDirectory, "cer-report.json"),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    );
    process.stdout.write(
      `${JSON.stringify({ categories: report.categories, summary: report.summary }, null, 2)}\n`,
    );
  } finally {
    await electronApplication.close();
  }
});

function summarize(
  results: readonly {
    readonly cer: number;
    readonly category: string;
    readonly distance: number;
    readonly durationMs: number;
    readonly failed: boolean;
    readonly referenceLength: number;
    readonly strictDistance: number;
    readonly strictReferenceLength: number;
  }[],
  category: string,
) {
  const distance = results.reduce((total, result) => total + result.distance, 0);
  const referenceLength = results.reduce((total, result) => total + result.referenceLength, 0);
  const strictDistance = results.reduce((total, result) => total + result.strictDistance, 0);
  const strictReferenceLength = results.reduce(
    (total, result) => total + result.strictReferenceLength,
    0,
  );
  return {
    category,
    cer: referenceLength === 0 ? 0 : distance / referenceLength,
    count: results.length,
    failedCount: results.filter((result) => result.failed).length,
    meanDurationMs:
      results.reduce((total, result) => total + result.durationMs, 0) / results.length,
    strictCer: strictReferenceLength === 0 ? 0 : strictDistance / strictReferenceLength,
  };
}

function parseManifest(value: unknown): EvaluationCase[] {
  if (!isRecord(value) || !Array.isArray(value.cases)) {
    throw new Error("EVALUATION_MANIFEST_INVALID");
  }
  return value.cases.map((item, index) => {
    if (
      !isRecord(item) ||
      typeof item.category !== "string" ||
      typeof item.expectedText !== "string" ||
      typeof item.height !== "number" ||
      typeof item.id !== "string" ||
      typeof item.imageFile !== "string" ||
      typeof item.sha256 !== "string" ||
      typeof item.width !== "number"
    ) {
      throw new Error(`EVALUATION_MANIFEST_CASE_INVALID: ${String(index)}`);
    }
    return {
      category: item.category,
      expectedText: item.expectedText,
      height: item.height,
      id: item.id,
      imageFile: item.imageFile,
      sha256: item.sha256,
      width: item.width,
    };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
