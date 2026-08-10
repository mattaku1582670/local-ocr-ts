import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_RENDERER_SETTINGS } from "../types/settings";
import { initialSettingsStoreState, type SettingsApi, useSettingsStore } from "./useSettingsStore";

function createApi(overrides: Partial<SettingsApi> = {}): SettingsApi {
  return {
    load: vi.fn().mockResolvedValue(DEFAULT_RENDERER_SETTINGS),
    save: vi.fn().mockImplementation((settings: unknown) => Promise.resolve(settings)),
    ...overrides,
  };
}

describe("useSettingsStore", () => {
  beforeEach(() => {
    useSettingsStore.setState({
      ...initialSettingsStoreState,
      settings: { ...DEFAULT_RENDERER_SETTINGS },
    });
  });

  it("hydrates validated settings through IPC", async () => {
    const settings = { ...DEFAULT_RENDERER_SETTINGS, language: "en" as const };
    const api = createApi({ load: vi.fn().mockResolvedValue(settings) });

    await useSettingsStore.getState().hydrate(api);

    expect(useSettingsStore.getState()).toMatchObject({ settings, status: "ready" });
  });

  it("rejects an invalid settings response", async () => {
    const api = createApi({ load: vi.fn().mockResolvedValue({ version: 99 }) });

    await useSettingsStore.getState().hydrate(api);

    expect(useSettingsStore.getState().status).toBe("error");
    expect(useSettingsStore.getState().settings).toEqual(DEFAULT_RENDERER_SETTINGS);
  });

  it("updates and saves settings through IPC", async () => {
    const api = createApi();
    useSettingsStore.getState().update({ autoOcrAfterPaste: true, language: "en" });

    const saved = await useSettingsStore.getState().save(api);

    expect(saved).toBe(true);
    expect(api.save).toHaveBeenCalledWith({
      ...DEFAULT_RENDERER_SETTINGS,
      autoOcrAfterPaste: true,
      language: "en",
    });
    expect(useSettingsStore.getState().status).toBe("ready");
  });

  it("resets settings to defaults and persists them", async () => {
    const api = createApi();
    useSettingsStore.getState().update({ loggingEnabled: false });

    const saved = await useSettingsStore.getState().reset(api);

    expect(saved).toBe(true);
    expect(api.save).toHaveBeenCalledWith(DEFAULT_RENDERER_SETTINGS);
    expect(useSettingsStore.getState().settings).toEqual(DEFAULT_RENDERER_SETTINGS);
  });
});
