// src-tauri/src/utils/metadata.rs
// Stellar — メタデータ取得ユーティリティ
// DOI や URL から論文のメタデータを取得する（CrossRef API / OpenAlex API）

use serde::{Deserialize, Serialize};

/// CrossRef API から取得した論文メタデータ
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaperMetadata {
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
}

/// DOI から CrossRef API を通じてメタデータを取得する
/// https://api.crossref.org/works/{doi}
pub async fn fetch_metadata_by_doi(doi: &str) -> Result<PaperMetadata, String> {
    let url = format!("https://api.crossref.org/works/{}", doi);
    let client = reqwest::Client::new();

    let response = client
        .get(&url)
        .header("User-Agent", "Stellar/0.1.0 (mailto:stellar@example.com)")
        .send()
        .await
        .map_err(|e| format!("CrossRef API への接続に失敗しました: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "CrossRef API がエラーを返しました ({}): DOI '{}'",
            response.status(),
            doi
        ));
    }

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("レスポンスの解析に失敗しました: {}", e))?;

    let message = body
        .get("message")
        .ok_or_else(|| "CrossRef レスポンスに message フィールドがありません".to_string())?;

    // タイトルの取得
    let title = message
        .get("title")
        .and_then(|t| t.as_array())
        .and_then(|arr| arr.first())
        .and_then(|v| v.as_str())
        .unwrap_or("Untitled")
        .to_string();

    // 著者リストの取得
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

    // 出版年の取得
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

    // ジャーナル名の取得
    let journal = message
        .get("container-title")
        .and_then(|ct| ct.as_array())
        .and_then(|arr| arr.first())
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // 巻・号・ページの取得
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

    // アブストラクトの取得（HTMLタグを除去）
    let r#abstract = message
        .get("abstract")
        .and_then(|v| v.as_str())
        .map(|s| strip_html_tags(s));

    // URL の取得
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

/// HTML タグを簡易的に除去するヘルパー関数
/// scraper クレートを使用した本格的なパースも可能だが、
/// アブストラクト程度なら正規表現的な簡易除去で十分
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
}
