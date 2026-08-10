import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialImageStoreState, useImageStore } from "../../store/useImageStore";
import { initialOcrStoreState, useOcrStore } from "../../store/useOcrStore";
import type { ImageItem } from "../../types/image";
import { ImageList } from "./ImageList";

const revokeObjectUrl = vi.fn();

function createImage(id: string, overrides: Partial<ImageItem> = {}): ImageItem {
  return {
    id,
    displayName: `${id}.png`,
    sourceType: "file",
    mimeType: "image/png",
    width: 640,
    height: 480,
    rotation: 0,
    objectUrl: `blob:${id}`,
    status: "ready",
    dirty: false,
    ...overrides,
  };
}

describe("ImageList", () => {
  beforeEach(() => {
    revokeObjectUrl.mockClear();
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectUrl,
    });
    useImageStore.setState({ ...initialImageStoreState });
    useOcrStore.setState({
      ...initialOcrStoreState,
      queue: [],
      progressByImageId: {},
    });
  });

  it("shows thumbnails, dimensions, OCR status, character count, and errors", () => {
    useImageStore.setState({
      items: [
        createImage("ready"),
        createImage("success", {
          status: "success",
          dirty: true,
          ocrResult: {
            schemaVersion: "1.0",
            imageId: "success",
            rawText: "日本語",
            editedText: "日本語",
            blocks: [],
            metadata: {
              engine: "test",
              model: "test",
              language: "ja",
              preprocessPreset: "none",
              durationMs: 10,
              processedAt: "2026-08-10T00:00:00.000Z",
            },
          },
        }),
        createImage("failed", {
          status: "error",
          error: { code: "OCR_PROCESSING_FAILED", message: "認識失敗", recoverable: true },
        }),
      ],
      selectedImageId: "ready",
    });

    const { container } = render(<ImageList />);

    expect(container.querySelectorAll(".image-thumbnail")).toHaveLength(3);
    expect(screen.getAllByText("640 × 480px")).toHaveLength(3);
    expect(screen.getByText("OCR待ち")).toBeInTheDocument();
    expect(screen.getByText("OCR完了")).toBeInTheDocument();
    expect(screen.getByText("認識文字数: 3")).toBeInTheDocument();
    expect(screen.getByText("未保存")).toBeInTheDocument();
    expect(screen.getByText("認識失敗")).toBeInTheDocument();
  });

  it("shows live OCR progress", () => {
    useImageStore.setState({ items: [createImage("first")], selectedImageId: "first" });
    useOcrStore.setState({
      progressByImageId: { first: { percent: 42.4, stage: "recognizing" } },
    });

    render(<ImageList />);

    expect(screen.getByText("OCR処理中 42%")).toBeInTheDocument();
  });

  it("selects with click and arrow keys", () => {
    useImageStore.setState({
      items: [createImage("first"), createImage("second")],
      selectedImageId: "first",
    });
    render(<ImageList />);
    const first = screen.getByRole("option", { name: /first\.png/ });
    const second = screen.getByRole("option", { name: /second\.png/ });

    fireEvent.click(second);
    expect(useImageStore.getState().selectedImageId).toBe("second");

    fireEvent.keyDown(second, { key: "ArrowUp" });
    expect(useImageStore.getState().selectedImageId).toBe("first");
    expect(document.activeElement).toBe(first);
  });

  it("requires confirmation before removing a dirty image", () => {
    const confirmAction = vi.fn().mockReturnValue(false);
    useImageStore.setState({
      items: [createImage("dirty", { dirty: true })],
      selectedImageId: "dirty",
    });
    render(<ImageList confirmAction={confirmAction} />);

    fireEvent.click(screen.getByRole("button", { name: "dirty.pngを削除" }));
    expect(useImageStore.getState().items).toHaveLength(1);

    confirmAction.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "dirty.pngを削除" }));
    expect(useImageStore.getState().items).toHaveLength(0);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:dirty");
  });

  it("clears immediately without dirty data and confirms when dirty data exists", () => {
    const confirmAction = vi.fn().mockReturnValue(false);
    useImageStore.setState({
      items: [createImage("clean"), createImage("dirty", { dirty: true })],
      selectedImageId: "clean",
    });
    render(<ImageList confirmAction={confirmAction} />);

    fireEvent.click(screen.getByRole("button", { name: "すべてクリア" }));
    expect(useImageStore.getState().items).toHaveLength(2);
    expect(confirmAction).toHaveBeenCalledOnce();

    confirmAction.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "すべてクリア" }));
    expect(useImageStore.getState().items).toHaveLength(0);
    expect(revokeObjectUrl).toHaveBeenCalledTimes(2);
  });
});
