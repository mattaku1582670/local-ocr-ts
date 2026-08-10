import { useEffect, type PropsWithChildren } from "react";
import { assertLocalOcrAssetLocations, resolveOcrAssetLocations } from "../ocr/assets";
import { createOcrEngine } from "../ocr/OcrEngineFactory";
import { useOcrStore } from "../store/useOcrStore";
import { useSettingsStore } from "../store/useSettingsStore";

export function AppProviders({ children }: PropsWithChildren) {
  const hydrateSettings = useSettingsStore((state) => state.hydrate);
  const language = useSettingsStore((state) => state.settings.language);
  const settingsStatus = useSettingsStore((state) => state.status);
  const setEngineStatus = useOcrStore((state) => state.setEngineStatus);

  useEffect(() => {
    if (typeof window.desktopApi === "object") void hydrateSettings();
  }, [hydrateSettings]);

  useEffect(() => {
    if (typeof Worker !== "function") return;
    if (
      typeof window.desktopApi === "object" &&
      settingsStatus !== "ready" &&
      settingsStatus !== "error"
    ) {
      return;
    }

    const engine = createOcrEngine("paddle-wasm");
    const assets = resolveOcrAssetLocations(document.baseURI);
    let active = true;
    assertLocalOcrAssetLocations(assets, document.baseURI);
    setEngineStatus("initializing");
    void engine
      .initialize({ assets, language })
      .then(() => {
        if (active) setEngineStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setEngineStatus("error", {
          code: "OCR_INITIALIZATION_FAILED",
          message: "OCRエンジンを初期化できませんでした。ローカル資産を確認してください。",
          recoverable: true,
        });
      });

    return () => {
      active = false;
      void engine.dispose();
    };
  }, [language, setEngineStatus, settingsStatus]);

  return children;
}
