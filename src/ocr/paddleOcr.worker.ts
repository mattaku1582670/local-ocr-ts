import { PaddleOCR } from "@paddleocr/paddleocr-js";
import { normalizePaddleResult } from "./normalizeResult";
import {
  serializeWorkerError,
  type OcrWorkerRequest,
  type OcrWorkerResponse,
} from "./workerMessages";

type PaddleOcrInstance = Awaited<ReturnType<typeof PaddleOCR.create>>;

interface WorkerScope {
  onmessage: ((event: MessageEvent<OcrWorkerRequest>) => void) | null;
  postMessage: (response: OcrWorkerResponse) => void;
}

const scope = self as unknown as WorkerScope;
let instance: PaddleOcrInstance | null = null;
let requestQueue = Promise.resolve();

function respond(response: OcrWorkerResponse): void {
  scope.postMessage(response);
}

async function initialize(request: Extract<OcrWorkerRequest, { type: "INITIALIZE" }>) {
  if (instance) await instance.dispose();
  instance = await PaddleOCR.create({
    initialize: true,
    worker: true,
    lang: request.options.language === "ja" ? "japan" : "en",
    ocrVersion: "PP-OCRv5",
    textDetectionModelName: "PP-OCRv5_mobile_det",
    textDetectionModelAsset: { url: request.options.assets.detectionModelUrl },
    textRecognitionModelName: "PP-OCRv5_mobile_rec",
    textRecognitionModelAsset: { url: request.options.assets.recognitionModelUrl },
    ortOptions: {
      backend: "wasm",
      wasmPaths: request.options.assets.wasmBaseUrl,
      numThreads: 1,
      simd: true,
      proxy: false,
    },
  });
  respond({ type: "READY", requestId: request.requestId });
}

async function recognize(request: Extract<OcrWorkerRequest, { type: "RECOGNIZE" }>) {
  try {
    if (!instance) throw new Error("OCR_ENGINE_NOT_INITIALIZED");
    respond({
      type: "PROGRESS",
      requestId: request.requestId,
      progress: { stage: "preprocessing", percent: 10 },
    });
    respond({
      type: "PROGRESS",
      requestId: request.requestId,
      progress: { stage: "detecting", percent: 35 },
    });
    respond({
      type: "PROGRESS",
      requestId: request.requestId,
      progress: { stage: "recognizing", percent: 60 },
    });
    const result = (
      await instance.predict(request.image, {
        textRecScoreThresh: Math.min(1, Math.max(0, request.minimumConfidence)),
      })
    ).at(0);
    if (!result) throw new Error("OCR_RESULT_MISSING");
    respond({
      type: "PROGRESS",
      requestId: request.requestId,
      progress: { stage: "complete", percent: 100 },
    });
    respond({
      type: "RESULT",
      requestId: request.requestId,
      result: normalizePaddleResult(result),
    });
  } finally {
    request.image.close();
  }
}

async function dispose(request: Extract<OcrWorkerRequest, { type: "DISPOSE" }>) {
  const current = instance;
  instance = null;
  if (current) await current.dispose();
  respond({ type: "DISPOSED", requestId: request.requestId });
}

async function handleRequest(request: OcrWorkerRequest): Promise<void> {
  try {
    if (request.type === "INITIALIZE") await initialize(request);
    if (request.type === "RECOGNIZE") await recognize(request);
    if (request.type === "DISPOSE") await dispose(request);
  } catch (error) {
    respond({ type: "ERROR", requestId: request.requestId, error: serializeWorkerError(error) });
  }
}

scope.onmessage = (event) => {
  requestQueue = requestQueue.then(() => handleRequest(event.data));
};
