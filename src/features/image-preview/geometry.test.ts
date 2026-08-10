import { describe, expect, it } from "vitest";
import type { ImageRotation } from "../../types/image";
import {
  clampPreviewScale,
  fitPreviewScale,
  imageToScreen,
  pointInPolygon,
  rotateImagePoint,
  rotatedImageSize,
  screenToImage,
  type ViewTransform,
} from "./geometry";

describe("preview geometry", () => {
  it.each([
    [0, { x: 20, y: 10 }],
    [90, { x: 40, y: 20 }],
    [180, { x: 80, y: 40 }],
    [270, { x: 10, y: 80 }],
  ] as const)("rotates points by %i degrees", (rotation, expected) => {
    expect(rotateImagePoint({ x: 20, y: 10 }, 100, 50, rotation)).toEqual(expected);
  });

  it("swaps dimensions for quarter turns", () => {
    expect(rotatedImageSize(100, 50, 90)).toEqual({ width: 50, height: 100 });
    expect(rotatedImageSize(100, 50, 270)).toEqual({ width: 50, height: 100 });
  });

  it.each([0, 90, 180, 270] as ImageRotation[])(
    "round-trips image and screen coordinates at %i degrees",
    (rotation) => {
      const transform: ViewTransform = {
        imageWidth: 100,
        imageHeight: 50,
        rotation,
        scale: 2.5,
        pan: { x: 13, y: -8 },
        viewportWidth: 900,
        viewportHeight: 600,
      };
      const original = { x: 27.5, y: 42.25 };

      const restored = screenToImage(imageToScreen(original, transform), transform);

      expect(restored.x).toBeCloseTo(original.x);
      expect(restored.y).toBeCloseTo(original.y);
    },
  );

  it("fits rotated images and clamps zoom to 10-800 percent", () => {
    expect(fitPreviewScale(1000, 500, 0, 500, 500, 0)).toBe(0.5);
    expect(fitPreviewScale(1000, 500, 90, 500, 500, 0)).toBe(0.5);
    expect(clampPreviewScale(0.01)).toBe(0.1);
    expect(clampPreviewScale(20)).toBe(8);
  });

  it("detects points inside OCR polygons", () => {
    const polygon = {
      points: [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 10 },
        { x: 0, y: 10 },
      ],
    };
    expect(pointInPolygon({ x: 5, y: 5 }, polygon)).toBe(true);
    expect(pointInPolygon({ x: 25, y: 5 }, polygon)).toBe(false);
  });
});
