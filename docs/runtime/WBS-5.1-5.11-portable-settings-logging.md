# WBS 5.1〜5.11 ポータブルパス・設定・ログ

- 実施日: 2026-08-10
- ステータス: 完了
- 次WBS: 6.1「画像ファイル選択IPC」

## 実装と確認

| WBS | 対応 | 確認 |
|---|---|---|
| 5.1 | Electronの`isPackaged`とportable環境変数からdevelopment/packaged/portableを判定 | モード別単体試験 |
| 5.2 | development、portable EXE位置、EXE隣接、userDataの候補を生成し、実ファイル書込で選定 | 優先順位・フォールバック単体試験 |
| 5.3 | version 1のstrict settings schemaを定義 | typecheck、未知フィールド拒否試験 |
| 5.4 | `settings.json`読込とpreload設定APIを実装 | Electron E2Eで読込 |
| 5.5 | 設定保存と再読込を実装 | Electron E2Eで往復確認後に元値復元 |
| 5.6 | 欠損・破損・schema不適合時に既定値へフォールバック | 単体試験 |
| 5.7 | `window-state.json`へ通常時の位置・寸法・最大化状態を保存・復元 | service単体試験、Electron終了時保存 |
| 5.8 | JSON Lines形式のローカルloggerを実装 | 日本語パス書込試験 |
| 5.9 | ログイベントとcontextをZodで限定し、自由文・OCR本文・パスを拒否 | 禁止フィールド試験 |
| 5.10 | byte上限到達時の世代ローテーションを実装 | 最大ファイル数試験 |
| 5.11 | 設定・window state・ログを日本語と空白を含む一時パスで試験 | 全件成功 |

## データ保存先の優先順位

1. 開発時はプロジェクト直下`data/`
2. electron-builder portable環境ではportable EXEの隣接`data/`
3. packagedアプリでは実行EXE隣接`data/`
4. 書込不可の場合はElectron `userData`

候補の書込確認ではランダム名の空ファイルを作成し、直後に削除する。検査ファイルを残さず、候補が書込不可でも次候補を試す。

## ログのプライバシー境界

loggerは任意メッセージ文字列を引数に取らない。eventは列挙値、contextはアプリバージョン、OS、処理時間、画像寸法、件数、エラーコード等の許可フィールドだけを受け付ける。未知フィールドはstrict schemaで拒否する。
