// src-tauri/src/main.rs
// Stellar — メインエントリーポイント
// Windows リリースビルド時にコンソールウィンドウを非表示にする
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    stellar_lib::run();
}
