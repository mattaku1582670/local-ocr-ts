# Local OCR Browser PoC

WBS 2.5から2.12までの、製品UIから隔離したOCR技術検証です。ReactとHeroUIはまだ導入しません。

## 前提

- Node.js 20.19以上
- WBS 2.3で確認したPP-OCRv5 mobileの検出・認識tar
- Microsoft Edge（E2E実行時）

## セットアップ

```powershell
npm.cmd install
npm.cmd run stage:assets -- --model-dir C:\path\to\verified-models
```

`stage:assets`はモデルのSHA-256を照合し、ONNX Runtime WebのWASMとともに`public/assets`へ配置します。配置先はGit管理対象外です。実行時にモデルやWASMをダウンロードする処理はありません。

PaddleOCR.js 0.4.2が依存する`@techstark/opencv-js`は初期化時に動的関数生成を行います。WBS 2.8でOpenCVを専用Workerへ移しましたが、document CSPから`unsafe-eval`を除いた試験ではOCRが完了しませんでした。このPoCでは`script-src 'unsafe-eval'`を維持し、本番Electronで許容できるかをGate Aのセキュリティ判断項目として扱います。

## 実行

```powershell
npm.cmd run dev
npm.cmd run build
npm.cmd run start:electron
npm.cmd run package:portable
```

画面で画像を選択するか、「英数字サンプルでOCR」または「日本語サンプルでOCR」を実行します。日本語サンプルは、対象OSであるWindows 11の`Yu Gothic UI`を使用してPNGを生成します。

## 検証

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npm.cmd run verify:build-assets
npm.cmd run test:e2e
npm.cmd run test:e2e:offline
npm.cmd run test:e2e:electron
```

実用画像での日本語精度、回転・範囲OCRの座標変換、完全なオフライン試験は後続WBSで判定します。

WBS 2.7では、E2Eが返却polygonの原画像寸法、4点構造、境界、点順、行順と、認識confidenceの0〜1範囲を検証します。回転・範囲OCR時の座標変換は対象外です。

WBS 2.8ではPaddleOCR.jsの専用module Workerを使用します。画面のheartbeatとE2EのWorker生成イベントにより、OCR中もメインスレッドが応答することを確認します。

WBS 2.9では、staging時とproduction build後の両方でモデル・WASMのハッシュを検証します。E2Eは検出モデル、認識モデル、WASMが同一オリジンの`/assets`から要求され、外部オリジン要求がないことを検証します。

WBS 2.10の`test:e2e:offline`は、外部ホストの名前解決を失敗させた専用Edgeプロセスを起動し、さらにPlaywrightでlocalhost以外のHTTP/HTTPS要求を強制中断します。この遮断条件で起動、ローカルモデル初期化、英数字・日本語OCRが成功することを検証します。OSのネットワークアダプターを実際に無効化する受入試験は、完成したportable版を対象とするWBS 21.11および22.9で別途実施します。

WBS 2.11の`test:e2e:electron`は、`local-ocr://app/`カスタムプロトコルでproduction buildを読み込みます。Electron rendererのsandbox、context isolation、Node.js分離を維持した状態で、ローカルWorker、モデル、WASMによる英数字・日本語OCRを検証します。

WBS 2.12の`package:portable`は、electron-builderのWindows x64 portable targetで単一EXEを`release`へ生成します。モデルとWASMは`extraResources/ocr-assets`へ配置し、ASARにはsource mapおよび同じOCR資産を重複同梱しません。`verify:portable`はPEヘッダー、EXEのSHA-256、packaged OCR資産10件のハッシュを検証します。portableからのOCR実行確認はWBS 2.13で行います。
