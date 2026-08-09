# WBS 2.3 日本語検出・認識モデルの特定

## 結論

最小ブラウザPoC（WBS 2.5）で最初に使用するモデル候補を、次の組み合わせに決定する。

| 役割 | モデル名 | 公式配布ファイル | 選定理由 |
|---|---|---|---|
| 文字検出 | `PP-OCRv5_mobile_det` | `PP-OCRv5_mobile_det_onnx_infer.tar` | PaddleOCR.js 0.4.2の既定モデルであり、軽量な検出モデルである |
| 文字認識 | `PP-OCRv5_mobile_rec` | `PP-OCRv5_mobile_rec_onnx_infer.tar` | 日本語・英語を含む共通認識モデルで、PaddleOCR.js 0.4.2が直接サポートする |

これはPoC開始用の候補決定であり、Gate Aの正式採用決定ではない。日本語認識、速度、メモリ、Worker、完全オフライン、portable読込およびライセンスの各検証が完了するまで、OCR方式は固定しない。

## SDK 0.4.2との対応

`@paddleocr/paddleocr-js@0.4.2`の配布物に含まれるsource mapと公式ソースを照合した。

- `lang: "japan"`、`ocrVersion: "PP-OCRv5"`は、`PP-OCRv5_mobile_det`と`PP-OCRv5_mobile_rec`へ解決される。
- `ocrVersion`を省略した場合もPP-OCRv5が選ばれる。
- `lang: "japan"`、`ocrVersion: "PP-OCRv6"`は、`PP-OCRv6_small_det`と`PP-OCRv6_small_rec`へ解決される。
- モデル資産は検出・認識ともに、`inference.onnx`と`inference.yml`を含む非圧縮tarとして読み込まれる。
- SDK既定のURLはインターネット上の配布先であるため、製品版でそのまま使用してはならない。PoCでは同じtarをローカルURLから渡す構成を検証する。

## 公式配布元

PaddleOCR.js 0.4.2が定義する配布元を記録する。

- 検出モデル: `https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv5_mobile_det_onnx_infer.tar`
- 認識モデル: `https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv5_mobile_rec_onnx_infer.tar`
- SDK資産定義: `https://github.com/PaddlePaddle/PaddleOCR/blob/main/paddleocr-js/packages/core/src/resources/model-asset.ts`
- SDK言語・世代対応: `https://github.com/PaddlePaddle/PaddleOCR/blob/main/paddleocr-js/packages/core/src/pipelines/ocr/shared.ts`
- PaddleOCR公式モデル一覧: `https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/pipeline_usage/OCR.en.md`

## 取得物の検査結果

2026-08-06に公式配布URLから一時領域へ取得した。モデル本体はリポジトリへ追加していない。

| ファイル | バイト数 | MiB | SHA-256 |
|---|---:|---:|---|
| `PP-OCRv5_mobile_det_onnx_infer.tar` | 4,843,520 | 4.62 | `781056046C9ED77A15C94681605DB6A0F62317C2E9CCE6931C71DA2478D4BC30` |
| `PP-OCRv5_mobile_rec_onnx_infer.tar` | 16,701,440 | 15.93 | `F7E792BC836F36E7EF895AD47C426D75B0B75B1650CAA6D63FE9418441FFBA8C` |
| 合計 | 21,544,960 | 20.55 | - |

両アーカイブに、SDKが要求する次のファイルが存在することを確認した。

- `inference.onnx`
- `inference.yml`

`inference.yml`の`Global.model_name`も、それぞれ`PP-OCRv5_mobile_det`、`PP-OCRv5_mobile_rec`と一致した。

## 日本語・英数字の収録確認

認識モデルの`inference.yml`は文字辞書を外部ファイル参照ではなく`PostProcess.character_dict`へ内包している。UTF-8として解析した結果は次のとおりである。

- 文字辞書: 18,383項目
- 漢字: 収録あり（例: `日`、`本`、`語`、`漢`、`字`）
- ひらがな: 収録あり（例: `あ`）
- カタカナ: 収録あり（例: `ア`）
- ASCII英字: 大文字・小文字とも収録あり
- 数字: 全角`０`から`９`は収録あり
- ASCII数字`0`から`9`: 辞書に直接は収録されていない

SDKのCTCデコーダーには全角数字を半角へ変換する処理がない。したがって、英数字要件への適合確認では、認識できるかだけでなく、数字の出力幅と後段のテキスト正規化方針をWBS 2.6で評価する。

PaddleOCR公式資料では、`PP-OCRv5_mobile_rec`の日本語認識平均精度は54.65%、モデルサイズは16 MBとされている。ただし、これは公式評価データ上の値であり、本製品の受入基準を満たすことを保証しない。正式評価画像セットでの実測を必須とする。

## 比較候補

### PP-OCRv6 small

- 検出: `PP-OCRv6_small_det`
- 認識: `PP-OCRv6_small_rec`
- PaddleOCR.js 0.4.2は`lang: "japan"`と`ocrVersion: "PP-OCRv6"`の組み合わせをこの2モデルへ解決する。
- 公式資料上のモデルサイズは検出9.6 MB、認識20.4 MBで、PP-OCRv5 mobileより大きい。
- 速度・メモリ・精度の比較候補とするが、WBS 2.3では実物取得と実行を完了していない。

### japan_PP-OCRv3_mobile_rec

- PaddleOCR公式の日本語専用旧世代モデルである。
- 公式資料上は日本語・数字対応、平均精度45.69%、モデルサイズ9.8 MBである。
- PaddleOCR.js 0.4.2の既定資産一覧と`lang`解決表には含まれず、現在のSDKへそのまま渡せるONNX tarとしての互換性は未確認である。
- PP-OCRv5 mobileが性能・メモリ・互換性の要件を満たさない場合の補助候補とし、最初のPoCには使用しない。

## PoCでの固定条件

モデルの意図しない変更やオンライン取得を避けるため、WBS 2.5以降のPoCでは次を明示する。

- `lang: "japan"`
- `ocrVersion: "PP-OCRv5"`
- `textDetectionModelName: "PP-OCRv5_mobile_det"`
- `textRecognitionModelName: "PP-OCRv5_mobile_rec"`
- 検出・認識の`ModelAsset.url`にはローカルで配信する資産URLを指定する
- ONNX Runtime WebのWASMパスもローカル指定する
- ネットワーク取得を成功条件に含めない

## 未解決事項と後続WBS

- モデルおよび内包辞書の再配布条件: WBS 2.4
- ブラウザ上でのモデル初期化と画像1枚のOCR: WBS 2.5
- 日本語、半角・全角英数字、縦書きの実認識: WBS 2.6
- 座標と信頼度の妥当性: WBS 2.7
- Worker内実行: WBS 2.8
- 完全ローカル資産だけでの動作: WBS 2.10、2.12、2.15
- PP-OCRv6 smallとの比較要否: PP-OCRv5 mobileの評価結果を見て判断する

## 完了条件

WBS 2.3の完了条件「モデル名・出所記録」を満たす。
