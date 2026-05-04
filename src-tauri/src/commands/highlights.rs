// src-tauri/src/commands/highlights.rs
// Stellar — ハイライト CRUD コマンド
// PDF上のハイライト（テキスト選択＋コメント）を管理する

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_sql::{DbInstances, DbPool};

/// ハイライトの矩形座標
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HighlightRect {
    pub x1: f64,
    pub y1: f64,
    pub x2: f64,
    pub y2: f64,
}

/// ハイライト作成時の入力データ
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateHighlightInput {
    pub paper_id: String,
    pub text: String,
    pub comment: Option<String>,
    pub color: String,
    pub page: i32,
    pub rect: HighlightRect,
}

/// ハイライト更新時の入力データ
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateHighlightInput {
    pub comment: Option<String>,
    pub color: Option<String>,
}

/// フロントエンドに返すハイライトデータ
#[derive(Debug, Serialize)]
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

/// DB インスタンスを取得するヘルパー
async fn get_db(app: &AppHandle) -> Result<std::sync::Arc<DbPool>, String> {
    let db_instances = app.state::<DbInstances>();
    let instances = db_instances.0.read().await;
    instances
        .get("sqlite:stellar.db")
        .cloned()
        .ok_or_else(|| "データベース接続が見つかりません".to_string())
}

/// ハイライトを新規作成する
#[tauri::command]
pub async fn create_highlight(
    app: AppHandle,
    input: CreateHighlightInput,
) -> Result<HighlightResponse, String> {
    let db = get_db(&app).await?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let rect_json = serde_json::to_string(&input.rect).map_err(|e| e.to_string())?;

    db.execute(
        "INSERT INTO highlights (id, paper_id, text, comment, color, page, rect, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        vec![
            serde_json::Value::String(id.clone()),
            serde_json::Value::String(input.paper_id.clone()),
            serde_json::Value::String(input.text.clone()),
            input.comment.clone().map_or(serde_json::Value::Null, serde_json::Value::String),
            serde_json::Value::String(input.color.clone()),
            serde_json::Value::Number(input.page.into()),
            serde_json::Value::String(rect_json),
            serde_json::Value::String(now.clone()),
        ],
    )
    .await
    .map_err(|e| format!("ハイライトの作成に失敗しました: {}", e))?;

    Ok(HighlightResponse {
        id,
        paper_id: input.paper_id,
        text: input.text,
        comment: input.comment,
        color: input.color,
        page: input.page,
        rect: input.rect,
        created_at: now,
    })
}

/// 特定の論文に紐づくハイライトを全件取得する
#[tauri::command]
pub async fn get_highlights_by_paper(
    app: AppHandle,
    paper_id: String,
) -> Result<Vec<HighlightResponse>, String> {
    let db = get_db(&app).await?;
    let rows: Vec<serde_json::Value> = db
        .select(
            "SELECT * FROM highlights WHERE paper_id = ? ORDER BY page ASC, created_at ASC",
            vec![serde_json::Value::String(paper_id)],
        )
        .await
        .map_err(|e| format!("ハイライト一覧の取得に失敗しました: {}", e))?;

    rows.iter()
        .map(|row| parse_highlight_row(row))
        .collect::<Result<Vec<_>, _>>()
}

/// ハイライトを更新する（コメントと色のみ変更可能）
#[tauri::command]
pub async fn update_highlight(
    app: AppHandle,
    id: String,
    input: UpdateHighlightInput,
) -> Result<HighlightResponse, String> {
    let db = get_db(&app).await?;

    // 現在のハイライトを取得
    let rows: Vec<serde_json::Value> = db
        .select(
            "SELECT * FROM highlights WHERE id = ?",
            vec![serde_json::Value::String(id.clone())],
        )
        .await
        .map_err(|e| format!("ハイライトの取得に失敗しました: {}", e))?;

    let current = rows
        .first()
        .ok_or_else(|| format!("ハイライトが見つかりません: {}", id))
        .and_then(parse_highlight_row)?;

    let comment = if input.comment.is_some() {
        input.comment
    } else {
        current.comment
    };
    let color = input.color.unwrap_or(current.color);

    db.execute(
        "UPDATE highlights SET comment=?, color=? WHERE id=?",
        vec![
            comment.clone().map_or(serde_json::Value::Null, serde_json::Value::String),
            serde_json::Value::String(color.clone()),
            serde_json::Value::String(id.clone()),
        ],
    )
    .await
    .map_err(|e| format!("ハイライトの更新に失敗しました: {}", e))?;

    Ok(HighlightResponse {
        id,
        paper_id: current.paper_id,
        text: current.text,
        comment,
        color,
        page: current.page,
        rect: current.rect,
        created_at: current.created_at,
    })
}

/// ハイライトを削除する
#[tauri::command]
pub async fn delete_highlight(app: AppHandle, id: String) -> Result<(), String> {
    let db = get_db(&app).await?;
    db.execute(
        "DELETE FROM highlights WHERE id = ?",
        vec![serde_json::Value::String(id)],
    )
    .await
    .map_err(|e| format!("ハイライトの削除に失敗しました: {}", e))?;

    Ok(())
}

/// DB行データを HighlightResponse に変換するヘルパー関数
fn parse_highlight_row(row: &serde_json::Value) -> Result<HighlightResponse, String> {
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

    let rect: HighlightRect =
        serde_json::from_str(&get_str("rect")).unwrap_or(HighlightRect {
            x1: 0.0,
            y1: 0.0,
            x2: 0.0,
            y2: 0.0,
        });

    let page = row
        .get("page")
        .and_then(|v| v.as_i64())
        .unwrap_or(0) as i32;

    Ok(HighlightResponse {
        id: get_str("id"),
        paper_id: get_str("paper_id"),
        text: get_str("text"),
        comment: get_opt_str("comment"),
        color: get_str("color"),
        page,
        rect,
        created_at: get_str("created_at"),
    })
}
