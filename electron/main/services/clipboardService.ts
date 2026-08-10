import type { NativeImage } from "electron";
import { randomUUID } from "node:crypto";

export interface ClipboardAdapter {
  readImage(): NativeImage;
}

export interface ClipboardImage {
  bytes: Uint8Array;
  displayName: string;
  mimeType: "image/png";
  sizeBytes: number;
}

function timestampName(now: Date): string {
  const digits = now
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 17);
  return `clipboard-${digits}-${randomUUID().slice(0, 8)}.png`;
}

export class ClipboardService {
  constructor(private readonly clipboard: ClipboardAdapter) {}

  readImage(now = new Date()): ClipboardImage | null {
    const image = this.clipboard.readImage();
    if (image.isEmpty()) return null;
    const buffer = image.toPNG();
    if (buffer.byteLength === 0) return null;
    return {
      bytes: new Uint8Array(buffer),
      displayName: timestampName(now),
      mimeType: "image/png",
      sizeBytes: buffer.byteLength,
    };
  }
}
