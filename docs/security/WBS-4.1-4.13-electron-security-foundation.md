# WBS 4.1〜4.13 Electronセキュリティ基盤

- 実施日: 2026-08-10
- 対象: 製品Electron main/preload/renderer境界
- ステータス: 完了

## 実装と確認

| WBS | 対応 | 確認 |
|---|---|---|
| 4.1 | `createWindow.ts`へBrowserWindow生成を分離 | Electron E2Eで表示 |
| 4.2 | `nodeIntegration: false` | rendererに`require`がないことをE2E確認 |
| 4.3 | `contextIsolation: true` | preload APIだけが公開されることをE2E確認 |
| 4.4 | `sandbox: true` | preload APIとrenderer表示がsandbox有効で成功。OCR WorkerはWBS 2.8/2.11で分離実行済み |
| 4.5 | `Window.desktopApi`のreadonly型を定義 | typecheck成功 |
| 4.6 | `contextBridge`でバージョン情報だけを公開 | Electron E2E成功 |
| 4.7 | IPCチャンネル名を用途別の凍結定数へ集約 | typecheck成功 |
| 4.8 | IPC引数用strict Zod schemaと共通parse関数を追加 | 正常・不正入力の単体試験 |
| 4.9 | 現在URLと一致しない`will-navigate`を拒否 | URL判定単体試験 |
| 4.10 | `window.open`を外部ブラウザ委譲も含め全面拒否 | Electron E2E成功 |
| 4.11 | offline OCRに必要なWASM/Worker/blobだけを許可するCSP | meta内容をElectron E2E確認 |
| 4.12 | productionでは`webPreferences.devTools: false` | 製品window設定へ反映 |
| 4.13 | 単体・component・Electron統合試験 | `npm test`、`npm run test:e2e` |

## IPC実装時のルール

後続のIPC handlerは、`ipcMain.handle`の先頭で対応するZod schemaと`parseIpcInput`を必ず使用する。ファイルパスはrendererから自由入力させず、dialog戻り値またはmain側で発行した識別子を使う。
