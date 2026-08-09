# WBS 2.8 Worker内実行検証

## 結論

PaddleOCR.js 0.4.2の専用module Worker内で、PP-OCRv5日本語対応モデルとONNX Runtime Web WASMを初期化し、英数字画像と日本語画像をOCRできた。OCR中もrendererメインスレッドの50ms heartbeatが継続した。

自動E2Eで次を確認した。

- Viteが生成した同一オリジンの`worker-entry`をWorkerとして起動する。
- OCR開始300ms後も処理状態が`working`である。
- 同じ300msの間にメインスレッドのheartbeatが3回以上進む。
- OCR結果のexecution modeが`worker`である。
- WASM backendで英数字・日本語OCRが成功する。
- 外部オリジンへの通信、失敗リクエスト、ページ例外がない。

WBS 2.8の完了条件「UI非停止でOCR」を、この最小技術検証の範囲で満たす。Electron renderer、長時間・巨大画像、キャンセル、Worker異常復旧は後続WBSで確認する。

## 検証構成

| 項目 | 構成 |
|---|---|
| OCR SDK | `@paddleocr/paddleocr-js` 0.4.2 |
| Worker方式 | SDK内蔵の専用module Worker |
| OCR設定 | `worker: true` |
| ORT backend | WASM |
| ORT proxy | 無効 |
| ORT thread数 | 1 |
| 入力転送 | `ImageBitmap`を複製後、TransferableとしてWorkerへ転送 |
| model/WASM | 同一オリジンのローカル資産 |
| E2Eブラウザ | Microsoft Edge headless |

これはONNX Runtime Webの`env.wasm.proxy`ではない。OCR SDK自身が持つWorker transportを利用し、そのWorker内でOpenCV、検出モデル、認識モデル、ORTを初期化・実行する。SDKはWorker mode時にORT WASM proxyを内部でも無効化する。

## 実装

`PaddleOcrEngine`の初期化を`worker: false`から`worker: true`へ変更した。UIは引き続き仕様書の`OcrEngine`インターフェースだけを呼び出し、SDKのWorker transportを直接参照しない。

PoCの正規化runtime情報へ次を追加した。

```ts
executionMode: "main-thread" | "worker";
```

現構成は常に`worker`を記録する。これはPoCの検証用metadataであり、Worker生成の独立した証拠としてPlaywrightの`page.on("worker")`でも`worker-entry` URLを検出する。

## UI応答性の検証方法

画面へ50ms間隔のheartbeat counterを追加した。E2EはOCRボタンを押す直前の値を取得し、300ms後に次を検証する。

1. OCR状態がまだ`working`である。
2. heartbeatが3回以上増えている。
3. その後OCRが正常完了する。

メインスレッドで同期的にOCRが実行されてイベントループを占有した場合、OCR処理中にinterval callbackを実行できない。この試験ではOCR初期化・推論中にも複数回callbackが実行されたため、メインスレッドが応答可能であることを確認できる。

50ms間隔に対して300msで3回という基準は、負荷変動を許容しつつ完全停止を検出するためのPoC基準である。フレームレート、最大event-loop遅延、入力応答時間の性能保証ではない。

## Worker bundleと資産解決

production buildは次の専用Worker bundleを生成した。

```text
worker-entry-C9UNuyOJ-EhIzhVdm.js
11,341,486 bytes
```

E2EはWorker URLに`worker-entry`が含まれることを確認する。モデルURLとWASM URLは絶対HTTP URLではなく、現在の同一オリジンを基準とするローカル資産URLを初期化payloadとしてWorkerへ渡す。

Worker実行時にも外部オリジン要求は0件だった。ただし、資産配置・全ビルド成果物の外部URL検査はWBS 2.9、ネットワークアダプター遮断状態はWBS 2.10で正式に判定する。

## 入力とリソース所有権

SDKはmain threadから渡された`ImageBitmap`を直接移送せず、`createImageBitmap`で複製したものをWorkerへtransferする。そのため、呼び出し元が保持する入力bitmapをSDKがdetached状態にしない。PoCは呼び出し元bitmapを`finally`で閉じる。

SDKの`dispose()`はWorkerへdispose要求を送り、その後transportがWorkerをterminateする。PoCはページ終了時に`engine.dispose()`を呼び出す。本番アプリでは`beforeunload`だけに依存せず、OCR機能の明示的なライフサイクルでdispose完了を管理する必要がある。

## CSP検証

PaddleOCR.jsが依存するOpenCV.jsは動的関数生成を使用する。Worker移行後にdocument CSPの`script-src`から`unsafe-eval`を除外した構成も試したが、標準E2EがOCR完了へ到達せず、2回とも180秒を超過した。PoCは直前に成功した`unsafe-eval`許可構成へ戻し、同じWorker E2Eが再び成功することを確認した。

したがって、Worker隔離によってdocument CSPの`unsafe-eval`を直ちに除去できるとは判定しない。この要件はGate Aのセキュリティリスクとして残る。Electron組込み時には、renderer documentとWorker responseへ適用されるCSPを分け、OpenCVをWorkerだけに限定できるかを検証する。

## キャンセルと異常復旧

SDK 0.4.2のWorker transportが公開する基本処理は`init`、`predict`、`dispose`であり、進行中推論をrequest単位でキャンセルするAPIは確認できなかった。現在の`OcrCapabilities.cancellationDuringInference`は`false`のままである。

製品要件のキャンセルは、Worker terminationと安全な再初期化を含む独自制御が必要になる可能性がある。今回、Workerの強制終了、pending requestの扱い、再初期化は実装していない。これらはWBS 11.14と11.16の対象である。

SDKのWorker error handlerはpending requestをrejectするが、製品としてのユーザー通知、queue継続、再試行、編集結果保護までは提供しない。

## 自動検証結果

2026-08-06の最終実行結果は次のとおり。

| 検証 | 結果 |
|---|---|
| lint | 成功 |
| TypeScript strict | 成功 |
| 単体テスト | 2ファイル、3件成功 |
| ローカル資産検証 | 10件成功 |
| production build | 成功 |
| 英数字Worker OCR E2E | 成功、14.4秒 |
| 日本語Worker OCR E2E | 成功、8.7秒 |
| E2E全体 | 2件成功、29.3秒 |
| 外部オリジン要求 | 0件 |
| 失敗リクエスト | 0件 |
| ページ例外 | 0件 |

時間にはページ操作と初期化を含むため、純粋なOCR性能値としては扱わない。

## Gate Aへの反映

Gate A条件のうち「Worker内で実行できる」について、ブラウザproduction buildで成立を確認した。日本語OCR、ローカルmodel/WASM、polygon、confidenceもWorker modeで引き続き取得できた。

肯定材料:

- OCR pipelineを専用Workerで実行できる。
- UIメインスレッドのheartbeatがOCR中も進む。
- ViteがWorker bundleをproduction成果物へ出力できる。
- 同一オリジンのローカルmodel/WASMでWorker OCRが成功する。

残るGateリスク:

- `unsafe-eval`依存
- ElectronのCSP・sandboxとの互換性
- portableでのWorker、model、WASMパス
- キャンセルとWorker異常復旧
- 大画像での応答性、速度、メモリ
- Worker bundleとmain bundleの重複による配布容量

このためWBS 2.8は完了とするが、Gate A全体の採用判断は引き続き保留する。

## 完了条件

WBS 2.8の完了条件「UI非停止でOCR」を最小PoCの範囲で満たす。

## 次のWBS

WBS順序に従い、次はWBS 2.9「ONNX/WASMローカル配置を検証」を実施する。
