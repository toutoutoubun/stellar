// src-tauri/src/commands/search.rs
// Stellar — 全文検索コマンド
// FTS5 仮想テーブル（trigram tokenizer）を使った論文・ノート・ハイライトの横断検索
// item_types フィルタ・カテゴリ別 SearchResults・snippet [[match]] ラップ・
// オートコンプリート用 get_link_suggestions を提供

use crate::db::models::{val_i64, val_opt_str, val_str, val_string_vec};
use crate::db::models::{LinkSuggestion, SearchHit, SearchResults};
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
// full_text_search — FTS5 全文検索（論文・ノート・ハイライト横断）
// ────────────────────────────────────────────────────────────

/// FTS5 全文検索
/// query: 検索文字列
/// item_types: フィルタ（["paper", "note", "highlight"] の組み合わせ。None で全種類）
/// limit: 各カテゴリの最大件数（デフォルト20、最大100）
///
/// trigram tokenizer は3文字以上で MATCH が有効。
/// 3文字未満の場合は LIKE 検索にフォールバックする。
#[tauri::command]
pub async fn full_text_search(
    app: AppHandle,
    query: String,
    item_types: Option<Vec<String>>,
    limit: Option<u32>,
) -> Result<SearchResults, String> {
    let db = get_db(&app).await?;
    let max_results = limit.unwrap_or(20).clamp(1, 100);

    // 空クエリの場合は空結果を返す
    if query.trim().is_empty() {
        return Ok(SearchResults {
            papers: vec![],
            notes: vec![],
            highlights: vec![],
        });
    }

    let trimmed = query.trim().to_string();

    // 検索対象の決定
    let search_papers = item_types
        .as_ref()
        .map_or(true, |types| types.iter().any(|t| t == "paper"));
    let search_notes = item_types
        .as_ref()
        .map_or(true, |types| types.iter().any(|t| t == "note"));
    let search_highlights = item_types
        .as_ref()
        .map_or(true, |types| types.iter().any(|t| t == "highlight"));

    // trigram は3文字以上で MATCH 有効
    let use_fts = trimmed.chars().count() >= 3;

    let mut paper_hits: Vec<SearchHit> = Vec::new();
    let mut note_hits: Vec<SearchHit> = Vec::new();
    let mut highlight_hits: Vec<SearchHit> = Vec::new();

    // ── 論文検索 ──
    if search_papers {
        paper_hits = if use_fts {
            search_papers_fts(&db, &trimmed, max_results).await?
        } else {
            search_papers_like(&db, &trimmed, max_results).await?
        };
    }

    // ── ノート検索 ──
    if search_notes {
        note_hits = if use_fts {
            search_notes_fts(&db, &trimmed, max_results).await?
        } else {
            search_notes_like(&db, &trimmed, max_results).await?
        };
    }

    // ── ハイライト検索 ──
    if search_highlights {
        highlight_hits = if use_fts {
            search_highlights_fts(&db, &trimmed, max_results).await?
        } else {
            search_highlights_like(&db, &trimmed, max_results).await?
        };
    }

    Ok(SearchResults {
        papers: paper_hits,
        notes: note_hits,
        highlights: highlight_hits,
    })
}

// ────────────────────────────────────────────────────────────
// get_link_suggestions — オートコンプリート用タイトル候補（[[リンク記法]]用）
// ────────────────────────────────────────────────────────────

/// ノートと論文のタイトルをクエリで前方一致・部分一致検索し、候補リストを返す
#[tauri::command]
pub async fn get_link_suggestions(
    app: AppHandle,
    query: String,
) -> Result<Vec<LinkSuggestion>, String> {
    let db = get_db(&app).await?;

    if query.trim().is_empty() {
        return Ok(vec![]);
    }

    let like_pattern = format!("%{}%", query.trim());
    let prefix_pattern = format!("{}%", query.trim());
    let max_results: u32 = 10;

    // ノートのタイトル候補（前方一致を優先）
    let note_rows: Vec<Value> = db
        .select(
            "SELECT id, title, tags FROM notes
             WHERE title LIKE ?
             ORDER BY
                CASE WHEN title LIKE ? THEN 0 ELSE 1 END,
                updated_at DESC
             LIMIT ?",
            vec![
                Value::String(like_pattern.clone()),
                Value::String(prefix_pattern.clone()),
                Value::Number(max_results.into()),
            ],
        )
        .await
        .map_err(|e| format!("ノート候補の取得に失敗: {}", e))?;

    // 論文のタイトル候補（前方一致を優先）
    let paper_rows: Vec<Value> = db
        .select(
            "SELECT id, title, authors, year FROM papers
             WHERE title LIKE ?
             ORDER BY
                CASE WHEN title LIKE ? THEN 0 ELSE 1 END,
                updated_at DESC
             LIMIT ?",
            vec![
                Value::String(like_pattern),
                Value::String(prefix_pattern),
                Value::Number(max_results.into()),
            ],
        )
        .await
        .map_err(|e| format!("論文候補の取得に失敗: {}", e))?;

    let mut suggestions: Vec<LinkSuggestion> = Vec::new();

    // ノート候補を追加
    for row in &note_rows {
        let id = val_str(row, "id");
        let title = val_str(row, "title");
        let tags: Vec<String> = val_string_vec(row, "tags");

        let subtitle = if tags.is_empty() {
            "ノート".to_string()
        } else {
            format!("ノート — {}", tags.join(", "))
        };

        suggestions.push(LinkSuggestion {
            id,
            item_type: "note".to_string(),
            title,
            subtitle,
        });
    }

    // 論文候補を追加
    for row in &paper_rows {
        let id = val_str(row, "id");
        let title = val_str(row, "title");
        let authors: Vec<String> = val_string_vec(row, "authors");
        let year = val_i64(row, "year");

        // subtitle: 著者名（最初の2人）+ 出版年
        let author_text = if authors.len() > 2 {
            format!("{} ほか", authors[..2].join(", "))
        } else if authors.is_empty() {
            String::new()
        } else {
            authors.join(", ")
        };

        let subtitle = match (author_text.is_empty(), year) {
            (false, Some(y)) => format!("{} ({})", author_text, y),
            (false, None) => author_text,
            (true, Some(y)) => format!("論文 ({})", y),
            (true, None) => "論文".to_string(),
        };

        suggestions.push(LinkSuggestion {
            id,
            item_type: "paper".to_string(),
            title,
            subtitle,
        });
    }

    Ok(suggestions)
}

// ════════════════════════════════════════════════════════════
// 内部ヘルパー関数
// ════════════════════════════════════════════════════════════

/// テキスト中のヒット箇所を [[match]] でラップしたスニペットを生成する
/// query に一致する部分の前後50文字を抽出し、ヒット箇所を [[...]] で囲む
fn build_snippet(text: &str, query: &str) -> String {
    let text_lower = text.to_lowercase();
    let query_lower = query.to_lowercase();

    if let Some(pos) = text_lower.find(&query_lower) {
        let context_chars = 50;

        // スニペット開始位置（ヒットの50文字前）
        let start = if pos > context_chars {
            let target = pos - context_chars;
            text.char_indices()
                .map(|(i, _)| i)
                .find(|&i| i >= target)
                .unwrap_or(0)
        } else {
            0
        };

        // スニペット終了位置（ヒット末尾の50文字後）
        let match_end = pos + query.len();
        let end_target = match_end + context_chars;
        let end = text
            .char_indices()
            .map(|(i, _)| i)
            .find(|&i| i >= end_target)
            .unwrap_or(text.len());

        let mut snippet = String::new();
        if start > 0 {
            snippet.push_str("...");
        }
        snippet.push_str(&text[start..pos]);
        snippet.push_str("[[");
        snippet.push_str(&text[pos..match_end]);
        snippet.push_str("]]");
        snippet.push_str(&text[match_end..end]);
        if end < text.len() {
            snippet.push_str("...");
        }
        snippet
    } else {
        // ヒットしない場合は先頭100文字をそのまま返す
        let max_len = 100;
        let end = text
            .char_indices()
            .map(|(i, _)| i)
            .nth(max_len)
            .unwrap_or(text.len());
        let mut snippet = text[..end].to_string();
        if end < text.len() {
            snippet.push_str("...");
        }
        snippet
    }
}

// ── 論文検索ヘルパー ──

async fn search_papers_fts(
    db: &DbPool,
    query: &str,
    max_results: u32,
) -> Result<Vec<SearchHit>, String> {
    let rows: Vec<Value> = db
        .select(
            "SELECT content_id, content_type, title, body, rank
             FROM fts_search
             WHERE fts_search MATCH ? AND content_type = 'paper'
             ORDER BY rank
             LIMIT ?",
            vec![
                Value::String(query.to_string()),
                Value::Number(max_results.into()),
            ],
        )
        .await
        .map_err(|e| format!("論文の全文検索に失敗: {}", e))?;

    Ok(rows
        .iter()
        .map(|row| {
            let id = val_str(row, "content_id");
            let title = val_str(row, "title");
            let body = row.get("body").and_then(|v| v.as_str()).unwrap_or("");
            let rank = row.get("rank").and_then(|v| v.as_f64()).unwrap_or(0.0);

            let snippet = if title.to_lowercase().contains(&query.to_lowercase()) {
                build_snippet(&title, query)
            } else {
                build_snippet(body, query)
            };

            SearchHit {
                id,
                item_type: "paper".to_string(),
                title,
                snippet,
                score: rank.abs(),
            }
        })
        .collect())
}

async fn search_papers_like(
    db: &DbPool,
    query: &str,
    max_results: u32,
) -> Result<Vec<SearchHit>, String> {
    let like = format!("%{}%", query);
    let rows: Vec<Value> = db
        .select(
            "SELECT id, title, COALESCE(abstract, '') AS abstract_text
             FROM papers
             WHERE title LIKE ? OR abstract LIKE ? OR authors LIKE ?
             ORDER BY updated_at DESC
             LIMIT ?",
            vec![
                Value::String(like.clone()),
                Value::String(like.clone()),
                Value::String(like),
                Value::Number(max_results.into()),
            ],
        )
        .await
        .map_err(|e| format!("論文のLIKE検索に失敗: {}", e))?;

    Ok(rows
        .iter()
        .map(|row| {
            let id = val_str(row, "id");
            let title = val_str(row, "title");
            let abstract_text = row
                .get("abstract_text")
                .and_then(|v| v.as_str())
                .unwrap_or("");

            let snippet = if title.to_lowercase().contains(&query.to_lowercase()) {
                build_snippet(&title, query)
            } else {
                build_snippet(abstract_text, query)
            };

            SearchHit {
                id,
                item_type: "paper".to_string(),
                title,
                snippet,
                score: 1.0,
            }
        })
        .collect())
}

// ── ノート検索ヘルパー ──

async fn search_notes_fts(
    db: &DbPool,
    query: &str,
    max_results: u32,
) -> Result<Vec<SearchHit>, String> {
    let rows: Vec<Value> = db
        .select(
            "SELECT content_id, content_type, title, body, rank
             FROM fts_search
             WHERE fts_search MATCH ? AND content_type = 'note'
             ORDER BY rank
             LIMIT ?",
            vec![
                Value::String(query.to_string()),
                Value::Number(max_results.into()),
            ],
        )
        .await
        .map_err(|e| format!("ノートの全文検索に失敗: {}", e))?;

    Ok(rows
        .iter()
        .map(|row| {
            let id = val_str(row, "content_id");
            let title = val_str(row, "title");
            let body = row.get("body").and_then(|v| v.as_str()).unwrap_or("");
            let rank = row.get("rank").and_then(|v| v.as_f64()).unwrap_or(0.0);

            let snippet = if title.to_lowercase().contains(&query.to_lowercase()) {
                build_snippet(&title, query)
            } else {
                build_snippet(body, query)
            };

            SearchHit {
                id,
                item_type: "note".to_string(),
                title,
                snippet,
                score: rank.abs(),
            }
        })
        .collect())
}

async fn search_notes_like(
    db: &DbPool,
    query: &str,
    max_results: u32,
) -> Result<Vec<SearchHit>, String> {
    let like = format!("%{}%", query);
    let rows: Vec<Value> = db
        .select(
            "SELECT id, title, content
             FROM notes
             WHERE title LIKE ? OR content LIKE ?
             ORDER BY updated_at DESC
             LIMIT ?",
            vec![
                Value::String(like.clone()),
                Value::String(like),
                Value::Number(max_results.into()),
            ],
        )
        .await
        .map_err(|e| format!("ノートのLIKE検索に失敗: {}", e))?;

    Ok(rows
        .iter()
        .map(|row| {
            let id = val_str(row, "id");
            let title = val_str(row, "title");
            let content = row.get("content").and_then(|v| v.as_str()).unwrap_or("");

            let snippet = if title.to_lowercase().contains(&query.to_lowercase()) {
                build_snippet(&title, query)
            } else {
                build_snippet(content, query)
            };

            SearchHit {
                id,
                item_type: "note".to_string(),
                title,
                snippet,
                score: 1.0,
            }
        })
        .collect())
}

// ── ハイライト検索ヘルパー ──

async fn search_highlights_fts(
    db: &DbPool,
    query: &str,
    max_results: u32,
) -> Result<Vec<SearchHit>, String> {
    let rows: Vec<Value> = db
        .select(
            "SELECT fh.highlight_id, fh.paper_id, fh.text, fh.comment, fh.rank,
                    COALESCE(p.title, '') AS paper_title
             FROM fts_highlights fh
             LEFT JOIN papers p ON p.id = fh.paper_id
             WHERE fts_highlights MATCH ?
             ORDER BY fh.rank
             LIMIT ?",
            vec![
                Value::String(query.to_string()),
                Value::Number(max_results.into()),
            ],
        )
        .await
        .map_err(|e| format!("ハイライトの全文検索に失敗: {}", e))?;

    Ok(rows
        .iter()
        .map(|row| {
            let id = val_str(row, "highlight_id");
            let paper_title = val_str(row, "paper_title");
            let text = row.get("text").and_then(|v| v.as_str()).unwrap_or("");
            let comment = row.get("comment").and_then(|v| v.as_str()).unwrap_or("");
            let rank = row.get("rank").and_then(|v| v.as_f64()).unwrap_or(0.0);

            let snippet = if text.to_lowercase().contains(&query.to_lowercase()) {
                build_snippet(text, query)
            } else {
                build_snippet(comment, query)
            };

            SearchHit {
                id,
                item_type: "highlight".to_string(),
                title: paper_title,
                snippet,
                score: rank.abs(),
            }
        })
        .collect())
}

async fn search_highlights_like(
    db: &DbPool,
    query: &str,
    max_results: u32,
) -> Result<Vec<SearchHit>, String> {
    let like = format!("%{}%", query);
    let rows: Vec<Value> = db
        .select(
            "SELECT h.id, h.text, h.comment, COALESCE(p.title, '') AS paper_title
             FROM highlights h
             LEFT JOIN papers p ON p.id = h.paper_id
             WHERE h.text LIKE ? OR h.comment LIKE ?
             ORDER BY h.created_at DESC
             LIMIT ?",
            vec![
                Value::String(like.clone()),
                Value::String(like),
                Value::Number(max_results.into()),
            ],
        )
        .await
        .map_err(|e| format!("ハイライトのLIKE検索に失敗: {}", e))?;

    Ok(rows
        .iter()
        .map(|row| {
            let id = val_str(row, "id");
            let paper_title = val_str(row, "paper_title");
            let text = row.get("text").and_then(|v| v.as_str()).unwrap_or("");
            let comment = row.get("comment").and_then(|v| v.as_str()).unwrap_or("");

            let snippet = if text.to_lowercase().contains(&query.to_lowercase()) {
                build_snippet(text, query)
            } else {
                build_snippet(comment, query)
            };

            SearchHit {
                id,
                item_type: "highlight".to_string(),
                title: paper_title,
                snippet,
                score: 1.0,
            }
        })
        .collect())
}

// ════════════════════════════════════════════════════════════
// テスト
// ════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_snippet_basic() {
        let text = "これはテスト用の長いテキストです。検索クエリがここに含まれています。そしてさらに続きのテキストがあります。";
        let snippet = build_snippet(text, "検索クエリ");
        assert!(snippet.contains("[[検索クエリ]]"));
    }

    #[test]
    fn test_build_snippet_at_start() {
        let text = "検索クエリが先頭にあるテキスト";
        let snippet = build_snippet(text, "検索クエリ");
        assert!(snippet.starts_with("[[検索クエリ]]"));
        assert!(!snippet.starts_with("..."));
    }

    #[test]
    fn test_build_snippet_not_found() {
        let text = "このテキストにはヒットしません";
        let snippet = build_snippet(text, "存在しない");
        assert!(!snippet.contains("[["));
        assert!(!snippet.contains("]]"));
    }

    #[test]
    fn test_build_snippet_case_insensitive() {
        let text = "Hello World is a common greeting";
        let snippet = build_snippet(text, "hello");
        assert!(snippet.contains("[[Hello]]"));
    }
}
