// content.js
// Stellar Clipper — コンテンツスクリプト
// 現在のページから論文メタデータを抽出する

/**
 * ページの meta タグからコンテンツを取得するヘルパー
 * @param {string} name - meta タグの name/property 属性
 * @returns {string|null}
 */
function getMeta(name) {
  const el =
    document.querySelector(`meta[name="${name}"]`) ||
    document.querySelector(`meta[property="${name}"]`) ||
    document.querySelector(`meta[name="${name}" i]`) ||
    document.querySelector(`meta[property="${name}" i]`);
  return el ? el.getAttribute("content") : null;
}

/**
 * 複数の meta タグ候補から最初に見つかった値を返す
 * @param {string[]} names - 試行する meta タグ名の配列
 * @returns {string|null}
 */
function getMetaFirst(names) {
  for (const name of names) {
    const val = getMeta(name);
    if (val) return val;
  }
  return null;
}

/**
 * ページからDOIを抽出する
 * @returns {string|null}
 */
function extractDoi() {
  // meta タグから
  const metaDoi = getMetaFirst([
    "citation_doi",
    "DC.identifier",
    "dc.identifier",
    "prism.doi",
    "doi",
  ]);
  if (metaDoi) return metaDoi.replace(/^https?:\/\/doi\.org\//, "");

  // URL から
  const urlMatch = window.location.href.match(
    /doi\.org\/(10\.\d{4,}\/[^\s&?#]+)/
  );
  if (urlMatch) return urlMatch[1];

  // ページ内テキストから
  const bodyText = document.body?.innerText || "";
  const textMatch = bodyText.match(/\b(10\.\d{4,}\/[^\s&?#]+)/);
  if (textMatch) return textMatch[1];

  return null;
}

/**
 * 著者リストを抽出する
 * @returns {string[]}
 */
function extractAuthors() {
  // citation_author meta タグ（複数ある場合が多い）
  const authorMetas = document.querySelectorAll(
    'meta[name="citation_author"], meta[name="DC.creator"], meta[name="dc.creator"], meta[name="author"]'
  );
  if (authorMetas.length > 0) {
    return Array.from(authorMetas).map((el) => el.getAttribute("content") || "");
  }

  // citation_authors（カンマ区切り）
  const authorsStr = getMeta("citation_authors");
  if (authorsStr) {
    return authorsStr.split(/[;,]/).map((a) => a.trim()).filter(Boolean);
  }

  return [];
}

/**
 * PDF URL を抽出する
 * @returns {string|null}
 */
function extractPdfUrl() {
  // meta タグから
  const pdfMeta = getMetaFirst(["citation_pdf_url", "citation_fulltext_url"]);
  if (pdfMeta) return pdfMeta;

  // rel="alternate" の PDF リンク
  const pdfLink = document.querySelector(
    'link[rel="alternate"][type="application/pdf"]'
  );
  if (pdfLink) return pdfLink.getAttribute("href");

  // ページ内の PDF リンク
  const pdfAnchors = document.querySelectorAll('a[href$=".pdf"]');
  if (pdfAnchors.length > 0) {
    const href = pdfAnchors[0].getAttribute("href");
    if (href) {
      try {
        return new URL(href, window.location.origin).href;
      } catch {
        return href;
      }
    }
  }

  return null;
}

/**
 * ページから論文メタデータを抽出する
 * @returns {Object} 論文メタデータ
 */
function extractMetadata() {
  return {
    title: getMetaFirst([
      "citation_title",
      "DC.title",
      "dc.title",
      "og:title",
      "twitter:title",
    ]) || document.title || "",
    authors: extractAuthors(),
    doi: extractDoi(),
    year: (() => {
      const dateStr = getMetaFirst([
        "citation_publication_date",
        "citation_date",
        "DC.date",
        "dc.date",
        "article:published_time",
      ]);
      if (dateStr) {
        const match = dateStr.match(/(\d{4})/);
        if (match) return parseInt(match[1], 10);
      }
      return null;
    })(),
    journal: getMetaFirst([
      "citation_journal_title",
      "citation_journal_abbrev",
      "DC.source",
      "dc.source",
    ]),
    abstract: getMetaFirst([
      "citation_abstract",
      "DC.description",
      "dc.description",
      "og:description",
      "description",
    ]),
    url: window.location.href,
    pdfUrl: extractPdfUrl(),
  };
}

// メッセージリスナー — popup.js からのメタデータ要求を処理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "EXTRACT_METADATA") {
    const metadata = extractMetadata();
    sendResponse(metadata);
    return true;
  }
  return false;
});
