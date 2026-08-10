import { Button } from "@heroui/react";
import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { useImageStore } from "../../store/useImageStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import type { Point } from "../../types/coordinates";
import type { ImageItem, ImageRotation } from "../../types/image";
import {
  MAX_PREVIEW_SCALE,
  MIN_PREVIEW_SCALE,
  clampPreviewScale,
  fitPreviewScale,
  pointInPolygon,
  polygonToScreen,
  type ViewTransform,
} from "./geometry";
import { decodePreviewSource, type DecodedPreviewSource } from "./previewDecoder";

interface ImagePreviewProps {
  image: ImageItem;
  selectedBlockId?: string | null;
  onBlockSelect?: (blockId: string | null) => void;
  decodeSource?: typeof decodePreviewSource;
}

interface ViewState {
  imageId: string;
  rotation: ImageRotation;
  mode: "fit" | "manual";
  scale: number;
  pan: Point;
}

interface DragState {
  pointerId: number;
  start: Point;
  initialPan: Point;
  moved: boolean;
}

function rotated(rotation: ImageRotation, delta: 90 | -90): ImageRotation {
  return ((rotation + delta + 360) % 360) as ImageRotation;
}

export function ImagePreview({
  image,
  selectedBlockId = null,
  onBlockSelect,
  decodeSource = decodePreviewSource,
}: ImagePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [decoded, setDecoded] = useState<DecodedPreviewSource | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [viewport, setViewport] = useState({ width: 1, height: 1 });
  const [panning, setPanning] = useState(false);
  const [viewState, setViewState] = useState<ViewState>({
    imageId: image.id,
    rotation: image.rotation,
    mode: "fit",
    scale: 1,
    pan: { x: 0, y: 0 },
  });
  const setRotation = useImageStore((state) => state.setRotation);
  const showOcrBoxes = useSettingsStore((state) => state.settings.showOcrBoxes);
  const updateSettings = useSettingsStore((state) => state.update);

  const fitScale = fitPreviewScale(
    image.width,
    image.height,
    image.rotation,
    viewport.width,
    viewport.height,
  );
  const currentView =
    viewState.imageId === image.id && viewState.rotation === image.rotation
      ? viewState
      : {
          imageId: image.id,
          rotation: image.rotation,
          mode: "fit" as const,
          scale: fitScale,
          pan: { x: 0, y: 0 },
        };
  const scale = currentView.mode === "fit" ? fitScale : currentView.scale;
  const panX = currentView.mode === "fit" ? 0 : currentView.pan.x;
  const panY = currentView.mode === "fit" ? 0 : currentView.pan.y;
  const pan = useMemo(() => ({ x: panX, y: panY }), [panX, panY]);
  const canPan = scale > fitScale + 0.001;

  const transform = useMemo<ViewTransform>(
    () => ({
      imageWidth: image.width,
      imageHeight: image.height,
      rotation: image.rotation,
      scale,
      pan,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
    }),
    [image.height, image.rotation, image.width, pan, scale, viewport.height, viewport.width],
  );

  useEffect(() => {
    let active = true;
    let source: DecodedPreviewSource | null = null;
    void decodeSource(image.objectUrl)
      .then((value) => {
        if (!active) {
          value.dispose();
          return;
        }
        source = value;
        setDecoded(value);
        setDecodeError(null);
      })
      .catch(() => {
        if (active) setDecodeError("画像プレビューを表示できませんでした。");
      });
    return () => {
      active = false;
      source?.dispose();
    };
  }, [decodeSource, image.objectUrl]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const updateSize = (width: number, height: number) => {
      setViewport({ width: Math.max(1, width), height: Math.max(1, height) });
    };
    const bounds = container.getBoundingClientRect();
    updateSize(bounds.width, bounds.height);
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      updateSize(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !decoded) return;
    const deviceScale = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(viewport.width * deviceScale));
    canvas.height = Math.max(1, Math.round(viewport.height * deviceScale));
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
    context.clearRect(0, 0, viewport.width, viewport.height);
    context.save();
    context.translate(viewport.width / 2 + pan.x, viewport.height / 2 + pan.y);
    context.scale(scale, scale);
    context.rotate((image.rotation * Math.PI) / 180);
    context.drawImage(
      decoded.source,
      -image.width / 2,
      -image.height / 2,
      image.width,
      image.height,
    );
    context.restore();

    if (!showOcrBoxes || !image.ocrResult) return;
    for (const block of image.ocrResult.blocks) {
      const screenPolygon = polygonToScreen(block.polygon, transform);
      const first = screenPolygon.points.at(0);
      if (!first) continue;
      context.beginPath();
      context.moveTo(first.x, first.y);
      for (const point of screenPolygon.points.slice(1)) context.lineTo(point.x, point.y);
      context.closePath();
      context.lineWidth = block.id === selectedBlockId ? 3 : 1.5;
      context.strokeStyle = block.id === selectedBlockId ? "#f59e0b" : "#2563eb";
      context.fillStyle =
        block.id === selectedBlockId ? "rgba(245, 158, 11, 0.16)" : "rgba(37, 99, 235, 0.08)";
      context.fill();
      context.stroke();
    }
  }, [decoded, image, pan, scale, selectedBlockId, showOcrBoxes, transform, viewport]);

  const setManualView = (nextScale: number, nextPan = pan) => {
    setViewState({
      imageId: image.id,
      rotation: image.rotation,
      mode: "manual",
      scale: clampPreviewScale(nextScale),
      pan: nextPan,
    });
  };

  const pointerPosition = (
    event: MouseEvent<HTMLCanvasElement> | PointerEvent<HTMLCanvasElement>,
  ): Point => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 || !canPan) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      initialPan: pan,
      moved: false,
    };
    setPanning(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const delta = { x: event.clientX - drag.start.x, y: event.clientY - drag.start.y };
    if (Math.abs(delta.x) + Math.abs(delta.y) > 3) drag.moved = true;
    setManualView(scale, { x: drag.initialPan.x + delta.x, y: drag.initialPan.y + delta.y });
  };

  const finishPan = (event: PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setPanning(false);
  };

  const selectOcrBlock = (event: MouseEvent<HTMLCanvasElement>) => {
    if (dragRef.current?.moved) {
      dragRef.current = null;
      return;
    }
    dragRef.current = null;
    if (!showOcrBoxes || !image.ocrResult || !onBlockSelect) return;
    const point = pointerPosition(event);
    const block = [...image.ocrResult.blocks]
      .reverse()
      .find((candidate) => pointInPolygon(point, polygonToScreen(candidate.polygon, transform)));
    onBlockSelect(block?.id ?? null);
  };

  return (
    <div className="image-preview">
      <div className="preview-toolbar" aria-label="画像プレビュー操作" role="toolbar">
        <Button
          variant="outline"
          aria-label="縮小"
          isDisabled={scale <= MIN_PREVIEW_SCALE}
          onPress={() => {
            setManualView(scale / 1.25);
          }}
        >
          −
        </Button>
        <output className="zoom-value" aria-label="表示倍率">
          {Math.round(scale * 100)}%
        </output>
        <Button
          variant="outline"
          aria-label="拡大"
          isDisabled={scale >= MAX_PREVIEW_SCALE}
          onPress={() => {
            setManualView(scale * 1.25);
          }}
        >
          ＋
        </Button>
        <Button
          variant="outline"
          onPress={() => {
            setManualView(1, { x: 0, y: 0 });
          }}
        >
          100%
        </Button>
        <Button
          variant="outline"
          onPress={() => {
            setViewState({
              imageId: image.id,
              rotation: image.rotation,
              mode: "fit",
              scale: fitScale,
              pan: { x: 0, y: 0 },
            });
          }}
        >
          画面に合わせる
        </Button>
        <Button
          variant="outline"
          aria-label="左へ90度回転"
          onPress={() => {
            setRotation(image.id, rotated(image.rotation, -90));
          }}
        >
          ↶
        </Button>
        <Button
          variant="outline"
          aria-label="右へ90度回転"
          onPress={() => {
            setRotation(image.id, rotated(image.rotation, 90));
          }}
        >
          ↷
        </Button>
        <Button
          variant="outline"
          onPress={() => {
            updateSettings({ showOcrBoxes: !showOcrBoxes });
          }}
        >
          OCR枠を{showOcrBoxes ? "隠す" : "表示"}
        </Button>
      </div>
      <div ref={containerRef} className="preview-canvas-container">
        <canvas
          ref={canvasRef}
          className={`preview-canvas${canPan ? " can-pan" : ""}${panning ? " is-panning" : ""}`}
          aria-label={`${image.displayName}のプレビュー`}
          role="img"
          onClick={selectOcrBlock}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPan}
          onPointerCancel={finishPan}
          onWheel={(event) => {
            if (!event.ctrlKey) return;
            event.preventDefault();
            setManualView(scale * (event.deltaY < 0 ? 1.25 : 0.8));
          }}
        />
        {decodeError ? <p className="preview-error">{decodeError}</p> : null}
      </div>
    </div>
  );
}
