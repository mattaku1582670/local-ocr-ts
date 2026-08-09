# WBS 2.7 座標・信頼度取得可否確認

## 結論

PaddleOCR.js 0.4.2の実OCR結果から、認識blockごとの4点polygonと認識confidenceを取得できた。WBS 2.5で作成した1600×500 pxの英数字サンプルを使い、次を自動E2Eで確認した。

- 2つの認識blockが返る。
- 各blockのpolygonが4点である。
- 各座標が有限な整数で、原画像の1600×500座標境界内にある。
- 点順が左上、右上、右下、左下である。
- block順が上の行から下の行である。
- 各blockのconfidenceが有限な数値で、0以上1以下である。

WBS 2.7の完了条件「結果仕様記録」を満たす。ただし、回転、前処理縮小、範囲OCRから原画像への座標復元は後続WBSの対象であり、今回の成立判定には含めない。

## 取得結果の仕様

PoCでは、エンジン固有結果を次の型へ正規化している。

```ts
interface NormalizedOcrBlock {
  text: string;
  confidence: number | null;
  polygon: Array<[number, number]>;
}

interface NormalizedOcrResult {
  text: string;
  blocks: NormalizedOcrBlock[];
  durationMs: number;
  image: {
    width: number;
    height: number;
  };
  // runtime情報は省略
}
```

`image.width`と`image.height`はOCR入力となった`ImageBitmap`の寸法である。全画像OCRかつ前処理縮小なしの今回の条件では、polygonはこの原画像寸法と同じ座標系になる。

## polygon

### 座標系

- 原点: 画像左上
- x軸: 右方向が正
- y軸: 下方向が正
- 単位: 画像ピクセル座標
- 点数: 現行SDK実装では4点
- 点順: 左上、右上、右下、左下
- 境界: `0 <= x <= image.width`、`0 <= y <= image.height`

PaddleOCR.jsは検出時に入力画像をモデル向け寸法へ縮小するが、返却前に検出feature map上の点を入力元の`srcW`、`srcH`へ比例変換し、`Math.round`で整数化して画像境界へclampする。

polygonは文字glyphそのものの輪郭ではない。検出輪郭の最小外接回転矩形を`unclipRatio`で拡張した認識領域であるため、表示枠は文字より広くなる場合がある。

### 読み順

SDKは検出boxを、先頭点のy座標、次にx座標で並べる。同一行とみなすy差が10未満の場合はx座標で再調整する。今回の横書き2行では、上段から下段の順にblockが返ることを確認した。

複雑な段組み、縦書き、傾斜、表の読み順を保証するアルゴリズムではない。本番の読み順正規化はWBS 11.11で別途実装・評価する。

## confidence

### 意味

SDKの`OcrResultItem.score`は文字検出confidenceではなく、認識モデルがCTC decodeで採用した各文字の最大出力値を算術平均した、認識block単位のscoreである。

OCR pipelineはこのscoreを`text_rec_score_thresh`と比較し、閾値未満の認識結果を除外する。PoCは取得可否確認のため閾値を0としている。

### 正規化方針

- 有限なSDK scoreはそのまま`confidence`へ保持する。
- `NaN`または無限値は`null`へ変換する。
- 今回の実OCRでは、全blockが0以上1以下の有限値だった。
- 現在は値のclampを行っていない。

WBS 11.10の正式な信頼度変換では0〜1への統一ルールを確定し、上流SDKの異常値や仕様変更も防御する必要がある。confidenceはモデル出力の相対的な確認材料であり、文字列が正しい確率や校正済み精度とはみなさない。

### 取得できない値

PaddleOCR.js内部では文字検出boxにも検出scoreがあるが、公開される`OcrResultItem`には含まれない。現在取得できるのは認識scoreだけである。

製品要件の「ブロックごとの信頼度表示」には認識confidenceを使用できる。検出confidenceも将来必要になった場合は、上流変更または別のエンジンadapter対応が必要になる。

## 上流API安定性

PaddleOCR.jsの公開型はpolygonを`Point2D[]`、confidenceを`number`としているが、次は公開型だけからは保証されない実装詳細である。

- polygonが常に4点であること
- polygonの点順
- 原画像寸法への復元と丸め方法
- confidenceの計算方法
- blockの読み順

本PoCは`@paddleocr/paddleocr-js` 0.4.2をlockfileで固定し、これらをE2Eで回帰検出する。依存更新時は再検証し、正式なadapterでは必要に応じて点順、値域、読み順を明示的に正規化する。

## 自動テスト

### 単体テスト

既存の結果正規化テストで次を確認している。

- 本文、confidence、polygonを欠落させずコピーする。
- 画像寸法、処理時間、runtime providerを保持する。
- 非有限confidenceを`null`へ変換する。

### 実OCR E2E

production buildをMicrosoft Edge headlessで実行し、英数字サンプルに対して次を検証する。

- 画像寸法が1600×500である。
- block数が2である。
- confidenceが`number`で0〜1範囲内である。
- polygonが4点で、全座標が有限整数かつ画像境界内である。
- 水平な入力について4点が左上、右上、右下、左下の順である。
- 1つ目のblockの平均y座標が2つ目より小さい。
- 外部オリジンへの通信、失敗リクエスト、ページ例外がない。

2026-08-06の最終実行では、英数字・日本語のE2E 2件が成功した。座標・信頼度を検証する英数字ケースは8.4秒、全体所要時間は19.9秒だった。

## 仕様書との対応

| 仕様 | 判定 |
|---|---|
| `confidence: number | null` | 取得・正規化可能 |
| `polygon: Array<[number, number]>` | 取得可能 |
| 原画像の未ズーム座標で保持 | 全画像・無回転・無縮小条件で成立 |
| 認識行単位のpolygon | 現行SDKのblock単位で成立 |
| ブロックごとの信頼度表示 | 認識confidenceを使用可能 |
| 回転時の原画像座標 | 未検証 |
| 範囲OCR後の原画像座標 | 未検証 |
| 縮小後の原画像座標復元 | 未検証 |

## Gate Aへの反映

PaddleOCR.js構成で、製品が必要とする認識領域polygonとblock単位の認識confidenceを取得できることを確認した。この項目はGate Aに対して肯定材料となる。

ただし、APIの点数・点順・score意味の一部は公開型で保証されないため、バージョン固定とadapter側の正規化・回帰試験を採用条件とする。Gate A全体の判断は引き続き保留する。

## 完了条件

WBS 2.7の完了条件「結果仕様記録」を満たす。

## 次のWBS

WBS順序に従い、次はWBS 2.8「Worker内実行を検証」を実施する。
