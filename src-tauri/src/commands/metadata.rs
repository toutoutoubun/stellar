// src-tauri/src/commands/metadata.rs
// Stellar — メタデータ取得コマンド
// フロントエンドから invoke() で呼び出される外部API連携コマンド群
// DOI (CrossRef) / URL (HTMLスクレイピング) からの論文メタデータ取得を提供
// PDF ダウンロード / 書誌情報フォーマットを含む

use crate::db::models::PaperMetadata;
use crate::utils::metadata;
use tauri::AppHandle;

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

// ────────────────────────────────────────────────────────────
// download_pdf_from_url — URL から PDF をダウンロード
// ────────────────────────────────────────────────────────────

/// PDF URL を指定してダウンロードし、アプリデータディレクトリに保存する
/// フロントエンド: invoke("download_pdf_from_url", { paperId: "xxx", pdfUrl: "https://..." })
#[tauri::command]
pub async fn download_pdf_from_url(
    app: AppHandle,
    paper_id: String,
    pdf_url: String,
) -> Result<String, String> {
    use tauri::Manager;

    // アプリデータ内の pdfs ディレクトリ
    let app_path = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("アプリディレクトリの取得に失敗: {}", e))?;
    let pdfs_dir = app_path.join("pdfs");
    std::fs::create_dir_all(&pdfs_dir)
        .map_err(|e| format!("PDFディレクトリの作成に失敗: {}", e))?;

    // ファイル名: paper_id の先頭8文字 + タイムスタンプ + .pdf
    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
    let short_id = &paper_id[..8.min(paper_id.len())];
    let dest_name = format!("{}_{}.pdf", short_id, timestamp);
    let dest_path = pdfs_dir.join(&dest_name);
    let dest_str = dest_path.to_string_lossy().to_string();

    metadata::download_pdf_from_url(&pdf_url, &dest_str)
        .await
        .map_err(|e| e.to_string())
}

// ────────────────────────────────────────────────────────────
// format_bibliography — 書誌情報をスタイル別にフォーマット
// ────────────────────────────────────────────────────────────

/// 論文情報を指定した引用スタイルでフォーマットする
/// フロントエンド: invoke("format_bibliography", { style, title, authors, year, ... })
#[tauri::command]
pub async fn format_bibliography(
    style: String,
    title: String,
    authors: Vec<String>,
    year: Option<i32>,
    journal: Option<String>,
    volume: Option<String>,
    issue: Option<String>,
    pages: Option<String>,
    doi: Option<String>,
) -> Result<String, String> {
    Ok(metadata::format_bibliography_entry(
        &style,
        &title,
        &authors,
        year,
        journal.as_deref(),
        volume.as_deref(),
        issue.as_deref(),
        pages.as_deref(),
        doi.as_deref(),
    ))
}
