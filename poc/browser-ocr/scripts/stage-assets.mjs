import { copyFile, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadAssetConfig, sha256 } from "./asset-utils.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const modelDirectory = readModelDirectory(process.argv.slice(2));
const config = await loadAssetConfig(projectRoot);
const publicAssets = path.join(projectRoot, "public", "assets");
const targetModelDirectory = path.join(publicAssets, "models");
const targetWasmDirectory = path.join(publicAssets, "wasm");

await mkdir(targetModelDirectory, { recursive: true });
await mkdir(targetWasmDirectory, { recursive: true });

const staged = [];
for (const model of config.models) {
  const sourcePath = path.join(modelDirectory, model.fileName);
  const actualHash = await sha256(sourcePath);
  if (actualHash !== model.sha256) {
    throw new Error(
      `ASSET_HASH_MISMATCH: ${model.fileName} expected ${model.sha256}, received ${actualHash}`,
    );
  }

  const destination = path.join(targetModelDirectory, model.fileName);
  await copyFile(sourcePath, destination);
  staged.push(await describeAsset(destination, path.join("models", model.fileName)));
}

const ortDist = path.join(projectRoot, "node_modules", "onnxruntime-web", "dist");
const wasmPattern = new RegExp(config.onnxRuntimeWeb.filePattern);
const wasmFiles = (await readdir(ortDist)).filter((fileName) => wasmPattern.test(fileName));
if (wasmFiles.length === 0) {
  throw new Error("ORT_WASM_ASSETS_NOT_FOUND");
}

for (const fileName of wasmFiles) {
  const sourcePath = path.join(ortDist, fileName);
  const destination = path.join(targetWasmDirectory, fileName);
  await copyFile(sourcePath, destination);
  staged.push(await describeAsset(destination, path.join("wasm", fileName)));
}

const integrityPath = path.join(publicAssets, ".asset-integrity.json");
await writeFile(
  integrityPath,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      onnxRuntimeWebVersion: config.onnxRuntimeWeb.version,
      assets: staged,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

process.stdout.write(`Staged and verified ${String(staged.length)} local OCR assets.\n`);

function readModelDirectory(args) {
  const optionIndex = args.indexOf("--model-dir");
  const value = optionIndex >= 0 ? args[optionIndex + 1] : undefined;
  if (value === undefined || value.startsWith("--")) {
    throw new Error("MODEL_DIRECTORY_REQUIRED: use --model-dir <directory>");
  }
  return path.resolve(value);
}

async function describeAsset(filePath, relativePath) {
  const details = await stat(filePath);
  return {
    path: relativePath.replaceAll("\\", "/"),
    bytes: details.size,
    sha256: await sha256(filePath),
  };
}
