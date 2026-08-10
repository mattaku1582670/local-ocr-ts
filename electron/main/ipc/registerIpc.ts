import { clipboard, dialog, ipcMain, nativeImage } from "electron";
import { ZodError } from "zod";
import IPC_CHANNELS from "../../shared/ipcChannels.cjs";
import { AppError, type SerializedAppError } from "../services/appError.js";
import { ClipboardService } from "../services/clipboardService.js";
import { FileService } from "../services/fileService.js";
import type { LocalLogger } from "../services/logService.js";
import type { SettingsService } from "../services/settingsService.js";
import { parseIpcInput, saveJsonRequestSchema, saveTextRequestSchema } from "./schemas.js";

interface IpcServices {
  logger: LocalLogger;
  settings: SettingsService;
}

type IpcResult<T> = { ok: true; value: T } | { error: SerializedAppError; ok: false };

async function runIpc<T>(
  operation: () => Promise<T> | T,
  logger: LocalLogger,
  stage: "file" | "clipboard",
): Promise<IpcResult<T>> {
  try {
    return { ok: true, value: await operation() };
  } catch (error) {
    const appError =
      error instanceof AppError
        ? error
        : error instanceof ZodError
          ? new AppError({
              code: "IPC_INVALID_INPUT",
              message: "IPC入力が不正です。",
              recoverable: true,
            })
          : new AppError({
              code: "SAVE_FAILED",
              message: "処理を完了できませんでした。",
              recoverable: true,
            });
    await logger.error("operation.failed", { errorCode: appError.code, stage });
    return { ok: false, error: appError.serialize() };
  }
}

export function registerIpc({ logger, settings }: IpcServices): void {
  const fileService = new FileService(dialog, (bytes) => {
    return !nativeImage.createFromBuffer(Buffer.from(bytes)).isEmpty();
  });
  const clipboardService = new ClipboardService(clipboard);

  for (const channel of [
    IPC_CHANNELS.settings.load,
    IPC_CHANNELS.settings.save,
    IPC_CHANNELS.file.openImages,
    IPC_CHANNELS.file.saveText,
    IPC_CHANNELS.file.saveJson,
    IPC_CHANNELS.clipboard.readImage,
  ])
    ipcMain.removeHandler(channel);

  ipcMain.handle(IPC_CHANNELS.settings.load, async () => {
    const loaded = await settings.load();
    await logger.info("settings.loaded", { settingsSource: loaded.source });
    return loaded.settings;
  });

  ipcMain.handle(IPC_CHANNELS.settings.save, async (_event, input: unknown) => {
    const saved = await settings.save(input);
    await logger.info("settings.saved");
    return saved;
  });

  ipcMain.handle(IPC_CHANNELS.file.openImages, () =>
    runIpc(() => fileService.openImages(), logger, "file"),
  );
  ipcMain.handle(IPC_CHANNELS.clipboard.readImage, () =>
    runIpc(() => clipboardService.readImage(), logger, "clipboard"),
  );
  ipcMain.handle(IPC_CHANNELS.file.saveText, (_event, input: unknown) =>
    runIpc(
      () => {
        const request = parseIpcInput(saveTextRequestSchema, input);
        return fileService.saveText(request.defaultFileName, request.text);
      },
      logger,
      "file",
    ),
  );
  ipcMain.handle(IPC_CHANNELS.file.saveJson, (_event, input: unknown) =>
    runIpc(
      () => {
        const request = parseIpcInput(saveJsonRequestSchema, input);
        return fileService.saveJson(request.defaultFileName, request.value);
      },
      logger,
      "file",
    ),
  );
}
