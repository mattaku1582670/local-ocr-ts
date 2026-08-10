import { Card, Chip } from "@heroui/react";
import { useState } from "react";
import { appEnvironment } from "../config/environment";
import { ImageDropZone } from "../features/image-input/ImageDropZone";
import { Toolbar } from "../features/image-input/Toolbar";
import { useImageInput } from "../features/image-input/useImageInput";
import { ImageList } from "../features/image-list/ImageList";
import { ImagePreview } from "../features/image-preview/ImagePreview";
import { selectSelectedImage, useImageStore } from "../store/useImageStore";
import { useOcrStore } from "../store/useOcrStore";
import { useSettingsStore } from "../store/useSettingsStore";

export function App() {
  const imageCount = useImageStore((state) => state.items.length);
  const selectedImage = useImageStore(selectSelectedImage);
  const settingsStatus = useSettingsStore((state) => state.status);
  const engineStatus = useOcrStore((state) => state.engineStatus);
  const { busy, dropFiles, notice, openImages, pasteImage } = useImageInput();
  const [blockSelection, setBlockSelection] = useState<{
    blockId: string | null;
    imageId: string | null;
  }>({ blockId: null, imageId: null });
  const selectedBlockId =
    blockSelection.imageId === selectedImage?.id ? blockSelection.blockId : null;
  const selectedBlock = selectedImage?.ocrResult?.blocks.find(
    (block) => block.id === selectedBlockId,
  );

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">完全オフライン</p>
          <h1>Local OCR</h1>
        </div>
        <Chip color="success">{appEnvironment.mode}</Chip>
      </header>

      <Toolbar
        busy={busy}
        hasImages={imageCount > 0}
        onOpen={() => void openImages()}
        onPaste={() => void pasteImage()}
      />

      <section className="workspace" aria-label="OCRワークスペース">
        <Card className="panel image-list-panel">
          <Card.Header>
            <Card.Title>画像一覧（{imageCount}）</Card.Title>
          </Card.Header>
          <Card.Content>
            <ImageList />
          </Card.Content>
        </Card>

        <Card className="panel preview-panel">
          <Card.Header>
            <Card.Title>画像プレビュー</Card.Title>
          </Card.Header>
          <Card.Content>
            {!selectedImage ? (
              <ImageDropZone
                disabled={busy}
                onDropFiles={(files) => void dropFiles(files)}
                onOpen={() => void openImages()}
              />
            ) : (
              <ImagePreview
                key={selectedImage.id}
                image={selectedImage}
                selectedBlockId={selectedBlockId}
                onBlockSelect={(blockId) => {
                  setBlockSelection({ imageId: selectedImage.id, blockId });
                }}
              />
            )}
          </Card.Content>
        </Card>

        <Card className="panel result-panel">
          <Card.Header>
            <Card.Title>OCR結果</Card.Title>
          </Card.Header>
          <Card.Content>
            <p>
              {selectedBlock
                ? `選択したOCR枠: ${selectedBlock.text}`
                : "認識結果はここで確認・編集できます。"}
            </p>
          </Card.Content>
        </Card>
      </section>

      <footer className="status-bar">
        <output className={`input-notice ${notice?.tone ?? "info"}`} aria-live="polite">
          {busy ? "画像を読み込んでいます…" : (notice?.message ?? "画像を追加してください。")}
        </output>
        <span>OCRエンジン: {engineStatus}</span>
        <span>設定同期: {settingsStatus}</span>
      </footer>
    </main>
  );
}
