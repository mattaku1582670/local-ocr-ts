# WBS 3.2〜3.17 開発基盤

- 実施日: 2026-08-10
- 対象: 製品コード（ルートプロジェクト）
- package manager: npm 11.9.0
- Node.js: 24.14.0

## 実装内容

| WBS | 内容 | 確認方法 |
|---|---|---|
| 3.2 | `.nvmrc`と`engines.node`を24.14.0へ固定 | `node --version` |
| 3.3 | npmを採用し、正確な依存バージョンをlockfileへ記録 | `npm ci` |
| 3.4 | React + TypeScript + Viteの製品rendererを作成 | `npm run build` |
| 3.5 | Electron main/preloadと開発起動スクリプトを追加 | Electron E2E |
| 3.6 | HeroUI 3のCard、Button、Chipを初期画面に使用 | component test / build |
| 3.7 | Zustand storeとUIからの更新例を追加 | component test |
| 3.8 | Zodによる環境設定schema検証を追加 | typecheck / test |
| 3.9 | ESLint flat configとTypeScript型付きルールを追加 | `npm run lint` |
| 3.10 | Prettier設定と対象を限定したformatコマンドを追加 | `npm run format:check` |
| 3.11 | renderer/main/preloadのTypeScript strictを有効化 | `npm run typecheck` |
| 3.12 | Vitest + jsdomを設定 | `npm test` |
| 3.13 | React Testing Libraryで3ペイン表示とstore連携を試験 | `npm test` |
| 3.14 | Playwright Electron起動試験を追加 | `npm run test:e2e` |
| 3.15 | `.env.development`と`.env.production`を分離 | build時Zod検証 |
| 3.16 | Windows CIでformat/lint/typecheck/test/buildを実行 | GitHub Actions |
| 3.17 | セットアップ・起動・品質確認手順をREADMEへ記載 | 記載コマンドをローカル実行 |

## 補足

PoCは検証証拠として`poc/`へ保持し、製品コードへ直接流用しない。製品のOCR実装は、確定した`OcrEngine`境界とA4画像の縮小条件を守って後続WBSで移行する。
