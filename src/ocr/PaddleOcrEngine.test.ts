import { describe, expect, it, vi } from "vitest";
import type { NormalizedOcrResult, OcrInitOptions } from "./OcrEngine";
import { OcrCancelledError } from "./OcrEngine";
import { PaddleOcrEngine, type OcrWorkerLike } from "./PaddleOcrEngine";
import type { OcrWorkerRequest, OcrWorkerResponse } from "./workerMessages";

const initOptions: OcrInitOptions = {
  language: "ja",
  assets: {
    detectionModelUrl: "http://127.0.0.1/assets/models/det.tar",
    recognitionModelUrl: "http://127.0.0.1/assets/models/rec.tar",
    wasmBaseUrl: "http://127.0.0.1/assets/wasm/",
  },
};

const normalizedResult: NormalizedOcrResult = {
  rawText: "認識結果",
  blocks: [],
  durationMs: 20,
  image: { width: 100, height: 50 },
  runtime: {
    requestedBackend: "wasm",
    detectionProvider: "wasm",
    recognitionProvider: "wasm",
    executionMode: "worker",
  },
};

class FakeWorker implements OcrWorkerLike {
  onmessage: ((event: MessageEvent<OcrWorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly messages: OcrWorkerRequest[] = [];
  terminated = false;
  respondToRecognition = true;

  postMessage(message: OcrWorkerRequest): void {
    this.messages.push(message);
    if (message.type === "INITIALIZE") {
      queueMicrotask(() => {
        this.emit({ type: "READY", requestId: message.requestId });
      });
    }
    if (message.type === "RECOGNIZE" && this.respondToRecognition) {
      queueMicrotask(() => {
        this.emit({
          type: "PROGRESS",
          requestId: message.requestId,
          progress: { stage: "recognizing", percent: 60 },
        });
        this.emit({ type: "RESULT", requestId: message.requestId, result: normalizedResult });
      });
    }
    if (message.type === "DISPOSE") {
      queueMicrotask(() => {
        this.emit({ type: "DISPOSED", requestId: message.requestId });
      });
    }
  }

  terminate(): void {
    this.terminated = true;
  }

  crash(message = "worker crashed"): void {
    this.onerror?.({ message } as ErrorEvent);
  }

  private emit(response: OcrWorkerResponse): void {
    this.onmessage?.({ data: response } as MessageEvent<OcrWorkerResponse>);
  }
}

function engineFixture() {
  const workers: FakeWorker[] = [];
  const engine = new PaddleOcrEngine(() => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker;
  });
  return { engine, workers };
}

describe("PaddleOcrEngine", () => {
  it("initializes a Worker and reports capabilities", async () => {
    const { engine, workers } = engineFixture();

    await engine.initialize(initOptions);

    expect(workers).toHaveLength(1);
    expect(workers[0]?.messages[0]).toMatchObject({ type: "INITIALIZE", options: initOptions });
    expect(engine.getCapabilities()).toEqual({
      fullImage: true,
      polygons: true,
      confidence: true,
      cancellationDuringInference: true,
    });
  });

  it("transfers recognition work and forwards progress", async () => {
    const { engine, workers } = engineFixture();
    const onProgress = vi.fn();
    await engine.initialize(initOptions);

    const result = await engine.recognize({} as ImageBitmap, {
      minimumConfidence: 0.5,
      preprocessPreset: "document",
      maxPixels: 2_000_000,
      onProgress,
    });

    expect(result).toEqual(normalizedResult);
    expect(onProgress).toHaveBeenNthCalledWith(1, { stage: "queued", percent: 0 });
    expect(onProgress).toHaveBeenNthCalledWith(2, { stage: "recognizing", percent: 60 });
    expect(workers[0]?.messages[1]).toMatchObject({
      type: "RECOGNIZE",
      minimumConfidence: 0.5,
      preprocessPreset: "document",
      maxPixels: 2_000_000,
    });
  });

  it("terminates inference on abort and reinitializes a fresh Worker", async () => {
    const { engine, workers } = engineFixture();
    await engine.initialize(initOptions);
    const firstWorker = workers[0];
    firstWorker.respondToRecognition = false;
    const controller = new AbortController();

    const recognition = engine.recognize(
      {} as ImageBitmap,
      { minimumConfidence: 0 },
      controller.signal,
    );
    controller.abort();

    await expect(recognition).rejects.toBeInstanceOf(OcrCancelledError);
    expect(firstWorker.terminated).toBe(true);
    await vi.waitFor(() => {
      expect(workers).toHaveLength(2);
    });
  });

  it("rejects an already-aborted request without transferring its bitmap", async () => {
    const { engine, workers } = engineFixture();
    await engine.initialize(initOptions);
    const controller = new AbortController();
    controller.abort();

    await expect(
      engine.recognize({} as ImageBitmap, { minimumConfidence: 0 }, controller.signal),
    ).rejects.toBeInstanceOf(OcrCancelledError);
    expect(workers[0]?.messages).toHaveLength(1);
  });

  it("rejects crashed work and restores a ready Worker once", async () => {
    const { engine, workers } = engineFixture();
    await engine.initialize(initOptions);
    const firstWorker = workers[0];
    firstWorker.respondToRecognition = false;
    const recognition = engine.recognize({} as ImageBitmap, { minimumConfidence: 0 });

    firstWorker.crash();

    await expect(recognition).rejects.toThrow("worker crashed");
    await vi.waitFor(() => {
      expect(workers).toHaveLength(2);
    });
    expect(firstWorker.terminated).toBe(true);
  });

  it("disposes Worker resources idempotently", async () => {
    const { engine, workers } = engineFixture();
    await engine.initialize(initOptions);

    await engine.dispose();
    await engine.dispose();

    expect(workers[0]?.messages.at(-1)).toMatchObject({ type: "DISPOSE" });
    expect(workers[0]?.terminated).toBe(true);
  });
});
