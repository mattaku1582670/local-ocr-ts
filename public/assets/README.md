# OCR runtime assets

Run `npm run stage:ocr-assets` before local OCR execution. The command copies the documented
PP-OCRv5 model archives and the pinned ONNX Runtime Web WASM files into ignored subdirectories.
Binary models and WASM artifacts are intentionally not committed.

The staging command verifies the two model archives against the SHA-256 values established in
the Gate A technology validation before copying them. The application resolves every runtime
asset relative to its own origin and does not fall back to a CDN.
