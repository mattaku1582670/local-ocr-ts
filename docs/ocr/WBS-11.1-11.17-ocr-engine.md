# WBS 11.1〜11.17 OCRエンジン

- 実施日: 2026-08-10
- ステータス: 完了
- 次WBS: 12.1「PreprocessPreset型定義」

## 実装と確認

| WBS | 対応 | 確認 |
|---|---|---|
| 11.1 | 初期化、認識、破棄、能力、進捗、キャンセルを`OcrEngine`として定義 | TypeScript型検査 |
| 11.2 | `paddle-wasm`を選択するfactoryを実装 | factory単体試験 |
| 11.3 | INITIALIZE、RECOGNIZE、DISPOSEと応答のdiscriminated unionを定義 | serialization単体試験 |
| 11.4 | 専用Workerで初期化し、READYを受信後にreadyへ遷移 | Worker単体試験、Electron E2E |
| 11.5 | `document.baseURI`相対でモデルURLを解決 | HTTP、`local-ocr:`、file URL単体試験 |
| 11.6 | 同一originの`assets/wasm/`を解決 | local URL単体試験、Electron E2E |
| 11.7 | PP-OCRv5 mobile det/recをWASM backendで初期化 | 実モデルElectron E2E |
| 11.8 | ImageBitmapをWorkerへtransferして`predict`を実行 | 実WASM認識E2E |
| 11.9 | Paddle結果をアプリ共通resultへ正規化 | 単体試験 |
| 11.10 | 非有限値をnull、有限値を0〜1へclamp | 境界値単体試験 |
| 11.11 | 行許容差を用いて上から下、同一行は左から右へ整列 | 複数行単体試験 |
| 11.12 | 整列済みblockを改行結合して`rawText`を生成 | 単体試験、実認識E2E |
| 11.13 | queued、preprocessing、detecting、recognizing、completeを通知 | engine単体試験 |
| 11.14 | Abort時に外側Workerをterminateし、未完了requestをcancel例外でreject | abort単体試験 |
| 11.15 | Paddle資源をdispose後、Workerをterminate | idempotent dispose単体試験 |
| 11.16 | Worker crash時にpendingをrejectし、新しいWorkerを1回再初期化 | crash単体試験 |
| 11.17 | 単体、integration、本番build、実Electronを通過 | 24 files・105 tests、Electron 2 tests |

## 実行構成

rendererはモデル本体やONNX Runtimeをmain threadへ読み込まない。外側の`paddleOcr.worker.ts`が製品のrequest/response、進捗、cancel、crash復旧の境界を持つ。PaddleOCR.js 0.4.2はWorker用の画像前処理でOffscreenCanvasを使用するため、外側Worker内からPaddleの内蔵推論Workerを有効にする。これによりDOM非依存の画像変換と、製品側Workerの強制停止を両立する。

Worker内のrequestは直列化し、初期化中の破棄や複数predictによるmodel resource競合を防ぐ。Abortまたはcrashでは外側Workerを終了するため、その配下の推論Workerも破棄される。初期化optionsを保持している場合だけ、新しいWorkerによる再初期化を1回試みる。

## ローカル資産

| 資産 | 固定値 |
|---|---|
| PaddleOCR.js | 0.4.2 |
| ONNX Runtime Web | 1.27.0 |
| detection model SHA-256 | `781056046c9ed77a15c94681605db6a0f62317c2e9cce6931c71da2478d4bc30` |
| recognition model SHA-256 | `f7e792bc836f36e7ef895ad47c426d75b0b75b1650caa6d63fe9418441ffba8c` |

`npm run stage:ocr-assets`はモデルhashを検査し、2モデルと8個のORT WASM/MJS資産を`public/assets/`へ配置する。binaryはGit対象外とし、アプリはCDN fallbackを使わない。productionでは`local-ocr://app/`のsecure custom protocolからdist配下だけを配信し、path traversalを拒否する。

## 検証結果

- format: 合格
- lint: 合格
- typecheck（renderer/main/preload）: 合格
- unit/integration: 24 files、105 tests合格
- production build: 合格
- Electron E2E: 2 tests合格
- 実OCR: 480×120の合成ImageBitmapから`LOCAL OCR`を認識
- runtime: requested backend `wasm`、execution mode `worker`
- network: model 2件、WASM、Workerはすべて`local-ocr://app/`から取得し、HTTP/HTTPS request 0件

本番distは約151.15 MBで、そのうちstaged model/WASMが約101.32 MBである。配布時のasset配置とbundle size最適化はWBS 15および21の成果物で再検証する。
