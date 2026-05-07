// src-tauri/src/lib.rs
// Stellar — アプリケーションライブラリ
// プラグイン登録・DB初期化・コマンド登録を行うエントリーポイント
// DB は sqlx::SqlitePool を自前管理し、tauri-plugin-sql はフロントエンド用に残す

mod commands;
mod db;
mod models;
mod utils;

use db::AppDb;
use std::sync::Arc;
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

/// tauri-plugin-sql 用マイグレーション定義（フロントエンド JS からの DB アクセス用）
fn get_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "初期スキーマ — papers / notes / highlights / links / FTS5(trigram)",
            sql: include_str!("db/migrations/V001__initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "質的研究モジュール — CAQDAS + 歴史・政治研究ツール",
            sql: include_str!("db/migrations/V002__qualitative.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "量的研究モジュール — Quantitative Lab",
            sql: include_str!("db/migrations/V003__quantitative.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "引用ネットワーク・読書ステータス・関連論文サジェスト",
            sql: include_str!("db/migrations/V004__citation_network.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "下書きモード — 長文執筆・章管理・引用挿入",
            sql: include_str!("db/migrations/V005__draft_mode.sql"),
            kind: MigrationKind::Up,
        },
    ]
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
            // 質的分析コマンド — プロジェクト管理
            commands::qualitative::create_project,
            commands::qualitative::get_projects,
            commands::qualitative::update_project,
            commands::qualitative::delete_project,
            // 質的分析コマンド — コーディング
            commands::qualitative::get_code_tree,
            commands::qualitative::create_code,
            commands::qualitative::update_code,
            commands::qualitative::delete_code,
            commands::qualitative::assign_code_to_highlight,
            commands::qualitative::remove_code_from_highlight,
            commands::qualitative::get_highlights_by_code,
            // 質的分析コマンド — マトリクス・ICR
            commands::qualitative::get_coding_matrix,
            commands::qualitative::calculate_icr,
            // 質的分析コマンド — 史料批判
            commands::qualitative::get_source_critique,
            commands::qualitative::upsert_source_critique,
            // 質的分析コマンド — タイムライン
            commands::qualitative::get_timeline_events,
            commands::qualitative::create_timeline_event,
            commands::qualitative::update_timeline_event,
            commands::qualitative::delete_timeline_event,
            commands::qualitative::get_timeline_lanes,
            // 質的分析コマンド — アクターマップ
            commands::qualitative::get_actor_map,
            commands::qualitative::create_actor,
            commands::qualitative::update_actor,
            commands::qualitative::delete_actor,
            commands::qualitative::create_actor_relation,
            commands::qualitative::delete_actor_relation,
            // 質的分析コマンド — プロセス・トレーシング
            commands::qualitative::get_pt_data,
            commands::qualitative::create_pt_hypothesis,
            commands::qualitative::add_pt_evidence,
            commands::qualitative::update_pt_evidence_result,
            commands::qualitative::get_pt_summary,
            // 質的分析コマンド — 比較ケース設計
            commands::qualitative::get_comparative_design,
            commands::qualitative::create_comparative_design,
            commands::qualitative::add_comparative_case,
            commands::qualitative::add_comparative_variable,
            commands::qualitative::upsert_comparative_cell,
            commands::qualitative::export_qca_csv,
            // 質的分析コマンド — フレーミング分析
            commands::qualitative::get_frames,
            commands::qualitative::create_frame,
            commands::qualitative::assign_frame_to_highlight,
            commands::qualitative::get_framing_matrix,
            // 質的分析コマンド — 追加 CRUD
            commands::qualitative::delete_pt_hypothesis,
            commands::qualitative::delete_pt_evidence,
            commands::qualitative::delete_comparative_case,
            commands::qualitative::delete_comparative_variable,
            commands::qualitative::delete_frame,
            commands::qualitative::remove_frame_from_highlight,
            commands::qualitative::get_highlight_frames,
            commands::qualitative::get_source_critiques_by_project,
            commands::qualitative::delete_source_critique,
            // 質的分析コマンド — レポート生成
            commands::qualitative::generate_analysis_report,
            // 量的分析コマンド — データセット CRUD
            commands::quantitative::create_dataset,
            commands::quantitative::get_datasets,
            commands::quantitative::get_dataset,
            commands::quantitative::update_dataset,
            commands::quantitative::delete_dataset,
            // 量的分析コマンド — 変数 CRUD
            commands::quantitative::create_variable,
            commands::quantitative::get_variables,
            commands::quantitative::update_variable,
            commands::quantitative::delete_variable,
            commands::quantitative::auto_detect_variable_types,
            // 量的分析コマンド — データ行 CRUD
            commands::quantitative::insert_data_rows,
            commands::quantitative::get_data_rows,
            commands::quantitative::delete_data_rows,
            // 量的分析コマンド — CSV インポート
            commands::quantitative::import_csv,
            // 量的分析コマンド — 分析 CRUD
            commands::quantitative::save_analysis,
            commands::quantitative::get_analyses,
            commands::quantitative::get_analysis,
            commands::quantitative::delete_analysis,
            // 量的分析コマンド — トークン頻度
            commands::quantitative::save_token_frequencies,
            commands::quantitative::get_token_frequencies,
            // 量的分析コマンド — QDA 統合
            commands::quantitative::create_dataset_from_codes,
            commands::quantitative::create_dataset_from_highlights,
            // 引用ネットワーク — 読書ステータス
            commands::citation_network::update_reading_status,
            commands::citation_network::get_reading_status_counts,
            // 引用ネットワーク — Semantic Scholar 連携
            commands::citation_network::fetch_citation_network,
            commands::citation_network::fetch_recommendations,
            commands::citation_network::get_recommendations,
            commands::citation_network::import_recommendation,
            commands::citation_network::get_citation_graph_data,
            // 引用ネットワーク — エクスポート
            commands::citation_network::export_bibtex,
            commands::citation_network::export_ris,
            // 下書きモード — Draft CRUD
            commands::draft::create_draft,
            commands::draft::get_drafts,
            // 下書きモード — 章管理
            commands::draft::get_draft_chapters,
            commands::draft::create_draft_chapter,
            commands::draft::update_draft_chapter,
            commands::draft::delete_draft_chapter,
            commands::draft::reorder_draft_chapters,
            // 下書きモード — 引用管理
            commands::draft::insert_citation,
            commands::draft::get_citations_for_note,
            commands::draft::delete_citation,
            commands::draft::generate_bibliography,
            // 下書きモード — ワードカウント同期
            commands::draft::sync_word_count,
        ])
        .run(tauri::generate_context!())
        .expect("Stellar の起動に失敗しました");
}
