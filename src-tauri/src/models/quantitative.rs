// src-tauri/src/models/quantitative.rs
// Stellar — 量的研究モジュール データモデル・DTO 定義
// datasets, variables, data_rows, analyses, token_frequencies の
// DB 行マッピング構造体とフロントエンドからの入力 DTO を定義する

use serde::{Deserialize, Serialize};

// ════════════════════════════════════════════════════════════════
// DB 行マッピング構造体（sqlx::FromRow 対応）
// ════════════════════════════════════════════════════════════════

/// データセット — 量的分析の単位となるデータ集合
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Dataset {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub source_type: String,
    pub source_ref: Option<String>,
    pub row_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

/// 変数 — データセット内の列定義（尺度水準・ラベル・リカート設定を含む）
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Variable {
    pub id: String,
    pub dataset_id: String,
    pub column_index: i64,
    pub name: String,
    pub label: Option<String>,
    pub var_type: String,
    pub unit: Option<String>,
    pub likert_min: Option<i64>,
    pub likert_max: Option<i64>,
    pub likert_labels: Option<String>,
}

/// データ行 — JSON オブジェクトとして各変数の値を保持する
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DataRow {
    pub id: String,
    pub dataset_id: String,
    pub row_index: i64,
    /// JSON object: { "variable_id": "raw_value" }
    pub values: String,
    pub created_at: String,
}

/// 分析結果 — 分析種別・パラメータ・結果を JSON で保持する
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Analysis {
    pub id: String,
    pub dataset_id: String,
    pub analysis_type: String,
    pub name: String,
    /// JSON: 入力変数 ID・オプション
    pub parameters: String,
    /// JSON: 計算結果オブジェクト
    pub result: String,
    /// 日本語の平易な解釈テキスト（フロントエンドが生成）
    pub interpretation: Option<String>,
    pub created_at: String,
}

/// トークン頻度 — テキストマイニング結果（形態素・TF-IDF・品詞情報）
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TokenFrequency {
    pub id: String,
    pub dataset_id: String,
    pub variable_id: String,
    pub token: String,
    pub frequency: i64,
    pub tf_idf: Option<f64>,
    /// 品詞タグ（Kuromoji 由来）
    pub pos: Option<String>,
    pub document_count: i64,
}

// ════════════════════════════════════════════════════════════════
// 入力 DTO（フロントエンドからの入力データ）
// ════════════════════════════════════════════════════════════════

/// データセット作成 DTO
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CreateDatasetInput {
    pub name: String,
    pub description: Option<String>,
    pub source_type: String,
    pub source_ref: Option<String>,
}

/// 変数作成 DTO
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CreateVariableInput {
    pub dataset_id: String,
    pub column_index: i64,
    pub name: String,
    pub label: Option<String>,
    pub var_type: String,
    pub unit: Option<String>,
    pub likert_min: Option<i64>,
    pub likert_max: Option<i64>,
    pub likert_labels: Option<String>,
}

/// CSV インポート DTO
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImportCsvInput {
    pub dataset_id: String,
    pub csv_text: String,
    pub has_header: bool,
    pub delimiter: String,
}

/// CSV インポート結果
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImportCsvResult {
    pub dataset_id: String,
    pub row_count: usize,
    pub variable_count: usize,
    pub warnings: Vec<String>,
}

/// 分析保存 DTO
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SaveAnalysisInput {
    pub dataset_id: String,
    pub analysis_type: String,
    pub name: String,
    pub parameters: String,
    pub result: String,
    pub interpretation: Option<String>,
}

/// トークン頻度保存 DTO
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SaveTokenFrequenciesInput {
    pub dataset_id: String,
    pub variable_id: String,
    pub tokens: Vec<TokenFrequencyItem>,
}

/// トークン頻度アイテム（バルクインサート用）
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TokenFrequencyItem {
    pub token: String,
    pub frequency: i64,
    pub tf_idf: Option<f64>,
    pub pos: Option<String>,
    pub document_count: i64,
}
