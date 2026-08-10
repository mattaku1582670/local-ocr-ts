import type { Rect } from "./coordinates";
import type { AppError } from "./errors";
import type { OcrDocument } from "./ocr";

export type ImageStatus =
  "idle" | "loading" | "ready" | "processing" | "success" | "error" | "cancelled";

export type ImageRotation = 0 | 90 | 180 | 270;

export interface ImageItem {
  id: string;
  displayName: string;
  sourceType: "file" | "clipboard";
  sourcePath?: string;
  mimeType: string;
  width: number;
  height: number;
  rotation: ImageRotation;
  objectUrl: string;
  status: ImageStatus;
  selectedRegion?: Rect;
  ocrResult?: OcrDocument;
  error?: AppError;
  dirty: boolean;
}
