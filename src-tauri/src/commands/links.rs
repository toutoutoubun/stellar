// src-tauri/src/commands/links.rs
// Stellar — リンク CRUD コマンド
// ノート・論文間の双方向リンクを管理する（グラフビューの基盤データ）
// 重複チェック・バックリンク（LinkWithSource）・グラフデータ取得を提供

use crate::db::models::*;
use crate::db::get_pool;
use sqlx::Row;
use std::collections::{HashMap, HashSet};
use tauri::AppHandle;

// ────────────────────────────────────────────────────────────
// create_link — 双方向リンクの作成（重複チェック付き）
// ────────────────────────────────────────────────────────────

/// 双方向リンクを新規作成する。
/// 同一ペアの順方向（A→B）・逆方向（B→A）の両方をチェックし、
/// 既に存在する場合はエラーを返す。自己リンクも防止する。
#[tauri::command]
pub async fn create_link(
    app: AppHandle,
    input: Option<CreateLinkDto>,
    source_type: Option<String>,
    source_id: Option<String>,
    target_type: Option<String>,
    target_id: Option<String>,
    context: Option<String>,
) -> Result<LinkResponse, String> {
    let pool = get_pool(&app)?;
    let input = match input {
        Some(input) => input,
        None => CreateLinkDto {
            source_type: source_type.ok_or_else(|| "sourceType が指定されていません".to_string())?,
            source_id: source_id.ok_or_else(|| "sourceId が指定されていません".to_string())?,
            target_type: target_type.ok_or_else(|| "targetType が指定されていません".to_string())?,
            target_id: target_id.ok_or_else(|| "targetId が指定されていません".to_string())?,
            context,
        },
    };

    // 自己リンクの防止
    if input.source_type == input.target_type && input.source_id == input.target_id {
        return Err("自分自身へのリンクは作成できません".to_string());
    }

    // 重複チェック: 順方向（A→B）と逆方向（B→A）の両方を確認
    let existing = sqlx::query(
        "SELECT id FROM links
         WHERE (source_type = ? AND source_id = ? AND target_type = ? AND target_id = ?)
            OR (source_type = ? AND source_id = ? AND target_type = ? AND target_id = ?)",
    )
    .bind(&input.source_type)
    .bind(&input.source_id)
    .bind(&input.target_type)
    .bind(&input.target_id)
    .bind(&input.target_type)
    .bind(&input.target_id)
    .bind(&input.source_type)
    .bind(&input.source_id)
    .fetch_optional(pool.as_ref())
    .await
    .map_err(|e| format!("リンクの重複チェックに失敗: {}", e))?;

    if existing.is_some() {
        return Err("このリンクは既に存在します".to_string());
    }

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO links (id, source_type, source_id, target_type, target_id, context, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&input.source_type)
    .bind(&input.source_id)
    .bind(&input.target_type)
    .bind(&input.target_id)
    .bind(&input.context)
    .bind(&now)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("リンクの作成に失敗: {}", e))?;

    Ok(LinkResponse {
        id,
        source_type: input.source_type,
        source_id: input.source_id,
        target_type: input.target_type,
        target_id: input.target_id,
        context: input.context,
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
    let pool = get_pool(&app)?;
    fetch_backlinks_for(pool.as_ref(), &item_type, &item_id).await
}

// ────────────────────────────────────────────────────────────
// delete_link — リンクを削除する
// ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn delete_link(app: AppHandle, id: String) -> Result<(), String> {
    let pool = get_pool(&app)?;

    sqlx::query("DELETE FROM links WHERE id = ?")
        .bind(&id)
        .execute(pool.as_ref())
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
    let pool = get_pool(&app)?;

    // 全論文をノードとして取得
    let paper_rows = sqlx::query("SELECT id, title, tags FROM papers ORDER BY title ASC")
        .fetch_all(pool.as_ref())
        .await
        .map_err(|e| format!("論文ノードの取得に失敗: {}", e))?;

    // 全ノートをノードとして取得（下書きは除外）
    let note_rows = sqlx::query(
        "SELECT id, title, content, paper_id, tags FROM notes WHERE is_draft = 0 OR is_draft IS NULL ORDER BY title ASC"
    )
        .fetch_all(pool.as_ref())
        .await
        .map_err(|e| format!("ノートノードの取得に失敗: {}", e))?;

    let mut node_ids: HashSet<String> = HashSet::new();
    let mut paper_title_to_id: HashMap<String, String> = HashMap::new();
    let mut note_title_to_id: HashMap<String, String> = HashMap::new();

    for row in &paper_rows {
        let id = col_str(row, "id");
        let title = col_str(row, "title");
        node_ids.insert(id.clone());
        paper_title_to_id
            .entry(normalize_wikilink_title(&title))
            .or_insert(id);
    }

    for row in &note_rows {
        let id = col_str(row, "id");
        let title = col_str(row, "title");
        node_ids.insert(id.clone());
        note_title_to_id
            .entry(normalize_wikilink_title(&title))
            .or_insert(id);
    }

    // 全リンクをエッジとして取得
    let link_rows =
        sqlx::query("SELECT id, source_type, source_id, target_type, target_id FROM links")
            .fetch_all(pool.as_ref())
            .await
            .map_err(|e| format!("リンクエッジの取得に失敗: {}", e))?;

    // 各ノードのリンク数を計算するためのカウンタ
    let mut link_counts: HashMap<String, u32> = HashMap::new();
    let mut seen_edges: HashSet<String> = HashSet::new();
    let mut links: Vec<GraphEdge> = Vec::new();

    // 1. 明示的に保存された双方向リンク
    for row in &link_rows {
        let id = col_str(row, "id");
        let source_id = col_str(row, "source_id");
        let target_id = col_str(row, "target_id");
        push_graph_edge(
            &mut links,
            &mut seen_edges,
            &mut link_counts,
            &node_ids,
            id,
            source_id,
            target_id,
        );
    }

    // 2. ノートと論文の紐づけ（note.paper_id）もグラフ上のリンクとして表示
    for row in &note_rows {
        let note_id = col_str(row, "id");
        if let Some(paper_id) = col_opt_str(row, "paper_id") {
            push_graph_edge(
                &mut links,
                &mut seen_edges,
                &mut link_counts,
                &node_ids,
                format!("paper-note:{}:{}", note_id, paper_id),
                note_id.clone(),
                paper_id,
            );
        }
    }

    // 3. 既存ノート本文の [[WikiLink]] を動的に解決してグラフに反映
    for row in &note_rows {
        let note_id = col_str(row, "id");
        let content = col_str(row, "content");
        for title in extract_wikilink_titles(&content) {
            let key = normalize_wikilink_title(&title);
            let target_id = note_title_to_id
                .get(&key)
                .or_else(|| paper_title_to_id.get(&key))
                .cloned();
            if let Some(target_id) = target_id {
                push_graph_edge(
                    &mut links,
                    &mut seen_edges,
                    &mut link_counts,
                    &node_ids,
                    format!("wikilink:{}:{}", note_id, target_id),
                    note_id.clone(),
                    target_id,
                );
            }
        }
    }

    // 論文ノードを構築
    let mut nodes: Vec<GraphNode> = paper_rows
        .iter()
        .filter_map(|row| {
            let id: String = row.try_get("id").ok()?;
            let name: String = row.try_get("title").ok()?;
            let tags = col_string_vec(row, "tags");
            let link_count = link_counts.get(&id).copied().unwrap_or(0);

            Some(GraphNode {
                id,
                name,
                node_type: "paper".to_string(),
                tags,
                link_count,
                val: link_count.max(1),
            })
        })
        .collect();

    // ノートノードを追加
    let note_nodes: Vec<GraphNode> = note_rows
        .iter()
        .filter_map(|row| {
            let id: String = row.try_get("id").ok()?;
            let name: String = row.try_get("title").ok()?;
            let tags = col_string_vec(row, "tags");
            let link_count = link_counts.get(&id).copied().unwrap_or(0);

            Some(GraphNode {
                id,
                name,
                node_type: "note".to_string(),
                tags,
                link_count,
                val: link_count.max(1),
            })
        })
        .collect();

    nodes.extend(note_nodes);

    Ok(GraphData { nodes, links })
}

// ────────────────────────────────────────────────────────────
// ヘルパー関数
// ────────────────────────────────────────────────────────────

fn push_graph_edge(
    links: &mut Vec<GraphEdge>,
    seen_edges: &mut HashSet<String>,
    link_counts: &mut HashMap<String, u32>,
    node_ids: &HashSet<String>,
    id: String,
    source: String,
    target: String,
) {
    if source.is_empty() || target.is_empty() || source == target {
        return;
    }
    if !node_ids.contains(&source) || !node_ids.contains(&target) {
        return;
    }

    let key = if source <= target {
        format!("{}|{}", source, target)
    } else {
        format!("{}|{}", target, source)
    };
    if !seen_edges.insert(key) {
        return;
    }

    *link_counts.entry(source.clone()).or_insert(0) += 1;
    *link_counts.entry(target.clone()).or_insert(0) += 1;
    links.push(GraphEdge { id, source, target });
}

fn normalize_wikilink_title(title: &str) -> String {
    title.trim().to_lowercase()
}

fn extract_wikilink_titles(content: &str) -> Vec<String> {
    let mut titles = Vec::new();
    let mut rest = content;

    while let Some(start) = rest.find("[[") {
        let after_start = &rest[start + 2..];
        let Some(end) = after_start.find("]]") else {
            break;
        };

        let raw = after_start[..end].trim();
        if !raw.is_empty() {
            let title = raw
                .split_once('|')
                .map(|(target, _alias)| target)
                .unwrap_or(raw)
                .trim();
            if !title.is_empty() {
                titles.push(title.to_string());
            }
        }

        rest = &after_start[end + 2..];
    }

    titles
}

/// 指定アイテムに対するバックリンク（source_title / target_title 付き）を取得する
pub async fn fetch_backlinks_for(
    pool: &sqlx::SqlitePool,
    item_type: &str,
    item_id: &str,
) -> Result<Vec<LinkWithSource>, String> {
    let rows = sqlx::query(
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
    )
    .bind(item_type)
    .bind(item_id)
    .bind(item_type)
    .bind(item_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("バックリンクの取得に失敗: {}", e))?;

    rows.iter()
        .map(parse_link_with_source_sqlx)
        .collect::<Result<Vec<_>, _>>()
}
