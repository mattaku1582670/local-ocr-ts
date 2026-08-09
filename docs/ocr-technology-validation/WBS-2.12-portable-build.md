# WBS 2.12 portableビルド作成

## 結論

electron-builder 26.15.3のWindows `portable` targetで、Windows x64向け単一EXEを生成した。通常ユーザーセッションからEXEを起動し、`Local OCR Browser PoC`ウィンドウが表示されることを確認した。

WBS 2.12の完了条件「EXE生成」を達成した。portableからモデル／WASMを読み込んでOCRする検証はWBS 2.13、日本語・空白パスからの起動とOCRはWBS 2.14で実施する。

## 成果物

| 項目 | 値 |
|---|---|
| ファイル | `release/Local OCR-0.0.0-x64-portable.exe` |
| target | Windows portable x64 |
| サイズ | 120,404,034 bytes |
| SHA-256 | `8d8cc1b98ce5411458b05eaf3160c8937e5f585f6194f3ebf2e02785de216ebf` |
| PEヘッダー | `MZ`確認済み |
| ProductName | `Local OCR` |
| FileVersion | `0.0.0` |
| 署名 | 未署名 |

`release/SHA256SUMS.txt`を生成し、portable EXEのSHA-256を記録した。`release`はGit管理対象外であり、EXEや展開済みElectron、モデル、WASMをリポジトリへ追加しない。

## electron-builder構成

次の方針で`electron-builder.yml`を追加した。

- `asar: true`
- Windows portable x64のみを生成する。
- Windows requested execution levelは`asInvoker`とする。
- portable requested execution levelは`user`とする。
- portableごとに一意な一時ディレクトリへ展開する。
- コード署名は行わないが、Windowsの製品名・説明・バージョン情報は付与する。
- artifact名に製品名、バージョン、アーキテクチャ、portableを含める。
- renderer／Electron main／preloadのsource mapを除外する。
- モデルとWASMはASARから除外し、`extraResources`へ配置する。

現段階では専用アイコンを作成していないため、Electron既定アイコンを使用する。コード署名と製品アイコンはリリース判断時の未解決事項である。

## ASARとextraResources

packaged appのASARは49,059,263 bytesだった。ASAR一覧を検査し、次だけが含まれることを確認した。

- `dist/index.html`
- renderer JavaScript／CSS
- ViteがbundleしたWorkerとWASM
- `dist-electron/main.mjs`
- `dist-electron/preload.cjs`
- package metadata

ASARには次を含めていない。

- source map
- `dist/assets/models`のモデル複製
- `dist/assets/wasm`のORT資産複製
- production node_modules

モデル2件、ORT MJS/WASM 8件、integrity manifestは`resources/ocr-assets`へ配置した。10 OCR資産の合計は101,318,988 bytesで、manifestに記録したサイズとSHA-256にすべて一致した。

`PaddleOCR.js`と`onnxruntime-web`はViteによりrenderer／Workerへbundleされ、packaged main processからNode moduleとして参照しない。そのためbuild-timeの開発依存へ移し、production node_modulesとしてASARへ重複同梱しない構成にした。この変更によりASARは初回試行の約239 MBから約49 MBへ縮小した。

## packaged資産パス

Electron mainのカスタムプロトコル解決を次のように分けた。

| 実行環境／URL | 解決先 |
|---|---|
| 開発時の全資産 | `dist` |
| packaged `/assets/models/*` | `process.resourcesPath/ocr-assets/models` |
| packaged `/assets/wasm/*` | `process.resourcesPath/ocr-assets/wasm` |
| packaged renderer／Worker bundle | ASAR内`dist` |

どちらも解決後のパスが許可root外へ出ないことを検査する。rendererへ任意ファイルパスAPIは公開しない。

## portable検証スクリプト

`verify-portable.mjs`は次を自動検証する。

1. `-x64-portable.exe`に一致する成果物が1件だけ存在する。
2. PE先頭が`MZ`である。
3. 不自然に小さいEXEではない。
4. EXEのSHA-256を算出して`SHA256SUMS.txt`へ保存する。
5. `win-unpacked/resources/ocr-assets`の10資産をintegrity manifestと照合する。

巨大EXEを全体読込みせず、PEヘッダーは先頭2 bytesだけを読み、SHA-256はストリームで計算する。

## 起動スモーク

portable EXEを通常ユーザーセッションで起動し、45秒以内に次を確認した。

- `LocalOCR`プロセスが起動する。
- メインウィンドウが作成される。
- タイトルが`Local OCR Browser PoC`である。
- Electronの5プロセス構成が起動する。

確認後、スモーク試験で起動したプロセスだけを終了した。テスト後に`LocalOCR`、portable wrapper、テスト用ポートの残存がないことを確認した。

このスモーク試験ではOCRボタンを操作していない。portable内のモデル初期化とOCR成功はWBS 2.13の完了条件である。

## サイズと起動上の観察

| 項目 | サイズ |
|---|---:|
| 単一portable EXE | 120,404,034 bytes |
| app.asar | 49,059,263 bytes |
| extraResources OCR資産 | 101,318,988 bytes |
| win-unpacked全体 | 514,565,165 bytes |

portable buildの最終成功実行は293.1秒だった。大部分はElectronと約101 MBのOCR資産を含むNSIS圧縮である。単一EXEは約120 MBに圧縮されるが、実行時には約515 MB相当を一時展開する構造になる。

これは初回起動時間、ディスク一時使用量、Windows Defender走査時間へ影響する可能性がある。WBS 21.9と21.10で単一EXEと展開済みフォルダ版を比較する必要がある。ORT 8資産のうち実際に必要な組合せを安全に絞れれば、extraResourcesと展開容量を削減できる。

## ビルド中に解決した事項

- 初回構成ではproduction dependenciesがASARへ重複し、ASARが約239 MBになった。OCR依存をbuild-time依存へ移して解消した。
- `packElevateHelper`はelectron-builder 26.15.3のPortableOptionsに存在せず、設定検証で拒否されたため削除した。実行レベルは`user/asInvoker`で維持した。
- NSIS中間ファイルは7-Zip圧縮完了まで0 bytesとして見える。圧縮子プロセスを確認し、停止扱いせず完了まで待機した。
- 生成済み`release`内の第三者WASMをBiomeが走査したため、Git無視済みbuild成果物をlint対象外へ追加した。

## 自動検証結果

2026-08-06の最終結果は次のとおり。

| 検証 | 結果 |
|---|---|
| `npm run lint` | 成功、30ファイル |
| `npm run typecheck` | renderer／Electronとも成功 |
| `npm run test` | 2ファイル、3件成功 |
| `npm run build` | 成功 |
| `npm run package:portable` | 成功 |
| portable PE／SHA検証 | 成功 |
| packaged OCR資産検証 | 10件成功 |
| ASAR内容検査 | source map・モデル／WASM複製なし |
| portable起動スモーク | 成功 |
| Electron OCR E2E回帰 | 1件成功、18.5秒 |
| 通常ブラウザOCR E2E | 2件成功、28.8秒 |
| 通信遮断ブラウザOCR E2E | 1件成功、22.1秒 |
| npm audit | 脆弱性0件 |

## 未検証事項

- portableからのモデル初期化と英数字／日本語OCR
- portable実行時の外部通信0件
- 日本語・空白を含む配置パス
- EXEを別ディレクトリへ移動した場合の起動とOCR
- ネットワークアダプター無効状態
- 管理者権限なしの独立QA環境
- レジストリへの恒久設定が残らないこと
- Windows Defender／SmartScreenの表示
- コード署名と製品アイコン
- 一時展開ディレクトリの正常終了／異常終了時清掃

## 完了条件

Windows x64向け単一portable EXEを生成し、PE／SHA／同梱資産を検証して通常ユーザーセッションで起動できたため、WBS 2.12を完了と判定する。

## 次のWBS

WBS 2.13「portableからモデル読込確認」を実施する。生成した単一EXEを起動し、extraResourcesのモデル／WASMを初期化して英数字・日本語OCRが成功することを検証する。
