# WBS 12.1〜12.10 画像前処理

- 実施日: 2026-08-10
- ステータス: 完了
- 次WBS: 13.1「FIFOキュー実装」

## 実装と確認

| WBS | 対応 | 確認 |
|---|---|---|
| 12.1 | `PREPROCESS_PRESETS`をsingle sourceとして`none`、`document`、`screenshot`型とsettings schemaを定義 | 型検査、preset単体試験 |
| 12.2 | OCR decodeで`imageOrientation: from-image`を指定 | Orientation=6 JPEGをChromiumで80×40から40×80へ補正 |
| 12.3 | resize前に白でCanvas全体を塗り、alpha画像を白背景へ合成 | 全presetの呼出順単体試験 |
| 12.4 | 既定上限を実測済みFull HD相当の2,073,600 px、1辺上限を8,192 pxに設定 | Full HD、A4、超横長、異常値試験 |
| 12.5 | `sqrt(limit / pixels)`で縦横比を保ち、OCR用ImageBitmapだけを高品質縮小 | A4 2480×3508を1210×1712へ縮小 |
| 12.6 | 文書presetで輝度グレースケール＋1.15倍の軽いcontrastを適用 | pixel境界値、実WASM OCR |
| 12.7 | スクリーンショットpresetでは原色を維持し、白背景化と安全縮小だけを適用 | pixel非変更経路、実WASM OCR |
| 12.8 | 実際のX/Y縮尺でpolygonを原画像座標へ戻し、境界内へclamp | point、polygon、画像寸法単体試験 |
| 12.9 | 同一合成画像を3 presetで実OCRし、文字取得を比較 | Electron実WASM比較 |
| 12.10 | 前処理単体・統合試験を追加 | 25 files・117 tests合格 |

## 安全縮小

上限は、WBS 2.15で時間とメモリが許容範囲だった1920×1080と同じ2,073,600 pxとする。A4 300dpi相当の2480×3508は1210×1712（2,071,520 px）へ縮小される。丸め後の`scaleX`と`scaleY`を個別に保持するため、polygonを元へ戻す際の端数差を累積しない。

原画像、object URL、一覧表示用寸法は変更しない。前処理はOCR Worker内の一時OffscreenCanvasとImageBitmapだけに適用し、認識終了・失敗・cancel時に解放する。長辺が極端な画像はpixel数だけでなく8,192 pxのCanvas安全上限でも縮小する。

## preset比較

| preset | 色処理 | 合成テスト文字列 | 結果 |
|---|---|---|---|
| none | RGB維持 | `LOCAL OCR 123` | 主要文字列を認識 |
| document | grayscale＋軽いcontrast | `LOCAL OCR 123` | 主要文字列を認識 |
| screenshot | RGB維持 | `LOCAL OCR 123` | 主要文字列を認識 |

強い二値化は細線・アンチエイリアスを失うため採用しない。この比較は前処理経路の成立を確認する限定的な合成1画像試験であり、presetごとの優劣や実画像精度を確定するものではない。実画像50件以上のCER再評価はDI-004およびWBS 22.14で行う。

## 検証結果

- format: 合格
- lint: 合格
- typecheck（renderer/main/preload）: 合格
- unit/integration: 25 files、117 tests合格
- production build: 合格
- Electron実行: EXIF Orientation=6補正成功
- 実WASM OCR: 3 presetすべてで主要文字列を認識
- 外部HTTP/HTTPS request: 0件

DI-003は縮小実装による対策を入れたが、解消済みにはしない。製品構成のA4・巨大画像で1.5 GB目標と処理時間を再測定するWBS 22.13まで継続する。
