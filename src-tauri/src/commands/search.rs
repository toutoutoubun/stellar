// src-tauri/src/commands/search.rs
// Stellar — 全文検索コマンド
// FTS5 仮想テーブルを使った論文・ノートの横断検索

use serde::Serialize;
use tauri::{AppHandle, Manager};
use tauri_plugin_sql::{DbInstances, DbPool};

/// 全文検索結果
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub id: String,
    pub content_type: String,
    pub title: String,
    pub snippet: String,
    pub rank: f64,
}

/// DB インスタンスを取得するヘルパー
async fn get_db(app: &AppHandle) -> Result<std::sync::Arc<DbPool>, String> {
    let db_instances = app.state::<DbInstances>();
    let instances = db_instances.0.read().await;
    instances
        .get("sqlite:stellar.db")
        .cloned()
        .ok_or_else(|| "データベース接続が見つかりません".to_string())
}

/// FTS5 を使った全文検索
/// 論文のタイトル・著者・アブストラクト、ノートのタイトル・本文を横断検索する
/// query: 検索クエリ（FTS5 構文対応: AND / OR / NOT / "フレーズ" / 前方一致*）
/// limit: 最大件数（デフォルト50）
#[tauri::command]
pub async fn full_text_search(
    app: AppHandle,
    query: String,
    limit: Option<i32>,
) -> Result<Vec<SearchResult>, String> {
    let db = get_db(&app).await?;
    let max_results = limit.unwrap_or(50);

    // 空クエリの場合は空配列を返す
    if query.trim().is_empty() {
        return Ok(vec![]);
    }

    // FTS5 検索クエリを実行
    // snippet() 関数で前後の文脈を含むハイライト付きスニペットを取得
    let rows: Vec<serde_json::Value> = db
        .select(
            "SELECT
                content_id AS id,
                content_type,
                title,
                snippet(fts_search, 3, '<mark>', '</mark>', '...', 32) AS snippet,
                rank
            FROM fts_search
            WHERE fts_search MATCH ?
            ORDER BY rank
            LIMIT ?",
            vec![
                serde_json::Value::String(query),
                serde_json::Value::Number(max_results.into()),
            ],
        )
        .await
        .map_err(|e| format!("全文検索に失敗しました: {}", e))?;

    rows.iter()
        .map(|row| {
            let get_str = |key: &str| -> String {
                row.get(key)
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string()
            };
            let rank = row
                .get("rank")
                .and_then(|v| v.as_f64())
                .unwrap_or(0.0);

            Ok(SearchResult {
                id: get_str("id"),
                content_type: get_str("content_type"),
                title: get_str("title"),
                snippet: get_str("snippet"),
                rank,
            })
        })
        .collect::<Result<Vec<_>, String>>()
}
