// src-tauri/src/commands/highlights.rs
// Stellar — ハイライト CRUD コマンド
// PDF上のハイライト（テキスト選択＋コメント）を管理する
// FTS5 インデックスはトリガーで自動同期される

use crate::db::models::{parse_highlight_row, CreateHighlightDto, HighlightResponse};
use serde_json::Value;
use tauri::{AppHandle, Manager};
use tauri_plugin_sql::{DbInstances, DbPool};

/// DB 接続プールを取得するヘルパー
async fn get_db(app: &AppHandle) -> Result<std::sync::Arc<DbPool>, String> {
    let db_instances = app.state::<DbInstances>();
    let instances = db_instances.0.read().await;
    instances
        .get("sqlite:stellar.db")
        .cloned()
        .ok_or_else(|| "データベース接続が見つかりません".to_string())
}

// ────────────────────────────────────────────────────────────
// get_highlights — 論文のハイライト一覧を取得する
// ────────────────────────────────────────────────────────────

/// 論文のハイライト一覧（ページ番号・作成日時順）
#[tauri::command]
pub async fn get_highlights(
    app: AppHandle,
    paper_id: String,
) -> Result<Vec<HighlightResponse>, String> {
    let db = get_db(&app).await?;

    let rows: Vec<Value> = db
        .select(
            "SELECT * FROM highlights WHERE paper_id = ? ORDER BY page ASC, created_at ASC",
            vec![Value::String(paper_id)],
        )
        .await
        .map_err(|e| format!("ハイライト一覧の取得に失敗: {}", e))?;

    rows.iter()
        .map(parse_highlight_row)
        .collect::<Result<Vec<_>, _>>()
}

// ────────────────────────────────────────────────────────────
// create_highlight — ハイライトを新規作成する
// FTS5 インデックス (fts_highlights) はトリガーで自動追加される
// ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn create_highlight(
    app: AppHandle,
    dto: CreateHighlightDto,
) -> Result<HighlightResponse, String> {
    let db = get_db(&app).await?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let rect_json = serde_json::to_string(&dto.rect).map_err(|e| e.to_string())?;

    db.execute(
        "INSERT INTO highlights (id, paper_id, text, comment, color, page, rect, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        vec![
            Value::String(id.clone()),
            Value::String(dto.paper_id.clone()),
            Value::String(dto.text.clone()),
            dto.comment.clone().map_or(Value::Null, Value::String),
            Value::String(dto.color.clone()),
            Value::Number(dto.page.into()),
            Value::String(rect_json),
            Value::String(now.clone()),
        ],
    )
    .await
    .map_err(|e| format!("ハイライトの作成に失敗: {}", e))?;

    Ok(HighlightResponse {
        id,
        paper_id: dto.paper_id,
        text: dto.text,
        comment: dto.comment,
        color: dto.color,
        page: dto.page,
        rect: dto.rect,
        created_at: now,
    })
}

// ────────────────────────────────────────────────────────────
// update_highlight_comment — ハイライトのコメントを更新する
// FTS5 インデックス (fts_highlights) はトリガーで自動更新される
// ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn update_highlight_comment(
    app: AppHandle,
    id: String,
    comment: String,
) -> Result<HighlightResponse, String> {
    let db = get_db(&app).await?;

    // 現在のハイライトを取得
    let rows: Vec<Value> = db
        .select(
            "SELECT * FROM highlights WHERE id = ?",
            vec![Value::String(id.clone())],
        )
        .await
        .map_err(|e| format!("ハイライトの取得に失敗: {}", e))?;

    let current = rows
        .first()
        .ok_or_else(|| format!("ハイライトが見つかりません: {}", id))
        .and_then(parse_highlight_row)?;

    // 空文字列は NULL として保存する
    let comment_value = if comment.is_empty() {
        None
    } else {
        Some(comment)
    };

    db.execute(
        "UPDATE highlights SET comment = ? WHERE id = ?",
        vec![
            comment_value.clone().map_or(Value::Null, Value::String),
            Value::String(id.clone()),
        ],
    )
    .await
    .map_err(|e| format!("ハイライトのコメント更新に失敗: {}", e))?;

    Ok(HighlightResponse {
        id,
        comment: comment_value,
        ..current
    })
}

// ────────────────────────────────────────────────────────────
// delete_highlight — ハイライトを削除する
// FTS5 インデックス (fts_highlights) はトリガーで自動削除される
// ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn delete_highlight(app: AppHandle, id: String) -> Result<(), String> {
    let db = get_db(&app).await?;

    db.execute(
        "DELETE FROM highlights WHERE id = ?",
        vec![Value::String(id)],
    )
    .await
    .map_err(|e| format!("ハイライトの削除に失敗: {}", e))?;

    Ok(())
}
