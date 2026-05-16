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
    let pool = get_pool(&app)?;

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
// get_qualitative_source_highlights — 質的分析ソースPDFのハイライト一覧
// ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_qualitative_source_highlights(
    app: AppHandle,
    source_id: String,
) -> Result<Vec<HighlightResponse>, String> {
    let pool = get_pool(&app)?;

    let rows = sqlx::query(
        "SELECT * FROM qualitative_source_highlights WHERE source_id = ? ORDER BY page ASC, created_at ASC",
    )
    .bind(&source_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("分析ソースハイライト一覧の取得に失敗: {}", e))?;

    rows.iter()
        .map(parse_qualitative_source_highlight_sqlx)
        .collect::<Result<Vec<_>, _>>()
}

// ────────────────────────────────────────────────────────────
// create_highlight
// ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn create_highlight(
    app: AppHandle,
    input: CreateHighlightDto,
) -> Result<HighlightResponse, String> {
    let pool = get_pool(&app)?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let rect_json = serde_json::to_string(&input.rect).map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO highlights (id, paper_id, text, comment, color, page, rect, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&input.paper_id)
    .bind(&input.text)
    .bind(&input.comment)
    .bind(&input.color)
    .bind(input.page)
    .bind(&rect_json)
    .bind(&now)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("ハイライトの作成に失敗: {}", e))?;

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

// ────────────────────────────────────────────────────────────
// create_qualitative_source_highlight
// ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn create_qualitative_source_highlight(
    app: AppHandle,
    input: CreateQualitativeSourceHighlightDto,
) -> Result<HighlightResponse, String> {
    let pool = get_pool(&app)?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let rect_json = serde_json::to_string(&input.rect).map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO qualitative_source_highlights (id, source_id, text, comment, color, page, rect, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&input.source_id)
    .bind(&input.text)
    .bind(&input.comment)
    .bind(&input.color)
    .bind(input.page)
    .bind(&rect_json)
    .bind(&now)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("分析ソースハイライトの作成に失敗: {}", e))?;

    Ok(HighlightResponse {
        id,
        paper_id: input.source_id,
        text: input.text,
        comment: input.comment,
        color: input.color,
        page: input.page,
        rect: input.rect,
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
    let pool = get_pool(&app)?;

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
// update_qualitative_source_highlight_comment
// ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn update_qualitative_source_highlight_comment(
    app: AppHandle,
    id: String,
    comment: String,
) -> Result<HighlightResponse, String> {
    let pool = get_pool(&app)?;

    let row = sqlx::query("SELECT * FROM qualitative_source_highlights WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.as_ref())
        .await
        .map_err(|e| format!("分析ソースハイライトの取得に失敗: {}", e))?
        .ok_or_else(|| format!("分析ソースハイライトが見つかりません: {}", id))?;

    let current = parse_qualitative_source_highlight_sqlx(&row)?;
    let comment_value = if comment.is_empty() {
        None
    } else {
        Some(comment)
    };

    sqlx::query("UPDATE qualitative_source_highlights SET comment = ? WHERE id = ?")
        .bind(&comment_value)
        .bind(&id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("分析ソースハイライトのコメント更新に失敗: {}", e))?;

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
    let pool = get_pool(&app)?;

    sqlx::query("DELETE FROM highlights WHERE id = ?")
        .bind(&id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("ハイライトの削除に失敗: {}", e))?;

    Ok(())
}

// ────────────────────────────────────────────────────────────
// delete_qualitative_source_highlight
// ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn delete_qualitative_source_highlight(app: AppHandle, id: String) -> Result<(), String> {
    let pool = get_pool(&app)?;

    sqlx::query("DELETE FROM qualitative_source_highlights WHERE id = ?")
        .bind(&id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("分析ソースハイライトの削除に失敗: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn assign_code_to_source_highlight(
    app: AppHandle,
    highlight_id: String,
    code_id: String,
) -> Result<(), String> {
    let pool = get_pool(&app)?;
    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT OR IGNORE INTO source_highlight_codes (id, source_highlight_id, code_id, assigned_at) VALUES (?, ?, ?, datetime('now'))",
    )
    .bind(&id)
    .bind(&highlight_id)
    .bind(&code_id)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("分析ソースハイライトへのコード割り当てに失敗: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn remove_code_from_source_highlight(
    app: AppHandle,
    highlight_id: String,
    code_id: String,
) -> Result<(), String> {
    let pool = get_pool(&app)?;
    sqlx::query("DELETE FROM source_highlight_codes WHERE source_highlight_id = ? AND code_id = ?")
        .bind(&highlight_id)
        .bind(&code_id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("分析ソースハイライトのコード割り当て解除に失敗: {}", e))?;
    Ok(())
}
