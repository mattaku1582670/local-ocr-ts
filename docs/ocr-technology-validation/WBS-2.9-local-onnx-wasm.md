# WBS 2.9 ONNX/WASMローカル配置検証

## 結論

PaddleOCR.js 0.4.2とONNX Runtime Web 1.27.0を使用するブラウザPoCについて、検出・認識モデル、ORTのMJS/WASM、OCR Workerをproduction buildへローカル同梱できた。Microsoft Edge headlessでproduction previewに対して実OCRを行い、モデル2件とWASMが同一オリジンの`/assets`から取得され、外部オリジンへの実行時要求が0件であることを確認した。

したがって、WBS 2.9の完了条件「CDNなしで起動」はブラウザPoCの範囲で満たす。ネットワークアダプターを無効化した環境とElectron portableからの読込みは未検証であり、それぞれWBS 2.10と後続のElectron／配布検証で判定する。

## ローカル資産構成

`scripts/stage-assets.mjs`は、検証済みのローカルモデル原本とインストール済み`onnxruntime-web`パッケージから次の10資産を`public/assets`へ複製する。実行時ダウンロードは行わない。

| 種別 | 資産 | サイズ（bytes） |
|---|---|---:|
| 検出モデル | `PP-OCRv5_mobile_det_onnx_infer.tar` | 4,843,520 |
| 認識モデル | `PP-OCRv5_mobile_rec_onnx_infer.tar` | 16,701,440 |
| ORT asyncify loader | `ort-wasm-simd-threaded.asyncify.mjs` | 47,507 |
| ORT asyncify WASM | `ort-wasm-simd-threaded.asyncify.wasm` | 24,254,953 |
| ORT JSEP loader | `ort-wasm-simd-threaded.jsep.mjs` | 46,614 |
| ORT JSEP WASM | `ort-wasm-simd-threaded.jsep.wasm` | 26,827,543 |
| ORT JSPI loader | `ort-wasm-simd-threaded.jspi.mjs` | 44,523 |
| ORT JSPI WASM | `ort-wasm-simd-threaded.jspi.wasm` | 15,046,878 |
| ORT threaded loader | `ort-wasm-simd-threaded.mjs` | 24,180 |
| ORT threaded WASM | `ort-wasm-simd-threaded.wasm` | 13,479,978 |

staging時に`.asset-integrity.json`を生成し、ファイルサイズとSHA-256を記録する。モデルについては設定ファイルに固定した期待SHA-256とも照合する。

## production build検証

`npm run build`を次の順に構成した。

1. `verify-staged-assets.mjs`でstaging済み10資産の存在、サイズ、SHA-256、ORTバージョンを検証する。
2. Viteでproduction buildを生成する。
3. `verify-built-assets.mjs`で`dist`内の10資産をintegrity manifestと再照合する。
4. production bundleがローカルのモデル基底パス、モデルファイル名、WASM基底パス、専用Worker entryを参照することを検証する。
5. `index.html`の`src`／`href`とCSSの`url()`に外部参照がないことを検証する。

生成物には専用Worker entryが1件含まれ、検出・認識モデルとORT MJS/WASMは`dist/assets`配下へ保持された。

## 実行時通信の検証

Playwright E2Eはproduction previewで英数字画像と日本語画像をOCRする。英数字試験ではブラウザのrequestイベントを記録し、次を検証した。

- 検出モデル`/assets/models/PP-OCRv5_mobile_det_onnx_infer.tar`が要求される。
- 認識モデル`/assets/models/PP-OCRv5_mobile_rec_onnx_infer.tar`が要求される。
- `/assets/wasm/`配下の`.wasm`が要求される。
- `worker-entry`がWorkerとして起動する。
- ページのオリジンと異なるHTTP/HTTPS要求が0件である。
- 失敗した要求、ページ例外が0件である。

結果は2件成功、全体28.7秒だった。この時間にはOCRモデル初期化を含み、純粋な推論性能値ではない。

## 静的な外部URL文字列

production JavaScriptには、依存ライブラリ由来の外部URLリテラルが11件残る。確認できた主な分類は次のとおりである。

- PaddleOCR.jsが持つ既定モデルURL
- ONNX Runtime Webの既定CDN fallback URL
- ライセンス／ドキュメント参照URL

PoCはモデルURLと`wasmPaths`を必須のローカルURLとして明示指定するため、今回のE2Eではこれらへの通信は発生しなかった。しかし、設定欠落時にfallbackへ到達し得る依存コードを成果物から除去できていない。このため、システム設計書の後続検査で求める「成果物内の`http://`または`https://`依存0件」は未達として扱う。

特に、依存コード内のORT fallbackはインストール済み1.27.0とは異なる1.24.3を指すため、`wasmPaths`の明示指定と起動時検証を必須に維持する。WBS 21.6までに、tree-shaking、依存コードの安全な置換、または許容不能なら技術選定への影響を再評価する。

## 自動検証結果

2026-08-06に次を実行した。

| 検証 | 結果 |
|---|---|
| `npm run lint` | 成功 |
| `npm run typecheck` | 成功 |
| `npm run test` | 2ファイル、3件成功 |
| staging資産検証 | 10件成功 |
| production build | 成功 |
| build後資産検証 | 10件とWorker entry 1件に成功 |
| OCR E2E | 2件成功、28.7秒 |
| 外部オリジンへの実行時要求 | 0件 |
| 失敗した要求 | 0件 |
| ページ例外 | 0件 |

ビルド時にはOpenCV.jsのNode builtin外部化警告と大容量chunk警告が出る。ブラウザOCRは成功しているが、Worker bundle約11.3 MB、main bundle約10.5 MB、使用されたJSEP WASM約26.8 MBであり、配布容量、起動時間、重複bundleは後続の性能・配布検証対象とする。

## 未検証事項

- Windowsのネットワークアダプターを無効化した状態での起動とOCR
- Electronの`file:`またはカスタムプロトコル環境での資産解決
- Electron sandboxとCSPを有効化した状態でのWorker／WASM初期化
- portable EXEを移動した場合、日本語・空白を含むパスの場合の資産解決
- production JavaScriptからの外部URLリテラル除去
- ORT資産8件をすべて同梱する必要性と、安全に削減できる組合せ

## 完了条件

WBS 2.9の完了条件「CDNなしで起動」は、production browser PoCでローカル資産だけを実際に要求して英数字・日本語OCRが成功したため達成と判定する。

## 次のWBS

WBS 2.10「ネットワーク遮断試験」を実施する。ブラウザのrequest監視だけでなく、OS側で外部通信を遮断した条件において、production buildの起動、モデル初期化、英数字・日本語OCRが成功することを確認する。
