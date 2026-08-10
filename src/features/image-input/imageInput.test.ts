import { describe, expect, it, vi } from "vitest";
import {
  loadDroppedFile,
  parseClipboardResponse,
  parseOpenImagesResponse,
  prepareImageItem,
  type ImagePreparationDependencies,
  type LoadedImage,
} from "./imageInput";

const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function loadedImage(): LoadedImage {
  return {
    bytes: pngBytes,
    displayName: "sample.png",
    mimeType: "image/png",
    sizeBytes: pngBytes.byteLength,
  };
}

function dependencies(): ImagePreparationDependencies {
  return {
    createId: () => "image-id",
    createObjectUrl: () => "blob:image-id",
    decodeDimensions: () => Promise.resolve({ width: 640, height: 480 }),
    revokeObjectUrl: vi.fn(),
  };
}

describe("imageInput", () => {
  it("validates a dropped image by extension, MIME, and signature", async () => {
    const file = new File([pngBytes], "sample.png", { type: "image/png" });

    await expect(loadDroppedFile(file)).resolves.toEqual(loadedImage());
  });

  it("rejects unsupported and disguised dropped files", async () => {
    const unsupported = new File([pngBytes], "sample.gif", { type: "image/gif" });
    const disguised = new File([new Uint8Array([1, 2, 3])], "sample.png", {
      type: "image/png",
    });

    await expect(loadDroppedFile(unsupported)).rejects.toThrow("対応していない");
    await expect(loadDroppedFile(disguised)).rejects.toThrow("内容と拡張子");
  });

  it("parses successful file and clipboard IPC responses", () => {
    expect(
      parseOpenImagesResponse({
        ok: true,
        value: { images: [loadedImage()], rejected: [] },
      }),
    ).toEqual({ images: [loadedImage()], rejected: [] });
    expect(parseClipboardResponse({ ok: true, value: loadedImage() })).toEqual(loadedImage());
  });

  it("turns bytes into an image item with decoded dimensions", async () => {
    await expect(prepareImageItem(loadedImage(), "file", dependencies())).resolves.toMatchObject({
      id: "image-id",
      sourceType: "file",
      width: 640,
      height: 480,
      objectUrl: "blob:image-id",
      status: "ready",
    });
  });

  it("releases the object URL when image decoding fails", async () => {
    const deps = dependencies();
    deps.decodeDimensions = vi.fn().mockRejectedValue(new Error("decode failed"));

    await expect(prepareImageItem(loadedImage(), "file", deps)).rejects.toThrow("decode failed");
    expect(deps.revokeObjectUrl).toHaveBeenCalledWith("blob:image-id");
  });
});
