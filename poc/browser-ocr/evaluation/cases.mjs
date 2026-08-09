const categoryDefinitions = [
  {
    category: "windows-ui",
    count: 7,
    height: 720,
    lines: (index) => [
      `ローカルOCR 設定 ${String(index)}`,
      "ファイルを開く  画像を貼り付け  範囲を選択",
      `処理状態: 待機中  ページ ${String(index)} / 7`,
      "保存形式: TXT / JSON  言語: 日本語・英数字",
    ],
    style: "windows-ui",
    width: 1280,
  },
  {
    category: "japanese-document",
    count: 7,
    height: 1800,
    lines: (index) => [
      `業務報告書 第${String(index)}号`,
      "本資料は文字認識精度を確認するための評価文書です。",
      "画像データは外部へ送信せず端末内で処理します。",
      `対象年度 2026年度  管理番号 DOC-${String(index).padStart(3, "0")}`,
      "確認者は認識結果を原画像と照合してください。",
      "以上",
    ],
    style: "japanese-document",
    width: 1273,
  },
  {
    category: "photographed-document",
    count: 6,
    height: 960,
    lines: (index) => [
      `撮影文書サンプル ${String(index)}`,
      "領収金額 12,345円  日付 2026年8月7日",
      `受付番号 PHOTO-${String(index).padStart(2, "0")}-ABC`,
      "傾きと背景ノイズを含む文書画像です。",
    ],
    style: "photographed-document",
    width: 1280,
  },
  {
    category: "small-text",
    count: 6,
    height: 900,
    lines: (index) => [
      `小さい文字の評価 ${String(index)}`,
      "注意事項をよく読んでから操作してください。",
      "対応形式はPNG JPEG WebP BMPです。",
      "OCR結果は編集後にTXTまたはJSONで保存できます。",
      "英数字 Sample-ABC-1234567890 を含みます。",
      "表示倍率125%および150%を想定します。",
      "管理者権限を必要としません。",
      "終了前に未保存結果を確認してください。",
    ],
    style: "small-text",
    width: 1600,
  },
  {
    category: "mixed-alphanumeric",
    count: 6,
    height: 720,
    lines: (index) => [
      `注文番号 ORD-2026-${String(index).padStart(4, "0")}`,
      "商品コード OCR-JP-5A7X  数量 128",
      "Subtotal JPY 98,765  Tax 10%  Total 108,642",
      `Email sample${String(index)}@example.local  TEL 03-1234-5678`,
      "検査結果 PASS  Confidence 98.5%",
    ],
    style: "mixed-alphanumeric",
    width: 1280,
  },
  {
    category: "table",
    count: 6,
    height: 900,
    lines: (index) => [
      `月次集計表 ${String(index)}`,
      "項目 数量 単価 金額",
      "商品A 12 1200 14400",
      "商品B 8 2500 20000",
      "商品C 25 360 9000",
      "合計 45 - 43400",
    ],
    style: "table",
    width: 1400,
  },
  {
    category: "vertical-reference",
    count: 6,
    height: 1200,
    lines: (index) => [`縦書き評価第${String(index)}号`, "日本語文字認識", "令和八年度資料"],
    style: "vertical-reference",
    width: 900,
  },
  {
    category: "low-contrast",
    count: 6,
    height: 900,
    lines: (index) => [
      `低コントラスト評価 ${String(index)}`,
      "薄い文字と背景色の差が小さい画像です。",
      "Local OCR Test ABC 123",
      `管理番号 LOW-${String(index).padStart(2, "0")}-2026`,
      "認識結果と信頼度を確認してください。",
    ],
    style: "low-contrast",
    width: 1400,
  },
];

export function buildEvaluationCases() {
  return categoryDefinitions.flatMap((definition) =>
    Array.from({ length: definition.count }, (_, zeroBasedIndex) => {
      const index = zeroBasedIndex + 1;
      const lines = definition.lines(index);
      return {
        category: definition.category,
        expectedText: lines.join("\n"),
        height: definition.height,
        id: `${definition.category}-${String(index).padStart(2, "0")}`,
        lines,
        style: definition.style,
        variant: index,
        width: definition.width,
      };
    }),
  );
}
