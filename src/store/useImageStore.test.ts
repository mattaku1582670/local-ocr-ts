import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ImageItem } from "../types/image";
import type { OcrDocument } from "../types/ocr";
import {
  initialImageStoreState,
  selectHasDirtyImages,
  selectSelectedImage,
  useImageStore,
} from "./useImageStore";

const originalRevokeObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
const revokeObjectUrlMock = vi.fn();

function createImage(id: string): ImageItem {
  return {
    id,
    displayName: `${id}.png`,
    sourceType: "file",
    sourcePath: `C:\\images\\${id}.png`,
    mimeType: "image/png",
    width: 800,
    height: 600,
    rotation: 0,
    objectUrl: `blob:${id}`,
    status: "ready",
    dirty: false,
  };
}

function createOcrDocument(imageId: string): OcrDocument {
  return {
    schemaVersion: "1.0",
    imageId,
    rawText: "認識結果",
    editedText: "認識結果",
    blocks: [],
    metadata: {
      engine: "test-engine",
      model: "test-model",
      language: "ja",
      preprocessPreset: "none",
      durationMs: 120,
      processedAt: "2026-08-10T00:00:00.000Z",
    },
  };
}

describe("useImageStore", () => {
  beforeEach(() => {
    revokeObjectUrlMock.mockClear();
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: revokeObjectUrlMock,
    });
    useImageStore.setState({ ...initialImageStoreState });
  });

  afterEach(() => {
    if (originalRevokeObjectUrlDescriptor) {
      Object.defineProperty(URL, "revokeObjectURL", originalRevokeObjectUrlDescriptor);
    } else {
      Reflect.deleteProperty(URL, "revokeObjectURL");
    }
  });

  it("adds unique images and selects the first image", () => {
    const first = createImage("first");
    const second = createImage("second");

    useImageStore.getState().addImages([first, second, first]);

    expect(useImageStore.getState().items).toEqual([first, second]);
    expect(selectSelectedImage(useImageStore.getState())).toEqual(first);
  });

  it("selects and removes an image while releasing its object URL", () => {
    useImageStore.getState().addImages([createImage("first"), createImage("second")]);
    useImageStore.getState().selectImage("second");
    useImageStore.getState().removeImage("second");

    expect(revokeObjectUrlMock).toHaveBeenCalledWith("blob:second");
    expect(useImageStore.getState().selectedImageId).toBe("first");
  });

  it("selects the next image after removing the selected middle item", () => {
    useImageStore
      .getState()
      .addImages([createImage("first"), createImage("second"), createImage("third")]);
    useImageStore.getState().selectImage("second");

    useImageStore.getState().removeImage("second");

    expect(useImageStore.getState().selectedImageId).toBe("third");
  });

  it("releases all object URLs when clearing images", () => {
    useImageStore.getState().addImages([createImage("first"), createImage("second")]);

    useImageStore.getState().clearImages();

    expect(revokeObjectUrlMock).toHaveBeenCalledTimes(2);
    expect(useImageStore.getState().items).toEqual([]);
  });

  it("tracks OCR edits as dirty until the image is marked as saved", () => {
    useImageStore.getState().addImages([createImage("first")]);
    useImageStore.getState().setOcrResult("first", createOcrDocument("first"));
    useImageStore.getState().editOcrText("first", "修正済み");

    expect(selectHasDirtyImages(useImageStore.getState())).toBe(true);
    expect(useImageStore.getState().items[0]?.ocrResult?.editedText).toBe("修正済み");

    useImageStore.getState().markSaved("first");
    expect(selectHasDirtyImages(useImageStore.getState())).toBe(false);
  });

  it("records an image error without changing other images", () => {
    useImageStore.getState().addImages([createImage("first"), createImage("second")]);

    useImageStore.getState().setImageError("second", {
      code: "OCR_PROCESSING_FAILED",
      message: "OCRに失敗しました。",
      recoverable: true,
    });

    expect(useImageStore.getState().items[0]?.status).toBe("ready");
    expect(useImageStore.getState().items[1]?.status).toBe("error");
  });
});
