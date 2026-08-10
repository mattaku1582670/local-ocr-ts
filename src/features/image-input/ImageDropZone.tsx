import { useState, type DragEvent, type KeyboardEvent } from "react";

interface ImageDropZoneProps {
  disabled?: boolean;
  onDropFiles: (files: File[]) => void;
  onOpen: () => void;
}

export function ImageDropZone({ disabled = false, onDropFiles, onOpen }: ImageDropZoneProps) {
  const [dragging, setDragging] = useState(false);

  const acceptDrag = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!disabled) event.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (!disabled) onDropFiles(Array.from(event.dataTransfer.files));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onOpen();
  };

  return (
    <div
      className={`image-drop-zone${dragging ? " is-dragging" : ""}`}
      onDragEnter={(event) => {
        acceptDrag(event);
        if (!disabled) setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDragOver={acceptDrag}
      onDrop={handleDrop}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label="画像をドロップまたは選択"
    >
      <strong>画像をここにドロップ</strong>
      <span>PNG・JPEG・WebP・BMP（複数選択可）</span>
      <span>クリックの代わりに Enter キーでファイルを選択できます</span>
    </div>
  );
}
