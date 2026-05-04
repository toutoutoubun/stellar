// src-tauri/src/commands/links.rs
// Stellar — リンク CRUD コマンド
// ノート・論文間の双方向リンクを管理する（グラフビューの基盤データ）

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_sql::{DbInstances, DbPool};

/// リンク作成時の入力データ
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateLinkInput {
    pub source_type: String,
    pub source_id: String,
    pub target_type: String,
    pub target_id: String,
    pub context: Option<String>,
}

/// フロントエンドに返すリンクデータ
#[derive(Debug, Serialize)]
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

/// DB インスタンスを取得するヘルパー
async fn get_db(app: &AppHandle) -> Result<std::sync::Arc<DbPool>, String> {
    let db_instances = app.state::<DbInstances>();
    let instances = db_instances.0.read().await;
    instances
        .get("sqlite:stellar.db")
        .cloned()
        .ok_or_else(|| "データベース接続が見つかりません".to_string())
}

/// リンクを新規作成する
/// 同一ペアの重複リンクは作成しない（UNIQUE制約でエラーになる）
#[tauri::command]
pub async fn create_link(
    app: AppHandle,
    input: CreateLinkInput,
) -> Result<LinkResponse, String> {
    let db = get_db(&app).await?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    db.execute(
        "INSERT INTO links (id, source_type, source_id, target_type, target_id, context, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        vec![
            serde_json::Value::String(id.clone()),
            serde_json::Value::String(input.source_type.clone()),
            serde_json::Value::String(input.source_id.clone()),
            serde_json::Value::String(input.target_type.clone()),
            serde_json::Value::String(input.target_id.clone()),
            input.context.clone().map_or(serde_json::Value::Null, serde_json::Value::String),
            serde_json::Value::String(now.clone()),
        ],
    )
    .await
    .map_err(|e| format!("リンクの作成に失敗しました: {}", e))?;

    Ok(LinkResponse {
        id,
        source_type: input.source_type,
        source_id: input.source_id,
        target_type: input.target_type,
        target_id: input.target_id,
        context: input.context,
        created_at: now,
    })
}

/// 指定ノード（論文またはノート）に関連するリンクをすべて取得する
/// source または target のいずれかが指定ノードであるリンクを返す
#[tauri::command]
pub async fn get_links_for_node(
    app: AppHandle,
    node_type: String,
    node_id: String,
) -> Result<Vec<LinkResponse>, String> {
    let db = get_db(&app).await?;
    let rows: Vec<serde_json::Value> = db
        .select(
            "SELECT * FROM links WHERE (source_type = ? AND source_id = ?) OR (target_type = ? AND target_id = ?) ORDER BY created_at DESC",
            vec![
                serde_json::Value::String(node_type.clone()),
                serde_json::Value::String(node_id.clone()),
                serde_json::Value::String(node_type),
                serde_json::Value::String(node_id),
            ],
        )
        .await
        .map_err(|e| format!("リンク一覧の取得に失敗しました: {}", e))?;

    rows.iter()
        .map(|row| parse_link_row(row))
        .collect::<Result<Vec<_>, _>>()
}

/// すべてのリンクを取得する（グラフビュー用）
#[tauri::command]
pub async fn get_all_links(app: AppHandle) -> Result<Vec<LinkResponse>, String> {
    let db = get_db(&app).await?;
    let rows: Vec<serde_json::Value> = db
        .select("SELECT * FROM links ORDER BY created_at DESC", vec![])
        .await
        .map_err(|e| format!("全リンクの取得に失敗しました: {}", e))?;

    rows.iter()
        .map(|row| parse_link_row(row))
        .collect::<Result<Vec<_>, _>>()
}

/// リンクを削除する
#[tauri::command]
pub async fn delete_link(app: AppHandle, id: String) -> Result<(), String> {
    let db = get_db(&app).await?;
    db.execute(
        "DELETE FROM links WHERE id = ?",
        vec![serde_json::Value::String(id)],
    )
    .await
    .map_err(|e| format!("リンクの削除に失敗しました: {}", e))?;

    Ok(())
}

/// DB行データを LinkResponse に変換するヘルパー関数
fn parse_link_row(row: &serde_json::Value) -> Result<LinkResponse, String> {
    let get_str = |key: &str| -> String {
        row.get(key)
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string()
    };
    let get_opt_str = |key: &str| -> Option<String> {
        row.get(key)
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .filter(|s| !s.is_empty())
    };

    Ok(LinkResponse {
        id: get_str("id"),
        source_type: get_str("source_type"),
        source_id: get_str("source_id"),
        target_type: get_str("target_type"),
        target_id: get_str("target_id"),
        context: get_opt_str("context"),
        created_at: get_str("created_at"),
    })
}
