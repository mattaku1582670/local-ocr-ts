import type { OcrProgress } from "../../store/useOcrStore";
import type { ImageItem } from "../../types/image";
import { imageStatusLabel, recognizedCharacterCount } from "./imageListModel";

interface ImageCardProps {
  image: ImageItem;
  progress?: OcrProgress;
  selected: boolean;
  onRemove: (image: ImageItem) => void;
  onSelect: (id: string) => void;
}

export function ImageCard({ image, progress, selected, onRemove, onSelect }: ImageCardProps) {
  const characterCount = recognizedCharacterCount(image.ocrResult?.editedText);

  return (
    <div
      id={`image-card-${image.id}`}
      className={`image-card${selected ? " is-selected" : ""}`}
      data-image-id={image.id}
      role="option"
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      onClick={() => {
        onSelect(image.id);
      }}
      onFocus={() => {
        onSelect(image.id);
      }}
    >
      <img className="image-thumbnail" src={image.objectUrl} alt="" draggable={false} />
      <div className="image-card-details">
        <div className="image-card-title-row">
          <strong title={image.displayName}>{image.displayName}</strong>
          {image.dirty ? <span className="dirty-indicator">未保存</span> : null}
        </div>
        <span>
          {image.width} × {image.height}px
        </span>
        <span className={`image-status status-${image.status}`}>
          {imageStatusLabel(image.status, progress)}
        </span>
        {characterCount === null ? null : <span>認識文字数: {characterCount}</span>}
        {image.error ? <span className="image-error">{image.error.message}</span> : null}
      </div>
      <button
        className="image-remove-button"
        type="button"
        aria-label={`${image.displayName}を削除`}
        title="一覧から削除"
        onClick={(event) => {
          event.stopPropagation();
          onRemove(image);
        }}
      >
        ×
      </button>
    </div>
  );
}
