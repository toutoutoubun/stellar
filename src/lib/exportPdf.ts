// src/lib/exportPdf.ts
// Stellar — PDF / HTML / Markdown / PlainText エクスポート（ブラウザネイティブ）
// Tauri 不要。ブラウザの print / Blob ダウンロードで完結する。

import { marked, Renderer } from "marked";
import { stripMarkdown } from "./exportMarkdown";
import { useI18nStore } from "../stores/useI18nStore";

// ============================================================
// marked 設定 — 学術論文向け拡張
// ============================================================

/** marked のカスタム Renderer を構成 */
function createAcademicRenderer(): Renderer {
  const renderer = new Renderer();

  // テーブルをアカデミックスタイルに
  // marked v18: table(token: Tokens.Table) — token has .header and .rows
  renderer.table = function (token: Parameters<Renderer["table"]>[0]): string {
    const ths = token.header
      .map((cell) => `<th>${cell.text}</th>`)
      .join("");
    const trs = token.rows
      .map((row) => {
        const tds = row
          .map((cell) => `<td>${cell.text}</td>`)
          .join("");
        return `<tr>${tds}</tr>`;
      })
      .join("\n");
    return `<table class="academic-table">
      <thead><tr>${ths}</tr></thead>
      <tbody>${trs}</tbody>
    </table>`;
  };

  return renderer;
}

/**
 * Markdown → HTML 変換（学術論文向け）。
 * - 脚注 [^n] の前処理
 * - @cite{key} → 引用バッジ
 * - ==highlight== → <mark>
 * - [[WikiLink]] → 太字テキスト
 */
export function markdownToHtml(md: string): string {
  // ---- 前処理 ----

  // 脚注定義を収集: [^1]: テキスト
  const footnoteMap = new Map<string, string>();
  const withoutDefs = md.replace(
    /^\[\^(\w+)\]:\s*(.+)$/gm,
    (_match, id: string, text: string) => {
      footnoteMap.set(id, text);
      return ""; // 定義行を除去
    },
  );

  // 脚注参照: [^1] → <sup><a>
  let processed = withoutDefs.replace(
    /\[\^(\w+)\]/g,
    (_match, id: string) =>
      `<sup class="footnote-ref"><a href="#fn-${id}" id="fnref-${id}">${id}</a></sup>`,
  );

  // @cite{key} → 引用バッジ
  processed = processed.replace(
    /@cite\{([^}]+)\}/g,
    (_match, key: string) =>
      `<span class="citation-badge">[${key}]</span>`,
  );

  // ==highlight== → <mark>
  processed = processed.replace(
    /==([^=]+)==/g,
    (_match, text: string) => `<mark>${text}</mark>`,
  );

  // [[WikiLink]] → 太字テキスト（エクスポート時はリンク解決不要）
  processed = processed.replace(
    /\[\[([^\]]+)\]\]/g,
    (_match, text: string) => `<strong>${text}</strong>`,
  );

  // ---- marked 変換 ----
  const renderer = createAcademicRenderer();

  let html = marked.parse(processed, { renderer, gfm: true, breaks: false }) as string;

  // ---- 脚注セクション（末尾に追加） ----
  if (footnoteMap.size > 0) {
    const items = Array.from(footnoteMap.entries())
      .map(
        ([id, text]) =>
          `<li id="fn-${id}"><p>${text} <a href="#fnref-${id}" class="footnote-backref">↩</a></p></li>`,
      )
      .join("\n");
    html += `\n<hr class="footnotes-sep" />\n<section class="footnotes">\n<ol>\n${items}\n</ol>\n</section>`;
  }

  return html;
}

// ============================================================
// アカデミック HTML テンプレート
// ============================================================

/**
 * 学術論文スタイルの完全な HTML ドキュメントを生成する。
 */
export function buildAcademicHtml(bodyHtml: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>
  /* ── 基本設定 ── */
  @page {
    size: A4;
    margin: 25mm 20mm 25mm 20mm;
    @bottom-center { content: counter(page); font-size: 10pt; }
  }
  body {
    font-family: "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", "Times New Roman", serif;
    font-size: 10.5pt;
    line-height: 1.8;
    color: #1a1a1a;
    max-width: 680px;
    margin: 0 auto;
    padding: 40px 24px;
    word-break: break-word;
    overflow-wrap: anywhere;
  }
  /* ── 見出し ── */
  h1 { font-size: 18pt; font-weight: 700; margin: 2em 0 0.8em; border-bottom: 2px solid #333; padding-bottom: 0.3em; }
  h2 { font-size: 14pt; font-weight: 700; margin: 1.8em 0 0.6em; border-bottom: 1px solid #ccc; padding-bottom: 0.2em; }
  h3 { font-size: 12pt; font-weight: 600; margin: 1.5em 0 0.5em; }
  h4 { font-size: 10.5pt; font-weight: 600; margin: 1.2em 0 0.4em; }
  /* ── 段落・リスト ── */
  p { margin: 0.6em 0; text-indent: 1em; text-align: justify; }
  ul, ol { margin: 0.8em 0; padding-left: 2em; list-style: revert; }
  li { margin: 0.3em 0; }
  li > p { text-indent: 0; }
  /* ── 引用ブロック ── */
  blockquote {
    margin: 1em 0;
    padding: 0.8em 1.2em;
    border-left: 4px solid #666;
    background: #f9f9f9;
    font-style: italic;
    color: #444;
  }
  blockquote p { text-indent: 0; }
  /* ── テーブル（学術スタイル） ── */
  .academic-table, table {
    width: 100%;
    border-collapse: collapse;
    margin: 1.2em 0;
    font-size: 9.5pt;
  }
  .academic-table thead, table thead { border-top: 2px solid #333; border-bottom: 1px solid #333; }
  .academic-table tbody, table tbody { border-bottom: 2px solid #333; }
  .academic-table th, table th { padding: 6px 10px; text-align: left; font-weight: 600; }
  .academic-table td, table td { padding: 6px 10px; text-align: left; }
  .academic-table tr:nth-child(even), table tr:nth-child(even) { background: #fafafa; }
  /* ── コード ── */
  code {
    font-family: "JetBrains Mono", "Fira Code", monospace;
    font-size: 0.9em;
    background: #f4f4f4;
    padding: 2px 5px;
    border-radius: 3px;
  }
  pre {
    background: #f4f4f4;
    padding: 12px 16px;
    border-radius: 6px;
    overflow-x: auto;
    font-size: 9pt;
    line-height: 1.5;
    margin: 1em 0;
  }
  pre code { background: none; padding: 0; }
  /* ── 脚注 ── */
  .footnotes-sep { margin: 2em 0 1em; border: none; border-top: 1px solid #ccc; }
  .footnotes { font-size: 9pt; color: #555; }
  .footnotes ol { padding-left: 1.5em; }
  .footnotes li { margin: 0.4em 0; }
  .footnote-ref a { text-decoration: none; color: #0066cc; }
  .footnote-backref { text-decoration: none; color: #0066cc; margin-left: 4px; }
  /* ── ハイライト・引用バッジ ── */
  mark { background: #fff59d; padding: 1px 3px; border-radius: 2px; }
  .citation-badge {
    display: inline;
    color: #0066cc;
    font-weight: 500;
  }
  /* ── 水平線 ── */
  hr { border: none; border-top: 1px solid #ddd; margin: 2em 0; }
  /* ── 画像 ── */
  img { max-width: 100%; height: auto; margin: 1em 0; }
  /* ── 印刷最適化 ── */
  @media print {
    body { padding: 0; max-width: none; }
    h1, h2, h3 { page-break-after: avoid; }
    table, figure, blockquote { page-break-inside: avoid; }
    a { color: inherit; text-decoration: none; }
    .citation-badge { color: inherit; }
  }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ============================================================
// ダウンロードヘルパー
// ============================================================

/** Blob をダウンロードする（ブラウザ） */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// ============================================================
// 各種エクスポート関数
// ============================================================

/** Markdown ファイルをダウンロード */
export function exportMarkdownFile(content: string, title: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  downloadBlob(blob, `${title}.md`);
}

/** プレーンテキストファイルをダウンロード */
export function exportPlainText(content: string, title: string): void {
  const plain = stripMarkdown(content);
  const blob = new Blob([plain], { type: "text/plain;charset=utf-8" });
  downloadBlob(blob, `${title}.txt`);
}

/** HTML Blob を生成（ダウンロード用） */
export function exportHtmlBlob(content: string, title: string): Blob {
  const bodyHtml = markdownToHtml(content);
  const fullHtml = buildAcademicHtml(bodyHtml, title);
  return new Blob([fullHtml], { type: "text/html;charset=utf-8" });
}

/**
 * PDF エクスポート — ブラウザの印刷ダイアログ経由。
 * 新しいウィンドウに学術スタイルの HTML を表示して window.print() を呼ぶ。
 * 呼び出し側でクリック直後に開いたウィンドウを渡すと、ポップアップブロックを避けられる。
 */
export function exportPdf(content: string, title: string, targetWindow?: Window | null): void {
  const bodyHtml = markdownToHtml(content);
  const fullHtml = buildAcademicHtml(bodyHtml, title);

  const printWindow = targetWindow ?? window.open("", "_blank");
  if (!printWindow) {
    throw new Error(useI18nStore.getState().t.utils.str_oxfjvb);
  }
  printWindow.document.write(fullHtml);
  printWindow.document.close();
  // 少し待ってからprint（フォント読み込み等のため）
  setTimeout(() => {
    printWindow.print();
  }, 500);
}
