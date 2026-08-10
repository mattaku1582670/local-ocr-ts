import { extname } from "node:path";

export type SupportedImageMime = "image/png" | "image/jpeg" | "image/webp" | "image/bmp";

const MIME_BY_EXTENSION: Readonly<Record<string, SupportedImageMime>> = Object.freeze({
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
});

export const IMAGE_DIALOG_FILTERS = Object.freeze([
  { name: "対応画像", extensions: ["png", "jpg", "jpeg", "webp", "bmp"] },
  { name: "PNG", extensions: ["png"] },
  { name: "JPEG", extensions: ["jpg", "jpeg"] },
  { name: "WebP", extensions: ["webp"] },
  { name: "BMP", extensions: ["bmp"] },
]);

export function mimeFromExtension(filePath: string): SupportedImageMime | undefined {
  return MIME_BY_EXTENSION[extname(filePath).toLocaleLowerCase("en-US")];
}

export function detectImageMime(bytes: Uint8Array): SupportedImageMime | undefined {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return "image/bmp";
  return undefined;
}
