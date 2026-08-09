import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadAssetConfig, sha256 } from "./asset-utils.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const distDirectory = path.join(projectRoot, "dist");
const distAssets = path.join(distDirectory, "assets");
const integrityPath = path.join(distAssets, ".asset-integrity.json");
const integrity = JSON.parse(await readFile(integrityPath, "utf8"));
const config = await loadAssetConfig(projectRoot);

if (integrity.onnxRuntimeWebVersion !== config.onnxRuntimeWeb.version) {
  throw new Error("BUILT_ORT_VERSION_MISMATCH");
}

for (const asset of integrity.assets) {
  const filePath = path.join(distAssets, ...asset.path.split("/"));
  const details = await stat(filePath);
  const actualHash = await sha256(filePath);
  if (details.size !== asset.bytes || actualHash !== asset.sha256) {
    throw new Error(`BUILT_ASSET_INTEGRITY_FAILED: ${asset.path}`);
  }
}

for (const model of config.models) {
  const manifestEntry = integrity.assets.find((asset) => asset.path === `models/${model.fileName}`);
  if (manifestEntry?.sha256 !== model.sha256) {
    throw new Error(`BUILT_MODEL_HASH_MISMATCH: ${model.fileName}`);
  }
}

const wasmAssets = integrity.assets.filter((asset) => asset.path.startsWith("wasm/"));
if (
  !wasmAssets.some((asset) => asset.path.endsWith(".mjs")) ||
  !wasmAssets.some((asset) => asset.path.endsWith(".wasm"))
) {
  throw new Error("BUILT_WASM_ASSET_SET_INCOMPLETE");
}

const assetFileNames = await readdir(distAssets);
const workerEntries = assetFileNames.filter(
  (fileName) => fileName.startsWith("worker-entry-") && fileName.endsWith(".js"),
);
if (workerEntries.length !== 1) {
  throw new Error(`BUILT_WORKER_ENTRY_COUNT_INVALID: ${String(workerEntries.length)}`);
}

const indexHtml = await readFile(path.join(distDirectory, "index.html"), "utf8");
for (const match of indexHtml.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)) {
  const reference = match[1];
  if (isExternalReference(reference)) {
    throw new Error(`BUILT_HTML_EXTERNAL_REFERENCE: ${reference}`);
  }
}

const cssFiles = assetFileNames.filter((fileName) => fileName.endsWith(".css"));
for (const cssFile of cssFiles) {
  const css = await readFile(path.join(distAssets, cssFile), "utf8");
  if (/url\(\s*["']?(?:https?:)?\/\//i.test(css)) {
    throw new Error(`BUILT_CSS_EXTERNAL_REFERENCE: ${cssFile}`);
  }
}

const jsFiles = assetFileNames.filter((fileName) => fileName.endsWith(".js"));
const jsContents = await Promise.all(
  jsFiles.map(async (fileName) => readFile(path.join(distAssets, fileName), "utf8")),
);
const combinedJavaScript = jsContents.join("\n");
if (!combinedJavaScript.includes("assets/models/")) {
  throw new Error("BUILT_MODEL_BASE_URL_MISSING");
}
for (const model of config.models) {
  if (!combinedJavaScript.includes(model.fileName)) {
    throw new Error(`BUILT_MODEL_LOCAL_REFERENCE_MISSING: ${model.fileName}`);
  }
}
if (!combinedJavaScript.includes("assets/wasm/")) {
  throw new Error("BUILT_WASM_LOCAL_REFERENCE_MISSING");
}
if (!combinedJavaScript.includes(workerEntries[0])) {
  throw new Error("BUILT_WORKER_LOCAL_REFERENCE_MISSING");
}

const remoteUrlLiterals = new Set(
  Array.from(combinedJavaScript.matchAll(/https?:\/\/[^\s"'`<>\\)]+/g), (match) => match[0]),
);

process.stdout.write(
  `Verified ${String(integrity.assets.length)} bundled local OCR assets and ${String(
    workerEntries.length,
  )} worker entry.\n`,
);
if (remoteUrlLiterals.size > 0) {
  process.stdout.write(
    `NOTICE: found ${String(
      remoteUrlLiterals.size,
    )} remote URL literal(s) in bundled dependency code; runtime request isolation must remain enforced.\n`,
  );
}

function isExternalReference(reference) {
  return /^(?:https?:)?\/\//i.test(reference.trim());
}
