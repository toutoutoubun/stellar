// src/lib/exportMarkdown.ts
// Stellar — Markdown ユーティリティ（単語数・読了時間・前処理）

/**
 * 日本語＋英語の混在テキストから単語数を推定する。
 * - 日本語: 文字数 ≒ 語数（助詞等含む）
 * - 英語: 空白区切りでカウント
 * Markdown 記法は除去してからカウントする。
 */
export function countWords(md: string): number {
  const plain = stripMarkdown(md);
  if (!plain) return 0;

  // 日本語文字（ひらがな・カタカナ・漢字・全角記号）
  const jaChars = plain.match(/[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF]/g);
  const jaCount = jaChars ? jaChars.length : 0;

  // 日本語文字を除去した残りを英語トークンとしてカウント
  const enText = plain
    .replace(/[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF]/g, " ")
    .trim();
  const enWords = enText ? enText.split(/\s+/).filter(Boolean) : [];

  return jaCount + enWords.length;
}

/**
 * 読了時間を推定（分単位）。
 * 日本語: 約 500 文字/分、英語: 約 200 words/分
 */
export function estimateReadingTime(md: string): number {
  const words = countWords(md);
  // 日本語主体なら 500 文字/分、英語主体なら 200 words/分
  // 混在テキストは中間値 ~350 でざっくり推定
  const minutes = Math.max(1, Math.ceil(words / 400));
  return minutes;
}

/**
 * Markdown 記法を除去してプレーンテキストにする。
 */
export function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, "")           // 見出し
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")   // 画像
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // リンク
    .replace(/(\*\*|__)(.*?)\1/g, "$2")     // 太字
    .replace(/(\*|_)(.*?)\1/g, "$2")        // 斜体
    .replace(/~~(.*?)~~/g, "$1")            // 取り消し線
    .replace(/==(.*?)==/g, "$1")            // ハイライト
    .replace(/`{3}[\s\S]*?`{3}/g, "")       // コードブロック
    .replace(/`([^`]+)`/g, "$1")            // インラインコード
    .replace(/@cite\{([^}]+)\}/g, "[$1]")   // @cite → [ref]
    .replace(/\[\^(\d+)\]/g, "")            // 脚注参照
    .replace(/^\[\^(\d+)\]:\s*/gm, "")      // 脚注定義
    .replace(/^>\s?/gm, "")                 // 引用
    .replace(/^[-*+]\s/gm, "")              // 箇条書き
    .replace(/^\d+\.\s/gm, "")             // 番号付きリスト
    .replace(/^---+$/gm, "")               // 水平線
    .replace(/\|/g, " ")                   // テーブル区切り
    .replace(/\n{3,}/g, "\n\n")            // 連続改行を圧縮
    .trim();
}

/**
 * 見出し数をカウントする。
 */
export function countHeadings(md: string): number {
  const matches = md.match(/^#{1,6}\s+.+$/gm);
  return matches ? matches.length : 0;
}
