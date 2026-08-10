import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: false,
    outDir: "dist-electron",
    sourcemap: false,
    minify: false,
    lib: {
      entry: resolve("electron/preload/index.cts"),
      formats: ["cjs"],
      fileName: () => "preload/index.cjs",
    },
    rollupOptions: {
      external: ["electron"],
    },
  },
});
