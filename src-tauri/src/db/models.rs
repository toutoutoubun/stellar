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
#[derive(Debug, Clone, Serialize, Deserialize)]
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
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteResponse {
    pub id: String,
    pub title: String,
    pub content: String,
    pub paper_id: Option<String>,
    pub tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
    // ── V005 ドラフトモード拡張フィールド ──
    /// 下書きフラグ（0 = 通常ノート, 1 = 草稿）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_draft: Option<i32>,
    /// 下書きメタ情報（JSON文字列）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub draft_meta: Option<String>,
    /// 単語数
    #[serde(skip_serializing_if = "Option::is_none")]
    pub word_count: Option<i32>,
    /// 推定読了時間（分）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reading_time_min: Option<i32>,
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
#[derive(Debug, Clone, Serialize, Deserialize)]
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
#[derive(Debug, Clone, Serialize, Deserialize)]
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
    /// フロントエンドは "totalItems" を期待するためリネーム
    #[serde(rename = "totalItems")]
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
    pub links: Vec<GraphEdge>,
}

/// グラフノード — 論文またはノート1つ分
/// フロントエンド (react-force-graph-2d) が期待するフィールド名に合わせる:
///   name  — ノードラベル（タイトル）
///   type  — "paper" | "note"
///   val   — ノードサイズ（リンク数）
#[derive(Debug, Clone, Serialize)]
pub struct GraphNode {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub node_type: String,
    pub tags: Vec<String>,
    #[serde(rename = "linkCount")]
    pub link_count: u32,
    pub val: u32,
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
pub(crate) fn col_str(row: &sqlx::sqlite::SqliteRow, key: &str) -> String {
    row.try_get::<String, _>(key).unwrap_or_default()
}

/// sqlx::SqliteRow から Option<String> を取得
pub(crate) fn col_opt_str(row: &sqlx::sqlite::SqliteRow, key: &str) -> Option<String> {
    row.try_get::<Option<String>, _>(key)
        .unwrap_or(None)
        .filter(|s| !s.is_empty())
}

/// sqlx::SqliteRow から Option<i32> を取得
pub(crate) fn col_opt_i32(row: &sqlx::sqlite::SqliteRow, key: &str) -> Option<i32> {
    row.try_get::<Option<i32>, _>(key).unwrap_or(None)
}

/// sqlx::SqliteRow から i64 を取得（NULL なら 0）
pub(crate) fn col_i64(row: &sqlx::sqlite::SqliteRow, key: &str) -> i64 {
    row.try_get::<i64, _>(key).unwrap_or(0)
}

/// sqlx::SqliteRow から i32 を取得（NULL なら 0）
pub(crate) fn col_i32(row: &sqlx::sqlite::SqliteRow, key: &str) -> i32 {
    row.try_get::<i32, _>(key).unwrap_or(0)
}

/// sqlx::SqliteRow から f64 を取得（NULL なら 0.0）
#[allow(dead_code)]
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
        // V005 ドラフトモード拡張 — カラムが存在しない場合はデフォルト値
        is_draft: col_opt_i32(row, "is_draft"),
        draft_meta: col_opt_str(row, "draft_meta"),
        word_count: col_opt_i32(row, "word_count"),
        reading_time_min: col_opt_i32(row, "reading_time_min"),
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
// 質的研究モジュール — DTO・レスポンス型
// ============================================================

// --- プロジェクト ---

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectResponse {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub method_type: String,
    pub created_at: String,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectDto {
    pub name: String,
    pub description: Option<String>,
    #[serde(default = "default_method_type")]
    pub method_type: String,
}

fn default_method_type() -> String {
    "thematic".to_string()
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProjectDto {
    pub name: Option<String>,
    pub description: Option<String>,
    pub method_type: Option<String>,
}

pub fn parse_project(row: &sqlx::sqlite::SqliteRow) -> Result<ProjectResponse, String> {
    Ok(ProjectResponse {
        id: col_str(row, "id"),
        name: col_str(row, "name"),
        description: col_opt_str(row, "description"),
        method_type: col_str(row, "method_type"),
        created_at: col_str(row, "created_at"),
        updated_at: col_opt_str(row, "updated_at"),
    })
}

// --- コード ---

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeResponse {
    pub id: String,
    pub project_id: String,
    pub parent_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub color: String,
    pub code_type: String,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeNode {
    #[serde(flatten)]
    pub code: CodeResponse,
    pub children: Vec<CodeNode>,
    pub assignment_count: u32,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCodeDto {
    pub project_id: String,
    pub parent_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    #[serde(default = "default_code_color")]
    pub color: String,
    #[serde(default = "default_code_type")]
    pub code_type: String,
    #[serde(default)]
    pub sort_order: i32,
}

fn default_code_color() -> String {
    "#6366F1".to_string()
}

fn default_code_type() -> String {
    "thematic".to_string()
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCodeDto {
    pub name: Option<String>,
    pub description: Option<String>,
    pub color: Option<String>,
    pub code_type: Option<String>,
    pub parent_id: Option<Option<String>>,
    pub sort_order: Option<i32>,
}

pub fn parse_code(row: &sqlx::sqlite::SqliteRow) -> Result<CodeResponse, String> {
    Ok(CodeResponse {
        id: col_str(row, "id"),
        project_id: col_str(row, "project_id"),
        parent_id: col_opt_str(row, "parent_id"),
        name: col_str(row, "name"),
        description: col_opt_str(row, "description"),
        color: col_str(row, "color"),
        code_type: col_str(row, "code_type"),
        sort_order: col_i32(row, "sort_order"),
        created_at: col_str(row, "created_at"),
        updated_at: col_opt_str(row, "updated_at"),
    })
}

// --- ハイライト×コード ---

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HighlightWithContext {
    pub id: String,
    pub paper_id: String,
    pub text: String,
    pub comment: Option<String>,
    pub color: String,
    pub page: i32,
    pub paper_title: String,
    pub created_at: String,
}

// --- コーディングマトリクス ---

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodingMatrixRow {
    pub code_id: String,
    pub code_name: String,
    pub code_color: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodingMatrixCol {
    pub paper_id: String,
    pub paper_title: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodingMatrix {
    pub rows: Vec<CodingMatrixRow>,
    pub cols: Vec<CodingMatrixCol>,
    pub cells: std::collections::HashMap<String, u32>,
}

// --- ICR ---

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedCoding {
    pub highlight_id: String,
    pub code_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DisagreementItem {
    pub highlight_id: String,
    pub main_codes: Vec<String>,
    pub imported_codes: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IcrResult {
    pub cohen_kappa: f64,
    pub percent_agreement: f64,
    pub total_segments: u32,
    pub agreements: u32,
    pub disagreements: Vec<DisagreementItem>,
}

// --- 史料批判 ---

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceCritiqueResponse {
    pub id: String,
    pub paper_id: String,
    pub author_info: Option<String>,
    pub creation_date: Option<String>,
    pub is_date_estimated: bool,
    pub location: Option<String>,
    pub source_type: Option<String>,
    pub authenticity: Option<String>,
    pub archive_info: Option<String>,
    pub intent: Option<String>,
    pub audience: Option<String>,
    pub bias_level: Option<String>,
    pub bias_reason: Option<String>,
    pub consistency: Option<String>,
    pub reliability_score: i32,
    pub researcher_notes: Option<String>,
    pub created_at: String,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceCritiqueDto {
    pub paper_id: String,
    pub author_info: Option<String>,
    pub creation_date: Option<String>,
    #[serde(default)]
    pub is_date_estimated: bool,
    pub location: Option<String>,
    pub source_type: Option<String>,
    pub authenticity: Option<String>,
    pub archive_info: Option<String>,
    pub intent: Option<String>,
    pub audience: Option<String>,
    pub bias_level: Option<String>,
    pub bias_reason: Option<String>,
    pub consistency: Option<String>,
    #[serde(default = "default_reliability_score")]
    pub reliability_score: i32,
    pub researcher_notes: Option<String>,
}

fn default_reliability_score() -> i32 {
    3
}

pub fn parse_source_critique(row: &sqlx::sqlite::SqliteRow) -> Result<SourceCritiqueResponse, String> {
    Ok(SourceCritiqueResponse {
        id: col_str(row, "id"),
        paper_id: col_str(row, "paper_id"),
        author_info: col_opt_str(row, "author_info"),
        creation_date: col_opt_str(row, "creation_date"),
        is_date_estimated: col_i32(row, "is_date_estimated") != 0,
        location: col_opt_str(row, "location"),
        source_type: col_opt_str(row, "source_type"),
        authenticity: col_opt_str(row, "authenticity"),
        archive_info: col_opt_str(row, "archive_info"),
        intent: col_opt_str(row, "intent"),
        audience: col_opt_str(row, "audience"),
        bias_level: col_opt_str(row, "bias_level"),
        bias_reason: col_opt_str(row, "bias_reason"),
        consistency: col_opt_str(row, "consistency"),
        reliability_score: col_i32(row, "reliability_score"),
        researcher_notes: col_opt_str(row, "researcher_notes"),
        created_at: col_str(row, "created_at"),
        updated_at: col_opt_str(row, "updated_at"),
    })
}

// --- タイムライン ---

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineEventResponse {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub description: Option<String>,
    pub event_date: String,
    pub date_type: String,
    pub event_type: String,
    pub importance: i32,
    pub lane: Option<String>,
    pub paper_id: Option<String>,
    pub highlight_id: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTimelineEventDto {
    pub project_id: String,
    pub title: String,
    pub description: Option<String>,
    pub event_date: String,
    #[serde(default = "default_date_type")]
    pub date_type: String,
    #[serde(default = "default_event_type")]
    pub event_type: String,
    #[serde(default = "default_importance")]
    pub importance: i32,
    pub lane: Option<String>,
    pub paper_id: Option<String>,
    pub highlight_id: Option<String>,
}

fn default_date_type() -> String { "exact".to_string() }
fn default_event_type() -> String { "political".to_string() }
fn default_importance() -> i32 { 3 }

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTimelineEventDto {
    pub title: Option<String>,
    pub description: Option<String>,
    pub event_date: Option<String>,
    pub date_type: Option<String>,
    pub event_type: Option<String>,
    pub importance: Option<i32>,
    pub lane: Option<String>,
    pub paper_id: Option<Option<String>>,
    pub highlight_id: Option<Option<String>>,
}

pub fn parse_timeline_event(row: &sqlx::sqlite::SqliteRow) -> Result<TimelineEventResponse, String> {
    Ok(TimelineEventResponse {
        id: col_str(row, "id"),
        project_id: col_str(row, "project_id"),
        title: col_str(row, "title"),
        description: col_opt_str(row, "description"),
        event_date: col_str(row, "event_date"),
        date_type: col_str(row, "date_type"),
        event_type: col_str(row, "event_type"),
        importance: col_i32(row, "importance"),
        lane: col_opt_str(row, "lane"),
        paper_id: col_opt_str(row, "paper_id"),
        highlight_id: col_opt_str(row, "highlight_id"),
        created_at: col_str(row, "created_at"),
    })
}

// --- アクター ---

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActorResponse {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub actor_type: String,
    pub position: String,
    pub influence: i32,
    pub level: String,
    pub description: Option<String>,
    pub x_position: Option<f64>,
    pub y_position: Option<f64>,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateActorDto {
    pub project_id: String,
    pub name: String,
    #[serde(default = "default_actor_type")]
    pub actor_type: String,
    #[serde(default = "default_position")]
    pub position: String,
    #[serde(default = "default_importance")]
    pub influence: i32,
    #[serde(default = "default_level")]
    pub level: String,
    pub description: Option<String>,
    pub x_position: Option<f64>,
    pub y_position: Option<f64>,
}

fn default_actor_type() -> String { "state".to_string() }
fn default_position() -> String { "neutral".to_string() }
fn default_level() -> String { "national".to_string() }

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateActorDto {
    pub name: Option<String>,
    pub actor_type: Option<String>,
    pub position: Option<String>,
    pub influence: Option<i32>,
    pub level: Option<String>,
    pub description: Option<String>,
    pub x_position: Option<f64>,
    pub y_position: Option<f64>,
}

pub fn parse_actor(row: &sqlx::sqlite::SqliteRow) -> Result<ActorResponse, String> {
    Ok(ActorResponse {
        id: col_str(row, "id"),
        project_id: col_str(row, "project_id"),
        name: col_str(row, "name"),
        actor_type: col_str(row, "actor_type"),
        position: col_str(row, "position"),
        influence: col_i32(row, "influence"),
        level: col_str(row, "level"),
        description: col_opt_str(row, "description"),
        x_position: row.try_get::<Option<f64>, _>("x_position").unwrap_or(None),
        y_position: row.try_get::<Option<f64>, _>("y_position").unwrap_or(None),
        created_at: col_str(row, "created_at"),
    })
}

// --- アクター関係 ---

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActorRelationResponse {
    pub id: String,
    pub actor_from: String,
    pub actor_to: String,
    pub relation_type: String,
    pub start_year: Option<i32>,
    pub end_year: Option<i32>,
    pub description: Option<String>,
    pub paper_id: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateActorRelationDto {
    pub actor_from: String,
    pub actor_to: String,
    pub relation_type: String,
    pub start_year: Option<i32>,
    pub end_year: Option<i32>,
    pub description: Option<String>,
    pub paper_id: Option<String>,
}

pub fn parse_actor_relation(row: &sqlx::sqlite::SqliteRow) -> Result<ActorRelationResponse, String> {
    Ok(ActorRelationResponse {
        id: col_str(row, "id"),
        actor_from: col_str(row, "actor_from"),
        actor_to: col_str(row, "actor_to"),
        relation_type: col_str(row, "relation_type"),
        start_year: col_opt_i32(row, "start_year"),
        end_year: col_opt_i32(row, "end_year"),
        description: col_opt_str(row, "description"),
        paper_id: col_opt_str(row, "paper_id"),
        created_at: col_str(row, "created_at"),
    })
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActorMapData {
    pub actors: Vec<ActorResponse>,
    pub relations: Vec<ActorRelationResponse>,
}

// --- プロセス・トレーシング ---

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PtHypothesisResponse {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub description: Option<String>,
    pub is_main: bool,
    pub sort_order: i32,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePtHypothesisDto {
    pub project_id: String,
    pub title: String,
    pub description: Option<String>,
    #[serde(default = "default_is_main")]
    pub is_main: bool,
    #[serde(default)]
    pub sort_order: i32,
}

fn default_is_main() -> bool { true }

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PtEvidenceResponse {
    pub id: String,
    pub hypothesis_id: String,
    pub description: String,
    pub test_type: String,
    pub result: String,
    pub paper_id: Option<String>,
    pub highlight_id: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePtEvidenceDto {
    pub hypothesis_id: String,
    pub description: String,
    pub test_type: String,
    #[serde(default = "default_pt_result")]
    pub result: String,
    pub paper_id: Option<String>,
    pub highlight_id: Option<String>,
}

fn default_pt_result() -> String { "pending".to_string() }

pub fn parse_pt_hypothesis(row: &sqlx::sqlite::SqliteRow) -> Result<PtHypothesisResponse, String> {
    Ok(PtHypothesisResponse {
        id: col_str(row, "id"),
        project_id: col_str(row, "project_id"),
        title: col_str(row, "title"),
        description: col_opt_str(row, "description"),
        is_main: col_i32(row, "is_main") != 0,
        sort_order: col_i32(row, "sort_order"),
        created_at: col_str(row, "created_at"),
    })
}

pub fn parse_pt_evidence(row: &sqlx::sqlite::SqliteRow) -> Result<PtEvidenceResponse, String> {
    Ok(PtEvidenceResponse {
        id: col_str(row, "id"),
        hypothesis_id: col_str(row, "hypothesis_id"),
        description: col_str(row, "description"),
        test_type: col_str(row, "test_type"),
        result: col_str(row, "result"),
        paper_id: col_opt_str(row, "paper_id"),
        highlight_id: col_opt_str(row, "highlight_id"),
        created_at: col_str(row, "created_at"),
    })
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HypothesisWithEvidences {
    #[serde(flatten)]
    pub hypothesis: PtHypothesisResponse,
    pub evidences: Vec<PtEvidenceResponse>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PtData {
    pub hypotheses: Vec<HypothesisWithEvidences>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PtSummary {
    pub hoop_pass_rate: f32,
    pub has_smoking_gun: bool,
    pub overall_verdict: String,
}

// --- 比較ケース設計 ---

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComparativeDesignResponse {
    pub id: String,
    pub project_id: String,
    pub design_type: String,
    pub title: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateComparativeDesignDto {
    pub project_id: String,
    pub title: String,
    #[serde(default = "default_design_type")]
    pub design_type: String,
}

fn default_design_type() -> String { "MSSD".to_string() }

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComparativeCaseResponse {
    pub id: String,
    pub design_id: String,
    pub name: String,
    pub sort_order: i32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComparativeVariableResponse {
    pub id: String,
    pub design_id: String,
    pub name: String,
    pub var_type: String,
    pub sort_order: i32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComparativeCellResponse {
    pub id: String,
    pub case_id: String,
    pub variable_id: String,
    pub value: Option<String>,
    pub paper_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComparativeDesignFull {
    #[serde(flatten)]
    pub design: ComparativeDesignResponse,
    pub cases: Vec<ComparativeCaseResponse>,
    pub variables: Vec<ComparativeVariableResponse>,
    pub cells: Vec<ComparativeCellResponse>,
}

pub fn parse_comparative_design(row: &sqlx::sqlite::SqliteRow) -> Result<ComparativeDesignResponse, String> {
    Ok(ComparativeDesignResponse {
        id: col_str(row, "id"),
        project_id: col_str(row, "project_id"),
        design_type: col_str(row, "design_type"),
        title: col_str(row, "title"),
        created_at: col_str(row, "created_at"),
    })
}

pub fn parse_comparative_case(row: &sqlx::sqlite::SqliteRow) -> Result<ComparativeCaseResponse, String> {
    Ok(ComparativeCaseResponse {
        id: col_str(row, "id"),
        design_id: col_str(row, "design_id"),
        name: col_str(row, "name"),
        sort_order: col_i32(row, "sort_order"),
    })
}

pub fn parse_comparative_variable(row: &sqlx::sqlite::SqliteRow) -> Result<ComparativeVariableResponse, String> {
    Ok(ComparativeVariableResponse {
        id: col_str(row, "id"),
        design_id: col_str(row, "design_id"),
        name: col_str(row, "name"),
        var_type: col_str(row, "var_type"),
        sort_order: col_i32(row, "sort_order"),
    })
}

pub fn parse_comparative_cell(row: &sqlx::sqlite::SqliteRow) -> Result<ComparativeCellResponse, String> {
    Ok(ComparativeCellResponse {
        id: col_str(row, "id"),
        case_id: col_str(row, "case_id"),
        variable_id: col_str(row, "variable_id"),
        value: col_opt_str(row, "value"),
        paper_id: col_opt_str(row, "paper_id"),
    })
}

// --- フレーミング分析 ---

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameResponse {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub problem_definition: Option<String>,
    pub causal_interpretation: Option<String>,
    pub moral_evaluation: Option<String>,
    pub treatment_recommendation: Option<String>,
    pub color: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFrameDto {
    pub project_id: String,
    pub name: String,
    pub problem_definition: Option<String>,
    pub causal_interpretation: Option<String>,
    pub moral_evaluation: Option<String>,
    pub treatment_recommendation: Option<String>,
    #[serde(default = "default_frame_color")]
    pub color: String,
}

fn default_frame_color() -> String { "#8B5CF6".to_string() }

pub fn parse_frame(row: &sqlx::sqlite::SqliteRow) -> Result<FrameResponse, String> {
    Ok(FrameResponse {
        id: col_str(row, "id"),
        project_id: col_str(row, "project_id"),
        name: col_str(row, "name"),
        problem_definition: col_opt_str(row, "problem_definition"),
        causal_interpretation: col_opt_str(row, "causal_interpretation"),
        moral_evaluation: col_opt_str(row, "moral_evaluation"),
        treatment_recommendation: col_opt_str(row, "treatment_recommendation"),
        color: col_str(row, "color"),
        created_at: col_str(row, "created_at"),
    })
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FramingMatrix {
    pub frames: Vec<FrameResponse>,
    pub papers: Vec<CodingMatrixCol>,
    pub counts: std::collections::HashMap<String, u32>,
}

// ============================================================
// 引用ネットワーク・読書ステータス・関連論文サジェスト
// ============================================================

/// Semantic Scholar 引用エントリ（references_json / cited_by_json の1要素）
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CitationEntry {
    pub ss_paper_id: Option<String>,
    pub title: String,
    pub authors: Vec<String>,
    pub year: Option<i32>,
    pub doi: Option<String>,
    pub url: Option<String>,
}

/// 関連論文レコメンデーション（paper_recommendations テーブル）
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PaperRecommendation {
    pub id: String,
    pub paper_id: String,
    pub recommended_paper_id: Option<String>,
    pub title: String,
    pub authors: String, // JSON string
    pub year: Option<i32>,
    pub doi: Option<String>,
    pub url: Option<String>,
    pub r#abstract: Option<String>,
    pub ss_paper_id: Option<String>,
    pub relevance_score: Option<f64>,
    pub is_imported: i64,
    pub created_at: String,
}

/// 引用ネットワークデータ（フロントエンドへ返却）
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CitationNetworkData {
    pub paper_id: String,
    pub references: Vec<CitationEntry>,
    pub cited_by: Vec<CitationEntry>,
    pub fetched_at: Option<String>,
}

/// sqlx::SqliteRow → PaperRecommendation
pub fn parse_recommendation(row: &sqlx::sqlite::SqliteRow) -> Result<PaperRecommendation, String> {
    Ok(PaperRecommendation {
        id: col_str(row, "id"),
        paper_id: col_str(row, "paper_id"),
        recommended_paper_id: col_opt_str(row, "recommended_paper_id"),
        title: col_str(row, "title"),
        authors: col_str(row, "authors"),
        year: col_opt_i32(row, "year"),
        doi: col_opt_str(row, "doi"),
        url: col_opt_str(row, "url"),
        r#abstract: col_opt_str(row, "abstract"),
        ss_paper_id: col_opt_str(row, "ss_paper_id"),
        relevance_score: row.try_get::<Option<f64>, _>("relevance_score").unwrap_or(None),
        is_imported: col_i64(row, "is_imported"),
        created_at: col_str(row, "created_at"),
    })
}

// ============================================================
// 下書きモード — Draft・Chapter・Citation
// ============================================================

/// 下書きノートレスポンス（is_draft=1 のノート + 拡張フィールド）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DraftResponse {
    pub id: String,
    pub title: String,
    pub content: String,
    pub paper_id: Option<String>,
    pub tags: Vec<String>,
    pub is_draft: i32,
    pub draft_meta: String,
    pub word_count: i32,
    pub reading_time_min: i32,
    pub created_at: String,
    pub updated_at: String,
}

/// sqlx::SqliteRow → DraftResponse
pub fn parse_draft(row: &sqlx::sqlite::SqliteRow) -> Result<DraftResponse, String> {
    Ok(DraftResponse {
        id: col_str(row, "id"),
        title: col_str(row, "title"),
        content: col_str(row, "content"),
        paper_id: col_opt_str(row, "paper_id"),
        tags: col_string_vec(row, "tags"),
        is_draft: col_i32(row, "is_draft"),
        draft_meta: col_str(row, "draft_meta"),
        word_count: col_i32(row, "word_count"),
        reading_time_min: col_i32(row, "reading_time_min"),
        created_at: col_str(row, "created_at"),
        updated_at: col_str(row, "updated_at"),
    })
}

/// 下書き作成 DTO
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDraftDto {
    pub title: String,
    #[serde(default)]
    pub content: String,
    pub paper_id: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
}

/// 下書き章レスポンス
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DraftChapterResponse {
    pub id: String,
    pub note_id: String,
    pub title: String,
    pub order_index: i32,
    pub word_count: i32,
    pub created_at: String,
    pub updated_at: String,
}

/// sqlx::SqliteRow → DraftChapterResponse
pub fn parse_draft_chapter(row: &sqlx::sqlite::SqliteRow) -> Result<DraftChapterResponse, String> {
    Ok(DraftChapterResponse {
        id: col_str(row, "id"),
        note_id: col_str(row, "note_id"),
        title: col_str(row, "title"),
        order_index: col_i32(row, "order_index"),
        word_count: col_i32(row, "word_count"),
        created_at: col_str(row, "created_at"),
        updated_at: col_str(row, "updated_at"),
    })
}

/// 下書き章作成 DTO
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDraftChapterDto {
    pub note_id: String,
    pub title: String,
    #[serde(default)]
    pub order_index: i32,
}

/// 下書き章更新 DTO
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDraftChapterDto {
    pub title: Option<String>,
    pub order_index: Option<i32>,
    pub word_count: Option<i32>,
}

/// 下書き引用レスポンス
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DraftCitationResponse {
    pub id: String,
    pub note_id: String,
    pub paper_id: String,
    pub citation_key: String,
    pub citation_style: String,
    pub inline_text: String,
    pub bibliography_text: String,
    pub page_ref: Option<String>,
    pub created_at: String,
}

/// sqlx::SqliteRow → DraftCitationResponse
pub fn parse_draft_citation(row: &sqlx::sqlite::SqliteRow) -> Result<DraftCitationResponse, String> {
    Ok(DraftCitationResponse {
        id: col_str(row, "id"),
        note_id: col_str(row, "note_id"),
        paper_id: col_str(row, "paper_id"),
        citation_key: col_str(row, "citation_key"),
        citation_style: col_str(row, "citation_style"),
        inline_text: col_str(row, "inline_text"),
        bibliography_text: col_str(row, "bibliography_text"),
        page_ref: col_opt_str(row, "page_ref"),
        created_at: col_str(row, "created_at"),
    })
}

/// 引用挿入 DTO
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InsertCitationDto {
    pub note_id: String,
    pub paper_id: String,
    #[serde(default = "default_citation_style")]
    pub citation_style: String,
    pub page_ref: Option<String>,
}

fn default_citation_style() -> String {
    "apa7".to_string()
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
