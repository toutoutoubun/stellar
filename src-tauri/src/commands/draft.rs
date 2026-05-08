// src-tauri/src/commands/draft.rs
// Stellar — 下書きモード コマンド
// 長文執筆のための Draft CRUD・章管理・引用挿入・ワードカウント同期を提供する

use crate::db::get_pool;
use crate::db::models::*;
use sqlx::Row;
use tauri::AppHandle;

// ════════════════════════════════════════════════════════════
// Draft CRUD
// ════════════════════════════════════════════════════════════

/// 下書きノートを新規作成する（is_draft=1）
#[tauri::command]
pub async fn create_draft(app: AppHandle, input: CreateDraftDto) -> Result<DraftResponse, String> {
    let pool = get_pool(&app)?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let tags_json = serde_json::to_string(&input.tags).map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO notes (id, title, content, paper_id, tags, is_draft, draft_meta, word_count, reading_time_min, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, '{}', 0, 0, ?, ?)",
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
    .map_err(|e| format!("下書きの作成に失敗: {}", e))?;

    Ok(DraftResponse {
        id,
        title: input.title,
        content: input.content,
        paper_id: input.paper_id,
        tags: input.tags,
        is_draft: 1,
        draft_meta: "{}".to_string(),
        word_count: 0,
        reading_time_min: 0,
        created_at: now.clone(),
        updated_at: now,
    })
}

/// 下書きノート一覧を取得する（is_draft=1 のノートのみ）
#[tauri::command]
pub async fn get_drafts(app: AppHandle) -> Result<Vec<DraftResponse>, String> {
    let pool = get_pool(&app)?;
    let rows = sqlx::query(
        "SELECT * FROM notes WHERE is_draft = 1 ORDER BY updated_at DESC",
    )
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("下書き一覧の取得に失敗: {}", e))?;

    rows.iter().map(parse_draft).collect()
}

// ════════════════════════════════════════════════════════════
// 章管理（Draft Chapters）
// ════════════════════════════════════════════════════════════

/// 下書きの章一覧を取得する
#[tauri::command]
pub async fn get_draft_chapters(
    app: AppHandle,
    note_id: String,
) -> Result<Vec<DraftChapterResponse>, String> {
    let pool = get_pool(&app)?;
    let rows = sqlx::query(
        "SELECT * FROM draft_chapters WHERE note_id = ? ORDER BY order_index ASC",
    )
    .bind(&note_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("章一覧の取得に失敗: {}", e))?;

    rows.iter().map(parse_draft_chapter).collect()
}

/// 下書きに新しい章を追加する
#[tauri::command]
pub async fn create_draft_chapter(
    app: AppHandle,
    input: CreateDraftChapterDto,
) -> Result<DraftChapterResponse, String> {
    let pool = get_pool(&app)?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO draft_chapters (id, note_id, title, order_index, word_count, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)",
    )
    .bind(&id)
    .bind(&input.note_id)
    .bind(&input.title)
    .bind(input.order_index)
    .bind(&now)
    .bind(&now)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("章の作成に失敗: {}", e))?;

    Ok(DraftChapterResponse {
        id,
        note_id: input.note_id,
        title: input.title,
        order_index: input.order_index,
        word_count: 0,
        created_at: now.clone(),
        updated_at: now,
    })
}

/// 下書きの章を更新する
#[tauri::command]
pub async fn update_draft_chapter(
    app: AppHandle,
    id: String,
    input: UpdateDraftChapterDto,
) -> Result<DraftChapterResponse, String> {
    let pool = get_pool(&app)?;
    let now = chrono::Utc::now().to_rfc3339();

    // 現在のデータを取得
    let row = sqlx::query("SELECT * FROM draft_chapters WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.as_ref())
        .await
        .map_err(|e| format!("章の取得に失敗: {}", e))?
        .ok_or_else(|| format!("章が見つかりません: {}", id))?;

    let current = parse_draft_chapter(&row)?;

    let title = input.title.unwrap_or(current.title);
    let order_index = input.order_index.unwrap_or(current.order_index);
    let word_count = input.word_count.unwrap_or(current.word_count);

    sqlx::query(
        "UPDATE draft_chapters SET title = ?, order_index = ?, word_count = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&title)
    .bind(order_index)
    .bind(word_count)
    .bind(&now)
    .bind(&id)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("章の更新に失敗: {}", e))?;

    Ok(DraftChapterResponse {
        id,
        note_id: current.note_id,
        title,
        order_index,
        word_count,
        created_at: current.created_at,
        updated_at: now,
    })
}

/// 下書きの章を削除する
#[tauri::command]
pub async fn delete_draft_chapter(app: AppHandle, id: String) -> Result<(), String> {
    let pool = get_pool(&app)?;
    sqlx::query("DELETE FROM draft_chapters WHERE id = ?")
        .bind(&id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("章の削除に失敗: {}", e))?;

    Ok(())
}

/// 下書きの章の並び順を変更する
/// chapter_ids: 新しい順序で並んだ章IDの配列
#[tauri::command]
pub async fn reorder_draft_chapters(
    app: AppHandle,
    chapter_ids: Vec<String>,
) -> Result<(), String> {
    let pool = get_pool(&app)?;

    for (idx, chapter_id) in chapter_ids.iter().enumerate() {
        sqlx::query(
            "UPDATE draft_chapters SET order_index = ?, updated_at = datetime('now') WHERE id = ?",
        )
        .bind(idx as i32)
        .bind(chapter_id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("章の並び替えに失敗: {}", e))?;
    }

    Ok(())
}

// ════════════════════════════════════════════════════════════
// 引用管理（Draft Citations）
// ════════════════════════════════════════════════════════════

/// 引用キーを生成する（著者姓 + 出版年）
fn generate_citation_key(authors: &[String], year: Option<i32>) -> String {
    let first_author = authors
        .first()
        .map(|a| {
            if a.contains(',') {
                a.split(',').next().unwrap_or("Unknown").trim().to_string()
            } else {
                a.split_whitespace()
                    .last()
                    .unwrap_or("Unknown")
                    .to_string()
            }
        })
        .unwrap_or_else(|| "Unknown".to_string());

    let year_str = year
        .map(|y| y.to_string())
        .unwrap_or_else(|| "n.d.".to_string());

    format!("{}{}", first_author, year_str)
}

/// APA 7th のインライン引用テキストを生成する
fn format_apa7_inline(authors: &[String], year: Option<i32>) -> String {
    let year_str = year
        .map(|y| y.to_string())
        .unwrap_or_else(|| "n.d.".to_string());

    match authors.len() {
        0 => format!("(Unknown, {})", year_str),
        1 => {
            let surname = extract_surname(&authors[0]);
            format!("({}, {})", surname, year_str)
        }
        2 => {
            let s1 = extract_surname(&authors[0]);
            let s2 = extract_surname(&authors[1]);
            format!("({} & {}, {})", s1, s2, year_str)
        }
        _ => {
            let surname = extract_surname(&authors[0]);
            format!("({} et al., {})", surname, year_str)
        }
    }
}

/// MLA 9th のインライン引用テキストを生成する
fn format_mla9_inline(authors: &[String], page_ref: Option<&str>) -> String {
    let page_part = page_ref
        .map(|p| format!(" {}", p))
        .unwrap_or_default();

    match authors.len() {
        0 => format!("(Unknown{})", page_part),
        1 => {
            let surname = extract_surname(&authors[0]);
            format!("({}{})", surname, page_part)
        }
        2 => {
            let s1 = extract_surname(&authors[0]);
            let s2 = extract_surname(&authors[1]);
            format!("({} and {}{})", s1, s2, page_part)
        }
        _ => {
            let surname = extract_surname(&authors[0]);
            format!("({} et al.{})", surname, page_part)
        }
    }
}

/// Chicago 17th のインライン引用テキスト（Author-Date）を生成する
fn format_chicago17_inline(authors: &[String], year: Option<i32>) -> String {
    let year_str = year
        .map(|y| y.to_string())
        .unwrap_or_else(|| "n.d.".to_string());

    match authors.len() {
        0 => format!("(Unknown {})", year_str),
        1 => {
            let surname = extract_surname(&authors[0]);
            format!("({} {})", surname, year_str)
        }
        2 => {
            let s1 = extract_surname(&authors[0]);
            let s2 = extract_surname(&authors[1]);
            format!("({} and {} {})", s1, s2, year_str)
        }
        3 => {
            let s1 = extract_surname(&authors[0]);
            let s2 = extract_surname(&authors[1]);
            let s3 = extract_surname(&authors[2]);
            format!("({}, {}, and {} {})", s1, s2, s3, year_str)
        }
        _ => {
            let surname = extract_surname(&authors[0]);
            format!("({} et al. {})", surname, year_str)
        }
    }
}

/// 日本語引用スタイルのインライン引用テキストを生成する
fn format_japanese_inline(authors: &[String], year: Option<i32>) -> String {
    let year_str = year
        .map(|y| y.to_string())
        .unwrap_or_else(|| "年不明".to_string());

    match authors.len() {
        0 => format!("(不明, {})", year_str),
        1 => format!("({}, {})", authors[0], year_str),
        2 => format!("({} & {}, {})", authors[0], authors[1], year_str),
        _ => format!("({}ほか, {})", authors[0], year_str),
    }
}

/// 著者名から姓を抽出するヘルパー
fn extract_surname(author: &str) -> String {
    if author.contains(',') {
        author.split(',').next().unwrap_or(author).trim().to_string()
    } else {
        author
            .split_whitespace()
            .last()
            .unwrap_or(author)
            .to_string()
    }
}

/// APA 7th の参考文献テキストを生成する
fn format_apa7_bibliography(
    authors: &[String],
    year: Option<i32>,
    title: &str,
    journal: Option<&str>,
    volume: Option<&str>,
    issue: Option<&str>,
    pages: Option<&str>,
    doi: Option<&str>,
) -> String {
    let mut bib = String::new();

    // 著者
    let author_str = format_apa7_authors(authors);
    bib.push_str(&author_str);

    // 出版年
    let year_str = year
        .map(|y| format!(" ({}). ", y))
        .unwrap_or_else(|| " (n.d.). ".to_string());
    bib.push_str(&year_str);

    // タイトル
    bib.push_str(title);
    bib.push('.');

    // ジャーナル
    if let Some(j) = journal {
        bib.push_str(&format!(" *{}*", j));
        if let Some(v) = volume {
            bib.push_str(&format!(", *{}*", v));
            if let Some(i) = issue {
                bib.push_str(&format!("({})", i));
            }
        }
        if let Some(p) = pages {
            bib.push_str(&format!(", {}", p));
        }
        bib.push('.');
    }

    // DOI
    if let Some(d) = doi {
        bib.push_str(&format!(" https://doi.org/{}", d));
    }

    bib
}

/// APA 7th 参考文献の著者フォーマット
fn format_apa7_authors(authors: &[String]) -> String {
    if authors.is_empty() {
        return "Unknown".to_string();
    }
    if authors.len() == 1 {
        return format_apa7_single_author(&authors[0]);
    }

    let formatted: Vec<String> = authors
        .iter()
        .map(|a| format_apa7_single_author(a))
        .collect();

    if formatted.len() == 2 {
        format!("{}, & {}", formatted[0], formatted[1])
    } else if formatted.len() <= 20 {
        let last_idx = formatted.len() - 1;
        let init = formatted[..last_idx].join(", ");
        format!("{}, & {}", init, formatted[last_idx])
    } else {
        // APA 7: 20著者以上は最初の19名 + ... + 最後の1名
        let first_19 = formatted[..19].join(", ");
        format!("{}, ... {}", first_19, formatted[formatted.len() - 1])
    }
}

/// APA 7th の著者1名分フォーマット: "Last, F. M."
fn format_apa7_single_author(author: &str) -> String {
    if author.contains(',') {
        // 既に "Last, First" 形式
        let parts: Vec<&str> = author.splitn(2, ',').collect();
        let last = parts[0].trim();
        let first = parts.get(1).map(|s| s.trim()).unwrap_or("");
        let initials: String = first
            .split_whitespace()
            .map(|w| format!("{}.", w.chars().next().unwrap_or(' ')))
            .collect::<Vec<_>>()
            .join(" ");
        format!("{}, {}", last, initials)
    } else {
        let parts: Vec<&str> = author.split_whitespace().collect();
        if parts.len() >= 2 {
            let last = parts.last().unwrap();
            let initials: String = parts[..parts.len() - 1]
                .iter()
                .map(|w| format!("{}.", w.chars().next().unwrap_or(' ')))
                .collect::<Vec<_>>()
                .join(" ");
            format!("{}, {}", last, initials)
        } else {
            author.to_string()
        }
    }
}

/// MLA 9th の参考文献テキストを生成する
fn format_mla9_bibliography(
    authors: &[String],
    title: &str,
    journal: Option<&str>,
    volume: Option<&str>,
    issue: Option<&str>,
    pages: Option<&str>,
    year: Option<i32>,
    doi: Option<&str>,
) -> String {
    let mut bib = String::new();

    // 著者
    match authors.len() {
        0 => bib.push_str("Unknown. "),
        1 => {
            let a = format_mla_single_author(&authors[0]);
            bib.push_str(&format!("{}. ", a));
        }
        2 => {
            let a1 = format_mla_single_author(&authors[0]);
            bib.push_str(&format!("{}, and {}. ", a1, authors[1]));
        }
        _ => {
            let a1 = format_mla_single_author(&authors[0]);
            bib.push_str(&format!("{}, et al. ", a1));
        }
    }

    // タイトル
    bib.push_str(&format!("\"{}\"", title));

    // ジャーナル
    if let Some(j) = journal {
        bib.push_str(&format!(". *{}*", j));
        if let Some(v) = volume {
            bib.push_str(&format!(", vol. {}", v));
        }
        if let Some(i) = issue {
            bib.push_str(&format!(", no. {}", i));
        }
        if let Some(y) = year {
            bib.push_str(&format!(", {}", y));
        }
        if let Some(p) = pages {
            bib.push_str(&format!(", pp. {}", p));
        }
    }

    bib.push('.');

    if let Some(d) = doi {
        bib.push_str(&format!(" https://doi.org/{}", d));
    }

    bib
}

/// MLA の著者1名分フォーマット: "Last, First"
fn format_mla_single_author(author: &str) -> String {
    if author.contains(',') {
        author.to_string()
    } else {
        let parts: Vec<&str> = author.split_whitespace().collect();
        if parts.len() >= 2 {
            let last = parts.last().unwrap();
            let first = parts[..parts.len() - 1].join(" ");
            format!("{}, {}", last, first)
        } else {
            author.to_string()
        }
    }
}

/// Chicago 17th の参考文献テキストを生成する
fn format_chicago17_bibliography(
    authors: &[String],
    year: Option<i32>,
    title: &str,
    journal: Option<&str>,
    volume: Option<&str>,
    issue: Option<&str>,
    pages: Option<&str>,
    doi: Option<&str>,
) -> String {
    let mut bib = String::new();

    // 著者
    match authors.len() {
        0 => bib.push_str("Unknown. "),
        1 => {
            let a = format_mla_single_author(&authors[0]);
            bib.push_str(&format!("{}. ", a));
        }
        _ => {
            let first = format_mla_single_author(&authors[0]);
            let rest: Vec<String> = authors[1..].to_vec();
            if rest.len() == 1 {
                bib.push_str(&format!("{}, and {}. ", first, rest[0]));
            } else {
                let all_but_last = rest[..rest.len() - 1].join(", ");
                let last = &rest[rest.len() - 1];
                bib.push_str(&format!("{}, {}, and {}. ", first, all_but_last, last));
            }
        }
    }

    // タイトル
    bib.push_str(&format!("\"{}\"", title));

    // ジャーナル
    if let Some(j) = journal {
        bib.push_str(&format!(". *{}*", j));
        if let Some(v) = volume {
            bib.push_str(&format!(" {}", v));
        }
        if let Some(i) = issue {
            bib.push_str(&format!(", no. {}", i));
        }
        if let Some(y) = year {
            bib.push_str(&format!(" ({})", y));
        }
        if let Some(p) = pages {
            bib.push_str(&format!(": {}", p));
        }
    } else if let Some(y) = year {
        bib.push_str(&format!(". {}", y));
    }

    bib.push('.');

    if let Some(d) = doi {
        bib.push_str(&format!(" https://doi.org/{}", d));
    }

    bib
}

/// 日本語引用スタイルの参考文献テキストを生成する
fn format_japanese_bibliography(
    authors: &[String],
    year: Option<i32>,
    title: &str,
    journal: Option<&str>,
    volume: Option<&str>,
    issue: Option<&str>,
    pages: Option<&str>,
) -> String {
    let mut bib = String::new();

    // 著者
    if authors.is_empty() {
        bib.push_str("著者不明");
    } else {
        bib.push_str(&authors.join("・"));
    }

    // 出版年
    if let Some(y) = year {
        bib.push_str(&format!("({})", y));
    }

    // タイトル
    bib.push_str(&format!("「{}」", title));

    // ジャーナル
    if let Some(j) = journal {
        bib.push_str(&format!("『{}』", j));
        if let Some(v) = volume {
            bib.push_str(&format!("{}巻", v));
        }
        if let Some(i) = issue {
            bib.push_str(&format!("{}号", i));
        }
        if let Some(p) = pages {
            bib.push_str(&format!(", {}", p));
        }
    }

    bib.push_str(".");
    bib
}

/// 論文を取得して引用テキストを生成し、draft_citations にアップサートする
#[tauri::command]
pub async fn insert_citation(
    app: AppHandle,
    input: InsertCitationDto,
) -> Result<DraftCitationResponse, String> {
    let pool = get_pool(&app)?;

    // 論文データを取得
    let row = sqlx::query("SELECT * FROM papers WHERE id = ?")
        .bind(&input.paper_id)
        .fetch_optional(pool.as_ref())
        .await
        .map_err(|e| format!("論文の取得に失敗: {}", e))?
        .ok_or_else(|| format!("論文が見つかりません: {}", input.paper_id))?;

    let paper = parse_paper_sqlx(&row)?;

    // citation_key を生成
    let citation_key = generate_citation_key(&paper.authors, paper.year);

    // スタイル別にインライン引用と参考文献テキストを生成
    let (inline_text, bibliography_text) = match input.citation_style.as_str() {
        "apa7" => (
            format_apa7_inline(&paper.authors, paper.year),
            format_apa7_bibliography(
                &paper.authors,
                paper.year,
                &paper.title,
                paper.journal.as_deref(),
                paper.volume.as_deref(),
                paper.issue.as_deref(),
                paper.pages.as_deref(),
                paper.doi.as_deref(),
            ),
        ),
        "mla9" => (
            format_mla9_inline(&paper.authors, input.page_ref.as_deref()),
            format_mla9_bibliography(
                &paper.authors,
                &paper.title,
                paper.journal.as_deref(),
                paper.volume.as_deref(),
                paper.issue.as_deref(),
                paper.pages.as_deref(),
                paper.year,
                paper.doi.as_deref(),
            ),
        ),
        "chicago17" => (
            format_chicago17_inline(&paper.authors, paper.year),
            format_chicago17_bibliography(
                &paper.authors,
                paper.year,
                &paper.title,
                paper.journal.as_deref(),
                paper.volume.as_deref(),
                paper.issue.as_deref(),
                paper.pages.as_deref(),
                paper.doi.as_deref(),
            ),
        ),
        "japanese" => (
            format_japanese_inline(&paper.authors, paper.year),
            format_japanese_bibliography(
                &paper.authors,
                paper.year,
                &paper.title,
                paper.journal.as_deref(),
                paper.volume.as_deref(),
                paper.issue.as_deref(),
                paper.pages.as_deref(),
            ),
        ),
        _ => {
            return Err(format!(
                "未対応の引用スタイル '{}' — 有効値: apa7, mla9, chicago17, japanese",
                input.citation_style
            ));
        }
    };

    // UPSERT: (note_id, paper_id, page_ref) の一意制約でアップサート
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    // まず既存レコードをチェック
    let existing = if let Some(ref pr) = input.page_ref {
        sqlx::query(
            "SELECT id FROM draft_citations WHERE note_id = ? AND paper_id = ? AND page_ref = ?",
        )
        .bind(&input.note_id)
        .bind(&input.paper_id)
        .bind(pr)
        .fetch_optional(pool.as_ref())
        .await
        .map_err(|e| format!("引用の検索に失敗: {}", e))?
    } else {
        sqlx::query(
            "SELECT id FROM draft_citations WHERE note_id = ? AND paper_id = ? AND page_ref IS NULL",
        )
        .bind(&input.note_id)
        .bind(&input.paper_id)
        .fetch_optional(pool.as_ref())
        .await
        .map_err(|e| format!("引用の検索に失敗: {}", e))?
    };

    let final_id = if let Some(existing_row) = existing {
        // 既存レコードを更新
        let existing_id: String = existing_row.try_get("id").unwrap_or_default();
        sqlx::query(
            "UPDATE draft_citations SET citation_key = ?, citation_style = ?, inline_text = ?, bibliography_text = ? WHERE id = ?",
        )
        .bind(&citation_key)
        .bind(&input.citation_style)
        .bind(&inline_text)
        .bind(&bibliography_text)
        .bind(&existing_id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("引用の更新に失敗: {}", e))?;
        existing_id
    } else {
        // 新規レコードを挿入
        sqlx::query(
            "INSERT INTO draft_citations (id, note_id, paper_id, citation_key, citation_style, inline_text, bibliography_text, page_ref, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&input.note_id)
        .bind(&input.paper_id)
        .bind(&citation_key)
        .bind(&input.citation_style)
        .bind(&inline_text)
        .bind(&bibliography_text)
        .bind(&input.page_ref)
        .bind(&now)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("引用の挿入に失敗: {}", e))?;
        id
    };

    Ok(DraftCitationResponse {
        id: final_id,
        note_id: input.note_id,
        paper_id: input.paper_id,
        citation_key,
        citation_style: input.citation_style,
        inline_text,
        bibliography_text,
        page_ref: input.page_ref,
        created_at: now,
    })
}

/// ノートに紐づく引用一覧を取得する
#[tauri::command]
pub async fn get_citations_for_note(
    app: AppHandle,
    note_id: String,
) -> Result<Vec<DraftCitationResponse>, String> {
    let pool = get_pool(&app)?;
    let rows = sqlx::query(
        "SELECT * FROM draft_citations WHERE note_id = ? ORDER BY created_at ASC",
    )
    .bind(&note_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("引用一覧の取得に失敗: {}", e))?;

    rows.iter().map(parse_draft_citation).collect()
}

/// 引用を削除する
#[tauri::command]
pub async fn delete_citation(app: AppHandle, id: String) -> Result<(), String> {
    let pool = get_pool(&app)?;
    sqlx::query("DELETE FROM draft_citations WHERE id = ?")
        .bind(&id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("引用の削除に失敗: {}", e))?;

    Ok(())
}

/// ノートの全引用から Markdown 参考文献リストを生成する
#[tauri::command]
pub async fn generate_bibliography(
    app: AppHandle,
    note_id: String,
) -> Result<String, String> {
    let pool = get_pool(&app)?;

    // ノートの引用スタイルを draft_meta から取得（デフォルト: apa7）
    let note_row = sqlx::query("SELECT draft_meta FROM notes WHERE id = ?")
        .bind(&note_id)
        .fetch_optional(pool.as_ref())
        .await
        .map_err(|e| format!("ノートの取得に失敗: {}", e))?;

    let _citation_style = note_row
        .and_then(|r| {
            let meta_str: String = r.try_get("draft_meta").unwrap_or_default();
            let meta: serde_json::Value = serde_json::from_str(&meta_str).unwrap_or_default();
            meta.get("citationStyle")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        })
        .unwrap_or_else(|| "apa7".to_string());

    // 引用一覧を取得（citation_key でソート）
    let rows = sqlx::query(
        "SELECT * FROM draft_citations WHERE note_id = ? ORDER BY citation_key ASC",
    )
    .bind(&note_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("引用の取得に失敗: {}", e))?;

    if rows.is_empty() {
        return Ok(String::new());
    }

    let citations: Vec<DraftCitationResponse> = rows
        .iter()
        .map(parse_draft_citation)
        .collect::<Result<Vec<_>, _>>()?;

    // 重複排除（同じ paper_id の引用は1エントリにまとめる）
    let mut seen = std::collections::HashSet::new();
    let mut unique_entries: Vec<&DraftCitationResponse> = Vec::new();
    for cit in &citations {
        if seen.insert(&cit.paper_id) {
            unique_entries.push(cit);
        }
    }

    // Markdown 参考文献リストを構築
    let mut bibliography = String::from("## References\n\n");
    for entry in &unique_entries {
        bibliography.push_str(&format!("- {}\n", entry.bibliography_text));
    }

    Ok(bibliography)
}

// ════════════════════════════════════════════════════════════
// ワードカウント同期
// ════════════════════════════════════════════════════════════

/// ノートの word_count と reading_time_min を更新する
/// 読了時間は「日本語: 500字/分、英語: 200語/分」の加重平均で計算
#[tauri::command]
pub async fn sync_word_count(
    app: AppHandle,
    note_id: String,
    word_count: i32,
) -> Result<(), String> {
    let pool = get_pool(&app)?;

    // 読了時間を計算（大まかな推定: 250語/分）
    let reading_time_min = ((word_count as f64) / 250.0).ceil() as i32;

    sqlx::query(
        "UPDATE notes SET word_count = ?, reading_time_min = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(word_count)
    .bind(reading_time_min)
    .bind(&note_id)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("ワードカウントの同期に失敗: {}", e))?;

    Ok(())
}
