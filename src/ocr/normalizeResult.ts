import type { OcrResult } from "@paddleocr/paddleocr-js";
import type { NormalizedOcrBlock, NormalizedOcrResult } from "./OcrEngine";

function normalizedConfidence(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const ratio = value > 1 ? value / 100 : value;
  return Math.min(1, Math.max(0, ratio));
}

function bounds(block: NormalizedOcrBlock): { centerX: number; centerY: number; height: number } {
  const xs = block.polygon.points.map((point) => point.x);
  const ys = block.polygon.points.map((point) => point.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  return { centerX: (left + right) / 2, centerY: (top + bottom) / 2, height: bottom - top };
}

export function sortHorizontalReadingOrder(blocks: NormalizedOcrBlock[]): NormalizedOcrBlock[] {
  const sorted = [...blocks].sort((left, right) => {
    const leftBounds = bounds(left);
    const rightBounds = bounds(right);
    const lineTolerance = Math.max(8, Math.min(leftBounds.height, rightBounds.height) * 0.6);
    return Math.abs(leftBounds.centerY - rightBounds.centerY) <= lineTolerance
      ? leftBounds.centerX - rightBounds.centerX
      : leftBounds.centerY - rightBounds.centerY;
  });
  return sorted.map((block, order) => ({ ...block, id: `block-${String(order)}`, order }));
}

export function normalizePaddleResult(result: OcrResult): NormalizedOcrResult {
  const blocks = sortHorizontalReadingOrder(
    result.items.map((item, index) => ({
      id: `source-${String(index)}`,
      text: item.text,
      confidence: normalizedConfidence(item.score),
      polygon: { points: item.poly.map(([x, y]) => ({ x, y })) },
      order: index,
    })),
  );
  return {
    rawText: blocks.map((block) => block.text).join("\n"),
    blocks,
    durationMs: Math.max(0, result.metrics.totalMs),
    image: { width: result.image.width, height: result.image.height },
    runtime: {
      requestedBackend: result.runtime.requestedBackend,
      detectionProvider: result.runtime.detProvider,
      recognitionProvider: result.runtime.recProvider,
      executionMode: "worker",
    },
  };
}
