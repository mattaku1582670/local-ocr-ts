import type { Point, Polygon } from "../../types/coordinates";
import type { ImageRotation } from "../../types/image";

export const MIN_PREVIEW_SCALE = 0.1;
export const MAX_PREVIEW_SCALE = 8;

export interface ViewTransform {
  imageWidth: number;
  imageHeight: number;
  rotation: ImageRotation;
  scale: number;
  pan: Point;
  viewportWidth: number;
  viewportHeight: number;
}

export function rotatedImageSize(
  width: number,
  height: number,
  rotation: ImageRotation,
): { width: number; height: number } {
  return rotation === 90 || rotation === 270 ? { width: height, height: width } : { width, height };
}

export function rotateImagePoint(
  point: Point,
  width: number,
  height: number,
  rotation: ImageRotation,
): Point {
  if (rotation === 90) return { x: height - point.y, y: point.x };
  if (rotation === 180) return { x: width - point.x, y: height - point.y };
  if (rotation === 270) return { x: point.y, y: width - point.x };
  return { ...point };
}

export function unrotateImagePoint(
  point: Point,
  width: number,
  height: number,
  rotation: ImageRotation,
): Point {
  if (rotation === 90) return { x: point.y, y: height - point.x };
  if (rotation === 180) return { x: width - point.x, y: height - point.y };
  if (rotation === 270) return { x: width - point.y, y: point.x };
  return { ...point };
}

export function clampPreviewScale(scale: number): number {
  return Math.min(MAX_PREVIEW_SCALE, Math.max(MIN_PREVIEW_SCALE, scale));
}

export function fitPreviewScale(
  imageWidth: number,
  imageHeight: number,
  rotation: ImageRotation,
  viewportWidth: number,
  viewportHeight: number,
  padding = 24,
): number {
  const rotated = rotatedImageSize(imageWidth, imageHeight, rotation);
  const availableWidth = Math.max(1, viewportWidth - padding * 2);
  const availableHeight = Math.max(1, viewportHeight - padding * 2);
  return clampPreviewScale(
    Math.min(
      availableWidth / Math.max(1, rotated.width),
      availableHeight / Math.max(1, rotated.height),
    ),
  );
}

export function imageToScreen(point: Point, transform: ViewTransform): Point {
  const rotated = rotateImagePoint(
    point,
    transform.imageWidth,
    transform.imageHeight,
    transform.rotation,
  );
  const rotatedSize = rotatedImageSize(
    transform.imageWidth,
    transform.imageHeight,
    transform.rotation,
  );
  return {
    x:
      transform.viewportWidth / 2 +
      transform.pan.x +
      (rotated.x - rotatedSize.width / 2) * transform.scale,
    y:
      transform.viewportHeight / 2 +
      transform.pan.y +
      (rotated.y - rotatedSize.height / 2) * transform.scale,
  };
}

export function screenToImage(point: Point, transform: ViewTransform): Point {
  const rotatedSize = rotatedImageSize(
    transform.imageWidth,
    transform.imageHeight,
    transform.rotation,
  );
  const rotated = {
    x:
      (point.x - transform.viewportWidth / 2 - transform.pan.x) / transform.scale +
      rotatedSize.width / 2,
    y:
      (point.y - transform.viewportHeight / 2 - transform.pan.y) / transform.scale +
      rotatedSize.height / 2,
  };
  return unrotateImagePoint(
    rotated,
    transform.imageWidth,
    transform.imageHeight,
    transform.rotation,
  );
}

export function polygonToScreen(polygon: Polygon, transform: ViewTransform): Polygon {
  return { points: polygon.points.map((point) => imageToScreen(point, transform)) };
}

export function pointInPolygon(point: Point, polygon: Polygon): boolean {
  let inside = false;
  for (
    let index = 0, previous = polygon.points.length - 1;
    index < polygon.points.length;
    index++
  ) {
    const currentPoint = polygon.points[index];
    const previousPoint = polygon.points[previous];
    const intersects =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y) +
          currentPoint.x;
    if (intersects) inside = !inside;
    previous = index;
  }
  return inside;
}
