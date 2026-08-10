import type { OcrAssetLocations } from "./OcrEngine";

export const DETECTION_MODEL_FILE = "PP-OCRv5_mobile_det_onnx_infer.tar";
export const RECOGNITION_MODEL_FILE = "PP-OCRv5_mobile_rec_onnx_infer.tar";

export function resolveOcrAssetLocations(baseUrl: string): OcrAssetLocations {
  const assetsRoot = new URL("assets/", baseUrl);
  return {
    detectionModelUrl: new URL(`models/${DETECTION_MODEL_FILE}`, assetsRoot).href,
    recognitionModelUrl: new URL(`models/${RECOGNITION_MODEL_FILE}`, assetsRoot).href,
    wasmBaseUrl: new URL("wasm/", assetsRoot).href,
  };
}

export function assertLocalOcrAssetLocations(
  locations: OcrAssetLocations,
  applicationBaseUrl: string,
): void {
  const base = new URL(applicationBaseUrl);
  for (const value of [
    locations.detectionModelUrl,
    locations.recognitionModelUrl,
    locations.wasmBaseUrl,
  ]) {
    const asset = new URL(value);
    if (
      asset.protocol !== base.protocol ||
      asset.origin !== base.origin ||
      asset.host !== base.host
    ) {
      throw new Error("OCR資産はアプリと同一originのローカルURLである必要があります。");
    }
  }
}
