# WBS 2.13 portableからモデル読込確認

## 結論

electron-builderで生成した単一portable EXEを起動し、`extraResources`へ同梱した検出モデル、認識モデル、ONNX Runtime WebのWASMを実行時に読み込んでOCRできることを確認した。

英数字と日本語の両サンプルが認識され、実行バックエンドはWASM、実行モードはWorkerだった。OCR中に外部HTTP/HTTPS要求、要求失敗、renderer例外は発生しなかった。したがってWBS 2.13の完了条件「OCR成功」を満たす。

## 検証対象

| 項目 | 値 |
|---|---|
| portable EXE | `release/Local OCR-0.0.0-x64-portable.exe` |
| SHA-256 | `8d8cc1b98ce5411458b05eaf3160c8937e5f585f6194f3ebf2e02785de216ebf` |
| Electron | 43.3.0 |
| PaddleOCR.js | 0.4.2 |
| ONNX Runtime Web | 1.27.0 |
| OCR backend | WASM、`numThreads: 1`、SIMD有効 |
| OCR execution | Worker |

## portable OCR自動検証

`scripts/test-portable-ocr.mjs`を追加した。テスト時だけportable EXEへ`--remote-debugging-port`を渡し、ループバック上のCDPへPlaywrightで接続する。本番アプリの起動設定や公開APIは変更していない。

テストは次を検証する。

1. 単一portable EXEが起動し、`local-ocr://app/`を表示する。
2. rendererにNode.jsの`process`と`require`が公開されていない。
3. preloadが報告するsandbox状態が有効である。
4. 英数字サンプルで`LOCAL OCR`と`TEST ABC 123`を認識する。
5. 日本語サンプルで`日本語の文字認識`と`東京 2026`を認識する。
6. 正規化結果の`requestedBackend`が`wasm`、`executionMode`が`worker`である。
7. 検出モデルと認識モデルのローカルURLが実際に要求される。
8. `assets/wasm`配下のWASMが実際に要求される。
9. OCR Workerが生成される。
10. 外部HTTP/HTTPS要求、要求失敗、renderer例外が0件である。

検証終了時はCDP経由でアプリを閉じる。正常終了しない場合だけ、テストが起動したportable wrapperのPIDを起点にプロセスツリーを終了する。既存の`LocalOCR`プロセスを一括終了しない。

## packaged資産との対応

WBS 2.12でASARから`dist/assets/models`と`dist/assets/wasm`を除外し、同じ資産を`resources/ocr-assets`へだけ配置している。`verify:portable`は配置された10資産のサイズとSHA-256をmanifestに照合する。

今回の実行時要求はElectron mainのカスタムプロトコルによって次へ解決された。

| 実行時URL | packaged配置先 |
|---|---|
| `/assets/models/*` | `process.resourcesPath/ocr-assets/models/*` |
| `/assets/wasm/*` | `process.resourcesPath/ocr-assets/wasm/*` |

したがって、開発用`dist`や外部URLではなく、portable EXEから展開された`extraResources`を利用したOCR成功である。

## 試験中に解決した事項

最初の自動試験では、PlaywrightがCDPのHTTPエンドポイントへの接続を環境プロキシへ送り502となった。ループバックから取得したWebSocket debugger URLへ直接接続するよう変更し、OCR通信とは独立したテスト環境問題を解消した。

その後の1回目はモデル初期化の完了待ちが180秒でタイムアウトしたが、同じEXEでの再試験は104秒で全検証に成功し、問題は再現しなかった。モデル要求・WASM要求・Worker生成を含む最終試験は成功している。初回展開やセキュリティソフトの影響を含む起動時間のばらつきは、WBS 21.10とWBS 22.14で反復測定する後工程課題とした。

## 自動検証結果

2026-08-07の最終結果は次のとおり。

| 検証 | 結果 |
|---|---|
| `npm run lint` | 成功、31ファイル |
| `npm run typecheck` | 成功 |
| `npm run test` | 2ファイル、3件成功 |
| `npm run verify:portable` | PE、SHA-256、10 OCR資産の検証成功 |
| `npm run test:e2e:portable` | 成功、英数字・日本語OCR成功 |
| 検出・認識モデル要求 | 成功 |
| ORT WASM要求 | 成功 |
| OCR Worker生成 | 成功 |
| 外部HTTP/HTTPS要求 | 0件 |
| 要求失敗・renderer例外 | 0件 |
| テスト後の残留`LocalOCR`プロセス | 0件 |

## 完了条件

単一portable EXEからローカルモデルとWASMを読み込み、Worker内で英数字および日本語OCRに成功したため、WBS 2.13を完了と判定する。

## 次のWBS

WBS 2.14「日本語パス・空白パス試験」を実施する。portable EXEを日本語を含むパスと空白を含むパスへ配置し、それぞれ起動とOCR成功を確認する。
