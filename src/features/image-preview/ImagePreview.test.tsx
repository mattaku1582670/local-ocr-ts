import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialImageStoreState, useImageStore } from "../../store/useImageStore";
import { initialSettingsStoreState, useSettingsStore } from "../../store/useSettingsStore";
import type { ImageItem } from "../../types/image";
import { ImagePreview } from "./ImagePreview";
import type { DecodedPreviewSource } from "./previewDecoder";

const drawImage = vi.fn();
const translate = vi.fn();

function imageFixture(): ImageItem {
  return {
    id: "preview",
    displayName: "preview.png",
    sourceType: "file",
    mimeType: "image/png",
    width: 100,
    height: 100,
    rotation: 0,
    objectUrl: "blob:preview",
    status: "success",
    dirty: false,
    ocrResult: {
      schemaVersion: "1.0",
      imageId: "preview",
      rawText: "中央",
      editedText: "中央",
      blocks: [
        {
          id: "center",
          text: "中央",
          confidence: 0.9,
          order: 0,
          polygon: {
            points: [
              { x: 40, y: 40 },
              { x: 60, y: 40 },
              { x: 60, y: 60 },
              { x: 40, y: 60 },
            ],
          },
        },
      ],
      metadata: {
        engine: "test",
        model: "test",
        language: "ja",
        preprocessPreset: "none",
        durationMs: 1,
        processedAt: "2026-08-10T00:00:00.000Z",
      },
    },
  };
}

function decodedSource(): DecodedPreviewSource {
  return {
    source: {} as CanvasImageSource,
    width: 100,
    height: 100,
    dispose: vi.fn(),
  };
}

describe("ImagePreview", () => {
  beforeEach(() => {
    drawImage.mockClear();
    translate.mockClear();
    const context = {
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      save: vi.fn(),
      translate,
      scale: vi.fn(),
      rotate: vi.fn(),
      drawImage,
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      lineWidth: 1,
      strokeStyle: "",
      fillStyle: "",
    } as unknown as CanvasRenderingContext2D;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn().mockReturnValue(context),
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "setPointerCapture", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "releasePointerCapture", {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 400,
      height: 400,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 400,
      bottom: 400,
      toJSON: () => ({}),
    });
    useImageStore.setState({
      ...initialImageStoreState,
      items: [imageFixture()],
      selectedImageId: "preview",
    });
    useSettingsStore.setState({
      ...initialSettingsStoreState,
      settings: { ...initialSettingsStoreState.settings, showOcrBoxes: true },
    });
  });

  it("draws the decoded source and provides fit, zoom, and rotation controls", async () => {
    const decodeSource = vi.fn().mockResolvedValue(decodedSource());
    render(<ImagePreview image={imageFixture()} decodeSource={decodeSource} />);

    await waitFor(() => {
      expect(drawImage).toHaveBeenCalled();
    });
    fireEvent.click(screen.getByRole("button", { name: "100%" }));
    expect(screen.getByRole("status", { name: "表示倍率" })).toHaveTextContent("100%");

    fireEvent.click(screen.getByRole("button", { name: "右へ90度回転" }));
    expect(useImageStore.getState().items[0]?.rotation).toBe(90);
  });

  it("toggles OCR boxes through settings", () => {
    render(
      <ImagePreview
        image={imageFixture()}
        decodeSource={vi.fn().mockResolvedValue(decodedSource())}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "OCR枠を隠す" }));

    expect(useSettingsStore.getState().settings.showOcrBoxes).toBe(false);
    expect(screen.getByRole("button", { name: "OCR枠を表示" })).toBeInTheDocument();
  });

  it("pans by pointer dragging after zooming beyond fit", async () => {
    render(
      <ImagePreview
        image={imageFixture()}
        decodeSource={vi.fn().mockResolvedValue(decodedSource())}
      />,
    );
    await waitFor(() => {
      expect(screen.getByLabelText("表示倍率")).toHaveTextContent("352%");
    });
    fireEvent.click(screen.getByRole("button", { name: "拡大" }));
    const canvas = screen.getByRole("img", { name: "preview.pngのプレビュー" });

    fireEvent.pointerDown(canvas, { pointerId: 1, button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 130, clientY: 120 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 130, clientY: 120 });

    await waitFor(() => {
      expect(translate).toHaveBeenCalledWith(230, 220);
    });
  });

  it("selects an OCR block by clicking its polygon", async () => {
    const onBlockSelect = vi.fn();
    render(
      <ImagePreview
        image={imageFixture()}
        decodeSource={vi.fn().mockResolvedValue(decodedSource())}
        onBlockSelect={onBlockSelect}
      />,
    );
    await waitFor(() => {
      expect(screen.getByLabelText("表示倍率")).toHaveTextContent("352%");
    });

    fireEvent.click(screen.getByRole("img", { name: "preview.pngのプレビュー" }), {
      clientX: 200,
      clientY: 200,
    });

    expect(onBlockSelect).toHaveBeenCalledWith("center");
  });
});
