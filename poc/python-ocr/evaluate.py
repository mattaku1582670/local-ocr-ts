from __future__ import annotations

import hashlib
import json
import os
import platform
import statistics
import sys
import unicodedata
from collections import defaultdict
from importlib.metadata import version
from pathlib import Path
from time import perf_counter
from typing import Any

import psutil

PROJECT_DIRECTORY = Path(__file__).resolve().parent
REPOSITORY_DIRECTORY = PROJECT_DIRECTORY.parent.parent
DATASET_DIRECTORY = (
    PROJECT_DIRECTORY.parent / "browser-ocr" / "evaluation" / "generated" / "v1"
)
RESULTS_DIRECTORY = PROJECT_DIRECTORY / "results"
os.environ.setdefault("PADDLE_PDX_CACHE_HOME", str(PROJECT_DIRECTORY / "models"))
os.environ.setdefault("PADDLE_PDX_MODEL_SOURCE", "bos")
os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")

from paddleocr import PaddleOCR  # noqa: E402


def normalize_cer_text(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).split())


def normalize_strict_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value).replace("\r\n", "\n").replace("\r", "\n")
    return "\n".join(line.rstrip() for line in normalized.split("\n")).strip()


def levenshtein_distance(reference: str, hypothesis: str) -> int:
    previous = list(range(len(hypothesis) + 1))
    for reference_index, reference_character in enumerate(reference, start=1):
        current = [reference_index]
        for hypothesis_index, hypothesis_character in enumerate(hypothesis, start=1):
            current.append(
                min(
                    previous[hypothesis_index] + 1,
                    current[hypothesis_index - 1] + 1,
                    previous[hypothesis_index - 1]
                    + (reference_character != hypothesis_character),
                )
            )
        previous = current
    return previous[-1]


def measure_cer(reference: str, hypothesis: str, *, strict: bool = False) -> dict[str, int | float]:
    normalizer = normalize_strict_text if strict else normalize_cer_text
    normalized_reference = normalizer(reference)
    normalized_hypothesis = normalizer(hypothesis)
    distance = levenshtein_distance(normalized_reference, normalized_hypothesis)
    reference_length = len(normalized_reference)
    return {
        "cer": (0.0 if not normalized_hypothesis else 1.0)
        if reference_length == 0
        else distance / reference_length,
        "distance": distance,
        "referenceLength": reference_length,
    }


def summarize(results: list[dict[str, Any]], category: str) -> dict[str, Any]:
    distance = sum(result["distance"] for result in results)
    reference_length = sum(result["referenceLength"] for result in results)
    strict_distance = sum(result["strictDistance"] for result in results)
    strict_reference_length = sum(result["strictReferenceLength"] for result in results)
    durations = [result["durationMs"] for result in results]
    return {
        "category": category,
        "cer": 0.0 if reference_length == 0 else distance / reference_length,
        "count": len(results),
        "failedCount": sum(result["failed"] for result in results),
        "meanDurationMs": statistics.fmean(durations),
        "medianDurationMs": statistics.median(durations),
        "strictCer": 0.0
        if strict_reference_length == 0
        else strict_distance / strict_reference_length,
    }


def current_memory_bytes() -> tuple[int, int]:
    memory = psutil.Process().memory_info()
    return memory.rss, getattr(memory, "peak_wset", memory.rss)


def directory_size(directory: Path) -> int:
    return sum(path.stat().st_size for path in directory.rglob("*") if path.is_file())


def parse_result(result: Any) -> tuple[str, list[float]]:
    result_json = result.json
    if not isinstance(result_json, dict) or not isinstance(result_json.get("res"), dict):
        raise RuntimeError("PYTHON_OCR_RESULT_SCHEMA_INVALID")
    payload = result_json["res"]
    texts = payload.get("rec_texts")
    scores = payload.get("rec_scores")
    if not isinstance(texts, list) or not all(isinstance(text, str) for text in texts):
        raise RuntimeError("PYTHON_OCR_TEXT_SCHEMA_INVALID")
    if not isinstance(scores, list) or not all(isinstance(score, (int, float)) for score in scores):
        raise RuntimeError("PYTHON_OCR_SCORE_SCHEMA_INVALID")
    return "\n".join(texts), [float(score) for score in scores]


def main() -> None:
    manifest_path = DATASET_DIRECTORY / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    cases = manifest.get("cases")
    if not isinstance(cases, list) or len(cases) != 50:
        raise RuntimeError("EVALUATION_MANIFEST_INVALID")

    initialized_at = perf_counter()
    ocr = PaddleOCR(
        text_detection_model_name="PP-OCRv5_mobile_det",
        text_recognition_model_name="PP-OCRv5_mobile_rec",
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
        device="cpu",
        enable_hpi=False,
        enable_mkldnn=False,
        cpu_threads=8,
    )
    initialization_ms = (perf_counter() - initialized_at) * 1000

    case_results: list[dict[str, Any]] = []
    peak_rss_bytes, peak_working_set_bytes = current_memory_bytes()
    for index, evaluation_case in enumerate(cases, start=1):
        if not isinstance(evaluation_case, dict):
            raise RuntimeError("EVALUATION_MANIFEST_CASE_INVALID")
        case_id = evaluation_case.get("id")
        category = evaluation_case.get("category")
        expected_text = evaluation_case.get("expectedText")
        image_file = evaluation_case.get("imageFile")
        expected_sha256 = evaluation_case.get("sha256")
        if not all(isinstance(value, str) for value in (case_id, category, expected_text, image_file, expected_sha256)):
            raise RuntimeError("EVALUATION_MANIFEST_CASE_INVALID")
        image_path = DATASET_DIRECTORY / image_file
        actual_sha256 = hashlib.sha256(image_path.read_bytes()).hexdigest()
        if actual_sha256 != expected_sha256:
            raise RuntimeError("EVALUATION_IMAGE_HASH_MISMATCH")

        started_at = perf_counter()
        failed = False
        average_confidence: float | None = None
        hypothesis = ""
        error_code: str | None = None
        try:
            predictions = list(ocr.predict(str(image_path)))
            if len(predictions) != 1:
                raise RuntimeError("PYTHON_OCR_RESULT_COUNT_INVALID")
            hypothesis, scores = parse_result(predictions[0])
            if scores:
                average_confidence = statistics.fmean(scores)
        except Exception as error:  # The batch must continue and report all failed case IDs.
            failed = True
            error_code = type(error).__name__
        duration_ms = (perf_counter() - started_at) * 1000
        measurement = measure_cer(expected_text, hypothesis)
        strict_measurement = measure_cer(expected_text, hypothesis, strict=True)
        rss_bytes, working_set_bytes = current_memory_bytes()
        peak_rss_bytes = max(peak_rss_bytes, rss_bytes)
        peak_working_set_bytes = max(peak_working_set_bytes, working_set_bytes)
        case_results.append(
            {
                "averageConfidence": average_confidence,
                "category": category,
                "cer": measurement["cer"],
                "distance": measurement["distance"],
                "durationMs": duration_ms,
                "errorCode": error_code,
                "failed": failed,
                "id": case_id,
                "referenceLength": measurement["referenceLength"],
                "strictCer": strict_measurement["cer"],
                "strictDistance": strict_measurement["distance"],
                "strictReferenceLength": strict_measurement["referenceLength"],
            }
        )
        print(
            json.dumps(
                {
                    "case": case_id,
                    "durationMs": round(duration_ms, 2),
                    "failed": failed,
                    "progress": f"{index}/50",
                }
            ),
            flush=True,
        )

    categorized: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for case_result in case_results:
        categorized[case_result["category"]].append(case_result)
    horizontal_results = [
        result for result in case_results if result["category"] != "vertical-reference"
    ]
    summary = summarize(case_results, "all")
    horizontal_summary = summarize(horizontal_results, "horizontal-only")
    summary.update(
        {
            "horizontalOnlyCer": horizontal_summary["cer"],
            "horizontalOnlyCount": horizontal_summary["count"],
            "horizontalOnlyStrictCer": horizontal_summary["strictCer"],
        }
    )
    report = {
        "schemaVersion": 1,
        "measuredAt": "2026-08-07",
        "dataset": "synthetic-v1",
        "engine": {
            "architecture": platform.architecture()[0],
            "cpuThreads": 8,
            "device": "cpu",
            "enableMkldnn": False,
            "modelCacheBytes": directory_size(PROJECT_DIRECTORY / "models"),
            "models": ["PP-OCRv5_mobile_det", "PP-OCRv5_mobile_rec"],
            "paddleocrVersion": version("paddleocr"),
            "paddlepaddleVersion": version("paddlepaddle"),
            "pythonVersion": platform.python_version(),
        },
        "measurement": {
            "initializationMs": initialization_ms,
            "peakRssBytes": peak_rss_bytes,
            "peakWorkingSetBytes": peak_working_set_bytes,
        },
        "summary": summary,
        "categories": [summarize(results, category) for category, results in categorized.items()],
        "cases": case_results,
        "normalization": "Unicode NFKC; collapse all whitespace runs to one ASCII space; trim edges.",
        "limitations": [
            "Synthetic baseline only.",
            "oneDNN/MKLDNN was disabled due to a PaddlePaddle 3.3.1 Windows PIR runtime error.",
            "Real screenshots and photographed documents remain required before final Gate approval.",
        ],
    }
    RESULTS_DIRECTORY.mkdir(parents=True, exist_ok=True)
    report_path = RESULTS_DIRECTORY / "python-cer-report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"report": str(report_path), "summary": summary}, indent=2), flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"errorCode": type(error).__name__}), file=sys.stderr)
        raise
