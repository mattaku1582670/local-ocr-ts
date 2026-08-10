export type AppErrorCode =
  | "IPC_INVALID_INPUT"
  | "INPUT_EMPTY"
  | "INPUT_TOO_LARGE"
  | "INPUT_UNSUPPORTED_FORMAT"
  | "INPUT_FORMAT_MISMATCH"
  | "INPUT_READ_FAILED"
  | "SAVE_INVALID_CONTENT"
  | "SAVE_PERMISSION_DENIED"
  | "SAVE_DISK_FULL"
  | "SAVE_PATH_INVALID"
  | "SAVE_FAILED";

export interface SerializedAppError {
  code: AppErrorCode;
  message: string;
  recoverable: boolean;
  details?: Record<string, string | number | boolean>;
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly recoverable: boolean;
  readonly details: Record<string, string | number | boolean> | undefined;

  constructor(error: SerializedAppError) {
    super(error.message);
    this.name = "AppError";
    this.code = error.code;
    this.recoverable = error.recoverable;
    this.details = error.details;
  }

  serialize(): SerializedAppError {
    return {
      code: this.code,
      message: this.message,
      recoverable: this.recoverable,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

export function classifySaveError(error: unknown): AppError {
  const code = error instanceof Error && "code" in error ? error.code : undefined;
  if (code === "EACCES" || code === "EPERM") {
    return new AppError({
      code: "SAVE_PERMISSION_DENIED",
      message: "保存先へ書き込めません。",
      recoverable: true,
    });
  }
  if (code === "ENOSPC") {
    return new AppError({
      code: "SAVE_DISK_FULL",
      message: "保存先の空き容量が不足しています。",
      recoverable: true,
    });
  }
  if (code === "ENOENT" || code === "ENAMETOOLONG" || code === "EINVAL") {
    return new AppError({
      code: "SAVE_PATH_INVALID",
      message: "保存先のパスが無効です。",
      recoverable: true,
    });
  }
  return new AppError({
    code: "SAVE_FAILED",
    message: "ファイルを保存できませんでした。",
    recoverable: true,
  });
}
