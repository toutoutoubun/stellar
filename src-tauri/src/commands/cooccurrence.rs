use crate::db::get_pool;
use crate::tokenizer::registry::get_tokenizer_for_locale_or_text;
use serde::Serialize;
use sqlx::Row;
use std::collections::HashMap;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CooccurrencePair {
    pub word_a: String,
    pub word_b: String,
    pub count: usize,
}

#[tauri::command]
pub async fn analyze_cooccurrence(
    app: AppHandle,
    segment_id: String,
    locale: Option<String>,
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
    let tokenizer = get_tokenizer_for_locale_or_text(locale.as_deref(), &text);
    let tokens = tokenizer.tokenize(&text)?;

    let window = window_size.unwrap_or(5).clamp(2, 50);
    let limit = top_n.unwrap_or(10).clamp(1, 100);

    Ok(count_cooccurrences(&tokens, window, limit))
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
}
