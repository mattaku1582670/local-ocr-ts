# WBS 2.11 Electron最小PoC組込み

## 結論

Electron 43.3.0のBrowserWindowへproduction OCR PoCを組み込み、`sandbox: true`を含む必須セキュリティ設定を維持したまま、PaddleOCR.jsの専用Worker、PP-OCRv5日本語モデル、ONNX Runtime Web WASMによる英数字・日本語OCRが成功した。

WBS 2.11の完了条件「Electron内でOCR」を達成した。portable EXE生成、packaged app内のモデル配置、移動後の資産解決はWBS 2.12以降で検証する。

## 採用構成

| 項目 | 構成 |
|---|---|
| Electron | 43.3.0、Windows x64 |
| main | TypeScript `.mts`からES module `.mjs`を生成 |
| preload | TypeScript `.cts`からCommonJS `.cjs`を生成 |
| renderer | WBS 2.5〜2.10のVite production build |
| renderer URL | `local-ocr://app/` |
| OCR engine | `PaddleOcrEngine`／`OcrEngine`インターフェース |
| OCR実行 | PaddleOCR.js専用module Worker |
| ORT backend | WASM |
| E2E | Playwright Electron |

ElectronはWBS 2.11のデスクトップ実行環境として必要なため、開発依存へ正確なバージョンを固定した。Electron実行コードをUIやOCRエンジンへ混在させず、`electron`ディレクトリへ分離した。

## ローカルプロトコル

renderer、Worker、モデル、WASMを`file:`で直接読み込まず、`local-ocr://app/`カスタムプロトコルをmain processで登録した。

プロトコルには次の属性を付与した。

- standard
- secure
- Fetch API対応
- CORS対応
- stream対応
- V8 code cache対応

要求パスはURLデコード後にrenderer buildディレクトリを基準として解決し、`path.relative`でルート外へ出るパスを拒否する。NULを含むパス、別host、別scheme、GET以外の要求も拒否する。実ファイル応答にはElectron `net.fetch`とローカルfile URLを使用する。

この方式により、rendererから任意のOSパスを指定するAPIを公開せず、CSPの`self`を維持したままWorkerとWASMのFetchを成立させた。

## Electronセキュリティ設定

BrowserWindowは次の設定で生成する。

```ts
nodeIntegration: false
contextIsolation: true
sandbox: true
webSecurity: true
devTools: false
```

加えて次を実装した。

- preloadから`contextBridge`経由で読み取り専用の実行環境情報だけを公開する。
- `ipcRenderer`およびNode.js APIは公開しない。
- `will-navigate`で`local-ocr://app`以外への遷移を拒否する。
- `setWindowOpenHandler`ですべての新規ウィンドウを拒否する。
- `will-attach-webview`でwebview追加を拒否する。
- permission requestをすべて拒否する。
- HTTP/HTTPS要求をsessionレベルで中断する。
- Chromiumのバックグラウンド通信を無効化する。
- DevToolsは既定で無効とする。

既存CSPは有効である。ただしPaddleOCR.jsが依存するOpenCV.jsのため`script-src 'unsafe-eval'`が残り、Gate Aのセキュリティリスクである点は変わらない。

## Electron E2E

Playwrightから実Electronプロセスを起動し、次を検証した。

- main windowが`local-ocr://app/`を読み込む。
- preloadが`process.sandboxed === true`を報告する。
- rendererの`require`と`process`が`undefined`である。
- DevToolsが開いていない。
- data URLへのナビゲーションが拒否され、main window URLが変わらない。
- `window.open`が拒否され、BrowserWindowが1件のままである。
- 検出モデルと認識モデルがローカルプロトコルから取得される。
- `/assets/wasm/`配下のWASMが取得される。
- `worker-entry`がWorkerとして起動する。
- WASM backend／Worker modeで英数字OCRが成功する。
- 同一セッションで日本語OCRが成功する。
- 外部HTTP/HTTPS要求、失敗要求、ページ例外が0件である。

最終結果は1件成功、試験本体10.5秒、コマンド全体11.7秒だった。時間にはElectron起動、モデル初期化、英数字・日本語OCRを含む。

## Electronバイナリ取得

`electron` npmパッケージの導入自体は成功したが、パッケージ内のNode.jsダウンローダーが現在のプロキシ環境で`fetch failed`となり、実行バイナリを取得できなかった。

公式GitHubリリースの`electron-v43.3.0-win32-x64.zip`をcurlで一時取得し、Electronパッケージ同梱`checksums.json`のSHA-256と一致することを確認してから`node_modules/electron/dist`へ展開した。

```text
18528bedc6a9b04bdc5efb7b803cbc3cb0e5ea6415d54046e23d464d89a00da9
```

検証後、一時ZIP 144,396,349 bytesは削除した。`node_modules`と生成される`dist-electron`はGit管理対象外である。クリーン環境の開発セットアップでは、Electron公式配布先へ接続できること、または検証済み社内キャッシュを使用できることが必要になる。これは製品実行時のネットワーク依存ではない。

## 自動検証結果

2026-08-06の最終実行結果は次のとおり。

| 検証 | 結果 |
|---|---|
| `npm run lint` | 成功、29ファイル |
| `npm run typecheck` | renderer／Electronとも成功 |
| `npm run test` | 2ファイル、3件成功 |
| production renderer build | 成功 |
| Electron main/preload build | 成功 |
| staging資産検証 | 10件成功 |
| build後資産検証 | 10件とWorker entry 1件に成功 |
| Electron OCR E2E | 1件成功、11.7秒 |
| 通常ブラウザOCR E2E | 2件成功、26.1秒 |
| 通信遮断ブラウザOCR E2E | 1件成功、16.2秒 |
| npm audit | 脆弱性0件 |

## 残存リスク

- `unsafe-eval`を必要とするOpenCV.js依存
- production JavaScript内の外部URLリテラル11件
- Worker bundle、main bundle、WASM、モデルによる配布容量
- packaged app／ASAR／extraResourcesでのモデル・WASMパス
- portable EXEでの起動とOCR
- 日本語・空白を含むportable配置パス
- キャンセル時のWorker強制終了と再初期化
- Electronバイナリ取得に対する開発環境のプロキシ制約

## 完了条件

Electron 43.3.0のsandboxed renderer内で、ローカルWorker・モデル・WASMを使用した英数字・日本語OCRが成功したため、WBS 2.11を完了と判定する。

## 次のWBS

WBS 2.12「portableビルドを作成」を実施する。electron-builderのWindows portable targetを第一候補とし、EXE生成、資産同梱方法、出力サイズ、起動可否を検証する。
