# WBS 7.1〜7.10 データモデル・状態管理

- 実施日: 2026-08-10
- ステータス: 完了
- 次WBS: 8.1「メインレイアウト作成」

## 実装と確認

| WBS | 対応 | 確認 |
|---|---|---|
| 7.1 | `ImageItem`、入力元、状態、回転角、選択範囲を型定義 | TypeScript型検査 |
| 7.2 | schema version付き`OcrDocument`、`OcrBlock`、metadataを型定義 | TypeScript型検査 |
| 7.3 | `Point`、`Rect`、`Polygon`を型定義 | TypeScript型検査 |
| 7.4 | IPC、入力、保存、OCR、モデル、メモリの`AppErrorCode`を定義 | TypeScript型検査 |
| 7.5 | Zustand image storeへ追加、選択、削除、全削除、更新を実装 | CRUD単体試験 |
| 7.6 | Zustand OCR storeへFIFO queue、active item、段階別progressを実装 | queue・progress単体試験 |
| 7.7 | renderer側Zod schemaでIPC応答を検証し、設定の読込・保存・リセットを実装 | IPC adapter単体試験、Electron E2E |
| 7.8 | 画像削除・全削除時に`URL.revokeObjectURL`を実行 | URL解放単体試験 |
| 7.9 | OCR結果生成・編集・回転後のdirtyと保存後の解除を実装 | dirty selector単体試験 |
| 7.10 | 3 storeの正常系・拒否系・境界値を追加 | 全52単体試験合格 |

## 状態の責務

- `useImageStore`: 画像メタデータ、選択状態、OCR結果、画像エラー、未保存状態を保持する。
- `useOcrStore`: OCR engine状態、重複しないFIFO queue、処理中画像、画像別progressを保持する。
- `useSettingsStore`: 永続化対象の設定だけをmain processのsettings IPCと同期する。
- React providerは起動時にsettingsをhydrateする。画像、OCR結果、object URL、選択状態は永続化しない。

## メモリと未保存データ

- object URLの所有権はimage storeに置き、画像をstoreから外す時点で解放する。
- OCR結果を受け取った時点と認識文字を編集した時点でdirtyにする。
- OCR済み画像の回転変更も、保存済み結果と表示条件が変わるためdirtyにする。
- 保存成功後は対象画像だけ`markSaved`でdirtyを解除する。
- `selectHasDirtyImages`を終了保護（WBS 19.8）から利用できる形にした。

## 検証結果

- format: 合格
- lint: 合格
- typecheck（renderer/main/preload）: 合格
- unit/integration: 11 files、52 tests合格
- production build: 合格
- Electron E2E: 1 test合格
