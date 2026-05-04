// src-tauri/src/commands/papers.rs
// Stellar — 論文 CRUD コマンド
// フロントエンドから invoke() で呼び出される論文管理コマンド群
// ページネーション・フィルタ・バックリンク付き詳細・PDF関連付け・タグ集計を提供

use crate::db::models::{
    parse_link_with_source, parse_paper_row, val_i64, val_opt_str, val_str, CreatePaperDto,
    LinkWithSource, PaginatedResult, PaperResponse, PaperWithLinks, TagCount, UpdatePaperDto,
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
// get_papers — 論文一覧取得（ページネーション + フィルタ対応）
// ────────────────────────────────────────────────────────────

/// 論文一覧取得（ページネーション + フィルタ対応）
/// page: 1始まりのページ番号（デフォルト1）
/// limit: 1ページあたりの件数（デフォルト20、最大100）
/// tag: タグでフィルタ（JSON配列内の部分一致）
/// year: 出版年でフィルタ
/// has_pdf: PDF添付済みかどうかでフィルタ
#[tauri::command]
pub async fn get_papers(
    app: AppHandle,
    page: Option<u32>,
    limit: Option<u32>,
    tag: Option<String>,
    year: Option<i32>,
    has_pdf: Option<bool>,
) -> Result<PaginatedResult<PaperResponse>, String> {
    let db = get_db(&app).await?;
    let page = page.unwrap_or(1).max(1);
    let limit = limit.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * limit;

    // WHERE 句の動的構築
    let mut conditions: Vec<String> = Vec::new();
    let mut params: Vec<Value> = Vec::new();

    if let Some(ref tag_name) = tag {
        conditions.push("tags LIKE ?".to_string());
        params.push(Value::String(format!("%\"{}\"%", tag_name)));
    }
    if let Some(y) = year {
        conditions.push("year = ?".to_string());
        params.push(Value::Number(y.into()));
    }
    if let Some(hp) = has_pdf {
        if hp {
            conditions.push("pdf_path IS NOT NULL AND pdf_path != ''".to_string());
        } else {
            conditions.push("(pdf_path IS NULL OR pdf_path = '')".to_string());
        }
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    // 総件数を取得
    let count_sql = format!("SELECT COUNT(*) as cnt FROM papers {}", where_clause);
    let count_rows: Vec<Value> = db
        .select(&count_sql, params.clone())
        .await
        .map_err(|e| format!("論文件数の取得に失敗: {}", e))?;

    let total = count_rows
        .first()
        .and_then(|r| val_i64(r, "cnt"))
        .unwrap_or(0) as u32;

    // ページネーション付きで論文一覧を取得
    let select_sql = format!(
        "SELECT * FROM papers {} ORDER BY updated_at DESC LIMIT ? OFFSET ?",
        where_clause
    );
    params.push(Value::Number(limit.into()));
    params.push(Value::Number(offset.into()));

    let rows: Vec<Value> = db
        .select(&select_sql, params)
        .await
        .map_err(|e| format!("論文一覧の取得に失敗: {}", e))?;

    let items = rows
        .iter()
        .map(parse_paper_row)
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
// get_paper — 論文詳細取得（バックリンク・ハイライト数・ノート数を含む）
// ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_paper(app: AppHandle, id: String) -> Result<PaperWithLinks, String> {
    let db = get_db(&app).await?;

    // 論文本体を取得
    let rows: Vec<Value> = db
        .select(
            "SELECT * FROM papers WHERE id = ?",
            vec![Value::String(id.clone())],
        )
        .await
        .map_err(|e| format!("論文の取得に失敗: {}", e))?;

    let paper = rows
        .first()
        .ok_or_else(|| format!("論文が見つかりません: {}", id))
        .and_then(parse_paper_row)?;

    // バックリンク（この論文を source/target として参照するリンク）
    let backlinks = fetch_backlinks_for(&db, "paper", &id).await?;

    // ハイライト数を取得
    let hl_rows: Vec<Value> = db
        .select(
            "SELECT COUNT(*) as cnt FROM highlights WHERE paper_id = ?",
            vec![Value::String(id.clone())],
        )
        .await
        .map_err(|e| format!("ハイライト数の取得に失敗: {}", e))?;

    let highlight_count = hl_rows.first().and_then(|r| val_i64(r, "cnt")).unwrap_or(0) as u32;

    // ノート数を取得
    let note_rows: Vec<Value> = db
        .select(
            "SELECT COUNT(*) as cnt FROM notes WHERE paper_id = ?",
            vec![Value::String(id)],
        )
        .await
        .map_err(|e| format!("ノート数の取得に失敗: {}", e))?;

    let note_count = note_rows
        .first()
        .and_then(|r| val_i64(r, "cnt"))
        .unwrap_or(0) as u32;

    Ok(PaperWithLinks {
        paper,
        backlinks,
        highlight_count,
        note_count,
    })
}

// ────────────────────────────────────────────────────────────
// create_paper — 論文を新規作成する
// ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn create_paper(app: AppHandle, dto: CreatePaperDto) -> Result<PaperResponse, String> {
    let db = get_db(&app).await?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let authors_json = serde_json::to_string(&dto.authors).map_err(|e| e.to_string())?;
    let tags_json = serde_json::to_string(&dto.tags).map_err(|e| e.to_string())?;

    db.execute(
        "INSERT INTO papers (id, title, authors, year, journal, volume, issue, pages, doi, url, abstract, pdf_path, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        vec![
            Value::String(id.clone()),
            Value::String(dto.title.clone()),
            Value::String(authors_json),
            dto.year.map_or(Value::Null, |y| Value::Number(y.into())),
            opt_val(&dto.journal),
            opt_val(&dto.volume),
            opt_val(&dto.issue),
            opt_val(&dto.pages),
            opt_val(&dto.doi),
            opt_val(&dto.url),
            opt_val(&dto.r#abstract),
            opt_val(&dto.pdf_path),
            Value::String(tags_json),
            Value::String(now.clone()),
            Value::String(now.clone()),
        ],
    )
    .await
    .map_err(|e| format!("論文の作成に失敗: {}", e))?;

    Ok(PaperResponse {
        id,
        title: dto.title,
        authors: dto.authors,
        year: dto.year,
        journal: dto.journal,
        volume: dto.volume,
        issue: dto.issue,
        pages: dto.pages,
        doi: dto.doi,
        url: dto.url,
        r#abstract: dto.r#abstract,
        pdf_path: dto.pdf_path,
        tags: dto.tags,
        created_at: now.clone(),
        updated_at: now,
    })
}

// ────────────────────────────────────────────────────────────
// update_paper — 論文を更新する（パッチ更新）
// ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn update_paper(
    app: AppHandle,
    id: String,
    dto: UpdatePaperDto,
) -> Result<PaperResponse, String> {
    let db = get_db(&app).await?;
    let now = chrono::Utc::now().to_rfc3339();

    // 現在の論文データを取得
    let rows: Vec<Value> = db
        .select(
            "SELECT * FROM papers WHERE id = ?",
            vec![Value::String(id.clone())],
        )
        .await
        .map_err(|e| format!("論文の取得に失敗: {}", e))?;

    let current = rows
        .first()
        .ok_or_else(|| format!("論文が見つかりません: {}", id))
        .and_then(parse_paper_row)?;

    // DTO の Some フィールドのみ更新、None なら既存値を維持
    let title = dto.title.unwrap_or(current.title);
    let authors = dto.authors.unwrap_or(current.authors);
    let year = dto.year.or(current.year);
    let journal = dto.journal.or(current.journal);
    let volume = dto.volume.or(current.volume);
    let issue = dto.issue.or(current.issue);
    let pages = dto.pages.or(current.pages);
    let doi = dto.doi.or(current.doi);
    let url = dto.url.or(current.url);
    let r#abstract = dto.r#abstract.or(current.r#abstract);
    let pdf_path = dto.pdf_path.or(current.pdf_path);
    let tags = dto.tags.unwrap_or(current.tags);

    let authors_json = serde_json::to_string(&authors).map_err(|e| e.to_string())?;
    let tags_json = serde_json::to_string(&tags).map_err(|e| e.to_string())?;

    db.execute(
        "UPDATE papers SET title=?, authors=?, year=?, journal=?, volume=?, issue=?, pages=?, doi=?, url=?, abstract=?, pdf_path=?, tags=?, updated_at=? WHERE id=?",
        vec![
            Value::String(title.clone()),
            Value::String(authors_json),
            year.map_or(Value::Null, |y| Value::Number(y.into())),
            opt_val(&journal),
            opt_val(&volume),
            opt_val(&issue),
            opt_val(&pages),
            opt_val(&doi),
            opt_val(&url),
            opt_val(&r#abstract),
            opt_val(&pdf_path),
            Value::String(tags_json),
            Value::String(now.clone()),
            Value::String(id.clone()),
        ],
    )
    .await
    .map_err(|e| format!("論文の更新に失敗: {}", e))?;

    Ok(PaperResponse {
        id,
        title,
        authors,
        year,
        journal,
        volume,
        issue,
        pages,
        doi,
        url,
        r#abstract,
        pdf_path,
        tags,
        created_at: current.created_at,
        updated_at: now,
    })
}

// ────────────────────────────────────────────────────────────
// delete_paper — 論文を削除する（関連リンクも手動削除）
// ────────────────────────────────────────────────────────────

/// 論文を削除する。highlights は ON DELETE CASCADE で自動削除、
/// links は CASCADE 対象外のため手動削除、notes の paper_id は SET NULL
#[tauri::command]
pub async fn delete_paper(app: AppHandle, id: String) -> Result<(), String> {
    let db = get_db(&app).await?;

    // リンクテーブルから手動削除
    db.execute(
        "DELETE FROM links WHERE (source_type = 'paper' AND source_id = ?) OR (target_type = 'paper' AND target_id = ?)",
        vec![Value::String(id.clone()), Value::String(id.clone())],
    )
    .await
    .map_err(|e| format!("関連リンクの削除に失敗: {}", e))?;

    // 論文を削除（highlights は ON DELETE CASCADE）
    db.execute("DELETE FROM papers WHERE id = ?", vec![Value::String(id)])
        .await
        .map_err(|e| format!("論文の削除に失敗: {}", e))?;

    Ok(())
}

// ────────────────────────────────────────────────────────────
// attach_pdf — PDFパスの更新（PDFを後から論文に関連付ける）
// ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn attach_pdf(
    app: AppHandle,
    id: String,
    pdf_path: String,
) -> Result<PaperResponse, String> {
    let db = get_db(&app).await?;
    let now = chrono::Utc::now().to_rfc3339();

    // 論文が存在することを確認
    let rows: Vec<Value> = db
        .select(
            "SELECT * FROM papers WHERE id = ?",
            vec![Value::String(id.clone())],
        )
        .await
        .map_err(|e| format!("論文の取得に失敗: {}", e))?;

    let current = rows
        .first()
        .ok_or_else(|| format!("論文が見つかりません: {}", id))
        .and_then(parse_paper_row)?;

    // PDFパスを更新
    db.execute(
        "UPDATE papers SET pdf_path = ?, updated_at = ? WHERE id = ?",
        vec![
            Value::String(pdf_path.clone()),
            Value::String(now.clone()),
            Value::String(id.clone()),
        ],
    )
    .await
    .map_err(|e| format!("PDFパスの更新に失敗: {}", e))?;

    Ok(PaperResponse {
        id,
        pdf_path: Some(pdf_path),
        updated_at: now,
        ..current
    })
}

// ────────────────────────────────────────────────────────────
// get_all_tags — タグ一覧取得（全論文のタグを集計して出現回数順に返す）
// ────────────────────────────────────────────────────────────

/// 論文の tags カラムは JSON 配列文字列なので json_each() で展開・集計する
#[tauri::command]
pub async fn get_all_tags(app: AppHandle) -> Result<Vec<TagCount>, String> {
    let db = get_db(&app).await?;

    let rows: Vec<Value> = db
        .select(
            "SELECT j.value AS name, COUNT(*) AS count
             FROM papers, json_each(papers.tags) AS j
             GROUP BY j.value
             ORDER BY count DESC, name ASC",
            vec![],
        )
        .await
        .map_err(|e| format!("タグ一覧の取得に失敗: {}", e))?;

    let tags = rows
        .iter()
        .map(|row| TagCount {
            name: val_str(row, "name"),
            count: val_i64(row, "count").unwrap_or(0) as u32,
        })
        .collect();

    Ok(tags)
}

// ────────────────────────────────────────────────────────────
// ヘルパー関数
// ────────────────────────────────────────────────────────────

/// Option<String> を serde_json::Value に変換する
fn opt_val(opt: &Option<String>) -> Value {
    match opt {
        Some(s) => Value::String(s.clone()),
        None => Value::Null,
    }
}

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
