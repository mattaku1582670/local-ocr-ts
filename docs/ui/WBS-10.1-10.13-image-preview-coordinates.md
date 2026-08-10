# WBS 10.1〜10.13 画像プレビュー・座標

- 実施日: 2026-08-10
- ステータス: 完了
- 次WBS: 11.1「OcrEngine interface」

## 実装と確認

| WBS | 対応 | 確認 |
|---|---|---|
| 10.1 | object URLをfetchし、`createImageBitmap`を第一候補にデコード | bitmap優先・dispose試験、Electron E2E |
| 10.2 | devicePixelRatio対応Canvasへ画像を中央描画 | Canvas component試験、実PNG E2E |
| 10.3 | 回転後寸法とviewportからpadding込みfit倍率を算出 | fit単体試験 |
| 10.4 | 10〜800%、拡大、縮小、100%、fit、Ctrl+wheel | clamp・control試験 |
| 10.5 | fit倍率より拡大時のpointer drag pan | pointer component試験 |
| 10.6 | 左右90度回転をimage storeへ非破壊反映 | rotation control試験 |
| 10.7 | 原画像座標と画面座標の順変換・逆変換 | round-trip単体試験 |
| 10.8 | 0/90/180/270度の回転座標と回転後寸法 | 四方向境界値試験 |
| 10.9 | scale・pan・回転を含む座標変換 | 四方向round-trip試験 |
| 10.10 | OCR polygonをCanvas overlayへ描画 | Canvas component試験 |
| 10.11 | renderer設定`showOcrBoxes`による枠ON/OFF | settings連携試験 |
| 10.12 | polygon hit test、選択枠強調、結果ペインへの選択文字連動 | hit test・click試験 |
| 10.13 | Electronをdevice scale factor 2で起動し、実PNGをdropして操作性確認 | 200% E2E合格 |

## デコードとリソース管理

- Chromium対応環境では`createImageBitmap`を使用し、失敗または非対応時は`HTMLImageElement`へフォールバックする。
- 選択画像を切り替えるとpreview componentを再生成し、前画像の`ImageBitmap.close()`を呼ぶ。
- object URL自体の所有権はimage storeが保持し、一覧から画像を削除するまで解放しない。
- Canvas backing storeは`devicePixelRatio`を乗算し、CSS座標系で描画することで高DPI時のぼけを抑える。

## 座標規約

- OCR polygonと選択範囲は、回転・zoom・panを適用していない原画像左上原点の座標で保持する。
- 順変換は`原画像座標 → 右回り回転 → viewport中心基準scale → pan`の順とする。
- 逆変換は上記の逆順で行い、0/90/180/270度すべてで元座標へ戻ることを試験する。
- 90度・270度では表示上の幅と高さを交換する。
- OCR枠のclick判定は画面座標へ変換したpolygonに対してray castingを行う。

## 操作仕様

- `100%`は原画像1 pixelを画面上の1 CSS pixelとして表示する。
- `画面に合わせる`は回転後画像全体がpadding内へ収まる倍率へ戻し、panをリセットする。
- zoomは10%未満、800%超過をclampする。
- fitより拡大した場合だけgrab cursorとdrag panを有効にする。
- OCR枠は通常を青、選択中を橙の太線と半透明fillで、色以外に線幅でも区別する。

## 検証結果

- format: 合格
- lint: 合格
- typecheck（renderer/main/preload）: 合格
- unit/integration: 18 files、86 tests合格
- production build: 合格
- Electron E2E: 2 tests合格（通常倍率、200%倍率＋実PNG）
