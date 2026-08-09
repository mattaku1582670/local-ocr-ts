import { open, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sha256 } from "./asset-utils.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const releaseDirectory = path.join(projectRoot, "release");
const packagedOcrAssetsDirectory = path.join(
  releaseDirectory,
  "win-unpacked",
  "resources",
  "ocr-assets",
);
const packagedIntegrity = JSON.parse(
  await readFile(path.join(packagedOcrAssetsDirectory, ".asset-integrity.json"), "utf8"),
);

for (const asset of packagedIntegrity.assets) {
  const assetPath = path.join(packagedOcrAssetsDirectory, ...asset.path.split("/"));
  const assetDetails = await stat(assetPath);
  const assetHash = await sha256(assetPath);
  if (assetDetails.size !== asset.bytes || assetHash !== asset.sha256) {
    throw new Error(`PORTABLE_OCR_ASSET_INTEGRITY_FAILED: ${asset.path}`);
  }
}

const releaseEntries = await readdir(releaseDirectory, { withFileTypes: true });
const portableExecutables = releaseEntries.filter(
  (entry) => entry.isFile() && entry.name.endsWith("-x64-portable.exe"),
);

if (portableExecutables.length !== 1) {
  throw new Error(`PORTABLE_EXE_COUNT_INVALID: ${String(portableExecutables.length)}`);
}

const portableExecutable = portableExecutables[0];
if (portableExecutable === undefined) {
  throw new Error("PORTABLE_EXE_MISSING");
}

const executablePath = path.join(releaseDirectory, portableExecutable.name);
const executableDetails = await stat(executablePath);
const executableHeader = Buffer.alloc(2);
const executableHandle = await open(executablePath, "r");
try {
  await executableHandle.read(executableHeader, 0, executableHeader.length, 0);
} finally {
  await executableHandle.close();
}
if (executableHeader[0] !== 0x4d || executableHeader[1] !== 0x5a) {
  throw new Error("PORTABLE_EXE_INVALID_PE_HEADER");
}
if (executableDetails.size < 1_000_000) {
  throw new Error(`PORTABLE_EXE_UNEXPECTED_SIZE: ${String(executableDetails.size)}`);
}

const executableHash = (await sha256(executablePath)).toLowerCase();
const checksumLine = `${executableHash} *${portableExecutable.name}\r\n`;
await writeFile(path.join(releaseDirectory, "SHA256SUMS.txt"), checksumLine, "utf8");

process.stdout.write(
  `Verified portable PE ${portableExecutable.name} (${String(executableDetails.size)} bytes, SHA-256 ${executableHash}) and ${String(packagedIntegrity.assets.length)} OCR resources.\n`,
);
