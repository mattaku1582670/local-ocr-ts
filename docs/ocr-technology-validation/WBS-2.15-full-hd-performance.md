# WBS 2.15 1920×1080性能測定

## 結論

1920×1080の固定PNGをElectron最小PoCでOCRし、初回1回とモデル初期化後3回の処理時間およびElectronプロセス群のメモリを記録した。

モデル初期化後3回の壁時計時間は6.01～6.54秒、中央値6.12秒だった。正式仕様の優先順位が高い詳細要件定義書の目標「1920×1080スクショOCR 10秒以内」を達成した。開発計画書の「FullHD画像5秒以内」は達成していない。

WBS 2.15の完了条件「時間・メモリ記録」を満たす。

## 仕様上の基準

| 仕様書 | 基準 | 判定 |
|---|---|---|
| 詳細要件定義書 8.4 | 1920×1080スクショOCR 10秒以内 | 達成 |
| 開発計画書 8 | FullHD画像5秒以内 | 未達 |
| 詳細要件定義書 8.4 | 通常利用でメモリ1.5GB未満を目標 | working setは目標内。private memoryは上限に近い |

2つの処理時間目標は一致しない。正式仕様の優先順位に従い10秒を合格基準とし、5秒は改善余地を判断する参考値として扱った。仕様値そのものは変更していない。

## 測定環境

| 項目 | 値 |
|---|---|
| OS | Windows `10.0.26200` |
| CPU | AMD Ryzen 5 7530U with Radeon Graphics |
| 論理CPU | 12 |
| 物理メモリ | 15,681.07 MiB |
| Electron | 43.3.0 |
| PaddleOCR.js | 0.4.2 |
| ONNX Runtime Web | 1.27.0 |
| backend | WASM、SIMD有効、`numThreads: 1` |
| execution | Worker |

## 評価画像

`scripts/measure-full-hd.mjs`がrendererのCanvasで毎回同じ1920×1080 PNGを生成する。白背景の業務画面を模した配置で、日本語、英数字、記号、異なるフォントサイズを含む。生成画像は189,819 bytesだった。

画像および認識本文はファイルやログへ出力しない。計測結果には画像寸法、PNGサイズ、認識ブロック数だけを記録する。

## 測定方法

1. Electron最小PoCをsandbox有効の通常構成で起動する。
2. UI heartbeatを使ってrenderer初期化完了を待つ。
3. 1920×1080 PNGをファイル入力へ設定する。
4. `working`から`success/error`までの壁時計時間を測る。
5. OCR結果が1920×1080、WASM backend、Worker実行、空でないことを検証する。
6. OCR中は100ms間隔で`app.getAppMetrics()`を読み、全Electronプロセスのworking set、private memory、プロセス数を合計する。
7. 初回1回と、同じエンジンを再利用するwarm run 3回を測る。

エンジン時間はPaddleOCR.jsが返す`metrics.totalMs`、壁時計時間は画像入力からUI完了までである。初回壁時計時間にはモデル初期化、画像decode、UI更新も含む。

## 測定結果

| run | 壁時計 | エンジン時間 | 最大working set | 最大private | blocks |
|---|---:|---:|---:|---:|---:|
| cold | 16.13秒 | 8.89秒 | 1,356.54 MiB | 1,489.87 MiB | 13 |
| warm 1 | 6.01秒 | 5.83秒 | 1,317.55 MiB | 1,409.61 MiB | 13 |
| warm 2 | 6.12秒 | 6.01秒 | 1,279.05 MiB | 1,368.17 MiB | 13 |
| warm 3 | 6.54秒 | 6.40秒 | 1,279.83 MiB | 1,368.40 MiB | 13 |

warm run中央値は壁時計6.12秒、エンジン6.01秒だった。最大壁時計は6.54秒で、すべて10秒以内だった。

起動直後は5プロセス、working set 530.34 MiB、private memory 486.44 MiBだった。cold runの最大working setは約1.32 GiB、最大private memoryは約1.46 GiBである。1.5GiBを基準にすれば範囲内だが余裕は小さい。仕様の`GB`が10進単位か2進単位かは明記されていないため、WBS 2.16と2.17でも両メトリクスを継続測定する。

機械可読な全計測値は`WBS-2.15-full-hd-performance.json`へ保存した。

## 自動検証結果

| コマンド | 結果 |
|---|---|
| `npm run measure:full-hd` | 成功、初回1回＋warm 3回 |
| warm run 10秒以内 | 3/3成功 |
| 画像寸法 | 全runで1920×1080 |
| backend / execution | 全runでWASM / Worker |
| OCR結果 | 全runで空でない |

## 完了条件

検証PC仕様を併記し、1920×1080画像の処理時間とメモリを反復記録したため、WBS 2.15を完了と判定する。詳細要件の10秒目標は達成した。

## 次のWBS

WBS 2.16「A4 300dpi相当性能測定」を実施する。A4 300dpi相当の2480×3508画像で処理時間とメモリを記録し、詳細要件の20秒目標と1.5GB目標を評価する。
