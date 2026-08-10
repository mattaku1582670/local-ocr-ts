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
  | "SAVE_FAILED"
  | "OCR_INITIALIZATION_FAILED"
  | "OCR_PROCESSING_FAILED"
  | "OCR_CANCELLED"
  | "MODEL_MISSING"
  | "MODEL_INTEGRITY_FAILED"
  | "OUT_OF_MEMORY"
  | "UNKNOWN";

export interface AppError {
  code: AppErrorCode;
  message: string;
  recoverable: boolean;
  details?: Record<string, string | number | boolean>;
}
