// src-tauri/src/utils/metadata.rs
// Stellar — メタデータ取得ユーティリティ
// DOI / CiNii CRID / URL から論文のメタデータを取得する
// CrossRef API / CiNii Research API / HTML meta タグスクレイピングの3つの取得手段を提供

use crate::db::models::{MetadataError, PaperMetadata};

// ════════════════════════════════════════════════════════════
// 1. CrossRef API — DOI 解決
// ════════════════════════════════════════════════════════════

/// CrossRef API からメタデータを取得する（DOI 解決）
/// https://api.crossref.org/works/{doi}
/// 国際論文の DOI からタイトル・著者・出版年・ジャーナル名などを取得する
pub async fn fetch_metadata_by_doi(doi: &str) -> Result<PaperMetadata, MetadataError> {
    let url = format!("https://api.crossref.org/works/{}", doi);
    let client = reqwest::Client::new();

    let response = client
        .get(&url)
        .header("User-Agent", "Stellar/0.1.0 (mailto:stellar@example.com)")
        .send()
        .await
        .map_err(|e| MetadataError::NetworkError(format!("CrossRef API への接続に失敗: {}", e)))?;

    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Err(MetadataError::NotFound(format!(
            "DOI '{}' に対応する論文が見つかりません",
            doi
        )));
    }

    if !response.status().is_success() {
        return Err(MetadataError::ApiError(format!(
            "CrossRef API がエラーを返しました ({})",
            response.status()
        )));
    }

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| MetadataError::ParseError(format!("レスポンスの解析に失敗: {}", e)))?;

    let message = body
        .get("message")
        .ok_or_else(|| MetadataError::ParseError("message フィールドがありません".to_string()))?;

    // タイトル
    let title = message
        .get("title")
        .and_then(|t| t.as_array())
        .and_then(|arr| arr.first())
        .and_then(|v| v.as_str())
        .unwrap_or("Untitled")
        .to_string();

    // 著者リスト（given + family 形式）
    let authors = message
        .get("author")
        .and_then(|a| a.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|author| {
                    let given = author.get("given").and_then(|v| v.as_str()).unwrap_or("");
                    let family = author.get("family").and_then(|v| v.as_str()).unwrap_or("");
                    if family.is_empty() {
                        None
                    } else if given.is_empty() {
                        Some(family.to_string())
                    } else {
                        Some(format!("{} {}", given, family))
                    }
                })
                .collect::<Vec<String>>()
        })
        .unwrap_or_default();

    // 出版年（published-print → published-online → created の優先順位）
    let year = message
        .get("published-print")
        .or_else(|| message.get("published-online"))
        .or_else(|| message.get("created"))
        .and_then(|d| d.get("date-parts"))
        .and_then(|dp| dp.as_array())
        .and_then(|arr| arr.first())
        .and_then(|inner| inner.as_array())
        .and_then(|parts| parts.first())
        .and_then(|y| y.as_i64())
        .map(|y| y as i32);

    // ジャーナル名
    let journal = message
        .get("container-title")
        .and_then(|ct| ct.as_array())
        .and_then(|arr| arr.first())
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // 巻・号・ページ
    let volume = message
        .get("volume")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let issue = message
        .get("issue")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let pages = message
        .get("page")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // アブストラクト（HTMLタグを除去）
    let r#abstract = message
        .get("abstract")
        .and_then(|v| v.as_str())
        .map(|s| strip_html_tags(s));

    // URL
    let url = message
        .get("URL")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    Ok(PaperMetadata {
        title,
        authors,
        year,
        journal,
        volume,
        issue,
        pages,
        doi: Some(doi.to_string()),
        url,
        r#abstract,
    })
}

// ════════════════════════════════════════════════════════════
// 2. CiNii Research API — CRID 解決
// ════════════════════════════════════════════════════════════

/// CiNii Research API からメタデータを取得する
/// https://cir.nii.ac.jp/crid/{CRID}?format=json
/// 日本語論文の CiNii Research ID（CRID）からメタデータを取得する
///
/// CiNii Research は従来の NAID（NII Article ID）を CRID に
/// 移行しているが、後方互換性のため NAID での呼び出しも受け付ける
#[allow(dead_code)]
pub async fn fetch_metadata_by_cinii(naid: &str) -> Result<PaperMetadata, MetadataError> {
    let url = format!("https://cir.nii.ac.jp/crid/{}?format=json", naid);
    let client = reqwest::Client::new();

    let response = client
        .get(&url)
        .header("User-Agent", "Stellar/0.1.0")
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| MetadataError::NetworkError(format!("CiNii API への接続に失敗: {}", e)))?;

    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Err(MetadataError::NotFound(format!(
            "CiNii ID '{}' に対応する論文が見つかりません",
            naid
        )));
    }

    if !response.status().is_success() {
        return Err(MetadataError::ApiError(format!(
            "CiNii API がエラーを返しました ({})",
            response.status()
        )));
    }

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| MetadataError::ParseError(format!("レスポンスの解析に失敗: {}", e)))?;

    // タイトル（日本語タイトルを優先）
    let title = body
        .get("title")
        .and_then(|v| v.as_str())
        .or_else(|| {
            body.get("dc:title")
                .and_then(|v| v.as_array())
                .and_then(|arr| arr.first())
                .and_then(|v| v.as_str())
        })
        .unwrap_or("Untitled")
        .to_string();

    // 著者リスト
    let authors = body
        .get("creator")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|author| {
                    // JSON-LD 形式: {"@value": "著者名", "@language": "ja"}
                    author
                        .get("@value")
                        .and_then(|v| v.as_str())
                        .or_else(|| author.as_str())
                        .map(|s| s.to_string())
                })
                .collect::<Vec<String>>()
        })
        .unwrap_or_default();

    // 出版年
    let year = body
        .get("publicationDate")
        .and_then(|v| v.as_str())
        .or_else(|| body.get("prism:publicationDate").and_then(|v| v.as_str()))
        .and_then(|date_str| {
            date_str
                .split('-')
                .next()
                .and_then(|y| y.parse::<i32>().ok())
        });

    // ジャーナル名
    let journal = body
        .get("publicationName")
        .and_then(|v| v.as_str())
        .or_else(|| body.get("prism:publicationName").and_then(|v| v.as_str()))
        .map(|s| s.to_string());

    // 巻・号・ページ
    let volume = body
        .get("prism:volume")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let issue = body
        .get("prism:number")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let pages = {
        let start = body.get("prism:startingPage").and_then(|v| v.as_str());
        let end = body.get("prism:endingPage").and_then(|v| v.as_str());
        match (start, end) {
            (Some(s), Some(e)) => Some(format!("{}-{}", s, e)),
            (Some(s), None) => Some(s.to_string()),
            _ => None,
        }
    };

    // DOI
    let doi = body
        .get("doi")
        .and_then(|v| v.as_str())
        .or_else(|| body.get("prism:doi").and_then(|v| v.as_str()))
        .map(|s| s.to_string());

    // アブストラクト
    let r#abstract = body
        .get("description")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // URL（CiNii のパーマリンク）
    let link_url = body
        .get("@id")
        .and_then(|v| v.as_str())
        .or_else(|| body.get("url").and_then(|v| v.as_str()))
        .map(|s| s.to_string())
        .or_else(|| Some(format!("https://cir.nii.ac.jp/crid/{}", naid)));

    Ok(PaperMetadata {
        title,
        authors,
        year,
        journal,
        volume,
        issue,
        pages,
        doi,
        url: link_url,
        r#abstract,
    })
}

// ════════════════════════════════════════════════════════════
// 3. HTML メタタグスクレイピング — URL フォールバック
// ════════════════════════════════════════════════════════════

/// URL の HTML をスクレイプしてメタデータを抽出する（フォールバック手段）
/// 学術論文ページで広く使われている以下の meta タグを解析する:
/// - `<meta name="citation_title">` 等の citation_* タグ
/// - `<meta property="og:title">` 等の OGP タグ（フォールバック）
/// - `<meta name="description">` / `<title>` タグ（フォールバック）
pub async fn scrape_metadata_from_url(url: &str) -> Result<PaperMetadata, MetadataError> {
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(5))
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| {
            MetadataError::NetworkError(format!("HTTP クライアントの構築に失敗: {}", e))
        })?;

    let response = client
        .get(url)
        .header("User-Agent", "Stellar/0.1.0 (Academic Reference Manager)")
        .header("Accept", "text/html,application/xhtml+xml")
        .send()
        .await
        .map_err(|e| MetadataError::NetworkError(format!("URL への接続に失敗: {}", e)))?;

    if !response.status().is_success() {
        return Err(MetadataError::ApiError(format!(
            "HTTP {} が返されました: {}",
            response.status(),
            url
        )));
    }

    let html_text = response
        .text()
        .await
        .map_err(|e| MetadataError::ParseError(format!("HTML の取得に失敗: {}", e)))?;

    let document = scraper::Html::parse_document(&html_text);

    // citation_* meta タグからメタデータを抽出
    let title = get_meta_content(&document, "citation_title")
        .or_else(|| get_meta_property(&document, "og:title"))
        .or_else(|| {
            let selector = scraper::Selector::parse("title").ok()?;
            document
                .select(&selector)
                .next()
                .map(|el| el.text().collect::<String>().trim().to_string())
        })
        .unwrap_or_else(|| "Untitled".to_string());

    // 著者リスト（複数の citation_author meta タグ）
    let authors = get_all_meta_contents(&document, "citation_author");

    // 出版日から年を抽出
    let year = get_meta_content(&document, "citation_publication_date")
        .or_else(|| get_meta_content(&document, "citation_date"))
        .or_else(|| get_meta_content(&document, "citation_year"))
        .and_then(|date_str| {
            date_str
                .split(|c: char| c == '/' || c == '-')
                .next()
                .and_then(|y| y.trim().parse::<i32>().ok())
        });

    let journal = get_meta_content(&document, "citation_journal_title");
    let volume = get_meta_content(&document, "citation_volume");
    let issue = get_meta_content(&document, "citation_issue");

    // ページ番号
    let pages = {
        let first = get_meta_content(&document, "citation_firstpage");
        let last = get_meta_content(&document, "citation_lastpage");
        match (first, last) {
            (Some(f), Some(l)) => Some(format!("{}-{}", f, l)),
            (Some(f), None) => Some(f),
            _ => None,
        }
    };

    let doi = get_meta_content(&document, "citation_doi");

    let r#abstract = get_meta_content(&document, "citation_abstract")
        .or_else(|| get_meta_content(&document, "description"))
        .or_else(|| get_meta_property(&document, "og:description"))
        .map(|s| strip_html_tags(&s));

    Ok(PaperMetadata {
        title,
        authors,
        year,
        journal,
        volume,
        issue,
        pages,
        doi,
        url: Some(url.to_string()),
        r#abstract,
    })
}

// ════════════════════════════════════════════════════════════
// HTML ヘルパー関数
// ════════════════════════════════════════════════════════════

/// `<meta name="key" content="value">` から content を取得する
fn get_meta_content(document: &scraper::Html, name: &str) -> Option<String> {
    let selector_str = format!("meta[name=\"{}\"]", name);
    let selector = scraper::Selector::parse(&selector_str).ok()?;
    document
        .select(&selector)
        .next()
        .and_then(|el| el.value().attr("content"))
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

/// `<meta property="key" content="value">` から content を取得する（OGP用）
fn get_meta_property(document: &scraper::Html, property: &str) -> Option<String> {
    let selector_str = format!("meta[property=\"{}\"]", property);
    let selector = scraper::Selector::parse(&selector_str).ok()?;
    document
        .select(&selector)
        .next()
        .and_then(|el| el.value().attr("content"))
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

/// 同一 name の meta タグが複数ある場合にすべての content を取得する
fn get_all_meta_contents(document: &scraper::Html, name: &str) -> Vec<String> {
    let selector_str = format!("meta[name=\"{}\"]", name);
    let selector = match scraper::Selector::parse(&selector_str) {
        Ok(s) => s,
        Err(_) => return vec![],
    };
    document
        .select(&selector)
        .filter_map(|el| {
            el.value()
                .attr("content")
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
        })
        .collect()
}

/// HTML タグを除去する（scraper を使用してテキストのみを抽出する）
fn strip_html_tags(input: &str) -> String {
    let document = scraper::Html::parse_fragment(input);
    document
        .root_element()
        .text()
        .collect::<Vec<_>>()
        .join("")
        .trim()
        .to_string()
}

// ════════════════════════════════════════════════════════════
// テスト
// ════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strip_html_tags() {
        let html = "<jats:p>This is a <jats:italic>test</jats:italic> abstract.</jats:p>";
        assert_eq!(strip_html_tags(html), "This is a test abstract.");
    }

    #[test]
    fn test_strip_html_tags_plain_text() {
        let plain = "No HTML here";
        assert_eq!(strip_html_tags(plain), "No HTML here");
    }

    #[test]
    fn test_strip_html_tags_nested() {
        let html = "<div><p>段落1</p><p>段落2</p></div>";
        assert_eq!(strip_html_tags(html), "段落1段落2");
    }

    #[test]
    fn test_strip_html_tags_empty() {
        assert_eq!(strip_html_tags(""), "");
    }
}
