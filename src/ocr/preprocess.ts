import type { Point } from "../types/coordinates";
import { PREPROCESS_PRESETS, type PreprocessPreset } from "../types/ocr";
import type { NormalizedOcrResult } from "./OcrEngine";

export const MAX_OCR_PIXELS = 1920 * 1080;
export const MAX_OCR_DIMENSION = 8192;
export { PREPROCESS_PRESETS };

export interface PreprocessOptions {
  preset: PreprocessPreset;
  maxPixels?: number;
  maxDimension?: number;
}

export interface PreprocessTransform {
  sourceWidth: number;
  sourceHeight: number;
  processedWidth: number;
  processedHeight: number;
  scaleX: number;
  scaleY: number;
}

export interface SafeImageDimensions {
  width: number;
  height: number;
  scale: number;
  resized: boolean;
}

interface PreprocessContext {
  fillStyle: string | CanvasGradient | CanvasPattern;
  imageSmoothingEnabled: boolean;
  imageSmoothingQuality: ImageSmoothingQuality;
  drawImage: (image: CanvasImageSource, dx: number, dy: number, dw: number, dh: number) => void;
  fillRect: (x: number, y: number, width: number, height: number) => void;
  getImageData: (sx: number, sy: number, sw: number, sh: number) => ImageData;
  putImageData: (imageData: ImageData, dx: number, dy: number) => void;
}

interface PreprocessCanvas {
  getContext: (
    contextId: "2d",
    options?: CanvasRenderingContext2DSettings,
  ) => PreprocessContext | null;
  transferToImageBitmap: () => ImageBitmap;
}

export interface PreprocessDependencies {
  createCanvas: (width: number, height: number) => PreprocessCanvas;
}

export interface PreprocessedImage {
  image: ImageBitmap;
  transform: PreprocessTransform;
  dispose: () => void;
}

const browserDependencies: PreprocessDependencies = {
  createCanvas: (width, height) => new OffscreenCanvas(width, height),
};

function positiveInteger(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 1) throw new Error(`${name} must be a positive number.`);
  return Math.floor(value);
}

export function calculateSafeImageDimensions(
  sourceWidth: number,
  sourceHeight: number,
  maxPixels = MAX_OCR_PIXELS,
  maxDimension = MAX_OCR_DIMENSION,
): SafeImageDimensions {
  const width = positiveInteger(sourceWidth, "sourceWidth");
  const height = positiveInteger(sourceHeight, "sourceHeight");
  const pixelLimit = Math.min(positiveInteger(maxPixels, "maxPixels"), MAX_OCR_PIXELS);
  const dimensionLimit = Math.min(positiveInteger(maxDimension, "maxDimension"), MAX_OCR_DIMENSION);
  const scale = Math.min(
    1,
    Math.sqrt(pixelLimit / (width * height)),
    dimensionLimit / width,
    dimensionLimit / height,
  );
  const safeWidth = Math.max(1, Math.floor(width * scale));
  const safeHeight = Math.max(1, Math.floor(height * scale));
  return {
    width: safeWidth,
    height: safeHeight,
    scale: Math.min(safeWidth / width, safeHeight / height),
    resized: safeWidth !== width || safeHeight !== height,
  };
}

function clampByte(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

export function applyDocumentPreset(pixels: Uint8ClampedArray): void {
  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index] ?? 0;
    const green = pixels[index + 1] ?? 0;
    const blue = pixels[index + 2] ?? 0;
    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    const adjusted = clampByte((luminance - 128) * 1.15 + 128);
    pixels[index] = adjusted;
    pixels[index + 1] = adjusted;
    pixels[index + 2] = adjusted;
    pixels[index + 3] = 255;
  }
}

export function preprocessImage(
  source: ImageBitmap,
  options: PreprocessOptions,
  dependencies: PreprocessDependencies = browserDependencies,
): PreprocessedImage {
  const dimensions = calculateSafeImageDimensions(
    source.width,
    source.height,
    options.maxPixels,
    options.maxDimension,
  );
  const canvas = dependencies.createCanvas(dimensions.width, dimensions.height);
  const context = canvas.getContext("2d", { willReadFrequently: options.preset === "document" });
  if (!context) throw new Error("OCR前処理用Canvasを作成できませんでした。");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, dimensions.width, dimensions.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, dimensions.width, dimensions.height);

  if (options.preset === "document") {
    const imageData = context.getImageData(0, 0, dimensions.width, dimensions.height);
    applyDocumentPreset(imageData.data);
    context.putImageData(imageData, 0, 0);
  }

  const image = canvas.transferToImageBitmap();
  const transform: PreprocessTransform = {
    sourceWidth: source.width,
    sourceHeight: source.height,
    processedWidth: dimensions.width,
    processedHeight: dimensions.height,
    scaleX: dimensions.width / source.width,
    scaleY: dimensions.height / source.height,
  };
  return {
    image,
    transform,
    dispose: () => {
      image.close();
    },
  };
}

export function restorePointToSource(point: Point, transform: PreprocessTransform): Point {
  return {
    x: Math.min(transform.sourceWidth, Math.max(0, point.x / transform.scaleX)),
    y: Math.min(transform.sourceHeight, Math.max(0, point.y / transform.scaleY)),
  };
}

export function restoreOcrResultToSource(
  result: NormalizedOcrResult,
  transform: PreprocessTransform,
): NormalizedOcrResult {
  return {
    ...result,
    image: { width: transform.sourceWidth, height: transform.sourceHeight },
    blocks: result.blocks.map((block) => ({
      ...block,
      polygon: {
        points: block.polygon.points.map((point) => restorePointToSource(point, transform)),
      },
    })),
  };
}

export type OcrBitmapDecoder = (
  image: ImageBitmapSource,
  options?: ImageBitmapOptions,
) => Promise<ImageBitmap>;

export async function decodeOcrBitmap(
  blob: Blob,
  decoder: OcrBitmapDecoder = createImageBitmap,
): Promise<ImageBitmap> {
  return decoder(blob, {
    colorSpaceConversion: "default",
    imageOrientation: "from-image",
    premultiplyAlpha: "premultiply",
  });
}
