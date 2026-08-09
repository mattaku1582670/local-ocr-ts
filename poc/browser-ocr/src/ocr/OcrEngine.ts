export interface OcrAssetLocations {
  detectionModelUrl: string;
  recognitionModelUrl: string;
  wasmBaseUrl: string;
}

export interface OcrInitOptions {
  assets: OcrAssetLocations;
}

export interface OcrRecognizeOptions {
  minimumConfidence: number;
}

export interface OcrCapabilities {
  fullImage: boolean;
  polygons: boolean;
  confidence: boolean;
  cancellationDuringInference: boolean;
}

export interface NormalizedOcrBlock {
  text: string;
  confidence: number | null;
  polygon: Array<[number, number]>;
}

export interface NormalizedOcrResult {
  text: string;
  blocks: NormalizedOcrBlock[];
  durationMs: number;
  image: {
    width: number;
    height: number;
  };
  runtime: {
    requestedBackend: string;
    detectionProvider: string;
    recognitionProvider: string;
    executionMode: "main-thread" | "worker";
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
