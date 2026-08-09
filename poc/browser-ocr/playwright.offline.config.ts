import { defineConfig } from "@playwright/test";

const LOCAL_HOST = "127.0.0.1";
const LOCAL_PORT = 4174;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "offline-ocr.spec.ts",
  timeout: 180_000,
  expect: {
    timeout: 180_000,
  },
  use: {
    baseURL: `http://${LOCAL_HOST}:${String(LOCAL_PORT)}`,
    browserName: "chromium",
    channel: "msedge",
    headless: true,
    launchOptions: {
      args: [
        "--disable-background-networking",
        `--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE ${LOCAL_HOST}`,
      ],
    },
  },
  webServer: {
    command: `node ./node_modules/vite/bin/vite.js preview --host ${LOCAL_HOST} --port ${String(LOCAL_PORT)}`,
    url: `http://${LOCAL_HOST}:${String(LOCAL_PORT)}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
