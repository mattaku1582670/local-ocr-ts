import { useEffect, type PropsWithChildren } from "react";
import { useSettingsStore } from "../store/useSettingsStore";

export function AppProviders({ children }: PropsWithChildren) {
  const hydrateSettings = useSettingsStore((state) => state.hydrate);

  useEffect(() => {
    if (typeof window.desktopApi === "object") void hydrateSettings();
  }, [hydrateSettings]);

  return children;
}
