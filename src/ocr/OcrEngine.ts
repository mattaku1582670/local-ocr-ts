import type { Polygon } from "../types/coordinates";
import type { OcrProgressStage } from "../store/useOcrStore";

export interface OcrAssetLocations {
  detectionModelUrl: string;
  recognitionModelUrl: string;
  wasmBaseUrl: string;
}

export interface OcrInitOptions {
  assets: OcrAssetLocations;
  language: "ja" | "en";
}

export interface OcrProgressEvent {
  percent: number;
  stage: OcrProgressStage;
}

export interface OcrRecognizeOptions {
  minimumConfidence: number;
  onProgress?: (progress: OcrProgressEvent) => void;
}

export interface OcrCapabilities {
  fullImage: boolean;
  polygons: boolean;
  confidence: boolean;
  cancellationDuringInference: boolean;
}

export interface NormalizedOcrBlock {
  id: string;
  text: string;
  confidence: number | null;
  polygon: Polygon;
  order: number;
}

export interface NormalizedOcrResult {
  rawText: string;
  blocks: NormalizedOcrBlock[];
  durationMs: number;
  image: { width: number; height: number };
  runtime: {
    requestedBackend: string;
    detectionProvider: string;
    recognitionProvider: string;
    executionMode: "worker";
  };
}

export interface OcrEngine {
  initialize(options: OcrInitOptions): Promise<void>;
  recognize(
    image: ImageBitmap,
    options: OcrRecognizeOptions,
    signal?: AbortSignal,
  ): Promise<NormalizedOcrResult>;
  dispose(): Promise<void>;
  getCapabilities(): OcrCapabilities;
}

export class OcrCancelledError extends Error {
  constructor() {
    super("OCR処理をキャンセルしました。");
    this.name = "OcrCancelledError";
  }
}
