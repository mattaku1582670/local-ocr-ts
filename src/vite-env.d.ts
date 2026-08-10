/// <reference types="vite/client" />

declare module "@heroui/react/styles";

interface ImportMetaEnv {
  readonly VITE_APP_ENV: "development" | "production" | "test";
  readonly VITE_LOG_LEVEL: "debug" | "info" | "warn" | "error";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
