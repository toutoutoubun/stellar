// src-tauri/src/commands/migration.rs
// Stellar — 外部データ移行コマンド
// BibTeX / RIS / Zotero CSV インポート、Obsidian Vault インポートを提供する

use crate::db::get_pool;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::collections::HashMap;
use tauri::AppHandle;

// ============================================================
// 共通レスポンス型
// ============================================================

/// インポート結果
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationResult {
    pub papers_imported: usize,
    pub notes_imported: usize,
    pub papers_skipped: usize,
    pub notes_skipped: usize,
    pub errors: Vec<String>,
}

/// プレビュー用の解析済みエントリ
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedEntry {
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
    pub tags: Vec<String>,
    pub entry_type: String, // "article", "book", "inproceedings", etc.
}

/// Obsidian ノートプレビュー
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedNote {
    pub title: String,
    pub content: String,
    pub tags: Vec<String>,
    pub source_path: String,
}

/// プレビュー結果
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewResult {
    pub entries: Vec<ParsedEntry>,
    pub notes: Vec<ParsedNote>,
    pub format_detected: String,
    pub total_count: usize,
}

// ============================================================
// BibTeX パーサー
// ============================================================

fn parse_bibtex(content: &str) -> Vec<ParsedEntry> {
    let mut entries = Vec::new();
    let mut chars = content.chars().peekable();

    while let Some(&ch) = chars.peek() {
        if ch == '@' {
            chars.next();
            if let Some(entry) = parse_bibtex_entry(&mut chars) {
                entries.push(entry);
            }
        } else {
            chars.next();
        }
    }

    entries
}

fn parse_bibtex_entry(
    chars: &mut std::iter::Peekable<std::str::Chars>,
) -> Option<ParsedEntry> {
    // エントリタイプを読む（例: article, book）
    let entry_type: String = chars
        .by_ref()
        .take_while(|c| c.is_alphanumeric() || *c == '_')
        .collect();

    let entry_type_lower = entry_type.to_lowercase();

    // @comment, @string, @preamble はスキップ
    if matches!(
        entry_type_lower.as_str(),
        "comment" | "string" | "preamble"
    ) {
        skip_braced_block(chars);
        return None;
    }

    // '{' を探す
    skip_whitespace(chars);
    if chars.peek() != Some(&'{') {
        return None;
    }
    chars.next(); // '{' を消費

    // citationキーを読む（最初のカンマまで）
    let _cite_key: String = chars
        .by_ref()
        .take_while(|c| *c != ',')
        .collect();

    // フィールドをパース
    let fields = parse_bibtex_fields(chars);

    let title = fields.get("title").cloned().unwrap_or_default();
    if title.is_empty() {
        return None;
    }

    let authors = fields
        .get("author")
        .map(|a| parse_bibtex_authors(a))
        .unwrap_or_default();

    let year = fields
        .get("year")
        .and_then(|y| y.trim().parse::<i32>().ok());

    let journal = fields
        .get("journal")
        .or_else(|| fields.get("booktitle"))
        .cloned()
        .filter(|s| !s.is_empty());

    let volume = fields.get("volume").cloned().filter(|s| !s.is_empty());
    let issue = fields
        .get("number")
        .or_else(|| fields.get("issue"))
        .cloned()
        .filter(|s| !s.is_empty());
    let pages = fields.get("pages").cloned().filter(|s| !s.is_empty());
    let doi = fields.get("doi").cloned().filter(|s| !s.is_empty());
    let url = fields.get("url").cloned().filter(|s| !s.is_empty());
    let r#abstract = fields.get("abstract").cloned().filter(|s| !s.is_empty());

    let mut tags = Vec::new();
    if let Some(kw) = fields.get("keywords").or_else(|| fields.get("keyword")) {
        for tag in kw.split([',', ';']) {
            let t = tag.trim().to_string();
            if !t.is_empty() {
                tags.push(t);
            }
        }
    }

    Some(ParsedEntry {
        title: clean_bibtex_value(&title),
        authors,
        year,
        journal: journal.map(|s| clean_bibtex_value(&s)),
        volume: volume.map(|s| clean_bibtex_value(&s)),
        issue: issue.map(|s| clean_bibtex_value(&s)),
        pages: pages.map(|s| clean_bibtex_value(&s)),
        doi: doi.map(|s| clean_bibtex_value(&s)),
        url: url.map(|s| clean_bibtex_value(&s)),
        r#abstract: r#abstract.map(|s| clean_bibtex_value(&s)),
        tags: tags.iter().map(|t| clean_bibtex_value(t)).collect(),
        entry_type: entry_type_lower,
    })
}

fn parse_bibtex_fields(
    chars: &mut std::iter::Peekable<std::str::Chars>,
) -> HashMap<String, String> {
    let mut fields = HashMap::new();
    let mut depth = 1i32;

    loop {
        skip_whitespace(chars);
        match chars.peek() {
            None => break,
            Some(&'}') => {
                chars.next();
                depth -= 1;
                if depth <= 0 {
                    break;
                }
            }
            Some(_) => {}
        }

        // フィールド名を読む
        let field_name: String = chars
            .by_ref()
            .take_while(|c| c.is_alphanumeric() || *c == '_' || *c == '-')
            .collect::<String>()
            .to_lowercase();

        if field_name.is_empty() {
            // 不明な文字をスキップ
            if let Some(&c) = chars.peek() {
                if c == '}' {
                    chars.next();
                    break;
                }
                chars.next();
            }
            continue;
        }

        // '=' を探す
        skip_whitespace(chars);
        if chars.peek() == Some(&'=') {
            chars.next();
        } else {
            continue;
        }

        // 値を読む
        skip_whitespace(chars);
        let value = read_bibtex_value(chars);

        if !field_name.is_empty() && !value.is_empty() {
            fields.insert(field_name, value);
        }

        // 後続のカンマをスキップ
        skip_whitespace(chars);
        if chars.peek() == Some(&',') {
            chars.next();
        }
    }

    fields
}

fn read_bibtex_value(chars: &mut std::iter::Peekable<std::str::Chars>) -> String {
    skip_whitespace(chars);
    match chars.peek() {
        Some(&'{') => {
            chars.next();
            read_braced_value(chars)
        }
        Some(&'"') => {
            chars.next();
            read_quoted_value(chars)
        }
        _ => {
            // 数値やマクロ（カンマ or '}' まで）
            let mut val = String::new();
            while let Some(&c) = chars.peek() {
                if c == ',' || c == '}' {
                    break;
                }
                val.push(c);
                chars.next();
            }
            val.trim().to_string()
        }
    }
}

fn read_braced_value(chars: &mut std::iter::Peekable<std::str::Chars>) -> String {
    let mut val = String::new();
    let mut depth = 1i32;
    while let Some(c) = chars.next() {
        match c {
            '{' => {
                depth += 1;
                val.push(c);
            }
            '}' => {
                depth -= 1;
                if depth == 0 {
                    break;
                }
                val.push(c);
            }
            _ => val.push(c),
        }
    }
    val
}

fn read_quoted_value(chars: &mut std::iter::Peekable<std::str::Chars>) -> String {
    let mut val = String::new();
    let mut depth = 0i32;
    while let Some(c) = chars.next() {
        match c {
            '{' => {
                depth += 1;
                val.push(c);
            }
            '}' => {
                depth -= 1;
                val.push(c);
            }
            '"' if depth == 0 => break,
            _ => val.push(c),
        }
    }
    val
}

fn skip_braced_block(chars: &mut std::iter::Peekable<std::str::Chars>) {
    while let Some(&c) = chars.peek() {
        if c == '{' {
            chars.next();
            let mut depth = 1i32;
            while let Some(c2) = chars.next() {
                match c2 {
                    '{' => depth += 1,
                    '}' => {
                        depth -= 1;
                        if depth == 0 {
                            return;
                        }
                    }
                    _ => {}
                }
            }
            return;
        }
        chars.next();
    }
}

fn skip_whitespace(chars: &mut std::iter::Peekable<std::str::Chars>) {
    while let Some(&c) = chars.peek() {
        if c.is_whitespace() {
            chars.next();
        } else {
            break;
        }
    }
}

fn parse_bibtex_authors(raw: &str) -> Vec<String> {
    let cleaned = clean_bibtex_value(raw);
    cleaned
        .split(" and ")
        .map(|a| {
            let trimmed = a.trim();
            // "Last, First" → "First Last"
            if let Some((last, first)) = trimmed.split_once(',') {
                format!("{} {}", first.trim(), last.trim())
            } else {
                trimmed.to_string()
            }
        })
        .filter(|s| !s.is_empty())
        .collect()
}

fn clean_bibtex_value(s: &str) -> String {
    s.replace('{', "")
        .replace('}', "")
        .replace("\\&", "&")
        .replace("\\%", "%")
        .replace("\\_", "_")
        .replace("\\#", "#")
        .replace("\\textit", "")
        .replace("\\textbf", "")
        .replace("\\emph", "")
        .replace("\\url", "")
        .replace("\\~", "~")
        .replace("\\,", " ")
        .replace("\n", " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string()
}

// ============================================================
// RIS パーサー
// ============================================================

fn parse_ris(content: &str) -> Vec<ParsedEntry> {
    let mut entries = Vec::new();
    let mut current_fields: HashMap<String, Vec<String>> = HashMap::new();
    let mut in_entry = false;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        // RIS タグは先頭2〜4文字 + "  - " で始まる
        if let Some((tag, value)) = parse_ris_line(trimmed) {
            match tag.as_str() {
                "TY" => {
                    in_entry = true;
                    current_fields.clear();
                    current_fields
                        .entry("TY".to_string())
                        .or_default()
                        .push(value);
                }
                "ER" => {
                    if in_entry {
                        if let Some(entry) = build_ris_entry(&current_fields) {
                            entries.push(entry);
                        }
                    }
                    in_entry = false;
                    current_fields.clear();
                }
                _ => {
                    if in_entry {
                        current_fields
                            .entry(tag)
                            .or_default()
                            .push(value);
                    }
                }
            }
        }
    }

    // ファイル末尾に ER がない場合
    if in_entry && !current_fields.is_empty() {
        if let Some(entry) = build_ris_entry(&current_fields) {
            entries.push(entry);
        }
    }

    entries
}

fn parse_ris_line(line: &str) -> Option<(String, String)> {
    // 標準フォーマット: "TY  - JOUR" (タグ + "  - " + 値)
    if line.len() >= 6 {
        let tag_part = &line[..2];
        if tag_part.chars().all(|c| c.is_alphanumeric()) {
            // "  - " セパレータを探す
            if let Some(sep_pos) = line.find("  - ") {
                let tag = line[..sep_pos].trim().to_string();
                let value = line[sep_pos + 4..].trim().to_string();
                return Some((tag, value));
            }
        }
    }
    None
}

fn build_ris_entry(fields: &HashMap<String, Vec<String>>) -> Option<ParsedEntry> {
    let first = |key: &str| -> Option<String> {
        fields.get(key).and_then(|v| v.first()).cloned().filter(|s| !s.is_empty())
    };

    let title = first("TI")
        .or_else(|| first("T1"))
        .or_else(|| first("CT"))?;

    let authors: Vec<String> = fields
        .get("AU")
        .or_else(|| fields.get("A1"))
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .map(|a| {
            // "Last, First" → "First Last"
            if let Some((last, first)) = a.split_once(',') {
                format!("{} {}", first.trim(), last.trim())
            } else {
                a.trim().to_string()
            }
        })
        .filter(|s| !s.is_empty())
        .collect();

    let year = first("PY")
        .or_else(|| first("Y1"))
        .and_then(|y| {
            // RIS year は "YYYY/MM/DD/extra" 形式の場合がある
            y.split('/').next().and_then(|y| y.trim().parse::<i32>().ok())
        });

    let journal = first("JO")
        .or_else(|| first("JF"))
        .or_else(|| first("T2"))
        .or_else(|| first("JA"));

    let volume = first("VL");
    let issue = first("IS");

    let pages = match (first("SP"), first("EP")) {
        (Some(sp), Some(ep)) => Some(format!("{}-{}", sp, ep)),
        (Some(sp), None) => Some(sp),
        _ => None,
    };

    let doi = first("DO").or_else(|| first("DOI"));
    let url = first("UR").or_else(|| first("L1")).or_else(|| first("L2"));
    let r#abstract = first("AB").or_else(|| first("N2"));

    let mut tags: Vec<String> = fields
        .get("KW")
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter(|s| !s.is_empty())
        .collect();

    // キーワードフィールドがない場合は空
    if tags.is_empty() {
        if let Some(kws) = first("DE") {
            for kw in kws.split([',', ';']) {
                let t = kw.trim().to_string();
                if !t.is_empty() {
                    tags.push(t);
                }
            }
        }
    }

    let entry_type = first("TY")
        .map(|t| match t.as_str() {
            "JOUR" => "article",
            "BOOK" | "SER" => "book",
            "CHAP" => "incollection",
            "CONF" | "CPAPER" => "inproceedings",
            "THES" => "thesis",
            "RPRT" | "REPORT" => "report",
            "UNPB" => "unpublished",
            _ => "misc",
        })
        .unwrap_or("misc")
        .to_string();

    Some(ParsedEntry {
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
        tags,
        entry_type,
    })
}

// ============================================================
// Zotero CSV パーサー
// ============================================================

fn parse_zotero_csv(content: &str) -> Vec<ParsedEntry> {
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(true)
        .flexible(true)
        .trim(csv::Trim::All)
        .from_reader(content.as_bytes());

    let headers: Vec<String> = match reader.headers() {
        Ok(h) => h.iter().map(|s| s.to_lowercase().trim().to_string()).collect(),
        Err(_) => return Vec::new(),
    };

    // ヘッダーインデックスを構築
    let idx = |name: &str| -> Option<usize> {
        headers.iter().position(|h| h == name)
    };

    let title_idx = idx("title");
    let author_idx = idx("author");
    let year_idx = idx("publication year").or_else(|| idx("year")).or_else(|| idx("date"));
    let journal_idx = idx("publication title").or_else(|| idx("journal"));
    let volume_idx = idx("volume");
    let issue_idx = idx("issue");
    let pages_idx = idx("pages");
    let doi_idx = idx("doi");
    let url_idx = idx("url");
    let abstract_idx = idx("abstract note").or_else(|| idx("abstract"));
    let item_type_idx = idx("item type").or_else(|| idx("type"));
    let tags_idx = idx("manual tags").or_else(|| idx("automatic tags")).or_else(|| idx("tags"));

    let mut entries = Vec::new();

    for result in reader.records() {
        let record = match result {
            Ok(r) => r,
            Err(_) => continue,
        };

        let get = |idx: Option<usize>| -> Option<String> {
            idx.and_then(|i| record.get(i))
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
        };

        let title = match get(title_idx) {
            Some(t) => t,
            None => continue,
        };

        let authors: Vec<String> = get(author_idx)
            .map(|a| {
                // Zotero CSV は "Last, First; Last2, First2" 形式
                a.split(';')
                    .map(|name| {
                        let trimmed = name.trim();
                        if let Some((last, first)) = trimmed.split_once(',') {
                            format!("{} {}", first.trim(), last.trim())
                        } else {
                            trimmed.to_string()
                        }
                    })
                    .filter(|s| !s.is_empty())
                    .collect()
            })
            .unwrap_or_default();

        let year = get(year_idx).and_then(|y| {
            // Zotero date フィールドは "2023-01-15" or "2023" 形式
            y.split('-').next().and_then(|p| p.trim().parse::<i32>().ok())
        });

        let tags: Vec<String> = get(tags_idx)
            .map(|t| {
                t.split(';')
                    .map(|tag| tag.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect()
            })
            .unwrap_or_default();

        let entry_type = get(item_type_idx)
            .map(|t| t.to_lowercase())
            .unwrap_or_else(|| "misc".to_string());

        entries.push(ParsedEntry {
            title,
            authors,
            year,
            journal: get(journal_idx),
            volume: get(volume_idx),
            issue: get(issue_idx),
            pages: get(pages_idx),
            doi: get(doi_idx),
            url: get(url_idx),
            r#abstract: get(abstract_idx),
            tags,
            entry_type,
        });
    }

    entries
}

// ============================================================
// Obsidian Vault パーサー
// ============================================================

fn parse_obsidian_vault(vault_path: &str) -> Result<Vec<ParsedNote>, String> {
    let vault_dir = std::path::Path::new(vault_path);
    if !vault_dir.is_dir() {
        return Err(format!(
            "指定されたパスはディレクトリではありません: {}",
            vault_path
        ));
    }

    let mut notes = Vec::new();

    // 再帰的に .md ファイルを収集
    collect_markdown_files(vault_dir, vault_dir, &mut notes)?;

    Ok(notes)
}

fn collect_markdown_files(
    base_dir: &std::path::Path,
    current_dir: &std::path::Path,
    notes: &mut Vec<ParsedNote>,
) -> Result<(), String> {
    let entries = std::fs::read_dir(current_dir)
        .map_err(|e| format!("ディレクトリの読み込みに失敗: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("エントリの読み込みに失敗: {}", e))?;
        let path = entry.path();

        // 隠しフォルダ（.obsidian, .trash, .git など）をスキップ
        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            if name.starts_with('.') {
                continue;
            }
        }

        if path.is_dir() {
            collect_markdown_files(base_dir, &path, notes)?;
        } else if path.extension().and_then(|e| e.to_str()) == Some("md") {
            match parse_obsidian_note(&path, base_dir) {
                Ok(note) => notes.push(note),
                Err(e) => {
                    log::warn!(
                        "Obsidian ノートのパースに失敗 ({}): {}",
                        path.display(),
                        e
                    );
                }
            }
        }
    }

    Ok(())
}

fn parse_obsidian_note(
    path: &std::path::Path,
    base_dir: &std::path::Path,
) -> Result<ParsedNote, String> {
    let raw_content =
        std::fs::read_to_string(path).map_err(|e| format!("ファイルの読み込みに失敗: {}", e))?;

    // ファイル名からタイトルを取得
    let title = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Untitled")
        .to_string();

    let relative_path = path
        .strip_prefix(base_dir)
        .unwrap_or(path)
        .to_string_lossy()
        .to_string();

    // YAML frontmatter を解析
    let (frontmatter_tags, body) = extract_frontmatter(&raw_content);

    // 本文からタグ（#tag 形式）を抽出
    let mut tags = frontmatter_tags;
    for word in body.split_whitespace() {
        if word.starts_with('#') && word.len() > 1 {
            let tag = word
                .trim_start_matches('#')
                .trim_end_matches(|c: char| !c.is_alphanumeric() && c != '-' && c != '_' && c != '/')
                .to_string();
            if !tag.is_empty() && !tags.contains(&tag) {
                tags.push(tag);
            }
        }
    }

    // Obsidian [[WikiLink]] を Stellar 形式に変換
    // Obsidian の [[link|display]] → Stellar の [[display]] として保持
    let content = convert_obsidian_links(&body);

    Ok(ParsedNote {
        title,
        content,
        tags,
        source_path: relative_path,
    })
}

fn extract_frontmatter(content: &str) -> (Vec<String>, String) {
    let mut tags = Vec::new();

    // YAML frontmatter は "---" で囲まれている
    if !content.starts_with("---") {
        return (tags, content.to_string());
    }

    let after_first = &content[3..];
    if let Some(end_pos) = after_first.find("\n---") {
        let frontmatter = &after_first[..end_pos];
        let body = &after_first[end_pos + 4..];

        // frontmatter から tags を抽出
        let mut in_tags = false;
        for line in frontmatter.lines() {
            let trimmed = line.trim();

            // "tags:" キーを検出
            if trimmed.starts_with("tags:") {
                let value = trimmed["tags:".len()..].trim();
                if value.starts_with('[') {
                    // インラインリスト: tags: [tag1, tag2]
                    let inner = value.trim_start_matches('[').trim_end_matches(']');
                    for tag in inner.split(',') {
                        let t = tag.trim().trim_matches('"').trim_matches('\'').to_string();
                        if !t.is_empty() {
                            tags.push(t);
                        }
                    }
                    in_tags = false;
                } else if value.is_empty() {
                    // リスト形式: 次行以降に "  - tag" が続く
                    in_tags = true;
                } else {
                    // 単一値: tags: tag1
                    let t = value.trim_matches('"').trim_matches('\'').to_string();
                    if !t.is_empty() {
                        tags.push(t);
                    }
                }
            } else if in_tags {
                if trimmed.starts_with("- ") || trimmed.starts_with("* ") {
                    let t = trimmed[2..].trim().trim_matches('"').trim_matches('\'').to_string();
                    if !t.is_empty() {
                        tags.push(t);
                    }
                } else if !trimmed.is_empty() && !trimmed.starts_with('#') {
                    // tags リストが終了
                    in_tags = false;
                }
            }
        }

        return (tags, body.trim_start_matches('\n').to_string());
    }

    (tags, content.to_string())
}

fn convert_obsidian_links(content: &str) -> String {
    let mut result = String::new();
    let mut remaining = content;

    while let Some(start) = remaining.find("[[") {
        result.push_str(&remaining[..start]);
        let after_open = &remaining[start + 2..];

        if let Some(end) = after_open.find("]]") {
            let link_content = &after_open[..end];

            // [[target|display]] → [[display]] (Stellar の WikiLink)
            // [[target#heading|display]] → [[display]]
            // [[target]] → [[target]]
            if let Some(pipe_pos) = link_content.find('|') {
                let display = &link_content[pipe_pos + 1..];
                result.push_str("[[");
                result.push_str(display);
                result.push_str("]]");
            } else if let Some(hash_pos) = link_content.find('#') {
                // [[target#heading]] → [[target]]
                let target = &link_content[..hash_pos];
                result.push_str("[[");
                result.push_str(target);
                result.push_str("]]");
            } else {
                // そのまま保持
                result.push_str("[[");
                result.push_str(link_content);
                result.push_str("]]");
            }

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
// フォーマット自動検出
// ============================================================

fn detect_format(content: &str) -> &'static str {
    let trimmed = content.trim();

    // BibTeX: @ で始まるエントリがある
    if trimmed.contains("@article")
        || trimmed.contains("@Article")
        || trimmed.contains("@ARTICLE")
        || trimmed.contains("@book")
        || trimmed.contains("@Book")
        || trimmed.contains("@BOOK")
        || trimmed.contains("@inproceedings")
        || trimmed.contains("@InProceedings")
        || trimmed.contains("@misc")
        || trimmed.contains("@Misc")
        || trimmed.contains("@phdthesis")
        || trimmed.contains("@incollection")
    {
        return "bibtex";
    }

    // RIS: "TY  - " で始まるエントリがある
    if trimmed.contains("TY  - ") {
        return "ris";
    }

    // CSV: ヘッダー行に Zotero の典型的なカラム名がある
    let first_line = trimmed.lines().next().unwrap_or("").to_lowercase();
    if first_line.contains("title") && (first_line.contains("author") || first_line.contains("item type")) {
        return "csv";
    }

    "unknown"
}

// ============================================================
// Tauri コマンド: プレビュー
// ============================================================

/// ファイルを読み込んで解析結果をプレビューする（DB には書き込まない）
#[tauri::command]
pub async fn preview_import_file(file_path: String) -> Result<PreviewResult, String> {
    let content = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("ファイルの読み込みに失敗: {}", e))?;

    let format = detect_format(&content);

    let entries = match format {
        "bibtex" => parse_bibtex(&content),
        "ris" => parse_ris(&content),
        "csv" => parse_zotero_csv(&content),
        _ => {
            return Err(format!(
                "ファイル形式を自動検出できませんでした。BibTeX (.bib)、RIS (.ris)、Zotero CSV (.csv) のいずれかを選択してください。"
            ));
        }
    };

    let total_count = entries.len();

    Ok(PreviewResult {
        entries,
        notes: Vec::new(),
        format_detected: format.to_string(),
        total_count,
    })
}

/// Obsidian Vault ディレクトリを解析してプレビューする
#[tauri::command]
pub async fn preview_obsidian_vault(vault_path: String) -> Result<PreviewResult, String> {
    let notes = parse_obsidian_vault(&vault_path)?;
    let total_count = notes.len();

    Ok(PreviewResult {
        entries: Vec::new(),
        notes,
        format_detected: "obsidian".to_string(),
        total_count,
    })
}

// ============================================================
// Tauri コマンド: 文献ファイルインポート（BibTeX / RIS / CSV）
// ============================================================

#[tauri::command]
pub async fn import_references_file(
    app: AppHandle,
    file_path: String,
    skip_duplicates: Option<bool>,
    tag_prefix: Option<String>,
) -> Result<MigrationResult, String> {
    let pool = get_pool(&app)?;
    let skip_dup = skip_duplicates.unwrap_or(true);

    let content = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("ファイルの読み込みに失敗: {}", e))?;

    let format = detect_format(&content);
    let entries = match format {
        "bibtex" => parse_bibtex(&content),
        "ris" => parse_ris(&content),
        "csv" => parse_zotero_csv(&content),
        _ => {
            return Err(
                "ファイル形式を自動検出できませんでした。BibTeX、RIS、Zotero CSV のいずれかを選択してください。"
                    .to_string(),
            );
        }
    };

    let mut result = MigrationResult {
        papers_imported: 0,
        notes_imported: 0,
        papers_skipped: 0,
        notes_skipped: 0,
        errors: Vec::new(),
    };

    for entry in &entries {
        // DOI による重複チェック
        if skip_dup {
            if let Some(ref doi) = entry.doi {
                if !doi.is_empty() {
                    let existing = sqlx::query("SELECT id FROM papers WHERE doi = ?")
                        .bind(doi)
                        .fetch_optional(pool.as_ref())
                        .await
                        .map_err(|e| format!("DOI チェックに失敗: {}", e))?;

                    if existing.is_some() {
                        result.papers_skipped += 1;
                        continue;
                    }
                }
            }

            // タイトル完全一致チェック
            let existing_title =
                sqlx::query("SELECT id FROM papers WHERE LOWER(title) = LOWER(?)")
                    .bind(&entry.title)
                    .fetch_optional(pool.as_ref())
                    .await
                    .map_err(|e| format!("タイトルチェックに失敗: {}", e))?;

            if existing_title.is_some() {
                result.papers_skipped += 1;
                continue;
            }
        }

        // タグにプレフィックスを追加
        let mut tags = entry.tags.clone();
        if let Some(ref prefix) = tag_prefix {
            if !prefix.is_empty() {
                tags.push(prefix.clone());
            }
        }

        let new_id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        let authors_json =
            serde_json::to_string(&entry.authors).unwrap_or_else(|_| "[]".to_string());
        let tags_json = serde_json::to_string(&tags).unwrap_or_else(|_| "[]".to_string());

        match sqlx::query(
            "INSERT INTO papers (id, title, authors, year, journal, volume, issue, pages, doi, url, abstract, pdf_path, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)",
        )
        .bind(&new_id)
        .bind(&entry.title)
        .bind(&authors_json)
        .bind(entry.year)
        .bind(&entry.journal)
        .bind(&entry.volume)
        .bind(&entry.issue)
        .bind(&entry.pages)
        .bind(&entry.doi)
        .bind(&entry.url)
        .bind(&entry.r#abstract)
        .bind(&tags_json)
        .bind(&now)
        .bind(&now)
        .execute(pool.as_ref())
        .await
        {
            Ok(_) => result.papers_imported += 1,
            Err(e) => {
                result.errors.push(format!(
                    "「{}」のインポートに失敗: {}",
                    entry.title, e
                ));
            }
        }
    }

    Ok(result)
}

// ============================================================
// Tauri コマンド: Obsidian Vault インポート
// ============================================================

#[tauri::command]
pub async fn import_obsidian_vault(
    app: AppHandle,
    vault_path: String,
    skip_duplicates: Option<bool>,
    tag_prefix: Option<String>,
) -> Result<MigrationResult, String> {
    let pool = get_pool(&app)?;
    let skip_dup = skip_duplicates.unwrap_or(true);

    let notes = parse_obsidian_vault(&vault_path)?;

    let mut result = MigrationResult {
        papers_imported: 0,
        notes_imported: 0,
        papers_skipped: 0,
        notes_skipped: 0,
        errors: Vec::new(),
    };

    for note in &notes {
        // タイトルによる重複チェック
        if skip_dup {
            let existing = sqlx::query("SELECT id FROM notes WHERE LOWER(title) = LOWER(?)")
                .bind(&note.title)
                .fetch_optional(pool.as_ref())
                .await
                .map_err(|e| format!("タイトルチェックに失敗: {}", e))?;

            if existing.is_some() {
                result.notes_skipped += 1;
                continue;
            }
        }

        let mut tags = note.tags.clone();
        if let Some(ref prefix) = tag_prefix {
            if !prefix.is_empty() && !tags.contains(prefix) {
                tags.push(prefix.clone());
            }
        }

        let new_id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        let tags_json = serde_json::to_string(&tags).unwrap_or_else(|_| "[]".to_string());

        match sqlx::query(
            "INSERT INTO notes (id, title, content, paper_id, tags, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?, ?)",
        )
        .bind(&new_id)
        .bind(&note.title)
        .bind(&note.content)
        .bind(&tags_json)
        .bind(&now)
        .bind(&now)
        .execute(pool.as_ref())
        .await
        {
            Ok(_) => result.notes_imported += 1,
            Err(e) => {
                result.errors.push(format!(
                    "「{}」のインポートに失敗: {}",
                    note.title, e
                ));
            }
        }
    }

    Ok(result)
}
