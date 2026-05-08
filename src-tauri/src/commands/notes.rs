// src-tauri/src/commands/notes.rs
// Stellar — ノート CRUD コマンド
// Markdown ノートの作成・取得・更新・削除を管理する
// ページネーション・NoteDetail（バックリンク+アウトライン）・ハイライトからの自動生成を提供

use crate::db::models::*;
use crate::db::get_pool;
use crate::commands::links::fetch_backlinks_for;
use sqlx::Row;
use tauri::AppHandle;

// ────────────────────────────────────────────────────────────
// get_notes — ノート一覧取得（ページネーション + フィルタ対応）
// ────────────────────────────────────────────────────────────

/// ノート一覧取得
/// page: 1始まりのページ番号（デフォルト1）
/// limit: 1ページあたりの件数（デフォルト20、最大100）
/// paper_id: 特定の論文に紐づくノートのみ取得
/// tag: タグでフィルタ
#[tauri::command]
pub async fn get_notes(
    app: AppHandle,
    page: Option<u32>,
    limit: Option<u32>,
    paper_id: Option<String>,
    tag: Option<String>,
) -> Result<PaginatedResult<NoteResponse>, String> {
    let pool = get_pool(&app)?;
    let page = page.unwrap_or(1).max(1);
    let limit = limit.unwrap_or(20).clamp(1, 10000);
    let offset = (page - 1) * limit;

    let mut conditions: Vec<String> = Vec::new();

    if paper_id.is_some() {
        conditions.push("paper_id = ?".to_string());
    }
    if tag.is_some() {
        conditions.push("tags LIKE ?".to_string());
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    // 総件数
    let count_sql = format!("SELECT COUNT(*) as cnt FROM notes {}", where_clause);
    let mut count_query = sqlx::query(&count_sql);
    if let Some(ref pid) = paper_id {
        count_query = count_query.bind(pid);
    }
    if let Some(ref tag_name) = tag {
        count_query = count_query.bind(format!("%\"{}\"%", tag_name));
    }

    let count_row = count_query
        .fetch_one(pool.as_ref())
        .await
        .map_err(|e| format!("ノート件数の取得に失敗: {}", e))?;
    let total: i64 = count_row.try_get("cnt").unwrap_or(0);
    let total = total as u32;

    // ページネーション付きで取得
    let select_sql = format!(
        "SELECT * FROM notes {} ORDER BY updated_at DESC LIMIT ? OFFSET ?",
        where_clause
    );
    let mut select_query = sqlx::query(&select_sql);
    if let Some(ref pid) = paper_id {
        select_query = select_query.bind(pid);
    }
    if let Some(ref tag_name) = tag {
        select_query = select_query.bind(format!("%\"{}\"%", tag_name));
    }
    select_query = select_query.bind(limit as i64).bind(offset as i64);

    let rows = select_query
        .fetch_all(pool.as_ref())
        .await
        .map_err(|e| format!("ノート一覧の取得に失敗: {}", e))?;

    let items = rows
        .iter()
        .map(parse_note_sqlx)
        .collect::<Result<Vec<_>, _>>()?;

    let total_pages = if total == 0 {
        0
    } else {
        (total + limit - 1) / limit
    };

    Ok(PaginatedResult {
        items,
        total,
        page,
        limit,
        total_pages,
    })
}

// ────────────────────────────────────────────────────────────
// get_note — ノート詳細取得（バックリンク + アウトライン + 紐づき論文タイトル）
// ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_note(app: AppHandle, id: String) -> Result<NoteDetail, String> {
    let pool = get_pool(&app)?;

    // ノート本体を取得
    let row = sqlx::query("SELECT * FROM notes WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.as_ref())
        .await
        .map_err(|e| format!("ノートの取得に失敗: {}", e))?
        .ok_or_else(|| format!("ノートが見つかりません: {}", id))?;

    let note = parse_note_sqlx(&row)?;

    // バックリンク
    let backlinks = fetch_backlinks_for(pool.as_ref(), "note", &id).await?;

    // Markdown コンテンツからアウトライン（見出し一覧）を抽出
    let outlines = extract_outlines(&note.content);

    // 紐づき論文のタイトルを取得
    let paper_title = if let Some(ref pid) = note.paper_id {
        let paper_row = sqlx::query("SELECT title FROM papers WHERE id = ?")
            .bind(pid)
            .fetch_optional(pool.as_ref())
            .await
            .map_err(|e| format!("論文タイトルの取得に失敗: {}", e))?;

        paper_row.and_then(|r| r.try_get::<String, _>("title").ok())
    } else {
        None
    };

    Ok(NoteDetail {
        note,
        backlinks,
        outlines,
        paper_title,
    })
}

// ────────────────────────────────────────────────────────────
// create_note — ノートを新規作成する
// ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn create_note(app: AppHandle, input: CreateNoteDto) -> Result<NoteResponse, String> {
    let pool = get_pool(&app)?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let tags_json = serde_json::to_string(&input.tags).map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO notes (id, title, content, paper_id, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&input.title)
    .bind(&input.content)
    .bind(&input.paper_id)
    .bind(&tags_json)
    .bind(&now)
    .bind(&now)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("ノートの作成に失敗: {}", e))?;

    Ok(NoteResponse {
        id,
        title: input.title,
        content: input.content,
        paper_id: input.paper_id,
        tags: input.tags,
        created_at: now.clone(),
        updated_at: now,
        // 新規ノートはドラフトではない
        is_draft: Some(0),
        draft_meta: Some("{}".to_string()),
        word_count: Some(0),
        reading_time_min: Some(0),
    })
}

// ────────────────────────────────────────────────────────────
// update_note — ノートを更新する（content 変更時は FTS5 トリガーで自動更新）
// ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn update_note(
    app: AppHandle,
    id: String,
    input: UpdateNoteDto,
) -> Result<NoteResponse, String> {
    let pool = get_pool(&app)?;
    let now = chrono::Utc::now().to_rfc3339();

    // 現在のノートデータを取得
    let row = sqlx::query("SELECT * FROM notes WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.as_ref())
        .await
        .map_err(|e| format!("ノートの取得に失敗: {}", e))?
        .ok_or_else(|| format!("ノートが見つかりません: {}", id))?;

    let current = parse_note_sqlx(&row)?;

    let title = input.title.unwrap_or(current.title);
    let content = input.content.unwrap_or(current.content);
    // paper_id は二重 Option: Some(Some(x))=変更, Some(None)=解除, None=変更なし
    let paper_id = match input.paper_id {
        Some(new_val) => new_val,
        None => current.paper_id,
    };
    let tags = input.tags.unwrap_or(current.tags);
    let tags_json = serde_json::to_string(&tags).map_err(|e| e.to_string())?;

    sqlx::query(
        "UPDATE notes SET title=?, content=?, paper_id=?, tags=?, updated_at=? WHERE id=?",
    )
    .bind(&title)
    .bind(&content)
    .bind(&paper_id)
    .bind(&tags_json)
    .bind(&now)
    .bind(&id)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("ノートの更新に失敗: {}", e))?;

    Ok(NoteResponse {
        id,
        title,
        content,
        paper_id,
        tags,
        created_at: current.created_at,
        updated_at: now,
        // ドラフトフィールドは既存値を維持
        is_draft: current.is_draft,
        draft_meta: current.draft_meta,
        word_count: current.word_count,
        reading_time_min: current.reading_time_min,
    })
}

// ────────────────────────────────────────────────────────────
// delete_note — ノートを削除する（関連リンクも削除）
// ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn delete_note(app: AppHandle, id: String) -> Result<(), String> {
    let pool = get_pool(&app)?;

    // リンクテーブルから手動削除
    sqlx::query(
        "DELETE FROM links WHERE (source_type = 'note' AND source_id = ?) OR (target_type = 'note' AND target_id = ?)",
    )
    .bind(&id)
    .bind(&id)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("関連リンクの削除に失敗: {}", e))?;

    // ノートを削除（FTS5 はトリガーで自動削除）
    sqlx::query("DELETE FROM notes WHERE id = ?")
        .bind(&id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("ノートの削除に失敗: {}", e))?;

    Ok(())
}

// ────────────────────────────────────────────────────────────
// create_note_from_highlights — ハイライト群からノートを自動生成する
// ────────────────────────────────────────────────────────────

/// 指定されたハイライトのテキスト・コメントを Markdown テンプレートに変換し、
/// 新規ノートとして保存する。
#[tauri::command]
pub async fn create_note_from_highlights(
    app: AppHandle,
    paper_id: String,
    highlight_ids: Vec<String>,
) -> Result<NoteResponse, String> {
    let pool = get_pool(&app)?;

    if highlight_ids.is_empty() {
        return Err("ハイライトが指定されていません".to_string());
    }

    // 論文タイトルを取得
    let paper_row = sqlx::query("SELECT title FROM papers WHERE id = ?")
        .bind(&paper_id)
        .fetch_optional(pool.as_ref())
        .await
        .map_err(|e| format!("論文の取得に失敗: {}", e))?
        .ok_or_else(|| format!("論文が見つかりません: {}", paper_id))?;

    let paper_title: String = paper_row
        .try_get("title")
        .map_err(|e| format!("論文タイトルの取得に失敗: {}", e))?;

    // 指定ハイライトを取得（IN 句を動的構築）
    let placeholders: Vec<String> = highlight_ids.iter().map(|_| "?".to_string()).collect();
    let in_clause = placeholders.join(", ");
    let sql = format!(
        "SELECT * FROM highlights WHERE id IN ({}) AND paper_id = ? ORDER BY page ASC, created_at ASC",
        in_clause
    );

    let mut query = sqlx::query(&sql);
    for hid in &highlight_ids {
        query = query.bind(hid);
    }
    query = query.bind(&paper_id);

    let highlight_rows = query
        .fetch_all(pool.as_ref())
        .await
        .map_err(|e| format!("ハイライトの取得に失敗: {}", e))?;

    if highlight_rows.is_empty() {
        return Err("指定されたハイライトが見つかりません".to_string());
    }

    // Markdown テンプレートを構築
    let mut markdown = format!("## ハイライト from {}\n\n", paper_title);

    for row in &highlight_rows {
        let text: String = row.try_get("text").unwrap_or_default();
        let page: i32 = row.try_get("page").unwrap_or(0);
        let comment: Option<String> = row.try_get("comment").unwrap_or(None);

        markdown.push_str(&format!("> {} (p.{})\n\n", text, page));

        if let Some(ref c) = comment {
            if !c.is_empty() {
                markdown.push_str(&format!("{}\n\n", c));
            }
        }

        markdown.push_str("---\n\n");
    }

    // 新規ノートとして保存
    let note_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let note_title = format!("{} — ハイライトノート", paper_title);

    sqlx::query(
        "INSERT INTO notes (id, title, content, paper_id, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&note_id)
    .bind(&note_title)
    .bind(&markdown)
    .bind(&paper_id)
    .bind("[]")
    .bind(&now)
    .bind(&now)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("ノートの作成に失敗: {}", e))?;

    Ok(NoteResponse {
        id: note_id,
        title: note_title,
        content: markdown,
        paper_id: Some(paper_id),
        tags: vec![],
        created_at: now.clone(),
        updated_at: now,
        is_draft: Some(0),
        draft_meta: Some("{}".to_string()),
        word_count: Some(0),
        reading_time_min: Some(0),
    })
}

// ────────────────────────────────────────────────────────────
// テスト
// ────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use crate::db::models::extract_outlines;

    #[test]
    fn test_extract_outlines_basic() {
        let content =
            "# はじめに\n\nこれは導入文です。\n\n## 背景\n\n背景の説明。\n\n### 先行研究\n\n先行研究の紹介。\n\n## 結論\n\n結論です。";
        let outlines = extract_outlines(content);
        assert_eq!(outlines.len(), 4);
        assert_eq!(outlines[0].level, 1);
        assert_eq!(outlines[0].text, "はじめに");
        assert_eq!(outlines[0].line, 0);
        assert_eq!(outlines[1].level, 2);
        assert_eq!(outlines[1].text, "背景");
        assert_eq!(outlines[2].level, 3);
        assert_eq!(outlines[2].text, "先行研究");
        assert_eq!(outlines[3].level, 2);
        assert_eq!(outlines[3].text, "結論");
    }

    #[test]
    fn test_extract_outlines_no_headings() {
        let content = "普通のテキストです。\n\n改行を含むテキスト。";
        let outlines = extract_outlines(content);
        assert!(outlines.is_empty());
    }

    #[test]
    fn test_extract_outlines_invalid_headings() {
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
}
