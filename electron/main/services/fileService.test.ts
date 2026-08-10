// @vitest-environment node
import { mkdtemp, readFile, rm, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { classifySaveError } from "./appError.js";
import type { DialogAdapter } from "./fileService.js";
import { FileService, MAX_IMAGE_FILE_BYTES } from "./fileService.js";

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "Local OCR 入出力 日本語 "));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function createDialog(filePaths: string[] = [], savePath?: string): DialogAdapter {
  return {
    showOpenDialog: vi.fn(() => Promise.resolve({ canceled: false, filePaths })),
    showSaveDialog: vi.fn(() =>
      Promise.resolve(savePath ? { canceled: false, filePath: savePath } : { canceled: true }),
    ),
  } as unknown as DialogAdapter;
}

describe("FileService image input", () => {
  it("loads multiple supported images selected by the dialog", async () => {
    const directory = await createTemporaryDirectory();
    const pngPath = join(directory, "画面.png");
    const jpegPath = join(directory, "写真.jpg");
    await writeFile(pngPath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    await writeFile(jpegPath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    const dialog = createDialog([pngPath, jpegPath]);
    const service = new FileService(dialog, () => true);

    const result = await service.openImages();
    expect(result.rejected).toEqual([]);
    expect(result.images.map((image) => image.mimeType)).toEqual(["image/png", "image/jpeg"]);
    // The Electron adapter method is intentionally inspected as a Vitest mock here.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(dialog.showOpenDialog).toHaveBeenCalledWith(
      expect.objectContaining({ properties: ["openFile", "multiSelections"] }),
    );
  });

  it("rejects a disguised extension", async () => {
    const directory = await createTemporaryDirectory();
    const path = join(directory, "偽装.jpg");
    await writeFile(path, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const result = await new FileService(createDialog([path]), () => true).openImages();
    expect(result.images).toEqual([]);
    expect(result.rejected[0]?.code).toBe("INPUT_FORMAT_MISMATCH");
  });

  it("rejects zero-byte, oversized and undecodable input", async () => {
    const directory = await createTemporaryDirectory();
    const emptyPath = join(directory, "empty.png");
    const largePath = join(directory, "large.png");
    const brokenPath = join(directory, "broken.png");
    await writeFile(emptyPath, "");
    await writeFile(largePath, "x");
    await truncate(largePath, MAX_IMAGE_FILE_BYTES + 1);
    await writeFile(brokenPath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

    const service = new FileService(createDialog(), () => false);
    await expect(service.readImage(emptyPath)).rejects.toMatchObject({ code: "INPUT_EMPTY" });
    await expect(service.readImage(largePath)).rejects.toMatchObject({ code: "INPUT_TOO_LARGE" });
    await expect(service.readImage(brokenPath)).rejects.toMatchObject({
      code: "INPUT_UNSUPPORTED_FORMAT",
    });
  });
});

describe("FileService output", () => {
  it("saves UTF-8 TXT with a Japanese file name", async () => {
    const directory = await createTemporaryDirectory();
    const outputPath = join(directory, "認識結果.txt");
    const service = new FileService(createDialog([], outputPath), () => true);
    await expect(service.saveText("認識結果", "日本語OCR結果\n")).resolves.toEqual({
      canceled: false,
      displayName: "認識結果.txt",
    });
    await expect(readFile(outputPath, "utf8")).resolves.toBe("日本語OCR結果\n");
  });

  it("saves formatted JSON with a Japanese file name", async () => {
    const directory = await createTemporaryDirectory();
    const outputPath = join(directory, "認識結果.json");
    const service = new FileService(createDialog([], outputPath), () => true);
    await service.saveJson("認識結果", { text: "日本語", confidence: 0.9 });
    expect(JSON.parse(await readFile(outputPath, "utf8"))).toEqual({
      text: "日本語",
      confidence: 0.9,
    });
  });

  it("rejects non-serializable JSON", async () => {
    const service = new FileService(createDialog(), () => true);
    await expect(service.saveJson("result", 1n)).rejects.toMatchObject({
      code: "SAVE_INVALID_CONTENT",
    });
  });

  it.each([
    ["EACCES", "SAVE_PERMISSION_DENIED"],
    ["ENOSPC", "SAVE_DISK_FULL"],
    ["ENAMETOOLONG", "SAVE_PATH_INVALID"],
    ["UNKNOWN", "SAVE_FAILED"],
  ])("classifies %s save failures as %s", (systemCode, appCode) => {
    const error = Object.assign(new Error("write failed"), { code: systemCode });
    expect(classifySaveError(error).code).toBe(appCode);
  });
});
