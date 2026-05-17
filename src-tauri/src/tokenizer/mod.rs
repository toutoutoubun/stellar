pub mod ascii;
pub mod japanese;
pub mod registry;

pub trait Tokenizer: Send + Sync {
    /// Tokenize `text` into a list of normalized tokens.
    fn tokenize(&self, text: &str) -> Result<Vec<String>, String>;
}
