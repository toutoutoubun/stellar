// src-tauri/src/db/models.rs
// Stellar — データベースモデル定義
// フロントエンドとの JSON シリアライズ/デシリアライズに対応する構造体

use serde::{Deserialize, Serialize};

/// 論文（Paper）モデル
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Paper {
    pub id: String,
    pub title: String,
    pub authors: String,        // JSON配列文字列として保存
    pub year: Option<i32>,
    pub journal: Option<String>,
    pub volume: Option<String>,
    pub issue: Option<String>,
    pub pages: Option<String>,
    pub doi: Option<String>,
    pub url: Option<String>,
    pub r#abstract: Option<String>,
    pub pdf_path: Option<String>,
    pub tags: String,           // JSON配列文字列として保存
    pub created_at: String,
    pub updated_at: String,
}

/// ノート（Note）モデル
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content: String,
    pub paper_id: Option<String>,
    pub tags: String,           // JSON配列文字列として保存
    pub created_at: String,
    pub updated_at: String,
}

/// ハイライト（Highlight）モデル
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Highlight {
    pub id: String,
    pub paper_id: String,
    pub text: String,
    pub comment: Option<String>,
    pub color: String,          // 'yellow' | 'blue' | 'green' | 'pink'
    pub page: i32,
    pub rect: String,           // JSON文字列 { x1, y1, x2, y2 }
    pub created_at: String,
}

/// リンク（Link）モデル — ノート・論文間の双方向リンク
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Link {
    pub id: String,
    pub source_type: String,    // 'note' | 'paper'
    pub source_id: String,
    pub target_type: String,    // 'note' | 'paper'
    pub target_id: String,
    pub context: Option<String>,
    pub created_at: String,
}

/// 全文検索結果モデル
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub id: String,
    pub content_type: String,   // 'paper' | 'note'
    pub title: String,
    pub snippet: String,
    pub rank: f64,
}
