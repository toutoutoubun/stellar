// src-tauri/src/commands/metadata.rs
// Stellar — メタデータ取得コマンド
// フロントエンドから invoke() で呼び出される外部API連携コマンド群
// DOI (CrossRef) / URL (HTMLスクレイピング) からの論文メタデータ取得を提供

use crate::db::models::PaperMetadata;
use crate::utils::metadata;

// ────────────────────────────────────────────────────────────
// fetch_metadata_by_doi — DOI からメタデータ取得（CrossRef API）
// ────────────────────────────────────────────────────────────

/// DOI を指定して CrossRef API から論文メタデータを取得する
/// フロントエンド: invoke("fetch_metadata_by_doi", { doi: "10.xxxx/yyyy" })
#[tauri::command]
pub async fn fetch_metadata_by_doi(doi: String) -> Result<PaperMetadata, String> {
    metadata::fetch_metadata_by_doi(&doi)
        .await
        .map_err(|e| e.to_string())
}

// ────────────────────────────────────────────────────────────
// fetch_metadata_from_url — URL からメタデータ取得（HTMLスクレイピング）
// ────────────────────────────────────────────────────────────

/// URL を指定して HTML メタタグから論文メタデータをスクレイピングする
/// フロントエンド: invoke("fetch_metadata_from_url", { url: "https://..." })
#[tauri::command]
pub async fn fetch_metadata_from_url(url: String) -> Result<PaperMetadata, String> {
    metadata::scrape_metadata_from_url(&url)
        .await
        .map_err(|e| e.to_string())
}
