// @vitest-environment node
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  createDataDirectoryCandidates,
  createRuntimePathContext,
  detectRuntimeMode,
  resolveDataDirectory,
  type RuntimePathContext,
} from "./portablePaths.js";

const packagedContext: RuntimePathContext = {
  applicationDirectory: "C:\\Temp\\app.asar",
  executablePath: "C:\\Temp\\LocalOCR\\LocalOCR.exe",
  isPackaged: true,
  portableExecutableDirectory: "D:\\Portable Apps\\日本語 OCR",
  userDataDirectory: "C:\\Users\\tester\\AppData\\Roaming\\LocalOCR",
};

describe("portable paths", () => {
  it("detects development, packaged and portable modes", () => {
    expect(detectRuntimeMode({ ...packagedContext, isPackaged: false })).toBe("development");
    expect(detectRuntimeMode({ ...packagedContext, portableExecutableDirectory: undefined })).toBe(
      "packaged",
    );
    expect(detectRuntimeMode(packagedContext)).toBe("portable");
  });

  it("derives the portable directory from electron-builder environment", () => {
    const app = {
      isPackaged: true,
      getAppPath: () => "C:\\Temp\\app.asar",
      getPath: (name: string) =>
        name === "exe" ? "C:\\Temp\\LocalOCR.exe" : "C:\\Users\\tester\\LocalOCR",
    };
    const context = createRuntimePathContext(app, {
      PORTABLE_EXECUTABLE_FILE: "D:\\持ち運び\\Local OCR.exe",
    });
    expect(context.portableExecutableDirectory).toBe("D:\\持ち運び");
  });

  it("orders portable, executable and userData candidates", () => {
    expect(createDataDirectoryCandidates(packagedContext)).toEqual([
      { source: "portable", path: join("D:\\Portable Apps\\日本語 OCR", "data") },
      { source: "executable", path: join("C:\\Temp\\LocalOCR", "data") },
      { source: "userData", path: packagedContext.userDataDirectory },
    ]);
  });

  it("falls back when earlier candidates are not writable", async () => {
    const probe = vi.fn((path: string) =>
      Promise.resolve(path === packagedContext.userDataDirectory),
    );
    const result = await resolveDataDirectory(packagedContext, probe);
    expect(result).toEqual({
      mode: "portable",
      source: "userData",
      path: packagedContext.userDataDirectory,
    });
    expect(probe).toHaveBeenCalledTimes(3);
  });
});
