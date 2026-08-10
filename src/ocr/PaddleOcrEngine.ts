import {
  OcrCancelledError,
  type NormalizedOcrResult,
  type OcrCapabilities,
  type OcrEngine,
  type OcrInitOptions,
  type OcrProgressEvent,
  type OcrRecognizeOptions,
} from "./OcrEngine";
import {
  deserializeWorkerError,
  type OcrWorkerRequest,
  type OcrWorkerResponse,
} from "./workerMessages";

export interface OcrWorkerLike {
  onmessage: ((event: MessageEvent<OcrWorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage: (message: OcrWorkerRequest, transfer: Transferable[]) => void;
  terminate: () => void;
}

export type OcrWorkerFactory = () => OcrWorkerLike;

interface PendingRequest<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  onProgress?: (progress: OcrProgressEvent) => void;
}

type EngineStatus = "idle" | "initializing" | "ready" | "disposed";

const defaultWorkerFactory: OcrWorkerFactory = () =>
  new Worker(new URL("./paddleOcr.worker.ts", import.meta.url), { type: "module" });

export class PaddleOcrEngine implements OcrEngine {
  private worker: OcrWorkerLike | null = null;
  private readonly pending = new Map<number, PendingRequest<unknown>>();
  private nextRequestId = 1;
  private status: EngineStatus = "idle";
  private initOptions: OcrInitOptions | null = null;
  private initialization: Promise<void> | null = null;
  private recoveryAttempted = false;

  constructor(private readonly workerFactory: OcrWorkerFactory = defaultWorkerFactory) {}

  async initialize(options: OcrInitOptions): Promise<void> {
    if (this.status === "disposed") throw new Error("OCR_ENGINE_DISPOSED");
    if (this.status === "ready") return;
    if (this.initialization) return this.initialization;
    this.initOptions = options;
    this.status = "initializing";
    const requestId = this.allocateRequestId();
    this.initialization = this.request<undefined>({ type: "INITIALIZE", requestId, options })
      .then(() => {
        this.status = "ready";
        this.recoveryAttempted = false;
      })
      .catch((error: unknown) => {
        this.status = "idle";
        this.stopWorker(error instanceof Error ? error : new Error("OCR_INITIALIZATION_FAILED"));
        throw error;
      })
      .finally(() => {
        this.initialization = null;
      });
    return this.initialization;
  }

  async recognize(
    image: ImageBitmap,
    options: OcrRecognizeOptions,
    signal?: AbortSignal,
  ): Promise<NormalizedOcrResult> {
    if (signal?.aborted) throw new OcrCancelledError();
    if (this.status !== "ready") {
      if (!this.initOptions) throw new Error("OCR_ENGINE_NOT_INITIALIZED");
      await this.initialize(this.initOptions);
    }
    if (signal?.aborted) throw new OcrCancelledError();
    options.onProgress?.({ stage: "queued", percent: 0 });
    const requestId = this.allocateRequestId();
    const abort = () => {
      this.status = "idle";
      this.stopWorker(new OcrCancelledError());
      this.scheduleRecovery();
    };
    signal?.addEventListener("abort", abort, { once: true });
    try {
      return await this.request<NormalizedOcrResult>(
        {
          type: "RECOGNIZE",
          requestId,
          image,
          minimumConfidence: options.minimumConfidence,
        },
        [image],
        options.onProgress,
      );
    } finally {
      signal?.removeEventListener("abort", abort);
    }
  }

  async dispose(): Promise<void> {
    if (this.status === "disposed") return;
    const worker = this.worker;
    if (worker) {
      const requestId = this.allocateRequestId();
      try {
        await this.request<undefined>({ type: "DISPOSE", requestId });
      } finally {
        worker.terminate();
      }
    }
    this.worker = null;
    this.status = "disposed";
    this.rejectPending(new Error("OCR_ENGINE_DISPOSED"));
  }

  getCapabilities(): OcrCapabilities {
    return {
      fullImage: true,
      polygons: true,
      confidence: true,
      cancellationDuringInference: true,
    };
  }

  private allocateRequestId(): number {
    const requestId = this.nextRequestId;
    this.nextRequestId += 1;
    return requestId;
  }

  private ensureWorker(): OcrWorkerLike {
    if (this.worker) return this.worker;
    const worker = this.workerFactory();
    worker.onmessage = (event) => {
      this.handleMessage(event.data);
    };
    worker.onerror = (event) => {
      this.status = "idle";
      this.stopWorker(new Error(event.message || "OCR_WORKER_CRASHED"));
      this.scheduleRecovery();
    };
    this.worker = worker;
    return worker;
  }

  private request<T>(
    message: OcrWorkerRequest,
    transfer: Transferable[] = [],
    onProgress?: (progress: OcrProgressEvent) => void,
  ): Promise<T> {
    const worker = this.ensureWorker();
    return new Promise<T>((resolve, reject) => {
      const pending: PendingRequest<T> = {
        resolve,
        reject,
        ...(onProgress ? { onProgress } : {}),
      };
      this.pending.set(message.requestId, pending as PendingRequest<unknown>);
      try {
        worker.postMessage(message, transfer);
      } catch (error) {
        this.pending.delete(message.requestId);
        reject(error instanceof Error ? error : new Error("OCR_WORKER_POST_FAILED"));
      }
    });
  }

  private handleMessage(message: OcrWorkerResponse): void {
    const pending = this.pending.get(message.requestId);
    if (!pending) return;
    if (message.type === "PROGRESS") {
      pending.onProgress?.(message.progress);
      return;
    }
    this.pending.delete(message.requestId);
    if (message.type === "ERROR") {
      pending.reject(deserializeWorkerError(message.error));
      return;
    }
    if (message.type === "RESULT") {
      pending.resolve(message.result);
      return;
    }
    pending.resolve(undefined);
  }

  private rejectPending(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }

  private stopWorker(error: Error): void {
    const worker = this.worker;
    this.worker = null;
    worker?.terminate();
    this.rejectPending(error);
  }

  private scheduleRecovery(): void {
    if (!this.initOptions || this.status === "disposed" || this.recoveryAttempted) return;
    this.recoveryAttempted = true;
    const options = this.initOptions;
    queueMicrotask(() => {
      void this.initialize(options).catch(() => undefined);
    });
  }
}
