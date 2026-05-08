// src-tauri/src/commands/export.rs
// Stellar — エクスポート・インポートコマンド
// 静的サイト生成・Stellar パッケージ(.zip)エクスポート/インポートを提供

use crate::db::get_pool;
use crate::db::models::*;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::collections::HashMap;
use std::io::{Read as IoRead, Write as IoWrite};
use tauri::{AppHandle, Manager};

// ============================================================
// HTML テンプレート定数
// ============================================================

const HTML_TEMPLATE: &str = r#"<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{TITLE}}</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <nav class="sidebar">
        <div class="site-title">{{SITE_TITLE}}</div>
        <ul class="nav-list">
            {{NAV_ITEMS}}
        </ul>
    </nav>
    <main class="content">
        <article>
            <h1>{{TITLE}}</h1>
            <div class="meta">
                <time>{{DATE}}</time>
                {{TAGS}}
            </div>
            <div class="body">
                {{BODY}}
            </div>
            {{BACKLINKS}}
        </article>
    </main>
</body>
</html>"#;

const CSS_TEMPLATE: &str = r#":root {
    --bg: #ffffff;
    --fg: #1a1a2e;
    --sidebar-bg: #f0f0f5;
    --sidebar-fg: #333;
    --link: #4361ee;
    --link-hover: #3a0ca3;
    --border: #e0e0e0;
    --code-bg: #f5f5f5;
    --blockquote-border: #4361ee;
    --tag-bg: #e8eaf6;
    --tag-fg: #3949ab;
    --accent: #4361ee;
}

@media (prefers-color-scheme: dark) {
    :root {
        --bg: #1a1a2e;
        --fg: #e0e0e0;
        --sidebar-bg: #16213e;
        --sidebar-fg: #c0c0c0;
        --link: #7b9ef5;
        --link-hover: #a5b4fc;
        --border: #2a2a4a;
        --code-bg: #2a2a4a;
        --blockquote-border: #7b9ef5;
        --tag-bg: #2a2a4a;
        --tag-fg: #a5b4fc;
        --accent: #7b9ef5;
    }
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
    font-family: "Inter", "Noto Sans JP", -apple-system, BlinkMacSystemFont, sans-serif;
    background: var(--bg);
    color: var(--fg);
    display: flex;
    min-height: 100vh;
    line-height: 1.7;
}

.sidebar {
    width: 260px;
    min-height: 100vh;
    background: var(--sidebar-bg);
    color: var(--sidebar-fg);
    padding: 1.5rem 1rem;
    border-right: 1px solid var(--border);
    position: fixed;
    top: 0;
    left: 0;
    overflow-y: auto;
}

.site-title {
    font-size: 1.25rem;
    font-weight: 700;
    margin-bottom: 1.5rem;
    color: var(--accent);
}

.nav-list {
    list-style: none;
}

.nav-list li {
    margin-bottom: 0.25rem;
}

.nav-list a {
    color: var(--sidebar-fg);
    text-decoration: none;
    display: block;
    padding: 0.35rem 0.5rem;
    border-radius: 4px;
    font-size: 0.9rem;
    transition: background 0.15s;
}

.nav-list a:hover {
    background: var(--border);
}

.content {
    margin-left: 260px;
    max-width: 760px;
    padding: 2.5rem 2rem;
    flex: 1;
}

article h1 {
    font-size: 2rem;
    margin-bottom: 0.5rem;
    line-height: 1.3;
}

.meta {
    color: var(--sidebar-fg);
    font-size: 0.85rem;
    margin-bottom: 2rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
}

.tag {
    background: var(--tag-bg);
    color: var(--tag-fg);
    padding: 0.15rem 0.5rem;
    border-radius: 3px;
    font-size: 0.8rem;
}

.body h2 { font-size: 1.5rem; margin: 2rem 0 0.75rem; }
.body h3 { font-size: 1.25rem; margin: 1.5rem 0 0.5rem; }
.body p { margin-bottom: 1rem; }

.body a {
    color: var(--link);
    text-decoration: underline;
    text-underline-offset: 2px;
}

.body a:hover { color: var(--link-hover); }

.body blockquote {
    border-left: 3px solid var(--blockquote-border);
    padding: 0.5rem 1rem;
    margin: 1rem 0;
    background: var(--code-bg);
    border-radius: 0 4px 4px 0;
}

.body code {
    background: var(--code-bg);
    padding: 0.15rem 0.35rem;
    border-radius: 3px;
    font-size: 0.9em;
}

.body pre {
    background: var(--code-bg);
    padding: 1rem;
    border-radius: 6px;
    overflow-x: auto;
    margin: 1rem 0;
}

.body pre code {
    background: none;
    padding: 0;
}

.body img {
    max-width: 100%;
    height: auto;
    border-radius: 6px;
    margin: 1rem 0;
}

.body hr {
    border: none;
    border-top: 1px solid var(--border);
    margin: 2rem 0;
}

.body ul, .body ol { margin: 0.5rem 0 1rem 1.5rem; }
.body li { margin-bottom: 0.25rem; }

.body table {
    border-collapse: collapse;
    width: 100%;
    margin: 1rem 0;
}

.body th, .body td {
    border: 1px solid var(--border);
    padding: 0.5rem 0.75rem;
    text-align: left;
}

.body th {
    background: var(--code-bg);
    font-weight: 600;
}

.backlinks {
    margin-top: 3rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border);
}

.backlinks h2 {
    font-size: 1.1rem;
    margin-bottom: 0.75rem;
    color: var(--sidebar-fg);
}

.backlinks ul {
    list-style: none;
}

.backlinks li {
    margin-bottom: 0.35rem;
}

.backlinks a {
    color: var(--link);
    text-decoration: none;
}

.backlinks a:hover {
    text-decoration: underline;
}

@media (max-width: 768px) {
    .sidebar { display: none; }
    .content { margin-left: 0; padding: 1.5rem 1rem; }
}
"#;

// ============================================================
// ヘルパー関数
// ============================================================

/// タイトルを URL セーフなスラッグに変換する
fn slugify(title: &str) -> String {
    let slug: String = title
        .to_lowercase()
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' {
                c
            } else if c.is_whitespace() {
                '-'
            } else if c as u32 > 127 {
                // 非ASCII文字（日本語等）はそのまま残す
                c
            } else {
                '-'
            }
        })
        .collect();

    // 連続するハイフンを1つにまとめる
    let mut result = String::new();
    let mut prev_hyphen = false;
    for c in slug.chars() {
        if c == '-' {
            if !prev_hyphen {
                result.push(c);
                prev_hyphen = true;
            }
        } else {
            result.push(c);
            prev_hyphen = false;
        }
    }
    result.trim_matches('-').to_string()
}

/// Markdown を HTML に変換する（pulldown-cmark 使用）
fn markdown_to_html(md: &str) -> String {
    use pulldown_cmark::{html, Options, Parser};

    let options = Options::ENABLE_TABLES
        | Options::ENABLE_FOOTNOTES
        | Options::ENABLE_STRIKETHROUGH
        | Options::ENABLE_TASKLISTS;

    let parser = Parser::new_ext(md, options);
    let mut html_output = String::new();
    html::push_html(&mut html_output, parser);
    html_output
}

/// [[WikiLink]] を <a> タグに変換する
fn replace_wikilinks(html: &str, slug_map: &HashMap<String, String>) -> String {
    let mut result = String::new();
    let mut remaining = html;

    while let Some(start) = remaining.find("[[") {
        result.push_str(&remaining[..start]);
        let after_open = &remaining[start + 2..];
        if let Some(end) = after_open.find("]]") {
            let link_text = &after_open[..end];
            let slug = slugify(link_text);
            let href = slug_map
                .get(&slug)
                .map(|s| format!("{}.html", s))
                .unwrap_or_else(|| format!("{}.html", slug));
            result.push_str(&format!(
                "<a href=\"{}\" class=\"wikilink\">{}</a>",
                href, link_text
            ));
            remaining = &after_open[end + 2..];
        } else {
            result.push_str("[[");
            remaining = after_open;
        }
    }
    result.push_str(remaining);
    result
}

// ============================================================
// export_static_site — 静的サイトとしてノートをエクスポート
// ============================================================

#[tauri::command]
pub async fn export_static_site(
    app: AppHandle,
    note_ids: Vec<String>,
    output_dir: String,
    site_title: String,
    include_backlinks: bool,
    theme: String,
) -> Result<String, String> {
    let pool = get_pool(&app)?;

    if note_ids.is_empty() {
        return Err("エクスポートするノートが指定されていません".to_string());
    }

    // ノートを取得
    let placeholders: Vec<String> = note_ids.iter().map(|_| "?".to_string()).collect();
    let in_clause = placeholders.join(", ");
    let sql = format!(
        "SELECT * FROM notes WHERE id IN ({}) ORDER BY updated_at DESC",
        in_clause
    );
    let mut query = sqlx::query(&sql);
    for id in &note_ids {
        query = query.bind(id);
    }
    let rows = query
        .fetch_all(pool.as_ref())
        .await
        .map_err(|e| format!("ノートの取得に失敗: {}", e))?;

    if rows.is_empty() {
        return Err("指定されたノートが見つかりません".to_string());
    }

    let notes: Vec<NoteResponse> = rows
        .iter()
        .map(parse_note_sqlx)
        .collect::<Result<Vec<_>, _>>()?;

    // スラッグマップを構築（タイトル → slug）
    let mut slug_map: HashMap<String, String> = HashMap::new();
    for note in &notes {
        let slug = slugify(&note.title);
        slug_map.insert(note.title.to_lowercase(), slug.clone());
        slug_map.insert(slug.clone(), slug);
    }

    // バックリンク情報を取得（オプション）
    let mut backlinks_map: HashMap<String, Vec<LinkWithSource>> = HashMap::new();
    if include_backlinks {
        for note in &notes {
            let backlinks = crate::commands::links::fetch_backlinks_for(
                pool.as_ref(),
                "note",
                &note.id,
            )
            .await
            .unwrap_or_default();
            backlinks_map.insert(note.id.clone(), backlinks);
        }
    }

    // 出力ディレクトリを作成
    std::fs::create_dir_all(&output_dir)
        .map_err(|e| format!("出力ディレクトリの作成に失敗: {}", e))?;

    // ナビゲーションアイテムを生成
    let nav_items: String = notes
        .iter()
        .map(|n| {
            let slug = slugify(&n.title);
            format!(
                "            <li><a href=\"{}.html\">{}</a></li>",
                slug, n.title
            )
        })
        .collect::<Vec<_>>()
        .join("\n");

    // 各ノートを HTML ファイルとして出力
    for note in &notes {
        let slug = slugify(&note.title);

        // Markdown → HTML 変換
        let body_html = markdown_to_html(&note.content);
        let body_html = replace_wikilinks(&body_html, &slug_map);

        // タグ HTML
        let tags_html = if note.tags.is_empty() {
            String::new()
        } else {
            note.tags
                .iter()
                .map(|t| format!("<span class=\"tag\">{}</span>", t))
                .collect::<Vec<_>>()
                .join(" ")
        };

        // バックリンク HTML
        let backlinks_html = if include_backlinks {
            if let Some(bls) = backlinks_map.get(&note.id) {
                if bls.is_empty() {
                    String::new()
                } else {
                    let items: String = bls
                        .iter()
                        .map(|bl| {
                            let bl_slug = slugify(&bl.source_title);
                            format!(
                                "            <li><a href=\"{}.html\">{}</a></li>",
                                bl_slug, bl.source_title
                            )
                        })
                        .collect::<Vec<_>>()
                        .join("\n");
                    format!(
                        "<section class=\"backlinks\">\n        <h2>Backlinks</h2>\n        <ul>\n{}\n        </ul>\n    </section>",
                        items
                    )
                }
            } else {
                String::new()
            }
        } else {
            String::new()
        };

        // テンプレートを適用
        let html = HTML_TEMPLATE
            .replace("{{TITLE}}", &note.title)
            .replace("{{SITE_TITLE}}", &site_title)
            .replace("{{NAV_ITEMS}}", &nav_items)
            .replace("{{DATE}}", &note.updated_at)
            .replace("{{TAGS}}", &tags_html)
            .replace("{{BODY}}", &body_html)
            .replace("{{BACKLINKS}}", &backlinks_html);

        let file_path = std::path::Path::new(&output_dir).join(format!("{}.html", slug));
        std::fs::write(&file_path, html)
            .map_err(|e| format!("HTML ファイルの書き込みに失敗: {}", e))?;
    }

    // index.html を生成
    let index_body = notes
        .iter()
        .map(|n| {
            let slug = slugify(&n.title);
            let preview: String = n.content.chars().take(120).collect();
            format!(
                "<div class=\"note-card\"><h2><a href=\"{}.html\">{}</a></h2><p>{}</p><time>{}</time></div>",
                slug, n.title, preview, n.updated_at
            )
        })
        .collect::<Vec<_>>()
        .join("\n            ");

    let index_html = HTML_TEMPLATE
        .replace("{{TITLE}}", &site_title)
        .replace("{{SITE_TITLE}}", &site_title)
        .replace("{{NAV_ITEMS}}", &nav_items)
        .replace("{{DATE}}", "")
        .replace("{{TAGS}}", "")
        .replace("{{BODY}}", &index_body)
        .replace("{{BACKLINKS}}", "");

    let index_path = std::path::Path::new(&output_dir).join("index.html");
    std::fs::write(&index_path, index_html)
        .map_err(|e| format!("index.html の書き込みに失敗: {}", e))?;

    // CSS テーマ: "light" / "dark" / "auto"(default) に対応
    let css_content = match theme.as_str() {
        "light" => CSS_TEMPLATE
            .replace("@media (prefers-color-scheme: dark) {", "/* dark theme disabled */\n@media (prefers-color-scheme: __disabled__) {"),
        "dark" => {
            // dark テーマの値をデフォルトにする
            CSS_TEMPLATE
                .replace("--bg: #ffffff;", "--bg: #1a1a2e;")
                .replace("--fg: #1a1a2e;", "--fg: #e0e0e0;")
                .replace("--sidebar-bg: #f0f0f5;", "--sidebar-bg: #16213e;")
                .replace("--sidebar-fg: #333;", "--sidebar-fg: #c0c0c0;")
                .replace("--link: #4361ee;", "--link: #7b9ef5;")
                .replace("--link-hover: #3a0ca3;", "--link-hover: #a5b4fc;")
                .replace("--border: #e0e0e0;", "--border: #2a2a4a;")
                .replace("--code-bg: #f5f5f5;", "--code-bg: #2a2a4a;")
                .replace("--tag-bg: #e8eaf6;", "--tag-bg: #2a2a4a;")
                .replace("--tag-fg: #3949ab;", "--tag-fg: #a5b4fc;")
                .replace("--accent: #4361ee;", "--accent: #7b9ef5;")
        }
        _ => CSS_TEMPLATE.to_string(), // "auto" — メディアクエリで切替
    };

    let css_path = std::path::Path::new(&output_dir).join("styles.css");
    std::fs::write(&css_path, css_content)
        .map_err(|e| format!("styles.css の書き込みに失敗: {}", e))?;

    Ok(output_dir)
}

// ============================================================
// export_stellar_package — Stellar パッケージ (.zip) エクスポート
// ============================================================

/// マニフェスト構造
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PackageManifest {
    version: String,
    created_at: String,
    paper_count: usize,
    note_count: usize,
    highlight_count: usize,
    link_count: usize,
    includes_pdfs: bool,
}

#[tauri::command]
pub async fn export_stellar_package(
    app: AppHandle,
    paper_ids: Vec<String>,
    note_ids: Vec<String>,
    include_pdfs: bool,
    output_path: String,
) -> Result<String, String> {
    let pool = get_pool(&app)?;

    // 論文を取得
    let papers: Vec<PaperResponse> = if paper_ids.is_empty() {
        vec![]
    } else {
        let placeholders: Vec<String> = paper_ids.iter().map(|_| "?".to_string()).collect();
        let sql = format!("SELECT * FROM papers WHERE id IN ({})", placeholders.join(", "));
        let mut query = sqlx::query(&sql);
        for id in &paper_ids {
            query = query.bind(id);
        }
        let rows = query.fetch_all(pool.as_ref()).await.map_err(|e| format!("論文の取得に失敗: {}", e))?;
        rows.iter().map(parse_paper_sqlx).collect::<Result<Vec<_>, _>>()?
    };

    // ノートを取得
    let notes: Vec<NoteResponse> = if note_ids.is_empty() {
        vec![]
    } else {
        let placeholders: Vec<String> = note_ids.iter().map(|_| "?".to_string()).collect();
        let sql = format!("SELECT * FROM notes WHERE id IN ({})", placeholders.join(", "));
        let mut query = sqlx::query(&sql);
        for id in &note_ids {
            query = query.bind(id);
        }
        let rows = query.fetch_all(pool.as_ref()).await.map_err(|e| format!("ノートの取得に失敗: {}", e))?;
        rows.iter().map(parse_note_sqlx).collect::<Result<Vec<_>, _>>()?
    };

    // ハイライトを取得（紐づく論文の分）
    let highlights: Vec<HighlightResponse> = if paper_ids.is_empty() {
        vec![]
    } else {
        let placeholders: Vec<String> = paper_ids.iter().map(|_| "?".to_string()).collect();
        let sql = format!(
            "SELECT * FROM highlights WHERE paper_id IN ({}) ORDER BY paper_id, page, created_at",
            placeholders.join(", ")
        );
        let mut query = sqlx::query(&sql);
        for id in &paper_ids {
            query = query.bind(id);
        }
        let rows = query.fetch_all(pool.as_ref()).await.map_err(|e| format!("ハイライトの取得に失敗: {}", e))?;
        rows.iter().map(parse_highlight_sqlx).collect::<Result<Vec<_>, _>>()?
    };

    // リンクを取得（関連する論文・ノート）
    let all_ids: Vec<&String> = paper_ids.iter().chain(note_ids.iter()).collect();
    let links: Vec<LinkResponse> = if all_ids.is_empty() {
        vec![]
    } else {
        let placeholders: Vec<String> = all_ids.iter().map(|_| "?".to_string()).collect();
        let phs = placeholders.join(", ");
        let sql = format!(
            "SELECT * FROM links WHERE source_id IN ({}) OR target_id IN ({})",
            phs, phs
        );
        let mut query = sqlx::query(&sql);
        for id in &all_ids {
            query = query.bind(*id);
        }
        for id in &all_ids {
            query = query.bind(*id);
        }
        let rows = query.fetch_all(pool.as_ref()).await.map_err(|e| format!("リンクの取得に失敗: {}", e))?;
        rows.iter().map(parse_link_sqlx).collect::<Result<Vec<_>, _>>()?
    };

    // ZIP ファイルを作成
    let file = std::fs::File::create(&output_path)
        .map_err(|e| format!("ZIP ファイルの作成に失敗: {}", e))?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    // manifest.json
    let manifest = PackageManifest {
        version: "1.0.0".to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
        paper_count: papers.len(),
        note_count: notes.len(),
        highlight_count: highlights.len(),
        link_count: links.len(),
        includes_pdfs: include_pdfs,
    };
    let manifest_json = serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?;
    zip.start_file("manifest.json", options)
        .map_err(|e| format!("ZIP 書き込みに失敗: {}", e))?;
    zip.write_all(manifest_json.as_bytes())
        .map_err(|e| format!("ZIP 書き込みに失敗: {}", e))?;

    // papers.json
    let papers_json = serde_json::to_string_pretty(&papers).map_err(|e| e.to_string())?;
    zip.start_file("papers.json", options)
        .map_err(|e| format!("ZIP 書き込みに失敗: {}", e))?;
    zip.write_all(papers_json.as_bytes())
        .map_err(|e| format!("ZIP 書き込みに失敗: {}", e))?;

    // notes.json
    let notes_json = serde_json::to_string_pretty(&notes).map_err(|e| e.to_string())?;
    zip.start_file("notes.json", options)
        .map_err(|e| format!("ZIP 書き込みに失敗: {}", e))?;
    zip.write_all(notes_json.as_bytes())
        .map_err(|e| format!("ZIP 書き込みに失敗: {}", e))?;

    // highlights.json
    let highlights_json = serde_json::to_string_pretty(&highlights).map_err(|e| e.to_string())?;
    zip.start_file("highlights.json", options)
        .map_err(|e| format!("ZIP 書き込みに失敗: {}", e))?;
    zip.write_all(highlights_json.as_bytes())
        .map_err(|e| format!("ZIP 書き込みに失敗: {}", e))?;

    // links.json
    let links_json = serde_json::to_string_pretty(&links).map_err(|e| e.to_string())?;
    zip.start_file("links.json", options)
        .map_err(|e| format!("ZIP 書き込みに失敗: {}", e))?;
    zip.write_all(links_json.as_bytes())
        .map_err(|e| format!("ZIP 書き込みに失敗: {}", e))?;

    // PDF ファイルを含める（オプション）
    if include_pdfs {
        for paper in &papers {
            if let Some(ref pdf_path) = paper.pdf_path {
                if std::path::Path::new(pdf_path).exists() {
                    let pdf_data = std::fs::read(pdf_path)
                        .map_err(|e| format!("PDF の読み込みに失敗 ({}): {}", pdf_path, e))?;
                    let filename = std::path::Path::new(pdf_path)
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy();
                    zip.start_file(format!("pdfs/{}", filename), options)
                        .map_err(|e| format!("ZIP 書き込みに失敗: {}", e))?;
                    zip.write_all(&pdf_data)
                        .map_err(|e| format!("ZIP 書き込みに失敗: {}", e))?;
                }
            }
        }
    }

    zip.finish()
        .map_err(|e| format!("ZIP ファイルの完了に失敗: {}", e))?;

    Ok(output_path)
}

// ============================================================
// import_stellar_package — Stellar パッケージ (.zip) インポート
// ============================================================

/// インポート結果
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub papers_imported: usize,
    pub notes_imported: usize,
    pub highlights_imported: usize,
    pub links_imported: usize,
    pub pdfs_extracted: usize,
    pub conflicts: Vec<ImportConflict>,
}

/// インポート競合情報
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportConflict {
    pub item_type: String,
    pub original_id: String,
    pub title: String,
    pub reason: String,
}

#[tauri::command]
pub async fn import_stellar_package(
    app: AppHandle,
    package_path: String,
) -> Result<ImportResult, String> {
    let pool = get_pool(&app)?;

    let file = std::fs::File::open(&package_path)
        .map_err(|e| format!("ZIP ファイルを開けません: {}", e))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("ZIP アーカイブの読み込みに失敗: {}", e))?;

    // manifest.json を読み込み・検証
    let manifest: PackageManifest = {
        let mut entry = archive
            .by_name("manifest.json")
            .map_err(|_| "manifest.json が見つかりません".to_string())?;
        let mut buf = String::new();
        entry
            .read_to_string(&mut buf)
            .map_err(|e| format!("manifest.json の読み込みに失敗: {}", e))?;
        serde_json::from_str(&buf).map_err(|e| format!("manifest.json のパースに失敗: {}", e))?
    };

    // バージョンチェック
    if !manifest.version.starts_with("1.") {
        return Err(format!(
            "非対応のパッケージバージョン: {}",
            manifest.version
        ));
    }

    let mut result = ImportResult {
        papers_imported: 0,
        notes_imported: 0,
        highlights_imported: 0,
        links_imported: 0,
        pdfs_extracted: 0,
        conflicts: Vec::new(),
    };

    // ID マッピング（旧ID → 新ID）
    let mut id_map: HashMap<String, String> = HashMap::new();

    // ────────────────────────────────────────────────────────
    // 同期フェーズ: ZIPエントリ（!Send な ZipFile）からJSONを読み出し・パースする。
    // ZipFile は await をまたげないため、全データを先に読み込む。
    // ────────────────────────────────────────────────────────

    let papers: Vec<PaperResponse> = {
        if let Ok(mut entry) = archive.by_name("papers.json") {
            let mut buf = String::new();
            entry.read_to_string(&mut buf).map_err(|e| e.to_string())?;
            serde_json::from_str(&buf)
                .map_err(|e| format!("papers.json のパースに失敗: {}", e))?
        } else {
            Vec::new()
        }
    };

    let notes: Vec<NoteResponse> = {
        if let Ok(mut entry) = archive.by_name("notes.json") {
            let mut buf = String::new();
            entry.read_to_string(&mut buf).map_err(|e| e.to_string())?;
            serde_json::from_str(&buf)
                .map_err(|e| format!("notes.json のパースに失敗: {}", e))?
        } else {
            Vec::new()
        }
    };

    let highlights: Vec<HighlightResponse> = {
        if let Ok(mut entry) = archive.by_name("highlights.json") {
            let mut buf = String::new();
            entry.read_to_string(&mut buf).map_err(|e| e.to_string())?;
            serde_json::from_str(&buf)
                .map_err(|e| format!("highlights.json のパースに失敗: {}", e))?
        } else {
            Vec::new()
        }
    };

    let links: Vec<LinkResponse> = {
        if let Ok(mut entry) = archive.by_name("links.json") {
            let mut buf = String::new();
            entry.read_to_string(&mut buf).map_err(|e| e.to_string())?;
            serde_json::from_str(&buf)
                .map_err(|e| format!("links.json のパースに失敗: {}", e))?
        } else {
            Vec::new()
        }
    };

    // PDF ファイルを展開（同期 — ZipFile は !Send なのでここで完了させる）
    if manifest.includes_pdfs {
        let app_path = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("アプリデータディレクトリの取得に失敗: {}", e))?;
        let pdfs_dir = app_path.join("pdfs");
        std::fs::create_dir_all(&pdfs_dir)
            .map_err(|e| format!("PDF ディレクトリの作成に失敗: {}", e))?;

        for i in 0..archive.len() {
            let mut entry = archive
                .by_index(i)
                .map_err(|e| format!("ZIP エントリの読み込みに失敗: {}", e))?;
            let entry_name = entry.name().to_string();

            if entry_name.starts_with("pdfs/") && entry_name.len() > 5 {
                let filename = &entry_name[5..];
                let dest_path = pdfs_dir.join(filename);

                let mut pdf_data = Vec::new();
                entry
                    .read_to_end(&mut pdf_data)
                    .map_err(|e| format!("PDF の読み込みに失敗: {}", e))?;
                std::fs::write(&dest_path, &pdf_data)
                    .map_err(|e| format!("PDF の書き込みに失敗: {}", e))?;

                result.pdfs_extracted += 1;
            }
        }
    }

    // archive はこれ以降使わないので明示的にドロップ（!Send を完全に排除）
    drop(archive);

    // ────────────────────────────────────────────────────────
    // 非同期フェーズ: パース済みデータを DB に書き込む（.await が必要）
    // ────────────────────────────────────────────────────────

    // papers のインポート
    for paper in papers {
        // DOI で既存論文をチェック
        if let Some(ref doi) = paper.doi {
            let existing = sqlx::query("SELECT id FROM papers WHERE doi = ?")
                .bind(doi)
                .fetch_optional(pool.as_ref())
                .await
                .map_err(|e| format!("DOI チェックに失敗: {}", e))?;

            if let Some(row) = existing {
                let existing_id: String = row.try_get("id").unwrap_or_default();
                id_map.insert(paper.id.clone(), existing_id);
                result.conflicts.push(ImportConflict {
                    item_type: "paper".to_string(),
                    original_id: paper.id.clone(),
                    title: paper.title.clone(),
                    reason: format!("DOI 重複: {}", doi),
                });
                continue;
            }
        }

        let new_id = uuid::Uuid::new_v4().to_string();
        id_map.insert(paper.id.clone(), new_id.clone());
        let now = chrono::Utc::now().to_rfc3339();
        let authors_json = serde_json::to_string(&paper.authors).unwrap_or("[]".to_string());
        let tags_json = serde_json::to_string(&paper.tags).unwrap_or("[]".to_string());

        sqlx::query(
            "INSERT INTO papers (id, title, authors, year, journal, volume, issue, pages, doi, url, abstract, pdf_path, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&new_id)
        .bind(&paper.title)
        .bind(&authors_json)
        .bind(paper.year)
        .bind(&paper.journal)
        .bind(&paper.volume)
        .bind(&paper.issue)
        .bind(&paper.pages)
        .bind(&paper.doi)
        .bind(&paper.url)
        .bind(&paper.r#abstract)
        .bind::<Option<&str>>(None) // pdf_path は後で設定
        .bind(&tags_json)
        .bind(&now)
        .bind(&now)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("論文のインポートに失敗: {}", e))?;

        result.papers_imported += 1;
    }

    // notes のインポート
    for note in notes {
        let new_id = uuid::Uuid::new_v4().to_string();
        id_map.insert(note.id.clone(), new_id.clone());
        let now = chrono::Utc::now().to_rfc3339();
        let tags_json = serde_json::to_string(&note.tags).unwrap_or("[]".to_string());
        let mapped_paper_id = note
            .paper_id
            .as_ref()
            .and_then(|pid| id_map.get(pid).cloned().or(Some(pid.clone())));

        sqlx::query(
            "INSERT INTO notes (id, title, content, paper_id, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&new_id)
        .bind(&note.title)
        .bind(&note.content)
        .bind(&mapped_paper_id)
        .bind(&tags_json)
        .bind(&now)
        .bind(&now)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("ノートのインポートに失敗: {}", e))?;

        result.notes_imported += 1;
    }

    // highlights のインポート
    for hl in highlights {
        let new_id = uuid::Uuid::new_v4().to_string();
        id_map.insert(hl.id.clone(), new_id.clone());
        let mapped_paper_id = id_map
            .get(&hl.paper_id)
            .cloned()
            .unwrap_or(hl.paper_id.clone());
        let rect_json = serde_json::to_string(&hl.rect).unwrap_or("{}".to_string());
        let now = chrono::Utc::now().to_rfc3339();

        sqlx::query(
            "INSERT INTO highlights (id, paper_id, text, comment, color, page, rect, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&new_id)
        .bind(&mapped_paper_id)
        .bind(&hl.text)
        .bind(&hl.comment)
        .bind(&hl.color)
        .bind(hl.page)
        .bind(&rect_json)
        .bind(&now)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("ハイライトのインポートに失敗: {}", e))?;

        result.highlights_imported += 1;
    }

    // links のインポート
    for link in links {
        let new_id = uuid::Uuid::new_v4().to_string();
        let mapped_source = id_map
            .get(&link.source_id)
            .cloned()
            .unwrap_or(link.source_id.clone());
        let mapped_target = id_map
            .get(&link.target_id)
            .cloned()
            .unwrap_or(link.target_id.clone());
        let now = chrono::Utc::now().to_rfc3339();

        sqlx::query(
            "INSERT INTO links (id, source_type, source_id, target_type, target_id, context, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&new_id)
        .bind(&link.source_type)
        .bind(&mapped_source)
        .bind(&link.target_type)
        .bind(&mapped_target)
        .bind(&link.context)
        .bind(&now)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("リンクのインポートに失敗: {}", e))?;

        result.links_imported += 1;
    }

    Ok(result)
}
