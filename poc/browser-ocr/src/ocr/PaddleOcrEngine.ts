import { type OcrResult, PaddleOCR } from "@paddleocr/paddleocr-js";

import type {
  NormalizedOcrResult,
  OcrCapabilities,
  OcrEngine,
  OcrInitOptions,
  OcrRecognizeOptions,
} from "./OcrEngine";

type PaddleOcrInstance = Awaited<ReturnType<typeof PaddleOCR.create>>;

const DETECTION_MODEL_NAME = "PP-OCRv5_mobile_det";
const RECOGNITION_MODEL_NAME = "PP-OCRv5_mobile_rec";
const EXECUTION_MODE = "worker" as const;

export class PaddleOcrEngine implements OcrEngine {
  private instance: PaddleOcrInstance | null = null;

  async initialize(options: OcrInitOptions): Promise<void> {
    if (this.instance !== null) {
      return;
    }

    this.instance = await PaddleOCR.create({
      worker: true,
      lang: "japan",
      ocrVersion: "PP-OCRv5",
      textDetectionModelName: DETECTION_MODEL_NAME,
      textDetectionModelAsset: { url: options.assets.detectionModelUrl },
      textRecognitionModelName: RECOGNITION_MODEL_NAME,
      textRecognitionModelAsset: { url: options.assets.recognitionModelUrl },
      ortOptions: {
        backend: "wasm",
        wasmPaths: options.assets.wasmBaseUrl,
        numThreads: 1,
        simd: true,
        proxy: false,
      },
    });
  }

  async recognize(
    image: ImageBitmap,
    options: OcrRecognizeOptions,
    signal?: AbortSignal,
  ): Promise<NormalizedOcrResult> {
    signal?.throwIfAborted();

    if (this.instance === null) {
      throw new Error("OCR_ENGINE_NOT_INITIALIZED");
    }

    const [result] = await this.instance.predict(image, {
      textRecScoreThresh: options.minimumConfidence,
    });
    signal?.throwIfAborted();

    if (result === undefined) {
      throw new Error("OCR_RESULT_MISSING");
    }

    return normalizePaddleResult(result, EXECUTION_MODE);
  }

  async dispose(): Promise<void> {
    const instance = this.instance;
    this.instance = null;
    if (instance !== null) {
      await instance.dispose();
    }
  }

  getCapabilities(): OcrCapabilities {
    return {
      fullImage: true,
      polygons: true,
      confidence: true,
      cancellationDuringInference: false,
    };
  }
}

export function normalizePaddleResult(
  result: OcrResult,
  executionMode: "main-thread" | "worker",
): NormalizedOcrResult {
  return {
    text: result.items.map((item) => item.text).join("\n"),
    blocks: result.items.map((item) => ({
      text: item.text,
      confidence: Number.isFinite(item.score) ? item.score : null,
      polygon: item.poly.map(([x, y]) => [x, y]),
    })),
    durationMs: result.metrics.totalMs,
    image: {
      width: result.image.width,
      height: result.image.height,
    },
    runtime: {
      requestedBackend: result.runtime.requestedBackend,
      detectionProvider: result.runtime.detProvider,
      recognitionProvider: result.runtime.recProvider,
      executionMode,
    },
  };
}
