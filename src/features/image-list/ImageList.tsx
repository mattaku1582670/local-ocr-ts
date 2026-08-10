import { Button } from "@heroui/react";
import type { KeyboardEvent } from "react";
import { useImageStore } from "../../store/useImageStore";
import { useOcrStore } from "../../store/useOcrStore";
import type { ImageItem } from "../../types/image";
import { ImageCard } from "./ImageCard";

export interface ImageListProps {
  confirmAction?: (message: string) => boolean;
}

function defaultConfirm(message: string): boolean {
  return window.confirm(message);
}

export function ImageList({ confirmAction = defaultConfirm }: ImageListProps) {
  const items = useImageStore((state) => state.items);
  const selectedImageId = useImageStore((state) => state.selectedImageId);
  const selectImage = useImageStore((state) => state.selectImage);
  const removeImage = useImageStore((state) => state.removeImage);
  const clearImages = useImageStore((state) => state.clearImages);
  const progressByImageId = useOcrStore((state) => state.progressByImageId);

  const remove = (image: ImageItem) => {
    if (
      image.dirty &&
      !confirmAction(`「${image.displayName}」には未保存のOCR結果があります。削除しますか？`)
    )
      return;
    removeImage(image.id);
  };

  const clear = () => {
    if (items.length === 0) return;
    if (
      items.some((image) => image.dirty) &&
      !confirmAction("未保存のOCR結果があります。すべての画像を一覧から削除しますか？")
    )
      return;
    clearImages();
  };

  const handleKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    const option = (event.target as HTMLElement).closest<HTMLElement>('[role="option"]');
    if (!option) return;
    const options = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="option"]'),
    );
    const index = options.indexOf(option);
    let nextIndex: number | undefined;
    if (event.key === "ArrowDown") nextIndex = Math.min(index + 1, options.length - 1);
    if (event.key === "ArrowUp") nextIndex = Math.max(index - 1, 0);
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = options.length - 1;
    if (event.key === "Delete") {
      const image = items.find((item) => item.id === option.dataset.imageId);
      if (image) remove(image);
      event.preventDefault();
      return;
    }
    if (nextIndex === undefined || nextIndex === index) return;
    const next = options[nextIndex];
    const nextId = next.dataset.imageId;
    if (!nextId) return;
    event.preventDefault();
    selectImage(nextId);
    next.focus();
  };

  if (items.length === 0) {
    return <p className="image-list-empty">画像を追加すると、ここに一覧表示されます。</p>;
  }

  return (
    <div className="image-list-container">
      <div
        className="image-list"
        role="listbox"
        aria-label="追加した画像"
        onKeyDown={handleKeyboard}
      >
        {items.map((image) => (
          <ImageCard
            key={image.id}
            image={image}
            progress={progressByImageId[image.id]}
            selected={selectedImageId === image.id}
            onRemove={remove}
            onSelect={selectImage}
          />
        ))}
      </div>
      <Button variant="outline" onPress={clear}>
        すべてクリア
      </Button>
    </div>
  );
}
