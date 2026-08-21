import { jsPDF } from "jspdf";

const PAGE_MARGIN = 48;
const LINE_HEIGHT = 16;
const FONT_BODY = 11;
const FONT_H1 = 18;
const FONT_H2 = 14;
const FONT_H3 = 12.5;
const FONT_H4 = 11.5;
const INDENT_STEP = 16;

// Space added before and after a heading, indexed by heading level (h1..h6).
const SPACE_BEFORE_HEADING = [10, 8, 6, 4, 4, 4];
const SPACE_AFTER_HEADING = [6, 4, 3, 2, 2, 2];
const HEADING_SIZE = [FONT_H1, FONT_H2, FONT_H3, FONT_H4, FONT_H4, FONT_H4];

function stripInline(text) {
  return String(text)
    .replace(/!?\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, (_match, label, url) =>
      label ? `${label} (${url})` : url
    )
    .replace(/`{1,3}([^`]+)`{1,3}/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(
      /(^|[\s(["'])\*([^\s*][^*\n]*[^\s*]|[^\s*])\*(?=[\s.,;:!?)\]"'-]|$)/g,
      "$1$2"
    )
    .replace(
      /(^|[\s(["'])_([^\s_][^_\n]*[^\s_]|[^\s_])_(?=[\s.,;:!?)\]"'-]|$)/g,
      "$1$2"
    )
    .replace(/~~([^~]+)~~/g, "$1");
}

/** True for a row of a GFM table (leading pipe, or at least two pipes). */
function isTableRow(line) {
  if (typeof line !== "string" || !line.includes("|")) return false;
  return line.trim().startsWith("|") || (line.match(/\|/g) || []).length >= 2;
}

/** True for the `| --- | :---: |` row that separates a table's head from its body. */
function isTableDivider(line) {
  if (typeof line !== "string") return false;
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
}

/** Split one table row into trimmed, inline-stripped cells. */
function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => stripInline(cell.trim()));
}

/**
 * Exports literature review text (or any AI-generated Markdown-style
 * text) to a downloadable PDF file.
 *
 * @param {string} reviewText - The AI-generated review content.
 * @param {string} documentTitle - Title shown at the top of the PDF and used as the filename.
 */
export function exportReviewToPdf(reviewText, documentTitle = "Literature Review") {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableWidth = pageWidth - PAGE_MARGIN * 2;

  let cursorY = PAGE_MARGIN;

  const ensureSpace = (neededHeight) => {
    if (cursorY + neededHeight > pageHeight - PAGE_MARGIN) {
      doc.addPage();
      cursorY = PAGE_MARGIN;
    }
  };

  const writeWrappedText = (text, fontSize, isBold = false, indent = 0, font = "helvetica") => {
    doc.setFont(font, isBold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, usableWidth - indent);
    lines.forEach((line) => {
      ensureSpace(LINE_HEIGHT);
      doc.text(line, PAGE_MARGIN + indent, cursorY);
      cursorY += LINE_HEIGHT;
    });
  };

  const writeRule = () => {
    ensureSpace(LINE_HEIGHT);
    doc.setDrawColor(210);
    doc.line(PAGE_MARGIN, cursorY, pageWidth - PAGE_MARGIN, cursorY);
    cursorY += LINE_HEIGHT;
  };

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(FONT_H1 + 2);
  const titleLines = doc.splitTextToSize(documentTitle, usableWidth);
  titleLines.forEach((line) => {
    ensureSpace(LINE_HEIGHT + 4);
    doc.text(line, PAGE_MARGIN, cursorY);
    cursorY += LINE_HEIGHT + 4;
  });
  cursorY += 8;

  doc.setDrawColor(200);
  doc.line(PAGE_MARGIN, cursorY, pageWidth - PAGE_MARGIN, cursorY);
  cursorY += 20;

  // Parse and render line by line
  const rawLines = String(reviewText || "").split("\n");
  let inCodeFence = false;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trimEnd();
    const trimmed = line.trim();

    if (/^```/.test(trimmed)) {
      inCodeFence = !inCodeFence;
      cursorY += LINE_HEIGHT / 3;
      continue;
    }

    if (inCodeFence) {
      const lead = (line.match(/^ */) || [""])[0].length;
      writeWrappedText(
        line.trimStart() || " ",
        FONT_BODY - 1,
        false,
        INDENT_STEP + lead * 5,
        "courier"
      );
      continue;
    }

    if (!trimmed) {
      cursorY += LINE_HEIGHT / 2;
      continue;
    }

    // Convert GFM tables to indented key-value pairs for PDF width
    if (isTableRow(line) && isTableDivider(rawLines[i + 1])) {
      const headers = splitRow(line);
      let j = i + 2;

      while (j < rawLines.length && rawLines[j].includes("|")) {
        if (isTableDivider(rawLines[j])) {
          j++;
          continue;
        }

        const cells = splitRow(rawLines[j]);

        ensureSpace(LINE_HEIGHT * 2);
        writeWrappedText(cells[0] || "—", FONT_BODY, true);

        for (let c = 1; c < cells.length; c++) {
          const label = headers[c] || `Column ${c + 1}`;
          writeWrappedText(`${label}: ${cells[c] || "—"}`, FONT_BODY, false, INDENT_STEP);
        }

        cursorY += LINE_HEIGHT / 3;
        j++;
      }

      i = j - 1;
      continue;
    }

    if (/^([-*_])\1{2,}$/.test(trimmed)) {
      writeRule();
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      const level = heading[1].length;
      const size = HEADING_SIZE[level - 1];
      cursorY += SPACE_BEFORE_HEADING[level - 1];
      ensureSpace(size + LINE_HEIGHT);
      writeWrappedText(stripInline(heading[2]), size, true);
      cursorY += SPACE_AFTER_HEADING[level - 1];
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(trimmed);
    if (quote) {
      writeWrappedText(stripInline(quote[1]), FONT_BODY, false, INDENT_STEP);
      continue;
    }

    const bullet = /^(\s*)[-*+]\s+(.*)$/.exec(line);
    if (bullet) {
      const depth = Math.min(Math.floor(bullet[1].length / 2), 3);
      const marker = depth === 0 ? "•" : depth === 1 ? "–" : "·";
      writeWrappedText(
        `${marker}  ${stripInline(bullet[2])}`,
        FONT_BODY,
        false,
        depth * INDENT_STEP
      );
      continue;
    }

    const numbered = /^(\s*)(\d+[.)])\s+(.*)$/.exec(line);
    if (numbered) {
      const depth = Math.min(Math.floor(numbered[1].length / 2), 3);
      writeWrappedText(
        `${numbered[2]}  ${stripInline(numbered[3])}`,
        FONT_BODY,
        false,
        depth * INDENT_STEP
      );
      continue;
    }

    const boldOnly = /^\*\*(.+?)\*\*:?$/.exec(trimmed);
    if (boldOnly) {
      cursorY += 4;
      writeWrappedText(stripInline(boldOnly[1]), FONT_BODY, true);
      continue;
    }

    writeWrappedText(stripInline(line), FONT_BODY, false);
  }

  // Footer with page numbers
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text(
      `Page ${i} of ${pageCount} — Generated by ResearchVault AI`,
      pageWidth / 2,
      pageHeight - 20,
      { align: "center" }
    );
  }

  const safeFilename = documentTitle
    .replace(/[^a-z0-9\s-]/gi, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 80) || "literature_review";

  doc.save(`${safeFilename}.pdf`);
}
