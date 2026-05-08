// src-tauri/src/commands/citation_network.rs
// Stellar — 引用ネットワーク・読書ステータス・関連論文サジェスト・BibTeX/RIS エクスポート
// Semantic Scholar API を使用した引用データ取得・レコメンデーション機能を提供する

use crate::db::get_pool;
use crate::db::models::*;
use sqlx::Row;
use tauri::AppHandle;

const SS_USER_AGENT: &str = "Stellar/0.1.0 (academic research tool; mailto:contact@stellar.app)";

// ════════════════════════════════════════════════════════════
// 読書ステータス
// ════════════════════════════════════════════════════════════

/// 論文の読書ステータスを更新する
#[tauri::command]
pub async fn update_reading_status(
    app: AppHandle,
    paper_id: String,
    status: String,
) -> Result<(), String> {
    let valid = ["unread", "reading", "done", "revisit"];
    if !valid.contains(&status.as_str()) {
        return Err(format!(
            "無効なステータス '{}' — 有効値: {:?}",
            status, valid
        ));
    }

    let pool = get_pool(&app)?;
    sqlx::query("UPDATE papers SET reading_status = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(&status)
        .bind(&paper_id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("読書ステータスの更新に失敗: {}", e))?;

    Ok(())
}

/// 読書ステータス別の論文件数を取得する
#[tauri::command]
pub async fn get_reading_status_counts(app: AppHandle) -> Result<serde_json::Value, String> {
    let pool = get_pool(&app)?;
    let rows =
        sqlx::query("SELECT reading_status, COUNT(*) as cnt FROM papers GROUP BY reading_status")
            .fetch_all(pool.as_ref())
            .await
            .map_err(|e| format!("読書ステータス集計に失敗: {}", e))?;

    let mut counts = serde_json::json!({
        "unread": 0,
        "reading": 0,
        "done": 0,
        "revisit": 0,
    });

    for row in &rows {
        let status: String = row.try_get("reading_status").unwrap_or_default();
        let cnt: i64 = row.try_get("cnt").unwrap_or(0);
        if let Some(obj) = counts.as_object_mut() {
            obj.insert(status, serde_json::json!(cnt));
        }
    }

    Ok(counts)
}

// ════════════════════════════════════════════════════════════
// Semantic Scholar — 引用ネットワーク取得
// ════════════════════════════════════════════════════════════

/// SS API レスポンスから CitationEntry を抽出するヘルパー
fn parse_ss_paper_to_entry(paper: &serde_json::Value) -> CitationEntry {
    let authors = paper
        .get("authors")
        .and_then(|a| a.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|a| a.get("name").and_then(|n| n.as_str()).map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    let doi = paper
        .get("externalIds")
        .and_then(|ids| ids.get("DOI"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let url = paper
        .get("url")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    CitationEntry {
        ss_paper_id: paper
            .get("paperId")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        title: paper
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("Untitled")
            .to_string(),
        authors,
        year: paper.get("year").and_then(|v| v.as_i64()).map(|y| y as i32),
        doi,
        url,
    }
}

/// 引用ネットワーク（参照文献・被引用文献）を取得する
/// キャッシュ有効期間: 7日
#[tauri::command]
pub async fn fetch_citation_network(
    app: AppHandle,
    paper_id: String,
) -> Result<CitationNetworkData, String> {
    let pool = get_pool(&app)?;

    // 論文を取得
    let row = sqlx::query("SELECT * FROM papers WHERE id = ?")
        .bind(&paper_id)
        .fetch_optional(pool.as_ref())
        .await
        .map_err(|e| format!("論文の取得に失敗: {}", e))?
        .ok_or_else(|| format!("論文が見つかりません: {}", paper_id))?;

    let doi = col_opt_str(&row, "doi");
    let url = col_opt_str(&row, "url");
    let fetched_at = col_opt_str(&row, "references_fetched_at");

    // キャッシュが7日以内なら DB のデータを返す
    if let Some(ref ts) = fetched_at {
        if let Ok(parsed) = chrono::DateTime::parse_from_rfc3339(ts) {
            let age = chrono::Utc::now().signed_duration_since(parsed);
            if age.num_days() < 7 {
                let refs_json = col_str(&row, "references_json");
                let cited_json = col_str(&row, "cited_by_json");
                let references: Vec<CitationEntry> =
                    serde_json::from_str(&refs_json).unwrap_or_default();
                let cited_by: Vec<CitationEntry> =
                    serde_json::from_str(&cited_json).unwrap_or_default();
                return Ok(CitationNetworkData {
                    paper_id,
                    references,
                    cited_by,
                    fetched_at: Some(ts.clone()),
                });
            }
        }
    }

    // DOI or URL で SS API を呼び出す
    let ss_query = if let Some(ref d) = doi {
        format!(
            "https://api.semanticscholar.org/graph/v1/paper/DOI:{}?fields=references,citations,title,authors,year,externalIds",
            d
        )
    } else if let Some(ref u) = url {
        let encoded = urlencoding::encode(u);
        format!(
            "https://api.semanticscholar.org/graph/v1/paper/URL:{}?fields=references,citations,title,authors,year,externalIds",
            encoded
        )
    } else {
        // DOI も URL もない場合は空データを返す
        return Ok(CitationNetworkData {
            paper_id,
            references: vec![],
            cited_by: vec![],
            fetched_at: None,
        });
    };

    let client = reqwest::Client::new();
    let response = client
        .get(&ss_query)
        .header("User-Agent", SS_USER_AGENT)
        .send()
        .await;

    let response = match response {
        Ok(r) => r,
        Err(e) => {
            log::warn!("Semantic Scholar API への接続に失敗: {}", e);
            return Ok(CitationNetworkData {
                paper_id,
                references: vec![],
                cited_by: vec![],
                fetched_at: None,
            });
        }
    };

    if !response.status().is_success() {
        log::warn!("Semantic Scholar API エラー: {}", response.status());
        return Ok(CitationNetworkData {
            paper_id,
            references: vec![],
            cited_by: vec![],
            fetched_at: None,
        });
    }

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("レスポンスの解析に失敗: {}", e))?;

    // ss_paper_id を取得
    let ss_paper_id = body
        .get("paperId")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // references を解析
    let references: Vec<CitationEntry> = body
        .get("references")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|item| {
                    item.get("citedPaper")
                        .filter(|p| p.get("title").is_some())
                        .map(parse_ss_paper_to_entry)
                })
                .collect()
        })
        .unwrap_or_default();

    // citations を解析
    let cited_by: Vec<CitationEntry> = body
        .get("citations")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|item| {
                    item.get("citingPaper")
                        .filter(|p| p.get("title").is_some())
                        .map(parse_ss_paper_to_entry)
                })
                .collect()
        })
        .unwrap_or_default();

    // DB に保存
    let now = chrono::Utc::now().to_rfc3339();
    let refs_json = serde_json::to_string(&references).unwrap_or_else(|_| "[]".to_string());
    let cited_json = serde_json::to_string(&cited_by).unwrap_or_else(|_| "[]".to_string());

    sqlx::query(
        "UPDATE papers SET references_json = ?, cited_by_json = ?, ss_paper_id = ?, references_fetched_at = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(&refs_json)
    .bind(&cited_json)
    .bind(&ss_paper_id)
    .bind(&now)
    .bind(&paper_id)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("引用データの保存に失敗: {}", e))?;

    // レート制限: 100ms 待機
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;

    Ok(CitationNetworkData {
        paper_id,
        references,
        cited_by,
        fetched_at: Some(now),
    })
}

// ════════════════════════════════════════════════════════════
// Semantic Scholar — レコメンデーション
// ════════════════════════════════════════════════════════════

/// 関連論文レコメンデーションを取得する
#[tauri::command]
pub async fn fetch_recommendations(
    app: AppHandle,
    paper_id: String,
) -> Result<Vec<PaperRecommendation>, String> {
    let pool = get_pool(&app)?;

    // ss_paper_id を取得
    let row = sqlx::query("SELECT ss_paper_id, doi, url FROM papers WHERE id = ?")
        .bind(&paper_id)
        .fetch_optional(pool.as_ref())
        .await
        .map_err(|e| format!("論文の取得に失敗: {}", e))?
        .ok_or_else(|| format!("論文が見つかりません: {}", paper_id))?;

    let mut ss_paper_id: Option<String> = col_opt_str(&row, "ss_paper_id");

    // ss_paper_id がない場合は fetch_citation_network を通じて取得を試みる
    if ss_paper_id.is_none() {
        let _ = fetch_citation_network(app.clone(), paper_id.clone()).await;
        // 再取得
        if let Ok(Some(row2)) =
            sqlx::query("SELECT ss_paper_id FROM papers WHERE id = ?")
                .bind(&paper_id)
                .fetch_optional(pool.as_ref())
                .await
        {
            ss_paper_id = col_opt_str(&row2, "ss_paper_id");
        }
    }

    let ss_id = match ss_paper_id {
        Some(id) => id,
        None => {
            // SS ID を取得できなかった場合は空で返す
            return Ok(vec![]);
        }
    };

    // レコメンデーション API を呼び出す
    let rec_url = format!(
        "https://api.semanticscholar.org/recommendations/v1/papers/forpaper/{}?fields=title,authors,year,externalIds,abstract&limit=10",
        ss_id
    );

    let client = reqwest::Client::new();
    let response = match client
        .get(&rec_url)
        .header("User-Agent", SS_USER_AGENT)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            log::warn!("レコメンデーション API への接続に失敗: {}", e);
            return Ok(vec![]);
        }
    };

    if !response.status().is_success() {
        log::warn!("レコメンデーション API エラー: {}", response.status());
        return Ok(vec![]);
    }

    let body: serde_json::Value = match response.json().await {
        Ok(v) => v,
        Err(e) => {
            log::warn!("レコメンデーション レスポンス解析に失敗: {}", e);
            return Ok(vec![]);
        }
    };

    let recommended_papers = body
        .get("recommendedPapers")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    // 既存の recommendations を削除（リフレッシュ）
    sqlx::query("DELETE FROM paper_recommendations WHERE paper_id = ?")
        .bind(&paper_id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("既存レコメンデーションの削除に失敗: {}", e))?;

    let mut results: Vec<PaperRecommendation> = Vec::new();

    for (idx, paper) in recommended_papers.iter().enumerate() {
        let rec_id = uuid::Uuid::new_v4().to_string();
        let title = paper
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("Untitled")
            .to_string();

        let authors_arr: Vec<String> = paper
            .get("authors")
            .and_then(|a| a.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|a| a.get("name").and_then(|n| n.as_str()).map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();
        let authors_json = serde_json::to_string(&authors_arr).unwrap_or_else(|_| "[]".to_string());

        let year = paper.get("year").and_then(|v| v.as_i64()).map(|y| y as i32);

        let rec_doi = paper
            .get("externalIds")
            .and_then(|ids| ids.get("DOI"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let rec_url = paper
            .get("url")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let rec_abstract = paper
            .get("abstract")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let rec_ss_id = paper
            .get("paperId")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let relevance_score = 1.0 - (idx as f64 * 0.05); // 順位ベースのスコア

        // DOI マッチでライブラリに既存かチェック
        let mut is_imported: i64 = 0;
        let mut recommended_paper_id: Option<String> = None;
        if let Some(ref d) = rec_doi {
            if let Ok(Some(existing)) = sqlx::query("SELECT id FROM papers WHERE doi = ?")
                .bind(d)
                .fetch_optional(pool.as_ref())
                .await
            {
                is_imported = 1;
                recommended_paper_id = Some(col_str(&existing, "id"));
            }
        }

        sqlx::query(
            "INSERT INTO paper_recommendations (id, paper_id, recommended_paper_id, title, authors, year, doi, url, abstract, ss_paper_id, relevance_score, is_imported) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&rec_id)
        .bind(&paper_id)
        .bind(&recommended_paper_id)
        .bind(&title)
        .bind(&authors_json)
        .bind(year)
        .bind(&rec_doi)
        .bind(&rec_url)
        .bind(&rec_abstract)
        .bind(&rec_ss_id)
        .bind(relevance_score)
        .bind(is_imported)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("レコメンデーションの保存に失敗: {}", e))?;

        let now = chrono::Utc::now().to_rfc3339();
        results.push(PaperRecommendation {
            id: rec_id,
            paper_id: paper_id.clone(),
            recommended_paper_id,
            title,
            authors: authors_json,
            year,
            doi: rec_doi,
            url: rec_url,
            r#abstract: rec_abstract,
            ss_paper_id: rec_ss_id,
            relevance_score: Some(relevance_score),
            is_imported,
            created_at: now,
        });
    }

    // レート制限: 100ms 待機
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;

    Ok(results)
}

/// キャッシュ済みレコメンデーション一覧を取得する
#[tauri::command]
pub async fn get_recommendations(
    app: AppHandle,
    paper_id: String,
) -> Result<Vec<PaperRecommendation>, String> {
    let pool = get_pool(&app)?;
    let rows = sqlx::query(
        "SELECT * FROM paper_recommendations WHERE paper_id = ? ORDER BY relevance_score DESC",
    )
    .bind(&paper_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("レコメンデーションの取得に失敗: {}", e))?;

    rows.iter().map(parse_recommendation).collect()
}

/// レコメンデーションをライブラリにインポートする
#[tauri::command]
pub async fn import_recommendation(
    app: AppHandle,
    recommendation_id: String,
) -> Result<PaperResponse, String> {
    let pool = get_pool(&app)?;

    // レコメンデーションを取得
    let row = sqlx::query("SELECT * FROM paper_recommendations WHERE id = ?")
        .bind(&recommendation_id)
        .fetch_optional(pool.as_ref())
        .await
        .map_err(|e| format!("レコメンデーションの取得に失敗: {}", e))?
        .ok_or_else(|| format!("レコメンデーションが見つかりません: {}", recommendation_id))?;

    let rec = parse_recommendation(&row)?;

    // 論文を作成
    let new_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let tags_json = "[]";

    sqlx::query(
        "INSERT INTO papers (id, title, authors, year, doi, url, abstract, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&new_id)
    .bind(&rec.title)
    .bind(&rec.authors)
    .bind(rec.year)
    .bind(&rec.doi)
    .bind(&rec.url)
    .bind(&rec.r#abstract)
    .bind(tags_json)
    .bind(&now)
    .bind(&now)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("論文の作成に失敗: {}", e))?;

    // レコメンデーションを更新
    sqlx::query(
        "UPDATE paper_recommendations SET is_imported = 1, recommended_paper_id = ? WHERE id = ?",
    )
    .bind(&new_id)
    .bind(&recommendation_id)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("レコメンデーションの更新に失敗: {}", e))?;

    // authors を Vec<String> にパース
    let authors: Vec<String> = serde_json::from_str(&rec.authors).unwrap_or_default();

    Ok(PaperResponse {
        id: new_id,
        title: rec.title,
        authors,
        year: rec.year,
        journal: None,
        volume: None,
        issue: None,
        pages: None,
        doi: rec.doi,
        url: rec.url,
        r#abstract: rec.r#abstract,
        pdf_path: None,
        tags: vec![],
        created_at: now.clone(),
        updated_at: now,
    })
}

// ════════════════════════════════════════════════════════════
// 引用グラフ — 全ライブラリ横断
// ════════════════════════════════════════════════════════════

/// ライブラリ全体の引用ネットワークグラフデータを構築する
#[tauri::command]
pub async fn get_citation_graph_data(app: AppHandle) -> Result<serde_json::Value, String> {
    let pool = get_pool(&app)?;
    let rows = sqlx::query(
        "SELECT id, title, year, ss_paper_id, references_json FROM papers WHERE references_json != '[]'",
    )
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("論文データの取得に失敗: {}", e))?;

    let mut nodes = Vec::new();
    let mut edges = Vec::new();
    let mut seen_nodes = std::collections::HashSet::new();

    // ライブラリ内の ss_paper_id → paper_id マッピング
    let all_papers_rows = sqlx::query("SELECT id, ss_paper_id FROM papers WHERE ss_paper_id IS NOT NULL")
        .fetch_all(pool.as_ref())
        .await
        .unwrap_or_default();
    let ss_to_local: std::collections::HashMap<String, String> = all_papers_rows
        .iter()
        .filter_map(|r| {
            let ss = col_opt_str(r, "ss_paper_id")?;
            Some((ss, col_str(r, "id")))
        })
        .collect();

    for row in &rows {
        let paper_id = col_str(row, "id");
        let title = col_str(row, "title");
        let year = col_opt_i32(row, "year");
        let refs_json = col_str(row, "references_json");

        // ライブラリノードを追加
        if seen_nodes.insert(paper_id.clone()) {
            nodes.push(serde_json::json!({
                "id": paper_id,
                "title": title,
                "type": "library",
                "year": year,
            }));
        }

        // references を展開
        let references: Vec<CitationEntry> =
            serde_json::from_str(&refs_json).unwrap_or_default();

        for entry in &references {
            let ref_node_id = if let Some(ref ss_id) = entry.ss_paper_id {
                // ライブラリ内に対応する論文があればそちらのIDを使う
                if let Some(local_id) = ss_to_local.get(ss_id) {
                    local_id.clone()
                } else {
                    format!("ss:{}", ss_id)
                }
            } else {
                format!("ext:{}", entry.title.chars().take(40).collect::<String>())
            };

            // 参照先ノードを追加（未登録なら）
            if seen_nodes.insert(ref_node_id.clone()) {
                let node_type = if ss_to_local
                    .get(entry.ss_paper_id.as_deref().unwrap_or(""))
                    .is_some()
                {
                    "library"
                } else {
                    "reference"
                };

                nodes.push(serde_json::json!({
                    "id": ref_node_id,
                    "title": entry.title,
                    "type": node_type,
                    "year": entry.year,
                }));
            }

            // エッジを追加（paper_id → ref_node_id = "cites"）
            edges.push(serde_json::json!({
                "source": paper_id,
                "target": ref_node_id,
                "type": "cites",
            }));
        }
    }

    Ok(serde_json::json!({
        "nodes": nodes,
        "edges": edges,
    }))
}

// ════════════════════════════════════════════════════════════
// エクスポート — BibTeX
// ════════════════════════════════════════════════════════════

/// BibTeX 用の cite key を生成する
fn generate_cite_key(authors: &[String], year: Option<i32>) -> String {
    let first_author = authors
        .first()
        .map(|a| {
            // "Last, First" or "First Last" から姓を取得
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

    let year_str = year.map(|y| y.to_string()).unwrap_or_else(|| "XXXX".to_string());

    // ASCII 英数字のみにサニタイズ
    let sanitized: String = first_author
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect();

    format!("{}{}", sanitized, year_str)
}

/// BibTeX 形式の著者文字列を生成する
fn format_bibtex_authors(authors: &[String]) -> String {
    authors
        .iter()
        .map(|a| {
            // "First Last" → "Last, First" 形式に変換（既に逆なら維持）
            if a.contains(',') {
                a.clone()
            } else {
                let parts: Vec<&str> = a.split_whitespace().collect();
                if parts.len() >= 2 {
                    let last = parts.last().unwrap();
                    let first = parts[..parts.len() - 1].join(" ");
                    format!("{}, {}", last, first)
                } else {
                    a.clone()
                }
            }
        })
        .collect::<Vec<_>>()
        .join(" and ")
}

/// 選択した論文を BibTeX 形式でエクスポートする
#[tauri::command]
pub async fn export_bibtex(app: AppHandle, paper_ids: Vec<String>) -> Result<String, String> {
    let pool = get_pool(&app)?;
    let mut output = String::new();

    for pid in &paper_ids {
        let row = sqlx::query("SELECT * FROM papers WHERE id = ?")
            .bind(pid)
            .fetch_optional(pool.as_ref())
            .await
            .map_err(|e| format!("論文の取得に失敗: {}", e))?;

        let row = match row {
            Some(r) => r,
            None => continue,
        };

        let paper = parse_paper_sqlx(&row)?;
        let cite_key = generate_cite_key(&paper.authors, paper.year);

        // エントリタイプ: journal があれば @article、なければ @misc
        let entry_type = if paper.journal.is_some() {
            "article"
        } else {
            "misc"
        };

        output.push_str(&format!("@{}{{{},\n", entry_type, cite_key));
        output.push_str(&format!(
            "  author  = {{{}}},\n",
            format_bibtex_authors(&paper.authors)
        ));
        output.push_str(&format!("  title   = {{{}}},\n", paper.title));

        if let Some(ref journal) = paper.journal {
            output.push_str(&format!("  journal = {{{}}},\n", journal));
        }
        if let Some(year) = paper.year {
            output.push_str(&format!("  year    = {{{}}},\n", year));
        }
        if let Some(ref volume) = paper.volume {
            output.push_str(&format!("  volume  = {{{}}},\n", volume));
        }
        if let Some(ref issue) = paper.issue {
            output.push_str(&format!("  number  = {{{}}},\n", issue));
        }
        if let Some(ref pages) = paper.pages {
            output.push_str(&format!("  pages   = {{{}}},\n", pages));
        }
        if let Some(ref doi) = paper.doi {
            output.push_str(&format!("  doi     = {{{}}},\n", doi));
        }
        if let Some(ref url) = paper.url {
            output.push_str(&format!("  url     = {{{}}},\n", url));
        }

        output.push_str("}\n\n");
    }

    Ok(output)
}

// ════════════════════════════════════════════════════════════
// エクスポート — RIS
// ════════════════════════════════════════════════════════════

/// 選択した論文を RIS 形式でエクスポートする
#[tauri::command]
pub async fn export_ris(app: AppHandle, paper_ids: Vec<String>) -> Result<String, String> {
    let pool = get_pool(&app)?;
    let mut output = String::new();

    for pid in &paper_ids {
        let row = sqlx::query("SELECT * FROM papers WHERE id = ?")
            .bind(pid)
            .fetch_optional(pool.as_ref())
            .await
            .map_err(|e| format!("論文の取得に失敗: {}", e))?;

        let row = match row {
            Some(r) => r,
            None => continue,
        };

        let paper = parse_paper_sqlx(&row)?;

        // エントリタイプ: journal があれば JOUR、なければ GEN
        let ris_type = if paper.journal.is_some() {
            "JOUR"
        } else {
            "GEN"
        };

        output.push_str(&format!("TY  - {}\n", ris_type));

        // 著者（各著者1行）
        for author in &paper.authors {
            // RIS 形式: "Last, First"
            if author.contains(',') {
                output.push_str(&format!("AU  - {}\n", author));
            } else {
                let parts: Vec<&str> = author.split_whitespace().collect();
                if parts.len() >= 2 {
                    let last = parts.last().unwrap();
                    let first = parts[..parts.len() - 1].join(" ");
                    output.push_str(&format!("AU  - {}, {}\n", last, first));
                } else {
                    output.push_str(&format!("AU  - {}\n", author));
                }
            }
        }

        output.push_str(&format!("TI  - {}\n", paper.title));

        if let Some(ref journal) = paper.journal {
            output.push_str(&format!("JO  - {}\n", journal));
        }
        if let Some(year) = paper.year {
            output.push_str(&format!("PY  - {}\n", year));
        }
        if let Some(ref volume) = paper.volume {
            output.push_str(&format!("VL  - {}\n", volume));
        }
        if let Some(ref issue) = paper.issue {
            output.push_str(&format!("IS  - {}\n", issue));
        }
        if let Some(ref pages) = paper.pages {
            // ページ範囲を SP/EP に分割
            if pages.contains('-') {
                let parts: Vec<&str> = pages.splitn(2, '-').collect();
                output.push_str(&format!("SP  - {}\n", parts[0].trim()));
                if parts.len() > 1 {
                    output.push_str(&format!("EP  - {}\n", parts[1].trim()));
                }
            } else {
                output.push_str(&format!("SP  - {}\n", pages));
            }
        }
        if let Some(ref doi) = paper.doi {
            output.push_str(&format!("DO  - {}\n", doi));
        }
        if let Some(ref url) = paper.url {
            output.push_str(&format!("UR  - {}\n", url));
        }
        if let Some(ref abs) = paper.r#abstract {
            output.push_str(&format!("AB  - {}\n", abs));
        }

        output.push_str("ER  - \n\n");
    }

    Ok(output)
}
