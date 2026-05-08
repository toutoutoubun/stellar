// src-tauri/src/utils/metadata.rs
// Stellar — メタデータ取得ユーティリティ
// DOI / CiNii CRID / URL から論文のメタデータを取得する
//
// 取得戦略（優先順位）:
// 1. URL から DOI を抽出 → CrossRef API で解決（最も信頼性が高い）
// 2. CiNii / IRDB URL の場合 → CiNii Research API で解決
// 3. HTML meta タグスクレイピング（citation_*, Highwire Press, Dublin Core, OGP）
// 4. スクレイプで DOI を発見した場合 → CrossRef API で補完
//
// 対応サイト:
// - J-Stage (jstage.jst.go.jp)
// - Elsevier / ScienceDirect (sciencedirect.com, elsevier.com)
// - Taylor & Francis (tandfonline.com)
// - JSTOR (jstor.org)
// - Sabinet (journals.co.za, sabinet.co.za)
// - IRDB / CiNii (irdb.nii.ac.jp, cir.nii.ac.jp, ci.nii.ac.jp)
// - SciELO (scielo.br, scielo.org, scielo.org.mx, etc.)
// - Springer / Nature (springer.com, nature.com, link.springer.com)
// - Wiley (wiley.com, onlinelibrary.wiley.com)
// - SAGE (journals.sagepub.com)
// - Oxford Academic (academic.oup.com)
// - Cambridge (cambridge.org)
// - PubMed / PMC (pubmed.ncbi.nlm.nih.gov, pmc.ncbi.nlm.nih.gov)
// - arXiv (arxiv.org)
// - その他 DOI を含む URL 全般

use crate::db::models::{MetadataError, PaperMetadata};

// ════════════════════════════════════════════════════════════
// 公開 API
// ════════════════════════════════════════════════════════════

/// CrossRef API からメタデータを取得する（DOI 解決）
pub async fn fetch_metadata_by_doi(doi: &str) -> Result<PaperMetadata, MetadataError> {
    let clean_doi = normalize_doi(doi);
    fetch_from_crossref(&clean_doi).await
}

/// URL からメタデータを取得する（マルチ戦略）
///
/// 取得フロー:
/// 1. URL から DOI を抽出できる場合 → CrossRef API を試行
/// 2. CiNii / IRDB URL の場合 → CiNii Research API を試行
/// 3. HTML スクレイピングを実行（サイト別最適化ヘッダー付き）
/// 4. スクレイプ結果の DOI で CrossRef を補完
pub async fn scrape_metadata_from_url(url: &str) -> Result<PaperMetadata, MetadataError> {
    let url = url.trim();
    log::info!("[metadata] URL からメタデータ取得を開始: {}", url);

    // ── 戦略 1: URL から DOI を抽出し、CrossRef API で解決 ──
    if let Some(doi) = extract_doi_from_url(url) {
        log::info!("[metadata] URL から DOI を抽出: {}", doi);
        match fetch_from_crossref(&doi).await {
            Ok(mut meta) => {
                // CrossRef の URL が元の URL と異なる場合、元の URL を保持
                if meta.url.as_deref() != Some(url) {
                    meta.url = Some(url.to_string());
                }
                log::info!("[metadata] CrossRef API で解決成功 (DOI: {})", doi);
                return Ok(meta);
            }
            Err(e) => {
                log::warn!("[metadata] CrossRef API フォールバック失敗 (DOI: {}): {}", doi, e);
                // 失敗してもスクレイピングにフォールバック
            }
        }
    }

    // ── 戦略 2: CiNii / IRDB URL の場合、CiNii Research API で解決 ──
    if let Some(crid) = extract_cinii_crid(url) {
        log::info!("[metadata] CiNii CRID を抽出: {}", crid);
        match fetch_metadata_by_cinii(&crid).await {
            Ok(meta) => {
                log::info!("[metadata] CiNii API で解決成功 (CRID: {})", crid);
                return Ok(meta);
            }
            Err(e) => {
                log::warn!("[metadata] CiNii API フォールバック失敗: {}", e);
            }
        }
    }

    // ── 戦略 3: HTML スクレイピング（サイト別最適化） ──
    log::info!("[metadata] HTML スクレイピングにフォールバック");
    let mut meta = scrape_html_metadata(url).await?;

    // ── 戦略 4: スクレイプ結果の DOI で CrossRef 補完 ──
    if let Some(ref doi) = meta.doi {
        let doi_clean = normalize_doi(doi);
        if !doi_clean.is_empty() && (meta.authors.is_empty() || meta.year.is_none()) {
            log::info!("[metadata] スクレイプ結果の DOI で CrossRef 補完を試行: {}", doi_clean);
            if let Ok(crossref_meta) = fetch_from_crossref(&doi_clean).await {
                meta = merge_metadata(meta, crossref_meta);
            }
        }
    }

    Ok(meta)
}

// ════════════════════════════════════════════════════════════
// DOI 抽出 — URL パターンマッチング
// ════════════════════════════════════════════════════════════

/// URL から DOI を抽出する
/// 各学術サイトの URL 構造に基づいて DOI を特定する
fn extract_doi_from_url(url: &str) -> Option<String> {
    let url_lower = url.to_lowercase();

    // ── doi.org 直接リンク ──
    // https://doi.org/10.xxxx/yyyy
    // https://dx.doi.org/10.xxxx/yyyy
    if url_lower.contains("doi.org/") {
        if let Some(doi) = extract_after_pattern(url, "doi.org/") {
            let doi = normalize_doi(&doi);
            if is_valid_doi(&doi) {
                return Some(doi);
            }
        }
    }

    // ── Taylor & Francis (tandfonline.com) ──
    // https://www.tandfonline.com/doi/full/10.1080/xxxxx
    // https://www.tandfonline.com/doi/abs/10.1080/xxxxx
    if url_lower.contains("tandfonline.com/doi/") {
        if let Some(doi) = extract_doi_after_doi_path(url) {
            return Some(doi);
        }
    }

    // ── SAGE Journals ──
    // https://journals.sagepub.com/doi/10.1177/xxxxx
    // https://journals.sagepub.com/doi/full/10.1177/xxxxx
    if url_lower.contains("sagepub.com/doi/") {
        if let Some(doi) = extract_doi_after_doi_path(url) {
            return Some(doi);
        }
    }

    // ── Oxford Academic ──
    // https://academic.oup.com/xxx/article/doi/10.1093/xxxxx
    if url_lower.contains("academic.oup.com") {
        if let Some(doi) = extract_doi_after_doi_path(url) {
            return Some(doi);
        }
    }

    // ── Cambridge University Press ──
    // https://www.cambridge.org/core/journals/.../article/.../DOI
    if url_lower.contains("cambridge.org") {
        if let Some(doi) = extract_doi_pattern_from_anywhere(url) {
            return Some(doi);
        }
    }

    // ── J-Stage (jstage.jst.go.jp) ──
    // https://www.jstage.jst.go.jp/article/journalcode/vol/issue/page/_article/-char/ja
    // DOI は通常 10.xxxx/journalcode.vol.issue_page の形式
    // J-Stage は URL に直接 DOI が入っていないが、citation_doi meta タグで取得可能
    // ここでは URL パターンから DOI は抽出不可 → スクレイピングにフォールバック

    // ── Elsevier / ScienceDirect ──
    // https://www.sciencedirect.com/science/article/pii/S0001234567890123
    // https://linkinghub.elsevier.com/retrieve/pii/S0001234567890123
    // DOI は URL に含まれないが、PII→DOI 変換は不可能 → スクレイピングにフォールバック

    // ── Wiley ──
    // https://onlinelibrary.wiley.com/doi/10.1002/xxxxx
    // https://onlinelibrary.wiley.com/doi/full/10.1002/xxxxx
    if url_lower.contains("wiley.com/doi/") {
        if let Some(doi) = extract_doi_after_doi_path(url) {
            return Some(doi);
        }
    }

    // ── Springer / Nature ──
    // https://link.springer.com/article/10.1007/xxxxx
    // https://www.nature.com/articles/s41586-xxx-xxxxx-x (DOI = 10.1038/s41586-xxx-xxxxx-x)
    if url_lower.contains("link.springer.com/article/") {
        if let Some(doi) = extract_after_pattern(url, "link.springer.com/article/") {
            let doi = normalize_doi(&doi);
            if is_valid_doi(&doi) {
                return Some(doi);
            }
        }
    }
    if url_lower.contains("link.springer.com/chapter/") {
        if let Some(doi) = extract_after_pattern(url, "link.springer.com/chapter/") {
            let doi = normalize_doi(&doi);
            if is_valid_doi(&doi) {
                return Some(doi);
            }
        }
    }
    if url_lower.contains("nature.com/articles/") {
        if let Some(article_id) = extract_after_pattern(url, "nature.com/articles/") {
            let article_id = article_id.split('?').next().unwrap_or(&article_id).to_string();
            let article_id = article_id.split('#').next().unwrap_or(&article_id).to_string();
            // Nature の記事IDは通常 DOI のサフィックスで、10.1038/ がプレフィックス
            let doi = format!("10.1038/{}", article_id);
            if is_valid_doi(&doi) {
                return Some(doi);
            }
        }
    }

    // ── JSTOR ──
    // https://www.jstor.org/stable/10.xxxx/yyyy
    // https://www.jstor.org/stable/12345678 (JSTOR ID — DOI なし)
    if url_lower.contains("jstor.org/stable/") {
        if let Some(id) = extract_after_pattern(url, "jstor.org/stable/") {
            let id = id.split('?').next().unwrap_or(&id).to_string();
            if id.starts_with("10.") && is_valid_doi(&id) {
                return Some(id);
            }
            // JSTOR ID の場合は DOI を構成: 10.2307/{id}
            if id.chars().all(|c| c.is_ascii_digit()) {
                return Some(format!("10.2307/{}", id));
            }
        }
    }

    // ── SciELO ──
    // https://www.scielo.br/j/xxx/a/YYYYYYY/?lang=en
    // https://www.scielo.org.mx/scielo.php?pid=S0187-358X2023000300107&script=sci_arttext
    // SciELO は citation_doi メタタグを提供 → スクレイピングにフォールバック

    // ── PubMed / PMC ──
    // https://pubmed.ncbi.nlm.nih.gov/12345678/
    // https://pmc.ncbi.nlm.nih.gov/articles/PMC12345678/
    // DOI は URL に含まれないが、PubMed API で取得可能 → スクレイピングにフォールバック

    // ── arXiv ──
    // https://arxiv.org/abs/2301.12345
    // https://arxiv.org/pdf/2301.12345
    if url_lower.contains("arxiv.org/abs/") || url_lower.contains("arxiv.org/pdf/") {
        let pattern = if url_lower.contains("/abs/") { "arxiv.org/abs/" } else { "arxiv.org/pdf/" };
        if let Some(arxiv_id) = extract_after_pattern(url, pattern) {
            let arxiv_id = arxiv_id.split('?').next().unwrap_or(&arxiv_id).to_string();
            let arxiv_id = arxiv_id.trim_end_matches(".pdf").to_string();
            let doi = format!("10.48550/arXiv.{}", arxiv_id);
            return Some(doi);
        }
    }

    // ── Sabinet (journals.co.za) ──
    // https://journals.co.za/doi/10.xxxx/yyyy
    if url_lower.contains("journals.co.za/doi/") {
        if let Some(doi) = extract_doi_after_doi_path(url) {
            return Some(doi);
        }
    }

    // ── 汎用: URL 内の 10.xxxx/yyyy パターンを検索 ──
    if let Some(doi) = extract_doi_pattern_from_anywhere(url) {
        return Some(doi);
    }

    None
}

/// CiNii / IRDB URL から CRID（CiNii Research ID）を抽出する
fn extract_cinii_crid(url: &str) -> Option<String> {
    let url_lower = url.to_lowercase();

    // https://cir.nii.ac.jp/crid/1234567890123456789
    if url_lower.contains("cir.nii.ac.jp/crid/") {
        return extract_after_pattern(url, "cir.nii.ac.jp/crid/")
            .map(|s| s.split('?').next().unwrap_or(&s).to_string())
            .map(|s| s.split('#').next().unwrap_or(&s).to_string());
    }

    // https://ci.nii.ac.jp/naid/1234567890 (旧 NAID)
    if url_lower.contains("ci.nii.ac.jp/naid/") {
        return extract_after_pattern(url, "ci.nii.ac.jp/naid/")
            .map(|s| s.split('?').next().unwrap_or(&s).to_string())
            .map(|s| s.split('#').next().unwrap_or(&s).to_string())
            .map(|s| s.trim_end_matches('/').to_string());
    }

    // IRDB: https://irdb.nii.ac.jp/xxxxx → CiNii にリダイレクトされることが多い
    // IRDB は直接 API を持たないため、CRID は抽出できない

    None
}

// ════════════════════════════════════════════════════════════
// DOI ヘルパー
// ════════════════════════════════════════════════════════════

/// DOI を正規化する（前後の空白・URL プレフィックス除去）
fn normalize_doi(doi: &str) -> String {
    let doi = doi.trim();
    // https://doi.org/10.xxxx → 10.xxxx
    let doi = doi
        .strip_prefix("https://doi.org/")
        .or_else(|| doi.strip_prefix("http://doi.org/"))
        .or_else(|| doi.strip_prefix("https://dx.doi.org/"))
        .or_else(|| doi.strip_prefix("http://dx.doi.org/"))
        .or_else(|| doi.strip_prefix("doi:"))
        .unwrap_or(doi);
    // URL エンコードをデコード
    urlencoding::decode(doi).unwrap_or_else(|_| doi.into()).to_string()
}

/// DOI の基本的な形式チェック（10.xxxx/yyyy）
fn is_valid_doi(doi: &str) -> bool {
    doi.starts_with("10.") && doi.contains('/') && doi.len() > 7
}

/// URL 中の特定パターン以降の文字列を抽出する
fn extract_after_pattern(url: &str, pattern: &str) -> Option<String> {
    // 大文字小文字を無視して検索
    let url_lower = url.to_lowercase();
    let pattern_lower = pattern.to_lowercase();
    if let Some(pos) = url_lower.find(&pattern_lower) {
        let start = pos + pattern.len();
        if start < url.len() {
            let remainder = &url[start..];
            // クエリパラメータやフラグメントの前で切る
            let result = remainder.split('?').next().unwrap_or(remainder);
            let result = result.split('#').next().unwrap_or(result);
            let result = result.trim_end_matches('/');
            if !result.is_empty() {
                return Some(result.to_string());
            }
        }
    }
    None
}

/// /doi/[full|abs|epub|pdf]/10.xxxx/yyyy パスから DOI を抽出する
fn extract_doi_after_doi_path(url: &str) -> Option<String> {
    let url_lower = url.to_lowercase();
    // /doi/ 以降を取得
    if let Some(pos) = url_lower.find("/doi/") {
        let after_doi = &url[pos + 5..]; // "/doi/" の後
        // full/, abs/, epub/, pdf/ などのプレフィックスを除去
        let after_prefix = after_doi
            .strip_prefix("full/")
            .or_else(|| after_doi.strip_prefix("abs/"))
            .or_else(|| after_doi.strip_prefix("epub/"))
            .or_else(|| after_doi.strip_prefix("pdf/"))
            .unwrap_or(after_doi);
        // クエリパラメータ除去
        let doi = after_prefix.split('?').next().unwrap_or(after_prefix);
        let doi = doi.split('#').next().unwrap_or(doi);
        let doi = doi.trim_end_matches('/');
        let doi = normalize_doi(doi);
        if is_valid_doi(&doi) {
            return Some(doi);
        }
    }
    None
}

/// URL 中のどこかにある 10.xxxx/yyyy パターンを正規表現的に検索する
fn extract_doi_pattern_from_anywhere(url: &str) -> Option<String> {
    // URL デコード
    let decoded = urlencoding::decode(url).unwrap_or_else(|_| url.into());
    // "10." で始まるパターンを探す
    let chars: Vec<char> = decoded.chars().collect();
    let len = chars.len();
    let mut i = 0;
    while i + 4 < len {
        if chars[i] == '1' && chars[i + 1] == '0' && chars[i + 2] == '.' {
            // 10. の後に数字が続くか確認
            if i + 3 < len && chars[i + 3].is_ascii_digit() {
                // DOI の終端を探す（スペース、クエリパラメータ等で終了）
                let start = i;
                let mut end = i + 3;
                let mut has_slash = false;
                while end < len {
                    let c = chars[end];
                    if c == ' ' || c == '\t' || c == '\n' || c == '"' || c == '\'' 
                        || c == '<' || c == '>' || c == '|' || c == '{' || c == '}'
                    {
                        break;
                    }
                    // # や ? の後はクエリ/フラグメントなので止める
                    // ただし DOI 自体に ? が含まれることはほぼない
                    if c == '?' || c == '#' {
                        break;
                    }
                    if c == '/' {
                        has_slash = true;
                    }
                    end += 1;
                }
                if has_slash {
                    let candidate: String = chars[start..end].iter().collect();
                    let candidate = candidate.trim_end_matches(|c: char| c == '.' || c == ',' || c == ';' || c == ')' || c == '/');
                    if is_valid_doi(candidate) {
                        return Some(candidate.to_string());
                    }
                }
            }
        }
        i += 1;
    }
    None
}

// ════════════════════════════════════════════════════════════
// CrossRef API
// ════════════════════════════════════════════════════════════

/// CrossRef API からメタデータを取得する
async fn fetch_from_crossref(doi: &str) -> Result<PaperMetadata, MetadataError> {
    let url = format!("https://api.crossref.org/works/{}", urlencoding::encode(doi));
    let client = build_http_client()?;

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
                    if family.is_empty() && given.is_empty() {
                        // name フィールドがある場合（組織名等）
                        author.get("name").and_then(|v| v.as_str()).map(|s| s.to_string())
                    } else if family.is_empty() {
                        Some(given.to_string())
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
// CiNii Research API
// ════════════════════════════════════════════════════════════

/// CiNii Research API からメタデータを取得する
pub async fn fetch_metadata_by_cinii(crid: &str) -> Result<PaperMetadata, MetadataError> {
    let url = format!("https://cir.nii.ac.jp/crid/{}?format=json", crid);
    let client = build_http_client()?;

    let response = client
        .get(&url)
        .header("User-Agent", "Stellar/0.1.0 (Academic Reference Manager)")
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| MetadataError::NetworkError(format!("CiNii API への接続に失敗: {}", e)))?;

    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Err(MetadataError::NotFound(format!(
            "CiNii ID '{}' に対応する論文が見つかりません",
            crid
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
        .or_else(|| Some(format!("https://cir.nii.ac.jp/crid/{}", crid)));

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
// HTML スクレイピング（サイト別最適化）
// ════════════════════════════════════════════════════════════

/// サイト識別子
enum AcademicSite {
    JStage,
    ScienceDirect,
    TaylorFrancis,
    Jstor,
    Sabinet,
    SciELO,
    Springer,
    Wiley,
    PubMed,
    ArXiv,
    Generic,
}

/// URL からサイトを識別する
fn identify_site(url: &str) -> AcademicSite {
    let url_lower = url.to_lowercase();
    if url_lower.contains("jstage.jst.go.jp") {
        AcademicSite::JStage
    } else if url_lower.contains("sciencedirect.com") || url_lower.contains("elsevier.com") || url_lower.contains("linkinghub.elsevier.com") {
        AcademicSite::ScienceDirect
    } else if url_lower.contains("tandfonline.com") {
        AcademicSite::TaylorFrancis
    } else if url_lower.contains("jstor.org") {
        AcademicSite::Jstor
    } else if url_lower.contains("journals.co.za") || url_lower.contains("sabinet.co.za") {
        AcademicSite::Sabinet
    } else if url_lower.contains("scielo.") {
        AcademicSite::SciELO
    } else if url_lower.contains("springer.com") || url_lower.contains("nature.com") {
        AcademicSite::Springer
    } else if url_lower.contains("wiley.com") {
        AcademicSite::Wiley
    } else if url_lower.contains("pubmed.ncbi") || url_lower.contains("pmc.ncbi") || url_lower.contains("ncbi.nlm.nih.gov") {
        AcademicSite::PubMed
    } else if url_lower.contains("arxiv.org") {
        AcademicSite::ArXiv
    } else {
        AcademicSite::Generic
    }
}

/// サイト別に最適化された HTTP ヘッダーを取得する
fn get_site_headers(site: &AcademicSite) -> Vec<(&'static str, &'static str)> {
    let mut headers = vec![
        ("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"),
        ("Accept-Language", "en-US,en;q=0.9,ja;q=0.8"),
        ("Cache-Control", "no-cache"),
    ];

    // サイト別のUser-Agentとヘッダー
    match site {
        AcademicSite::JStage => {
            // J-Stage は比較的寛容だが、適切な UA が必要
            headers.push(("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"));
            headers.push(("Accept-Language", "ja,en-US;q=0.9,en;q=0.8"));
        }
        AcademicSite::ScienceDirect | AcademicSite::TaylorFrancis | AcademicSite::Wiley => {
            // Elsevier, T&F, Wiley はbot検知が厳しい
            headers.push(("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"));
            headers.push(("Sec-Fetch-Dest", "document"));
            headers.push(("Sec-Fetch-Mode", "navigate"));
            headers.push(("Sec-Fetch-Site", "none"));
            headers.push(("Sec-Fetch-User", "?1"));
            headers.push(("Upgrade-Insecure-Requests", "1"));
        }
        AcademicSite::Jstor => {
            headers.push(("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"));
        }
        AcademicSite::Sabinet | AcademicSite::SciELO => {
            headers.push(("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"));
        }
        AcademicSite::Springer => {
            headers.push(("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"));
        }
        AcademicSite::PubMed => {
            // PubMed は API 的なアクセスも許容する
            headers.push(("User-Agent", "Stellar/0.1.0 (Academic Reference Manager)"));
        }
        AcademicSite::ArXiv => {
            headers.push(("User-Agent", "Stellar/0.1.0 (Academic Reference Manager)"));
        }
        AcademicSite::Generic => {
            headers.push(("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"));
        }
    }

    headers
}

/// HTML をスクレイプしてメタデータを抽出する
async fn scrape_html_metadata(url: &str) -> Result<PaperMetadata, MetadataError> {
    let site = identify_site(url);
    let headers = get_site_headers(&site);

    let client = build_http_client()?;

    let mut request = client.get(url);
    for (key, value) in &headers {
        request = request.header(*key, *value);
    }

    let response = request
        .send()
        .await
        .map_err(|e| {
            log::error!("[metadata] HTTP リクエスト失敗: {} — {}", url, e);
            MetadataError::NetworkError(format!("URL への接続に失敗: {}", e))
        })?;

    let status = response.status();
    log::info!("[metadata] HTTP {} — {}", status, url);

    if !status.is_success() {
        // 403/429 の場合はサイト固有のエラーメッセージ
        let msg = match status.as_u16() {
            403 => format!(
                "アクセスが拒否されました (403)。{}はボット対策のためブラウザ以外からのアクセスを制限している可能性があります。DOI を使って取得してください。URL: {}",
                site_display_name(&site), url
            ),
            429 => format!(
                "リクエスト制限に達しました (429)。しばらく待ってから再試行してください。URL: {}", url
            ),
            _ => format!("HTTP {} が返されました: {}", status, url),
        };
        return Err(MetadataError::ApiError(msg));
    }

    let html_text = response
        .text()
        .await
        .map_err(|e| MetadataError::ParseError(format!("HTML の取得に失敗: {}", e)))?;

    parse_html_metadata(&html_text, url, &site)
}

/// HTML テキストからメタデータを抽出する
fn parse_html_metadata(html: &str, url: &str, site: &AcademicSite) -> Result<PaperMetadata, MetadataError> {
    let document = scraper::Html::parse_document(html);

    // ── タイトル ──
    // Highwire Press (citation_*) → Dublin Core (DC.*) → OGP → <title>
    let title = get_meta_content(&document, "citation_title")
        .or_else(|| get_meta_content(&document, "DC.title"))
        .or_else(|| get_meta_content(&document, "dc.title"))
        .or_else(|| get_meta_content(&document, "DC.Title"))
        .or_else(|| get_meta_property(&document, "og:title"))
        .or_else(|| extract_title_tag(&document))
        .unwrap_or_else(|| "Untitled".to_string());

    // ── 著者 ──
    let mut authors = get_all_meta_contents(&document, "citation_author");
    if authors.is_empty() {
        authors = get_all_meta_contents(&document, "citation_authors")
            .into_iter()
            .flat_map(|s| s.split(';').map(|a| a.trim().to_string()).collect::<Vec<_>>())
            .filter(|s| !s.is_empty())
            .collect();
    }
    if authors.is_empty() {
        authors = get_all_meta_contents(&document, "DC.creator");
    }
    if authors.is_empty() {
        authors = get_all_meta_contents(&document, "dc.creator");
    }
    if authors.is_empty() {
        authors = get_all_meta_contents(&document, "DC.Creator");
    }
    // サイト固有の著者抽出
    if authors.is_empty() {
        authors = extract_authors_from_html(&document, site);
    }

    // ── 出版年 ──
    let year = get_meta_content(&document, "citation_publication_date")
        .or_else(|| get_meta_content(&document, "citation_date"))
        .or_else(|| get_meta_content(&document, "citation_year"))
        .or_else(|| get_meta_content(&document, "citation_online_date"))
        .or_else(|| get_meta_content(&document, "DC.date"))
        .or_else(|| get_meta_content(&document, "dc.date"))
        .or_else(|| get_meta_content(&document, "DC.Date"))
        .or_else(|| get_meta_content(&document, "article:published_time"))
        .and_then(|date_str| extract_year_from_date(&date_str));

    // ── ジャーナル名 ──
    let journal = get_meta_content(&document, "citation_journal_title")
        .or_else(|| get_meta_content(&document, "citation_journal_abbrev"))
        .or_else(|| get_meta_content(&document, "DC.source"))
        .or_else(|| get_meta_content(&document, "dc.source"))
        .or_else(|| get_meta_property(&document, "og:site_name"));

    // ── 巻・号 ──
    let volume = get_meta_content(&document, "citation_volume");
    let issue = get_meta_content(&document, "citation_issue");

    // ── ページ番号 ──
    let pages = {
        let first = get_meta_content(&document, "citation_firstpage");
        let last = get_meta_content(&document, "citation_lastpage");
        match (first, last) {
            (Some(f), Some(l)) if f != l => Some(format!("{}-{}", f, l)),
            (Some(f), _) => Some(f),
            _ => None,
        }
    };

    // ── DOI ──
    let doi = get_meta_content(&document, "citation_doi")
        .or_else(|| get_meta_content(&document, "DC.identifier"))
        .or_else(|| get_meta_content(&document, "dc.identifier"))
        .or_else(|| get_meta_content(&document, "DC.Identifier"))
        .or_else(|| get_meta_content(&document, "DOI"))
        // DC.identifier は DOI 以外の値も含み得るのでフィルタ
        .and_then(|s| {
            let cleaned = normalize_doi(&s);
            if is_valid_doi(&cleaned) {
                Some(cleaned)
            } else if s.starts_with("10.") && s.contains('/') {
                Some(s)
            } else {
                None
            }
        })
        // HTML 本文中の DOI も探す
        .or_else(|| extract_doi_from_html_body(html));

    // ── アブストラクト ──
    let r#abstract = get_meta_content(&document, "citation_abstract")
        .or_else(|| get_meta_content(&document, "DC.description"))
        .or_else(|| get_meta_content(&document, "dc.description"))
        .or_else(|| get_meta_content(&document, "description"))
        .or_else(|| get_meta_property(&document, "og:description"))
        .or_else(|| extract_abstract_from_html(&document, site))
        .map(|s| strip_html_tags(&s));

    // URL は入力値を使用
    let meta_url = Some(url.to_string());

    Ok(PaperMetadata {
        title,
        authors,
        year,
        journal,
        volume,
        issue,
        pages,
        doi,
        url: meta_url,
        r#abstract,
    })
}

// ════════════════════════════════════════════════════════════
// サイト固有の HTML 抽出
// ════════════════════════════════════════════════════════════

/// HTML 本文から著者を抽出する（meta タグにない場合のフォールバック）
fn extract_authors_from_html(document: &scraper::Html, site: &AcademicSite) -> Vec<String> {
    match site {
        AcademicSite::JStage => {
            // J-Stage: <span class="author-list">...</span> 内の <a> タグ
            if let Ok(sel) = scraper::Selector::parse(".author-list a, .article-author a") {
                let authors: Vec<String> = document
                    .select(&sel)
                    .map(|el| el.text().collect::<String>().trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect();
                if !authors.is_empty() {
                    return authors;
                }
            }
        }
        AcademicSite::PubMed => {
            // PubMed: <span class="authors-list-item">
            if let Ok(sel) = scraper::Selector::parse(".authors-list-item .full-name, .authors-list a.full-name") {
                let authors: Vec<String> = document
                    .select(&sel)
                    .map(|el| el.text().collect::<String>().trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect();
                if !authors.is_empty() {
                    return authors;
                }
            }
        }
        _ => {}
    }

    // 汎用: schema.org の author
    if let Ok(sel) = scraper::Selector::parse("[itemprop=\"author\"] [itemprop=\"name\"], [rel=\"author\"]") {
        let authors: Vec<String> = document
            .select(&sel)
            .map(|el| el.text().collect::<String>().trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        if !authors.is_empty() {
            return authors;
        }
    }

    vec![]
}

/// HTML 本文からアブストラクトを抽出する（meta タグにない場合のフォールバック）
fn extract_abstract_from_html(document: &scraper::Html, site: &AcademicSite) -> Option<String> {
    let selectors = match site {
        AcademicSite::JStage => vec![
            "#article-overiew-abstract-wrap p",
            ".abstract-contents p",
            ".article-abstract p",
        ],
        AcademicSite::PubMed => vec![
            "#abstract .abstract-content p",
            "#enc-abstract .abstract-content p",
        ],
        AcademicSite::SciELO => vec![
            ".abstract p",
            "#abstract p",
            ".trans-abstract p",
        ],
        _ => vec![
            "[class*=\"abstract\"] p",
            "#abstract p",
            ".abstract p",
        ],
    };

    for selector_str in selectors {
        if let Ok(sel) = scraper::Selector::parse(selector_str) {
            let texts: Vec<String> = document
                .select(&sel)
                .map(|el| el.text().collect::<String>().trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
            if !texts.is_empty() {
                return Some(texts.join(" "));
            }
        }
    }

    None
}

/// HTML 本文から DOI を探す
fn extract_doi_from_html_body(html: &str) -> Option<String> {
    // "doi.org/10." のパターンを検索
    if let Some(pos) = html.to_lowercase().find("doi.org/10.") {
        // pos から DOI を抽出
        let start = html.to_lowercase()[..pos].rfind("http")
            .unwrap_or(pos);
        let remainder = &html[start..];
        // URL 終端を探す
        let end = remainder.find(|c: char| c == '"' || c == '\'' || c == '<' || c == '>' || c == ' ' || c == '\n')
            .unwrap_or(remainder.len());
        let url_str = &remainder[..end];
        if let Some(doi) = extract_after_pattern(url_str, "doi.org/") {
            let doi = normalize_doi(&doi);
            if is_valid_doi(&doi) {
                return Some(doi);
            }
        }
    }
    None
}

// ════════════════════════════════════════════════════════════
// ユーティリティ
// ════════════════════════════════════════════════════════════

/// 共通 HTTP クライアントを構築する
fn build_http_client() -> Result<reqwest::Client, MetadataError> {
    reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(10))
        .timeout(std::time::Duration::from_secs(30))
        .danger_accept_invalid_certs(false)
        .build()
        .map_err(|e| {
            MetadataError::NetworkError(format!("HTTP クライアントの構築に失敗: {}", e))
        })
}

/// 2つのメタデータをマージする（primary が優先、空フィールドを secondary で補完）
fn merge_metadata(primary: PaperMetadata, secondary: PaperMetadata) -> PaperMetadata {
    PaperMetadata {
        title: if primary.title == "Untitled" || primary.title.is_empty() {
            secondary.title
        } else {
            primary.title
        },
        authors: if primary.authors.is_empty() {
            secondary.authors
        } else {
            primary.authors
        },
        year: primary.year.or(secondary.year),
        journal: primary.journal.or(secondary.journal),
        volume: primary.volume.or(secondary.volume),
        issue: primary.issue.or(secondary.issue),
        pages: primary.pages.or(secondary.pages),
        doi: primary.doi.or(secondary.doi),
        url: primary.url.or(secondary.url),
        r#abstract: primary.r#abstract.or(secondary.r#abstract),
    }
}

/// 日付文字列から年を抽出する
/// 対応フォーマット: "2024", "2024/01/15", "2024-01-15", "01/15/2024", "January 2024"
fn extract_year_from_date(date_str: &str) -> Option<i32> {
    let date_str = date_str.trim();
    
    // "2024" のような4桁の年
    if date_str.len() == 4 {
        return date_str.parse::<i32>().ok();
    }

    // "2024/01/15" or "2024-01-15" — 先頭が年
    if date_str.len() >= 4 {
        let first_part: String = date_str.chars().take_while(|c| c.is_ascii_digit()).collect();
        if first_part.len() == 4 {
            if let Ok(y) = first_part.parse::<i32>() {
                if (1900..=2100).contains(&y) {
                    return Some(y);
                }
            }
        }
    }

    // "01/15/2024" — 末尾が年
    let parts: Vec<&str> = date_str.split(|c: char| c == '/' || c == '-').collect();
    if parts.len() >= 3 {
        if let Ok(y) = parts.last().unwrap_or(&"").parse::<i32>() {
            if (1900..=2100).contains(&y) {
                return Some(y);
            }
        }
    }

    // "January 2024" — テキスト内の4桁の数字を検索
    for word in date_str.split_whitespace() {
        if word.len() == 4 {
            if let Ok(y) = word.parse::<i32>() {
                if (1900..=2100).contains(&y) {
                    return Some(y);
                }
            }
        }
    }

    None
}

/// サイトの表示名を返す
fn site_display_name(site: &AcademicSite) -> &'static str {
    match site {
        AcademicSite::JStage => "J-Stage",
        AcademicSite::ScienceDirect => "ScienceDirect (Elsevier)",
        AcademicSite::TaylorFrancis => "Taylor & Francis",
        AcademicSite::Jstor => "JSTOR",
        AcademicSite::Sabinet => "Sabinet",
        AcademicSite::SciELO => "SciELO",
        AcademicSite::Springer => "Springer / Nature",
        AcademicSite::Wiley => "Wiley",
        AcademicSite::PubMed => "PubMed",
        AcademicSite::ArXiv => "arXiv",
        AcademicSite::Generic => "不明なサイト",
    }
}

/// <title> タグからテキストを抽出する（不要なサイト名サフィックスを除去）
fn extract_title_tag(document: &scraper::Html) -> Option<String> {
    let selector = scraper::Selector::parse("title").ok()?;
    let raw = document
        .select(&selector)
        .next()
        .map(|el| el.text().collect::<String>().trim().to_string())?;

    if raw.is_empty() {
        return None;
    }

    // " | サイト名" や " - サイト名" のサフィックスを除去
    let separators = [" | ", " - ", " — ", " :: "];
    for sep in separators {
        if let Some(pos) = raw.rfind(sep) {
            let title_part = raw[..pos].trim();
            if !title_part.is_empty() {
                return Some(title_part.to_string());
            }
        }
    }

    Some(raw)
}

// ════════════════════════════════════════════════════════════
// HTML ヘルパー関数
// ════════════════════════════════════════════════════════════

/// `<meta name="key" content="value">` から content を取得する
fn get_meta_content(document: &scraper::Html, name: &str) -> Option<String> {
    // name 属性は大文字小文字が混在するサイトがあるため、両方試す
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

    // ── DOI 抽出テスト ──

    #[test]
    fn test_extract_doi_from_doi_org() {
        assert_eq!(
            extract_doi_from_url("https://doi.org/10.1234/test.5678"),
            Some("10.1234/test.5678".to_string())
        );
    }

    #[test]
    fn test_extract_doi_from_dx_doi_org() {
        assert_eq!(
            extract_doi_from_url("https://dx.doi.org/10.1080/12345678.2024.1234567"),
            Some("10.1080/12345678.2024.1234567".to_string())
        );
    }

    #[test]
    fn test_extract_doi_from_tandfonline() {
        assert_eq!(
            extract_doi_from_url("https://www.tandfonline.com/doi/full/10.1080/03075079.2024.2323593"),
            Some("10.1080/03075079.2024.2323593".to_string())
        );
    }

    #[test]
    fn test_extract_doi_from_tandfonline_abs() {
        assert_eq!(
            extract_doi_from_url("https://www.tandfonline.com/doi/abs/10.1080/12345678.2024.9999999"),
            Some("10.1080/12345678.2024.9999999".to_string())
        );
    }

    #[test]
    fn test_extract_doi_from_wiley() {
        assert_eq!(
            extract_doi_from_url("https://onlinelibrary.wiley.com/doi/10.1002/abc.12345"),
            Some("10.1002/abc.12345".to_string())
        );
    }

    #[test]
    fn test_extract_doi_from_springer() {
        assert_eq!(
            extract_doi_from_url("https://link.springer.com/article/10.1007/s00123-024-01234-5"),
            Some("10.1007/s00123-024-01234-5".to_string())
        );
    }

    #[test]
    fn test_extract_doi_from_nature() {
        assert_eq!(
            extract_doi_from_url("https://www.nature.com/articles/s41586-024-07386-0"),
            Some("10.1038/s41586-024-07386-0".to_string())
        );
    }

    #[test]
    fn test_extract_doi_from_jstor() {
        assert_eq!(
            extract_doi_from_url("https://www.jstor.org/stable/10.1086/123456"),
            Some("10.1086/123456".to_string())
        );
    }

    #[test]
    fn test_extract_doi_from_jstor_numeric_id() {
        assert_eq!(
            extract_doi_from_url("https://www.jstor.org/stable/12345678"),
            Some("10.2307/12345678".to_string())
        );
    }

    #[test]
    fn test_extract_doi_from_arxiv() {
        assert_eq!(
            extract_doi_from_url("https://arxiv.org/abs/2301.12345"),
            Some("10.48550/arXiv.2301.12345".to_string())
        );
    }

    #[test]
    fn test_extract_doi_from_sabinet() {
        assert_eq!(
            extract_doi_from_url("https://journals.co.za/doi/10.10520/ejc-actat1-v44-n2-a4"),
            Some("10.10520/ejc-actat1-v44-n2-a4".to_string())
        );
    }

    #[test]
    fn test_extract_doi_from_sagepub() {
        assert_eq!(
            extract_doi_from_url("https://journals.sagepub.com/doi/10.1177/00491241211036158"),
            Some("10.1177/00491241211036158".to_string())
        );
    }

    #[test]
    fn test_no_doi_from_jstage() {
        // J-Stage URL には DOI が含まれないのでスクレイピングにフォールバック
        assert_eq!(
            extract_doi_from_url("https://www.jstage.jst.go.jp/article/jjspe/89/1/89_56/_article/-char/ja"),
            None
        );
    }

    #[test]
    fn test_no_doi_from_sciencedirect_pii() {
        // ScienceDirect の PII URL には DOI が含まれない
        assert_eq!(
            extract_doi_from_url("https://www.sciencedirect.com/science/article/pii/S0001234567890123"),
            None
        );
    }

    // ── CiNii CRID 抽出テスト ──

    #[test]
    fn test_extract_cinii_crid() {
        assert_eq!(
            extract_cinii_crid("https://cir.nii.ac.jp/crid/1234567890123456789"),
            Some("1234567890123456789".to_string())
        );
    }

    #[test]
    fn test_extract_cinii_naid() {
        assert_eq!(
            extract_cinii_crid("https://ci.nii.ac.jp/naid/110012345678/"),
            Some("110012345678".to_string())
        );
    }

    // ── DOI ユーティリティテスト ──

    #[test]
    fn test_normalize_doi() {
        assert_eq!(normalize_doi("https://doi.org/10.1234/test"), "10.1234/test");
        assert_eq!(normalize_doi("doi:10.1234/test"), "10.1234/test");
        assert_eq!(normalize_doi("  10.1234/test  "), "10.1234/test");
    }

    #[test]
    fn test_is_valid_doi() {
        assert!(is_valid_doi("10.1234/test.5678"));
        assert!(is_valid_doi("10.1080/03075079.2024.2323593"));
        assert!(!is_valid_doi("not-a-doi"));
        assert!(!is_valid_doi("10.123")); // スラッシュなし
    }

    // ── 年抽出テスト ──

    #[test]
    fn test_extract_year_from_date() {
        assert_eq!(extract_year_from_date("2024"), Some(2024));
        assert_eq!(extract_year_from_date("2024/01/15"), Some(2024));
        assert_eq!(extract_year_from_date("2024-01-15"), Some(2024));
        assert_eq!(extract_year_from_date("January 2024"), Some(2024));
    }

    // ── HTML ヘルパーテスト ──

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

    // ── メタデータマージテスト ──

    #[test]
    fn test_merge_metadata() {
        let primary = PaperMetadata {
            title: "Primary Title".to_string(),
            authors: vec![],
            year: None,
            journal: Some("Primary Journal".to_string()),
            volume: None,
            issue: None,
            pages: None,
            doi: Some("10.1234/test".to_string()),
            url: Some("https://example.com".to_string()),
            r#abstract: None,
        };
        let secondary = PaperMetadata {
            title: "Secondary Title".to_string(),
            authors: vec!["Author A".to_string()],
            year: Some(2024),
            journal: Some("Secondary Journal".to_string()),
            volume: Some("1".to_string()),
            issue: Some("2".to_string()),
            pages: Some("1-10".to_string()),
            doi: Some("10.1234/test".to_string()),
            url: Some("https://doi.org/10.1234/test".to_string()),
            r#abstract: Some("Abstract text".to_string()),
        };

        let merged = merge_metadata(primary, secondary);
        assert_eq!(merged.title, "Primary Title");
        assert_eq!(merged.authors, vec!["Author A".to_string()]);
        assert_eq!(merged.year, Some(2024));
        assert_eq!(merged.journal, Some("Primary Journal".to_string()));
        assert_eq!(merged.volume, Some("1".to_string()));
        assert_eq!(merged.r#abstract, Some("Abstract text".to_string()));
    }
}
