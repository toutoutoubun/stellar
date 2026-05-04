// src/utils/citation.ts
// Stellar — 引用フォーマット生成ユーティリティ
// APA 7th / MLA 9th / Chicago 17th（注番号） / 一橋大学式 に対応
// 日本語論文・英語論文の両方をサポートする

import type { Paper, CitationStyle } from "../types";

// ============================================================
// 著者名フォーマット補助関数
// ============================================================

/**
 * 著者配列を APA 7th 形式でフォーマットする
 * - 1人: 著者名
 * - 2人: 著者1 & 著者2
 * - 3〜20人: 著者1, 著者2, ... & 最後の著者
 * - 21人以上: 先頭19人 + ... + 最後の著者
 */
const formatAuthorsAPA = (authors: string[]): string => {
  if (authors.length === 0) return "";
  if (authors.length === 1) return authors[0] ?? "";
  if (authors.length === 2) return `${authors[0]} & ${authors[1]}`;
  if (authors.length <= 20) {
    const allButLast = authors.slice(0, -1).join(", ");
    const last = authors[authors.length - 1];
    return `${allButLast}, & ${last}`;
  }
  // 21人以上: 先頭19人 + "..." + 最後の著者
  const first19 = authors.slice(0, 19).join(", ");
  const last = authors[authors.length - 1];
  return `${first19}, ... ${last}`;
};

/**
 * 著者配列を MLA 9th 形式でフォーマットする
 * - 1人: 著者名
 * - 2人: 著者1, and 著者2
 * - 3人以上: 著者1 et al.
 */
const formatAuthorsMLA = (authors: string[]): string => {
  if (authors.length === 0) return "";
  if (authors.length === 1) return authors[0] ?? "";
  if (authors.length === 2) return `${authors[0]}, and ${authors[1]}`;
  return `${authors[0]} et al.`;
};

/**
 * 著者配列を Chicago 17th 注番号形式でフォーマットする
 * - 1人: 著者名
 * - 2〜3人: 著者1, 著者2, and 著者3
 * - 4人以上: 著者1 et al.
 */
const formatAuthorsChicago = (authors: string[]): string => {
  if (authors.length === 0) return "";
  if (authors.length === 1) return authors[0] ?? "";
  if (authors.length <= 3) {
    const allButLast = authors.slice(0, -1).join(", ");
    const last = authors[authors.length - 1];
    return `${allButLast}, and ${last}`;
  }
  return `${authors[0]} et al.`;
};

/**
 * 著者配列を一橋大学式でフォーマットする
 * - 全著者をそのまま結合
 * - 3人以上は「著者1・著者2ほか」
 */
const formatAuthorsHitotsubashi = (authors: string[]): string => {
  if (authors.length === 0) return "";
  if (authors.length === 1) return authors[0] ?? "";
  if (authors.length === 2) return `${authors[0]}・${authors[1]}`;
  return `${authors[0]}・${authors[1]}ほか`;
};

// ============================================================
// 引用フォーマット本体
// ============================================================

/**
 * APA 7th Edition フォーマット
 * 著者姓, 著者名. (年). タイトル. 雑誌名, 巻(号), ページ.
 */
const formatAPA7 = (paper: Paper): string => {
  const parts: string[] = [];

  // 著者
  const authorsStr = formatAuthorsAPA(paper.authors);
  if (authorsStr) {
    parts.push(authorsStr);
  }

  // 年
  if (paper.year !== null) {
    parts.push(`(${paper.year}).`);
  } else {
    parts.push("(n.d.).");
  }

  // タイトル
  parts.push(`${paper.title}.`);

  // ジャーナル名（イタリック体は表記上 * で囲むのみ）
  if (paper.journal) {
    let journalPart = `*${paper.journal}*`;
    // 巻号
    if (paper.volume) {
      journalPart += `, *${paper.volume}*`;
      if (paper.issue) {
        journalPart += `(${paper.issue})`;
      }
    }
    // ページ
    if (paper.pages) {
      journalPart += `, ${paper.pages}`;
    }
    journalPart += ".";
    parts.push(journalPart);
  }

  // DOI
  if (paper.doi) {
    parts.push(`https://doi.org/${paper.doi}`);
  }

  return parts.join(" ");
};

/**
 * MLA 9th Edition フォーマット
 * 著者. 「タイトル」. 『雑誌名』 巻.号 (年): ページ.
 */
const formatMLA9 = (paper: Paper): string => {
  const parts: string[] = [];

  // 著者
  const authorsStr = formatAuthorsMLA(paper.authors);
  if (authorsStr) {
    parts.push(`${authorsStr}.`);
  }

  // タイトル（日本語なら「」、英語なら ""）
  const isJapanese = /[\u3000-\u9FFF]/.test(paper.title);
  if (isJapanese) {
    parts.push(`「${paper.title}」.`);
  } else {
    parts.push(`"${paper.title}."`);
  }

  // ジャーナル名（日本語なら『』、英語ならイタリック）
  if (paper.journal) {
    const isJaJournal = /[\u3000-\u9FFF]/.test(paper.journal);
    let journalPart = isJaJournal
      ? `『${paper.journal}』`
      : `*${paper.journal}*`;

    // 巻.号
    if (paper.volume) {
      journalPart += ` ${paper.volume}`;
      if (paper.issue) {
        journalPart += `.${paper.issue}`;
      }
    }

    // 年
    if (paper.year !== null) {
      journalPart += ` (${paper.year})`;
    }

    // ページ
    if (paper.pages) {
      journalPart += `: ${paper.pages}`;
    }

    journalPart += ".";
    parts.push(journalPart);
  }

  return parts.join(" ");
};

/**
 * Chicago 17th Edition（注番号形式）フォーマット
 * 著者, "タイトル," 雑誌名 巻, no. 号 (年): ページ.
 */
const formatChicago17 = (paper: Paper): string => {
  const parts: string[] = [];

  // 著者
  const authorsStr = formatAuthorsChicago(paper.authors);
  if (authorsStr) {
    parts.push(`${authorsStr},`);
  }

  // タイトル
  const isJapanese = /[\u3000-\u9FFF]/.test(paper.title);
  if (isJapanese) {
    parts.push(`「${paper.title}」`);
  } else {
    parts.push(`"${paper.title},"`);
  }

  // ジャーナル名
  if (paper.journal) {
    const isJaJournal = /[\u3000-\u9FFF]/.test(paper.journal);
    let journalPart = isJaJournal
      ? `『${paper.journal}』`
      : `*${paper.journal}*`;

    // 巻
    if (paper.volume) {
      journalPart += ` ${paper.volume}`;
      // 号
      if (paper.issue) {
        journalPart += `, no. ${paper.issue}`;
      }
    }

    // 年
    if (paper.year !== null) {
      journalPart += ` (${paper.year})`;
    }

    // ページ
    if (paper.pages) {
      journalPart += `: ${paper.pages}`;
    }

    journalPart += ".";
    parts.push(journalPart);
  }

  return parts.join(" ");
};

/**
 * 一橋大学式フォーマット
 * 著者「タイトル」『雑誌名』第巻号、年、ページ頁.
 */
const formatHitotsubashi = (paper: Paper): string => {
  const parts: string[] = [];

  // 著者
  const authorsStr = formatAuthorsHitotsubashi(paper.authors);
  if (authorsStr) {
    parts.push(authorsStr);
  }

  // タイトル
  parts.push(`「${paper.title}」`);

  // ジャーナル名
  if (paper.journal) {
    let journalPart = `『${paper.journal}』`;

    // 巻号
    if (paper.volume) {
      journalPart += `第${paper.volume}`;
      if (paper.issue) {
        journalPart += `号`;
      } else {
        journalPart += `巻`;
      }
    }

    parts.push(journalPart);
  }

  // 年
  if (paper.year !== null) {
    parts.push(`${paper.year}年`);
  }

  // ページ
  if (paper.pages) {
    parts.push(`${paper.pages}頁`);
  }

  // 最後の要素を「。」で結び読点で区切る
  const result = parts.join("、");
  return result.endsWith("。") ? result : `${result}。`;
};

// ============================================================
// エクスポート
// ============================================================

/** スタイルに応じた引用テキストを生成する */
export const formatCitation = (
  paper: Paper,
  style: CitationStyle
): string => {
  switch (style) {
    case "apa7":
      return formatAPA7(paper);
    case "mla9":
      return formatMLA9(paper);
    case "chicago17":
      return formatChicago17(paper);
    case "hitotsubashi":
      return formatHitotsubashi(paper);
  }
};

/**
 * 引用テキストをクリップボードにコピーする
 * @returns コピーが成功したかどうか
 */
export const copyCitationToClipboard = async (
  paper: Paper,
  style: CitationStyle
): Promise<boolean> => {
  const text = formatCitation(paper, style);
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // フォールバック: execCommand を使用
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      return true;
    } catch {
      return false;
    }
  }
};
