// src-tauri/src/db/models.rs
// Stellar — データベースモデル・DTO・レスポンス型の完全定義
// sqlx::SqliteRow ベースの行パーサーを提供する
// フロントエンドとの JSON シリアライズ/デシリアライズに対応する全構造体を含む

use serde::{Deserialize, Serialize};
use sqlx::Row;

// ============================================================
// DTO（Data Transfer Object）— フロントエンドからの入力データ
// ============================================================

/// 論文作成 DTO
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePaperDto {
    pub title: String,
    #[serde(default)]
    pub authors: Vec<String>,
    pub year: Option<i32>,
    pub journal: Option<String>,
    pub volume: Option<String>,
    pub issue: Option<String>,
    pub pages: Option<String>,
    pub doi: Option<String>,
    pub url: Option<String>,
    pub r#abstract: Option<String>,
    pub pdf_path: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
}

/// 論文更新 DTO（全フィールド Optional — パッチ更新）
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePaperDto {
    pub title: Option<String>,
    pub authors: Option<Vec<String>>,
    pub year: Option<i32>,
    pub journal: Option<String>,
    pub volume: Option<String>,
    pub issue: Option<String>,
    pub pages: Option<String>,
    pub doi: Option<String>,
    pub url: Option<String>,
    pub r#abstract: Option<String>,
    pub pdf_path: Option<String>,
    pub tags: Option<Vec<String>>,
}

/// ノート作成 DTO
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNoteDto {
    pub title: String,
    #[serde(default)]
    pub content: String,
    pub paper_id: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
}

/// ノート更新 DTO（全フィールド Optional — パッチ更新）
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateNoteDto {
    pub title: Option<String>,
    pub content: Option<String>,
    /// Some(Some(id)) = 紐づけ変更, Some(None) = 紐づけ解除, None = 変更なし
    pub paper_id: Option<Option<String>>,
    pub tags: Option<Vec<String>>,
}

/// ハイライト作成 DTO
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateHighlightDto {
    pub paper_id: String,
    pub text: String,
    pub comment: Option<String>,
    #[serde(default = "default_highlight_color")]
    pub color: String,
    pub page: i32,
    pub rect: HighlightRect,
}

fn default_highlight_color() -> String {
    "yellow".to_string()
}

/// リンク作成 DTO
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateLinkDto {
    pub source_type: String,
    pub source_id: String,
    pub target_type: String,
    pub target_id: String,
    pub context: Option<String>,
}

// ============================================================
// レスポンス型 — フロントエンドに返す JSON 構造体
// ============================================================

/// ハイライトの矩形座標（PDF ページ上の位置）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HighlightRect {
    pub x1: f64,
    pub y1: f64,
    pub x2: f64,
    pub y2: f64,
}

/// 論文レスポンス — フロントエンドに返す展開済み論文データ
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaperResponse {
    pub id: String,
    pub title: String,
    pub authors: Vec<String>,
    pub year: Option<i32>,
    pub journal: Option<String>,
    pub volume: Option<String>,
    pub issue: Option<String>,
    pub pages: Option<String>,
    pub doi: Option<String>,
    pub url: Option<String>,
    pub r#abstract: Option<String>,
    pub pdf_path: Option<String>,
    pub tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// 論文詳細レスポンス — バックリンク・関連カウント情報を含む
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaperWithLinks {
    #[serde(flatten)]
    pub paper: PaperResponse,
    pub backlinks: Vec<LinkWithSource>,
    pub highlight_count: u32,
    pub note_count: u32,
}

/// ノートレスポンス — フロントエンドに返す展開済みノートデータ
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteResponse {
    pub id: String,
    pub title: String,
    pub content: String,
    pub paper_id: Option<String>,
    pub tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// ノート詳細レスポンス — バックリンク・アウトライン・紐づき論文タイトルを含む
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteDetail {
    #[serde(flatten)]
    pub note: NoteResponse,
    pub backlinks: Vec<LinkWithSource>,
    pub outlines: Vec<OutlineHeading>,
    pub paper_title: Option<String>,
}

/// Markdown アウトライン（見出し情報）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutlineHeading {
    /// 見出しレベル 1〜6（# の数）
    pub level: u8,
    /// 見出しテキスト
    pub text: String,
    /// 行番号（0始まり）
    pub line: u32,
}

/// ハイライトレスポンス — 矩形座標を展開済み
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HighlightResponse {
    pub id: String,
    pub paper_id: String,
    pub text: String,
    pub comment: Option<String>,
    pub color: String,
    pub page: i32,
    pub rect: HighlightRect,
    pub created_at: String,
}

/// リンクレスポンス
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkResponse {
    pub id: String,
    pub source_type: String,
    pub source_id: String,
    pub target_type: String,
    pub target_id: String,
    pub context: Option<String>,
    pub created_at: String,
}

/// バックリンク情報 — リンク元・先のタイトルを含む
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkWithSource {
    pub id: String,
    pub source_type: String,
    pub source_id: String,
    pub source_title: String,
    pub target_type: String,
    pub target_id: String,
    pub target_title: String,
    pub context: Option<String>,
    pub created_at: String,
}

// ============================================================
// ページネーション
// ============================================================

/// ページネーション付きレスポンス
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaginatedResult<T: Serialize> {
    pub items: Vec<T>,
    pub total: u32,
    pub page: u32,
    pub limit: u32,
    pub total_pages: u32,
}

// ============================================================
// タグ集計
// ============================================================

/// タグと出現回数
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TagCount {
    pub name: String,
    pub count: u32,
}

// ============================================================
// 検索結果型
// ============================================================

/// 全文検索結果 — カテゴリ別に分割された検索ヒット
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResults {
    pub papers: Vec<SearchHit>,
    pub notes: Vec<SearchHit>,
    pub highlights: Vec<SearchHit>,
}

/// 検索ヒット1件分
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub id: String,
    pub item_type: String,
    pub title: String,
    /// ヒット箇所の前後50文字を抽出し [[match]] でラップ
    pub snippet: String,
    pub score: f64,
}

/// リンク候補（[[リンク記法]] 用オートコンプリート）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkSuggestion {
    pub id: String,
    pub item_type: String,
    pub title: String,
    /// 補足情報（著者名、タグなど）
    pub subtitle: String,
}

// ============================================================
// グラフビュー型
// ============================================================

/// グラフビュー全体のデータ
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphData {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

/// グラフノード — 論文またはノート1つ分
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphNode {
    pub id: String,
    pub label: String,
    pub node_type: String,
    pub tags: Vec<String>,
    pub link_count: u32,
}

/// グラフエッジ — ノード間のリンク1本分
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphEdge {
    pub id: String,
    pub source: String,
    pub target: String,
}

// ============================================================
// メタデータ取得用（外部API連携）
// ============================================================

/// 外部 API から取得した論文メタデータ
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaperMetadata {
    pub title: String,
    pub authors: Vec<String>,
    pub year: Option<i32>,
    pub journal: Option<String>,
    pub volume: Option<String>,
    pub issue: Option<String>,
    pub pages: Option<String>,
    pub doi: Option<String>,
    pub url: Option<String>,
    pub r#abstract: Option<String>,
}

/// メタデータ取得エラー
#[derive(Debug)]
pub enum MetadataError {
    /// ネットワークエラー（API への接続失敗）
    NetworkError(String),
    /// API エラー（4xx / 5xx レスポンス）
    ApiError(String),
    /// パースエラー（レスポンスの解析失敗）
    ParseError(String),
    /// 該当データなし
    NotFound(String),
}

impl std::fmt::Display for MetadataError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MetadataError::NetworkError(msg) => write!(f, "ネットワークエラー: {}", msg),
            MetadataError::ApiError(msg) => write!(f, "APIエラー: {}", msg),
            MetadataError::ParseError(msg) => write!(f, "パースエラー: {}", msg),
            MetadataError::NotFound(msg) => write!(f, "該当データなし: {}", msg),
        }
    }
}

impl std::error::Error for MetadataError {}

impl From<MetadataError> for String {
    fn from(e: MetadataError) -> Self {
        e.to_string()
    }
}

// ============================================================
// DB 行パースヘルパー（sqlx::SqliteRow → 各レスポンス型）
// sqlx::Row トレイトで型安全にカラムを取得する
// ============================================================

/// sqlx::SqliteRow から String を取得（NULL なら空文字列）
fn col_str(row: &sqlx::sqlite::SqliteRow, key: &str) -> String {
    row.try_get::<String, _>(key).unwrap_or_default()
}

/// sqlx::SqliteRow から Option<String> を取得
fn col_opt_str(row: &sqlx::sqlite::SqliteRow, key: &str) -> Option<String> {
    row.try_get::<Option<String>, _>(key)
        .unwrap_or(None)
        .filter(|s| !s.is_empty())
}

/// sqlx::SqliteRow から Option<i32> を取得
fn col_opt_i32(row: &sqlx::sqlite::SqliteRow, key: &str) -> Option<i32> {
    row.try_get::<Option<i32>, _>(key).unwrap_or(None)
}

/// sqlx::SqliteRow から i64 を取得（NULL なら 0）
fn col_i64(row: &sqlx::sqlite::SqliteRow, key: &str) -> i64 {
    row.try_get::<i64, _>(key).unwrap_or(0)
}

/// sqlx::SqliteRow から i32 を取得（NULL なら 0）
fn col_i32(row: &sqlx::sqlite::SqliteRow, key: &str) -> i32 {
    row.try_get::<i32, _>(key).unwrap_or(0)
}

/// sqlx::SqliteRow から f64 を取得（NULL なら 0.0）
pub fn col_f64(row: &sqlx::sqlite::SqliteRow, key: &str) -> f64 {
    row.try_get::<f64, _>(key).unwrap_or(0.0)
}

/// JSON配列文字列を Vec<String> にデシリアライズ
pub fn col_string_vec(row: &sqlx::sqlite::SqliteRow, key: &str) -> Vec<String> {
    let s = col_str(row, key);
    serde_json::from_str(&s).unwrap_or_default()
}

/// sqlx::SqliteRow → PaperResponse
pub fn parse_paper_sqlx(row: &sqlx::sqlite::SqliteRow) -> Result<PaperResponse, String> {
    Ok(PaperResponse {
        id: col_str(row, "id"),
        title: col_str(row, "title"),
        authors: col_string_vec(row, "authors"),
        year: col_opt_i32(row, "year"),
        journal: col_opt_str(row, "journal"),
        volume: col_opt_str(row, "volume"),
        issue: col_opt_str(row, "issue"),
        pages: col_opt_str(row, "pages"),
        doi: col_opt_str(row, "doi"),
        url: col_opt_str(row, "url"),
        r#abstract: col_opt_str(row, "abstract"),
        pdf_path: col_opt_str(row, "pdf_path"),
        tags: col_string_vec(row, "tags"),
        created_at: col_str(row, "created_at"),
        updated_at: col_str(row, "updated_at"),
    })
}

/// sqlx::SqliteRow → NoteResponse
pub fn parse_note_sqlx(row: &sqlx::sqlite::SqliteRow) -> Result<NoteResponse, String> {
    Ok(NoteResponse {
        id: col_str(row, "id"),
        title: col_str(row, "title"),
        content: col_str(row, "content"),
        paper_id: col_opt_str(row, "paper_id"),
        tags: col_string_vec(row, "tags"),
        created_at: col_str(row, "created_at"),
        updated_at: col_str(row, "updated_at"),
    })
}

/// sqlx::SqliteRow → HighlightResponse
pub fn parse_highlight_sqlx(row: &sqlx::sqlite::SqliteRow) -> Result<HighlightResponse, String> {
    let rect: HighlightRect =
        serde_json::from_str(&col_str(row, "rect")).unwrap_or(HighlightRect {
            x1: 0.0,
            y1: 0.0,
            x2: 0.0,
            y2: 0.0,
        });

    Ok(HighlightResponse {
        id: col_str(row, "id"),
        paper_id: col_str(row, "paper_id"),
        text: col_str(row, "text"),
        comment: col_opt_str(row, "comment"),
        color: col_str(row, "color"),
        page: col_i32(row, "page"),
        rect,
        created_at: col_str(row, "created_at"),
    })
}

/// sqlx::SqliteRow → LinkResponse
pub fn parse_link_sqlx(row: &sqlx::sqlite::SqliteRow) -> Result<LinkResponse, String> {
    Ok(LinkResponse {
        id: col_str(row, "id"),
        source_type: col_str(row, "source_type"),
        source_id: col_str(row, "source_id"),
        target_type: col_str(row, "target_type"),
        target_id: col_str(row, "target_id"),
        context: col_opt_str(row, "context"),
        created_at: col_str(row, "created_at"),
    })
}

/// sqlx::SqliteRow → LinkWithSource（JOIN 結果用 — source_title / target_title カラムを含む）
pub fn parse_link_with_source_sqlx(row: &sqlx::sqlite::SqliteRow) -> Result<LinkWithSource, String> {
    Ok(LinkWithSource {
        id: col_str(row, "id"),
        source_type: col_str(row, "source_type"),
        source_id: col_str(row, "source_id"),
        source_title: col_str(row, "source_title"),
        target_type: col_str(row, "target_type"),
        target_id: col_str(row, "target_id"),
        target_title: col_str(row, "target_title"),
        context: col_opt_str(row, "context"),
        created_at: col_str(row, "created_at"),
    })
}

/// Markdown テキストから見出し（# ～ ######）を抽出してアウトラインを生成する
pub fn extract_outlines(content: &str) -> Vec<OutlineHeading> {
    content
        .lines()
        .enumerate()
        .filter_map(|(line_num, line)| {
            let trimmed = line.trim_start();
            if !trimmed.starts_with('#') {
                return None;
            }
            let level = trimmed.chars().take_while(|&c| c == '#').count();
            if !(1..=6).contains(&level) {
                return None;
            }
            let rest = &trimmed[level..];
            if !rest.starts_with(' ') && !rest.is_empty() {
                return None;
            }
            let text = rest.trim().to_string();
            if text.is_empty() {
                return None;
            }
            Some(OutlineHeading {
                level: level as u8,
                text,
                line: line_num as u32,
            })
        })
        .collect()
}

// ============================================================
// テスト
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_outlines_basic() {
        let content = "# はじめに\n\nテキスト\n\n## 背景\n\n### 先行研究\n\n## 結論";
        let outlines = extract_outlines(content);
        assert_eq!(outlines.len(), 4);
        assert_eq!(outlines[0].level, 1);
        assert_eq!(outlines[0].text, "はじめに");
        assert_eq!(outlines[0].line, 0);
        assert_eq!(outlines[1].level, 2);
        assert_eq!(outlines[1].text, "背景");
        assert_eq!(outlines[2].level, 3);
        assert_eq!(outlines[3].level, 2);
        assert_eq!(outlines[3].text, "結論");
    }

    #[test]
    fn test_extract_outlines_no_space_after_hash() {
        let content = "#タグっぽいもの\n##もう一つ";
        let outlines = extract_outlines(content);
        assert!(outlines.is_empty());
    }

    #[test]
    fn test_extract_outlines_empty_heading() {
        let content = "# \n## テスト";
        let outlines = extract_outlines(content);
        assert_eq!(outlines.len(), 1);
        assert_eq!(outlines[0].text, "テスト");
    }

    #[test]
    fn test_col_string_vec_parse() {
        // col_string_vec のデシリアライズロジックを直接テスト
        let json_str = "[\"a\",\"b\"]";
        let result: Vec<String> = serde_json::from_str(json_str).unwrap_or_default();
        assert_eq!(result, vec!["a", "b"]);
    }

    #[test]
    fn test_col_string_vec_empty() {
        let json_str = "[]";
        let result: Vec<String> = serde_json::from_str(json_str).unwrap_or_default();
        assert!(result.is_empty());
    }
}
