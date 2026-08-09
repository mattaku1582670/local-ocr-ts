import "./styles.css";

import type { NormalizedOcrResult, OcrEngine } from "./ocr/OcrEngine";
import { PaddleOcrEngine } from "./ocr/PaddleOcrEngine";

type PocErrorCode =
  | "POC_IMAGE_DECODE_FAILED"
  | "POC_MODEL_INITIALIZATION_FAILED"
  | "POC_OCR_FAILED"
  | "POC_SAMPLE_CREATION_FAILED";

class PocError extends Error {
  readonly code: PocErrorCode;

  constructor(code: PocErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PocError";
    this.code = code;
  }
}

const DETECTION_MODEL_FILE = "PP-OCRv5_mobile_det_onnx_infer.tar";
const RECOGNITION_MODEL_FILE = "PP-OCRv5_mobile_rec_onnx_infer.tar";

const input = requireElement("image-input", HTMLInputElement);
const latinSampleButton = requireElement("latin-sample-button", HTMLButtonElement);
const japaneseSampleButton = requireElement("japanese-sample-button", HTMLButtonElement);
const status = requireElement("status", HTMLParagraphElement);
const preview = requireElement("preview", HTMLImageElement);
const recognizedText = requireElement("recognized-text", HTMLPreElement);
const resultJson = requireElement("result-json", HTMLPreElement);
const uiHeartbeat = requireElement("ui-heartbeat", HTMLSpanElement);

const engine: OcrEngine = new PaddleOcrEngine();
let initializationPromise: Promise<void> | null = null;
let previewUrl: string | null = null;
let heartbeatCount = 0;
const heartbeatTimer = window.setInterval(() => {
  heartbeatCount += 1;
  uiHeartbeat.textContent = String(heartbeatCount);
}, 50);

input.addEventListener("change", () => {
  const file = input.files?.[0];
  if (file !== undefined) {
    void runOcr(file);
  }
});

latinSampleButton.addEventListener("click", () => {
  void createSampleImage(["LOCAL OCR", "TEST ABC 123"], "Segoe UI").then(runOcr).catch(showError);
});

japaneseSampleButton.addEventListener("click", () => {
  void createSampleImage(["日本語の文字認識", "東京 2026"], "Yu Gothic UI")
    .then(runOcr)
    .catch(showError);
});

window.addEventListener("beforeunload", () => {
  window.clearInterval(heartbeatTimer);
  releasePreviewUrl();
  void engine.dispose();
});

async function runOcr(imageBlob: Blob): Promise<void> {
  setBusy(true);
  clearResult();
  showPreview(imageBlob);

  let bitmap: ImageBitmap | null = null;
  try {
    setStatus("モデルをローカル資産から初期化しています…", "working");
    await initializeEngine();

    setStatus("画像を認識しています…", "working");
    try {
      bitmap = await createImageBitmap(imageBlob);
    } catch (error) {
      throw new PocError("POC_IMAGE_DECODE_FAILED", "画像をデコードできませんでした。", {
        cause: error,
      });
    }

    let result: NormalizedOcrResult;
    try {
      result = await engine.recognize(bitmap, { minimumConfidence: 0 });
    } catch (error) {
      throw new PocError("POC_OCR_FAILED", "OCR処理に失敗しました。", { cause: error });
    }

    recognizedText.textContent = result.text || "（認識文字なし）";
    resultJson.textContent = JSON.stringify(result, null, 2);
    setStatus(
      `OCRが完了しました。${String(result.blocks.length)}行、${result.durationMs.toFixed(0)} ms`,
      "success",
    );
  } catch (error) {
    showError(error);
  } finally {
    bitmap?.close();
    setBusy(false);
  }
}

async function initializeEngine(): Promise<void> {
  if (initializationPromise === null) {
    initializationPromise = engine
      .initialize({
        assets: {
          detectionModelUrl: localAssetUrl(`assets/models/${DETECTION_MODEL_FILE}`),
          recognitionModelUrl: localAssetUrl(`assets/models/${RECOGNITION_MODEL_FILE}`),
          wasmBaseUrl: localAssetUrl("assets/wasm/"),
        },
      })
      .catch((error: unknown) => {
        initializationPromise = null;
        throw new PocError(
          "POC_MODEL_INITIALIZATION_FAILED",
          "OCRモデルを初期化できませんでした。ローカル資産を確認してください。",
          { cause: error },
        );
      });
  }

  await initializationPromise;
}

function localAssetUrl(relativePath: string): string {
  return new URL(relativePath, document.baseURI).href;
}

async function createSampleImage(
  lines: readonly [string, string],
  fontFamily: string,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 500;
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new PocError("POC_SAMPLE_CREATION_FAILED", "サンプル画像を作成できませんでした。");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#111111";
  context.font = `700 108px "${fontFamily}", sans-serif`;
  context.fillText(lines[0], 80, 190);
  context.font = `600 88px "${fontFamily}", sans-serif`;
  context.fillText(lines[1], 80, 385);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (blob === null) {
    throw new PocError("POC_SAMPLE_CREATION_FAILED", "サンプル画像をPNG化できませんでした。");
  }
  return blob;
}

function showPreview(blob: Blob): void {
  releasePreviewUrl();
  previewUrl = URL.createObjectURL(blob);
  preview.src = previewUrl;
  preview.hidden = false;
}

function releasePreviewUrl(): void {
  if (previewUrl !== null) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
}

function clearResult(): void {
  recognizedText.textContent = "";
  resultJson.textContent = "";
}

function setBusy(busy: boolean): void {
  input.disabled = busy;
  latinSampleButton.disabled = busy;
  japaneseSampleButton.disabled = busy;
}

function setStatus(message: string, state: "idle" | "working" | "success" | "error"): void {
  status.textContent = message;
  status.dataset.state = state;
}

function showError(error: unknown): void {
  const pocError =
    error instanceof PocError
      ? error
      : new PocError("POC_OCR_FAILED", "予期しないエラーが発生しました。", { cause: error });
  setStatus(`${pocError.code}: ${pocError.message}`, "error");
}

function requireElement<T extends HTMLElement>(id: string, elementType: { new (): T }): T {
  const element = document.getElementById(id);
  if (!(element instanceof elementType)) {
    throw new Error(`POC_REQUIRED_ELEMENT_MISSING: ${id}`);
  }
  return element;
}
