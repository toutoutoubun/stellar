// src-tauri/src/commands/notes.rs
// Stellar — ノート CRUD コマンド
// Markdown ノートの作成・取得・更新・削除を管理する
// ページネーション・NoteDetail（バックリンク+アウトライン）・ハイライトからの自動生成を提供

use crate::db::models::{
    extract_outlines, parse_link_with_source, parse_note_row, val_i64, val_opt_str, val_str,
    CreateNoteDto, LinkWithSource, NoteDetail, NoteResponse, PaginatedResult, UpdateNoteDto,
};
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
    let db = get_db(&app).await?;
    let page = page.unwrap_or(1).max(1);
    let limit = limit.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * limit;

    let mut conditions: Vec<String> = Vec::new();
    let mut params: Vec<Value> = Vec::new();

    if let Some(ref pid) = paper_id {
        conditions.push("paper_id = ?".to_string());
        params.push(Value::String(pid.clone()));
    }
    if let Some(ref tag_name) = tag {
        conditions.push("tags LIKE ?".to_string());
        params.push(Value::String(format!("%\"{}\"%", tag_name)));
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    // 総件数
    let count_sql = format!("SELECT COUNT(*) as cnt FROM notes {}", where_clause);
    let count_rows: Vec<Value> = db
        .select(&count_sql, params.clone())
        .await
        .map_err(|e| format!("ノート件数の取得に失敗: {}", e))?;

    let total = count_rows
        .first()
        .and_then(|r| val_i64(r, "cnt"))
        .unwrap_or(0) as u32;

    // ページネーション付きで取得
    let select_sql = format!(
        "SELECT * FROM notes {} ORDER BY updated_at DESC LIMIT ? OFFSET ?",
        where_clause
    );
    params.push(Value::Number(limit.into()));
    params.push(Value::Number(offset.into()));

    let rows: Vec<Value> = db
        .select(&select_sql, params)
        .await
        .map_err(|e| format!("ノート一覧の取得に失敗: {}", e))?;

    let items = rows
        .iter()
        .map(parse_note_row)
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
    let db = get_db(&app).await?;

    // ノート本体を取得
    let rows: Vec<Value> = db
        .select(
            "SELECT * FROM notes WHERE id = ?",
            vec![Value::String(id.clone())],
        )
        .await
        .map_err(|e| format!("ノートの取得に失敗: {}", e))?;

    let note = rows
        .first()
        .ok_or_else(|| format!("ノートが見つかりません: {}", id))
        .and_then(parse_note_row)?;

    // バックリンク
    let backlinks = fetch_backlinks_for(&db, "note", &id).await?;

    // Markdown コンテンツからアウトライン（見出し一覧）を抽出
    let outlines = extract_outlines(&note.content);

    // 紐づき論文のタイトルを取得
    let paper_title = if let Some(ref pid) = note.paper_id {
        let paper_rows: Vec<Value> = db
            .select(
                "SELECT title FROM papers WHERE id = ?",
                vec![Value::String(pid.clone())],
            )
            .await
            .map_err(|e| format!("論文タイトルの取得に失敗: {}", e))?;

        paper_rows
            .first()
            .and_then(|r| r.get("title"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
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
pub async fn create_note(app: AppHandle, dto: CreateNoteDto) -> Result<NoteResponse, String> {
    let db = get_db(&app).await?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let tags_json = serde_json::to_string(&dto.tags).map_err(|e| e.to_string())?;

    db.execute(
        "INSERT INTO notes (id, title, content, paper_id, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        vec![
            Value::String(id.clone()),
            Value::String(dto.title.clone()),
            Value::String(dto.content.clone()),
            dto.paper_id.clone().map_or(Value::Null, Value::String),
            Value::String(tags_json),
            Value::String(now.clone()),
            Value::String(now.clone()),
        ],
    )
    .await
    .map_err(|e| format!("ノートの作成に失敗: {}", e))?;

    Ok(NoteResponse {
        id,
        title: dto.title,
        content: dto.content,
        paper_id: dto.paper_id,
        tags: dto.tags,
        created_at: now.clone(),
        updated_at: now,
    })
}

// ────────────────────────────────────────────────────────────
// update_note — ノートを更新する（content 変更時は FTS5 トリガーで自動更新）
// ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn update_note(
    app: AppHandle,
    id: String,
    dto: UpdateNoteDto,
) -> Result<NoteResponse, String> {
    let db = get_db(&app).await?;
    let now = chrono::Utc::now().to_rfc3339();

    // 現在のノートデータを取得
    let rows: Vec<Value> = db
        .select(
            "SELECT * FROM notes WHERE id = ?",
            vec![Value::String(id.clone())],
        )
        .await
        .map_err(|e| format!("ノートの取得に失敗: {}", e))?;

    let current = rows
        .first()
        .ok_or_else(|| format!("ノートが見つかりません: {}", id))
        .and_then(parse_note_row)?;

    let title = dto.title.unwrap_or(current.title);
    let content = dto.content.unwrap_or(current.content);
    // paper_id は二重 Option: Some(Some(x))=変更, Some(None)=解除, None=変更なし
    let paper_id = match dto.paper_id {
        Some(new_val) => new_val,
        None => current.paper_id,
    };
    let tags = dto.tags.unwrap_or(current.tags);
    let tags_json = serde_json::to_string(&tags).map_err(|e| e.to_string())?;

    db.execute(
        "UPDATE notes SET title=?, content=?, paper_id=?, tags=?, updated_at=? WHERE id=?",
        vec![
            Value::String(title.clone()),
            Value::String(content.clone()),
            paper_id.clone().map_or(Value::Null, Value::String),
            Value::String(tags_json),
            Value::String(now.clone()),
            Value::String(id.clone()),
        ],
    )
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
    })
}

// ────────────────────────────────────────────────────────────
// delete_note — ノートを削除する（関連リンクも削除）
// ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn delete_note(app: AppHandle, id: String) -> Result<(), String> {
    let db = get_db(&app).await?;

    // リンクテーブルから手動削除
    db.execute(
        "DELETE FROM links WHERE (source_type = 'note' AND source_id = ?) OR (target_type = 'note' AND target_id = ?)",
        vec![Value::String(id.clone()), Value::String(id.clone())],
    )
    .await
    .map_err(|e| format!("関連リンクの削除に失敗: {}", e))?;

    // ノートを削除（FTS5 はトリガーで自動削除）
    db.execute("DELETE FROM notes WHERE id = ?", vec![Value::String(id)])
        .await
        .map_err(|e| format!("ノートの削除に失敗: {}", e))?;

    Ok(())
}

// ────────────────────────────────────────────────────────────
// create_note_from_highlights — ハイライト群からノートを自動生成する
// ────────────────────────────────────────────────────────────

/// 指定されたハイライトのテキスト・コメントを Markdown テンプレートに変換し、
/// 新規ノートとして保存する。
///
/// 生成される Markdown フォーマット:
/// ```markdown
/// ## ハイライト from [論文タイトル]
///
/// > [ハイライトテキスト] (p.[ページ番号])
///
/// [コメント]
///
/// ---
/// ```
#[tauri::command]
pub async fn create_note_from_highlights(
    app: AppHandle,
    paper_id: String,
    highlight_ids: Vec<String>,
) -> Result<NoteResponse, String> {
    let db = get_db(&app).await?;

    if highlight_ids.is_empty() {
        return Err("ハイライトが指定されていません".to_string());
    }

    // 論文タイトルを取得
    let paper_rows: Vec<Value> = db
        .select(
            "SELECT title FROM papers WHERE id = ?",
            vec![Value::String(paper_id.clone())],
        )
        .await
        .map_err(|e| format!("論文の取得に失敗: {}", e))?;

    let paper_title = paper_rows
        .first()
        .and_then(|r| r.get("title"))
        .and_then(|v| v.as_str())
        .ok_or_else(|| format!("論文が見つかりません: {}", paper_id))?
        .to_string();

    // 指定ハイライトを取得（IN 句を動的構築）
    let placeholders: Vec<String> = highlight_ids.iter().map(|_| "?".to_string()).collect();
    let in_clause = placeholders.join(", ");
    let sql = format!(
        "SELECT * FROM highlights WHERE id IN ({}) AND paper_id = ? ORDER BY page ASC, created_at ASC",
        in_clause
    );

    let mut params: Vec<Value> = highlight_ids
        .iter()
        .map(|hid| Value::String(hid.clone()))
        .collect();
    params.push(Value::String(paper_id.clone()));

    let highlight_rows: Vec<Value> = db
        .select(&sql, params)
        .await
        .map_err(|e| format!("ハイライトの取得に失敗: {}", e))?;

    if highlight_rows.is_empty() {
        return Err("指定されたハイライトが見つかりません".to_string());
    }

    // Markdown テンプレートを構築
    let mut markdown = format!("## ハイライト from {}\n\n", paper_title);

    for row in &highlight_rows {
        let text = row.get("text").and_then(|v| v.as_str()).unwrap_or("");
        let page = row.get("page").and_then(|v| v.as_i64()).unwrap_or(0);
        let comment = row
            .get("comment")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        markdown.push_str(&format!("> {} (p.{})\n\n", text, page));

        if !comment.is_empty() {
            markdown.push_str(&format!("{}\n\n", comment));
        }

        markdown.push_str("---\n\n");
    }

    // 新規ノートとして保存
    let note_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let note_title = format!("{} — ハイライトノート", paper_title);

    db.execute(
        "INSERT INTO notes (id, title, content, paper_id, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        vec![
            Value::String(note_id.clone()),
            Value::String(note_title.clone()),
            Value::String(markdown.clone()),
            Value::String(paper_id.clone()),
            Value::String("[]".to_string()),
            Value::String(now.clone()),
            Value::String(now.clone()),
        ],
    )
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
    })
}

// ────────────────────────────────────────────────────────────
// ヘルパー関数
// ────────────────────────────────────────────────────────────

/// 指定アイテムに対するバックリンク（source_title / target_title 付き）を取得する
async fn fetch_backlinks_for(
    db: &DbPool,
    item_type: &str,
    item_id: &str,
) -> Result<Vec<LinkWithSource>, String> {
    let rows: Vec<Value> = db
        .select(
            "SELECT l.*,
                COALESCE(
                    (SELECT title FROM papers WHERE id = l.source_id AND l.source_type = 'paper'),
                    (SELECT title FROM notes  WHERE id = l.source_id AND l.source_type = 'note'),
                    ''
                ) AS source_title,
                COALESCE(
                    (SELECT title FROM papers WHERE id = l.target_id AND l.target_type = 'paper'),
                    (SELECT title FROM notes  WHERE id = l.target_id AND l.target_type = 'note'),
                    ''
                ) AS target_title
             FROM links l
             WHERE (l.source_type = ? AND l.source_id = ?)
                OR (l.target_type = ? AND l.target_id = ?)
             ORDER BY l.created_at DESC",
            vec![
                Value::String(item_type.to_string()),
                Value::String(item_id.to_string()),
                Value::String(item_type.to_string()),
                Value::String(item_id.to_string()),
            ],
        )
        .await
        .map_err(|e| format!("バックリンクの取得に失敗: {}", e))?;

    rows.iter()
        .map(parse_link_with_source)
        .collect::<Result<Vec<_>, _>>()
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
