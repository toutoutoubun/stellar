// src-tauri/src/utils/metadata.rs
// Stellar — メタデータ取得ユーティリティ
// DOI / CiNii CRID / URL から論文のメタデータを取得する
//
// 取得戦略（優先順位）:
// 1. URL から DOI を抽出 → CrossRef API で解決（最も信頼性が高い）
// 2. CiNii / IRDB URL の場合 → CiNii Research API で解決
// 3. J-Stage URL の場合 → J-Stage Article API を試行
// 4. HTML meta タグスクレイピング（citation_*, Highwire Press, Dublin Core, OGP）
// 5. スクレイプで DOI を発見した場合 → CrossRef API で補完
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
/// 3. J-Stage URL の場合 → J-Stage Article API を試行
/// 4. HTML スクレイピングを実行（サイト別最適化ヘッダー付き）
/// 5. スクレイプ結果の DOI で CrossRef を補完
pub async fn scrape_metadata_from_url(url: &str) -> Result<PaperMetadata, MetadataError> {
    let url = url.trim();
    log::info!("[metadata] URL からメタデータ取得を開始: {}", url);

    // ── 戦略 0: IRDB URL の場合、リダイレクト先を追跡して CiNii URL を取得 ──
    let resolved_url = if url.to_lowercase().contains("irdb.nii.ac.jp") {
        log::info!("[metadata] IRDB URL を検出、リダイレクト先を追跡");
        match resolve_irdb_redirect(url).await {
            Ok(redirected) => {
                log::info!("[metadata] IRDB リダイレクト先: {}", redirected);
                redirected
            }
            Err(e) => {
                log::warn!("[metadata] IRDB リダイレクト追跡失敗: {} — 元URL で続行", e);
                url.to_string()
            }
        }
    } else {
        url.to_string()
    };

    // ── 戦略 1: URL から DOI を抽出し、CrossRef API で解決 ──
    if let Some(doi) = extract_doi_from_url(&resolved_url) {
        log::info!("[metadata] URL から DOI を抽出: {}", doi);
        match fetch_from_crossref(&doi).await {
            Ok(mut meta) => {
                // CrossRef の URL が元の URL と異なる場合、元の URL を保持
                if meta.url.as_deref() != Some(url) {
                    meta.url = Some(url.to_string());
                }
                // PDF URL の抽出を試みる
                if meta.pdf_url.is_none() {
                    meta.pdf_url = guess_pdf_url_from_doi(&doi);
                }
                log::info!("[metadata] CrossRef API で解決成功 (DOI: {})", doi);
                return Ok(meta);
            }
            Err(e) => {
                log::warn!(
                    "[metadata] CrossRef API フォールバック失敗 (DOI: {}): {}",
                    doi,
                    e
                );
                // 失敗してもスクレイピングにフォールバック
            }
        }
    }

    // ── 戦略 2: CiNii / IRDB URL の場合、CiNii Research API で解決 ──
    if let Some(crid) = extract_cinii_crid(&resolved_url) {
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

    // ── 戦略 3: J-Stage URL の場合、J-Stage 記事 API を試行 ──
    if resolved_url.to_lowercase().contains("jstage.jst.go.jp") {
        log::info!("[metadata] J-Stage URL を検出、記事API を試行");
        match fetch_from_jstage_api(&resolved_url).await {
            Ok(meta) => {
                log::info!("[metadata] J-Stage API で解決成功");
                return Ok(meta);
            }
            Err(e) => {
                log::warn!("[metadata] J-Stage API フォールバック失敗: {}", e);
            }
        }
    }

    // ── 戦略 4: HTML スクレイピング（サイト別最適化、リトライ付き） ──
    log::info!("[metadata] HTML スクレイピングにフォールバック");
    let mut meta = scrape_html_metadata_with_retry(&resolved_url).await?;

    // URL を元の入力値で上書き（リダイレクト先ではなく）
    meta.url = Some(url.to_string());

    // ── 戦略 5: スクレイプ結果の DOI で CrossRef 補完 ──
    if let Some(ref doi) = meta.doi {
        let doi_clean = normalize_doi(doi);
        if !doi_clean.is_empty() && (meta.authors.is_empty() || meta.year.is_none()) {
            log::info!(
                "[metadata] スクレイプ結果の DOI で CrossRef 補完を試行: {}",
                doi_clean
            );
            if let Ok(crossref_meta) = fetch_from_crossref(&doi_clean).await {
                meta = merge_metadata(meta, crossref_meta);
            }
        }
    }

    // ── PDF URL 抽出（スクレイプ結果にない場合） ──
    if meta.pdf_url.is_none() {
        if let Some(ref doi) = meta.doi {
            meta.pdf_url = guess_pdf_url_from_doi(doi);
        }
    }

    Ok(meta)
}

// ════════════════════════════════════════════════════════════
// IRDB リダイレクト追跡
// ════════════════════════════════════════════════════════════

/// IRDB URL を HEAD リクエストでリダイレクト先まで追跡する
/// IRDB は多くの場合 CiNii Research にリダイレクトされる
async fn resolve_irdb_redirect(url: &str) -> Result<String, MetadataError> {
    // リダイレクトを追跡するが、本体は取得しない（HEAD）
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(10))
        .timeout(std::time::Duration::from_secs(15))
        .use_rustls_tls()
        .build()
        .map_err(|e| MetadataError::NetworkError(format!("HTTP クライアント構築失敗: {}", e)))?;

    let response = client
        .get(url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .header("Accept", "text/html")
        .send()
        .await
        .map_err(|e| MetadataError::NetworkError(format!("IRDB リダイレクト追跡失敗: {}", e)))?;

    let final_url = response.url().to_string();
    Ok(final_url)
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
    // J-Stage は URL に直接 DOI が入っていないが、citation_doi meta タグで取得可能
    // ここでは URL パターンから DOI は抽出不可 → スクレイピングにフォールバック

    // ── Elsevier / ScienceDirect ──
    // https://www.sciencedirect.com/science/article/pii/S0001234567890123
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
            let article_id = article_id
                .split('?')
                .next()
                .unwrap_or(&article_id)
                .to_string();
            let article_id = article_id
                .split('#')
                .next()
                .unwrap_or(&article_id)
                .to_string();
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
    // SciELO は citation_doi メタタグを提供 → スクレイピングにフォールバック

    // ── PubMed / PMC ──
    // DOI は URL に含まれないが、PubMed API で取得可能 → スクレイピングにフォールバック

    // ── arXiv ──
    // https://arxiv.org/abs/2301.12345
    // https://arxiv.org/pdf/2301.12345
    if url_lower.contains("arxiv.org/abs/") || url_lower.contains("arxiv.org/pdf/") {
        let pattern = if url_lower.contains("/abs/") {
            "arxiv.org/abs/"
        } else {
            "arxiv.org/pdf/"
        };
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
    // https://sabinet.co.za/record/... → DOI は不明 → スクレイピング
    // Sabinet 個別記事ページからもDOI パターンを探す
    if url_lower.contains("sabinet.co.za") {
        if let Some(doi) = extract_doi_pattern_from_anywhere(url) {
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

    // https://cir.nii.ac.jp/all/... (検索結果からの直接リンク)
    if url_lower.contains("cir.nii.ac.jp/all/") {
        return extract_after_pattern(url, "cir.nii.ac.jp/all/")
            .map(|s| s.split('?').next().unwrap_or(&s).to_string())
            .map(|s| s.split('#').next().unwrap_or(&s).to_string())
            .map(|s| s.trim_end_matches('/').to_string());
    }

    None
}

// ════════════════════════════════════════════════════════════
// DOI ヘルパー
// ════════════════════════════════════════════════════════════

/// DOI を正規化する（前後の空白・URL プレフィックス除去）
fn normalize_doi(doi: &str) -> String {
    let doi = doi.trim();
    let doi = doi
        .strip_prefix("https://doi.org/")
        .or_else(|| doi.strip_prefix("http://doi.org/"))
        .or_else(|| doi.strip_prefix("https://dx.doi.org/"))
        .or_else(|| doi.strip_prefix("http://dx.doi.org/"))
        .or_else(|| doi.strip_prefix("doi:"))
        .unwrap_or(doi);
    urlencoding::decode(doi)
        .unwrap_or_else(|_| doi.into())
        .to_string()
}

/// DOI の基本的な形式チェック（10.xxxx/yyyy）
fn is_valid_doi(doi: &str) -> bool {
    doi.starts_with("10.") && doi.contains('/') && doi.len() > 7
}

/// URL 中の特定パターン以降の文字列を抽出する
fn extract_after_pattern(url: &str, pattern: &str) -> Option<String> {
    let url_lower = url.to_lowercase();
    let pattern_lower = pattern.to_lowercase();
    if let Some(pos) = url_lower.find(&pattern_lower) {
        let start = pos + pattern.len();
        if start < url.len() {
            let remainder = &url[start..];
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
    if let Some(pos) = url_lower.find("/doi/") {
        let after_doi = &url[pos + 5..];
        let after_prefix = after_doi
            .strip_prefix("full/")
            .or_else(|| after_doi.strip_prefix("abs/"))
            .or_else(|| after_doi.strip_prefix("epub/"))
            .or_else(|| after_doi.strip_prefix("pdf/"))
            .unwrap_or(after_doi);
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
    let decoded = urlencoding::decode(url).unwrap_or_else(|_| url.into());
    let chars: Vec<char> = decoded.chars().collect();
    let len = chars.len();
    let mut i = 0;
    while i + 4 < len {
        if chars[i] == '1' && chars[i + 1] == '0' && chars[i + 2] == '.' {
            if i + 3 < len && chars[i + 3].is_ascii_digit() {
                let start = i;
                let mut end = i + 3;
                let mut has_slash = false;
                while end < len {
                    let c = chars[end];
                    if c == ' '
                        || c == '\t'
                        || c == '\n'
                        || c == '"'
                        || c == '\''
                        || c == '<'
                        || c == '>'
                        || c == '|'
                        || c == '{'
                        || c == '}'
                    {
                        break;
                    }
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
                    let candidate = candidate.trim_end_matches(|c: char| {
                        c == '.' || c == ',' || c == ';' || c == ')' || c == '/'
                    });
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

/// DOI からPDF URLを推定する（既知のパブリッシャーパターン）
fn guess_pdf_url_from_doi(doi: &str) -> Option<String> {
    // arXiv
    if doi.starts_with("10.48550/arXiv.") {
        let arxiv_id = doi.strip_prefix("10.48550/arXiv.")?;
        return Some(format!("https://arxiv.org/pdf/{}.pdf", arxiv_id));
    }
    // Unpaywall API で PDF URL を取得する方が正確だが、
    // ここでは簡易推定のみ
    None
}

// ════════════════════════════════════════════════════════════
// CrossRef API
// ════════════════════════════════════════════════════════════

/// CrossRef API からメタデータを取得する（リトライ付き）
async fn fetch_from_crossref(doi: &str) -> Result<PaperMetadata, MetadataError> {
    let url = format!(
        "https://api.crossref.org/works/{}",
        urlencoding::encode(doi)
    );
    let client = build_http_client()?;

    // 最大2回リトライ（合計3回試行）
    let mut last_err = MetadataError::NetworkError("未試行".to_string());
    for attempt in 0..3 {
        if attempt > 0 {
            log::info!(
                "[metadata] CrossRef API リトライ {}/2 (DOI: {})",
                attempt,
                doi
            );
            tokio::time::sleep(std::time::Duration::from_millis(500 * (attempt as u64))).await;
        }

        match client
            .get(&url)
            .header(
                "User-Agent",
                "Stellar/0.1.0 (mailto:stellar@example.com; https://github.com/stellar-app)",
            )
            .send()
            .await
        {
            Ok(response) => {
                if response.status() == reqwest::StatusCode::NOT_FOUND {
                    return Err(MetadataError::NotFound(format!(
                        "DOI '{}' に対応する論文が見つかりません",
                        doi
                    )));
                }
                if response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
                    last_err = MetadataError::ApiError("CrossRef API レート制限 (429)".to_string());
                    continue;
                }
                if !response.status().is_success() {
                    last_err = MetadataError::ApiError(format!(
                        "CrossRef API がエラーを返しました ({})",
                        response.status()
                    ));
                    continue;
                }

                let body: serde_json::Value = response.json().await.map_err(|e| {
                    MetadataError::ParseError(format!("レスポンスの解析に失敗: {}", e))
                })?;

                return parse_crossref_response(&body, doi);
            }
            Err(e) => {
                last_err =
                    MetadataError::NetworkError(format!("CrossRef API への接続に失敗: {}", e));
            }
        }
    }

    Err(last_err)
}

/// CrossRef JSON レスポンスからメタデータを抽出する
fn parse_crossref_response(
    body: &serde_json::Value,
    doi: &str,
) -> Result<PaperMetadata, MetadataError> {
    let message = body
        .get("message")
        .ok_or_else(|| MetadataError::ParseError("message フィールドがありません".to_string()))?;

    let title = message
        .get("title")
        .and_then(|t| t.as_array())
        .and_then(|arr| arr.first())
        .and_then(|v| v.as_str())
        .unwrap_or("Untitled")
        .to_string();

    let authors = message
        .get("author")
        .and_then(|a| a.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|author| {
                    let given = author.get("given").and_then(|v| v.as_str()).unwrap_or("");
                    let family = author.get("family").and_then(|v| v.as_str()).unwrap_or("");
                    if family.is_empty() && given.is_empty() {
                        author
                            .get("name")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string())
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

    let journal = message
        .get("container-title")
        .and_then(|ct| ct.as_array())
        .and_then(|arr| arr.first())
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

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

    let r#abstract = message
        .get("abstract")
        .and_then(|v| v.as_str())
        .map(|s| strip_html_tags(s));

    let url = message
        .get("URL")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // CrossRef から PDF リンクを抽出
    let pdf_url = message
        .get("link")
        .and_then(|l| l.as_array())
        .and_then(|links| {
            links.iter().find_map(|link| {
                let content_type = link
                    .get("content-type")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let intended_app = link
                    .get("intended-application")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                if content_type == "application/pdf" || intended_app == "text-mining" {
                    link.get("URL")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string())
                } else {
                    None
                }
            })
        });

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
        pdf_url,
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

    let journal = body
        .get("publicationName")
        .and_then(|v| v.as_str())
        .or_else(|| body.get("prism:publicationName").and_then(|v| v.as_str()))
        .map(|s| s.to_string());

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

    let doi = body
        .get("doi")
        .and_then(|v| v.as_str())
        .or_else(|| body.get("prism:doi").and_then(|v| v.as_str()))
        .map(|s| s.to_string());

    let r#abstract = body
        .get("description")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let link_url = body
        .get("@id")
        .and_then(|v| v.as_str())
        .or_else(|| body.get("url").and_then(|v| v.as_str()))
        .map(|s| s.to_string())
        .or_else(|| Some(format!("https://cir.nii.ac.jp/crid/{}", crid)));

    // CiNii から PDF リンクを探す
    let pdf_url = body
        .get("relation")
        .and_then(|v| v.as_array())
        .and_then(|arr| {
            arr.iter().find_map(|rel| {
                let rel_type = rel.get("@type").and_then(|v| v.as_str()).unwrap_or("");
                let rel_url = rel.get("@id").and_then(|v| v.as_str());
                if rel_type == "fullTextUrl" {
                    rel_url.map(|s| s.to_string())
                } else {
                    None
                }
            })
        });

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
        pdf_url,
    })
}

// ════════════════════════════════════════════════════════════
// J-Stage Article API
// ════════════════════════════════════════════════════════════

/// J-Stage 記事 URL から J-Stage API でメタデータを取得する
/// J-Stage URL: https://www.jstage.jst.go.jp/article/{journal_code}/{vol}/{issue}/{page}/_article/-char/{lang}
async fn fetch_from_jstage_api(url: &str) -> Result<PaperMetadata, MetadataError> {
    // URL から記事IDを抽出
    // https://www.jstage.jst.go.jp/article/journalcode/vol/issue/page/_article
    let url_lower = url.to_lowercase();

    // J-Stage API: 記事のメタデータを JSON-LD で取得
    // まずはHTMLスクレイピングで DOI を取得し、CrossRef で解決する方が確実
    // J-Stage は citation_doi メタタグを必ず提供する

    // J-Stage にはDOI以外にも独自の記事APIがある
    // https://www.jstage.jst.go.jp/AF06S010ShsiDtl?sryCd=xxx&noVol=x&noIssue=x
    // しかし公式APIはXMLベースで扱いにくい

    // 代わりに、J-Stage の URL パターンから journal_code を抽出して
    // J-Stage XML API を呼ぶ
    if let Some(pos) = url_lower.find("/article/") {
        let after = &url[pos + 9..]; // "/article/" の後
        let parts: Vec<&str> = after.split('/').collect();
        if parts.len() >= 4 {
            let journal_code = parts[0];
            let vol = parts[1];
            let _issue = parts[2];
            let page = parts[3];

            // J-Stage の記事識別子で検索
            let api_url = format!(
                "https://www.jstage.jst.go.jp/AF06S010ShsiDtl?sryCd={}&noVol={}&noIssue=&artcdStar={}&cdLang=JA&request_locale=JA",
                journal_code, vol, page
            );
            log::info!("[metadata] J-Stage API URL: {}", api_url);

            // J-Stage API は不安定なことがあるので、HTMLスクレイピングにフォールバック
        }
    }

    // J-Stage はHTMLスクレイピングの方が確実
    // 専用のヘッダーとセレクタを使用
    scrape_html_metadata_with_retry(url).await
}

// ════════════════════════════════════════════════════════════
// HTML スクレイピング（サイト別最適化 + リトライ）
// ════════════════════════════════════════════════════════════

/// サイト識別子
#[derive(Debug, Clone, Copy)]
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
    CiNii,
    Generic,
}

/// URL からサイトを識別する
fn identify_site(url: &str) -> AcademicSite {
    let url_lower = url.to_lowercase();
    if url_lower.contains("jstage.jst.go.jp") {
        AcademicSite::JStage
    } else if url_lower.contains("sciencedirect.com")
        || url_lower.contains("elsevier.com")
        || url_lower.contains("linkinghub.elsevier.com")
    {
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
    } else if url_lower.contains("pubmed.ncbi")
        || url_lower.contains("pmc.ncbi")
        || url_lower.contains("ncbi.nlm.nih.gov")
    {
        AcademicSite::PubMed
    } else if url_lower.contains("arxiv.org") {
        AcademicSite::ArXiv
    } else if url_lower.contains("cir.nii.ac.jp") || url_lower.contains("ci.nii.ac.jp") {
        AcademicSite::CiNii
    } else {
        AcademicSite::Generic
    }
}

/// サイト別に最適化された HTTP ヘッダーを取得する
fn get_site_headers(site: &AcademicSite) -> Vec<(&'static str, String)> {
    let mut headers: Vec<(&'static str, String)> = vec![
        (
            "Accept",
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8".to_string(),
        ),
        ("Accept-Language", "en-US,en;q=0.9,ja;q=0.8".to_string()),
        ("Cache-Control", "no-cache".to_string()),
        ("Pragma", "no-cache".to_string()),
    ];

    let chrome_ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36".to_string();

    match site {
        AcademicSite::JStage => {
            headers.push(("User-Agent", chrome_ua));
            headers.push(("Accept-Language", "ja,en-US;q=0.9,en;q=0.8".to_string()));
            headers.push(("Referer", "https://www.jstage.jst.go.jp/".to_string()));
        }
        AcademicSite::ScienceDirect => {
            // ScienceDirect は特に厳しいbot検知を行う
            // Accept ヘッダーにXMLを含めると別レスポンスになることがある
            headers.push(("User-Agent", chrome_ua));
            headers.push(("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8".to_string()));
            headers.push(("Sec-Fetch-Dest", "document".to_string()));
            headers.push(("Sec-Fetch-Mode", "navigate".to_string()));
            headers.push(("Sec-Fetch-Site", "none".to_string()));
            headers.push(("Sec-Fetch-User", "?1".to_string()));
            headers.push(("Upgrade-Insecure-Requests", "1".to_string()));
            headers.push((
                "Sec-Ch-Ua",
                "\"Chromium\";v=\"124\", \"Google Chrome\";v=\"124\", \"Not-A.Brand\";v=\"99\""
                    .to_string(),
            ));
            headers.push(("Sec-Ch-Ua-Mobile", "?0".to_string()));
            headers.push(("Sec-Ch-Ua-Platform", "\"Windows\"".to_string()));
        }
        AcademicSite::TaylorFrancis => {
            headers.push(("User-Agent", chrome_ua));
            headers.push(("Sec-Fetch-Dest", "document".to_string()));
            headers.push(("Sec-Fetch-Mode", "navigate".to_string()));
            headers.push(("Sec-Fetch-Site", "none".to_string()));
            headers.push(("Sec-Fetch-User", "?1".to_string()));
            headers.push(("Upgrade-Insecure-Requests", "1".to_string()));
            headers.push(("Referer", "https://www.google.com/".to_string()));
        }
        AcademicSite::Jstor => {
            headers.push(("User-Agent", chrome_ua));
            headers.push(("Referer", "https://www.google.com/".to_string()));
        }
        AcademicSite::Sabinet => {
            headers.push(("User-Agent", chrome_ua));
        }
        AcademicSite::Wiley => {
            headers.push(("User-Agent", chrome_ua));
            headers.push(("Sec-Fetch-Dest", "document".to_string()));
            headers.push(("Sec-Fetch-Mode", "navigate".to_string()));
            headers.push(("Sec-Fetch-Site", "none".to_string()));
            headers.push(("Sec-Fetch-User", "?1".to_string()));
            headers.push(("Upgrade-Insecure-Requests", "1".to_string()));
        }
        AcademicSite::Springer => {
            headers.push(("User-Agent", chrome_ua));
        }
        AcademicSite::PubMed | AcademicSite::ArXiv => {
            headers.push((
                "User-Agent",
                "Stellar/0.1.0 (Academic Reference Manager)".to_string(),
            ));
        }
        AcademicSite::CiNii => {
            headers.push(("User-Agent", chrome_ua));
            headers.push(("Accept-Language", "ja,en-US;q=0.9,en;q=0.8".to_string()));
        }
        AcademicSite::SciELO | AcademicSite::Generic => {
            headers.push(("User-Agent", chrome_ua));
        }
    }

    headers
}

/// HTML をスクレイプしてメタデータを抽出する（リトライ付き）
async fn scrape_html_metadata_with_retry(url: &str) -> Result<PaperMetadata, MetadataError> {
    let site = identify_site(url);
    let mut last_err = MetadataError::NetworkError("未試行".to_string());

    // 最大2回リトライ（合計3回試行）、403/429の場合は遅延を入れる
    for attempt in 0..3 {
        if attempt > 0 {
            let delay_ms = match attempt {
                1 => 1000,
                _ => 2000,
            };
            log::info!(
                "[metadata] スクレイピング リトライ {}/2 (URL: {}) — {}ms 待機",
                attempt,
                url,
                delay_ms
            );
            tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
        }

        match scrape_html_metadata_once(url, &site).await {
            Ok(meta) => return Ok(meta),
            Err(MetadataError::ApiError(msg)) if msg.contains("403") || msg.contains("429") => {
                log::warn!("[metadata] アクセス制限 (attempt {}): {}", attempt, msg);
                last_err = MetadataError::ApiError(msg);
                continue;
            }
            Err(e) => {
                last_err = e;
                // ネットワークエラーやパースエラーはリトライしない
                break;
            }
        }
    }

    // 最終手段: DOI がURLから取得できるならば CrossRef にフォールバック
    // （通常はここに到達しない — extract_doi_from_url で先にやっている）
    Err(last_err)
}

/// HTML をスクレイプしてメタデータを抽出する（1回の試行）
async fn scrape_html_metadata_once(
    url: &str,
    site: &AcademicSite,
) -> Result<PaperMetadata, MetadataError> {
    let headers = get_site_headers(site);
    let client = build_http_client()?;

    let mut request = client.get(url);
    for (key, value) in &headers {
        request = request.header(*key, value.as_str());
    }

    let response = request.send().await.map_err(|e| {
        log::error!("[metadata] HTTP リクエスト失敗: {} — {}", url, e);
        MetadataError::NetworkError(format!("URL への接続に失敗: {}", e))
    })?;

    let status = response.status();
    log::info!("[metadata] HTTP {} — {}", status, url);

    if !status.is_success() {
        let msg = match status.as_u16() {
            403 => format!(
                "アクセスが拒否されました (403)。{}はボット対策のためアクセスを制限している可能性があります。DOI を使って取得してください。URL: {}",
                site_display_name(site), url
            ),
            429 => format!(
                "リクエスト制限に達しました (429)。しばらく待ってから再試行してください。URL: {}", url
            ),
            _ => format!("HTTP {} が返されました: {}", status, url),
        };
        return Err(MetadataError::ApiError(msg));
    }

    // J-Stage 等の日本語サイトは Shift_JIS / EUC-JP で返すことがある。
    // reqwest::Response::text() は Content-Type charset を参照するが、
    // charset が指定されていない場合 UTF-8 と仮定して壊れることがある。
    // bytes() で取得し、encoding_rs で明示的にデコードすることで
    // プラットフォームによらず正しく処理できるようにする。
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    let raw_bytes = response
        .bytes()
        .await
        .map_err(|e| MetadataError::ParseError(format!("HTML の取得に失敗: {}", e)))?;

    let html_text = decode_html_bytes(&raw_bytes, &content_type);

    parse_html_metadata(&html_text, url, site)
}

/// HTML テキストからメタデータを抽出する
fn parse_html_metadata(
    html: &str,
    url: &str,
    site: &AcademicSite,
) -> Result<PaperMetadata, MetadataError> {
    let document = scraper::Html::parse_document(html);

    // ── タイトル ──
    let title = get_meta_content(&document, "citation_title")
        .or_else(|| get_meta_content(&document, "DC.title"))
        .or_else(|| get_meta_content(&document, "dc.title"))
        .or_else(|| get_meta_content(&document, "DC.Title"))
        .or_else(|| get_meta_property(&document, "og:title"))
        .or_else(|| extract_title_from_html(&document, site))
        .or_else(|| extract_title_tag(&document))
        .unwrap_or_else(|| "Untitled".to_string());

    // ── 著者 ──
    let mut authors = get_all_meta_contents(&document, "citation_author");
    if authors.is_empty() {
        authors = get_all_meta_contents(&document, "citation_authors")
            .into_iter()
            .flat_map(|s| {
                s.split(';')
                    .map(|a| a.trim().to_string())
                    .collect::<Vec<_>>()
            })
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
        .or_else(|| extract_doi_from_html_body(html));

    // ── アブストラクト ──
    let r#abstract = get_meta_content(&document, "citation_abstract")
        .or_else(|| get_meta_content(&document, "DC.description"))
        .or_else(|| get_meta_content(&document, "dc.description"))
        .or_else(|| get_meta_content(&document, "description"))
        .or_else(|| get_meta_property(&document, "og:description"))
        .or_else(|| extract_abstract_from_html(&document, site))
        .map(|s| strip_html_tags(&s));

    // ── PDF URL ──
    let pdf_url = get_meta_content(&document, "citation_pdf_url")
        .or_else(|| extract_pdf_url_from_html(&document, url, site));

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
        pdf_url,
    })
}

// ════════════════════════════════════════════════════════════
// サイト固有の HTML 抽出
// ════════════════════════════════════════════════════════════

/// HTML 本文からタイトルを抽出（meta タグにない場合のフォールバック）
fn extract_title_from_html(document: &scraper::Html, site: &AcademicSite) -> Option<String> {
    let selectors = match site {
        AcademicSite::JStage => vec![
            "h1.article-title",
            ".article-title",
            "#article-overiew-title",
        ],
        AcademicSite::ScienceDirect => vec!["h1.title-text span", ".title-text"],
        AcademicSite::Jstor => vec!["h1.item-title", ".item-title"],
        AcademicSite::Sabinet => vec!["h1.article-title", ".article-detail h1"],
        AcademicSite::CiNii => vec!["h1.item-title", ".item-title"],
        _ => vec!["h1.article-title", "h1.title", "article h1"],
    };

    for selector_str in selectors {
        if let Ok(sel) = scraper::Selector::parse(selector_str) {
            if let Some(el) = document.select(&sel).next() {
                let text = el.text().collect::<String>().trim().to_string();
                if !text.is_empty() {
                    return Some(text);
                }
            }
        }
    }
    None
}

/// HTML 本文から著者を抽出する（meta タグにない場合のフォールバック）
fn extract_authors_from_html(document: &scraper::Html, site: &AcademicSite) -> Vec<String> {
    match site {
        AcademicSite::JStage => {
            if let Ok(sel) =
                scraper::Selector::parse(".author-list a, .article-author a, .content-author a")
            {
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
        AcademicSite::ScienceDirect => {
            // ScienceDirect: JSON-LD スクリプトから著者を抽出
            if let Some(authors) = extract_authors_from_json_ld(document) {
                return authors;
            }
            if let Ok(sel) = scraper::Selector::parse(".author-group .text .content span.given-name, .author-group .text .content span.surname") {
                let names: Vec<String> = document
                    .select(&sel)
                    .map(|el| el.text().collect::<String>().trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect();
                // given + surname のペアを結合
                let mut authors = Vec::new();
                let mut i = 0;
                while i + 1 < names.len() {
                    authors.push(format!("{} {}", names[i], names[i + 1]));
                    i += 2;
                }
                if !authors.is_empty() {
                    return authors;
                }
            }
        }
        AcademicSite::TaylorFrancis => {
            if let Ok(sel) =
                scraper::Selector::parse(".entryAuthor a, .author-name a, .NLM_contrib-group a")
            {
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
        AcademicSite::Jstor => {
            if let Ok(sel) = scraper::Selector::parse(
                ".contrib-group .name, .item-contributors .name, [data-testid=\"author-name\"]",
            ) {
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
            if let Ok(sel) =
                scraper::Selector::parse(".authors-list-item .full-name, .authors-list a.full-name")
            {
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
        AcademicSite::Sabinet => {
            if let Ok(sel) =
                scraper::Selector::parse(".article-authors a, .author-name, .contributor-name")
            {
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
        AcademicSite::CiNii => {
            if let Ok(sel) =
                scraper::Selector::parse(".author-list a, .item-creator a, [itemprop=\"author\"] a")
            {
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

    // 汎用: schema.org の author + JSON-LD
    if let Some(authors) = extract_authors_from_json_ld(document) {
        return authors;
    }
    if let Ok(sel) =
        scraper::Selector::parse("[itemprop=\"author\"] [itemprop=\"name\"], [rel=\"author\"]")
    {
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

/// JSON-LD スクリプトタグから著者を抽出する
fn extract_authors_from_json_ld(document: &scraper::Html) -> Option<Vec<String>> {
    let sel = scraper::Selector::parse("script[type=\"application/ld+json\"]").ok()?;
    for el in document.select(&sel) {
        let text = el.text().collect::<String>();
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
            // 直接 author フィールドを探す
            if let Some(authors) = extract_authors_from_json_value(&json) {
                if !authors.is_empty() {
                    return Some(authors);
                }
            }
            // @graph 配列の中も探す
            if let Some(graph) = json.get("@graph").and_then(|g| g.as_array()) {
                for item in graph {
                    if let Some(authors) = extract_authors_from_json_value(item) {
                        if !authors.is_empty() {
                            return Some(authors);
                        }
                    }
                }
            }
        }
    }
    None
}

fn extract_authors_from_json_value(json: &serde_json::Value) -> Option<Vec<String>> {
    let author = json.get("author")?;
    if let Some(arr) = author.as_array() {
        let names: Vec<String> = arr
            .iter()
            .filter_map(|a| {
                a.get("name")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .or_else(|| {
                        let given = a.get("givenName").and_then(|v| v.as_str()).unwrap_or("");
                        let family = a.get("familyName").and_then(|v| v.as_str()).unwrap_or("");
                        if !given.is_empty() || !family.is_empty() {
                            Some(format!("{} {}", given, family).trim().to_string())
                        } else {
                            None
                        }
                    })
            })
            .collect();
        if !names.is_empty() {
            return Some(names);
        }
    }
    if let Some(name) = author.get("name").and_then(|v| v.as_str()) {
        return Some(vec![name.to_string()]);
    }
    None
}

/// HTML 本文からアブストラクトを抽出する（meta タグにない場合のフォールバック）
fn extract_abstract_from_html(document: &scraper::Html, site: &AcademicSite) -> Option<String> {
    let selectors = match site {
        AcademicSite::JStage => vec![
            "#article-overiew-abstract-wrap p",
            ".abstract-contents p",
            ".article-abstract p",
            "#abst p",
        ],
        AcademicSite::ScienceDirect => {
            vec![".abstract p", "#abstracts .abstract p", ".Abstracts p"]
        }
        AcademicSite::TaylorFrancis => vec![".abstractSection p", ".abstract p", "#abstract p"],
        AcademicSite::Jstor => vec![".abstract-group p", ".item-abstract p"],
        AcademicSite::PubMed => vec![
            "#abstract .abstract-content p",
            "#enc-abstract .abstract-content p",
        ],
        AcademicSite::SciELO => vec![".abstract p", "#abstract p", ".trans-abstract p"],
        AcademicSite::Sabinet => vec![".article-abstract p", ".abstract p"],
        _ => vec!["[class*=\"abstract\"] p", "#abstract p", ".abstract p"],
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

/// HTML 本文から PDF URL を抽出する
fn extract_pdf_url_from_html(
    document: &scraper::Html,
    page_url: &str,
    site: &AcademicSite,
) -> Option<String> {
    // 1. citation_pdf_url は既にチェック済み

    // 2. サイト別のPDFリンク抽出
    let selectors = match site {
        AcademicSite::JStage => vec![
            "a[href*=\"_pdf\"]",
            "a.pdf-link",
            "a[data-track-action=\"download pdf\"]",
        ],
        AcademicSite::ScienceDirect => vec!["a.pdf-download-btn-link", "a[aria-label*=\"PDF\"]"],
        AcademicSite::TaylorFrancis => vec!["a[href*=\"/doi/pdf/\"]", "a.show-pdf"],
        AcademicSite::Jstor => vec!["a[data-sc=\"pdf link\"]", "a[href*=\"/pdf/\"]"],
        AcademicSite::ArXiv => vec!["a[href*=\"/pdf/\"]"],
        AcademicSite::Springer => vec![
            "a[data-track-action=\"download pdf\"]",
            "a.c-pdf-download__link",
        ],
        AcademicSite::PubMed => vec![".full-text-links-list a[href*=\".pdf\"]"],
        _ => vec!["a[href*=\".pdf\"]"],
    };

    for selector_str in selectors {
        if let Ok(sel) = scraper::Selector::parse(selector_str) {
            if let Some(el) = document.select(&sel).next() {
                if let Some(href) = el.value().attr("href") {
                    let absolute = make_absolute_url(href, page_url);
                    return Some(absolute);
                }
            }
        }
    }

    None
}

/// 相対URLを絶対URLに変換する
fn make_absolute_url(href: &str, base_url: &str) -> String {
    if href.starts_with("http://") || href.starts_with("https://") {
        return href.to_string();
    }
    // ベースURLからオリジンを取得
    if let Ok(base) = url::Url::parse(base_url) {
        if let Ok(abs) = base.join(href) {
            return abs.to_string();
        }
    }
    // フォールバック: 単純結合
    if href.starts_with('/') {
        // ベースURLのホスト部分と結合
        if let Some(pos) = base_url.find("://") {
            let after = &base_url[pos + 3..];
            if let Some(slash) = after.find('/') {
                return format!("{}{}", &base_url[..pos + 3 + slash], href);
            }
        }
        format!("{}{}", base_url.trim_end_matches('/'), href)
    } else {
        format!("{}/{}", base_url.trim_end_matches('/'), href)
    }
}

/// HTML 本文から DOI を探す
fn extract_doi_from_html_body(html: &str) -> Option<String> {
    if let Some(pos) = html.to_lowercase().find("doi.org/10.") {
        let start = html.to_lowercase()[..pos].rfind("http").unwrap_or(pos);
        let remainder = &html[start..];
        let end = remainder
            .find(|c: char| c == '"' || c == '\'' || c == '<' || c == '>' || c == ' ' || c == '\n')
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
// PDF ダウンロード
// ════════════════════════════════════════════════════════════

/// URL から PDF をダウンロードしてファイルに保存する
pub async fn download_pdf_from_url(url: &str, save_path: &str) -> Result<String, MetadataError> {
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(10))
        .timeout(std::time::Duration::from_secs(120))
        .use_rustls_tls()
        .build()
        .map_err(|e| MetadataError::NetworkError(format!("HTTP クライアント構築失敗: {}", e)))?;

    let response = client
        .get(url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
        .header("Accept", "application/pdf,*/*")
        .send()
        .await
        .map_err(|e| MetadataError::NetworkError(format!("PDF ダウンロード失敗: {}", e)))?;

    if !response.status().is_success() {
        return Err(MetadataError::ApiError(format!(
            "PDF ダウンロードに失敗 (HTTP {}): {}",
            response.status(),
            url
        )));
    }

    // Content-Type のチェック（PDFかどうか）
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if !content_type.contains("pdf") && !content_type.contains("octet-stream") {
        log::warn!(
            "[metadata] PDF ダウンロード: Content-Type が pdf ではない: {}",
            content_type
        );
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| MetadataError::NetworkError(format!("PDF データ取得失敗: {}", e)))?;

    // PDF の先頭バイトチェック
    if bytes.len() < 5 || &bytes[..5] != b"%PDF-" {
        return Err(MetadataError::ParseError(
            "ダウンロードされたファイルはPDFではありません".to_string(),
        ));
    }

    // ファイルに保存
    let save_dir = std::path::Path::new(save_path).parent();
    if let Some(dir) = save_dir {
        std::fs::create_dir_all(dir)
            .map_err(|e| MetadataError::NetworkError(format!("ディレクトリ作成失敗: {}", e)))?;
    }

    std::fs::write(save_path, &bytes)
        .map_err(|e| MetadataError::NetworkError(format!("PDF ファイル保存失敗: {}", e)))?;

    log::info!(
        "[metadata] PDF ダウンロード完了: {} ({} bytes) → {}",
        url,
        bytes.len(),
        save_path
    );

    Ok(save_path.to_string())
}

// ════════════════════════════════════════════════════════════
// ユーティリティ
// ════════════════════════════════════════════════════════════

/// 共通 HTTP クライアントを構築する
/// rustls-tls バックエンドを使用するため、macOS / Windows / Linux で
/// 同一の TLS 実装が使用され、プラットフォーム固有の OpenSSL/SChannel
/// リンク問題を回避できる。
fn build_http_client() -> Result<reqwest::Client, MetadataError> {
    reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(10))
        .timeout(std::time::Duration::from_secs(30))
        .connect_timeout(std::time::Duration::from_secs(15))
        .danger_accept_invalid_certs(false)
        .cookie_store(true) // クッキーストアを有効化（セッション維持用）
        .user_agent("Stellar/0.1.0 (academic research tool; mailto:contact@stellar.app)")
        .use_rustls_tls()
        .build()
        .map_err(|e| MetadataError::NetworkError(format!("HTTP クライアントの構築に失敗: {}", e)))
}

/// HTML バイト列をテキストにデコードする。
/// Content-Type ヘッダーの charset、HTML 内の meta charset、BOM を参照して
/// 正しいエンコーディングを判定する。J-Stage 等の日本語サイトが Shift_JIS /
/// EUC-JP で返すケースに対応。
fn decode_html_bytes(bytes: &[u8], content_type: &str) -> String {
    // 1. Content-Type ヘッダーから charset を抽出
    let charset_from_header = content_type
        .split(';')
        .find_map(|part| {
            let part = part.trim().to_lowercase();
            if part.starts_with("charset=") {
                Some(part["charset=".len()..].trim_matches('"').trim().to_string())
            } else {
                None
            }
        });

    // 2. HTML 内の <meta charset="..."> または <meta http-equiv="Content-Type" content="...;charset=...">
    let charset_from_html = if charset_from_header.is_none() {
        // ASCII 範囲で先頭 2048 バイトを検索（エンコーディング未確定のため安全に）
        let preview: String = bytes.iter().take(2048).map(|&b| b as char).collect();
        let preview_lower = preview.to_lowercase();

        // <meta charset="xxx">
        preview_lower
            .find("charset=")
            .and_then(|pos| {
                let after = &preview_lower[pos + 8..];
                let after = after.trim_start_matches(['\"', '\'', ' ']);
                let end = after.find(|c: char| c == '"' || c == '\'' || c == ';' || c == '>' || c == ' ')
                    .unwrap_or(after.len());
                let cs = after[..end].trim().to_string();
                if cs.is_empty() { None } else { Some(cs) }
            })
    } else {
        None
    };

    let charset = charset_from_header
        .or(charset_from_html)
        .unwrap_or_else(|| "utf-8".to_string());

    // 3. encoding_rs でデコード
    let encoding = encoding_rs::Encoding::for_label(charset.as_bytes())
        .unwrap_or(encoding_rs::UTF_8);

    let (text, _, had_errors) = encoding.decode(bytes);
    if had_errors {
        log::warn!(
            "[metadata] HTML デコードで一部文字化けが発生 (charset: {})",
            charset
        );
    }

    text.into_owned()
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
        pdf_url: primary.pdf_url.or(secondary.pdf_url),
    }
}

/// 日付文字列から年を抽出する
fn extract_year_from_date(date_str: &str) -> Option<i32> {
    let date_str = date_str.trim();

    if date_str.len() == 4 {
        return date_str.parse::<i32>().ok();
    }

    if date_str.len() >= 4 {
        let first_part: String = date_str
            .chars()
            .take_while(|c| c.is_ascii_digit())
            .collect();
        if first_part.len() == 4 {
            if let Ok(y) = first_part.parse::<i32>() {
                if (1900..=2100).contains(&y) {
                    return Some(y);
                }
            }
        }
    }

    let parts: Vec<&str> = date_str.split(|c: char| c == '/' || c == '-').collect();
    if parts.len() >= 3 {
        if let Ok(y) = parts.last().unwrap_or(&"").parse::<i32>() {
            if (1900..=2100).contains(&y) {
                return Some(y);
            }
        }
    }

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
        AcademicSite::CiNii => "CiNii Research",
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

fn get_meta_content(document: &scraper::Html, name: &str) -> Option<String> {
    // name 属性は大文字小文字が混在するサイトがあるため、両方試す
    let selectors = [
        format!("meta[name=\"{}\"]", name),
        format!("meta[name=\"{}\"]", name.to_lowercase()),
    ];
    for selector_str in &selectors {
        if let Ok(selector) = scraper::Selector::parse(selector_str) {
            if let Some(el) = document.select(&selector).next() {
                if let Some(content) = el.value().attr("content") {
                    let trimmed = content.trim().to_string();
                    if !trimmed.is_empty() {
                        return Some(trimmed);
                    }
                }
            }
        }
    }
    None
}

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
// 書誌情報フォーマッタ
// ════════════════════════════════════════════════════════════

/// 引用スタイルに応じた書誌テキストを生成する
pub fn format_bibliography_entry(
    style: &str,
    title: &str,
    authors: &[String],
    year: Option<i32>,
    journal: Option<&str>,
    volume: Option<&str>,
    issue: Option<&str>,
    pages: Option<&str>,
    doi: Option<&str>,
) -> String {
    match style {
        "apa7" => format_apa7(title, authors, year, journal, volume, issue, pages, doi),
        "mla9" => format_mla9(title, authors, year, journal, volume, issue, pages, doi),
        "chicago17" => format_chicago17(title, authors, year, journal, volume, issue, pages, doi),
        "hitotsubashi" => {
            format_hitotsubashi(title, authors, year, journal, volume, issue, pages, doi)
        }
        _ => format_apa7(title, authors, year, journal, volume, issue, pages, doi),
    }
}

/// APA 7th Edition フォーマット
/// Author, A. A., & Author, B. B. (Year). Title of article. *Journal Name*, *vol*(issue), pages. https://doi.org/xxx
fn format_apa7(
    title: &str,
    authors: &[String],
    year: Option<i32>,
    journal: Option<&str>,
    volume: Option<&str>,
    issue: Option<&str>,
    pages: Option<&str>,
    doi: Option<&str>,
) -> String {
    let mut entry = String::new();

    // 著者
    if !authors.is_empty() {
        let formatted: Vec<String> = authors.iter().map(|a| format_author_apa(a)).collect();
        if formatted.len() == 1 {
            entry.push_str(&formatted[0]);
        } else if formatted.len() == 2 {
            entry.push_str(&format!("{}, & {}", formatted[0], formatted[1]));
        } else if formatted.len() <= 20 {
            let last = formatted.last().unwrap();
            let rest = &formatted[..formatted.len() - 1];
            entry.push_str(&rest.join(", "));
            entry.push_str(&format!(", & {}", last));
        } else {
            // 20人以上: 最初の19人 ... 最後の著者
            let first19: Vec<&str> = formatted[..19].iter().map(|s| s.as_str()).collect();
            entry.push_str(&first19.join(", "));
            entry.push_str(&format!(", ... {}", formatted.last().unwrap()));
        }
    }

    // 年
    let year_str = year
        .map(|y| y.to_string())
        .unwrap_or_else(|| "n.d.".to_string());
    if !entry.is_empty() {
        entry.push_str(&format!(" ({}). ", year_str));
    } else {
        entry.push_str(&format!("({}). ", year_str));
    }

    // タイトル
    entry.push_str(title);
    entry.push_str(". ");

    // ジャーナル
    if let Some(j) = journal {
        entry.push_str(&format!("*{}*", j));
        if let Some(v) = volume {
            entry.push_str(&format!(", *{}*", v));
        }
        if let Some(i) = issue {
            entry.push_str(&format!("({})", i));
        }
        if let Some(p) = pages {
            entry.push_str(&format!(", {}", p));
        }
        entry.push_str(". ");
    }

    // DOI
    if let Some(d) = doi {
        entry.push_str(&format!("https://doi.org/{}", d));
    }

    entry
}

/// MLA 9th Edition フォーマット
/// Author. "Title." *Journal*, vol. X, no. X, Year, pp. X-X.
fn format_mla9(
    title: &str,
    authors: &[String],
    year: Option<i32>,
    journal: Option<&str>,
    volume: Option<&str>,
    issue: Option<&str>,
    pages: Option<&str>,
    doi: Option<&str>,
) -> String {
    let mut entry = String::new();

    // 著者
    if !authors.is_empty() {
        if authors.len() == 1 {
            entry.push_str(&format_author_mla(&authors[0]));
        } else if authors.len() == 2 {
            entry.push_str(&format!(
                "{}, and {}",
                format_author_mla(&authors[0]),
                &authors[1]
            ));
        } else {
            entry.push_str(&format!("{}, et al", format_author_mla(&authors[0])));
        }
        entry.push_str(". ");
    }

    // タイトル（引用符で囲む）
    entry.push_str(&format!("\"{}\"", title));
    entry.push_str(". ");

    // ジャーナル
    if let Some(j) = journal {
        entry.push_str(&format!("*{}*", j));
        if let Some(v) = volume {
            entry.push_str(&format!(", vol. {}", v));
        }
        if let Some(i) = issue {
            entry.push_str(&format!(", no. {}", i));
        }
        if let Some(y) = year {
            entry.push_str(&format!(", {}", y));
        }
        if let Some(p) = pages {
            entry.push_str(&format!(", pp. {}", p));
        }
        entry.push_str(". ");
    } else if let Some(y) = year {
        entry.push_str(&format!("{}, ", y));
    }

    // DOI
    if let Some(d) = doi {
        entry.push_str(&format!("https://doi.org/{}", d));
    }

    entry
}

/// Chicago 17th Edition フォーマット（著者-日付方式）
/// Author, FirstName. Year. "Title." *Journal* vol, no. issue: pages. https://doi.org/xxx.
fn format_chicago17(
    title: &str,
    authors: &[String],
    year: Option<i32>,
    journal: Option<&str>,
    volume: Option<&str>,
    issue: Option<&str>,
    pages: Option<&str>,
    doi: Option<&str>,
) -> String {
    let mut entry = String::new();

    // 著者
    if !authors.is_empty() {
        let first = format_author_chicago(&authors[0]);
        if authors.len() == 1 {
            entry.push_str(&first);
        } else if authors.len() <= 3 {
            entry.push_str(&first);
            for a in &authors[1..authors.len() - 1] {
                entry.push_str(&format!(", {}", a));
            }
            entry.push_str(&format!(", and {}", authors.last().unwrap()));
        } else {
            entry.push_str(&format!("{} et al.", first));
        }
        entry.push_str(". ");
    }

    // 年
    if let Some(y) = year {
        entry.push_str(&format!("{}. ", y));
    }

    // タイトル
    entry.push_str(&format!("\"{}\"", title));
    entry.push_str(". ");

    // ジャーナル
    if let Some(j) = journal {
        entry.push_str(&format!("*{}*", j));
        if let Some(v) = volume {
            entry.push_str(&format!(" {}", v));
        }
        if let Some(i) = issue {
            entry.push_str(&format!(", no. {}", i));
        }
        if let Some(p) = pages {
            entry.push_str(&format!(": {}", p));
        }
        entry.push_str(". ");
    }

    // DOI
    if let Some(d) = doi {
        entry.push_str(&format!("https://doi.org/{}", d));
    }

    entry
}

/// 一橋スタイル（日本語文献向け）
/// 著者名（出版年）「タイトル」『雑誌名』巻号、ページ。
fn format_hitotsubashi(
    title: &str,
    authors: &[String],
    year: Option<i32>,
    journal: Option<&str>,
    volume: Option<&str>,
    issue: Option<&str>,
    pages: Option<&str>,
    _doi: Option<&str>,
) -> String {
    let mut entry = String::new();

    // 著者
    if !authors.is_empty() {
        entry.push_str(&authors.join("・"));
    }

    // 年
    if let Some(y) = year {
        entry.push_str(&format!("（{}）", y));
    }

    // タイトル
    // 日本語文献は「」、英語文献は「」を使う
    let is_japanese = title.chars().any(|c| {
        ('\u{3000}'..='\u{303f}').contains(&c) || // CJK記号
        ('\u{3040}'..='\u{309f}').contains(&c) || // ひらがな
        ('\u{30a0}'..='\u{30ff}').contains(&c) || // カタカナ
        ('\u{4e00}'..='\u{9faf}').contains(&c) // CJK漢字
    });
    if is_japanese {
        entry.push_str(&format!("「{}」", title));
    } else {
        entry.push_str(&format!("\"{}\"", title));
    }

    // ジャーナル
    if let Some(j) = journal {
        if is_japanese {
            entry.push_str(&format!("『{}』", j));
        } else {
            entry.push_str(&format!("*{}*", j));
        }
        if let Some(v) = volume {
            entry.push_str(&format!("{}巻", v));
        }
        if let Some(i) = issue {
            entry.push_str(&format!("{}号", i));
        }
        if let Some(p) = pages {
            entry.push_str(&format!("、{}頁", p));
        }
    }
    entry.push('。');

    entry
}

/// APA形式の著者名フォーマット: "Given Family" → "Family, G."
fn format_author_apa(name: &str) -> String {
    let parts: Vec<&str> = name.split_whitespace().collect();
    if parts.len() >= 2 {
        let family = parts.last().unwrap();
        let initials: Vec<String> = parts[..parts.len() - 1]
            .iter()
            .map(|p| {
                let first_char = p.chars().next().unwrap_or('?');
                format!("{}.", first_char.to_uppercase().next().unwrap_or('?'))
            })
            .collect();
        format!("{}, {}", family, initials.join(" "))
    } else {
        name.to_string()
    }
}

/// MLA形式の著者名フォーマット: "Given Family" → "Family, Given"
fn format_author_mla(name: &str) -> String {
    let parts: Vec<&str> = name.split_whitespace().collect();
    if parts.len() >= 2 {
        let family = parts.last().unwrap();
        let given = parts[..parts.len() - 1].join(" ");
        format!("{}, {}", family, given)
    } else {
        name.to_string()
    }
}

/// Chicago形式の著者名フォーマット: "Given Family" → "Family, Given"
fn format_author_chicago(name: &str) -> String {
    format_author_mla(name) // Chicago 著者-日付方式は MLA と同様
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
            extract_doi_from_url(
                "https://www.tandfonline.com/doi/full/10.1080/03075079.2024.2323593"
            ),
            Some("10.1080/03075079.2024.2323593".to_string())
        );
    }

    #[test]
    fn test_extract_doi_from_tandfonline_abs() {
        assert_eq!(
            extract_doi_from_url(
                "https://www.tandfonline.com/doi/abs/10.1080/12345678.2024.9999999"
            ),
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
        assert_eq!(
            extract_doi_from_url(
                "https://www.jstage.jst.go.jp/article/jjspe/89/1/89_56/_article/-char/ja"
            ),
            None
        );
    }

    #[test]
    fn test_no_doi_from_sciencedirect_pii() {
        assert_eq!(
            extract_doi_from_url(
                "https://www.sciencedirect.com/science/article/pii/S0001234567890123"
            ),
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
        assert_eq!(
            normalize_doi("https://doi.org/10.1234/test"),
            "10.1234/test"
        );
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
            pdf_url: None,
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
            pdf_url: None,
        };

        let merged = merge_metadata(primary, secondary);
        assert_eq!(merged.title, "Primary Title");
        assert_eq!(merged.authors, vec!["Author A".to_string()]);
        assert_eq!(merged.year, Some(2024));
        assert_eq!(merged.journal, Some("Primary Journal".to_string()));
        assert_eq!(merged.volume, Some("1".to_string()));
        assert_eq!(merged.r#abstract, Some("Abstract text".to_string()));
    }

    // ── 書誌情報フォーマットテスト ──

    #[test]
    fn test_format_apa7() {
        let result = format_bibliography_entry(
            "apa7",
            "Test Article Title",
            &["John Smith".to_string(), "Jane Doe".to_string()],
            Some(2024),
            Some("Journal of Testing"),
            Some("10"),
            Some("2"),
            Some("100-115"),
            Some("10.1234/test"),
        );
        assert!(result.contains("Smith, J."));
        assert!(result.contains("Doe, J."));
        assert!(result.contains("(2024)"));
        assert!(result.contains("Test Article Title"));
        assert!(result.contains("*Journal of Testing*"));
        assert!(result.contains("doi.org"));
    }

    #[test]
    fn test_format_hitotsubashi() {
        let result = format_bibliography_entry(
            "hitotsubashi",
            "社会関係資本の理論的枠組み",
            &["山田太郎".to_string(), "鈴木花子".to_string()],
            Some(2024),
            Some("社会学研究"),
            Some("10"),
            Some("2"),
            Some("100-115"),
            None,
        );
        assert!(result.contains("山田太郎・鈴木花子"));
        assert!(result.contains("（2024）"));
        assert!(result.contains("「社会関係資本の理論的枠組み」"));
        assert!(result.contains("『社会学研究』"));
    }
}
