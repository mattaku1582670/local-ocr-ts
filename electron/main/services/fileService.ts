import type {
  OpenDialogOptions,
  OpenDialogReturnValue,
  SaveDialogOptions,
  SaveDialogReturnValue,
} from "electron";
import { stat, readFile, writeFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { AppError, classifySaveError, type SerializedAppError } from "./appError.js";
import {
  detectImageMime,
  IMAGE_DIALOG_FILTERS,
  mimeFromExtension,
  type SupportedImageMime,
} from "./imageFormat.js";

export const MAX_IMAGE_FILE_BYTES = 50 * 1024 * 1024;
const MAX_EXPORT_BYTES = 10 * 1024 * 1024;

export interface DialogAdapter {
  showOpenDialog(options: OpenDialogOptions): Promise<OpenDialogReturnValue>;
  showSaveDialog(options: SaveDialogOptions): Promise<SaveDialogReturnValue>;
}

export interface LoadedImageFile {
  bytes: Uint8Array;
  displayName: string;
  mimeType: SupportedImageMime;
  sizeBytes: number;
}

export interface OpenImagesResult {
  images: LoadedImageFile[];
  rejected: SerializedAppError[];
}

export interface SaveResult {
  canceled: boolean;
  displayName?: string;
}

export type ImageDecodeProbe = (bytes: Uint8Array) => boolean;

function errorForRead(error: unknown): AppError {
  if (error instanceof AppError) return error;
  return new AppError({
    code: "INPUT_READ_FAILED",
    message: "画像ファイルを読み込めませんでした。",
    recoverable: true,
  });
}

function defaultName(input: string, extension: ".txt" | ".json"): string {
  const name = basename(input.trim()) || `ocr-result${extension}`;
  return extname(name).toLocaleLowerCase("en-US") === extension ? name : `${name}${extension}`;
}

export class FileService {
  constructor(
    private readonly dialog: DialogAdapter,
    private readonly canDecodeImage: ImageDecodeProbe,
  ) {}

  async openImages(): Promise<OpenImagesResult> {
    const selection = await this.dialog.showOpenDialog({
      title: "OCRする画像を選択",
      properties: ["openFile", "multiSelections"],
      filters: [...IMAGE_DIALOG_FILTERS],
    });
    if (selection.canceled) return { images: [], rejected: [] };

    const images: LoadedImageFile[] = [];
    const rejected: SerializedAppError[] = [];
    for (const filePath of selection.filePaths) {
      try {
        images.push(await this.readImage(filePath));
      } catch (error) {
        rejected.push(errorForRead(error).serialize());
      }
    }
    return { images, rejected };
  }

  async readImage(filePath: string): Promise<LoadedImageFile> {
    try {
      const expectedMime = mimeFromExtension(filePath);
      if (!expectedMime) {
        throw new AppError({
          code: "INPUT_UNSUPPORTED_FORMAT",
          message: "対応していない画像形式です。",
          recoverable: true,
        });
      }
      const metadata = await stat(filePath);
      if (metadata.size === 0) {
        throw new AppError({
          code: "INPUT_EMPTY",
          message: "0バイトの画像は読み込めません。",
          recoverable: true,
        });
      }
      if (metadata.size > MAX_IMAGE_FILE_BYTES) {
        throw new AppError({
          code: "INPUT_TOO_LARGE",
          message: "画像ファイルが50 MiBの上限を超えています。",
          recoverable: true,
          details: { maxBytes: MAX_IMAGE_FILE_BYTES, actualBytes: metadata.size },
        });
      }

      const buffer = await readFile(filePath);
      const detectedMime = detectImageMime(buffer);
      if (!detectedMime || !this.canDecodeImage(buffer)) {
        throw new AppError({
          code: "INPUT_UNSUPPORTED_FORMAT",
          message: "画像をデコードできません。",
          recoverable: true,
        });
      }
      if (detectedMime !== expectedMime) {
        throw new AppError({
          code: "INPUT_FORMAT_MISMATCH",
          message: "拡張子と画像形式が一致しません。",
          recoverable: true,
        });
      }
      return {
        bytes: new Uint8Array(buffer),
        displayName: basename(filePath),
        mimeType: detectedMime,
        sizeBytes: buffer.byteLength,
      };
    } catch (error) {
      throw errorForRead(error);
    }
  }

  async saveText(defaultFileName: string, text: string): Promise<SaveResult> {
    return this.save(defaultName(defaultFileName, ".txt"), text, [
      { name: "テキスト", extensions: ["txt"] },
    ]);
  }

  async saveJson(defaultFileName: string, value: unknown): Promise<SaveResult> {
    let content: string;
    try {
      const serialized = JSON.stringify(value, null, 2) as string | undefined;
      if (serialized === undefined) throw new TypeError("Value is not JSON serializable");
      content = `${serialized}\n`;
    } catch {
      throw new AppError({
        code: "SAVE_INVALID_CONTENT",
        message: "JSONへ変換できない内容です。",
        recoverable: true,
      });
    }
    return this.save(defaultName(defaultFileName, ".json"), content, [
      { name: "JSON", extensions: ["json"] },
    ]);
  }

  private async save(
    defaultPath: string,
    content: string,
    filters: NonNullable<SaveDialogOptions["filters"]>,
  ): Promise<SaveResult> {
    if (Buffer.byteLength(content, "utf8") > MAX_EXPORT_BYTES) {
      throw new AppError({
        code: "SAVE_INVALID_CONTENT",
        message: "保存内容が10 MiBの上限を超えています。",
        recoverable: true,
      });
    }
    const selection = await this.dialog.showSaveDialog({
      title: "OCR結果を保存",
      defaultPath,
      filters,
    });
    if (selection.canceled || !selection.filePath) return { canceled: true };
    try {
      await writeFile(selection.filePath, content, "utf8");
      return { canceled: false, displayName: basename(selection.filePath) };
    } catch (error) {
      throw classifySaveError(error);
    }
  }
}
