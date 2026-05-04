// src-tauri/src/commands/links.rs
// Stellar — リンク CRUD コマンド
// ノート・論文間の双方向リンクを管理する（グラフビューの基盤データ）
// 重複チェック・バックリンク（LinkWithSource）・グラフデータ取得を提供

use crate::db::models::{
    parse_link_with_source, val_i64, val_opt_str, val_str, val_string_vec, CreateLinkDto,
    GraphData, GraphEdge, GraphNode, LinkResponse, LinkWithSource,
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
// create_link — 双方向リンクの作成（重複チェック付き）
// ────────────────────────────────────────────────────────────

/// 双方向リンクを新規作成する。
/// 同一ペアの順方向（A→B）・逆方向（B→A）の両方をチェックし、
/// 既に存在する場合はエラーを返す。自己リンクも防止する。
#[tauri::command]
pub async fn create_link(app: AppHandle, dto: CreateLinkDto) -> Result<LinkResponse, String> {
    let db = get_db(&app).await?;

    // 自己リンクの防止
    if dto.source_type == dto.target_type && dto.source_id == dto.target_id {
        return Err("自分自身へのリンクは作成できません".to_string());
    }

    // 重複チェック: 順方向（A→B）と逆方向（B→A）の両方を確認
    let existing: Vec<Value> = db
        .select(
            "SELECT id FROM links
             WHERE (source_type = ? AND source_id = ? AND target_type = ? AND target_id = ?)
                OR (source_type = ? AND source_id = ? AND target_type = ? AND target_id = ?)",
            vec![
                // 順方向チェック
                Value::String(dto.source_type.clone()),
                Value::String(dto.source_id.clone()),
                Value::String(dto.target_type.clone()),
                Value::String(dto.target_id.clone()),
                // 逆方向チェック
                Value::String(dto.target_type.clone()),
                Value::String(dto.target_id.clone()),
                Value::String(dto.source_type.clone()),
                Value::String(dto.source_id.clone()),
            ],
        )
        .await
        .map_err(|e| format!("リンクの重複チェックに失敗: {}", e))?;

    if !existing.is_empty() {
        return Err("このリンクは既に存在します".to_string());
    }

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    db.execute(
        "INSERT INTO links (id, source_type, source_id, target_type, target_id, context, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        vec![
            Value::String(id.clone()),
            Value::String(dto.source_type.clone()),
            Value::String(dto.source_id.clone()),
            Value::String(dto.target_type.clone()),
            Value::String(dto.target_id.clone()),
            dto.context.clone().map_or(Value::Null, Value::String),
            Value::String(now.clone()),
        ],
    )
    .await
    .map_err(|e| format!("リンクの作成に失敗: {}", e))?;

    Ok(LinkResponse {
        id,
        source_type: dto.source_type,
        source_id: dto.source_id,
        target_type: dto.target_type,
        target_id: dto.target_id,
        context: dto.context,
        created_at: now,
    })
}

// ────────────────────────────────────────────────────────────
// get_backlinks — 特定ノート/論文のバックリンク一覧
// ────────────────────────────────────────────────────────────

/// source または target のいずれかが指定アイテムであるリンクを取得。
/// リンク元・先のタイトルもサブクエリで結合する。
#[tauri::command]
pub async fn get_backlinks(
    app: AppHandle,
    item_type: String,
    item_id: String,
) -> Result<Vec<LinkWithSource>, String> {
    let db = get_db(&app).await?;

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
                Value::String(item_type.clone()),
                Value::String(item_id.clone()),
                Value::String(item_type),
                Value::String(item_id),
            ],
        )
        .await
        .map_err(|e| format!("バックリンクの取得に失敗: {}", e))?;

    rows.iter()
        .map(parse_link_with_source)
        .collect::<Result<Vec<_>, _>>()
}

// ────────────────────────────────────────────────────────────
// delete_link — リンクを削除する
// ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn delete_link(app: AppHandle, id: String) -> Result<(), String> {
    let db = get_db(&app).await?;

    db.execute("DELETE FROM links WHERE id = ?", vec![Value::String(id)])
        .await
        .map_err(|e| format!("リンクの削除に失敗: {}", e))?;

    Ok(())
}

// ────────────────────────────────────────────────────────────
// get_graph_data — グラフビュー用データ取得（全ノード + エッジ）
// ────────────────────────────────────────────────────────────

/// ノード = 全論文 + 全ノート、エッジ = 全リンク。
/// 各ノードにはリンク数（link_count）を含む。
#[tauri::command]
pub async fn get_graph_data(app: AppHandle) -> Result<GraphData, String> {
    let db = get_db(&app).await?;

    // 全論文をノードとして取得
    let paper_rows: Vec<Value> = db
        .select(
            "SELECT id, title, tags FROM papers ORDER BY title ASC",
            vec![],
        )
        .await
        .map_err(|e| format!("論文ノードの取得に失敗: {}", e))?;

    // 全ノートをノードとして取得
    let note_rows: Vec<Value> = db
        .select(
            "SELECT id, title, tags FROM notes ORDER BY title ASC",
            vec![],
        )
        .await
        .map_err(|e| format!("ノートノードの取得に失敗: {}", e))?;

    // 全リンクをエッジとして取得
    let link_rows: Vec<Value> = db
        .select(
            "SELECT id, source_type, source_id, target_type, target_id FROM links",
            vec![],
        )
        .await
        .map_err(|e| format!("リンクエッジの取得に失敗: {}", e))?;

    // 各ノードのリンク数を計算するためのカウンタ
    let mut link_counts: std::collections::HashMap<String, u32> = std::collections::HashMap::new();

    let edges: Vec<GraphEdge> = link_rows
        .iter()
        .filter_map(|row| {
            let id = row.get("id")?.as_str()?.to_string();
            let source_id = row.get("source_id")?.as_str()?.to_string();
            let target_id = row.get("target_id")?.as_str()?.to_string();

            *link_counts.entry(source_id.clone()).or_insert(0) += 1;
            *link_counts.entry(target_id.clone()).or_insert(0) += 1;

            Some(GraphEdge {
                id,
                source: source_id,
                target: target_id,
            })
        })
        .collect();

    // 論文ノードを構築
    let mut nodes: Vec<GraphNode> = paper_rows
        .iter()
        .filter_map(|row| {
            let id = row.get("id")?.as_str()?.to_string();
            let label = row.get("title")?.as_str()?.to_string();
            let tags = val_string_vec(row, "tags");
            let link_count = link_counts.get(&id).copied().unwrap_or(0);

            Some(GraphNode {
                id,
                label,
                node_type: "paper".to_string(),
                tags,
                link_count,
            })
        })
        .collect();

    // ノートノードを追加
    let note_nodes: Vec<GraphNode> = note_rows
        .iter()
        .filter_map(|row| {
            let id = row.get("id")?.as_str()?.to_string();
            let label = row.get("title")?.as_str()?.to_string();
            let tags = val_string_vec(row, "tags");
            let link_count = link_counts.get(&id).copied().unwrap_or(0);

            Some(GraphNode {
                id,
                label,
                node_type: "note".to_string(),
                tags,
                link_count,
            })
        })
        .collect();

    nodes.extend(note_nodes);

    Ok(GraphData { nodes, edges })
}
