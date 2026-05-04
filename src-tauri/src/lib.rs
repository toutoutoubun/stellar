// src-tauri/src/lib.rs
// Stellar — アプリケーションライブラリ
// プラグイン登録・DB初期化・コマンド登録を行うエントリーポイント

mod commands;
mod db;
mod utils;

use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

/// マイグレーション定義を返す
/// SQLite の FTS5 仮想テーブル（trigram tokenizer）・トリガー・インデックスを含む初期スキーマ
fn get_migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "初期スキーマ — papers / notes / highlights / links / FTS5(trigram)",
        sql: include_str!("db/migrations/V001__initial.sql"),
        kind: MigrationKind::Up,
    }]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // ── プラグイン登録 ──
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:stellar.db", get_migrations())
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        // ── セットアップ ──
        .setup(|app| {
            // メインウィンドウの取得とデバッグ用 DevTools 表示
            let window = app.get_webview_window("main").unwrap();
            #[cfg(debug_assertions)]
            {
                window.open_devtools();
            }
            // ウィンドウを表示（透過設定時のちらつき防止）
            window.show().unwrap();

            log::info!("Stellar が起動しました");
            Ok(())
        })
        // ── Tauri コマンド登録 ──
        .invoke_handler(tauri::generate_handler![
            // 論文 CRUD（ページネーション・フィルタ・バックリンク付き詳細）
            commands::papers::get_papers,
            commands::papers::get_paper,
            commands::papers::create_paper,
            commands::papers::update_paper,
            commands::papers::delete_paper,
            commands::papers::attach_pdf,
            commands::papers::get_all_tags,
            // ノート CRUD（ページネーション・NoteDetail・ハイライトからの自動生成）
            commands::notes::get_notes,
            commands::notes::get_note,
            commands::notes::create_note,
            commands::notes::update_note,
            commands::notes::delete_note,
            commands::notes::create_note_from_highlights,
            // ハイライト CRUD（FTS5 インデックス連動）
            commands::highlights::get_highlights,
            commands::highlights::create_highlight,
            commands::highlights::update_highlight_comment,
            commands::highlights::delete_highlight,
            // リンク CRUD（重複チェック・バックリンク・グラフデータ）
            commands::links::create_link,
            commands::links::get_backlinks,
            commands::links::delete_link,
            commands::links::get_graph_data,
            // 全文検索（FTS5 trigram・カテゴリ別・オートコンプリート）
            commands::search::full_text_search,
            commands::search::get_link_suggestions,
        ])
        .run(tauri::generate_context!())
        .expect("Stellar の起動に失敗しました");
}
