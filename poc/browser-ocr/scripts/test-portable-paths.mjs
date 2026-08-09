import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sha256 } from "./asset-utils.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const releaseDirectory = path.join(projectRoot, "release");
const sourceExecutable = await findPortableExecutable(releaseDirectory);
const sourceDetails = await stat(sourceExecutable);
const sourceHash = await sha256(sourceExecutable);
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "local-ocr-path-e2e-"));
const requestedCase = readRequestedCase(process.argv.slice(2));

assertTemporaryRootIsSafe(temporaryRoot);

try {
  if (requestedCase === null || requestedCase === "space") {
    await runPathCase("space", path.join(temporaryRoot, "path with spaces"));
  }
  if (requestedCase === null || requestedCase === "japanese") {
    await runPathCase("japanese", path.join(temporaryRoot, "日本語パス"));
  }
  process.stdout.write(
    requestedCase === null
      ? "Portable path tests passed for paths containing spaces and Japanese.\n"
      : `Portable ${requestedCase} path test passed.\n`,
  );
} finally {
  assertTemporaryRootIsSafe(temporaryRoot);
  await rm(temporaryRoot, { force: true, recursive: true });
}

async function runPathCase(caseName, destinationDirectory) {
  await mkdir(destinationDirectory, { recursive: true });
  const destinationExecutable = path.join(destinationDirectory, "Local OCR portable.exe");
  await copyFile(sourceExecutable, destinationExecutable);

  const copiedDetails = await stat(destinationExecutable);
  assert.equal(copiedDetails.size, sourceDetails.size, `PORTABLE_${caseName}_COPY_SIZE_MISMATCH`);
  assert.equal(
    await sha256(destinationExecutable),
    sourceHash,
    `PORTABLE_${caseName}_COPY_HASH_MISMATCH`,
  );

  await runPortableOcr(destinationExecutable);
  process.stdout.write(`Portable ${caseName} path passed: ${destinationDirectory}\n`);
}

async function runPortableOcr(executablePath) {
  const child = spawn(
    process.execPath,
    [path.join(scriptDirectory, "test-portable-ocr.mjs"), "--executable", executablePath],
    {
      env: {
        ...process.env,
        NO_PROXY: "127.0.0.1,localhost",
        no_proxy: "127.0.0.1,localhost",
      },
      stdio: "inherit",
      windowsHide: true,
    },
  );
  const exitCode = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (child.pid === undefined) {
        reject(new Error("PORTABLE_PATH_TEST_PID_MISSING"));
        return;
      }
      terminateProcessTree(child.pid)
        .then(() => reject(new Error(`PORTABLE_PATH_TEST_TIMEOUT: ${executablePath}`)))
        .catch(reject);
    }, 210_000);
    child.once("error", reject);
    child.once("exit", (code) => {
      clearTimeout(timeout);
      resolve(code);
    });
  });
  if (exitCode !== 0) {
    throw new Error(`PORTABLE_PATH_OCR_FAILED: ${executablePath} (${String(exitCode)})`);
  }
}

async function terminateProcessTree(processId) {
  await new Promise((resolve) => {
    execFile("taskkill.exe", ["/PID", String(processId), "/T", "/F"], () => resolve());
  });
}

async function findPortableExecutable(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const candidates = entries.filter(
    (entry) => entry.isFile() && entry.name.endsWith("-x64-portable.exe"),
  );
  if (candidates.length !== 1 || candidates[0] === undefined) {
    throw new Error(`PORTABLE_EXE_COUNT_INVALID: ${String(candidates.length)}`);
  }
  return path.join(directory, candidates[0].name);
}

function assertTemporaryRootIsSafe(candidatePath) {
  const resolvedTemporaryDirectory = path.resolve(os.tmpdir());
  const resolvedCandidate = path.resolve(candidatePath);
  const relativePath = path.relative(resolvedTemporaryDirectory, resolvedCandidate);
  if (
    relativePath === "" ||
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath) ||
    !path.basename(resolvedCandidate).startsWith("local-ocr-path-e2e-")
  ) {
    throw new Error(`PORTABLE_TEST_TEMP_PATH_UNSAFE: ${resolvedCandidate}`);
  }
}

function readRequestedCase(args) {
  const caseFlagIndex = args.indexOf("--case");
  if (caseFlagIndex === -1) {
    return null;
  }
  const requestedCase = args[caseFlagIndex + 1];
  if (requestedCase !== "space" && requestedCase !== "japanese") {
    throw new Error(`PORTABLE_PATH_CASE_INVALID: ${String(requestedCase)}`);
  }
  return requestedCase;
}
