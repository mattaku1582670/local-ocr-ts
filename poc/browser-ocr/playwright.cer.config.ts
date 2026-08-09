import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "cer-evaluation.spec.ts",
  timeout: 900_000,
  expect: {
    timeout: 180_000,
  },
  workers: 1,
});
