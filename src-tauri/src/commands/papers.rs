// src-tauri/src/commands/papers.rs
// Stellar — 論文 CRUD コマンド
// フロントエンドから invoke() で呼び出される論文管理コマンド群

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_sql::{DbInstances, DbPool};

/// 論文作成時の入力データ
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePaperInput {
    pub title: String,
    pub authors: Vec<String>,
    pub year: Option<i32>,
    pub journal: Option<String>,
    pub volume: Option<String>,
    pub issue: Option<String>,
    pub pages: Option<String>,
    pub doi: Option<String>,
    pub url: Option<String>,
    pub r#abstract: Option<String>,
    pub pdf_path: Option<String>,
    pub tags: Vec<String>,
}

/// 論文更新時の入力データ
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePaperInput {
    pub title: Option<String>,
    pub authors: Option<Vec<String>>,
    pub year: Option<i32>,
    pub journal: Option<String>,
    pub volume: Option<String>,
    pub issue: Option<String>,
    pub pages: Option<String>,
    pub doi: Option<String>,
    pub url: Option<String>,
    pub r#abstract: Option<String>,
    pub pdf_path: Option<String>,
    pub tags: Option<Vec<String>>,
}

/// フロントエンドに返す論文データ
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaperResponse {
    pub id: String,
    pub title: String,
    pub authors: Vec<String>,
    pub year: Option<i32>,
    pub journal: Option<String>,
    pub volume: Option<String>,
    pub issue: Option<String>,
    pub pages: Option<String>,
    pub doi: Option<String>,
    pub url: Option<String>,
    pub r#abstract: Option<String>,
    pub pdf_path: Option<String>,
    pub tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
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

/// 論文を新規作成する
#[tauri::command]
pub async fn create_paper(
    app: AppHandle,
    input: CreatePaperInput,
) -> Result<PaperResponse, String> {
    let db = get_db(&app).await?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let authors_json = serde_json::to_string(&input.authors).map_err(|e| e.to_string())?;
    let tags_json = serde_json::to_string(&input.tags).map_err(|e| e.to_string())?;

    db.execute(
        "INSERT INTO papers (id, title, authors, year, journal, volume, issue, pages, doi, url, abstract, pdf_path, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        vec![
            serde_json::Value::String(id.clone()),
            serde_json::Value::String(input.title.clone()),
            serde_json::Value::String(authors_json),
            input.year.map_or(serde_json::Value::Null, |y| serde_json::Value::Number(y.into())),
            input.journal.clone().map_or(serde_json::Value::Null, serde_json::Value::String),
            input.volume.clone().map_or(serde_json::Value::Null, serde_json::Value::String),
            input.issue.clone().map_or(serde_json::Value::Null, serde_json::Value::String),
            input.pages.clone().map_or(serde_json::Value::Null, serde_json::Value::String),
            input.doi.clone().map_or(serde_json::Value::Null, serde_json::Value::String),
            input.url.clone().map_or(serde_json::Value::Null, serde_json::Value::String),
            input.r#abstract.clone().map_or(serde_json::Value::Null, serde_json::Value::String),
            input.pdf_path.clone().map_or(serde_json::Value::Null, serde_json::Value::String),
            serde_json::Value::String(tags_json),
            serde_json::Value::String(now.clone()),
            serde_json::Value::String(now.clone()),
        ],
    )
    .await
    .map_err(|e| format!("論文の作成に失敗しました: {}", e))?;

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

/// すべての論文を取得する
#[tauri::command]
pub async fn get_all_papers(app: AppHandle) -> Result<Vec<PaperResponse>, String> {
    let db = get_db(&app).await?;
    let rows: Vec<serde_json::Value> = db
        .select("SELECT * FROM papers ORDER BY created_at DESC", vec![])
        .await
        .map_err(|e| format!("論文一覧の取得に失敗しました: {}", e))?;

    rows.iter()
        .map(|row| parse_paper_row(row))
        .collect::<Result<Vec<_>, _>>()
}

/// 指定IDの論文を取得する
#[tauri::command]
pub async fn get_paper(app: AppHandle, id: String) -> Result<PaperResponse, String> {
    let db = get_db(&app).await?;
    let rows: Vec<serde_json::Value> = db
        .select(
            "SELECT * FROM papers WHERE id = ?",
            vec![serde_json::Value::String(id.clone())],
        )
        .await
        .map_err(|e| format!("論文の取得に失敗しました: {}", e))?;

    rows.first()
        .ok_or_else(|| format!("論文が見つかりません: {}", id))
        .and_then(parse_paper_row)
}

/// 論文を更新する
#[tauri::command]
pub async fn update_paper(
    app: AppHandle,
    id: String,
    input: UpdatePaperInput,
) -> Result<PaperResponse, String> {
    let db = get_db(&app).await?;
    let now = chrono::Utc::now().to_rfc3339();

    // 現在の論文データを取得
    let current = get_paper(app.clone(), id.clone()).await?;

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

    db.execute(
        "UPDATE papers SET title=?, authors=?, year=?, journal=?, volume=?, issue=?, pages=?, doi=?, url=?, abstract=?, pdf_path=?, tags=?, updated_at=? WHERE id=?",
        vec![
            serde_json::Value::String(title.clone()),
            serde_json::Value::String(authors_json),
            year.map_or(serde_json::Value::Null, |y| serde_json::Value::Number(y.into())),
            journal.clone().map_or(serde_json::Value::Null, serde_json::Value::String),
            volume.clone().map_or(serde_json::Value::Null, serde_json::Value::String),
            issue.clone().map_or(serde_json::Value::Null, serde_json::Value::String),
            pages.clone().map_or(serde_json::Value::Null, serde_json::Value::String),
            doi.clone().map_or(serde_json::Value::Null, serde_json::Value::String),
            url.clone().map_or(serde_json::Value::Null, serde_json::Value::String),
            r#abstract.clone().map_or(serde_json::Value::Null, serde_json::Value::String),
            pdf_path.clone().map_or(serde_json::Value::Null, serde_json::Value::String),
            serde_json::Value::String(tags_json),
            serde_json::Value::String(now.clone()),
            serde_json::Value::String(id.clone()),
        ],
    )
    .await
    .map_err(|e| format!("論文の更新に失敗しました: {}", e))?;

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

/// 論文を削除する（関連するハイライト・リンクもカスケード削除される）
#[tauri::command]
pub async fn delete_paper(app: AppHandle, id: String) -> Result<(), String> {
    let db = get_db(&app).await?;
    db.execute(
        "DELETE FROM papers WHERE id = ?",
        vec![serde_json::Value::String(id.clone())],
    )
    .await
    .map_err(|e| format!("論文の削除に失敗しました: {}", e))?;

    Ok(())
}

/// DB行データを PaperResponse に変換するヘルパー関数
fn parse_paper_row(row: &serde_json::Value) -> Result<PaperResponse, String> {
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

    let authors: Vec<String> = serde_json::from_str(&get_str("authors")).unwrap_or_default();
    let tags: Vec<String> = serde_json::from_str(&get_str("tags")).unwrap_or_default();

    Ok(PaperResponse {
        id: get_str("id"),
        title: get_str("title"),
        authors,
        year: row.get("year").and_then(|v| v.as_i64()).map(|v| v as i32),
        journal: get_opt_str("journal"),
        volume: get_opt_str("volume"),
        issue: get_opt_str("issue"),
        pages: get_opt_str("pages"),
        doi: get_opt_str("doi"),
        url: get_opt_str("url"),
        r#abstract: get_opt_str("abstract"),
        pdf_path: get_opt_str("pdf_path"),
        tags,
        created_at: get_str("created_at"),
        updated_at: get_str("updated_at"),
    })
}
