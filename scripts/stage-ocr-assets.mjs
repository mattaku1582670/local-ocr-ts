/* global console */

import { createHash } from "node:crypto";
import { access, copyFile, mkdir, readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const targetRoot = join(projectRoot, "public", "assets");
const models = [
  {
    fileName: "PP-OCRv5_mobile_det_onnx_infer.tar",
    sha256: "781056046c9ed77a15c94681605db6a0f62317c2e9cce6931c71da2478d4bc30",
  },
  {
    fileName: "PP-OCRv5_mobile_rec_onnx_infer.tar",
    sha256: "f7e792bc836f36e7ef895ad47c426d75b0b75b1650caa6d63fe9418441ffba8c",
  },
];
const modelSourceCandidates = [
  join(projectRoot, "models"),
  join(projectRoot, "poc", "browser-ocr", "public", "assets", "models"),
];

async function existingDirectory(candidates) {
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next documented local source.
    }
  }
  throw new Error(
    "OCR models are missing. Stage the documented PP-OCRv5 model archives under models/ first.",
  );
}

async function stageModels() {
  const source = await existingDirectory(modelSourceCandidates);
  const target = join(targetRoot, "models");
  await mkdir(target, { recursive: true });
  for (const model of models) {
    const sourcePath = join(source, model.fileName);
    const digest = createHash("sha256")
      .update(await readFile(sourcePath))
      .digest("hex");
    if (digest !== model.sha256) {
      throw new Error(`OCR model integrity check failed: ${model.fileName}`);
    }
    await copyFile(sourcePath, join(target, model.fileName));
  }
  return models.length;
}

async function stageWasm() {
  const source = join(projectRoot, "node_modules", "onnxruntime-web", "dist");
  const target = join(targetRoot, "wasm");
  const files = (await readdir(source)).filter((fileName) =>
    /^ort-wasm.*\.(mjs|wasm)$/u.test(fileName),
  );
  if (files.length === 0) throw new Error("ONNX Runtime Web WASM files are missing.");
  await mkdir(target, { recursive: true });
  await Promise.all(
    files.map((fileName) => copyFile(join(source, fileName), join(target, fileName))),
  );
  return files.length;
}

const [modelCount, wasmCount] = await Promise.all([stageModels(), stageWasm()]);
console.log(`Staged ${String(modelCount)} OCR models and ${String(wasmCount)} WASM assets.`);
