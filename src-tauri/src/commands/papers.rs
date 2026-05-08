// src-tauri/src/commands/papers.rs
// Stellar — 論文 CRUD コマンド
// フロントエンドから invoke() で呼び出される論文管理コマンド群
// ページネーション・フィルタ・バックリンク付き詳細・PDF関連付け・タグ集計を提供

use crate::db::models::*;
use crate::db::get_pool;
use crate::commands::links::fetch_backlinks_for;
use sqlx::Row;
use tauri::AppHandle;

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
    let pool = get_pool(&app);
    let page = page.unwrap_or(1).max(1);
    let limit = limit.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * limit;

    // WHERE 句の動的構築
    // sqlx はバインドパラメータの順番が固定なので、条件と値を順番に記録する
    let mut conditions: Vec<String> = Vec::new();

    if tag.is_some() {
        conditions.push("tags LIKE ?".to_string());
    }
    if year.is_some() {
        conditions.push("year = ?".to_string());
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
    let mut count_query = sqlx::query(&count_sql);
    if let Some(ref tag_name) = tag {
        count_query = count_query.bind(format!("%\"{}\"%", tag_name));
    }
    if let Some(y) = year {
        count_query = count_query.bind(y);
    }

    let count_row = count_query
        .fetch_one(pool.as_ref())
        .await
        .map_err(|e| format!("論文件数の取得に失敗: {}", e))?;
    let total: i64 = count_row.try_get("cnt").unwrap_or(0);
    let total = total as u32;

    // ページネーション付きで論文一覧を取得
    let select_sql = format!(
        "SELECT * FROM papers {} ORDER BY updated_at DESC LIMIT ? OFFSET ?",
        where_clause
    );
    let mut select_query = sqlx::query(&select_sql);
    if let Some(ref tag_name) = tag {
        select_query = select_query.bind(format!("%\"{}\"%", tag_name));
    }
    if let Some(y) = year {
        select_query = select_query.bind(y);
    }
    select_query = select_query.bind(limit as i64).bind(offset as i64);

    let rows = select_query
        .fetch_all(pool.as_ref())
        .await
        .map_err(|e| format!("論文一覧の取得に失敗: {}", e))?;

    let items = rows
        .iter()
        .map(parse_paper_sqlx)
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
    let pool = get_pool(&app);

    // 論文本体を取得
    let row = sqlx::query("SELECT * FROM papers WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.as_ref())
        .await
        .map_err(|e| format!("論文の取得に失敗: {}", e))?
        .ok_or_else(|| format!("論文が見つかりません: {}", id))?;

    let paper = parse_paper_sqlx(&row)?;

    // バックリンク（この論文を source/target として参照するリンク）
    let backlinks = fetch_backlinks_for(pool.as_ref(), "paper", &id).await?;

    // ハイライト数を取得
    let hl_row = sqlx::query("SELECT COUNT(*) as cnt FROM highlights WHERE paper_id = ?")
        .bind(&id)
        .fetch_one(pool.as_ref())
        .await
        .map_err(|e| format!("ハイライト数の取得に失敗: {}", e))?;
    let highlight_count: i64 = hl_row.try_get("cnt").unwrap_or(0);

    // ノート数を取得
    let note_row = sqlx::query("SELECT COUNT(*) as cnt FROM notes WHERE paper_id = ?")
        .bind(&id)
        .fetch_one(pool.as_ref())
        .await
        .map_err(|e| format!("ノート数の取得に失敗: {}", e))?;
    let note_count: i64 = note_row.try_get("cnt").unwrap_or(0);

    Ok(PaperWithLinks {
        paper,
        backlinks,
        highlight_count: highlight_count as u32,
        note_count: note_count as u32,
    })
}

// ────────────────────────────────────────────────────────────
// create_paper — 論文を新規作成する
// ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn create_paper(app: AppHandle, input: CreatePaperDto) -> Result<PaperResponse, String> {
    let pool = get_pool(&app);
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let authors_json = serde_json::to_string(&input.authors).map_err(|e| e.to_string())?;
    let tags_json = serde_json::to_string(&input.tags).map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO papers (id, title, authors, year, journal, volume, issue, pages, doi, url, abstract, pdf_path, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&input.title)
    .bind(&authors_json)
    .bind(input.year)
    .bind(&input.journal)
    .bind(&input.volume)
    .bind(&input.issue)
    .bind(&input.pages)
    .bind(&input.doi)
    .bind(&input.url)
    .bind(&input.r#abstract)
    .bind(&input.pdf_path)
    .bind(&tags_json)
    .bind(&now)
    .bind(&now)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("論文の作成に失敗: {}", e))?;

    Ok(PaperResponse {
        id,
        title: input.title,
        authors: input.authors,
        year: input.year,
        journal: input.journal,
        volume: input.volume,
        issue: input.issue,
        pages: input.pages,
        doi: input.doi,
        url: input.url,
        r#abstract: input.r#abstract,
        pdf_path: input.pdf_path,
        tags: input.tags,
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
    input: UpdatePaperDto,
) -> Result<PaperResponse, String> {
    let pool = get_pool(&app);
    let now = chrono::Utc::now().to_rfc3339();

    // 現在の論文データを取得
    let row = sqlx::query("SELECT * FROM papers WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.as_ref())
        .await
        .map_err(|e| format!("論文の取得に失敗: {}", e))?
        .ok_or_else(|| format!("論文が見つかりません: {}", id))?;

    let current = parse_paper_sqlx(&row)?;

    // DTO の Some フィールドのみ更新、None なら既存値を維持
    let title = input.title.unwrap_or(current.title);
    let authors = input.authors.unwrap_or(current.authors);
    let year = input.year.or(current.year);
    let journal = input.journal.or(current.journal);
    let volume = input.volume.or(current.volume);
    let issue = input.issue.or(current.issue);
    let pages = input.pages.or(current.pages);
    let doi = input.doi.or(current.doi);
    let url = input.url.or(current.url);
    let r#abstract = input.r#abstract.or(current.r#abstract);
    let pdf_path = input.pdf_path.or(current.pdf_path);
    let tags = input.tags.unwrap_or(current.tags);

    let authors_json = serde_json::to_string(&authors).map_err(|e| e.to_string())?;
    let tags_json = serde_json::to_string(&tags).map_err(|e| e.to_string())?;

    sqlx::query(
        "UPDATE papers SET title=?, authors=?, year=?, journal=?, volume=?, issue=?, pages=?, doi=?, url=?, abstract=?, pdf_path=?, tags=?, updated_at=? WHERE id=?",
    )
    .bind(&title)
    .bind(&authors_json)
    .bind(year)
    .bind(&journal)
    .bind(&volume)
    .bind(&issue)
    .bind(&pages)
    .bind(&doi)
    .bind(&url)
    .bind(&r#abstract)
    .bind(&pdf_path)
    .bind(&tags_json)
    .bind(&now)
    .bind(&id)
    .execute(pool.as_ref())
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
    let pool = get_pool(&app);

    // リンクテーブルから手動削除
    sqlx::query(
        "DELETE FROM links WHERE (source_type = 'paper' AND source_id = ?) OR (target_type = 'paper' AND target_id = ?)",
    )
    .bind(&id)
    .bind(&id)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("関連リンクの削除に失敗: {}", e))?;

    // 論文を削除（highlights は ON DELETE CASCADE）
    sqlx::query("DELETE FROM papers WHERE id = ?")
        .bind(&id)
        .execute(pool.as_ref())
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
    let pool = get_pool(&app);
    let now = chrono::Utc::now().to_rfc3339();

    // 論文が存在することを確認
    let row = sqlx::query("SELECT * FROM papers WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.as_ref())
        .await
        .map_err(|e| format!("論文の取得に失敗: {}", e))?
        .ok_or_else(|| format!("論文が見つかりません: {}", id))?;

    let current = parse_paper_sqlx(&row)?;

    // PDFパスを更新
    sqlx::query("UPDATE papers SET pdf_path = ?, updated_at = ? WHERE id = ?")
        .bind(&pdf_path)
        .bind(&now)
        .bind(&id)
        .execute(pool.as_ref())
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
// extract_metadata_from_pdf — PDFファイルからメタデータを抽出する
// ────────────────────────────────────────────────────────────

/// PDFファイルパスを受け取り、Document Info Dictionaryからメタデータを抽出して返す。
/// フロントエンドの AddPaperModal から呼び出される。
/// 抽出に失敗した場合はファイル名からタイトルを推定し、部分的なメタデータを返す。
#[tauri::command]
pub async fn extract_metadata_from_pdf(
    pdf_path: String,
) -> Result<serde_json::Value, String> {
    use crate::utils::pdf::{is_valid_pdf_path, extract_title_from_filename, extract_metadata_from_file};

    if !is_valid_pdf_path(&pdf_path) {
        return Err("指定されたファイルはPDFではありません".to_string());
    }

    // ファイルの存在確認
    if !std::path::Path::new(&pdf_path).exists() {
        return Err(format!("ファイルが見つかりません: {}", pdf_path));
    }

    let meta = extract_metadata_from_file(&pdf_path);

    // タイトルが取得できなければファイル名から推定
    let title = meta.title.unwrap_or_else(|| extract_title_from_filename(&pdf_path));

    let result = serde_json::json!({
        "title": title,
        "authors": meta.authors,
        "year": meta.year,
        "abstract": meta.subject,
        "pdfPath": pdf_path,
        "tags": []
    });

    Ok(result)
}

// ────────────────────────────────────────────────────────────
// get_all_tags — タグ一覧取得（全論文のタグを集計して出現回数順に返す）
// ────────────────────────────────────────────────────────────

/// 論文の tags カラムは JSON 配列文字列なので json_each() で展開・集計する
#[tauri::command]
pub async fn get_all_tags(app: AppHandle) -> Result<Vec<TagCount>, String> {
    let pool = get_pool(&app);

    let rows = sqlx::query(
        "SELECT j.value AS name, COUNT(*) AS count
         FROM papers, json_each(papers.tags) AS j
         GROUP BY j.value
         ORDER BY count DESC, name ASC",
    )
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("タグ一覧の取得に失敗: {}", e))?;

    let tags = rows
        .iter()
        .map(|row| {
            let name: String = row.try_get("name").unwrap_or_default();
            let count: i64 = row.try_get("count").unwrap_or(0);
            TagCount {
                name,
                count: count as u32,
            }
        })
        .collect();

    Ok(tags)
}
