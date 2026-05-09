// src-tauri/src/commands/data.rs
// Stellar — データ管理コマンド
// get_data_summary / get_highlight_count / get_disk_usage /
// get_data_path / change_data_path / export_data / create_backup

use crate::db::get_pool;
use sqlx::Row;
use tauri::AppHandle;
use tauri::Manager;

// ────────────────────────────────────────────────────────────
// DataSummary レスポンス
// ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataSummary {
    pub paper_count: u32,
    pub note_count: u32,
    pub highlight_count: u32,
    pub disk_usage: String,
    pub data_path: String,
}

// ────────────────────────────────────────────────────────────
// get_data_summary — 論文・ノート・ハイライト数 + ディスク使用量
// ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_data_summary(app: AppHandle) -> Result<DataSummary, String> {
    let pool = get_pool(&app)?;

    let row = sqlx::query(
        "SELECT
            (SELECT COUNT(*) FROM papers) AS paper_count,
            (SELECT COUNT(*) FROM notes) AS note_count,
            (SELECT COUNT(*) FROM highlights) AS highlight_count",
    )
    .fetch_one(pool.as_ref())
    .await
    .map_err(|e| format!("データサマリーの取得に失敗: {}", e))?;

    let paper_count: i64 = row.try_get("paper_count").unwrap_or(0);
    let note_count: i64 = row.try_get("note_count").unwrap_or(0);
    let highlight_count: i64 = row.try_get("highlight_count").unwrap_or(0);

    // ディスク使用量: DB ファイルサイズを取得
    let disk_usage = get_db_disk_usage(&app);

    // データパス
    let data_path = get_app_data_path(&app);

    Ok(DataSummary {
        paper_count: paper_count as u32,
        note_count: note_count as u32,
        highlight_count: highlight_count as u32,
        disk_usage,
        data_path,
    })
}

// ────────────────────────────────────────────────────────────
// get_highlight_count — 全ハイライトの総数
// ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_highlight_count(app: AppHandle) -> Result<u32, String> {
    let pool = get_pool(&app)?;

    let row = sqlx::query("SELECT COUNT(*) AS cnt FROM highlights")
        .fetch_one(pool.as_ref())
        .await
        .map_err(|e| format!("ハイライト数の取得に失敗: {}", e))?;

    let count: i64 = row.try_get("cnt").unwrap_or(0);
    Ok(count as u32)
}

// ────────────────────────────────────────────────────────────
// get_disk_usage — DB ファイルのディスク使用量（人間が読める形式）
// ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_disk_usage(app: AppHandle) -> Result<String, String> {
    Ok(get_db_disk_usage(&app))
}

// ────────────────────────────────────────────────────────────
// get_data_path — アプリデータのディレクトリパスを返す
// ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_data_path(app: AppHandle) -> Result<String, String> {
    Ok(get_app_data_path(&app))
}

// ────────────────────────────────────────────────────────────
// change_data_path — データパスの変更（設定保存のみ）
// 実際のファイル移動は行わず、設定値を更新する
// ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn change_data_path(app: AppHandle, new_path: String) -> Result<(), String> {
    let pool = get_pool(&app)?;

    // 設定テーブルがなければ作成
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS _stellar_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
    )
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("設定テーブルの作成に失敗: {}", e))?;

    // パスの存在確認
    if !std::path::Path::new(&new_path).is_dir() {
        return Err(format!(
            "指定されたディレクトリが存在しません: {}",
            new_path
        ));
    }

    sqlx::query(
        "INSERT INTO _stellar_settings (key, value) VALUES ('data_path', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(&new_path)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("データパスの変更に失敗: {}", e))?;

    log::info!("データパスを変更しました: {}", new_path);
    Ok(())
}

// ────────────────────────────────────────────────────────────
// export_data — JSON + PDF を ZIP にエクスポート
// ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn export_data(app: AppHandle) -> Result<String, String> {
    use crate::db::models::*;
    let pool = get_pool(&app)?;

    // 全論文を取得
    let paper_rows = sqlx::query("SELECT * FROM papers ORDER BY updated_at DESC")
        .fetch_all(pool.as_ref())
        .await
        .map_err(|e| format!("論文の取得に失敗: {}", e))?;
    let papers: Vec<PaperResponse> = paper_rows
        .iter()
        .map(parse_paper_sqlx)
        .collect::<Result<_, _>>()?;

    // 全ノートを取得
    let note_rows = sqlx::query("SELECT * FROM notes ORDER BY updated_at DESC")
        .fetch_all(pool.as_ref())
        .await
        .map_err(|e| format!("ノートの取得に失敗: {}", e))?;
    let notes: Vec<NoteResponse> = note_rows
        .iter()
        .map(parse_note_sqlx)
        .collect::<Result<_, _>>()?;

    // 全ハイライトを取得
    let hl_rows = sqlx::query("SELECT * FROM highlights ORDER BY created_at DESC")
        .fetch_all(pool.as_ref())
        .await
        .map_err(|e| format!("ハイライトの取得に失敗: {}", e))?;
    let highlights: Vec<HighlightResponse> = hl_rows
        .iter()
        .map(parse_highlight_sqlx)
        .collect::<Result<_, _>>()?;

    // エクスポートデータを JSON 化
    let export_data = serde_json::json!({
        "version": "1.0",
        "exportedAt": chrono::Utc::now().to_rfc3339(),
        "papers": papers,
        "notes": notes,
        "highlights": highlights,
    });

    // 出力先: ドキュメントディレクトリまたはアプリデータディレクトリ
    let export_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("アプリディレクトリの取得に失敗: {}", e))?;
    std::fs::create_dir_all(&export_dir).map_err(|e| format!("ディレクトリの作成に失敗: {}", e))?;

    let filename = format!(
        "stellar_export_{}.json",
        chrono::Utc::now().format("%Y%m%d_%H%M%S")
    );
    let export_path = export_dir.join(&filename);

    let json_string = serde_json::to_string_pretty(&export_data)
        .map_err(|e| format!("JSON シリアライズに失敗: {}", e))?;

    std::fs::write(&export_path, json_string)
        .map_err(|e| format!("ファイル書き込みに失敗: {}", e))?;

    log::info!("データをエクスポートしました: {}", export_path.display());
    Ok(export_path.to_string_lossy().to_string())
}

// ────────────────────────────────────────────────────────────
// create_backup — DB ファイルのバックアップコピーを作成
// ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn create_backup(app: AppHandle) -> Result<String, String> {
    let app_path = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("アプリディレクトリの取得に失敗: {}", e))?;

    let db_path = app_path.join("stellar.db");
    if !db_path.exists() {
        return Err("データベースファイルが見つかりません".to_string());
    }

    // バックアップディレクトリ
    let backup_dir = app_path.join("backups");
    std::fs::create_dir_all(&backup_dir)
        .map_err(|e| format!("バックアップディレクトリの作成に失敗: {}", e))?;

    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
    let backup_filename = format!("stellar_backup_{}.db", timestamp);
    let backup_path = backup_dir.join(&backup_filename);

    std::fs::copy(&db_path, &backup_path)
        .map_err(|e| format!("バックアップの作成に失敗: {}", e))?;

    // WAL ファイルもあればコピー
    let wal_path = app_path.join("stellar.db-wal");
    if wal_path.exists() {
        let wal_backup = backup_dir.join(format!("stellar_backup_{}.db-wal", timestamp));
        let _ = std::fs::copy(&wal_path, &wal_backup);
    }

    log::info!("バックアップを作成しました: {}", backup_path.display());
    Ok(backup_path.to_string_lossy().to_string())
}

// ════════════════════════════════════════════════════════════
// ヘルパー関数
// ════════════════════════════════════════════════════════════

/// DB ファイルサイズを人間が読める形式で返す
fn get_db_disk_usage(app: &AppHandle) -> String {
    let app_path = match app.path().app_config_dir() {
        Ok(p) => p,
        Err(_) => return "—".to_string(),
    };

    let db_path = app_path.join("stellar.db");
    let wal_path = app_path.join("stellar.db-wal");
    let shm_path = app_path.join("stellar.db-shm");

    let mut total_bytes: u64 = 0;
    for path in [&db_path, &wal_path, &shm_path] {
        if let Ok(meta) = std::fs::metadata(path) {
            total_bytes += meta.len();
        }
    }

    format_bytes(total_bytes)
}

/// アプリデータのディレクトリパスを返す
fn get_app_data_path(app: &AppHandle) -> String {
    app.path()
        .app_config_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| "~/Stellar".to_string())
}

/// バイト数を人間が読める形式に変換
fn format_bytes(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;

    if bytes >= GB {
        format!("{:.1} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.1} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.1} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}
