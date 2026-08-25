import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

const FONT = "Arial";

/**
 * Splits a line on **bold** spans. Anything else is passed through verbatim —
 * the generated document uses bold for emphasis and nothing more exotic.
 */
function runsFor(line: string, opts: { bold?: boolean; size?: number } = {}) {
  const size = opts.size ?? 24; // half-points, so 24 = 12pt
  return line
    .split(/(\*\*[^*]+\*\*)/g)
    .filter((piece) => piece !== "")
    .map((piece) => {
      const bold = piece.startsWith("**") && piece.endsWith("**");
      return new TextRun({
        text: bold ? piece.slice(2, -2) : piece,
        bold: bold || opts.bold,
        size,
        font: FONT,
        rightToLeft: true,
      });
    });
}

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel], size: number) {
  return new Paragraph({
    heading: level,
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    spacing: { before: 280, after: 140, line: 380 },
    children: runsFor(text, { bold: true, size }),
  });
}

/**
 * Renders the stored Markdown into a Word document.
 *
 * Nothing is cached: the file is a second representation of text that already
 * exists, and a stored copy goes stale the moment a document is regenerated.
 * `document_md` in the database stays the single source of truth.
 */
export async function markdownToDocx(markdown: string, title: string): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.RIGHT,
      spacing: { after: 320, line: 380 },
      children: runsFor(title, { bold: true, size: 36 }),
    }),
  ];

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trimEnd();
    const text = line.trim();

    if (!text) continue;

    if (text.startsWith("#### ")) {
      children.push(heading(text.slice(5), HeadingLevel.HEADING_3, 26));
    } else if (text.startsWith("### ")) {
      children.push(heading(text.slice(4), HeadingLevel.HEADING_2, 28));
    } else if (text.startsWith("## ")) {
      children.push(heading(text.slice(3), HeadingLevel.HEADING_1, 32));
    } else if (text.startsWith("# ")) {
      children.push(heading(text.slice(2), HeadingLevel.HEADING_1, 32));
    } else if (/^[-*]\s+/.test(text)) {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          bidirectional: true,
          alignment: AlignmentType.RIGHT,
          spacing: { after: 100, line: 380 },
          children: runsFor(text.replace(/^[-*]\s+/, "")),
        }),
      );
    } else {
      // Numbered lines keep their literal numbering: the question list and the
      // answer key have to line up, and Word's own numbering would renumber them.
      children.push(
        new Paragraph({
          bidirectional: true,
          alignment: AlignmentType.RIGHT,
          spacing: { after: 140, line: 380 },
          children: runsFor(text),
        }),
      );
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: FONT, size: 24, rightToLeft: true } },
      },
    },
    sections: [
      {
        properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

/** Word rejects these in a filename; Arabic characters are fine. */
export function safeFileName(title: string) {
  const cleaned = title.replace(/[\\/:*?"<>|]/g, "").trim();
  return (cleaned || "محاضرة").slice(0, 80);
}
