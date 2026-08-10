import { Button } from "@heroui/react";

interface ToolbarProps {
  busy: boolean;
  hasImages: boolean;
  onOpen: () => void;
  onPaste: () => void;
}

export function Toolbar({ busy, hasImages, onOpen, onPaste }: ToolbarProps) {
  return (
    <nav className="app-toolbar" aria-label="OCR操作">
      <Button variant="primary" onPress={onOpen} isDisabled={busy}>
        画像を開く
      </Button>
      <Button variant="outline" onPress={onPaste} isDisabled={busy}>
        貼り付け
      </Button>
      <span className="toolbar-separator" aria-hidden="true" />
      <Button variant="outline" isDisabled={!hasImages}>
        OCR実行
      </Button>
      <Button variant="outline" isDisabled>
        選択範囲OCR
      </Button>
      <Button variant="outline" isDisabled={!hasImages}>
        すべてOCR
      </Button>
      <Button variant="outline" isDisabled>
        キャンセル
      </Button>
      <span className="toolbar-separator" aria-hidden="true" />
      <Button variant="outline" isDisabled>
        コピー
      </Button>
      <Button variant="outline" isDisabled>
        保存
      </Button>
      <Button variant="outline" isDisabled>
        設定
      </Button>
    </nav>
  );
}
