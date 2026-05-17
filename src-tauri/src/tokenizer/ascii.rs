use super::Tokenizer;
use crate::utils::text::normalize_nfc;
use std::collections::HashSet;

pub struct AsciiTokenizer {
    pub stopwords: HashSet<String>,
}

impl AsciiTokenizer {
    pub fn new() -> Self {
        Self {
            stopwords: HashSet::new(),
        }
    }

    pub fn with_stopwords(stopwords: HashSet<String>) -> Self {
        Self { stopwords }
    }
}

impl Tokenizer for AsciiTokenizer {
    fn tokenize(&self, text: &str) -> Result<Vec<String>, String> {
        Ok(tokenize_ascii_words(text, &self.stopwords))
    }
}

pub fn tokenize_ascii_words(text: &str, stopwords: &HashSet<String>) -> Vec<String> {
    text.split(|ch: char| !ch.is_alphanumeric() && ch != '\'')
        .filter_map(normalize_token)
        .filter(|token| !stopwords.contains(token.as_str()))
        .collect()
}

pub(crate) fn normalize_token(token: &str) -> Option<String> {
    let normalized = token
        .trim_matches(|ch: char| ch == '\'' || ch.is_whitespace() || ch.is_ascii_punctuation())
        .to_lowercase();
    let normalized = normalize_nfc(&normalized);

    if normalized.chars().count() < 2 {
        return None;
    }
    if normalized.chars().all(|ch| ch.is_numeric()) {
        return None;
    }
    Some(normalized)
}

pub fn english_stopwords() -> HashSet<String> {
    [
        "the", "a", "an", "is", "are", "was", "were", "of", "in", "to", "and", "or", "but", "for",
        "with", "by", "on", "at",
    ]
    .into_iter()
    .map(String::from)
    .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn english_tokenizer_removes_stopwords() {
        let tokens = tokenize_ascii_words(
            "The foreign ministry is in South Africa.",
            &english_stopwords(),
        );

        assert_eq!(tokens, vec!["foreign", "ministry", "south", "africa"]);
    }

    #[test]
    fn ascii_tokenizer_accepts_empty_stopwords() {
        let tokenizer = AsciiTokenizer::new();
        let tokens = tokenizer.tokenize("IsiZulu and isiXhosa terms").unwrap();

        assert_eq!(tokens, vec!["isizulu", "and", "isixhosa", "terms"]);
    }

    #[test]
    fn tokenizer_normalizes_decomposed_unicode_to_nfc() {
        let tokenizer = AsciiTokenizer::new();
        let tokens = tokenizer.tokenize("e\u{0302} ê").unwrap();

        assert_eq!(tokens, vec!["ê", "ê"]);
    }
}
