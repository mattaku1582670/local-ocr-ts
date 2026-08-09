# Local OCR システム設計書

- 文書ID: LOC-OCR-DES-001
- 版: 1.0
- 対象: React + ElectronポータブルOCRアプリ
- 関連文書:
  - `LocalOCR_詳細要件定義書.md`
  - `LocalOCR_WBS.md`

---

## 1. 設計目的

本書はLocal OCRのアーキテクチャ、プロセス分割、モジュール構成、IPC、データモデル、OCRエンジン抽象化、セキュリティ、ビルド・配布、テスト方針を定義する。

本設計では、PaddleOCR.jsを第一候補とするが、日本語モデル・WASM・Worker・ポータブル配布の実現性を技術検証で確認し、成立しない場合にPythonサイドカー方式へ切り替えられる構造とする。

---

## 2. アーキテクチャ概要

```text
┌───────────────────────────────────────────────────────────────┐
│ Windows                                                       │
│                                                               │
│  ┌──────────────── Electron Main Process ──────────────────┐ │
│  │ BrowserWindow / Dialog / Clipboard / File I/O / Logging │ │
│  │ Portable path resolution / App lifecycle                │ │
│  └───────────────────────┬──────────────────────────────────┘ │
│                          │ IPC                                │
│  ┌──────────────── Preload / contextBridge ────────────────┐ │
│  │ 型付けされた最小APIのみ公開                              │ │
│  └───────────────────────┬──────────────────────────────────┘ │
│                          │                                    │
│  ┌──────────────── Renderer Process ───────────────────────┐ │
│  │ React + TypeScript + HeroUI                              │ │
│  │                                                         │ │
│  │  UI ─ Store ─ Use Cases ─ OCR Engine Interface          │ │
│  │                                  │                      │ │
│  │                          Web Worker / WASM               │ │
│  │                          PaddleOCR.js / ONNX             │ │
│  └─────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

### 2.1 設計原則

- rendererを非特権領域として扱う
- Node.js機能はmain/preloadへ限定する
- OCRエンジンをUIから抽象化する
- OCR処理をWorkerへ隔離し、UI応答性を維持する
- 画像・OCR本文を原則メモリ内で扱う
- オフラインを既定かつ必須とする
- 単一画像の失敗がアプリ全体へ波及しない
- ポータブル実行パスと開発時パスを分離する

---

## 3. 技術スタック

| レイヤー | 採用候補 |
|---|---|
| Desktop shell | Electron |
| UI | React |
| Language | TypeScript |
| Build | Vite |
| UI components | HeroUI |
| State | Zustand |
| OCR primary | PaddleOCR.js |
| Inference | ONNX Runtime Web / WASM |
| Image processing | Canvas API、必要に応じてOpenCV.js |
| Validation | Zod |
| Unit test | Vitest |
| Component test | React Testing Library |
| E2E | Playwright |
| Package | electron-builder |
| Logging | electron-log相当または自作薄型logger |
| Formatting | ESLint + Prettier |

バージョンは実装開始時に固定し、`package-lock.json`または同等のロックファイルを必須とする。

---

## 4. OCRエンジン選定ゲート

### 4.1 Gate A: PaddleOCR.js採用条件

以下をすべて満たした場合に正式採用する。

- Electron rendererまたはWorker内で起動できる
- 日本語モデルが利用できる
- モデル・辞書・WASMをローカル同梱できる
- ネットワーク遮断状態で動作する
- 1920×1080画像を許容時間内に処理できる
- 20画像連続でメモリリークやクラッシュがない
- ライセンス上、再配布可能
- electron-builderのportable成果物で動作する

### 4.2 Gate B: Pythonサイドカー切替条件

次のいずれかに該当する場合に切替を検討する。

- 日本語認識モデルを安定して読み込めない
- Worker/WASMの制約でUIが不安定
- 精度がPython版PaddleOCRより著しく劣る
- モデル配布構成が破綻する
- メモリ消費または処理時間が実用範囲外
- パッケージ更新で互換性が確保できない

### 4.3 Pythonサイドカー案

```text
Renderer
   │
   │ IPC
   ▼
Electron Main
   │ stdin/stdout JSON Lines
   ▼
Bundled Python Runtime + OCR service
```

この切替に備え、rendererは`OcrEngine`インターフェースのみを利用する。

---

## 5. プロセス設計

### 5.1 Main Process

責務:

- BrowserWindow生成
- セキュリティ設定
- ファイル選択ダイアログ
- 保存ダイアログ
- クリップボード画像取得
- ファイル読み込み
- TXT/JSON書き込み
- ポータブルデータ保存先の決定
- ローカルログ
- アプリライフサイクル
- 外部ナビゲーション拒否
- IPCハンドラー登録

MainでOCRを直接実行しない。Pythonサイドカー採用時のみプロセス管理を担う。

### 5.2 Preload

責務:

- `contextBridge.exposeInMainWorld`で限定APIを公開
- IPCチャンネルのラップ
- 引数と戻り値を型付け
- rendererへ`ipcRenderer`自体を公開しない

公開API例:

```ts
export type DesktopApi = {
  openImages(): Promise<OpenedImage[]>;
  readClipboardImage(): Promise<OpenedImage | null>;
  saveText(request: SaveTextRequest): Promise<SaveResult>;
  saveJson(request: SaveJsonRequest): Promise<SaveResult>;
  getAppInfo(): Promise<AppInfo>;
  getSettings(): Promise<AppSettings>;
  setSettings(settings: AppSettings): Promise<void>;
  showItemInFolder(path: string): Promise<void>;
};
```

### 5.3 Renderer

責務:

- UI表示
- 画像一覧管理
- 画像デコード・プレビュー
- 範囲選択
- OCRキュー管理
- OCRエンジン呼出
- 結果編集
- 整形
- コピー命令
- 保存命令
- ユーザー通知

### 5.4 OCR Worker

責務:

- OCRライブラリ初期化
- モデルロード
- 画像前処理
- OCR推論
- 結果正規化
- 進捗通知
- キャンセル
- リソース解放

Workerメッセージ:

```ts
type WorkerRequest =
  | { type: "INIT"; payload: InitOptions }
  | { type: "RECOGNIZE"; requestId: string; payload: RecognizePayload }
  | { type: "CANCEL"; requestId: string }
  | { type: "DISPOSE" };

type WorkerResponse =
  | { type: "READY" }
  | { type: "PROGRESS"; requestId?: string; stage: string; value?: number }
  | { type: "RESULT"; requestId: string; result: NormalizedOcrResult }
  | { type: "ERROR"; requestId?: string; error: SerializedError }
  | { type: "CANCELLED"; requestId: string };
```

---

## 6. ディレクトリ構成

```text
local-ocr/
├─ electron/
│  ├─ main/
│  │  ├─ index.ts
│  │  ├─ createWindow.ts
│  │  ├─ security.ts
│  │  ├─ portablePaths.ts
│  │  ├─ ipc/
│  │  │  ├─ registerIpc.ts
│  │  │  ├─ fileHandlers.ts
│  │  │  ├─ clipboardHandlers.ts
│  │  │  ├─ settingsHandlers.ts
│  │  │  └─ appHandlers.ts
│  │  └─ services/
│  │     ├─ fileService.ts
│  │     ├─ settingsService.ts
│  │     └─ logService.ts
│  └─ preload/
│     ├─ index.ts
│     └─ desktopApi.ts
├─ src/
│  ├─ app/
│  │  ├─ App.tsx
│  │  ├─ providers.tsx
│  │  └─ routes.tsx
│  ├─ components/
│  │  ├─ toolbar/
│  │  ├─ image-list/
│  │  ├─ image-viewer/
│  │  ├─ result-editor/
│  │  ├─ status-bar/
│  │  └─ dialogs/
│  ├─ features/
│  │  ├─ import/
│  │  ├─ viewer/
│  │  ├─ ocr/
│  │  ├─ results/
│  │  ├─ export/
│  │  └─ settings/
│  ├─ ocr/
│  │  ├─ OcrEngine.ts
│  │  ├─ PaddleOcrEngine.ts
│  │  ├─ OcrEngineFactory.ts
│  │  ├─ normalizeResult.ts
│  │  ├─ preprocess.ts
│  │  └─ ocr.worker.ts
│  ├─ store/
│  │  ├─ useImageStore.ts
│  │  ├─ useOcrStore.ts
│  │  └─ useSettingsStore.ts
│  ├─ types/
│  │  ├─ image.ts
│  │  ├─ ocr.ts
│  │  ├─ ipc.ts
│  │  └─ errors.ts
│  ├─ utils/
│  │  ├─ coordinates.ts
│  │  ├─ textFormatting.ts
│  │  ├─ mime.ts
│  │  └─ ids.ts
│  └─ test/
├─ public/
│  ├─ models/
│  ├─ wasm/
│  ├─ dictionaries/
│  └─ icons/
├─ e2e/
├─ scripts/
│  ├─ verify-offline-assets.mjs
│  ├─ collect-licenses.mjs
│  └─ smoke-portable.ps1
├─ docs/
├─ package.json
├─ vite.config.ts
├─ electron-builder.yml
├─ tsconfig.json
└─ README.md
```

---

## 7. ドメインモデル

### 7.1 ImageItem

```ts
export type ImageStatus =
  | "loading"
  | "ready"
  | "processing"
  | "success"
  | "error"
  | "cancelled";

export interface ImageItem {
  id: string;
  displayName: string;
  sourceType: "file" | "clipboard";
  sourcePath?: string;
  mimeType: string;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
  objectUrl: string;
  status: ImageStatus;
  selectedRegion?: Rect;
  ocrResult?: OcrDocument;
  error?: AppError;
  dirty: boolean;
}
```

### 7.2 座標

すべてのOCR座標は原画像の未ズーム座標で保持する。

```ts
export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Polygon {
  points: Point[];
}
```

表示時に次の変換を適用する。

```text
原画像座標
→ 回転変換
→ ビューポートスケール
→ パンオフセット
→ 画面座標
```

範囲OCR時は逆変換を行う。

### 7.3 OCR結果

```ts
export interface OcrBlock {
  id: string;
  text: string;
  confidence: number | null;
  polygon: Polygon;
  order: number;
}

export interface OcrDocument {
  schemaVersion: "1.0";
  imageId: string;
  rawText: string;
  editedText: string;
  blocks: OcrBlock[];
  metadata: {
    engine: string;
    engineVersion?: string;
    model: string;
    language: string;
    preprocessPreset: PreprocessPreset;
    durationMs: number;
    processedAt: string;
  };
}
```

---

## 8. OCRエンジン抽象化

```ts
export interface OcrEngine {
  initialize(options: OcrInitOptions): Promise<void>;
  recognize(
    image: ImageBitmap,
    options: OcrRecognizeOptions,
    signal?: AbortSignal
  ): Promise<NormalizedOcrResult>;
  dispose(): Promise<void>;
  getCapabilities(): OcrCapabilities;
}
```

### 8.1 NormalizedOcrResult

エンジン固有結果を以下へ正規化する。

```ts
export interface NormalizedOcrResult {
  text: string;
  blocks: Array<{
    text: string;
    confidence: number | null;
    polygon: Array<[number, number]>;
  }>;
  durationMs: number;
}
```

### 8.2 エンジン切替

```ts
export type OcrEngineKind = "paddleocr-js" | "python-sidecar";

export function createOcrEngine(kind: OcrEngineKind): OcrEngine {
  switch (kind) {
    case "paddleocr-js":
      return new PaddleOcrEngine();
    case "python-sidecar":
      return new PythonSidecarOcrEngine();
  }
}
```

Python版は初期実装に含めなくても、型と境界だけ先に定義する。

---

## 9. OCR処理シーケンス

```text
User
 │ OCR実行
 ▼
Renderer UI
 │ enqueue(imageId)
 ▼
OCR Queue
 │ get ImageBitmap / crop / rotate
 ▼
OCR Worker
 │ initialize if needed
 │ preprocess
 │ detect text
 │ recognize text
 │ normalize
 ▼
Renderer
 │ store result
 │ render overlay
 │ set editedText
 ▼
User
```

### 9.1 キュー

- FIFO
- 同時実行数1
- キャンセル可能
- 画像単位の状態管理
- 再試行回数は既定0
- Workerクラッシュ時のみ1回再初期化して再試行可能

---

## 10. 画像処理設計

### 10.1 読み込み

mainでファイルをArrayBufferまたは安全なデータとしてrendererへ渡す方法と、renderer側でユーザー選択Fileを扱う方法を比較する。

推奨:

- ファイルダイアログはmain
- mainがパス検証・読込
- rendererへバイナリとメタデータを返す
- 大容量転送の性能が問題なら、カスタムプロトコルまたは安全なローカルURL方式を検討する

### 10.2 デコード

- `createImageBitmap`を第一候補
- 非対応時は`HTMLImageElement` + Canvasへフォールバック
- object URLは画像削除時に`URL.revokeObjectURL`する

### 10.3 前処理

```ts
type PreprocessPreset = "none" | "document" | "screenshot";
```

初期案:

- `none`: 回転・サイズ安全化のみ
- `document`: グレースケール、軽いコントラスト調整
- `screenshot`: 原色維持、必要時のみ拡大

強い二値化は初期既定にしない。

### 10.4 巨大画像

- 最大ピクセル数を設定値で制限
- 超過時はOCR用コピーのみ縮小
- 原画像寸法と縮小率を保持し、座標を原画像へ戻す
- ブラウザのCanvas上限を考慮する

---

## 11. IPC設計

### 11.1 チャンネル

```ts
export const IPC = {
  IMAGE_OPEN: "image:open",
  CLIPBOARD_READ_IMAGE: "clipboard:read-image",
  FILE_SAVE_TEXT: "file:save-text",
  FILE_SAVE_JSON: "file:save-json",
  SETTINGS_GET: "settings:get",
  SETTINGS_SET: "settings:set",
  APP_GET_INFO: "app:get-info",
  SHELL_SHOW_ITEM: "shell:show-item",
} as const;
```

### 11.2 検証

- preloadとmainの両側で型を共有
- mainでZodスキーマ検証
- 任意パスの読み書きをrendererから直接要求させない
- 保存は必ずユーザーが選択した保存ダイアログ結果を利用
- `shell.openExternal`を公開しない

### 11.3 エラー

IPCエラーは直列化する。

```ts
export interface SerializedAppError {
  code: string;
  message: string;
  recoverable: boolean;
  details?: Record<string, unknown>;
}
```

stackは開発環境またはローカルログに限定する。

---

## 12. 状態管理

### 12.1 Store分割

- `useImageStore`: 画像一覧、選択、削除、結果
- `useOcrStore`: engine状態、キュー、進捗、キャンセル
- `useSettingsStore`: 設定
- UI一時状態はコンポーネントローカルに保持

### 12.2 永続化

永続化する:

- ユーザー設定
- ウィンドウサイズ・位置
- 必要に応じて最後のペイン幅

永続化しない:

- 画像データ
- OCR本文
- OCR結果
- クリップボード画像
- 選択範囲

---

## 13. セキュリティ設計

BrowserWindow例:

```ts
const window = new BrowserWindow({
  webPreferences: {
    preload: preloadPath,
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
  },
});
```

`sandbox: true`は依存ライブラリとの互換性を検証し、問題がある場合でも最小権限設計を維持する。

### 13.1 ナビゲーション制御

- `will-navigate`で外部遷移を拒否
- `setWindowOpenHandler`で新規ウィンドウを拒否
- 外部URLを開く機能は初期版で提供しない

### 13.2 CSP

概念例:

```text
default-src 'self';
script-src 'self' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' blob: data:;
worker-src 'self' blob:;
connect-src 'self';
object-src 'none';
base-uri 'none';
frame-ancestors 'none';
```

実際のONNX Runtime Web要件を確認し、必要最小限に調整する。

### 13.3 モデル完全性

- モデルファイルのSHA-256一覧をビルド時生成
- 起動時または診断画面で検証可能にする
- 欠損・改変時はOCRを開始せずエラー表示する案を検討

---

## 14. オフライン資産設計

必要資産:

- OCR検出モデル
- OCR認識モデル
- 日本語辞書
- ONNX Runtime WebのWASM
- OpenCV.js利用時のJS/WASM
- アイコン
- UIフォントはOS標準または同梱可能なもの

禁止:

- CDN参照
- Google Fonts等の外部フォント
- 初回モデルダウンロード
- 遠隔設定
- 分析SDK

ビルド後にスクリプトでHTML/JS内の`http://`、`https://`参照を検査する。

---

## 15. ポータブル保存先

electron-builder portable環境で提供される実行時情報を利用できる場合は活用し、利用できない場合を含めて次の優先順位を設ける。

1. ポータブルデータディレクトリ
2. EXE隣接の`data/`ディレクトリが書込可能なら使用
3. Electron `userData`へフォールバック

保存内容:

```text
data/
├─ settings.json
├─ window-state.json
└─ logs/
```

実行場所がProgram Files等の書込不可領域の場合でも起動を妨げない。

---

## 16. ビルド設計

### 16.1 Vite

- rendererとpreload/mainのビルドを分離
- 本番ビルドでsource mapを原則非同梱
- public資産を所定位置へコピー
- asset URLがElectronパッケージ内で解決されることを確認

### 16.2 electron-builder

概念例:

```yaml
appId: jp.local.localocr
productName: Local OCR
directories:
  output: release
files:
  - dist/**
  - dist-electron/**
extraResources:
  - from: public/models
    to: models
  - from: public/wasm
    to: wasm
  - from: public/dictionaries
    to: dictionaries
win:
  target:
    - target: portable
      arch:
        - x64
artifactName: "${productName}-${version}-${arch}-portable.${ext}"
asar: true
```

モデルやWASMはランダムアクセスやパス解決の都合により`extraResources`へ出す。実機検証でASAR内でも問題ない場合のみ再検討する。

### 16.3 成果物

- 単一portable EXE
- SHA-256チェックサム
- `LICENSES.html`または`THIRD_PARTY_NOTICES.txt`
- README
- 変更履歴
- 必要に応じてZIP版

---

## 17. テスト設計

### 17.1 単体テスト

対象:

- 座標変換
- 回転変換
- 範囲切出座標
- OCR結果正規化
- テキスト整形
- MIME検証
- ファイル名生成
- エラー変換
- Store reducer/action

### 17.2 コンポーネントテスト

- ドロップ領域
- 画像一覧
- OCRボタン状態
- 進捗表示
- 結果編集
- 未保存確認
- 設定画面

### 17.3 統合テスト

- preload API
- IPCスキーマ
- ファイル読込・保存
- クリップボード画像
- 設定永続化
- Worker初期化と認識

### 17.4 E2E

- 起動
- ファイル選択
- OCR
- コピー
- TXT保存
- JSON保存
- 貼り付け
- 範囲OCR
- 一括OCR
- キャンセル
- エラー復旧

### 17.5 ポータブル・オフライン試験

- クリーンWindows VM
- 管理者権限なし
- ネットワーク無効
- 日本語ユーザー名
- 空白を含む深いパス
- USBメモリ相当の移動可能ドライブ
- Windows Defender有効
- 125%、150%、200%表示倍率

---

## 18. ロギング・診断

### 18.1 ログレベル

- ERROR
- WARN
- INFO
- DEBUG（開発版のみ既定有効）

### 18.2 記録する

- 起動・終了
- アプリバージョン
- OS情報
- OCRエンジン初期化時間
- 処理画像寸法
- 処理時間
- エラーコード

### 18.3 記録しない

- 画像内容
- OCR本文
- ファイル内容
- クリップボード内容
- 個人情報を推測できる文字列

---

## 19. ライセンス・配布

- Electron、React、HeroUI、PaddleOCR、ONNX Runtime、モデル、辞書等のライセンスを確認する
- 再配布要件を`THIRD_PARTY_NOTICES`へまとめる
- モデルファイルごとの出所、バージョン、ハッシュを記録する
- アプリのAbout画面または同梱文書から確認可能にする

---

## 20. 実装上の主要リスク

| リスク | 影響 | 対策 |
|---|---|---|
| PaddleOCR.jsの日本語モデルが不安定 | 高 | Gate Aで先行検証、サイドカー代替 |
| WASM/Workerパスがportableで解決しない | 高 | extraResources、絶対パス解決、スモーク試験 |
| 単一EXE展開時の初回起動が遅い | 中 | フォルダ版も評価、モデル圧縮方針見直し |
| 巨大画像でメモリ不足 | 高 | ピクセル上限、縮小、逐次処理 |
| OCR座標の回転・範囲変換ずれ | 高 | 純粋関数化、単体テスト |
| Windows Defenderの警告 | 中 | コード署名検討、配布説明 |
| OCR精度への過剰期待 | 中 | 注意書き、信頼度表示、原画像照合 |
| 依存更新で破壊的変更 | 中 | バージョン固定、更新手順、回帰試験 |
