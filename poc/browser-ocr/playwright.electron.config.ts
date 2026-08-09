import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "electron-ocr.spec.ts",
  timeout: 180_000,
  expect: {
    timeout: 180_000,
  },
  workers: 1,
});
