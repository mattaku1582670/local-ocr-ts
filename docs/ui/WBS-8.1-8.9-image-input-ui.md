# WBS 8.1〜8.9 画像入力UI

- 実施日: 2026-08-10
- ステータス: 完了
- 次WBS: 9.1「サムネイル生成」

## 実装と確認

| WBS | 対応 | 確認 |
|---|---|---|
| 8.1 | ヘッダー、3ペイン、ステータスバーのメインレイアウト | component test、Electron E2E |
| 8.2 | 要件にある9操作をツールバーへ配置 | 全ボタンのaccessible name試験 |
| 8.3 | 対応形式と複数選択を案内するkeyboard操作可能なdrop zone | component test、Electron E2E |
| 8.4 | 複数`File`のdropを受付け、拡張子・MIME・signature・0 byte・50 MiB上限を検証 | 正常・偽装形式試験 |
| 8.5 | 「画像を開く」をmain processのnative dialog IPCへ接続 | hook統合試験 |
| 8.6 | 編集領域と競合しない`Ctrl+V`をclipboard IPCへ接続 | shortcut統合試験 |
| 8.7 | 一部拒否、非対応形式、clipboard画像なしをstatus barへ通知 | service・hook試験 |
| 8.8 | 同一画像も別作業項目として許可し、取込ごとに一意IDを割当て | store重複ID試験、方針記録 |
| 8.9 | drop zone、入力検証、file/clipboard連携を自動試験 | 全62単体・統合試験合格 |

## 入力フロー

1. ファイル選択はrendererから引数なしのpreload APIを呼び、main processがnative dialogと内容検証を担当する。
2. clipboard画像はmain processがPNGへ変換し、rendererはIPC応答をZod schemaで再検証する。
3. dropされたファイルはrendererで拡張子、MIME、signature、サイズを検証する。
4. 検証済みbytesからobject URLを生成し、decode後の寸法を`ImageItem`へ格納する。
5. decode失敗時はその場でobject URLを解放し、成功時はimage storeが削除まで所有する。

## UI方針

- 入力段階では「画像を開く」「貼り付け」だけを有効にする。
- OCR、範囲OCR、一括OCR、キャンセル、コピー、保存、設定は後続WBSの接続まで無効表示する。
- `Ctrl+V`はinput、textarea、select、contenteditableへフォーカス中は横取りしない。
- ファイル選択のキャンセルは画像状態も通知も変更しない。
- 重複画像を許可する。比較や別範囲OCRを妨げず、各取込をUUIDで独立管理する。

## 検証結果

- format: 合格
- lint: 合格
- typecheck（renderer/main/preload）: 合格
- unit/integration: 14 files、62 tests合格
- production build: 合格
- Electron E2E: 1 test合格
