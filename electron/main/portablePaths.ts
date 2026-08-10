import type { App } from "electron";
import { constants } from "node:fs";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

export type RuntimeMode = "development" | "packaged" | "portable";
export type DataDirectorySource = "development" | "portable" | "executable" | "userData";

export interface RuntimePathContext {
  applicationDirectory: string;
  executablePath: string;
  isPackaged: boolean;
  portableExecutableDirectory?: string;
  userDataDirectory: string;
}

export interface DataDirectoryCandidate {
  path: string;
  source: DataDirectorySource;
}

export interface ResolvedDataDirectory extends DataDirectoryCandidate {
  mode: RuntimeMode;
}

export type DirectoryWriteProbe = (directoryPath: string) => Promise<boolean>;

function nonEmpty(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? resolve(normalized) : undefined;
}

export function createRuntimePathContext(
  app: Pick<App, "getAppPath" | "getPath" | "isPackaged">,
  environment: NodeJS.ProcessEnv = process.env,
): RuntimePathContext {
  const portableDirectory =
    nonEmpty(environment.PORTABLE_EXECUTABLE_DIR) ??
    (nonEmpty(environment.PORTABLE_EXECUTABLE_FILE)
      ? dirname(resolve(environment.PORTABLE_EXECUTABLE_FILE as string))
      : undefined);

  return {
    applicationDirectory: resolve(app.getAppPath()),
    executablePath: resolve(app.getPath("exe")),
    isPackaged: app.isPackaged,
    ...(portableDirectory ? { portableExecutableDirectory: portableDirectory } : {}),
    userDataDirectory: resolve(app.getPath("userData")),
  };
}

export function detectRuntimeMode(context: RuntimePathContext): RuntimeMode {
  if (!context.isPackaged) return "development";
  return context.portableExecutableDirectory ? "portable" : "packaged";
}

export function createDataDirectoryCandidates(
  context: RuntimePathContext,
): DataDirectoryCandidate[] {
  const candidates: DataDirectoryCandidate[] = [];
  const add = (source: DataDirectorySource, directoryPath: string): void => {
    const path = resolve(directoryPath);
    const duplicate = candidates.some(
      (candidate) => candidate.path.toLocaleLowerCase("en-US") === path.toLocaleLowerCase("en-US"),
    );
    if (!duplicate) candidates.push({ path, source });
  };

  if (!context.isPackaged) add("development", join(context.applicationDirectory, "data"));
  if (context.portableExecutableDirectory) {
    add("portable", join(context.portableExecutableDirectory, "data"));
  }
  if (context.isPackaged) add("executable", join(dirname(context.executablePath), "data"));
  add("userData", context.userDataDirectory);

  return candidates;
}

export const probeDirectoryWritable: DirectoryWriteProbe = async (directoryPath) => {
  const probePath = join(
    directoryPath,
    `.local-ocr-write-test-${process.pid.toString()}-${randomUUID()}`,
  );
  try {
    await mkdir(directoryPath, { recursive: true });
    await access(directoryPath, constants.W_OK);
    await writeFile(probePath, "", { flag: "wx" });
    return true;
  } catch {
    return false;
  } finally {
    await rm(probePath, { force: true }).catch(() => undefined);
  }
};

export async function resolveDataDirectory(
  context: RuntimePathContext,
  probe: DirectoryWriteProbe = probeDirectoryWritable,
): Promise<ResolvedDataDirectory> {
  for (const candidate of createDataDirectoryCandidates(context)) {
    if (await probe(candidate.path)) {
      return { ...candidate, mode: detectRuntimeMode(context) };
    }
  }
  throw new Error("No writable Local OCR data directory is available");
}
