# Local OCR

Windows向けの、完全オフラインで動作するポータブルOCRアプリです。製品実装ではGate AとしてPaddleOCR.js + ONNX Runtime Web / WASMを採用します。現在はElectron・Reactの開発基盤まで実装済みで、OCR機能は技術検証PoCから製品コードへ段階的に移行します。

## 必要環境

- Windows 11 x64
- Node.js 24.14.0（`.nvmrc`で固定）
- npm 11.9.0

## セットアップ

```powershell
npm.cmd ci
```

PowerShellの実行ポリシーで`npm.ps1`が拒否される環境では、上記のように`npm.cmd`を使用してください。

## 開発起動

```powershell
npm.cmd run dev
```

Vite rendererを`127.0.0.1:5173`で起動し、セキュア設定のElectronウィンドウから表示します。外部CDNや初回ダウンロードには依存しません。

## 品質チェック

```powershell
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
```

## 主なディレクトリ

- `src/`: renderer、React UI、状態管理、OCR製品コード
- `electron/`: Electron main/preload
- `e2e/`: Electron E2E
- `poc/`: OCR技術検証コード
- `docs/`: 判断記録、検証記録、後工程課題

## セキュリティ上の前提

- rendererは`nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`
- Node.js機能はpreloadで許可したAPIだけを公開
- OCRモデル、辞書、WASMをローカル同梱し、外部通信を使用しない
- 原画像は変更せず、作業用データだけを処理

開発・受入条件の詳細は`LocalOCR_詳細要件定義書.md`、設計は`LocalOCR_システム設計書.md`、実装順は`LocalOCR_WBS.md`を参照してください。
