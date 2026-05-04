// src-tauri/src/commands/notes.rs
// Stellar — ノート CRUD コマンド
// Markdown ノートの作成・取得・更新・削除を管理する

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_sql::{DbInstances, DbPool};

/// ノート作成時の入力データ
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNoteInput {
    pub title: String,
    pub content: String,
    pub paper_id: Option<String>,
    pub tags: Vec<String>,
}

/// ノート更新時の入力データ
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateNoteInput {
    pub title: Option<String>,
    pub content: Option<String>,
    pub paper_id: Option<String>,
    pub tags: Option<Vec<String>>,
}

/// フロントエンドに返すノートデータ
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteResponse {
    pub id: String,
    pub title: String,
    pub content: String,
    pub paper_id: Option<String>,
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

/// ノートを新規作成する
#[tauri::command]
pub async fn create_note(
    app: AppHandle,
    input: CreateNoteInput,
) -> Result<NoteResponse, String> {
    let db = get_db(&app).await?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let tags_json = serde_json::to_string(&input.tags).map_err(|e| e.to_string())?;

    db.execute(
        "INSERT INTO notes (id, title, content, paper_id, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        vec![
            serde_json::Value::String(id.clone()),
            serde_json::Value::String(input.title.clone()),
            serde_json::Value::String(input.content.clone()),
            input.paper_id.clone().map_or(serde_json::Value::Null, serde_json::Value::String),
            serde_json::Value::String(tags_json),
            serde_json::Value::String(now.clone()),
            serde_json::Value::String(now.clone()),
        ],
    )
    .await
    .map_err(|e| format!("ノートの作成に失敗しました: {}", e))?;

    Ok(NoteResponse {
        id,
        title: input.title,
        content: input.content,
        paper_id: input.paper_id,
        tags: input.tags,
        created_at: now.clone(),
        updated_at: now,
    })
}

/// すべてのノートを取得する
#[tauri::command]
pub async fn get_all_notes(app: AppHandle) -> Result<Vec<NoteResponse>, String> {
    let db = get_db(&app).await?;
    let rows: Vec<serde_json::Value> = db
        .select("SELECT * FROM notes ORDER BY updated_at DESC", vec![])
        .await
        .map_err(|e| format!("ノート一覧の取得に失敗しました: {}", e))?;

    rows.iter()
        .map(|row| parse_note_row(row))
        .collect::<Result<Vec<_>, _>>()
}

/// 指定IDのノートを取得する
#[tauri::command]
pub async fn get_note(app: AppHandle, id: String) -> Result<NoteResponse, String> {
    let db = get_db(&app).await?;
    let rows: Vec<serde_json::Value> = db
        .select(
            "SELECT * FROM notes WHERE id = ?",
            vec![serde_json::Value::String(id.clone())],
        )
        .await
        .map_err(|e| format!("ノートの取得に失敗しました: {}", e))?;

    rows.first()
        .ok_or_else(|| format!("ノートが見つかりません: {}", id))
        .and_then(parse_note_row)
}

/// 特定の論文に紐づくノートを取得する
#[tauri::command]
pub async fn get_notes_by_paper(
    app: AppHandle,
    paper_id: String,
) -> Result<Vec<NoteResponse>, String> {
    let db = get_db(&app).await?;
    let rows: Vec<serde_json::Value> = db
        .select(
            "SELECT * FROM notes WHERE paper_id = ? ORDER BY updated_at DESC",
            vec![serde_json::Value::String(paper_id)],
        )
        .await
        .map_err(|e| format!("論文関連ノートの取得に失敗しました: {}", e))?;

    rows.iter()
        .map(|row| parse_note_row(row))
        .collect::<Result<Vec<_>, _>>()
}

/// ノートを更新する
#[tauri::command]
pub async fn update_note(
    app: AppHandle,
    id: String,
    input: UpdateNoteInput,
) -> Result<NoteResponse, String> {
    let db = get_db(&app).await?;
    let now = chrono::Utc::now().to_rfc3339();

    // 現在のノートデータを取得
    let current = get_note(app.clone(), id.clone()).await?;

    let title = input.title.unwrap_or(current.title);
    let content = input.content.unwrap_or(current.content);
    // paper_id は明示的に渡された場合のみ更新（None でも上書き可能にする）
    let paper_id = if input.paper_id.is_some() {
        input.paper_id
    } else {
        current.paper_id
    };
    let tags = input.tags.unwrap_or(current.tags);
    let tags_json = serde_json::to_string(&tags).map_err(|e| e.to_string())?;

    db.execute(
        "UPDATE notes SET title=?, content=?, paper_id=?, tags=?, updated_at=? WHERE id=?",
        vec![
            serde_json::Value::String(title.clone()),
            serde_json::Value::String(content.clone()),
            paper_id.clone().map_or(serde_json::Value::Null, serde_json::Value::String),
            serde_json::Value::String(tags_json),
            serde_json::Value::String(now.clone()),
            serde_json::Value::String(id.clone()),
        ],
    )
    .await
    .map_err(|e| format!("ノートの更新に失敗しました: {}", e))?;

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

/// ノートを削除する（関連するリンクもカスケード削除される）
#[tauri::command]
pub async fn delete_note(app: AppHandle, id: String) -> Result<(), String> {
    let db = get_db(&app).await?;
    db.execute(
        "DELETE FROM notes WHERE id = ?",
        vec![serde_json::Value::String(id)],
    )
    .await
    .map_err(|e| format!("ノートの削除に失敗しました: {}", e))?;

    Ok(())
}

/// DB行データを NoteResponse に変換するヘルパー関数
fn parse_note_row(row: &serde_json::Value) -> Result<NoteResponse, String> {
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

    let tags: Vec<String> = serde_json::from_str(&get_str("tags")).unwrap_or_default();

    Ok(NoteResponse {
        id: get_str("id"),
        title: get_str("title"),
        content: get_str("content"),
        paper_id: get_opt_str("paper_id"),
        tags,
        created_at: get_str("created_at"),
        updated_at: get_str("updated_at"),
    })
}
