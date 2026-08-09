# WBS 2.4 OCRモデルのライセンス確認

## 結論

WBS 2.3で選定した次の2モデルは、Apache License 2.0の条件を満たす限り、Local OCRのportable配布物へ同梱して再配布できると判断する。

| 役割 | モデル | ライセンス | 再配布判定 |
|---|---|---|---|
| 文字検出 | `PP-OCRv5_mobile_det` | Apache-2.0 | 条件付きで可 |
| 文字認識 | `PP-OCRv5_mobile_rec` | Apache-2.0 | 条件付きで可 |
| 認識文字辞書 | `PP-OCRv5_mobile_rec/inference.yml`内の`character_dict` | モデル配布物のApache-2.0表示に包含 | 条件付きで可 |

この判定はWBS 2.3で記録した公式ONNX tarの同一内容に限る。PP-OCRv6、`japan_PP-OCRv3_mobile_rec`、別形式・別配布元のモデルには自動的に適用しない。

## 確認対象

2026-08-06にPaddleOCR.js 0.4.2の公式資産定義が参照するURLから取得した、次のアーカイブを確認した。

| ファイル | SHA-256 |
|---|---|
| `PP-OCRv5_mobile_det_onnx_infer.tar` | `781056046C9ED77A15C94681605DB6A0F62317C2E9CCE6931C71DA2478D4BC30` |
| `PP-OCRv5_mobile_rec_onnx_infer.tar` | `F7E792BC836F36E7EF895AD47C426D75B0B75B1650CAA6D63FE9418441FFBA8C` |

## ライセンス根拠

### 配布アーカイブ

両tarに含まれる`README.md`のYAML front matterは、いずれも次の表示だけを持つ。

```yaml
---
license: apache-2.0
---
```

両tarには`LICENSE`、`NOTICE`、`COPYING`という名前のファイルが存在しないことも確認した。

### 公式モデルカード

PaddlePaddle公式Hugging Faceモデルカードも、検出・認識モデルをそれぞれ`apache-2.0`として公開している。

- 検出モデル: `https://huggingface.co/PaddlePaddle/PP-OCRv5_mobile_det/raw/main/README.md`
- 認識モデル: `https://huggingface.co/PaddlePaddle/PP-OCRv5_mobile_rec/raw/main/README.md`

モデルカードは両モデルをPaddleOCRチームが開発したPP-OCRv5シリーズとして説明している。認識モデルカードは、日本語・英語を含む4言語を単一モデルで扱うことも明記している。

### PaddleOCR公式リポジトリ

PaddleOCR公式リポジトリはプロジェクトをApache License 2.0で公開しており、ルートの`LICENSE`にはApache License 2.0全文と`Copyright (c) 2016 PaddlePaddle Authors`の表示がある。

- `https://github.com/PaddlePaddle/PaddleOCR/blob/main/LICENSE`

公式リポジトリのルートには、2026-08-06確認時点で`NOTICE`または`NOTICE.txt`は存在しなかった。

## Apache-2.0から生じる配布条件

Local OCRでモデルを再配布する場合、少なくとも次を満たす。

1. 配布先へApache License 2.0の全文を提供する。
2. モデル、設定、辞書を変更した場合は、変更したファイルへ目立つ変更表示を付ける。
3. 配布元の著作権、特許、商標、帰属表示を保持する。
4. 対象成果物に`NOTICE`が追加された場合は、その帰属表示もApache-2.0第4条に従って同梱する。
5. PaddlePaddleまたはPaddleOCRの商標を、Local OCRが公式に承認された製品であるかのように使用しない。出所説明に必要な通常の表示に限定する。

Apache-2.0は、条件を満たしたソース形式・オブジェクト形式での複製、派生物作成、サブライセンス、配布を許諾する。ソースコード公開を要求するコピーレフト条項はない。

## Local OCRで必要な実装・リリース対応

モデル同梱を開始する段階で、次の構成を採用する。

- portable配布物にApache License 2.0全文を含める。
- `THIRD_PARTY_NOTICES.txt`または同等のライセンス一覧へ、次を記載する。
  - `PP-OCRv5_mobile_det`
  - `PP-OCRv5_mobile_rec`
  - Copyright: PaddlePaddle Authors
  - License: Apache License 2.0
  - 公式モデルカードおよび配布元URL
- モデルtar内の`README.md`を削除せず保持する。
- 原則として公式tarを無改変で同梱し、WBS 2.3記録のSHA-256をビルド時に照合する。
- tarを展開・再梱包する場合も、モデルカードとライセンス表示を配布物から失わせない。
- `inference.yml`または文字辞書を編集する場合は、変更内容と変更者を明示する。
- モデル更新時は、バージョン、ハッシュ、モデルカード、`LICENSE`、`NOTICE`の有無を再監査する。

ライセンス本文と第三者表示ファイルの実体は、アプリケーション／配布基盤を作成するWBSで追加する。WBS 2.4では配布条件の記録に留め、モデル本体はまだリポジトリへ追加しない。

## 文字辞書の扱い

`PP-OCRv5_mobile_rec_onnx_infer.tar`では、文字辞書が独立ファイルではなく、Apache-2.0表示を持つモデル配布物の`inference.yml`内に含まれている。配布物内や公式モデルカードに辞書だけを別条件とする記載は見つからなかったため、選定した配布物の一部としてApache-2.0条件で扱う。

ただし、辞書だけを抽出・変更して別資産として再配布する場合も派生物として扱い、Apache-2.0全文、帰属表示、変更表示を維持する。

## 残余リスク

- モデルカードには学習データセットの権利・出所の完全な一覧が掲載されていない。公式配布者がモデルをApache-2.0で提供していることを再配布根拠とするが、正式リリース前の法務確認項目として残す。
- 公式ONNX tar自体にApache-2.0全文が入っていないため、Local OCRの配布工程でライセンス本文を確実に補う必要がある。
- 上流が同じURLのファイルを差し替える可能性がある。記録済みハッシュと一致しないモデルは自動採用せず、再レビューする。
- ONNX変換済みモデルと元のPaddleモデルの対応を示す、独立したバージョン番号はアーカイブ内にない。モデル名、配布URL、取得日、SHA-256を来歴情報として保持する。

これらは現時点でPoCを停止する矛盾ではないが、ライセンス表示とハッシュ固定を実装せずにリリースしてはならない。

## Gate Aへの反映

Gate Aの「ライセンス上、再配布できる」は、選定した2つのPP-OCRv5 ONNXモデルについて条件付きで成立する。

- PoC継続: 可
- portable版への同梱: Apache-2.0全文と第三者表示の同梱を条件に可
- 無表示での配布: 不可
- 別モデルへの差し替え: ライセンス再確認が必要

この結果だけではGate A全体を通過したことにはならない。

## 完了条件

WBS 2.4の完了条件「配布条件明記」を満たす。

> 注: 本書は開発上のライセンス適合性レビューであり、個別案件に対する法律意見ではない。
