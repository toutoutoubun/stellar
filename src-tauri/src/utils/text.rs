use unicode_normalization::UnicodeNormalization;

pub fn normalize_nfc(text: &str) -> String {
    text.nfc().collect()
}

pub fn normalize_nfc_trimmed(text: &str) -> String {
    text.trim().nfc().collect()
}

pub fn normalize_opt_nfc(value: Option<String>) -> Option<String> {
    value.map(|text| normalize_nfc(&text))
}

pub fn normalize_vec_nfc(values: Vec<String>) -> Vec<String> {
    values
        .into_iter()
        .map(|value| normalize_nfc(&value))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_decomposed_circumflex_to_nfc() {
        assert_eq!(normalize_nfc("e\u{0302}"), "ê");
    }
}
