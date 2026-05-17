// src-tauri/src/commands/search.rs
// Stellar — 全文検索コマンド
// FTS5 仮想テーブル（trigram tokenizer）を使った論文・ノート・ハイライトの横断検索
// item_types フィルタ・カテゴリ別 SearchResults・snippet [[match]] ラップ・
// オートコンプリート用 get_link_suggestions を提供

use crate::db::get_pool;
use crate::db::models::*;
use crate::utils::text::{normalize_nfc, normalize_nfc_trimmed};
use sqlx::Row;
use tauri::AppHandle;

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
    let pool = get_pool(&app)?;
    let max_results = limit.unwrap_or(20).clamp(1, 100);

    // 空クエリの場合は空結果を返す
    if query.trim().is_empty() {
        return Ok(SearchResults {
            papers: vec![],
            notes: vec![],
            highlights: vec![],
        });
    }

    let trimmed = normalize_nfc_trimmed(&query);

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
            search_papers_fts(pool.as_ref(), &trimmed, max_results).await?
        } else {
            search_papers_like(pool.as_ref(), &trimmed, max_results).await?
        };
    }

    // ── ノート検索 ──
    if search_notes {
        note_hits = if use_fts {
            search_notes_fts(pool.as_ref(), &trimmed, max_results).await?
        } else {
            search_notes_like(pool.as_ref(), &trimmed, max_results).await?
        };
    }

    // ── ハイライト検索 ──
    if search_highlights {
        highlight_hits = if use_fts {
            search_highlights_fts(pool.as_ref(), &trimmed, max_results).await?
        } else {
            search_highlights_like(pool.as_ref(), &trimmed, max_results).await?
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
    query: Option<String>,
    item_id: Option<String>,
    item_type: Option<String>,
) -> Result<Vec<LinkSuggestion>, String> {
    let pool = get_pool(&app)?;

    if let Some(ref id) = item_id {
        if !id.trim().is_empty() {
            return get_context_link_suggestions(
                pool.as_ref(),
                id.trim(),
                item_type.as_deref().unwrap_or("note"),
            )
            .await;
        }
    }

    let query = normalize_nfc_trimmed(&query.unwrap_or_default());
    if query.is_empty() {
        return Ok(vec![]);
    }

    let like_pattern = format!("%{}%", query);
    let prefix_pattern = format!("{}%", query);
    let max_results: i64 = 10;

    // ノートのタイトル候補（前方一致を優先）
    let note_rows = sqlx::query(
        "SELECT id, title, tags FROM notes
         WHERE title LIKE ?
         ORDER BY
            CASE WHEN title LIKE ? THEN 0 ELSE 1 END,
            updated_at DESC
         LIMIT ?",
    )
    .bind(&like_pattern)
    .bind(&prefix_pattern)
    .bind(max_results)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("ノート候補の取得に失敗: {}", e))?;

    // 論文のタイトル候補（前方一致を優先）
    let paper_rows = sqlx::query(
        "SELECT id, title, authors, year FROM papers
         WHERE title LIKE ?
         ORDER BY
            CASE WHEN title LIKE ? THEN 0 ELSE 1 END,
            updated_at DESC
         LIMIT ?",
    )
    .bind(&like_pattern)
    .bind(&prefix_pattern)
    .bind(max_results)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("論文候補の取得に失敗: {}", e))?;

    let mut suggestions: Vec<LinkSuggestion> = Vec::new();

    // ノート候補を追加
    for row in &note_rows {
        let id: String = row.try_get("id").unwrap_or_default();
        let title: String = row.try_get("title").unwrap_or_default();
        let tags = col_string_vec(row, "tags");

        let subtitle = if tags.is_empty() {
            "ノート".to_string()
        } else {
            format!("ノート — {}", tags.join(", "))
        };

        suggestions.push(LinkSuggestion {
            id,
            item_type: "note".to_string(),
            title,
            detail: Some(subtitle),
            score: None,
            reason: None,
        });
    }

    // 論文候補を追加
    for row in &paper_rows {
        let id: String = row.try_get("id").unwrap_or_default();
        let title: String = row.try_get("title").unwrap_or_default();
        let authors = col_string_vec(row, "authors");
        let year: Option<i32> = row.try_get("year").unwrap_or(None);

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
            detail: Some(subtitle),
            score: None,
            reason: None,
        });
    }

    Ok(suggestions)
}

// ────────────────────────────────────────────────────────────
// resolve_wikilink — [[タイトル]] クリック時のリンク先解決
// ────────────────────────────────────────────────────────────

/// WikiLink の表示テキストからノートまたは論文を解決する。
/// 同名がある場合は、ユーザーの執筆体験に合わせてノートを優先する。
#[tauri::command]
pub async fn resolve_wikilink(app: AppHandle, title: String) -> Result<ResolvedWikiLink, String> {
    let pool = get_pool(&app)?;
    let trimmed = normalize_nfc_trimmed(&title);
    if trimmed.is_empty() {
        return Err("WikiLink のタイトルが空です".to_string());
    }

    let note = sqlx::query(
        "SELECT id FROM notes
         WHERE title = ? COLLATE NOCASE
           AND (is_draft = 0 OR is_draft IS NULL)
         ORDER BY updated_at DESC
         LIMIT 1",
    )
    .bind(&trimmed)
    .fetch_optional(pool.as_ref())
    .await
    .map_err(|e| format!("WikiLink ノート解決に失敗: {}", e))?;

    if let Some(row) = note {
        return Ok(ResolvedWikiLink {
            id: col_str(&row, "id"),
            item_type: "note".to_string(),
        });
    }

    let paper = sqlx::query(
        "SELECT id FROM papers
         WHERE title = ? COLLATE NOCASE
         ORDER BY updated_at DESC
         LIMIT 1",
    )
    .bind(&trimmed)
    .fetch_optional(pool.as_ref())
    .await
    .map_err(|e| format!("WikiLink 論文解決に失敗: {}", e))?;

    if let Some(row) = paper {
        return Ok(ResolvedWikiLink {
            id: col_str(&row, "id"),
            item_type: "paper".to_string(),
        });
    }

    Err(format!("WikiLink のリンク先が見つかりません: {}", trimmed))
}

/// 現在のノート/論文を起点に、まだリンクされていない関連候補を返す。
async fn get_context_link_suggestions(
    pool: &sqlx::SqlitePool,
    item_id: &str,
    item_type: &str,
) -> Result<Vec<LinkSuggestion>, String> {
    let item_type = if item_type == "paper" {
        "paper"
    } else {
        "note"
    };

    let linked_rows = sqlx::query(
        "SELECT source_type, source_id, target_type, target_id
         FROM links
         WHERE (source_type = ? AND source_id = ?)
            OR (target_type = ? AND target_id = ?)",
    )
    .bind(item_type)
    .bind(item_id)
    .bind(item_type)
    .bind(item_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("既存リンクの取得に失敗: {}", e))?;

    let mut linked_keys = std::collections::HashSet::new();
    linked_keys.insert(format!("{}:{}", item_type, item_id));
    for row in &linked_rows {
        let source_type = col_str(row, "source_type");
        let source_id = col_str(row, "source_id");
        let target_type = col_str(row, "target_type");
        let target_id = col_str(row, "target_id");
        linked_keys.insert(format!("{}:{}", source_type, source_id));
        linked_keys.insert(format!("{}:{}", target_type, target_id));
    }

    let current_row = if item_type == "paper" {
        sqlx::query(
            "SELECT title, COALESCE(abstract, '') AS body, tags, authors, journal, year
             FROM papers WHERE id = ?",
        )
        .bind(item_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| format!("現在の論文取得に失敗: {}", e))?
    } else {
        sqlx::query(
            "SELECT title, content AS body, tags, '[]' AS authors, NULL AS journal, NULL AS year
             FROM notes WHERE id = ?",
        )
        .bind(item_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| format!("現在のノート取得に失敗: {}", e))?
    };

    let Some(current_row) = current_row else {
        return Ok(vec![]);
    };

    let current_title = col_str(&current_row, "title");
    let current_body = col_str(&current_row, "body");
    let current_tags = col_string_vec(&current_row, "tags");
    let current_authors = col_string_vec(&current_row, "authors");
    let current_text = format!("{} {}", current_title, current_body);

    let mut suggestions: Vec<LinkSuggestion> = Vec::new();

    let note_rows = sqlx::query(
        "SELECT id, title, content AS body, tags
         FROM notes
         WHERE (is_draft = 0 OR is_draft IS NULL)
         ORDER BY updated_at DESC",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("ノート候補の取得に失敗: {}", e))?;

    for row in &note_rows {
        let id = col_str(row, "id");
        if linked_keys.contains(&format!("note:{}", id)) {
            continue;
        }
        let title = col_str(row, "title");
        let body = col_str(row, "body");
        let tags = col_string_vec(row, "tags");
        if let Some((score, reason)) = score_link_candidate(
            &current_title,
            &current_text,
            &current_tags,
            &title,
            &body,
            &tags,
        ) {
            suggestions.push(LinkSuggestion {
                id,
                item_type: "note".to_string(),
                title,
                detail: Some("ノート".to_string()),
                score: Some(score),
                reason: Some(reason),
            });
        }
    }

    let paper_rows = sqlx::query(
        "SELECT id, title, COALESCE(abstract, '') AS body, tags, authors, year
         FROM papers
         ORDER BY updated_at DESC",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("論文候補の取得に失敗: {}", e))?;

    for row in &paper_rows {
        let id = col_str(row, "id");
        if linked_keys.contains(&format!("paper:{}", id)) {
            continue;
        }
        let title = col_str(row, "title");
        let body = col_str(row, "body");
        let tags = col_string_vec(row, "tags");
        if let Some((mut score, mut reason)) = score_link_candidate(
            &current_title,
            &current_text,
            &current_tags,
            &title,
            &body,
            &tags,
        ) {
            let authors = col_string_vec(row, "authors");
            let author_overlap = authors
                .iter()
                .filter(|a| current_authors.iter().any(|b| a.eq_ignore_ascii_case(b)))
                .count();
            if author_overlap > 0 {
                score += author_overlap as f64 * 2.0;
                reason = format!("{}, 著者一致: {}件", reason, author_overlap);
            }

            let year = col_opt_i32(row, "year");
            let detail = match year {
                Some(y) => format!("論文 ({})", y),
                None => "論文".to_string(),
            };

            suggestions.push(LinkSuggestion {
                id,
                item_type: "paper".to_string(),
                title,
                detail: Some(detail),
                score: Some(score),
                reason: Some(reason),
            });
        }
    }

    suggestions.sort_by(|a, b| {
        b.score
            .unwrap_or(0.0)
            .partial_cmp(&a.score.unwrap_or(0.0))
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| a.title.cmp(&b.title))
    });
    suggestions.truncate(8);
    Ok(suggestions)
}

fn score_link_candidate(
    current_title: &str,
    current_text: &str,
    current_tags: &[String],
    candidate_title: &str,
    candidate_text: &str,
    candidate_tags: &[String],
) -> Option<(f64, String)> {
    let mut score = 0.0;
    let mut reasons = Vec::new();

    let shared_tags: Vec<&String> = candidate_tags
        .iter()
        .filter(|tag| current_tags.iter().any(|t| t.eq_ignore_ascii_case(tag)))
        .collect();
    if !shared_tags.is_empty() {
        score += shared_tags.len() as f64 * 3.0;
        reasons.push(format!(
            "共通タグ: {}",
            shared_tags
                .iter()
                .take(3)
                .map(|s| s.as_str())
                .collect::<Vec<_>>()
                .join(", ")
        ));
    }

    if contains_ci(current_text, candidate_title) {
        score += 5.0;
        reasons.push("本文でタイトルに言及".to_string());
    }

    if contains_ci(candidate_text, current_title) {
        score += 3.0;
        reasons.push("相手本文で現在のタイトルに言及".to_string());
    }

    let overlap = keyword_overlap(current_text, candidate_text);
    if overlap >= 2 {
        let add = (overlap as f64).min(4.0);
        score += add;
        reasons.push(format!("キーワード一致: {}件", overlap));
    }

    if score <= 0.0 {
        None
    } else {
        Some((score, reasons.join(" / ")))
    }
}

fn contains_ci(haystack: &str, needle: &str) -> bool {
    let needle = normalize_nfc_trimmed(needle);
    if needle.chars().count() < 2 {
        return false;
    }
    normalize_nfc(haystack)
        .to_lowercase()
        .contains(&needle.to_lowercase())
}

fn keyword_overlap(a: &str, b: &str) -> usize {
    let a_words = keywords(a);
    if a_words.is_empty() {
        return 0;
    }
    let b_words = keywords(b);
    a_words.intersection(&b_words).count()
}

fn keywords(text: &str) -> std::collections::HashSet<String> {
    normalize_nfc(text)
        .split(|c: char| !c.is_alphanumeric())
        .map(|w| w.trim().to_lowercase())
        .filter(|w| w.chars().count() >= 4)
        .take(80)
        .collect()
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
    pool: &sqlx::SqlitePool,
    query: &str,
    max_results: u32,
) -> Result<Vec<SearchHit>, String> {
    let rows = sqlx::query(
        "SELECT content_id, content_type, title, body, rank
         FROM fts_search
         WHERE fts_search MATCH ? AND content_type = 'paper'
         ORDER BY rank
         LIMIT ?",
    )
    .bind(query)
    .bind(max_results as i64)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("論文の全文検索に失敗: {}", e))?;

    Ok(rows
        .iter()
        .map(|row| {
            let id: String = row.try_get("content_id").unwrap_or_default();
            let title: String = row.try_get("title").unwrap_or_default();
            let body: String = row.try_get("body").unwrap_or_default();
            let rank: f64 = row.try_get("rank").unwrap_or(0.0);

            let snippet = if title.to_lowercase().contains(&query.to_lowercase()) {
                build_snippet(&title, query)
            } else {
                build_snippet(&body, query)
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
    pool: &sqlx::SqlitePool,
    query: &str,
    max_results: u32,
) -> Result<Vec<SearchHit>, String> {
    let like = format!("%{}%", query);
    let rows = sqlx::query(
        "SELECT id, title, COALESCE(abstract, '') AS abstract_text
         FROM papers
         WHERE title LIKE ? OR abstract LIKE ? OR authors LIKE ?
         ORDER BY updated_at DESC
         LIMIT ?",
    )
    .bind(&like)
    .bind(&like)
    .bind(&like)
    .bind(max_results as i64)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("論文のLIKE検索に失敗: {}", e))?;

    Ok(rows
        .iter()
        .map(|row| {
            let id: String = row.try_get("id").unwrap_or_default();
            let title: String = row.try_get("title").unwrap_or_default();
            let abstract_text: String = row.try_get("abstract_text").unwrap_or_default();

            let snippet = if title.to_lowercase().contains(&query.to_lowercase()) {
                build_snippet(&title, query)
            } else {
                build_snippet(&abstract_text, query)
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
    pool: &sqlx::SqlitePool,
    query: &str,
    max_results: u32,
) -> Result<Vec<SearchHit>, String> {
    let rows = sqlx::query(
        "SELECT content_id, content_type, title, body, rank
         FROM fts_search
         WHERE fts_search MATCH ? AND content_type = 'note'
         ORDER BY rank
         LIMIT ?",
    )
    .bind(query)
    .bind(max_results as i64)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("ノートの全文検索に失敗: {}", e))?;

    Ok(rows
        .iter()
        .map(|row| {
            let id: String = row.try_get("content_id").unwrap_or_default();
            let title: String = row.try_get("title").unwrap_or_default();
            let body: String = row.try_get("body").unwrap_or_default();
            let rank: f64 = row.try_get("rank").unwrap_or(0.0);

            let snippet = if title.to_lowercase().contains(&query.to_lowercase()) {
                build_snippet(&title, query)
            } else {
                build_snippet(&body, query)
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
    pool: &sqlx::SqlitePool,
    query: &str,
    max_results: u32,
) -> Result<Vec<SearchHit>, String> {
    let like = format!("%{}%", query);
    let rows = sqlx::query(
        "SELECT id, title, content
         FROM notes
         WHERE title LIKE ? OR content LIKE ?
         ORDER BY updated_at DESC
         LIMIT ?",
    )
    .bind(&like)
    .bind(&like)
    .bind(max_results as i64)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("ノートのLIKE検索に失敗: {}", e))?;

    Ok(rows
        .iter()
        .map(|row| {
            let id: String = row.try_get("id").unwrap_or_default();
            let title: String = row.try_get("title").unwrap_or_default();
            let content: String = row.try_get("content").unwrap_or_default();

            let snippet = if title.to_lowercase().contains(&query.to_lowercase()) {
                build_snippet(&title, query)
            } else {
                build_snippet(&content, query)
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
    pool: &sqlx::SqlitePool,
    query: &str,
    max_results: u32,
) -> Result<Vec<SearchHit>, String> {
    let rows = sqlx::query(
        "SELECT fh.highlight_id, fh.paper_id, fh.text, fh.comment, fh.rank,
                COALESCE(p.title, '') AS paper_title
         FROM fts_highlights fh
         LEFT JOIN papers p ON p.id = fh.paper_id
         WHERE fts_highlights MATCH ?
         ORDER BY fh.rank
         LIMIT ?",
    )
    .bind(query)
    .bind(max_results as i64)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("ハイライトの全文検索に失敗: {}", e))?;

    Ok(rows
        .iter()
        .map(|row| {
            let id: String = row.try_get("highlight_id").unwrap_or_default();
            let paper_title: String = row.try_get("paper_title").unwrap_or_default();
            let text: String = row.try_get("text").unwrap_or_default();
            let comment: String = row.try_get("comment").unwrap_or_default();
            let rank: f64 = row.try_get("rank").unwrap_or(0.0);

            let snippet = if text.to_lowercase().contains(&query.to_lowercase()) {
                build_snippet(&text, query)
            } else {
                build_snippet(&comment, query)
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
    pool: &sqlx::SqlitePool,
    query: &str,
    max_results: u32,
) -> Result<Vec<SearchHit>, String> {
    let like = format!("%{}%", query);
    let rows = sqlx::query(
        "SELECT h.id, h.text, h.comment, COALESCE(p.title, '') AS paper_title
         FROM highlights h
         LEFT JOIN papers p ON p.id = h.paper_id
         WHERE h.text LIKE ? OR h.comment LIKE ?
         ORDER BY h.created_at DESC
         LIMIT ?",
    )
    .bind(&like)
    .bind(&like)
    .bind(max_results as i64)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("ハイライトのLIKE検索に失敗: {}", e))?;

    Ok(rows
        .iter()
        .map(|row| {
            let id: String = row.try_get("id").unwrap_or_default();
            let paper_title: String = row.try_get("paper_title").unwrap_or_default();
            let text: String = row.try_get("text").unwrap_or_default();
            let comment: String = row.try_get("comment").unwrap_or_default();

            let snippet = if text.to_lowercase().contains(&query.to_lowercase()) {
                build_snippet(&text, query)
            } else {
                build_snippet(&comment, query)
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

// ────────────────────────────────────────────────────────────
// get_recent_items — 最近更新された論文・ノートを返す
// ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentItem {
    pub id: String,
    pub item_type: String,
    pub title: String,
    pub meta: String,
    pub accessed_at: String,
}

/// 最近更新された論文・ノートを updated_at 降順で返す
#[tauri::command]
pub async fn get_recent_items(
    app: AppHandle,
    limit: Option<u32>,
) -> Result<Vec<RecentItem>, String> {
    let pool = get_pool(&app)?;
    let limit = limit.unwrap_or(8).clamp(1, 50) as i64;

    // 論文とノートを UNION ALL で結合して updated_at 降順
    let rows = sqlx::query(
        "SELECT id, 'paper' AS item_type, title,
                COALESCE(journal, '') AS meta, updated_at AS accessed_at
         FROM papers
         UNION ALL
         SELECT id, 'note' AS item_type, title,
                COALESCE(
                    (SELECT p.title FROM papers p WHERE p.id = notes.paper_id),
                    ''
                ) AS meta,
                updated_at AS accessed_at
         FROM notes
         WHERE is_draft = 0 OR is_draft IS NULL
         ORDER BY accessed_at DESC
         LIMIT ?",
    )
    .bind(limit)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("最近のアイテム取得に失敗: {}", e))?;

    let items = rows
        .iter()
        .map(|row| RecentItem {
            id: row.try_get("id").unwrap_or_default(),
            item_type: row.try_get("item_type").unwrap_or_default(),
            title: row.try_get("title").unwrap_or_default(),
            meta: row.try_get("meta").unwrap_or_default(),
            accessed_at: row.try_get("accessed_at").unwrap_or_default(),
        })
        .collect();

    Ok(items)
}

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

    #[test]
    fn contains_ci_matches_nfc_and_nfd() {
        assert!(contains_ci("Sawubona ê", "e\u{0302}"));
    }
}
