// background.js
// Stellar Clipper — バックグラウンドサービスワーカー
// Stellar デスクトップアプリとの通信を管理する

const STELLAR_API = "http://localhost:57321";

/**
 * Stellar アプリの接続状態を確認する
 * @returns {Promise<{ok: boolean, version?: string}>}
 */
async function checkStellarStatus() {
  try {
    const res = await fetch(`${STELLAR_API}/api/status`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return { ok: false };
    const data = await res.json();
    return data;
  } catch {
    return { ok: false };
  }
}

/**
 * 論文データを Stellar に送信する
 * @param {Object} paperData - 論文メタデータ
 * @returns {Promise<{ok: boolean, paperId?: string, error?: string}>}
 */
async function sendPaperToStellar(paperData) {
  try {
    const res = await fetch(`${STELLAR_API}/api/papers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(paperData),
    });
    const data = await res.json();
    return data;
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// メッセージリスナー — popup.js / content.js からのメッセージを処理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "CHECK_STATUS") {
    checkStellarStatus().then(sendResponse);
    return true; // 非同期レスポンス
  }

  if (message.type === "IMPORT_PAPER") {
    sendPaperToStellar(message.data).then(sendResponse);
    return true;
  }

  return false;
});
