from __future__ import annotations

import unittest

from evaluate import levenshtein_distance, measure_cer, normalize_cer_text, normalize_strict_text


class EvaluationMetricTests(unittest.TestCase):
    def test_normalizes_nfkc_and_whitespace_like_typescript_baseline(self) -> None:
        self.assertEqual(normalize_cer_text(" Ａ\r\n B\tC "), "A B C")

    def test_strict_normalization_retains_line_breaks(self) -> None:
        self.assertEqual(normalize_strict_text("Ａ  \r\nB\t \r\n"), "A\nB")

    def test_calculates_code_point_levenshtein_distance(self) -> None:
        self.assertEqual(levenshtein_distance("日本語", "日本人"), 1)
        self.assertEqual(measure_cer("日本語", "日本人")["cer"], 1 / 3)

    def test_handles_empty_reference(self) -> None:
        self.assertEqual(measure_cer("", "")["cer"], 0)
        self.assertEqual(measure_cer("", "A")["cer"], 1)


if __name__ == "__main__":
    unittest.main()
