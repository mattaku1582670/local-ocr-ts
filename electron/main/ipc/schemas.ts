import { z } from "zod";

const supportedImageExtensionSchema = z.enum(["png", "jpg", "jpeg", "webp", "bmp"]);

export const openImagesRequestSchema = z
  .object({
    extensions: z.array(supportedImageExtensionSchema).min(1).max(5),
  })
  .strict();

export const saveTextRequestSchema = z
  .object({
    defaultFileName: z.string().trim().min(1).max(200),
    text: z.string().max(10_000_000),
  })
  .strict();

export const saveJsonRequestSchema = z
  .object({
    defaultFileName: z.string().trim().min(1).max(200),
    value: z.unknown(),
  })
  .strict();

export function parseIpcInput<T>(schema: z.ZodType<T>, input: unknown): T {
  return schema.parse(input);
}
