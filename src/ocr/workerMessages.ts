import type { NormalizedOcrResult, OcrInitOptions, OcrProgressEvent } from "./OcrEngine";

export interface SerializedWorkerError {
  name: string;
  message: string;
}

export type OcrWorkerRequest =
  | { type: "INITIALIZE"; requestId: number; options: OcrInitOptions }
  | {
      type: "RECOGNIZE";
      requestId: number;
      image: ImageBitmap;
      minimumConfidence: number;
    }
  | { type: "DISPOSE"; requestId: number };

export type OcrWorkerResponse =
  | { type: "READY"; requestId: number }
  | { type: "PROGRESS"; requestId: number; progress: OcrProgressEvent }
  | { type: "RESULT"; requestId: number; result: NormalizedOcrResult }
  | { type: "DISPOSED"; requestId: number }
  | { type: "ERROR"; requestId: number; error: SerializedWorkerError };

export function serializeWorkerError(error: unknown): SerializedWorkerError {
  return error instanceof Error
    ? { name: error.name, message: error.message }
    : { name: "Error", message: "OCR Workerで不明なエラーが発生しました。" };
}

export function deserializeWorkerError(error: SerializedWorkerError): Error {
  const result = new Error(error.message);
  result.name = error.name;
  return result;
}
