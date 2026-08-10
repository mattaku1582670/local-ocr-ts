import eslint from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

const typeScriptFiles = ["**/*.{ts,tsx,mts,cts}"];

export default tseslint.config(
  {
    ignores: [
      "dist",
      "dist-electron",
      "release",
      "coverage",
      "poc",
      "public/assets/models",
      "public/assets/wasm",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked.map((config) => ({
    ...config,
    files: typeScriptFiles,
  })),
  {
    files: typeScriptFiles,
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.electron.json", "./tsconfig.preload.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  {
    files: ["electron/**/*.cts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
);
