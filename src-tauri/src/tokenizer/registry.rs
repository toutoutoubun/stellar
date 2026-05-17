use super::ascii::{english_stopwords, AsciiTokenizer};
use super::japanese::JapaneseTokenizer;
use super::Tokenizer;
use std::collections::HashSet;
use std::sync::Arc;

pub fn get_tokenizer(locale: &str) -> Arc<dyn Tokenizer> {
    match normalize_locale(locale).as_str() {
        "ja" => Arc::new(JapaneseTokenizer::new()),
        "en" | "af" => Arc::new(AsciiTokenizer::with_stopwords(english_stopwords())),
        "zu" | "xh" | "nso" | "tn" | "st" => Arc::new(AsciiTokenizer::with_stopwords(
            southern_african_stopwords(locale),
        )),
        _ => Arc::new(AsciiTokenizer::new()),
    }
}

pub fn get_tokenizer_for_text(text: &str) -> Arc<dyn Tokenizer> {
    if text.chars().any(is_japanese_char) {
        get_tokenizer("ja")
    } else if text.chars().any(|ch| ch.is_ascii_alphabetic()) {
        get_tokenizer("en")
    } else {
        get_tokenizer("")
    }
}

pub fn get_tokenizer_for_locale_or_text(locale: Option<&str>, text: &str) -> Arc<dyn Tokenizer> {
    if text.chars().any(is_japanese_char) {
        return get_tokenizer("ja");
    }

    match locale.map(str::trim).filter(|locale| !locale.is_empty()) {
        Some(locale) if normalize_locale(locale) != "ja" => get_tokenizer(locale),
        _ => get_tokenizer_for_text(text),
    }
}

fn normalize_locale(locale: &str) -> String {
    locale
        .split(['-', '_'])
        .next()
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase()
}

fn southern_african_stopwords(locale: &str) -> HashSet<String> {
    match normalize_locale(locale).as_str() {
        "zu" => zulu_stopwords(),
        "xh" => xhosa_stopwords(),
        "nso" => sepedi_stopwords(),
        "tn" => setswana_stopwords(),
        "st" => sesotho_stopwords(),
        _ => HashSet::new(),
    }
}

fn zulu_stopwords() -> HashSet<String> {
    HashSet::new()
}

fn xhosa_stopwords() -> HashSet<String> {
    HashSet::new()
}

fn sepedi_stopwords() -> HashSet<String> {
    HashSet::new()
}

fn setswana_stopwords() -> HashSet<String> {
    HashSet::new()
}

fn sesotho_stopwords() -> HashSet<String> {
    HashSet::new()
}

fn is_japanese_char(ch: char) -> bool {
    matches!(
        ch as u32,
        0x3040..=0x30ff | 0x3400..=0x4dbf | 0x4e00..=0x9fff | 0xf900..=0xfaff
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn zulu_locale_uses_ascii_tokenizer_with_stub_stopwords() {
        let tokenizer = get_tokenizer("zu");
        let tokens = tokenizer
            .tokenize("IsiZulu words and isiXhosa words")
            .unwrap();

        assert_eq!(tokens, vec!["isizulu", "words", "and", "isixhosa", "words"]);
    }

    #[test]
    fn english_locale_removes_english_stopwords() {
        let tokenizer = get_tokenizer("en-US");
        let tokens = tokenizer.tokenize("The ministry is in Pretoria").unwrap();

        assert_eq!(tokens, vec!["ministry", "pretoria"]);
    }

    #[test]
    fn japanese_ui_locale_does_not_force_japanese_tokenizer_for_ascii_text() {
        let tokenizer = get_tokenizer_for_locale_or_text(Some("ja"), "The ministry is in Tokyo");
        let tokens = tokenizer.tokenize("The ministry is in Tokyo").unwrap();

        assert_eq!(tokens, vec!["ministry", "tokyo"]);
    }
}
