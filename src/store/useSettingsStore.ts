import { create } from "zustand";
import {
  DEFAULT_RENDERER_SETTINGS,
  rendererSettingsSchema,
  type Settings,
} from "../types/settings";

export interface SettingsApi {
  load: () => Promise<unknown>;
  save: (settings: unknown) => Promise<unknown>;
}

export type SettingsSyncStatus = "idle" | "loading" | "ready" | "saving" | "error";

export interface SettingsStoreState {
  settings: Settings;
  status: SettingsSyncStatus;
  errorMessage: string | null;
  hydrate: (api?: SettingsApi) => Promise<void>;
  update: (patch: Partial<Omit<Settings, "version">>) => void;
  save: (api?: SettingsApi) => Promise<boolean>;
  reset: (api?: SettingsApi) => Promise<boolean>;
}

export const initialSettingsStoreState = {
  settings: { ...DEFAULT_RENDERER_SETTINGS },
  status: "idle" as SettingsSyncStatus,
  errorMessage: null as string | null,
};

function resolveSettingsApi(api?: SettingsApi): SettingsApi | undefined {
  if (api) return api;
  if (typeof window === "undefined") return undefined;
  return (window as { desktopApi?: Window["desktopApi"] }).desktopApi?.settings;
}

export const useSettingsStore = create<SettingsStoreState>((set, get) => ({
  ...initialSettingsStoreState,
  hydrate: async (api) => {
    const settingsApi = resolveSettingsApi(api);
    if (!settingsApi) return;
    set({ status: "loading", errorMessage: null });
    try {
      const settings = rendererSettingsSchema.parse(await settingsApi.load());
      set({ settings, status: "ready" });
    } catch {
      set({ status: "error", errorMessage: "設定を読み込めませんでした。" });
    }
  },
  update: (patch) => {
    set((state) => ({ settings: { ...state.settings, ...patch } }));
  },
  save: async (api) => {
    const settingsApi = resolveSettingsApi(api);
    if (!settingsApi) return false;
    set({ status: "saving", errorMessage: null });
    try {
      const settings = rendererSettingsSchema.parse(await settingsApi.save(get().settings));
      set({ settings, status: "ready" });
      return true;
    } catch {
      set({ status: "error", errorMessage: "設定を保存できませんでした。" });
      return false;
    }
  },
  reset: async (api) => {
    set({ settings: { ...DEFAULT_RENDERER_SETTINGS } });
    return get().save(api);
  },
}));
