# WBS 6.1〜6.12 ファイル・クリップボードIPC

- 実施日: 2026-08-10
- ステータス: 完了
- 次WBS: 7.1「ImageItem型定義」

## 実装と確認

| WBS | 対応 | 確認 |
|---|---|---|
| 6.1 | mainのnative open dialogから複数画像を選択 | dialog adapter統合試験 |
| 6.2 | PNG/JPG/JPEG/WebP/BMPのフィルタを設定 | dialog呼出引数試験 |
| 6.3 | 拡張子、signature、Electron nativeImageデコードを照合 | 偽装拡張子・デコード失敗試験 |
| 6.4 | mainで読込んだ画像を`Uint8Array`とメタデータで返却 | 複数画像読込試験 |
| 6.5 | 0 byte拒否、1ファイル50 MiB上限 | empty・sparse large file試験 |
| 6.6 | Electron clipboard画像をPNGへ変換 | clipboard service試験 |
| 6.7 | UTC日時とUUID断片から一意な仮名を生成 | 同一時刻の重複防止試験 |
| 6.8 | native save dialog経由でUTF-8 TXT保存 | 日本語内容・ファイル名試験 |
| 6.9 | JSON serializable検証後、整形JSONを保存 | 正常・BigInt拒否試験 |
| 6.10 | 権限、容量、パス、その他をcode付きAppErrorへ分類 | エラーコード試験 |
| 6.11 | 日本語と空白を含む一時パスでTXT/JSON保存 | 実ファイル試験 |
| 6.12 | service、IPC登録、bundle済みsandbox preloadを統合 | 39単体試験、Electron E2E |

## セキュリティ境界

- rendererは読込・保存先の任意パスをmainへ送れない。
- 読込パスはOS open dialog、保存パスはOS save dialogの戻り値だけを使用する。
- rendererへ返す画像情報に元のフルパスを含めない。
- 画像ごとの拒否理由は直列化したcode付きerrorで返し、ファイル名や内容をログへ渡さない。
- preload APIはbundleし、sandbox preloadで許可されない相対`require`を残さない。

## 上限

- 画像ファイル: 1件50 MiB
- TXT/JSON保存内容: 10 MiB
- JSONへ直列化できない値は`SAVE_INVALID_CONTENT`として拒否
