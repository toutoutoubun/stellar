// src-tauri/src/utils/pdf.rs
// Stellar — PDF処理ユーティリティ
// PDFファイルのパス管理・バリデーション・メタデータ抽出を行う
// 注: 実際のPDFレンダリングはフロントエンド側の react-pdf-highlighter が担当

use std::path::Path;

/// PDFファイルパスのバリデーション
/// 拡張子が .pdf であることを確認する
pub fn is_valid_pdf_path(path: &str) -> bool {
    let p = Path::new(path);
    p.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("pdf"))
        .unwrap_or(false)
}

/// PDFファイル名からタイトルの候補を生成する
/// ファイル名のアンダースコア・ハイフンをスペースに変換し、拡張子を除去する
pub fn extract_title_from_filename(path: &str) -> String {
    let p = Path::new(path);
    p.file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Untitled")
        .replace('_', " ")
        .replace('-', " ")
}

/// PDFから抽出されたメタデータ
#[derive(Debug, Clone, Default)]
pub struct PdfMetadata {
    pub title: Option<String>,
    pub authors: Vec<String>,
    pub subject: Option<String>,
    pub year: Option<i32>,
}

/// lopdf を使用してPDFの Document Info Dictionary からメタデータを抽出する
/// メタデータが取得できない場合やPDFが壊れている場合はデフォルト値を返す
pub fn extract_metadata_from_file(path: &str) -> PdfMetadata {
    let mut meta = PdfMetadata::default();

    let doc = match lopdf::Document::load(path) {
        Ok(d) => d,
        Err(e) => {
            log::warn!("PDF読み込みに失敗 ({}): {}", path, e);
            return meta;
        }
    };

    // トレイラーの Info 辞書からメタデータを取得
    // Info は直接 Dictionary として格納される場合と、Reference として格納される場合がある
    // ヘルパー: Info オブジェクトから辞書を抽出する
    fn resolve_info_dict<'a>(doc: &'a lopdf::Document) -> Option<&'a lopdf::Dictionary> {
        let info_val = doc.trailer.get(b"Info").ok()?;
        // 1) Reference 経由で辞書を取得
        if let Ok(r) = info_val.as_reference() {
            if let Ok(obj) = doc.get_object(r) {
                return obj.as_dict().ok();
            }
        }
        // 2) インライン辞書として直接取得
        info_val.as_dict().ok()
    }

    if let Some(dict) = resolve_info_dict(&doc) {
        // Title
        if let Ok(val) = dict.get(b"Title") {
            if let Some(s) = pdf_object_to_string(val) {
                let trimmed = s.trim().to_string();
                if !trimmed.is_empty() {
                    meta.title = Some(trimmed);
                }
            }
        }

        // Author
        if let Ok(val) = dict.get(b"Author") {
            if let Some(s) = pdf_object_to_string(val) {
                let trimmed = s.trim().to_string();
                if !trimmed.is_empty() {
                    // 著者名をセミコロン、カンマ、"and" で分割
                    meta.authors = trimmed
                        .split(|c| c == ';' || c == ',')
                        .flat_map(|part| part.split(" and "))
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty())
                        .collect();
                }
            }
        }

        // Subject → abstract の候補
        if let Ok(val) = dict.get(b"Subject") {
            if let Some(s) = pdf_object_to_string(val) {
                let trimmed = s.trim().to_string();
                if !trimmed.is_empty() {
                    meta.subject = Some(trimmed);
                }
            }
        }

        // CreationDate から年を抽出 (D:YYYYMMDDHHmmSS 形式)
        if let Ok(val) = dict.get(b"CreationDate") {
            if let Some(s) = pdf_object_to_string(val) {
                meta.year = extract_year_from_pdf_date(&s);
            }
        }

        // ModDate からも年を抽出（CreationDate がない場合のフォールバック）
        if meta.year.is_none() {
            if let Ok(val) = dict.get(b"ModDate") {
                if let Some(s) = pdf_object_to_string(val) {
                    meta.year = extract_year_from_pdf_date(&s);
                }
            }
        }
    }

    meta
}

/// PDF の日付文字列 (例: "D:20231015120000+09'00'") から年(i32)を抽出する
fn extract_year_from_pdf_date(date_str: &str) -> Option<i32> {
    let s = date_str.trim().strip_prefix("D:").unwrap_or(date_str.trim());
    if s.len() >= 4 {
        s[..4].parse::<i32>().ok()
    } else {
        None
    }
}

/// lopdf の Object から文字列を取得するヘルパー
/// String / Name 型に対応し、バイト列からUTF-8またはLatin-1にデコードする
fn pdf_object_to_string(obj: &lopdf::Object) -> Option<String> {
    match obj {
        lopdf::Object::String(bytes, _) => Some(decode_pdf_bytes(bytes)),
        lopdf::Object::Name(s) => Some(decode_pdf_bytes(s)),
        _ => None,
    }
}

/// PDF のバイト列をデコードする
/// UTF-16BE BOM が先頭にあれば UTF-16 としてデコードし、
/// そうでなければ UTF-8 を試み、失敗したら Latin-1 としてデコードする
fn decode_pdf_bytes(bytes: &[u8]) -> String {
    // UTF-16BE BOM check
    if bytes.len() >= 2 && bytes[0] == 0xFE && bytes[1] == 0xFF {
        let u16s: Vec<u16> = bytes[2..]
            .chunks_exact(2)
            .map(|c| u16::from_be_bytes([c[0], c[1]]))
            .collect();
        return String::from_utf16_lossy(&u16s);
    }
    // UTF-8 を試みる
    match std::str::from_utf8(bytes) {
        Ok(s) => s.to_string(),
        // Latin-1 フォールバック
        Err(_) => bytes.iter().map(|&b| b as char).collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_valid_pdf_path() {
        assert!(is_valid_pdf_path("/home/user/paper.pdf"));
        assert!(is_valid_pdf_path("C:\\Documents\\paper.PDF"));
        assert!(!is_valid_pdf_path("/home/user/paper.txt"));
        assert!(!is_valid_pdf_path("/home/user/paper"));
    }

    #[test]
    fn test_extract_title_from_filename() {
        assert_eq!(
            extract_title_from_filename("/home/user/my_research_paper.pdf"),
            "my research paper"
        );
        assert_eq!(
            extract_title_from_filename("deep-learning-survey.pdf"),
            "deep learning survey"
        );
    }

    #[test]
    fn test_extract_year_from_pdf_date() {
        assert_eq!(extract_year_from_pdf_date("D:20231015120000+09'00'"), Some(2023));
        assert_eq!(extract_year_from_pdf_date("D:2024"), Some(2024));
        assert_eq!(extract_year_from_pdf_date("2021"), Some(2021));
        assert_eq!(extract_year_from_pdf_date(""), None);
    }
}
