// @vitest-environment node
import type { NativeImage } from "electron";
import { describe, expect, it } from "vitest";
import { ClipboardService } from "./clipboardService.js";

function imageAdapter(bytes: number[], empty = false): NativeImage {
  return {
    isEmpty: () => empty,
    toPNG: () => Buffer.from(bytes),
  } as unknown as NativeImage;
}

describe("ClipboardService", () => {
  it("returns null when the clipboard has no image", () => {
    const service = new ClipboardService({ readImage: () => imageAdapter([], true) });
    expect(service.readImage()).toBeNull();
  });

  it("converts an image to PNG and generates unique timestamp names", () => {
    const service = new ClipboardService({ readImage: () => imageAdapter([1, 2, 3]) });
    const now = new Date("2026-08-10T01:02:03.456Z");
    const first = service.readImage(now);
    const second = service.readImage(now);
    expect(first?.mimeType).toBe("image/png");
    expect(first?.bytes).toEqual(new Uint8Array([1, 2, 3]));
    expect(first?.displayName).toMatch(/^clipboard-20260810010203456-[a-f0-9]{8}\.png$/);
    expect(second?.displayName).not.toBe(first?.displayName);
  });
});
