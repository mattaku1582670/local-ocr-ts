import { create } from "zustand";

interface AppState {
  completedRuns: number;
  recordCompletedRun: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  completedRuns: 0,
  recordCompletedRun: () => {
    set((state) => ({ completedRuns: state.completedRuns + 1 }));
  },
}));
