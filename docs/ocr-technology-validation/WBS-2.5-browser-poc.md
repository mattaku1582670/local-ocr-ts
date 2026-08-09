# WBS 2.5 最小ブラウザPoC

## 結論

PaddleOCR.jsとONNX Runtime Webを使用し、ブラウザ上で画像1枚をOCRする最小PoCを作成した。検出・認識モデルとONNX Runtime WebのWASMをローカル配置し、英数字を含む組み込みサンプル画像から次の文字列を取得できた。

```text
LOCAL OCR
TEST ABC 123
```

自動E2Eでは、OCR成功、要求バックエンドが`wasm`であること、ページ外へのHTTP/HTTPS要求がないこと、失敗したリクエストとページ例外がないことを確認した。これにより、WBS 2.5の完了条件「画像1枚をOCR」を満たす。

ただし、この結果だけでGate Aは通過していない。日本語、結果座標・信頼度、Worker、Electron、portable、性能・メモリ、ネットワークアダプター遮断状態は後続WBSで検証する。

## 検証構成

製品コードと混同しないよう、PoCを`poc/browser-ocr`へ隔離した。React、HeroUI、Electronは導入していない。

| 項目 | 構成 |
|---|---|
| OCR SDK | `@paddleocr/paddleocr-js` 0.4.2 |
| 推論ランタイム | `onnxruntime-web` 1.27.0 |
| OpenCV | `@techstark/opencv-js` 4.10.0-release.1（OCR SDKの推移的依存） |
| 言語 | `japan` |
| モデル世代 | `OCRv5` |
| 検出モデル | `PP-OCRv5_mobile_det` |
| 認識モデル | `PP-OCRv5_mobile_rec` |
| バックエンド | WASM、1 thread、SIMD有効 |
| ビルド | Vite 8.2.0、TypeScript strict |
| 単体テスト | Vitest 4.1.10 |
| E2E | Playwright 1.62.1、Microsoft Edge headless |

OCR処理は仕様書の`OcrEngine`方針に合わせ、`init`、`recognize`、`dispose`、`capabilities`を持つインターフェースを介して呼び出す。PoC固有の結果を、本文、行、polygon、confidence、処理時間、runtime情報を持つアプリ側の型へ正規化する。

## ローカル資産

WBS 2.3で特定した次のモデルを、記録済みSHA-256と照合した場合に限り`public/assets/models`へ配置する。

| ファイル | SHA-256 |
|---|---|
| `PP-OCRv5_mobile_det_onnx_infer.tar` | `781056046C9ED77A15C94681605DB6A0F62317C2E9CCE6931C71DA2478D4BC30` |
| `PP-OCRv5_mobile_rec_onnx_infer.tar` | `F7E792BC836F36E7EF895AD47C426D75B0B75B1650CAA6D63FE9418441FFBA8C` |

`stage:assets`は上記2モデルに加え、インストール済み`onnxruntime-web`パッケージから8個のWASM関連ファイルをコピーする。`verify:assets`は全10件の存在、サイズ、SHA-256を検証する。生成した整合性マニフェストもビルド成果物へ含める。

モデル、WASM、ビルド成果物はGit管理対象外とし、巨大バイナリをこのWBSでコミット対象にしない。実行時のモデルダウンロード処理は実装していない。

## 自動検証結果

2026-08-06、Windows環境で次を実行した。

| コマンド | 結果 |
|---|---|
| `npm.cmd run verify:assets` | 成功。ローカル資産10件を検証 |
| `npm.cmd run lint` | 成功 |
| `npm.cmd run typecheck` | 成功。`strict: true`、`skipLibCheck: false` |
| `npm.cmd run test` | 成功。2ファイル、3テスト |
| `npm.cmd run build` | 成功 |
| `npm.cmd run test:e2e` | 成功。1テスト、15.2秒 |
| `npm.cmd audit --omit=dev` | 既知脆弱性0件 |

E2EはViteのproduction previewを使用し、組み込みCanvas画像をOCRする。認識結果に`LOCAL OCR`と`TEST ABC 123`が含まれること、要求したruntime backendが`wasm`であること、外部オリジンへの通信が0件であることを検証する。

ビルド成果物は19ファイル、合計162,353,875 bytes（154.83 MiB）だった。モデル、複数のONNX Runtime Web WASM variant、OCR/OpenCVコードを含むため、最終配布方式と容量の評価は後続WBSへ持ち越す。

## セキュリティ・互換性上の発見

### CSPの`unsafe-eval`

`@techstark/opencv-js` 4.10.0-release.1は初期化時に動的な関数生成を使用する。PoCでは実行成立の確認に必要だったため、CSPの`script-src`へ`'unsafe-eval'`を限定的に追加した。また、同ライブラリが埋め込みWASMを`data:` URLで取得するため、`connect-src`へ`data:`を追加した。

これは本番ElectronのCSPへ無条件に採用してよい設定ではない。`unsafe-eval`を必要としない構成へ置換できるか、Electronの隔離されたWorker内へ影響を閉じ込められるか、またはGate Bへ移るべきかをGate A判断までに評価する。

### PaddleOCR.jsの型互換性

PaddleOCR.js 0.4.2の型定義は、依存先OpenCVパッケージの現行公開型と一致しない参照を含む。PoCでは実行時コードを変更せず、最小限のmodule augmentationで正しい公開型へ対応させた。`skipLibCheck`で隠していない。

上流更新で解消する可能性がある一方、本番採用時にはバージョン固定、型補正の保守、または上流修正の追跡が必要になる。

### ビルド警告と容量

ViteはOpenCV依存内のNode組み込みモジュール参照をブラウザ向けにexternalizeした。また、OCR/OpenCVのchunkが大きいという警告が出た。今回のE2E実行は成功しているが、Electron、Worker、portableでのruntime挙動と起動・メモリ負荷を別途確認する。

ONNX Runtime Webは複数のWASM variantを提供するため、現在の単純な全件配置は検証には安全だが冗長である。実際に利用されるvariantをWBS 2.9以降で特定し、オフライン性を壊さない範囲で配布容量を最適化する。

## 実装上の安全策

- OCR画像または認識本文をコンソールへ記録しない。
- 選択画像の一時object URLを差し替え時と終了時に解放する。
- `ImageBitmap`をOCR完了後に閉じる。
- OCRエンジンの`dispose`を終了時に呼び出す。
- エラーへ識別可能なコードを付与し、画面へ復旧可能な状態として表示する。
- モデルURLとWASM URLをローカルパスで明示し、SDKの既定リモートURLへ依存しない。

## 未検証範囲

- 日本語画像の認識品質と文字集合
- polygon、座標順序、confidenceの意味と欠損時の挙動
- Worker内でのSDK、OpenCV、WASM初期化
- OCR中のUI応答性とキャンセル伝播
- Electronの`contextIsolation`、`sandbox`、CSPとの互換性
- ネットワークアダプターを無効化した状態での起動とOCR
- portable EXEからの相対資産解決
- 1920×1080、A4 300dpi、複数画像での速度とメモリ使用量
- 日本語・空白を含む配置パス

## Gate Aへの反映

現時点で次だけを確認した。

- ブラウザ環境でPaddleOCR.jsとONNX Runtime Webによる画像1枚のOCRが成立する。
- 明示したローカルモデルとローカルWASMでOCRが成立する。
- production preview上のE2Eで外部オリジンへのHTTP/HTTPS要求は発生しない。
- ただし、OpenCV由来の`unsafe-eval`要件は重大なセキュリティ評価項目である。

WBS 2.5は完了とするが、Gate Aの採用判断は保留する。

## 次のWBS

依存関係どおり、次はWBS 2.6「日本語画像で認識確認」を実施する。WBS 2.7、2.8、2.9はWBS 2.5へ直接依存するため並行候補ではあるが、仕様の順序に従い2.6を先行する。
