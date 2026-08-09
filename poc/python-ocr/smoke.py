from __future__ import annotations

import json
import os
from pathlib import Path
from time import perf_counter
from typing import Any

PROJECT_DIRECTORY = Path(__file__).resolve().parent
os.environ.setdefault("PADDLE_PDX_CACHE_HOME", str(PROJECT_DIRECTORY / "models"))
os.environ.setdefault("PADDLE_PDX_MODEL_SOURCE", "bos")
os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")

from paddleocr import PaddleOCR  # noqa: E402


def describe(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: describe(nested) for key, nested in value.items()}
    if isinstance(value, list):
        return {
            "type": "list",
            "length": len(value),
            "item": None if not value else describe(value[0]),
        }
    return type(value).__name__


started = perf_counter()
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
initialized_ms = (perf_counter() - started) * 1000
image_path = (
    PROJECT_DIRECTORY.parent
    / "browser-ocr"
    / "evaluation"
    / "generated"
    / "v1"
    / "windows-ui-01.png"
)
started = perf_counter()
results = list(ocr.predict(str(image_path)))
predicted_ms = (perf_counter() - started) * 1000
if not results:
    raise RuntimeError("PYTHON_OCR_RESULT_MISSING")

print(
    json.dumps(
        {
            "initializationMs": initialized_ms,
            "predictionMs": predicted_ms,
            "resultCount": len(results),
            "schema": describe(results[0].json),
        },
        ensure_ascii=False,
        indent=2,
    )
)
