# Python PaddleOCR comparison PoC

WBS 2.19専用の比較PoCであり、製品へのPythonサイドカー採用を意味しない。

- Python 3.13 x64
- PaddleOCR 3.7.0
- PaddlePaddle 3.3.1 CPU
- PP-OCRv5 mobile detection/recognition models
- project-local model cache
- oneDNN/MKLDNN disabled because PaddlePaddle 3.3.1 fails on Windows with a PIR runtime error

`.venv`、モデル、画像ごとの測定結果は再生成可能なためGit管理対象外とする。比較レポートはOCR本文を保存・出力しない。

## Setup

```text
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe smoke.py
```

初回の`smoke.py`実行時だけ、公式Paddle BOSから2モデルを`models`へ取得する。取得後はネットワークを使わずに初期化・推論できる。

## Evaluation

```text
.venv\Scripts\python.exe -m unittest discover -s . -p test_*.py -v
.venv\Scripts\python.exe evaluate.py
```

`evaluate.py`はbrowser PoCと同じ`synthetic-v1`の50画像、正解テキスト、SHA-256、CER正規化を使用する。詳細結果は無視対象の`results/python-cer-report.json`へ出力する。
