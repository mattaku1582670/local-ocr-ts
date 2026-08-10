import { ipcMain } from "electron";
import IPC_CHANNELS from "../../shared/ipcChannels.cjs";
import type { LocalLogger } from "../services/logService.js";
import type { SettingsService } from "../services/settingsService.js";

interface IpcServices {
  logger: LocalLogger;
  settings: SettingsService;
}

export function registerIpc({ logger, settings }: IpcServices): void {
  ipcMain.removeHandler(IPC_CHANNELS.settings.load);
  ipcMain.removeHandler(IPC_CHANNELS.settings.save);

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
}
