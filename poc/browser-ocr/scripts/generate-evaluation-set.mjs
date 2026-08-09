import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

import { buildEvaluationCases } from "../evaluation/cases.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const outputDirectory = path.join(projectRoot, "evaluation", "generated", "v1");
const cases = buildEvaluationCases();
if (cases.length !== 50) {
  throw new Error(`EVALUATION_CASE_COUNT_INVALID: ${String(cases.length)}`);
}

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage();
  const manifestCases = [];
  for (const evaluationCase of cases) {
    const pngBase64 = await page.evaluate(renderEvaluationCase, evaluationCase);
    const image = Buffer.from(pngBase64, "base64");
    const fileName = `${evaluationCase.id}.png`;
    await writeFile(path.join(outputDirectory, fileName), image);
    manifestCases.push({
      category: evaluationCase.category,
      expectedText: evaluationCase.expectedText,
      height: evaluationCase.height,
      id: evaluationCase.id,
      imageBytes: image.byteLength,
      imageFile: fileName,
      sha256: createHash("sha256").update(image).digest("hex"),
      style: evaluationCase.style,
      width: evaluationCase.width,
    });
  }
  await writeFile(
    path.join(outputDirectory, "manifest.json"),
    `${JSON.stringify(
      {
        cases: manifestCases,
        generatedAt: new Date().toISOString(),
        generatorVersion: 1,
        license: "Project-generated synthetic data; no third-party image content.",
        limitations: [
          "Synthetic baseline only.",
          "Does not replace user-approved real screenshots or photographed documents.",
        ],
        schemaVersion: 1,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
} finally {
  await browser.close();
}

process.stdout.write(`Generated ${String(cases.length)} synthetic evaluation images.\n`);

function renderEvaluationCase(evaluationCase) {
  const canvas = document.createElement("canvas");
  canvas.width = evaluationCase.width;
  canvas.height = evaluationCase.height;
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("EVALUATION_CANVAS_CONTEXT_MISSING");
  }

  if (evaluationCase.style === "photographed-document") {
    drawPhotographedDocument(context, evaluationCase);
  } else if (evaluationCase.style === "windows-ui") {
    drawWindowsUi(context, evaluationCase);
  } else if (evaluationCase.style === "table") {
    drawTable(context, evaluationCase);
  } else if (evaluationCase.style === "vertical-reference") {
    drawVertical(context, evaluationCase);
  } else {
    drawDocument(context, evaluationCase);
  }
  return canvas.toDataURL("image/png").split(",")[1] ?? "";

  function drawWindowsUi(drawingContext, item) {
    drawingContext.fillStyle = "#eef2f7";
    drawingContext.fillRect(0, 0, item.width, item.height);
    drawingContext.fillStyle = "#17324d";
    drawingContext.fillRect(0, 0, item.width, 72);
    drawingContext.fillStyle = "#ffffff";
    drawingContext.font = '600 30px "Yu Gothic UI", "Segoe UI", sans-serif';
    drawingContext.fillText(item.lines[0], 38, 48);
    drawingContext.fillStyle = "#ffffff";
    drawingContext.fillRect(45, 112, item.width - 90, item.height - 157);
    drawingContext.fillStyle = "#1c2733";
    drawingContext.font = '400 28px "Yu Gothic UI", "Segoe UI", sans-serif';
    item.lines.slice(1).forEach((line, index) => {
      drawingContext.fillText(line, 90, 190 + index * 105);
    });
  }

  function drawDocument(drawingContext, item) {
    const lowContrast = item.style === "low-contrast";
    drawingContext.fillStyle = lowContrast ? "#f1f3f4" : "#ffffff";
    drawingContext.fillRect(0, 0, item.width, item.height);
    drawingContext.fillStyle = lowContrast ? "#9aa0a6" : "#111827";
    const fontSize =
      item.style === "small-text" ? 20 : item.style === "japanese-document" ? 34 : 36;
    drawingContext.font = `400 ${String(fontSize)}px "Yu Gothic UI", "Segoe UI", sans-serif`;
    const top = item.style === "japanese-document" ? 150 : 120;
    const lineHeight =
      item.style === "japanese-document" ? 150 : item.style === "small-text" ? 72 : 120;
    item.lines.forEach((line, index) => {
      drawingContext.fillText(line, 90, top + index * lineHeight);
    });
  }

  function drawPhotographedDocument(drawingContext, item) {
    const gradient = drawingContext.createLinearGradient(0, 0, item.width, item.height);
    gradient.addColorStop(0, "#77736b");
    gradient.addColorStop(1, "#b0aa9d");
    drawingContext.fillStyle = gradient;
    drawingContext.fillRect(0, 0, item.width, item.height);
    drawingContext.save();
    drawingContext.translate(item.width / 2, item.height / 2);
    drawingContext.rotate(((item.variant % 2 === 0 ? 2 : -2) * Math.PI) / 180);
    drawingContext.shadowColor = "rgba(0,0,0,0.35)";
    drawingContext.shadowBlur = 22;
    drawingContext.fillStyle = "#f8f3e8";
    drawingContext.fillRect(-500, -330, 1000, 660);
    drawingContext.shadowColor = "transparent";
    drawingContext.fillStyle = "#2b2925";
    drawingContext.font = '400 34px "Yu Gothic UI", "Segoe UI", sans-serif';
    item.lines.forEach((line, index) => {
      drawingContext.fillText(line, -430, -220 + index * 130);
    });
    drawingContext.restore();
  }

  function drawTable(drawingContext, item) {
    drawingContext.fillStyle = "#ffffff";
    drawingContext.fillRect(0, 0, item.width, item.height);
    drawingContext.fillStyle = "#111827";
    drawingContext.font = '600 38px "Yu Gothic UI", "Segoe UI", sans-serif';
    drawingContext.fillText(item.lines[0], 80, 90);
    const rows = item.lines.slice(1).map((line) => line.split(" "));
    const left = 80;
    const top = 150;
    const columnWidth = 300;
    const rowHeight = 110;
    drawingContext.font = '400 32px "Yu Gothic UI", "Segoe UI", sans-serif';
    for (let row = 0; row <= rows.length; row += 1) {
      drawingContext.beginPath();
      drawingContext.moveTo(left, top + row * rowHeight);
      drawingContext.lineTo(left + columnWidth * 4, top + row * rowHeight);
      drawingContext.stroke();
    }
    for (let column = 0; column <= 4; column += 1) {
      drawingContext.beginPath();
      drawingContext.moveTo(left + column * columnWidth, top);
      drawingContext.lineTo(left + column * columnWidth, top + rows.length * rowHeight);
      drawingContext.stroke();
    }
    rows.forEach((cells, row) => {
      cells.forEach((cell, column) => {
        drawingContext.fillText(cell, left + column * columnWidth + 24, top + row * rowHeight + 70);
      });
    });
  }

  function drawVertical(drawingContext, item) {
    drawingContext.fillStyle = "#fffdf7";
    drawingContext.fillRect(0, 0, item.width, item.height);
    drawingContext.fillStyle = "#151515";
    drawingContext.font = '400 48px "Yu Mincho", "Yu Gothic UI", serif';
    item.lines.forEach((line, column) => {
      const x = item.width - 150 - column * 190;
      Array.from(line).forEach((character, row) => {
        drawingContext.fillText(character, x, 110 + row * 62);
      });
    });
  }
}
