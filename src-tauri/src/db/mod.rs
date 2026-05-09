// src-tauri/src/db/mod.rs
// Stellar — データベースモジュール
// sqlx::SqlitePool を自前管理し、Tauri Managed State として共有する
//
// ╔══════════════════════════════════════════════════════════════════╗
// ║ 設計原則:                                                        ║
// ║ • init_db は必ず SqlitePool を返す（AppDb 未登録を構造的に防ぐ）  ║
// ║ • ファイル DB 接続: 最大 3 回リトライ。失敗時はエラーダイアログ   ║
// ║   を表示してからインメモリ DB にフォールバック（DB 機能は制限的）  ║
// ║ • マイグレーションエラー → 全てログに記録してスキップ            ║
// ╚══════════════════════════════════════════════════════════════════╝

pub mod models;

use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::{Row, SqlitePool};
use std::str::FromStr;
use std::sync::Arc;
use tauri::{AppHandle, Manager};

/// Tauri Managed State として登録する DB プール
pub struct AppDb(pub Arc<SqlitePool>);

/// AppHandle から SqlitePool への参照を取得するヘルパー
/// DB 未初期化時は Result::Err を返す（panic しない）
pub fn get_pool(app: &AppHandle) -> Result<Arc<SqlitePool>, String> {
    match app.try_state::<AppDb>() {
        Some(db) => Ok(db.0.clone()),
        None => Err(
            "データベースが初期化されていません。アプリを再起動してください。\
             （AppDb が Managed State に登録されていません）"
                .to_string(),
        ),
    }
}

/// アプリケーション初期化時に SqlitePool を作成する
/// **必ず SqlitePool を返す** — AppDb 未登録を構造的に防ぐ
///
/// ファイル DB 接続を最大3回リトライし、それでも失敗した場合は
/// ユーザーにダイアログで通知した上でインメモリ DB にフォールバックする。
/// インメモリ DB ではデータは永続化されないが、アプリの起動自体は保証する。
pub async fn init_db(app: &AppHandle) -> SqlitePool {
    // ── 1. ファイルベース DB への接続を試行（最大3回）──
    match try_file_db(app).await {
        Ok(pool) => {
            run_migrations_safe(&pool).await;
            pool
        }
        Err(err_detail) => {
            // ── 2. ファイル DB に接続できなかった ──
            // ユーザーにダイアログで明示的に警告する
            log::error!("ファイル DB への接続に失敗: {}", err_detail);

            let msg = format!(
                "データベースファイルを開けませんでした。\n\n\
                 原因: {}\n\n\
                 このまま起動するとデータは保存されません。\n\
                 以下を試してください:\n\
                 1. アプリを終了して再起動\n\
                 2. ~/Library/Application Support/com.stellar.app/ の\n\
                    stellar.db を削除して再起動（データはリセットされます）\n\
                 3. ディスク容量・権限を確認",
                err_detail
            );

            // Tauri ダイアログで通知（非同期だがブロックしない）
            if let Some(window) = app.get_webview_window("main") {
                use tauri::Emitter;
                let _ = window.emit("db-error", &msg);
            }
            log::error!("{}", msg);

            // インメモリ DB にフォールバック（アプリは起動するがデータは永続化されない）
            let pool = SqlitePoolOptions::new()
                .max_connections(1)
                .connect("sqlite::memory:")
                .await
                .expect("インメモリ SQLite への接続に失敗（致命的）");
            run_migrations_safe(&pool).await;
            pool
        }
    }
}

/// ファイルベース DB への接続を最大3回試行する
/// 成功時は Ok(pool)、全リトライ失敗時は Err(エラー詳細文字列) を返す
async fn try_file_db(app: &AppHandle) -> Result<SqlitePool, String> {
    let app_path = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("アプリ設定ディレクトリの取得に失敗: {}", e))?;

    std::fs::create_dir_all(&app_path)
        .map_err(|e| format!("ディレクトリ作成に失敗 ({}): {}", app_path.display(), e))?;

    let db_path = app_path.join("stellar.db");
    log::info!("DB パス: {}", db_path.display());
    let db_url = format!("sqlite:{}?mode=rwc", db_path.display());

    let max_attempts = 3;
    let mut last_err = String::new();

    for attempt in 1..=max_attempts {
        log::info!("DB 接続試行 {}/{}", attempt, max_attempts);
        match connect_pool(&db_url).await {
            Ok(pool) => {
                // 接続確認: 簡単なクエリを実行して本当に使えるか検証
                match sqlx::query("SELECT 1").execute(&pool).await {
                    Ok(_) => {
                        log::info!("DB 接続成功 (試行 {})", attempt);
                        return Ok(pool);
                    }
                    Err(e) => {
                        last_err = format!("接続後のヘルスチェック失敗: {}", e);
                        log::error!(
                            "DB ヘルスチェック失敗 (試行 {}/{}): {}",
                            attempt,
                            max_attempts,
                            e
                        );
                    }
                }
            }
            Err(e) => {
                last_err = format!("{}", e);
                log::error!("DB 接続失敗 (試行 {}/{}): {}", attempt, max_attempts, e);
            }
        }
        if attempt < max_attempts {
            let wait = attempt as u64; // 1秒、2秒と段階的に待機
            log::info!("{}秒後にリトライ…", wait);
            tokio::time::sleep(std::time::Duration::from_secs(wait)).await;
        }
    }

    Err(last_err)
}

/// SqlitePool を作成する（WAL モード、外部キー有効）
async fn connect_pool(db_url: &str) -> Result<SqlitePool, Box<dyn std::error::Error>> {
    let options = SqliteConnectOptions::from_str(db_url)?
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .foreign_keys(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await?;

    Ok(pool)
}

// ════════════════════════════════════════════════════════════════
// マイグレーション — 全エラーを吸収する安全版
// ════════════════════════════════════════════════════════════════

/// マイグレーションを実行する（全エラーを吸収し、絶対にパニックしない）
async fn run_migrations_safe(pool: &SqlitePool) {
    // マイグレーション管理テーブルの作成
    if let Err(e) = sqlx::query(
        "CREATE TABLE IF NOT EXISTS _stellar_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
    ).execute(pool).await {
        log::error!("マイグレーション管理テーブル作成失敗（致命的ではない）: {}", e);
        // 管理テーブルが作れなくても、各マイグレーションを試行する
    }

    // ── V001〜V003, V006: 全て IF NOT EXISTS で安全 ──
    let safe_migrations: Vec<(i64, &str, &str)> = vec![
        (
            1,
            "V001__initial",
            include_str!("migrations/V001__initial.sql"),
        ),
        (
            2,
            "V002__qualitative",
            include_str!("migrations/V002__qualitative.sql"),
        ),
        (
            3,
            "V003__quantitative",
            include_str!("migrations/V003__quantitative.sql"),
        ),
        (
            6,
            "V006__export",
            include_str!("migrations/V006__export.sql"),
        ),
    ];

    for (version, name, sql) in &safe_migrations {
        if migration_applied(pool, *version).await {
            continue;
        }
        run_sql_migration_safe(pool, *version, name, sql).await;
    }

    // ── V004: citation_network（ALTER TABLE + CREATE INDEX — 特別処理）──
    if !migration_applied(pool, 4).await {
        log::info!("V004__citation_network を適用中…");
        run_v004_safe(pool).await;
        mark_migration_applied(pool, 4).await;
        log::info!("V004__citation_network 完了");
    }

    // ── V005: draft_mode（ALTER TABLE + CREATE INDEX — 特別処理）──
    if !migration_applied(pool, 5).await {
        log::info!("V005__draft_mode を適用中…");
        run_v005_safe(pool).await;
        mark_migration_applied(pool, 5).await;
        log::info!("V005__draft_mode 完了");
    }

    log::info!("全マイグレーション処理完了");
}

/// V004: citation_network — 各ステートメントを個別に安全実行
async fn run_v004_safe(pool: &SqlitePool) {
    // papers テーブルにカラムを安全に追加
    safe_add_column(
        pool,
        "papers",
        "reading_status",
        "TEXT NOT NULL DEFAULT 'unread'",
    )
    .await;
    safe_add_column(pool, "papers", "ss_paper_id", "TEXT").await;
    safe_add_column(
        pool,
        "papers",
        "references_json",
        "TEXT NOT NULL DEFAULT '[]'",
    )
    .await;
    safe_add_column(
        pool,
        "papers",
        "cited_by_json",
        "TEXT NOT NULL DEFAULT '[]'",
    )
    .await;
    safe_add_column(pool, "papers", "references_fetched_at", "TEXT").await;

    // paper_recommendations テーブル
    exec_ignore(
        pool,
        "CREATE TABLE IF NOT EXISTS paper_recommendations (
            id TEXT PRIMARY KEY,
            paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
            recommended_paper_id TEXT,
            title TEXT NOT NULL,
            authors TEXT NOT NULL DEFAULT '[]',
            year INTEGER,
            doi TEXT,
            url TEXT,
            abstract TEXT,
            ss_paper_id TEXT,
            relevance_score REAL,
            is_imported INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
    )
    .await;

    // インデックス
    safe_create_index(
        pool,
        "CREATE INDEX idx_papers_reading_status ON papers(reading_status)",
    )
    .await;
    safe_create_index(
        pool,
        "CREATE INDEX idx_papers_ss_paper_id ON papers(ss_paper_id)",
    )
    .await;
    safe_create_index(
        pool,
        "CREATE INDEX idx_recommendations_paper_id ON paper_recommendations(paper_id)",
    )
    .await;
    safe_create_index(
        pool,
        "CREATE INDEX idx_recommendations_is_imported ON paper_recommendations(is_imported)",
    )
    .await;
}

/// V005: draft_mode — 各ステートメントを個別に安全実行
async fn run_v005_safe(pool: &SqlitePool) {
    // notes テーブルにカラムを安全に追加
    safe_add_column(pool, "notes", "is_draft", "INTEGER NOT NULL DEFAULT 0").await;
    safe_add_column(pool, "notes", "draft_meta", "TEXT NOT NULL DEFAULT '{}'").await;
    safe_add_column(pool, "notes", "word_count", "INTEGER NOT NULL DEFAULT 0").await;
    safe_add_column(
        pool,
        "notes",
        "reading_time_min",
        "INTEGER NOT NULL DEFAULT 0",
    )
    .await;

    // draft_citations テーブル
    exec_ignore(
        pool,
        "CREATE TABLE IF NOT EXISTS draft_citations (
            id TEXT PRIMARY KEY,
            note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
            paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
            citation_key TEXT NOT NULL,
            citation_style TEXT NOT NULL DEFAULT 'apa7',
            inline_text TEXT NOT NULL,
            bibliography_text TEXT NOT NULL,
            page_ref TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(note_id, paper_id, page_ref)
        )",
    )
    .await;

    // draft_chapters テーブル
    exec_ignore(
        pool,
        "CREATE TABLE IF NOT EXISTS draft_chapters (
            id TEXT PRIMARY KEY,
            note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            order_index INTEGER NOT NULL DEFAULT 0,
            word_count INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
    )
    .await;

    // インデックス
    safe_create_index(pool, "CREATE INDEX idx_notes_is_draft ON notes(is_draft)").await;
    safe_create_index(
        pool,
        "CREATE INDEX idx_draft_citations_note_id ON draft_citations(note_id)",
    )
    .await;
    safe_create_index(
        pool,
        "CREATE INDEX idx_draft_citations_paper_id ON draft_citations(paper_id)",
    )
    .await;
    safe_create_index(
        pool,
        "CREATE INDEX idx_draft_chapters_note_id ON draft_chapters(note_id, order_index)",
    )
    .await;
}

// ════════════════════════════════════════════════════════════════
// ヘルパー関数
// ════════════════════════════════════════════════════════════════

/// 指定テーブルに指定カラムが存在するかチェックする
async fn column_exists(pool: &SqlitePool, table: &str, column: &str) -> bool {
    let query = format!("PRAGMA table_info({})", table);
    match sqlx::query(&query).fetch_all(pool).await {
        Ok(rows) => {
            for row in &rows {
                let col_name: String = row.get("name");
                if col_name == column {
                    return true;
                }
            }
            false
        }
        Err(_) => false,
    }
}

/// ALTER TABLE ADD COLUMN を安全に実行する
/// カラムが既に存在する場合はスキップ、エラーも吸収
async fn safe_add_column(pool: &SqlitePool, table: &str, column: &str, col_def: &str) {
    if column_exists(pool, table, column).await {
        log::info!("カラム {}.{} は既に存在 — スキップ", table, column);
        return;
    }
    let sql = format!("ALTER TABLE {} ADD COLUMN {} {}", table, column, col_def);
    match sqlx::query(&sql).execute(pool).await {
        Ok(_) => log::info!("カラム {}.{} を追加しました", table, column),
        Err(e) => log::warn!("カラム {}.{} の追加をスキップ: {}", table, column, e),
    }
}

/// CREATE INDEX を安全に実行する（IF NOT EXISTS 付加 + エラー吸収）
async fn safe_create_index(pool: &SqlitePool, sql: &str) {
    let safe_sql = if sql.to_uppercase().contains("IF NOT EXISTS") {
        sql.to_string()
    } else {
        sql.replace("CREATE INDEX ", "CREATE INDEX IF NOT EXISTS ")
    };
    if let Err(e) = sqlx::query(&safe_sql).execute(pool).await {
        log::warn!("インデックス作成をスキップ: {}", e);
    }
}

/// SQL を実行し、全エラーを無視する
async fn exec_ignore(pool: &SqlitePool, sql: &str) {
    if let Err(e) = sqlx::query(sql).execute(pool).await {
        log::warn!("SQL 実行をスキップ: {}", e);
    }
}

/// マイグレーションバージョンが既に適用済みかチェックする
async fn migration_applied(pool: &SqlitePool, version: i64) -> bool {
    match sqlx::query("SELECT COUNT(*) as cnt FROM _stellar_migrations WHERE version = ?")
        .bind(version)
        .fetch_one(pool)
        .await
    {
        Ok(row) => {
            let cnt: i64 = row.get("cnt");
            cnt > 0
        }
        Err(_) => false,
    }
}

/// マイグレーションバージョンを適用済みとしてマークする
async fn mark_migration_applied(pool: &SqlitePool, version: i64) {
    let _ = sqlx::query(
        "INSERT OR IGNORE INTO _stellar_migrations (version, applied_at) VALUES (?, datetime('now'))"
    )
    .bind(version)
    .execute(pool)
    .await;
}

/// 安全な SQL マイグレーション（V001-V003, V006）を実行する
/// **全ステートメントのエラーを吸収** — FTS5 trigram 非対応環境でも停止しない
async fn run_sql_migration_safe(pool: &SqlitePool, version: i64, name: &str, sql: &str) {
    let mut success = 0;
    let mut skipped = 0;
    for statement in split_sql_statements(sql) {
        let trimmed = statement.trim();
        if trimmed.is_empty() {
            continue;
        }
        match sqlx::query(trimmed).execute(pool).await {
            Ok(_) => {
                success += 1;
            }
            Err(e) => {
                skipped += 1;
                // FTS5/trigram 関連は INFO レベル（既知の環境依存問題）
                let err_msg = format!("{}", e);
                if err_msg.contains("fts5")
                    || err_msg.contains("trigram")
                    || err_msg.contains("no such module")
                    || err_msg.contains("unknown tokenizer")
                {
                    log::info!(
                        "マイグレーション {} — FTS5 ステートメントをスキップ（環境未対応）: {}",
                        name,
                        e
                    );
                } else {
                    log::warn!(
                        "マイグレーション {} — ステートメントをスキップ: {}",
                        name,
                        e
                    );
                }
            }
        }
    }
    mark_migration_applied(pool, version).await;
    log::info!(
        "マイグレーション {} 完了 (成功: {}, スキップ: {})",
        name,
        success,
        skipped
    );
}

/// セミコロンで SQL 文を分割するヘルパー
/// トリガー内の BEGIN...END ブロックを正しく扱う
fn split_sql_statements(sql: &str) -> Vec<String> {
    let mut statements = Vec::new();
    let mut current = String::new();
    let mut in_begin_block = false;

    for line in sql.lines() {
        let trimmed = line.trim().to_uppercase();

        if trimmed.starts_with("BEGIN") {
            in_begin_block = true;
        }

        current.push_str(line);
        current.push('\n');

        if trimmed.ends_with("END;") {
            in_begin_block = false;
            statements.push(current.clone());
            current.clear();
        } else if !in_begin_block && trimmed.ends_with(';') {
            statements.push(current.clone());
            current.clear();
        }
    }

    if !current.trim().is_empty() {
        statements.push(current);
    }

    statements
}
