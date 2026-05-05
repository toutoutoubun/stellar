// src-tauri/src/commands/highlights.rs
// Stellar — ハイライト CRUD コマンド
// PDF上のハイライト（テキスト選択＋コメント）を管理する
// FTS5 インデックスはトリガーで自動同期される

use crate::db::{get_pool, models::*};
use tauri::AppHandle;

// ────────────────────────────────────────────────────────────
// get_highlights — 論文のハイライト一覧を取得する
// ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_highlights(
    app: AppHandle,
    paper_id: String,
) -> Result<Vec<HighlightResponse>, String> {
    let pool = get_pool(&app);

    let rows = sqlx::query(
        "SELECT * FROM highlights WHERE paper_id = ? ORDER BY page ASC, created_at ASC",
    )
    .bind(&paper_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("ハイライト一覧の取得に失敗: {}", e))?;

    rows.iter()
        .map(parse_highlight_sqlx)
        .collect::<Result<Vec<_>, _>>()
}

// ────────────────────────────────────────────────────────────
// create_highlight
// ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn create_highlight(
    app: AppHandle,
    dto: CreateHighlightDto,
) -> Result<HighlightResponse, String> {
    let pool = get_pool(&app);
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let rect_json = serde_json::to_string(&dto.rect).map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO highlights (id, paper_id, text, comment, color, page, rect, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&dto.paper_id)
    .bind(&dto.text)
    .bind(&dto.comment)
    .bind(&dto.color)
    .bind(dto.page)
    .bind(&rect_json)
    .bind(&now)
    .execute(pool.as_ref())
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
// update_highlight_comment
// ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn update_highlight_comment(
    app: AppHandle,
    id: String,
    comment: String,
) -> Result<HighlightResponse, String> {
    let pool = get_pool(&app);

    let row = sqlx::query("SELECT * FROM highlights WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.as_ref())
        .await
        .map_err(|e| format!("ハイライトの取得に失敗: {}", e))?
        .ok_or_else(|| format!("ハイライトが見つかりません: {}", id))?;

    let current = parse_highlight_sqlx(&row)?;

    let comment_value = if comment.is_empty() {
        None
    } else {
        Some(comment)
    };

    sqlx::query("UPDATE highlights SET comment = ? WHERE id = ?")
        .bind(&comment_value)
        .bind(&id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("ハイライトのコメント更新に失敗: {}", e))?;

    Ok(HighlightResponse {
        id,
        comment: comment_value,
        ..current
    })
}

// ────────────────────────────────────────────────────────────
// delete_highlight
// ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn delete_highlight(app: AppHandle, id: String) -> Result<(), String> {
    let pool = get_pool(&app);

    sqlx::query("DELETE FROM highlights WHERE id = ?")
        .bind(&id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("ハイライトの削除に失敗: {}", e))?;

    Ok(())
}
