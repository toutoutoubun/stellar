use super::ascii::normalize_token;
use super::Tokenizer;
use lindera_core::mode::Mode;
use lindera_dictionary::{DictionaryConfig, DictionaryKind};
use lindera_tokenizer::tokenizer::{Tokenizer as LinderaTokenizer, TokenizerConfig};
use std::collections::HashSet;
use std::sync::{Mutex, OnceLock};

pub struct JapaneseTokenizer;

impl JapaneseTokenizer {
    pub fn new() -> Self {
        Self
    }
}

impl Tokenizer for JapaneseTokenizer {
    fn tokenize(&self, text: &str) -> Result<Vec<String>, String> {
        tokenize_japanese(text)
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

fn japanese_tokenizer() -> Result<&'static Mutex<LinderaTokenizer>, String> {
    static TOKENIZER: OnceLock<Result<Mutex<LinderaTokenizer>, String>> = OnceLock::new();

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

fn create_japanese_tokenizer() -> Result<LinderaTokenizer, String> {
    let dictionary = DictionaryConfig {
        kind: Some(DictionaryKind::IPADIC),
        path: None,
    };
    let config = TokenizerConfig {
        dictionary,
        user_dictionary: None,
        mode: Mode::Normal,
    };
    LinderaTokenizer::from_config(config).map_err(|e| e.to_string())
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
