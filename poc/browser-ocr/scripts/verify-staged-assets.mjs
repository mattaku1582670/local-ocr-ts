import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadAssetConfig, sha256 } from "./asset-utils.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const config = await loadAssetConfig(projectRoot);
const publicAssets = path.join(projectRoot, "public", "assets");
const integrityPath = path.join(publicAssets, ".asset-integrity.json");
const integrity = JSON.parse(await readFile(integrityPath, "utf8"));

if (integrity.onnxRuntimeWebVersion !== config.onnxRuntimeWeb.version) {
  throw new Error("ORT_VERSION_MISMATCH");
}

for (const model of config.models) {
  const filePath = path.join(publicAssets, "models", model.fileName);
  const actualHash = await sha256(filePath);
  if (actualHash !== model.sha256) {
    throw new Error(`ASSET_HASH_MISMATCH: ${model.fileName}`);
  }
}

const wasmAssets = integrity.assets.filter((asset) => asset.path.startsWith("wasm/"));
if (
  !wasmAssets.some((asset) => asset.path.endsWith(".wasm")) ||
  !wasmAssets.some((asset) => asset.path.endsWith(".mjs"))
) {
  throw new Error("ORT_WASM_ASSET_SET_INCOMPLETE");
}

for (const asset of integrity.assets) {
  const filePath = path.join(publicAssets, ...asset.path.split("/"));
  const details = await stat(filePath);
  const actualHash = await sha256(filePath);
  if (details.size !== asset.bytes || actualHash !== asset.sha256) {
    throw new Error(`STAGED_ASSET_INTEGRITY_FAILED: ${asset.path}`);
  }
}

process.stdout.write(`Verified ${String(integrity.assets.length)} staged local OCR assets.\n`);
