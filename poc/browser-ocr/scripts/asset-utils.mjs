import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export async function sha256(filePath) {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex").toUpperCase();
}

export async function loadAssetConfig(projectRoot) {
  const path = new URL("./config/model-assets.json", pathToDirectoryUrl(projectRoot));
  return JSON.parse(await readFile(path, "utf8"));
}

export function pathToDirectoryUrl(path) {
  const normalized = path.replaceAll("\\", "/");
  const suffix = normalized.endsWith("/") ? "" : "/";
  return new URL(`file:///${normalized}${suffix}`);
}
