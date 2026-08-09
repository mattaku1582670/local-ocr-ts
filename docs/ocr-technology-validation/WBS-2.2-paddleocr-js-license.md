# WBS 2.2 PaddleOCR.jsライセンス調査

- 対象WBS: 2.2 ライセンスを確認
- 調査日: 2026-08-06
- 対象候補: `@paddleocr/paddleocr-js@0.4.2`
- 状態: 完了
- 判定: 条件付きで再配布可能
- 法的助言ではなく、リリース設計のための技術的ライセンス調査である

## 結論

`@paddleocr/paddleocr-js@0.4.2`と、調査時点で解決されたソフトウェア依存関係から、GPL、AGPL、LGPL等のコピーレフトライセンスは検出されなかった。確認されたライセンスはApache-2.0、MIT、BSD-3-Clause、ISC、Python-2.0、Boost Software License系であり、各ライセンスの表示・著作権表示・免責文を配布物へ含めることを条件に、Local OCRへの同梱・再配布は可能と判断する。

ただし、次の条件を満たすまではリリース可能とは判定しない。

1. 最終lockfileを基準に依存一覧を再生成する。
2. SDK、ONNX Runtime、OpenCV.js、Clipper、JSBNおよび全推移依存のライセンス本文と著作権表示を`THIRD_PARTY_NOTICES.txt`等へ収録する。
3. ONNX Runtimeの、採用バージョンに対応する`ThirdPartyNotices.txt`を収録する。
4. 配布物生成時にライセンス一覧の欠落を検査する。
5. WBS 2.4で日本語モデル、辞書、モデルアーカイブを別途審査する。

モデルと辞書はこの判定に含まない。

## SDK本体

| 項目 | 確認結果 |
|---|---|
| package | `@paddleocr/paddleocr-js@0.4.2` |
| npm metadata | `Apache-2.0` |
| upstream | `PaddlePaddle/PaddleOCR` |
| upstream LICENSE | Apache License 2.0 |
| npm tarballのLICENSE | 含まれない |
| npm tarballのNOTICE | 含まれない |
| 再配布判断 | Apache-2.0本文と必要な帰属表示をアプリ側で同梱する条件で可 |

Apache-2.0対応として、少なくとも以下を行う。

- ライセンス本文を受領者へ提供する。
- 上流の著作権、特許、商標、帰属表示を保持する。
- SDKを改変して配布する場合は、変更したファイルへ変更通知を付ける。
- 上流のNOTICEが対象バージョンに存在する場合は、該当する表示を保持する。
- PaddlePaddle等の商標利用許諾を意味する表現を行わない。

## 直接依存

`@paddleocr/paddleocr-js@0.4.2`のpackage metadataで次の4依存を確認した。

| package宣言 | ライセンス | 公開成果物のLICENSE/NOTICE | 判定・対応 |
|---|---|---|---|
| `@techstark/opencv-js@^4.10.0-release.1` | Apache-2.0 | LICENSEあり | 再配布可。OpenCV由来コードを含むため、ライセンスと該当する第三者表示を収録する |
| `clipper-lib@^6.4.2` | BSL表記 | LICENSEファイルなし | 再配布可。Boost Software License 1.0本文、Angus Johnsonの表示、内包JSBNのTom Wu表示とライセンスを収録する |
| `js-yaml@^4.1.0` | MIT | LICENSEあり | 再配布可。著作権表示とMIT本文を収録する |
| `onnxruntime-web@^1.22.0` | MIT | npm成果物にLICENSE/ThirdPartyNoticesなし | 再配布可。Microsoft MIT本文と、採用バージョンの上流ThirdPartyNoticesを別途収録する |

SDKの公開Worker sourcemapを調べた結果、この4パッケージ由来のソースがWorker bundleへ含まれている。`node_modules`を配布しない構成でも、4依存のライセンス表示は省略できない。

## 調査時点の推移依存

2026-08-06に`@paddleocr/paddleocr-js@0.4.2`を新規lockfileへ解決した結果である。上流がsemver範囲を宣言しているため、これは最終採用バージョンではない。

| package | 解決バージョン | license |
|---|---:|---|
| `@paddleocr/paddleocr-js` | 0.4.2 | Apache-2.0 |
| `@techstark/opencv-js` | 4.10.0-release.1 | Apache-2.0 |
| `clipper-lib` | 6.4.2 | BSL |
| `js-yaml` | 4.3.1 | MIT |
| `argparse` | 2.0.1 | Python-2.0 |
| `onnxruntime-web` | 1.27.0 | MIT |
| `onnxruntime-common` | 1.27.0 | MIT |
| `flatbuffers` | 25.9.23 | Apache-2.0 |
| `guid-typescript` | 1.0.9 | ISC |
| `long` | 5.3.2 | Apache-2.0 |
| `platform` | 1.3.6 | MIT |
| `protobufjs` | 7.6.5 | BSD-3-Clause |
| `@protobufjs/aspromise` | 1.1.2 | BSD-3-Clause |
| `@protobufjs/base64` | 1.1.2 | BSD-3-Clause |
| `@protobufjs/codegen` | 2.0.5 | BSD-3-Clause |
| `@protobufjs/eventemitter` | 1.1.1 | BSD-3-Clause |
| `@protobufjs/fetch` | 1.1.1 | BSD-3-Clause |
| `@protobufjs/float` | 1.0.2 | BSD-3-Clause |
| `@protobufjs/path` | 1.1.2 | BSD-3-Clause |
| `@protobufjs/pool` | 1.1.0 | BSD-3-Clause |
| `@protobufjs/utf8` | 1.1.2 | BSD-3-Clause |
| `@types/node` | 26.1.2 | MIT |
| `undici-types` | 8.3.0 | MIT |

現在の解決結果に「ライセンス未記載」のパッケージはなかった。

## バージョン固定に関する発見

SDK本体を`0.4.2`へ固定しても、直接依存はcaret範囲で宣言されている。このため、調査時点の新規インストールでは、宣言下限の`onnxruntime-web@1.22.0`ではなく`1.27.0`が解決された。

この差はライセンス上はMITのままだが、WASM名、API、Worker、Vite、Electronとの互換性へ影響し得る。WBS 2.5のPoC開始時に次のどちらを採るかを技術的に比較する。

- 通常解決された`onnxruntime-web@1.27.0`をlockfileで固定する。
- SDK公開時の検証対象に近いバージョンへ`overrides`等で固定する。

互換性検証なしに依存バージョンを強制固定しない。

また、`js-yaml@^4.1.0`は調査時点で`4.3.1`へ解決された。既知問題が修正されていない`4.1.0`へ戻さず、lockfile確定時に脆弱性監査も行う。

## 公開成果物の確認

`npm pack --dry-run --json`による確認結果:

| package | 確認結果 |
|---|---|
| `@paddleocr/paddleocr-js@0.4.2` | 71ファイル。LICENSE/NOTICEなし。約11MBのWorker JSとsourcemapを含む |
| `onnxruntime-web@1.22.0` | LICENSE/NOTICEなし。2種類のWASMを含む |
| `@techstark/opencv-js@4.10.0-release.1` | LICENSEあり |
| `clipper-lib@6.4.2` | LICENSEファイルなし。ソースヘッダーにBSLとJSBN帰属表示あり |
| `js-yaml@4.1.0` | LICENSEあり |

npm成果物にライセンスファイルがないことはライセンス不明を意味しないが、そのまま配布物へコピーするだけでは必要表示が不足する。アプリ側のライセンス収集工程で補完する。

## リリース時の必須成果物

WBS 23.5/23.6で以下を生成・同梱する。

- `THIRD_PARTY_NOTICES.txt`または`LICENSES.html`
- package名、固定バージョン、出所URL、ライセンス識別子
- 各ライセンス本文と必要な著作権・帰属表示
- PaddleOCR Apache-2.0本文
- ONNX Runtime MIT本文とバージョン対応の`ThirdPartyNotices.txt`
- OpenCV.js/OpenCVのApache-2.0本文と該当第三者表示
- Clipper BSL-1.0本文、Angus Johnsonの著作権表示
- Clipperに内包されたJSBNのTom Wuライセンスと著作権表示
- モデルと辞書のライセンス情報（WBS 2.4で追加）

ビルド時にはlockfileと成果物の実体を走査し、一覧にない依存またはライセンス不明の依存が存在した場合に失敗させる。

## 一次情報

- PaddleOCR LICENSE: https://github.com/PaddlePaddle/PaddleOCR/blob/main/LICENSE
- PaddleOCR.js package metadata: https://github.com/PaddlePaddle/PaddleOCR/blob/main/paddleocr-js/packages/core/package.json
- PaddleOCR.js npm: https://www.npmjs.com/package/@paddleocr/paddleocr-js
- ONNX Runtime LICENSE: https://github.com/microsoft/onnxruntime/blob/main/LICENSE
- ONNX Runtime ThirdPartyNotices: https://github.com/microsoft/onnxruntime/blob/main/ThirdPartyNotices.txt
- OpenCV.js package repository/LICENSE: https://github.com/TechStark/opencv-js
- clipper-lib source license headers: https://github.com/junmer/clipper-lib/blob/master/clipper.js
- clipper-lib npm metadata: https://www.npmjs.com/package/clipper-lib
- js-yaml LICENSE: https://github.com/nodeca/js-yaml/blob/master/LICENSE

## 完了判定

WBS 2.2の完了条件「再配布可否明記」を満たす。

判定は「ソフトウェア依存について条件付きで再配布可能」である。モデルと辞書はWBS 2.3で候補を特定した後、WBS 2.4で別途判定する。
