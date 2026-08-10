import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";

export const windowStateSchema = z
  .object({
    version: z.literal(1),
    x: z.number().int().min(-100_000).max(100_000).optional(),
    y: z.number().int().min(-100_000).max(100_000).optional(),
    width: z.number().int().min(900).max(16_384),
    height: z.number().int().min(600).max(16_384),
    isMaximized: z.boolean(),
  })
  .strict();

export type WindowState = z.infer<typeof windowStateSchema>;

export const DEFAULT_WINDOW_STATE: Readonly<WindowState> = Object.freeze({
  version: 1,
  width: 1280,
  height: 800,
  isMaximized: false,
});

export class WindowStateService {
  readonly filePath: string;

  constructor(dataDirectory: string) {
    this.filePath = join(dataDirectory, "window-state.json");
  }

  async load(): Promise<WindowState> {
    try {
      const input = await readFile(this.filePath, "utf8");
      return windowStateSchema.parse(JSON.parse(input) as unknown);
    } catch {
      return { ...DEFAULT_WINDOW_STATE };
    }
  }

  async save(input: unknown): Promise<WindowState> {
    const state = windowStateSchema.parse(input);
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    return state;
  }
}
