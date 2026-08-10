# WBS 9.1〜9.9 画像一覧UI

- 実施日: 2026-08-10
- ステータス: 完了
- 次WBS: 10.1「ImageBitmapデコード」

## 実装と確認

| WBS | 対応 | 確認 |
|---|---|---|
| 9.1 | object URLを利用したアスペクト比維持サムネイル | component test |
| 9.2 | 名前、寸法、状態、未保存、エラーを持つ画像カード | component test |
| 9.3 | click/focus選択をstoreへ同期し、preview placeholderへ選択名を反映 | App統合試験 |
| 9.4 | image statusとOCR storeの画像別progressを表示 | progress試験 |
| 9.5 | 編集済みOCRテキストをUnicode code point単位で計数 | 日本語文字数試験 |
| 9.6 | 個別削除、dirty時確認、URL解放、削除後の隣接選択 | 削除試験 |
| 9.7 | 全件clear、dirtyを含む場合の確認、全URL解放 | clear試験 |
| 9.8 | listbox/option構造と`↑`、`↓`、`Home`、`End`、`Delete`操作 | keyboard試験 |
| 9.9 | 画像一覧の表示・選択・進捗・削除を自動試験 | 全69単体・統合試験合格 |

## 表示仕様

- 一覧は追加順を保持し、各画像を独立した`option`として表示する。
- サムネイルは72 × 72 pxの枠内へ`object-fit: contain`で収め、元のアスペクト比を維持する。
- 状態は待機中、読込中、OCR待ち、OCR処理中、OCR完了、エラー、キャンセル済みを日本語表示する。
- OCR処理中は画像別progressを整数パーセントで表示する。
- OCR成功後は`editedText`のUnicode code point数を認識文字数として表示する。
- dirtyは色だけに依存せず「未保存」ラベルで表示する。

## 削除仕様

- dirtyでない画像は確認なしで一覧から削除する。
- dirty画像の個別削除と、dirty画像を含む全件clearは確認を要求する。
- 削除はstore内データとobject URLだけを対象とし、原本ファイルには触れない。
- 選択中の画像を削除した場合は同じ位置の次画像、末尾なら直前画像を選択する。

## 検証結果

- format: 合格
- lint: 合格
- typecheck（renderer/main/preload）: 合格
- unit/integration: 15 files、69 tests合格
- production build: 合格
- Electron E2E: 1 test合格
