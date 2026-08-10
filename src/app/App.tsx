import { Button, Card, Chip } from "@heroui/react";
import { appEnvironment } from "../config/environment";
import { useAppStore } from "../store/useAppStore";

export function App() {
  const completedRuns = useAppStore((state) => state.completedRuns);
  const recordCompletedRun = useAppStore((state) => state.recordCompletedRun);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">完全オフライン</p>
          <h1>Local OCR</h1>
        </div>
        <Chip color="success">{appEnvironment.mode}</Chip>
      </header>

      <section className="workspace" aria-label="OCRワークスペース">
        <Card className="panel image-list-panel">
          <Card.Header>
            <Card.Title>画像一覧</Card.Title>
          </Card.Header>
          <Card.Content>
            <p>画像を追加すると、ここに一覧表示されます。</p>
            <Button variant="primary" isDisabled>
              画像を追加
            </Button>
          </Card.Content>
        </Card>

        <Card className="panel preview-panel">
          <Card.Header>
            <Card.Title>画像プレビュー</Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="empty-preview">プレビュー領域</div>
          </Card.Content>
        </Card>

        <Card className="panel result-panel">
          <Card.Header>
            <Card.Title>OCR結果</Card.Title>
          </Card.Header>
          <Card.Content>
            <p>認識結果はここで確認・編集できます。</p>
            <Button variant="outline" onPress={recordCompletedRun}>
              Store動作確認
            </Button>
            <output aria-live="polite">完了回数: {completedRuns}</output>
          </Card.Content>
        </Card>
      </section>
    </main>
  );
}
