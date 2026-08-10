import { z } from "zod";
import type { AppError } from "../../types/errors";
import type { ImageItem } from "../../types/image";

export const MAX_IMAGE_BYTES = 50 * 1024 * 1024;

const supportedMimeByExtension = {
  bmp: "image/bmp",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

export type SupportedImageMime =
  (typeof supportedMimeByExtension)[keyof typeof supportedMimeByExtension];

const appErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  recoverable: z.boolean(),
  details: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

const loadedImageSchema = z.object({
  bytes: z.instanceof(Uint8Array),
  displayName: z.string().min(1),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp", "image/bmp"]),
  sizeBytes: z.number().int().nonnegative(),
});

const openImagesResultSchema = z.object({
  ok: z.literal(true),
  value: z.object({
    images: z.array(loadedImageSchema),
    rejected: z.array(appErrorSchema),
  }),
});

const clipboardResultSchema = z.object({
  ok: z.literal(true),
  value: loadedImageSchema.nullable(),
});

const failedIpcResultSchema = z.object({
  ok: z.literal(false),
  error: appErrorSchema,
});

export interface LoadedImage {
  bytes: Uint8Array;
  displayName: string;
  mimeType: SupportedImageMime;
  sizeBytes: number;
}

export interface OpenImagesPayload {
  images: LoadedImage[];
  rejected: AppError[];
}

export interface ImagePreparationDependencies {
  createId: () => string;
  createObjectUrl: (blob: Blob) => string;
  decodeDimensions: (objectUrl: string) => Promise<{ height: number; width: number }>;
  revokeObjectUrl: (objectUrl: string) => void;
}

function toAppError(value: z.infer<typeof appErrorSchema>): AppError {
  return { ...value, code: value.code as AppError["code"] };
}

export function parseOpenImagesResponse(input: unknown): OpenImagesPayload {
  const failed = failedIpcResultSchema.safeParse(input);
  if (failed.success) throw new Error(failed.data.error.message);
  const parsed = openImagesResultSchema.parse(input);
  return {
    images: parsed.value.images,
    rejected: parsed.value.rejected.map(toAppError),
  };
}

export function parseClipboardResponse(input: unknown): LoadedImage | null {
  const failed = failedIpcResultSchema.safeParse(input);
  if (failed.success) throw new Error(failed.data.error.message);
  return clipboardResultSchema.parse(input).value;
}

function extensionOf(fileName: string): keyof typeof supportedMimeByExtension | undefined {
  const extension = fileName.split(".").pop()?.toLocaleLowerCase("en-US");
  return extension && extension in supportedMimeByExtension
    ? (extension as keyof typeof supportedMimeByExtension)
    : undefined;
}

function detectedMime(bytes: Uint8Array): SupportedImageMime | undefined {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (
    bytes.length >= 12 &&
    new TextDecoder("ascii").decode(bytes.slice(0, 4)) === "RIFF" &&
    new TextDecoder("ascii").decode(bytes.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return "image/bmp";
  return undefined;
}

export async function loadDroppedFile(file: File): Promise<LoadedImage> {
  const extension = extensionOf(file.name);
  if (!extension) throw new Error(`${file.name}: 対応していない画像形式です。`);
  if (file.size === 0) throw new Error(`${file.name}: 空のファイルは追加できません。`);
  if (file.size > MAX_IMAGE_BYTES)
    throw new Error(`${file.name}: ファイルサイズが50 MiBを超えています。`);

  const expectedMime = supportedMimeByExtension[extension];
  if (file.type && file.type !== expectedMime)
    throw new Error(`${file.name}: 拡張子とMIME形式が一致しません。`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (detectedMime(bytes) !== expectedMime)
    throw new Error(`${file.name}: 画像の内容と拡張子が一致しません。`);
  return { bytes, displayName: file.name, mimeType: expectedMime, sizeBytes: file.size };
}

function decodeImageDimensions(objectUrl: string): Promise<{ height: number; width: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      reject(new Error("画像をデコードできませんでした。"));
    };
    image.src = objectUrl;
  });
}

const browserDependencies: ImagePreparationDependencies = {
  createId: () => crypto.randomUUID(),
  createObjectUrl: (blob) => URL.createObjectURL(blob),
  decodeDimensions: decodeImageDimensions,
  revokeObjectUrl: (objectUrl) => {
    URL.revokeObjectURL(objectUrl);
  },
};

export async function prepareImageItem(
  loaded: LoadedImage,
  sourceType: ImageItem["sourceType"],
  dependencies: ImagePreparationDependencies = browserDependencies,
): Promise<ImageItem> {
  const bytes = new Uint8Array(loaded.bytes);
  const objectUrl = dependencies.createObjectUrl(
    new Blob([bytes.buffer], { type: loaded.mimeType }),
  );
  try {
    const dimensions = await dependencies.decodeDimensions(objectUrl);
    return {
      id: dependencies.createId(),
      displayName: loaded.displayName,
      sourceType,
      mimeType: loaded.mimeType,
      width: dimensions.width,
      height: dimensions.height,
      rotation: 0,
      objectUrl,
      status: "ready",
      dirty: false,
    };
  } catch (error) {
    dependencies.revokeObjectUrl(objectUrl);
    throw error;
  }
}
