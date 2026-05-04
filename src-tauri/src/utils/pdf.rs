// src-tauri/src/utils/pdf.rs
// Stellar — PDF処理ユーティリティ
// PDFファイルのパス管理・バリデーション等を行う
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
}
