// src/lib/exportDocx.ts
// Stellar — 本格的な DOCX エクスポート（docx ライブラリ使用）
// Markdown → 構造化パラグラフ → .docx Blob を生成する。
// 対応: 見出し (H1-H6)、太字/斜体/取り消し線、箇条書き/番号付きリスト、
//       テーブル、引用ブロック、コードブロック、脚注、@cite{}、==ハイライト==、
//       水平線、ページ番号、学術論文向けスタイル。

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  TableLayoutType,
  Footer,
  PageNumber,
  NumberFormat,
  ShadingType,
  LevelFormat,
  convertInchesToTwip,
} from "docx";

// ============================================================
// Markdown パーサー（行ベース → ブロック → インライン）
// ============================================================

/**
 * Markdown テキストから DOCX 用の (Paragraph | Table)[] を生成する。
 */
function parseMarkdownToElements(md: string): (Paragraph | Table)[] {
  const lines = md.split("\n");
  const elements: (Paragraph | Table)[] = [];

  // 脚注定義を先に収集
  const footnoteDefs = new Map<string, string>();
  const contentLines: string[] = [];
  for (const line of lines) {
    const fnMatch = /^\[\^(\w+)\]:\s*(.+)$/.exec(line);
    if (fnMatch?.[1] != null && fnMatch[2] != null) {
      footnoteDefs.set(fnMatch[1], fnMatch[2]);
    } else {
      contentLines.push(line);
    }
  }

  let i = 0;
  while (i < contentLines.length) {
    const line = contentLines[i] ?? "";

    // ── 空行 ──
    if (line.trim() === "") {
      i++;
      continue;
    }

    // ── 水平線 ──
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      elements.push(
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999" } },
          spacing: { before: 240, after: 240 },
        }),
      );
      i++;
      continue;
    }

    // ── 見出し ──
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
    if (headingMatch?.[1] != null && headingMatch[2] != null) {
      const level = headingMatch[1].length;
      const headingMap: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
        4: HeadingLevel.HEADING_4,
        5: HeadingLevel.HEADING_5,
        6: HeadingLevel.HEADING_6,
      };
      elements.push(
        new Paragraph({
          heading: headingMap[level] ?? HeadingLevel.HEADING_1,
          children: parseInline(headingMatch[2]),
          spacing: { before: level <= 2 ? 360 : 240, after: 120 },
        }),
      );
      i++;
      continue;
    }

    // ── コードブロック ──
    if (line.trimStart().startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < contentLines.length && !(contentLines[i] ?? "").trimStart().startsWith("```")) {
        codeLines.push(contentLines[i] ?? "");
        i++;
      }
      i++; // 閉じ ```
      elements.push(
        new Paragraph({
          children: [
            new TextRun({
              text: codeLines.join("\n"),
              font: "Consolas",
              size: 18, // 9pt
              color: "333333",
            }),
          ],
          shading: { type: ShadingType.SOLID, color: "F4F4F4" },
          spacing: { before: 200, after: 200 },
        }),
      );
      continue;
    }

    // ── 引用ブロック ──
    if (line.startsWith("> ") || line === ">") {
      const quoteLines: string[] = [];
      while (
        i < contentLines.length &&
        ((contentLines[i] ?? "").startsWith("> ") || contentLines[i] === ">")
      ) {
        quoteLines.push((contentLines[i] ?? "").replace(/^>\s?/, ""));
        i++;
      }
      elements.push(
        new Paragraph({
          children: parseInline(quoteLines.join(" ")),
          indent: { left: convertInchesToTwip(0.4) },
          border: { left: { style: BorderStyle.SINGLE, size: 12, color: "666666", space: 8 } },
          spacing: { before: 160, after: 160 },
        }),
      );
      continue;
    }

    // ── テーブル ──
    if (line.includes("|") && i + 1 < contentLines.length && /^\|?\s*[-:]+/.test(contentLines[i + 1] ?? "")) {
      const tableLines: string[] = [];
      while (i < contentLines.length && (contentLines[i] ?? "").includes("|")) {
        tableLines.push(contentLines[i] ?? "");
        i++;
      }
      const table = parseTable(tableLines);
      if (table) {
        elements.push(table);
      }
      continue;
    }

    // ── 箇条書きリスト ──
    if (/^[-*+]\s/.test(line)) {
      while (i < contentLines.length && /^[-*+]\s/.test(contentLines[i] ?? "")) {
        const itemText = (contentLines[i] ?? "").replace(/^[-*+]\s/, "");
        elements.push(
          new Paragraph({
            children: parseInline(itemText),
            bullet: { level: 0 },
            spacing: { before: 40, after: 40 },
          }),
        );
        i++;
      }
      continue;
    }

    // ── 番号付きリスト ──
    if (/^\d+\.\s/.test(line)) {
      while (i < contentLines.length && /^\d+\.\s/.test(contentLines[i] ?? "")) {
        const itemText = (contentLines[i] ?? "").replace(/^\d+\.\s/, "");
        elements.push(
          new Paragraph({
            children: parseInline(itemText),
            numbering: { reference: "stellar-numbering", level: 0 },
            spacing: { before: 40, after: 40 },
          }),
        );
        i++;
      }
      continue;
    }

    // ── 通常の段落 ── 連続する非空行をまとめる
    const paraLines: string[] = [];
    while (
      i < contentLines.length &&
      (contentLines[i] ?? "").trim() !== "" &&
      !/^#{1,6}\s/.test(contentLines[i] ?? "") &&
      !(contentLines[i] ?? "").trimStart().startsWith("```") &&
      !(contentLines[i] ?? "").startsWith("> ") &&
      !/^[-*+]\s/.test(contentLines[i] ?? "") &&
      !/^\d+\.\s/.test(contentLines[i] ?? "") &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test((contentLines[i] ?? "").trim())
    ) {
      paraLines.push(contentLines[i] ?? "");
      i++;
    }

    if (paraLines.length > 0) {
      elements.push(
        new Paragraph({
          children: parseInline(paraLines.join(" ")),
          alignment: AlignmentType.JUSTIFIED,
          spacing: { before: 120, after: 120, line: 360 },
          indent: { firstLine: convertInchesToTwip(0.3) },
        }),
      );
    }
  }

  // 脚注セクション（末尾に追加）
  if (footnoteDefs.size > 0) {
    elements.push(
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" } },
        spacing: { before: 480, after: 120 },
      }),
    );
    elements.push(
      new Paragraph({
        children: [new TextRun({ text: "脚注", bold: true, size: 20 })],
        spacing: { before: 120, after: 80 },
      }),
    );
    for (const [id, text] of footnoteDefs.entries()) {
      elements.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${id}. `, bold: true, size: 18, superScript: true }),
            new TextRun({ text, size: 18, color: "555555" }),
          ],
          spacing: { before: 40, after: 40 },
          indent: { left: convertInchesToTwip(0.2) },
        }),
      );
    }
  }

  return elements;
}

// ============================================================
// インラインパーサー
// ============================================================

/**
 * インラインテキストを TextRun[] に変換する。
 * 対応: **太字**, *斜体*, ~~取り消し~~, `code`, ==ハイライト==,
 *       @cite{key}, [^n], [[WikiLink]], [text](url)
 */
function parseInline(text: string): TextRun[] {
  const runs: TextRun[] = [];

  // トークン化パターン
  const pattern =
    /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(\~\~(.+?)\~\~)|(`([^`]+)`)|(\=\=(.+?)\=\=)|(@cite\{([^}]+)\})|(\[\^(\w+)\])|\[\[([^\]]+)\]\]|\[([^\]]+)\]\(([^)]+)\)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    // マッチ前のプレーンテキスト
    if (match.index > lastIndex) {
      runs.push(new TextRun({ text: text.slice(lastIndex, match.index), size: 21 }));
    }

    if (match[1] != null && match[2] != null) {
      // **太字**
      runs.push(new TextRun({ text: match[2], bold: true, size: 21 }));
    } else if (match[3] != null && match[4] != null) {
      // *斜体*
      runs.push(new TextRun({ text: match[4], italics: true, size: 21 }));
    } else if (match[5] != null && match[6] != null) {
      // ~~取り消し~~
      runs.push(new TextRun({ text: match[6], strike: true, size: 21 }));
    } else if (match[7] != null && match[8] != null) {
      // `code`
      runs.push(
        new TextRun({
          text: match[8],
          font: "Consolas",
          size: 19,
          color: "333333",
          shading: { type: ShadingType.SOLID, color: "F0F0F0" },
        }),
      );
    } else if (match[9] != null && match[10] != null) {
      // ==ハイライト==
      runs.push(
        new TextRun({
          text: match[10],
          size: 21,
          highlight: "yellow",
        }),
      );
    } else if (match[11] != null && match[12] != null) {
      // @cite{key}
      runs.push(
        new TextRun({
          text: `[${match[12]}]`,
          color: "0066CC",
          size: 21,
        }),
      );
    } else if (match[13] != null && match[14] != null) {
      // [^n] 脚注参照
      runs.push(
        new TextRun({
          text: match[14],
          superScript: true,
          color: "0066CC",
          size: 18,
        }),
      );
    } else if (match[15] != null) {
      // [[WikiLink]]
      runs.push(new TextRun({ text: match[15], bold: true, size: 21 }));
    } else if (match[16] != null && match[17] != null) {
      // [text](url)
      runs.push(new TextRun({ text: match[16], color: "0066CC", size: 21 }));
    }

    lastIndex = match.index + match[0].length;
  }

  // 残りのプレーンテキスト
  if (lastIndex < text.length) {
    runs.push(new TextRun({ text: text.slice(lastIndex), size: 21 }));
  }

  // 空の場合
  if (runs.length === 0) {
    runs.push(new TextRun({ text: " ", size: 21 }));
  }

  return runs;
}

// ============================================================
// テーブルパーサー
// ============================================================

function parseTable(lines: string[]): Table | null {
  if (lines.length < 2) return null;

  const parseRow = (line: string): string[] =>
    line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());

  const headerCells = parseRow(lines[0] ?? "");
  // lines[1] = セパレータ行（--- | ---）
  const bodyRows = lines.slice(2).map(parseRow);
  const colCount = headerCells.length || 1;

  const noBorder = {
    top: { style: BorderStyle.NONE, size: 0 },
    bottom: { style: BorderStyle.NONE, size: 0 },
    left: { style: BorderStyle.NONE, size: 0 },
    right: { style: BorderStyle.NONE, size: 0 },
  } as const;

  const headerBorder = {
    top: { style: BorderStyle.SINGLE, size: 8, color: "333333" },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: "333333" },
    left: { style: BorderStyle.NONE, size: 0 },
    right: { style: BorderStyle.NONE, size: 0 },
  } as const;

  const lastRowBorder = {
    top: { style: BorderStyle.NONE, size: 0 },
    bottom: { style: BorderStyle.SINGLE, size: 8, color: "333333" },
    left: { style: BorderStyle.NONE, size: 0 },
    right: { style: BorderStyle.NONE, size: 0 },
  } as const;

  const headerRow = new TableRow({
    children: headerCells.map(
      (text) =>
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text, bold: true, size: 19 })],
            }),
          ],
          borders: headerBorder,
          width: { size: Math.floor(9000 / colCount), type: WidthType.DXA },
        }),
    ),
    tableHeader: true,
  });

  const dataRows = bodyRows.map((cells, rowIdx) =>
    new TableRow({
      children: cells.map(
        (text) =>
          new TableCell({
            children: [
              new Paragraph({
                children: parseInline(text),
              }),
            ],
            borders: rowIdx === bodyRows.length - 1 ? lastRowBorder : noBorder,
            width: { size: Math.floor(9000 / colCount), type: WidthType.DXA },
            shading:
              rowIdx % 2 === 1
                ? { type: ShadingType.SOLID, color: "FAFAFA" }
                : undefined,
          }),
      ),
    }),
  );

  return new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 9000, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
  });
}

// ============================================================
// メインエクスポート関数
// ============================================================

/**
 * Markdown コンテンツから .docx Blob を生成する。
 * 学術論文向けスタイル: A4、余白 25mm/20mm、明朝体ベース、ページ番号付き。
 */
export async function generateDocx(
  markdownContent: string,
  title: string,
): Promise<Blob> {
  const children = parseMarkdownToElements(markdownContent);

  const doc = new Document({
    creator: "Stellar",
    title,
    description: `Generated by Stellar - ${title}`,
    styles: {
      default: {
        document: {
          run: {
            font: "Yu Mincho",
            size: 21, // 10.5pt
            color: "1A1A1A",
          },
          paragraph: {
            spacing: { line: 360 },
          },
        },
        heading1: {
          run: {
            font: "Yu Gothic",
            size: 36, // 18pt
            bold: true,
            color: "1A1A1A",
          },
          paragraph: {
            spacing: { before: 360, after: 120 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: "333333", space: 4 } },
          },
        },
        heading2: {
          run: {
            font: "Yu Gothic",
            size: 28, // 14pt
            bold: true,
            color: "1A1A1A",
          },
          paragraph: {
            spacing: { before: 300, after: 100 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC", space: 3 } },
          },
        },
        heading3: {
          run: {
            font: "Yu Gothic",
            size: 24, // 12pt
            bold: true,
            color: "333333",
          },
          paragraph: {
            spacing: { before: 240, after: 80 },
          },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: "stellar-numbering",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: convertInchesToTwip(0.3), hanging: convertInchesToTwip(0.3) } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertInchesToTwip(8.27), // A4
              height: convertInchesToTwip(11.69),
            },
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(0.8),
              right: convertInchesToTwip(0.8),
            },
            pageNumbers: {
              start: 1,
              formatType: NumberFormat.DECIMAL,
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 18,
                    color: "888888",
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}
