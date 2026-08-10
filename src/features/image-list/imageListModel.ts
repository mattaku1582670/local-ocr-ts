import type { OcrProgress } from "../../store/useOcrStore";
import type { ImageStatus } from "../../types/image";

const statusLabels: Record<ImageStatus, string> = {
  idle: "待機中",
  loading: "読込中",
  ready: "OCR待ち",
  processing: "OCR処理中",
  success: "OCR完了",
  error: "エラー",
  cancelled: "キャンセル済み",
};

export function recognizedCharacterCount(text: string | undefined): number | null {
  return text === undefined ? null : Array.from(text).length;
}

export function imageStatusLabel(status: ImageStatus, progress?: OcrProgress): string {
  if (progress && progress.stage !== "complete") {
    return `${statusLabels.processing} ${String(Math.round(progress.percent))}%`;
  }
  return statusLabels[status];
}
