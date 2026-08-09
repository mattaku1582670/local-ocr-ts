import { expect, type Page, test } from "@playwright/test";

interface GeometrySummary {
  image: {
    width: number;
    height: number;
  };
  blocks: Array<{
    confidence: number | null;
    polygon: Array<[number, number]>;
  }>;
}

async function readGeometrySummary(page: Page): Promise<GeometrySummary> {
  return page.getByTestId("result-json").evaluate((element): GeometrySummary => {
    const parsed: unknown = JSON.parse(element.textContent ?? "null");
    if (!isRecord(parsed)) {
      throw new Error("E2E_RESULT_NOT_OBJECT");
    }

    const image = Reflect.get(parsed, "image");
    const blocks = Reflect.get(parsed, "blocks");
    if (!isRecord(image) || !Array.isArray(blocks)) {
      throw new Error("E2E_RESULT_GEOMETRY_MISSING");
    }

    return {
      image: {
        width: readFiniteNumber(Reflect.get(image, "width"), "image.width"),
        height: readFiniteNumber(Reflect.get(image, "height"), "image.height"),
      },
      blocks: blocks.map((block, blockIndex) => {
        if (!isRecord(block)) {
          throw new Error(`E2E_BLOCK_NOT_OBJECT: ${String(blockIndex)}`);
        }

        const confidence = Reflect.get(block, "confidence");
        if (
          confidence !== null &&
          (typeof confidence !== "number" || !Number.isFinite(confidence))
        ) {
          throw new Error(`E2E_CONFIDENCE_INVALID: ${String(blockIndex)}`);
        }

        const polygon = Reflect.get(block, "polygon");
        if (!Array.isArray(polygon)) {
          throw new Error(`E2E_POLYGON_MISSING: ${String(blockIndex)}`);
        }

        return {
          confidence,
          polygon: polygon.map((point, pointIndex): [number, number] => {
            if (!Array.isArray(point) || point.length !== 2) {
              throw new Error(
                `E2E_POINT_SHAPE_INVALID: ${String(blockIndex)}:${String(pointIndex)}`,
              );
            }
            return [
              readFiniteNumber(point[0], `polygon[${String(pointIndex)}].x`),
              readFiniteNumber(point[1], `polygon[${String(pointIndex)}].y`),
            ];
          }),
        };
      }),
    };

    function isRecord(value: unknown): value is object {
      return typeof value === "object" && value !== null && !Array.isArray(value);
    }

    function readFiniteNumber(value: unknown, field: string): number {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`E2E_NUMBER_INVALID: ${field}`);
      }
      return value;
    }
  });
}

function expectSourceImageGeometry(summary: GeometrySummary): void {
  expect(summary.image).toEqual({ width: 1600, height: 500 });
  expect(summary.blocks).toHaveLength(2);

  for (const block of summary.blocks) {
    expect(block.confidence).not.toBeNull();
    if (block.confidence === null) {
      throw new Error("E2E_CONFIDENCE_MISSING");
    }
    expect(block.confidence).toBeGreaterThanOrEqual(0);
    expect(block.confidence).toBeLessThanOrEqual(1);
    expect(block.polygon).toHaveLength(4);

    for (const [x, y] of block.polygon) {
      expect(Number.isInteger(x)).toBe(true);
      expect(Number.isInteger(y)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(summary.image.width);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(summary.image.height);
    }

    const [topLeft, topRight, bottomRight, bottomLeft] = block.polygon;
    if (
      topLeft === undefined ||
      topRight === undefined ||
      bottomRight === undefined ||
      bottomLeft === undefined
    ) {
      throw new Error("E2E_POLYGON_POINT_MISSING");
    }
    expect(topLeft[0]).toBeLessThan(topRight[0]);
    expect(bottomLeft[0]).toBeLessThan(bottomRight[0]);
    expect(topLeft[1]).toBeLessThan(bottomLeft[1]);
    expect(topRight[1]).toBeLessThan(bottomRight[1]);
  }

  const [firstBlock, secondBlock] = summary.blocks;
  if (firstBlock === undefined || secondBlock === undefined) {
    throw new Error("E2E_BLOCK_MISSING");
  }
  expect(averageY(firstBlock.polygon)).toBeLessThan(averageY(secondBlock.polygon));
}

function averageY(polygon: Array<[number, number]>): number {
  return polygon.reduce((sum, point) => sum + point[1], 0) / polygon.length;
}

test("recognizes one image with source polygons and confidence using only same-origin requests", async ({
  page,
}) => {
  const externalRequests: string[] = [];
  const failedRequests: string[] = [];
  const pageErrors: string[] = [];
  const workerUrls: string[] = [];
  const sameOriginRequestPaths: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin === "http://127.0.0.1:4173") {
      sameOriginRequestPaths.push(url.pathname);
    }
    if (
      url.origin !== "http://127.0.0.1:4173" &&
      url.protocol !== "blob:" &&
      url.protocol !== "data:"
    ) {
      externalRequests.push(request.url());
    }
  });
  page.on("requestfailed", (request) => failedRequests.push(request.url()));
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("worker", (worker) => workerUrls.push(worker.url()));

  await page.goto("/");
  const heartbeatBefore = Number(await page.getByTestId("ui-heartbeat").textContent());
  await page.getByRole("button", { name: "英数字サンプルでOCR" }).click();

  const status = page.getByRole("status");
  await expect(status).toHaveAttribute("data-state", "working");
  await page.waitForTimeout(300);
  await expect(status).toHaveAttribute("data-state", "working");
  const heartbeatDuringOcr = Number(await page.getByTestId("ui-heartbeat").textContent());
  expect(heartbeatDuringOcr - heartbeatBefore).toBeGreaterThanOrEqual(3);
  await expect(status).toHaveAttribute("data-state", "success");
  await expect(page.getByTestId("recognized-text")).toContainText("LOCAL OCR");
  await expect(page.getByTestId("recognized-text")).toContainText("TEST ABC 123");
  await expect(page.getByTestId("result-json")).toContainText('"requestedBackend": "wasm"');
  await expect(page.getByTestId("result-json")).toContainText('"executionMode": "worker"');
  expectSourceImageGeometry(await readGeometrySummary(page));
  expect(workerUrls.some((url) => url.includes("worker-entry"))).toBe(true);
  expect(sameOriginRequestPaths).toContain("/assets/models/PP-OCRv5_mobile_det_onnx_infer.tar");
  expect(sameOriginRequestPaths).toContain("/assets/models/PP-OCRv5_mobile_rec_onnx_infer.tar");
  expect(
    sameOriginRequestPaths.some(
      (requestPath) => requestPath.startsWith("/assets/wasm/") && requestPath.endsWith(".wasm"),
    ),
  ).toBe(true);
  expect(externalRequests).toEqual([]);
  expect(failedRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("recognizes Japanese text from one generated image", async ({ page }) => {
  const externalRequests: string[] = [];
  const failedRequests: string[] = [];
  const pageErrors: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.origin !== "http://127.0.0.1:4173" &&
      url.protocol !== "blob:" &&
      url.protocol !== "data:"
    ) {
      externalRequests.push(request.url());
    }
  });
  page.on("requestfailed", (request) => failedRequests.push(request.url()));
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  const japaneseFontAvailable = await page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('108px "Yu Gothic UI"', "日本語");
  });
  expect(japaneseFontAvailable).toBe(true);
  await page.getByRole("button", { name: "日本語サンプルでOCR" }).click();

  const status = page.getByRole("status");
  await expect(status).toHaveAttribute("data-state", "success");
  await expect(page.getByTestId("recognized-text")).toHaveText("日本語の文字認識\n東京 2026");
  await expect(page.getByTestId("result-json")).toContainText('"requestedBackend": "wasm"');
  expect(externalRequests).toEqual([]);
  expect(failedRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});
