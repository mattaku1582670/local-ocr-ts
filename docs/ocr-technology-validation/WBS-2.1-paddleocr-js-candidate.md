# WBS 2.1 PaddleOCR.js候補パッケージ調査

- 対象WBS: 2.1 PaddleOCR.js候補パッケージを特定
- 調査日: 2026-08-06
- 状態: 完了
- この文書の判断範囲: 技術検証で使用する第一候補の特定
- Gate A/B判断: 未実施

## 結論

Gate Aの第一候補として、PaddlePaddle公式の次のパッケージを採用候補にする。

| 項目 | 内容 |
|---|---|
| npm package | `@paddleocr/paddleocr-js` |
| 技術検証で固定する候補バージョン | `0.4.2` |
| ソース | `PaddlePaddle/PaddleOCR`リポジトリ内の`paddleocr-js/packages/core` |
| 配布形式 | ESM |
| 説明 | PaddleOCR、ONNX Runtime Web、OpenCV.jsを使用するブラウザOCR SDK |
| 公称ライセンス | Apache-2.0（詳細確認はWBS 2.2） |
| 主要依存 | `onnxruntime-web`、`@techstark/opencv-js`、`clipper-lib`、`js-yaml` |

この決定はPoC対象の選定であり、製品への正式採用ではない。Electron、Worker、日本語モデル、完全オフライン、portable、性能、精度、メモリ、ライセンスの各検証を完了した後、WBS 2.20で正式判断する。

## 選定理由

### 1. 公式性

- PaddlePaddle公式の`PaddlePaddle/PaddleOCR`リポジトリ内で開発されている。
- 上流READMEは本パッケージを公式ブラウザOCR SDKとして明記している。
- npmパッケージのrepositoryも同じ公式リポジトリを指している。

### 2. 現行仕様との適合可能性

公式APIで次を確認できる。

- ブラウザ向けTypeScript/ESMパッケージ
- ONNX Runtime WebによるWASM推論
- 専用Workerモード
- `Blob`、`ImageBitmap`、`ImageData`等の入力
- 認識行ごとのpolygon、text、score
- 検出、認識、合計処理時間
- `dispose()`によるリソース解放API
- 検出・認識モデル資産URLおよびWASM配置先の指定

これらは`OcrEngine`抽象、Worker隔離、座標・信頼度表示、ローカル資産同梱の検証に必要な入口を満たす。

### 3. 日本語モデルへの接続可能性

PaddleOCR本体の公式ドキュメントでは、PP-OCRv5の`japan`言語と、日本語を含むPP-OCRv5認識モデルが案内されている。ただし、PaddleOCR.js 0.4.2で実際に選択される検出・認識モデル、辞書、ONNXアーカイブはまだ確定していない。具体的なモデル識別子と資産をWBS 2.3で特定し、WBS 2.6で日本語画像を実測する。

## 技術検証での使用方針

- PoCでは依存を`0.4.2`へ完全固定し、`latest`や範囲指定を使用しない。
- `lang`だけに依存した暗黙ダウンロードは採用しない。
- 検出モデル、認識モデル、辞書相当資産、ONNX Runtime WASMを明示的なローカルURLから読み込ませる。
- OCRは`worker: true`、推論backendは`wasm`を第一条件とする。
- CDNを使用したサンプル設定はPoCの最終構成に残さない。
- SDK固有の結果は製品の`NormalizedOcrResult`へ変換できるか確認する。
- SDKのWorkerと製品側Workerを不必要に二重化しない。PoCで所有境界を決定する。

## 現時点で未検証のGate条件

| 条件 | 状態 | 対応WBS |
|---|---|---|
| Electron rendererでの初期化 | 未検証 | 2.11 |
| 日本語モデルの実認識 | 未検証 | 2.3、2.6 |
| 座標・信頼度の正規化 | API上は可能、実測未検証 | 2.7 |
| Worker内実行とUI応答性 | API上は対応、Electron実測未検証 | 2.8 |
| 全モデル・辞書・WASMのローカル同梱 | 設定口は存在、実測未検証 | 2.9 |
| ネットワーク遮断 | 未検証 | 2.10 |
| portableからの資産読込 | 未検証 | 2.12、2.13 |
| 日本語・空白パス | 未検証 | 2.14 |
| 性能・メモリ・耐久性 | 未検証 | 2.15～2.17 |
| CER | 未検証 | 2.18 |
| SDK・依存・モデル再配布 | 未検証 | 2.2、2.4 |

## 主要な注意点

- 調査時点で0.x系の比較的新しいSDKであり、破壊的変更と不具合のリスクがある。
- 公式サンプルにはCDNのWASMパスやHTTPモデルURLが含まれる。Local OCRでは必ずローカル資産へ置き換える。
- カスタムモデルは`inference.onnx`と`inference.yml`を含む非圧縮ustar形式を要求するため、公式モデルの取得形式と変換手順を確認する必要がある。
- Worker用module assetをViteとElectronが正しく出力・読込できるかは未確認である。
- threaded WASMを使う場合のCOOP/COEP、CSP、Electronカスタムプロトコルへの影響は後続PoCで確認する。
- SDKはOpenCV.jsも内部利用するため、WASM/JS資産、メモリ使用量、ライセンス対象がONNX Runtime Webだけでは完結しない。

## 今回第一候補にしない案

| 候補 | 扱い | 理由 |
|---|---|---|
| `ppu-paddle-ocr/web` | 比較資料に限定 | ブラウザ対応だが第三者実装であり、公式SDKを先に検証する方針とする |
| unscoped `paddleocr-js` | 対象外 | 公式パッケージ名と一致せず、出所を混同するリスクがある |
| `onnxruntime-web`への独自直接実装 | 現時点では対象外 | 前後処理、検出box復元、認識辞書処理を独自保守する範囲が大きい |
| Python版PaddleOCR | Gate B比較候補 | WBS 2.19で同じ評価セットを使用して比較する |

## 一次情報

- PaddleOCR.js公式ディレクトリ: https://github.com/PaddlePaddle/PaddleOCR/tree/main/paddleocr-js
- SDK package metadata: https://github.com/PaddlePaddle/PaddleOCR/blob/main/paddleocr-js/packages/core/package.json
- SDK README/API: https://github.com/PaddlePaddle/PaddleOCR/blob/main/paddleocr-js/packages/core/README.md
- npm package: https://www.npmjs.com/package/@paddleocr/paddleocr-js
- PaddleOCR公式OCRモデル資料: https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/pipeline_usage/OCR.en.md

## 完了判定

WBS 2.1の完了条件「公式/採用候補を記録」を満たす。

次はWBS 2.2で、SDK本体だけでなく直接・推移依存、同梱予定のJS/WASM、NOTICE条件を含めて再配布可否を確認する。その後WBS 2.3で日本語の検出・認識モデルを具体化する。
