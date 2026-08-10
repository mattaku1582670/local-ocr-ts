import type { OcrEngine } from "./OcrEngine";
import { PaddleOcrEngine, type OcrWorkerFactory } from "./PaddleOcrEngine";

export type OcrEngineKind = "paddle-wasm";

export interface OcrEngineFactoryOptions {
  workerFactory?: OcrWorkerFactory;
}

export function createOcrEngine(
  kind: OcrEngineKind,
  options: OcrEngineFactoryOptions = {},
): OcrEngine {
  const factories: Record<OcrEngineKind, () => OcrEngine> = {
    "paddle-wasm": () => new PaddleOcrEngine(options.workerFactory),
  };
  return factories[kind]();
}
