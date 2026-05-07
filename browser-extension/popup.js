// popup.js
// Stellar Clipper — ポップアップ UI ロジック
// Stellar 接続チェック → メタデータ抽出 → CrossRef 補完 → インポート

const CROSSREF_API = "https://api.crossref.org/works";

// DOM 要素
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const paperCard = document.getElementById("paperCard");
const actions = document.getElementById("actions");
const message = document.getElementById("message");
const disconnectedMsg = document.getElementById("disconnectedMsg");
const saveBtn = document.getElementById("saveBtn");
const enrichBtn = document.getElementById("enrichBtn");
const includePdfCheckbox = document.getElementById("includePdf");

// 現在の論文メタデータ
let currentMetadata = null;

/**
 * Stellar の接続状態を確認し UI を更新する
 */
async function checkStatus() {
  statusDot.className = "status-dot checking";
  statusText.textContent = "接続確認中...";

  try {
    const response = await chrome.runtime.sendMessage({ type: "CHECK_STATUS" });
    if (response && response.ok) {
      statusDot.className = "status-dot connected";
      statusText.textContent = `接続中 (v${response.version || "?"})`;
      return true;
    }
  } catch {
    // ignore
  }

  statusDot.className = "status-dot disconnected";
  statusText.textContent = "未接続";
  return false;
}

/**
 * アクティブタブからメタデータを抽出する
 */
async function fetchMetadata() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;

  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "EXTRACT_METADATA",
    });
    return response;
  } catch {
    // content script が注入されていない場合
    return null;
  }
}

/**
 * CrossRef API で DOI からメタデータを補完する
 */
async function enrichWithCrossRef(doi) {
  if (!doi) return null;

  try {
    const res = await fetch(`${CROSSREF_API}/${encodeURIComponent(doi)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;

    const data = await res.json();
    const work = data.message;
    if (!work) return null;

    return {
      title: work.title?.[0] || null,
      authors: (work.author || []).map(
        (a) => `${a.given || ""} ${a.family || ""}`.trim()
      ),
      year: work.published?.["date-parts"]?.[0]?.[0] || null,
      journal: work["container-title"]?.[0] || null,
      doi: work.DOI || doi,
      abstract: work.abstract || null,
      url: work.URL || null,
    };
  } catch {
    return null;
  }
}

/**
 * メタデータを UI に表示する
 */
function displayMetadata(meta) {
  if (!meta) {
    paperCard.classList.add("hidden");
    actions.classList.add("hidden");
    return;
  }

  // Title
  const titleEl = document.getElementById("paperTitle");
  titleEl.textContent = meta.title || "";
  titleEl.className = meta.title ? "field-value" : "field-value empty";
  if (!meta.title) titleEl.textContent = "(タイトルなし)";

  // Authors
  const authorsEl = document.getElementById("paperAuthors");
  authorsEl.innerHTML = "";
  if (meta.authors && meta.authors.length > 0) {
    meta.authors.forEach((author) => {
      const tag = document.createElement("span");
      tag.className = "author-tag";
      tag.textContent = author;
      authorsEl.appendChild(tag);
    });
  } else {
    authorsEl.innerHTML = '<span class="field-value empty">(著者なし)</span>';
  }

  // Year / Journal
  const yjEl = document.getElementById("paperYearJournal");
  const parts = [];
  if (meta.year) parts.push(String(meta.year));
  if (meta.journal) parts.push(meta.journal);
  yjEl.textContent = parts.join(" / ") || "";
  yjEl.className = parts.length > 0 ? "field-value" : "field-value empty";
  if (parts.length === 0) yjEl.textContent = "(不明)";

  // DOI
  const doiEl = document.getElementById("paperDoi");
  if (meta.doi) {
    doiEl.innerHTML = `<a class="doi-link" href="https://doi.org/${meta.doi}" target="_blank">${meta.doi}</a>`;
  } else {
    doiEl.innerHTML = '<span class="field-value empty">(DOI なし)</span>';
  }

  // Abstract
  const abstractEl = document.getElementById("paperAbstract");
  if (meta.abstract) {
    const truncated =
      meta.abstract.length > 200
        ? meta.abstract.substring(0, 200) + "..."
        : meta.abstract;
    abstractEl.textContent = truncated;
    abstractEl.className = "field-value";
  } else {
    abstractEl.textContent = "(アブストラクトなし)";
    abstractEl.className = "field-value empty";
  }

  // PDF チェックボックスの表示制御
  if (meta.pdfUrl) {
    includePdfCheckbox.parentElement.style.display = "flex";
  } else {
    includePdfCheckbox.parentElement.style.display = "none";
    includePdfCheckbox.checked = false;
  }

  paperCard.classList.remove("hidden");
  actions.classList.remove("hidden");
}

/**
 * メッセージを表示する
 */
function showMessage(text, type = "success") {
  message.textContent = text;
  message.className = `message ${type}`;
  message.classList.remove("hidden");
  setTimeout(() => {
    message.classList.add("hidden");
  }, 4000);
}

/**
 * 保存ボタンのクリックハンドラ
 */
async function handleSave() {
  if (!currentMetadata) return;

  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="spinner"></span> 保存中...';

  const paperData = {
    title: currentMetadata.title || "Untitled",
    authors: currentMetadata.authors || [],
    year: currentMetadata.year || null,
    journal: currentMetadata.journal || null,
    doi: currentMetadata.doi || null,
    url: currentMetadata.url || null,
    abstract: currentMetadata.abstract || null,
    pdfUrl: currentMetadata.pdfUrl || null,
    includePdf: includePdfCheckbox.checked,
  };

  try {
    const response = await chrome.runtime.sendMessage({
      type: "IMPORT_PAPER",
      data: paperData,
    });

    if (response && response.ok) {
      showMessage("Stellar に保存しました", "success");
    } else {
      showMessage(response?.error || "保存に失敗しました", "error");
    }
  } catch (e) {
    showMessage(`エラー: ${e.message}`, "error");
  }

  saveBtn.disabled = false;
  saveBtn.innerHTML = `
    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
      <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
    </svg>
    Stellar に保存
  `;
}

/**
 * CrossRef 補完ボタンのクリックハンドラ
 */
async function handleEnrich() {
  if (!currentMetadata?.doi) {
    showMessage("DOI が見つかりません", "error");
    return;
  }

  enrichBtn.disabled = true;
  enrichBtn.innerHTML = '<span class="spinner"></span> 検索中...';

  const enriched = await enrichWithCrossRef(currentMetadata.doi);

  if (enriched) {
    // 既存メタデータを補完（空フィールドのみ上書き）
    if (!currentMetadata.title && enriched.title)
      currentMetadata.title = enriched.title;
    if (
      (!currentMetadata.authors || currentMetadata.authors.length === 0) &&
      enriched.authors
    )
      currentMetadata.authors = enriched.authors;
    if (!currentMetadata.year && enriched.year)
      currentMetadata.year = enriched.year;
    if (!currentMetadata.journal && enriched.journal)
      currentMetadata.journal = enriched.journal;
    if (!currentMetadata.abstract && enriched.abstract)
      currentMetadata.abstract = enriched.abstract;
    if (!currentMetadata.url && enriched.url)
      currentMetadata.url = enriched.url;

    displayMetadata(currentMetadata);
    showMessage("CrossRef からメタデータを補完しました", "success");
  } else {
    showMessage("CrossRef でメタデータが見つかりませんでした", "error");
  }

  enrichBtn.disabled = false;
  enrichBtn.innerHTML = `
    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
    </svg>
    CrossRef で補完
  `;
}

// ── 初期化 ──
async function init() {
  // 1. Stellar 接続チェック
  const connected = await checkStatus();

  if (!connected) {
    disconnectedMsg.classList.remove("hidden");
    return;
  }

  // 2. メタデータ抽出
  currentMetadata = await fetchMetadata();
  displayMetadata(currentMetadata);

  // 3. ボタン有効化
  saveBtn.disabled = false;
  enrichBtn.disabled = !currentMetadata?.doi;

  // 4. イベントリスナー
  saveBtn.addEventListener("click", handleSave);
  enrichBtn.addEventListener("click", handleEnrich);
}

init();
