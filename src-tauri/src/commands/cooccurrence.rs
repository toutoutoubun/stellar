use crate::db::get_pool;
use lindera_core::mode::Mode;
use lindera_dictionary::{DictionaryConfig, DictionaryKind};
use lindera_tokenizer::tokenizer::{Tokenizer, TokenizerConfig};
use serde::Serialize;
use sqlx::Row;
use std::collections::{HashMap, HashSet};
use std::sync::{Mutex, OnceLock};
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CooccurrencePair {
    pub word_a: String,
    pub word_b: String,
    pub count: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum DetectedLanguage {
    Japanese,
    English,
    Other,
}

#[tauri::command]
pub async fn analyze_cooccurrence(
    app: AppHandle,
    segment_id: String,
    window_size: Option<usize>,
    top_n: Option<usize>,
) -> Result<Vec<CooccurrencePair>, String> {
    let pool = get_pool(&app)?;
    let row = sqlx::query("SELECT segment_text FROM source_segment_codes WHERE id = ?")
        .bind(&segment_id)
        .fetch_optional(pool.as_ref())
        .await
        .map_err(|e| format!("セグメント取得に失敗: {}", e))?
        .ok_or_else(|| format!("セグメントが見つかりません: {}", segment_id))?;

    let text: String = row
        .try_get("segment_text")
        .map_err(|e| format!("セグメント本文の読み取りに失敗: {}", e))?;
    let tokens = tokenize(&text)?;

    let window = window_size.unwrap_or(5).clamp(2, 50);
    let limit = top_n.unwrap_or(10).clamp(1, 100);

    Ok(count_cooccurrences(&tokens, window, limit))
}

fn tokenize(text: &str) -> Result<Vec<String>, String> {
    match detect_language(text) {
        DetectedLanguage::Japanese => tokenize_japanese(text),
        DetectedLanguage::English => Ok(tokenize_ascii_words(text, &english_stopwords())),
        DetectedLanguage::Other => Ok(tokenize_ascii_words(text, &HashSet::new())),
    }
}

fn detect_language(text: &str) -> DetectedLanguage {
    if text.chars().any(is_japanese_char) {
        DetectedLanguage::Japanese
    } else if text.chars().any(|ch| ch.is_ascii_alphabetic()) {
        DetectedLanguage::English
    } else {
        DetectedLanguage::Other
    }
}

fn tokenize_japanese(text: &str) -> Result<Vec<String>, String> {
    let tokenizer = japanese_tokenizer()?;
    let tokenizer = tokenizer
        .lock()
        .map_err(|_| "linderaトークナイザのロックに失敗".to_string())?;
    let stopwords = japanese_stopwords();

    tokenizer
        .tokenize(text)
        .map_err(|e| format!("形態素解析に失敗: {}", e))
        .map(|tokens| {
            tokens
                .into_iter()
                .filter_map(|token| normalize_token(token.text.as_ref()))
                .filter(|token| !stopwords.contains(token.as_str()))
                .collect()
        })
}

fn japanese_tokenizer() -> Result<&'static Mutex<Tokenizer>, String> {
    static TOKENIZER: OnceLock<Result<Mutex<Tokenizer>, String>> = OnceLock::new();

    let result = TOKENIZER.get_or_init(|| {
        create_japanese_tokenizer()
            .map(Mutex::new)
            .map_err(|e| format!("lindera初期化に失敗: {}", e))
    });

    match result {
        Ok(tokenizer) => Ok(tokenizer),
        Err(message) => Err(message.clone()),
    }
}

fn create_japanese_tokenizer() -> Result<Tokenizer, String> {
    let dictionary = DictionaryConfig {
        kind: Some(DictionaryKind::IPADIC),
        path: None,
    };
    let config = TokenizerConfig {
        dictionary,
        user_dictionary: None,
        mode: Mode::Normal,
    };
    Tokenizer::from_config(config).map_err(|e| e.to_string())
}

fn tokenize_ascii_words(text: &str, stopwords: &HashSet<&'static str>) -> Vec<String> {
    text.split(|ch: char| !ch.is_alphanumeric() && ch != '\'')
        .filter_map(normalize_token)
        .filter(|token| !stopwords.contains(token.as_str()))
        .collect()
}

fn normalize_token(token: &str) -> Option<String> {
    let normalized = token
        .trim_matches(|ch: char| ch == '\'' || ch.is_whitespace() || ch.is_ascii_punctuation())
        .to_lowercase();

    if normalized.chars().count() < 2 {
        return None;
    }
    if normalized.chars().all(|ch| ch.is_numeric()) {
        return None;
    }
    Some(normalized)
}

fn count_cooccurrences(
    tokens: &[String],
    window_size: usize,
    top_n: usize,
) -> Vec<CooccurrencePair> {
    if tokens.len() < 2 {
        return Vec::new();
    }

    let mut counts: HashMap<(String, String), usize> = HashMap::new();

    for start in 0..tokens.len() {
        let end = (start + window_size).min(tokens.len());
        for i in start..end {
            for j in (i + 1)..end {
                if tokens[i] == tokens[j] {
                    continue;
                }
                let (word_a, word_b) = ordered_pair(&tokens[i], &tokens[j]);
                *counts.entry((word_a, word_b)).or_insert(0) += 1;
            }
        }
    }

    let mut pairs: Vec<_> = counts
        .into_iter()
        .map(|((word_a, word_b), count)| CooccurrencePair {
            word_a,
            word_b,
            count,
        })
        .collect();

    pairs.sort_by(|a, b| {
        b.count
            .cmp(&a.count)
            .then_with(|| a.word_a.cmp(&b.word_a))
            .then_with(|| a.word_b.cmp(&b.word_b))
    });
    pairs.truncate(top_n);
    pairs
}

fn ordered_pair(a: &str, b: &str) -> (String, String) {
    if a <= b {
        (a.to_string(), b.to_string())
    } else {
        (b.to_string(), a.to_string())
    }
}

fn is_japanese_char(ch: char) -> bool {
    matches!(
        ch as u32,
        0x3040..=0x30ff | 0x3400..=0x4dbf | 0x4e00..=0x9fff | 0xf900..=0xfaff
    )
}

fn japanese_stopwords() -> HashSet<&'static str> {
    [
        "は",
        "が",
        "を",
        "に",
        "の",
        "で",
        "と",
        "も",
        "から",
        "まで",
        "より",
        "など",
        "こと",
        "ため",
        "よる",
        "おける",
        "れる",
        "られる",
        "する",
        "した",
        "して",
        "これ",
        "その",
        "この",
        "あの",
        "そのような",
    ]
    .into_iter()
    .collect()
}

fn english_stopwords() -> HashSet<&'static str> {
    [
        "the", "a", "an", "is", "are", "was", "were", "of", "in", "to", "and", "or", "but", "for",
        "with", "by", "on", "at",
    ]
    .into_iter()
    .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn counts_top_pairs_with_sliding_window() {
        let tokens = vec![
            "foreign".to_string(),
            "ministry".to_string(),
            "policy".to_string(),
            "foreign".to_string(),
            "ministry".to_string(),
        ];

        let pairs = count_cooccurrences(&tokens, 3, 2);

        assert_eq!(pairs[0].word_a, "foreign");
        assert_eq!(pairs[0].word_b, "ministry");
        assert_eq!(pairs[0].count, 4);
    }

    #[test]
    fn english_tokenizer_removes_stopwords() {
        let tokens = tokenize_ascii_words(
            "The foreign ministry is in South Africa.",
            &english_stopwords(),
        );

        assert_eq!(tokens, vec!["foreign", "ministry", "south", "africa"]);
    }
}
