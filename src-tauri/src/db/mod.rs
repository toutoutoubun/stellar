// src-tauri/src/db/mod.rs
// Stellar — データベースモジュール
// sqlx::SqlitePool を自前管理し、Tauri Managed State として共有する

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
             （AppDb が Managed State に登録されていません）".to_string()
        ),
    }
}

/// アプリケーション初期化時に SqlitePool を作成する
pub async fn init_db(app: &AppHandle) -> Result<SqlitePool, Box<dyn std::error::Error>> {
    let app_path = app.path().app_config_dir()?;
    std::fs::create_dir_all(&app_path)?;

    let db_path = app_path.join("stellar.db");
    let db_url = format!("sqlite:{}?mode=rwc", db_path.display());

    let options = SqliteConnectOptions::from_str(&db_url)?
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .foreign_keys(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await?;

    // マイグレーション実行
    run_migrations(&pool).await?;

    Ok(pool)
}

/// SQL マイグレーションを実行する
async fn run_migrations(pool: &SqlitePool) -> Result<(), Box<dyn std::error::Error>> {
    // マイグレーション管理テーブル
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS _stellar_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
    )
    .execute(pool)
    .await?;

    // マイグレーション定義
    let migrations: Vec<(i64, &str, &str)> = vec![
        (1, "V001__initial", include_str!("migrations/V001__initial.sql")),
        (2, "V002__qualitative", include_str!("migrations/V002__qualitative.sql")),
        (3, "V003__quantitative", include_str!("migrations/V003__quantitative.sql")),
        (4, "V004__citation_network", include_str!("migrations/V004__citation_network.sql")),
        (5, "V005__draft_mode", include_str!("migrations/V005__draft_mode.sql")),
        (6, "V006__export", include_str!("migrations/V006__export.sql")),
    ];

    for (version, name, sql) in &migrations {
        let row = sqlx::query(
            "SELECT COUNT(*) as cnt FROM _stellar_migrations WHERE version = ?",
        )
        .bind(version)
        .fetch_one(pool)
        .await?;
        let cnt: i64 = row.get("cnt");

        if cnt == 0 {
            for statement in split_sql_statements(sql) {
                let trimmed = statement.trim();
                if trimmed.is_empty() {
                    continue;
                }
                sqlx::query(trimmed).execute(pool).await?;
            }

            sqlx::query(
                "INSERT INTO _stellar_migrations (version, applied_at) VALUES (?, datetime('now'))",
            )
            .bind(version)
            .execute(pool)
            .await?;

            log::info!("マイグレーション {} を適用しました", name);
        }
    }

    Ok(())
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
