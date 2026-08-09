# WBS 2.19 Python版PaddleOCRの比較PoC

## 結論

Python版PaddleOCRをWindows 11 x64、Python 3.13.13、PaddleOCR 3.7.0、PaddlePaddle 3.3.1 CPUで実行し、browser PoCと同じPP-OCRv5 mobile検出・認識モデル、同じ合成50画像、正解テキスト、CER正規化で比較した。

50件すべてでOCRに成功した。CERはPython版6.46%、browser版6.60%で差は0.14ポイントにとどまり、精度上の実質的な優位は確認できなかった。Python版の平均処理時間は5.56秒で、browser版3.33秒の1.67倍（67.3%遅い）だった。

Python版はGate Bへ切り替えるだけの精度・速度上の優位を示していない。WBS 2.19の完了条件「精度・速度比較」は達成した。

## 構成

| 項目 | Python比較PoC |
|---|---|
| Python | 3.13.13 x64 |
| PaddleOCR | 3.7.0 |
| PaddlePaddle | 3.3.1 CPU |
| 検出モデル | PP-OCRv5_mobile_det |
| 認識モデル | PP-OCRv5_mobile_rec |
| CPU thread | 8 |
| oneDNN/MKLDNN | 無効 |
| モデル配置 | `poc/python-ocr/models`（Git対象外） |

[PaddleOCR公式インストール資料](https://www.paddleocr.ai/main/en/version3.x/installation.html)に沿った3.x構成を使用した。モデルは[PaddleOCR公式OCR pipeline資料](https://www.paddleocr.ai/main/en/version3.x/pipeline_usage/OCR.html)のPP-OCRv5 mobile系を明示し、初回だけ公式Paddle BOSから取得した。

## 同一50画像の比較

| 指標 | Browser（PaddleOCR.js + ORT Web） | Python PaddleOCR | 差・比率 |
|---|---:|---:|---:|
| 成功 | 50 / 50 | 50 / 50 | 同等 |
| CER | 6.60% | 6.46% | Pythonが0.14ポイント低い |
| strict CER | 9.57% | 9.45% | Pythonが0.12ポイント低い |
| 横書き44件CER | 4.81% | 4.67% | Pythonが0.14ポイント低い |
| 平均時間 | 3.33秒 | 5.56秒 | Pythonが1.67倍 |
| 中央値 | 未採取 | 4.76秒 | 比較不可 |
| 初期化 | 別試験条件 | 4.52秒 | 直接比較不可 |

Windows UIカテゴリだけPython版のCERが17.90%、browser版が19.10%だった。他の7カテゴリは小数精度まで同じであり、同一モデルを異なるruntimeで実行した際の認識精度はほぼ同等だった。

## メモリ・配布サイズ

| 指標 | 結果 | 解釈 |
|---|---:|---|
| Python OCR process peak working set | 1,065.94 MiB | Electronを含まない単一OCRプロセス |
| Python model cache | 20.74 MiB | 検出・認識モデル合計 |
| Python `.venv` | 811.15 MiB | 開発環境の未最適化値 |
| Browser OCR assets | 96.62 MiB | ONNXモデル20.55 MiB + ORT WASM 76.08 MiB |

Gate B製品ではこのPython OCRプロセスにElectron main/renderer等が加わる。`.venv`はそのまま製品配布サイズとはみなせないが、Python runtime・PaddlePaddle・PaddleX依存を同梱するため、Gate Aより配布・更新・脆弱性管理の対象が大きくなることは明確である。

## oneDNN互換性

既定の`enable_mkldnn=true`では、最初の推論時にPaddlePaddleから次の例外が発生した。

```text
NotImplementedError: ConvertPirAttribute2RuntimeAttribute not support
pir::ArrayAttribute<pir::DoubleAttribute>
```

公式API引数`enable_mkldnn=false`で標準CPU経路へ切り替えると50件すべて成功した。セキュリティ設定を緩和する回避は行っていない。ただしCPU高速化を無効化したことが速度に影響している可能性があり、現バージョン組合せのPython案には互換性リスクが残る。

## 完全オフライン確認

モデル取得後、sandbox内のネットワーク制限下で`smoke.py`を再実行し、モデルが既存ローカルキャッシュから読み込まれ、初期化4.08秒・単一画像推論4.08秒で成功した。初回モデルダウンロードを製品動作に含める構成にはしていない。

## 実装・再現方法

比較PoCは`poc/python-ocr`に限定し、Node/Electron製品依存へPythonを追加していない。

```text
.venv\Scripts\python.exe -m unittest discover -s . -p test_*.py -v
.venv\Scripts\python.exe evaluate.py
.venv\Scripts\python.exe smoke.py
.venv\Scripts\python.exe -m pip check
```

`evaluate.py`は画像SHA-256を検証し、画像ID、CER、strict CER、時間、平均信頼度、エラーコードだけを記録する。OCR本文は結果ファイルにも標準出力にも保存しない。

## 制約

- 評価セットはユーザー承認済みの合成暫定セットであり、実画像精度を保証しない。
- Python側のportable同梱、空白・日本語パス、stdin/stdout IPCは、Gate B採用決定前の比較PoCでは実装していない。
- browser版とPython版でCPU thread条件が異なる。各案の現実的な構成比較として、browser版はORT Web WASM 1 thread、Python版はCPU 8 threadを使用した。
- Python側のworking setはOCR process単独であり、Electronを含むbrowser版の全process tree測定値とは直接比較できない。

## 完了条件

同じ50画像と同じ指標でPython版とbrowser版の精度・速度を比較し、offlineキャッシュ推論、依存整合性、メモリ、同梱規模、runtime互換性を記録したため、WBS 2.19を完了と判定する。

## 次のWBS

WBS 2.20「Gate A/B採用判断」。現時点ではPython案に明確な優位がなく、Gate Aを基本案としつつ、A4 300dpi性能不適合をどう扱うか明示的な採用判断が必要である。
