import { create } from "zustand";
import type { AppError } from "../types/errors";

export type OcrEngineStatus = "idle" | "initializing" | "ready" | "error";
export type OcrProgressStage =
  "queued" | "preprocessing" | "detecting" | "recognizing" | "complete";

export interface OcrProgress {
  percent: number;
  stage: OcrProgressStage;
}

export interface OcrStoreState {
  engineStatus: OcrEngineStatus;
  engineError: AppError | null;
  queue: string[];
  activeImageId: string | null;
  progressByImageId: Record<string, OcrProgress>;
  setEngineStatus: (status: OcrEngineStatus, error?: AppError) => void;
  enqueue: (imageId: string) => void;
  enqueueMany: (imageIds: string[]) => void;
  startNext: () => string | null;
  setProgress: (imageId: string, progress: OcrProgress) => void;
  completeActive: () => void;
  cancel: (imageId: string) => void;
  reset: () => void;
}

export const initialOcrStoreState = {
  engineStatus: "idle" as OcrEngineStatus,
  engineError: null as AppError | null,
  queue: [] as string[],
  activeImageId: null as string | null,
  progressByImageId: {} as Record<string, OcrProgress>,
};

export const useOcrStore = create<OcrStoreState>((set, get) => {
  const enqueueMany = (imageIds: string[]): void => {
    const state = get();
    const knownIds = new Set([state.activeImageId, ...state.queue]);
    const additions: string[] = [];
    for (const id of imageIds) {
      if (id.length === 0 || knownIds.has(id)) continue;
      knownIds.add(id);
      additions.push(id);
    }
    if (additions.length === 0) return;
    set((current) => {
      const progressByImageId = { ...current.progressByImageId };
      for (const id of additions) {
        progressByImageId[id] = { percent: 0, stage: "queued" };
      }
      return {
        queue: [...current.queue, ...additions],
        progressByImageId,
      };
    });
  };

  return {
    ...initialOcrStoreState,
    setEngineStatus: (engineStatus, error) => {
      set({ engineStatus, engineError: error ?? null });
    },
    enqueue: (imageId) => {
      enqueueMany([imageId]);
    },
    enqueueMany,
    startNext: () => {
      const state = get();
      if (state.activeImageId || state.queue.length === 0) return null;
      const [activeImageId, ...queue] = state.queue;
      if (!activeImageId) return null;
      set({ activeImageId, queue });
      return activeImageId;
    },
    setProgress: (imageId, progress) => {
      const percent = Math.min(100, Math.max(0, progress.percent));
      set((state) => ({
        progressByImageId: {
          ...state.progressByImageId,
          [imageId]: { ...progress, percent },
        },
      }));
    },
    completeActive: () => {
      const activeImageId = get().activeImageId;
      if (!activeImageId) return;
      set((state) => ({
        activeImageId: null,
        progressByImageId: {
          ...state.progressByImageId,
          [activeImageId]: { percent: 100, stage: "complete" },
        },
      }));
    },
    cancel: (imageId) => {
      set((state) => {
        const progressByImageId = Object.fromEntries(
          Object.entries(state.progressByImageId).filter(([id]) => id !== imageId),
        );
        return {
          activeImageId: state.activeImageId === imageId ? null : state.activeImageId,
          queue: state.queue.filter((id) => id !== imageId),
          progressByImageId,
        };
      });
    },
    reset: () => {
      set({ ...initialOcrStoreState });
    },
  };
});
