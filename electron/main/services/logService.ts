import { appendFile, mkdir, rename, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";

const logLevelSchema = z.enum(["ERROR", "WARN", "INFO", "DEBUG"]);
const logEventSchema = z.enum([
  "app.start",
  "app.stop",
  "settings.loaded",
  "settings.saved",
  "ocr.initialized",
  "ocr.completed",
  "operation.failed",
]);

const safeLogContextSchema = z
  .object({
    appVersion: z.string().max(50).optional(),
    platform: z.enum(["win32", "darwin", "linux"]).optional(),
    arch: z.enum(["x64", "arm64", "ia32"]).optional(),
    dataSource: z.enum(["development", "portable", "executable", "userData"]).optional(),
    settingsSource: z.enum(["disk", "default-missing", "default-invalid"]).optional(),
    errorCode: z
      .string()
      .regex(/^[A-Z0-9_-]+$/)
      .max(80)
      .optional(),
    stage: z.enum(["startup", "settings", "file", "clipboard", "ocr", "shutdown"]).optional(),
    durationMs: z.number().nonnegative().max(86_400_000).optional(),
    imageWidth: z.number().int().positive().max(100_000).optional(),
    imageHeight: z.number().int().positive().max(100_000).optional(),
    itemCount: z.number().int().nonnegative().max(100_000).optional(),
  })
  .strict();

const loggerOptionsSchema = z.object({
  enabled: z.boolean().default(true),
  debugEnabled: z.boolean().default(false),
  maxBytes: z.number().int().min(256).default(1_048_576),
  maxFiles: z.number().int().min(1).max(10).default(3),
});

export type LogLevel = z.infer<typeof logLevelSchema>;
export type LogEvent = z.infer<typeof logEventSchema>;
export type SafeLogContext = z.infer<typeof safeLogContextSchema>;
export type LoggerOptions = z.input<typeof loggerOptionsSchema>;

export class LocalLogger {
  readonly filePath: string;
  private readonly options: z.output<typeof loggerOptionsSchema>;
  private queue: Promise<void> = Promise.resolve();

  constructor(logDirectory: string, options: LoggerOptions = {}) {
    this.filePath = join(logDirectory, "local-ocr.log");
    this.options = loggerOptionsSchema.parse(options);
  }

  error(event: LogEvent, context: SafeLogContext = {}): Promise<void> {
    return this.write("ERROR", event, context);
  }

  warn(event: LogEvent, context: SafeLogContext = {}): Promise<void> {
    return this.write("WARN", event, context);
  }

  info(event: LogEvent, context: SafeLogContext = {}): Promise<void> {
    return this.write("INFO", event, context);
  }

  debug(event: LogEvent, context: SafeLogContext = {}): Promise<void> {
    return this.write("DEBUG", event, context);
  }

  flush(): Promise<void> {
    return this.queue;
  }

  private async write(
    levelInput: LogLevel,
    eventInput: LogEvent,
    contextInput: SafeLogContext,
  ): Promise<void> {
    const level = logLevelSchema.parse(levelInput);
    const event = logEventSchema.parse(eventInput);
    const context = safeLogContextSchema.parse(contextInput);
    if (!this.options.enabled || (level === "DEBUG" && !this.options.debugEnabled)) {
      return Promise.resolve();
    }

    const line = `${JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      event,
      context,
    })}\n`;

    const operation = this.queue.then(async () => {
      await mkdir(dirname(this.filePath), { recursive: true });
      await this.rotateIfRequired(Buffer.byteLength(line, "utf8"));
      await appendFile(this.filePath, line, "utf8");
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }

  private async rotateIfRequired(incomingBytes: number): Promise<void> {
    const currentBytes = await stat(this.filePath)
      .then((value) => value.size)
      .catch(() => 0);
    if (currentBytes + incomingBytes <= this.options.maxBytes) return;

    for (let index = this.options.maxFiles - 1; index >= 1; index -= 1) {
      const destination = `${this.filePath}.${index.toString()}`;
      const source = index === 1 ? this.filePath : `${this.filePath}.${(index - 1).toString()}`;
      await rm(destination, { force: true });
      await rename(source, destination).catch((error: unknown) => {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
        throw error;
      });
    }
  }
}
