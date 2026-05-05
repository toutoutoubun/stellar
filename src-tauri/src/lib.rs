// src-tauri/src/lib.rs
// Stellar — アプリケーションライブラリ
// プラグイン登録・DB初期化・コマンド登録を行うエントリーポイント
// DB は sqlx::SqlitePool を自前管理し、tauri-plugin-sql はフロントエンド用に残す

mod commands;
mod db;
mod utils;

use db::AppDb;
use std::sync::Arc;
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

/// tauri-plugin-sql 用マイグレーション定義（フロントエンド JS からの DB アクセス用）
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
        .plugin(tauri_plugin_process::init())
        // ── セットアップ ──
        .setup(|app| {
            let handle = app.handle().clone();

            // sqlx::SqlitePool を非同期で初期化し、Managed State に登録
            tauri::async_runtime::block_on(async move {
                match db::init_db(&handle).await {
                    Ok(pool) => {
                        handle.manage(AppDb(Arc::new(pool)));
                        log::info!("sqlx SqlitePool を初期化しました");
                    }
                    Err(e) => {
                        log::error!("DB 初期化に失敗: {}", e);
                        // フォールバック: plugin-sql のみで動作（コマンドは使用不可）
                    }
                }
            });

            // メインウィンドウの取得とデバッグ用 DevTools 表示
            let window = app.get_webview_window("main").unwrap();
            #[cfg(debug_assertions)]
            {
                window.open_devtools();
            }
            window.show().unwrap();

            log::info!("Stellar が起動しました");
            Ok(())
        })
        // ── Tauri コマンド登録 ──
        .invoke_handler(tauri::generate_handler![
            commands::papers::get_papers,
            commands::papers::get_paper,
            commands::papers::create_paper,
            commands::papers::update_paper,
            commands::papers::delete_paper,
            commands::papers::attach_pdf,
            commands::papers::get_all_tags,
            commands::notes::get_notes,
            commands::notes::get_note,
            commands::notes::create_note,
            commands::notes::update_note,
            commands::notes::delete_note,
            commands::notes::create_note_from_highlights,
            commands::highlights::get_highlights,
            commands::highlights::create_highlight,
            commands::highlights::update_highlight_comment,
            commands::highlights::delete_highlight,
            commands::links::create_link,
            commands::links::get_backlinks,
            commands::links::delete_link,
            commands::links::get_graph_data,
            commands::search::full_text_search,
            commands::search::get_link_suggestions,
            commands::metadata::fetch_metadata_by_doi,
            commands::metadata::fetch_metadata_from_url,
        ])
        .run(tauri::generate_context!())
        .expect("Stellar の起動に失敗しました");
}
