// src-tauri/src/commands/cloud_backup.rs
// Stellar — クラウドバックアップコマンド
// ユーザー負担ゼロのクラウドバックアップ機能
//
// 設計:
// - 初回起動時にデバイスID (UUID v4) を自動生成し、ローカルに保存
// - デバイスIDから8桁のリカバリーコードを導出（PC破損時の復元用）
// - データは AES-256-GCM で暗号化してからアップロード
// - S3互換API (Cloudflare R2) 経由でバックアップを保存・取得
// - フロントエンドにはボタン1つの操作のみ公開

use crate::db::get_pool;
use crate::db::models::*;
use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use hmac::{Hmac, Mac};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use sqlx::Row;
use std::io::{Read as IoRead, Write as IoWrite};
use tauri::{AppHandle, Manager};

// ════════════════════════════════════════════════════════════
// 定数
// ════════════════════════════════════════════════════════════

/// バックアップAPIのベースURL（将来的にCloudflare R2 Worker を配置）
const DEFAULT_BACKUP_API_URL: &str = "https://stellar-backup.workers.dev";

/// デバイスID ファイル名
const DEVICE_ID_FILE: &str = "stellar_device_id";

/// 設定ファイル名
const CLOUD_BACKUP_CONFIG_FILE: &str = "stellar_cloud_backup.json";

/// バックアップデータのバージョン
const BACKUP_VERSION: &str = "2.0";

/// リカバリーコードの長さ（文字数）
const RECOVERY_CODE_LENGTH: usize = 12;

// ════════════════════════════════════════════════════════════
// データ構造
// ════════════════════════════════════════════════════════════

/// クラウドバックアップの設定
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudBackupConfig {
    /// デバイス固有ID
    pub device_id: String,
    /// リカバリーコード（8文字の英数字）
    pub recovery_code: String,
    /// 自動バックアップが有効か
    pub auto_backup_enabled: bool,
    /// 最後のバックアップ日時 (ISO 8601)
    pub last_backup_at: Option<String>,
    /// バックアップAPIのURL（カスタムエンドポイント対応）
    pub api_url: String,
}

/// バックアップステータス（フロントエンド向け）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudBackupStatus {
    /// セットアップ済みか
    pub is_configured: bool,
    /// デバイスID
    pub device_id: Option<String>,
    /// リカバリーコード
    pub recovery_code: Option<String>,
    /// 自動バックアップが有効か
    pub auto_backup_enabled: bool,
    /// 最後のバックアップ日時
    pub last_backup_at: Option<String>,
    /// バックアップAPIのURL
    pub api_url: String,
}

/// バックアップ結果
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudBackupResult {
    /// 成功したか
    pub success: bool,
    /// バックアップID
    pub backup_id: Option<String>,
    /// バックアップ日時
    pub backed_up_at: String,
    /// バックアップサイズ（バイト）
    pub size_bytes: u64,
    /// 含まれるデータの概要
    pub summary: BackupDataSummary,
}

/// バックアップデータ概要
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupDataSummary {
    pub paper_count: usize,
    pub note_count: usize,
    pub highlight_count: usize,
    pub link_count: usize,
}

/// バックアップ一覧のエントリ
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupEntry {
    /// バックアップID
    pub backup_id: String,
    /// 作成日時
    pub created_at: String,
    /// サイズ（バイト）
    pub size_bytes: u64,
    /// データ概要
    pub summary: BackupDataSummary,
}

/// バックアップ一覧レスポンス
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupListResponse {
    pub backups: Vec<BackupEntry>,
    pub total_count: usize,
}

/// リストアの結果
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreResult {
    pub success: bool,
    pub papers_restored: usize,
    pub notes_restored: usize,
    pub highlights_restored: usize,
    pub links_restored: usize,
    pub restored_at: String,
}

/// バックアップペイロード（暗号化前のJSON構造）
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BackupPayload {
    version: String,
    created_at: String,
    device_id: String,
    summary: BackupDataSummary,
    papers: Vec<serde_json::Value>,
    notes: Vec<serde_json::Value>,
    highlights: Vec<serde_json::Value>,
    links: Vec<serde_json::Value>,
}

/// 暗号化済みバックアップ（アップロード形式）
#[derive(Debug, Serialize, Deserialize)]
struct EncryptedBackup {
    /// バージョン
    version: String,
    /// 暗号化アルゴリズム
    algorithm: String,
    /// Base64エンコードされたnonce
    nonce: String,
    /// Base64エンコードされた暗号文
    ciphertext: String,
    /// データ概要（暗号化されない — 一覧表示用）
    summary: BackupDataSummary,
    /// 作成日時
    created_at: String,
}

// ════════════════════════════════════════════════════════════
// ヘルパー関数
// ════════════════════════════════════════════════════════════

/// アプリ設定ディレクトリを取得
fn get_config_dir(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_config_dir()
        .map_err(|e| format!("設定ディレクトリの取得に失敗: {}", e))
}

/// デバイスIDからAES-256鍵を導出する（HMAC-SHA256）
fn derive_encryption_key(device_id: &str, recovery_code: &str) -> [u8; 32] {
    let key_material = format!("stellar-backup-key:{}:{}", device_id, recovery_code);
    type HmacSha256 = Hmac<Sha256>;
    let mut mac =
        <HmacSha256 as Mac>::new_from_slice(b"stellar-cloud-backup-v2").expect("HMAC can take any size");
    mac.update(key_material.as_bytes());
    let result = mac.finalize();
    let bytes = result.into_bytes();
    let mut key = [0u8; 32];
    key.copy_from_slice(&bytes[..32]);
    key
}

/// デバイスIDからリカバリーコードを導出
fn derive_recovery_code(device_id: &str) -> String {
    type HmacSha256 = Hmac<Sha256>;
    let mut mac = <HmacSha256 as Mac>::new_from_slice(b"stellar-recovery-code-v2")
        .expect("HMAC can take any size");
    mac.update(device_id.as_bytes());
    let result = mac.finalize();
    let bytes = result.into_bytes();

    // Base32-like エンコード（紛らわしい文字を除外: 0/O, 1/I/L）
    const ALPHABET: &[u8] = b"23456789ABCDEFGHJKMNPQRSTUVWXYZ";
    let mut code = String::with_capacity(RECOVERY_CODE_LENGTH);
    for i in 0..RECOVERY_CODE_LENGTH {
        let idx = (bytes[i % bytes.len()] as usize) % ALPHABET.len();
        code.push(ALPHABET[idx] as char);
    }

    // 4文字ごとにハイフン区切り: XXXX-XXXX-XXXX
    let formatted: Vec<&str> = code
        .as_bytes()
        .chunks(4)
        .map(|chunk| std::str::from_utf8(chunk).unwrap_or(""))
        .collect();
    formatted.join("-")
}

/// データを AES-256-GCM で暗号化
fn encrypt_data(plaintext: &[u8], key: &[u8; 32]) -> Result<(Vec<u8>, Vec<u8>), String> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| format!("暗号化キーの作成に失敗: {}", e))?;

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| format!("データの暗号化に失敗: {}", e))?;

    Ok((ciphertext, nonce_bytes.to_vec()))
}

/// データを AES-256-GCM で復号
fn decrypt_data(ciphertext: &[u8], key: &[u8; 32], nonce_bytes: &[u8]) -> Result<Vec<u8>, String> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| format!("復号キーの作成に失敗: {}", e))?;

    let nonce = Nonce::from_slice(nonce_bytes);

    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "データの復号に失敗しました。リカバリーコードが正しいか確認してください。".to_string())
}

/// 設定を読み込む
fn load_config(app: &AppHandle) -> Result<Option<CloudBackupConfig>, String> {
    let config_dir = get_config_dir(app)?;
    let config_path = config_dir.join(CLOUD_BACKUP_CONFIG_FILE);

    if !config_path.exists() {
        return Ok(None);
    }

    let content = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("設定ファイルの読み込みに失敗: {}", e))?;

    let config: CloudBackupConfig = serde_json::from_str(&content)
        .map_err(|e| format!("設定ファイルのパースに失敗: {}", e))?;

    Ok(Some(config))
}

/// 設定を保存する
fn save_config(app: &AppHandle, config: &CloudBackupConfig) -> Result<(), String> {
    let config_dir = get_config_dir(app)?;
    std::fs::create_dir_all(&config_dir)
        .map_err(|e| format!("設定ディレクトリの作成に失敗: {}", e))?;

    let config_path = config_dir.join(CLOUD_BACKUP_CONFIG_FILE);
    let json = serde_json::to_string_pretty(config)
        .map_err(|e| format!("設定のシリアライズに失敗: {}", e))?;

    std::fs::write(&config_path, json)
        .map_err(|e| format!("設定ファイルの書き込みに失敗: {}", e))?;

    Ok(())
}

/// DB から全データを収集してバックアップペイロードを構築
async fn collect_backup_data(app: &AppHandle, device_id: &str) -> Result<BackupPayload, String> {
    let pool = get_pool(app)?;

    // 全論文
    let paper_rows = sqlx::query("SELECT * FROM papers ORDER BY updated_at DESC")
        .fetch_all(pool.as_ref())
        .await
        .map_err(|e| format!("論文の取得に失敗: {}", e))?;
    let papers: Vec<PaperResponse> = paper_rows
        .iter()
        .map(parse_paper_sqlx)
        .collect::<Result<_, _>>()?;

    // 全ノート
    let note_rows = sqlx::query("SELECT * FROM notes ORDER BY updated_at DESC")
        .fetch_all(pool.as_ref())
        .await
        .map_err(|e| format!("ノートの取得に失敗: {}", e))?;
    let notes: Vec<NoteResponse> = note_rows
        .iter()
        .map(parse_note_sqlx)
        .collect::<Result<_, _>>()?;

    // 全ハイライト
    let hl_rows = sqlx::query("SELECT * FROM highlights ORDER BY created_at DESC")
        .fetch_all(pool.as_ref())
        .await
        .map_err(|e| format!("ハイライトの取得に失敗: {}", e))?;
    let highlights: Vec<HighlightResponse> = hl_rows
        .iter()
        .map(parse_highlight_sqlx)
        .collect::<Result<_, _>>()?;

    // 全リンク
    let link_rows = sqlx::query("SELECT * FROM links ORDER BY created_at DESC")
        .fetch_all(pool.as_ref())
        .await
        .map_err(|e| format!("リンクの取得に失敗: {}", e))?;
    let links: Vec<LinkResponse> = link_rows
        .iter()
        .map(parse_link_sqlx)
        .collect::<Result<_, _>>()?;

    let summary = BackupDataSummary {
        paper_count: papers.len(),
        note_count: notes.len(),
        highlight_count: highlights.len(),
        link_count: links.len(),
    };

    Ok(BackupPayload {
        version: BACKUP_VERSION.to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
        device_id: device_id.to_string(),
        summary,
        papers: papers
            .iter()
            .map(|p| serde_json::to_value(p).unwrap_or_default())
            .collect(),
        notes: notes
            .iter()
            .map(|n| serde_json::to_value(n).unwrap_or_default())
            .collect(),
        highlights: highlights
            .iter()
            .map(|h| serde_json::to_value(h).unwrap_or_default())
            .collect(),
        links: links
            .iter()
            .map(|l| serde_json::to_value(l).unwrap_or_default())
            .collect(),
    })
}

// ════════════════════════════════════════════════════════════
// Tauri コマンド
// ════════════════════════════════════════════════════════════

/// クラウドバックアップの初期セットアップ
/// デバイスIDとリカバリーコードを生成し、設定を保存する
#[tauri::command]
pub async fn cloud_backup_setup(app: AppHandle) -> Result<CloudBackupStatus, String> {
    // 既存の設定があればそれを返す
    if let Some(config) = load_config(&app)? {
        return Ok(CloudBackupStatus {
            is_configured: true,
            device_id: Some(config.device_id),
            recovery_code: Some(config.recovery_code),
            auto_backup_enabled: config.auto_backup_enabled,
            last_backup_at: config.last_backup_at,
            api_url: config.api_url,
        });
    }

    // 新しいデバイスIDを生成
    let device_id = uuid::Uuid::new_v4().to_string();
    let recovery_code = derive_recovery_code(&device_id);

    let config = CloudBackupConfig {
        device_id: device_id.clone(),
        recovery_code: recovery_code.clone(),
        auto_backup_enabled: false,
        last_backup_at: None,
        api_url: DEFAULT_BACKUP_API_URL.to_string(),
    };

    save_config(&app, &config)?;

    log::info!(
        "クラウドバックアップをセットアップしました (device_id: {})",
        &device_id[..8]
    );

    Ok(CloudBackupStatus {
        is_configured: true,
        device_id: Some(device_id),
        recovery_code: Some(recovery_code),
        auto_backup_enabled: false,
        last_backup_at: None,
        api_url: DEFAULT_BACKUP_API_URL.to_string(),
    })
}

/// クラウドバックアップのステータスを取得
#[tauri::command]
pub async fn cloud_backup_get_status(app: AppHandle) -> Result<CloudBackupStatus, String> {
    match load_config(&app)? {
        Some(config) => Ok(CloudBackupStatus {
            is_configured: true,
            device_id: Some(config.device_id),
            recovery_code: Some(config.recovery_code),
            auto_backup_enabled: config.auto_backup_enabled,
            last_backup_at: config.last_backup_at,
            api_url: config.api_url,
        }),
        None => Ok(CloudBackupStatus {
            is_configured: false,
            device_id: None,
            recovery_code: None,
            auto_backup_enabled: false,
            last_backup_at: None,
            api_url: DEFAULT_BACKUP_API_URL.to_string(),
        }),
    }
}

/// クラウドにバックアップを実行
/// データを収集 → 暗号化 → ZIP圧縮 → アップロード
#[tauri::command]
pub async fn cloud_backup_create(app: AppHandle) -> Result<CloudBackupResult, String> {
    let config = load_config(&app)?
        .ok_or("クラウドバックアップが未設定です。先にセットアップを実行してください。")?;

    // 1. データ収集
    log::info!("クラウドバックアップ: データ収集中...");
    let payload = collect_backup_data(&app, &config.device_id).await?;
    let summary = payload.summary.clone();

    // 2. JSON シリアライズ
    let json_data = serde_json::to_vec(&payload)
        .map_err(|e| format!("データのシリアライズに失敗: {}", e))?;

    // 3. ZIP 圧縮
    let compressed = compress_data(&json_data)?;

    // 4. AES-256-GCM で暗号化
    let key = derive_encryption_key(&config.device_id, &config.recovery_code);
    let (ciphertext, nonce) = encrypt_data(&compressed, &key)?;

    let now = chrono::Utc::now().to_rfc3339();
    let encrypted_backup = EncryptedBackup {
        version: BACKUP_VERSION.to_string(),
        algorithm: "AES-256-GCM".to_string(),
        nonce: BASE64.encode(&nonce),
        ciphertext: BASE64.encode(&ciphertext),
        summary: summary.clone(),
        created_at: now.clone(),
    };

    let upload_data = serde_json::to_vec(&encrypted_backup)
        .map_err(|e| format!("暗号化データのシリアライズに失敗: {}", e))?;
    let size_bytes = upload_data.len() as u64;

    // 5. アップロード
    let backup_id = upload_backup(&config, &upload_data).await?;

    // 6. 設定を更新（最終バックアップ日時）
    let mut updated_config = config;
    updated_config.last_backup_at = Some(now.clone());
    save_config(&app, &updated_config)?;

    log::info!(
        "クラウドバックアップ完了: {} ({} bytes)",
        backup_id,
        size_bytes
    );

    Ok(CloudBackupResult {
        success: true,
        backup_id: Some(backup_id),
        backed_up_at: now,
        size_bytes,
        summary,
    })
}

/// バックアップ一覧を取得
#[tauri::command]
pub async fn cloud_backup_list(app: AppHandle) -> Result<BackupListResponse, String> {
    let config = load_config(&app)?
        .ok_or("クラウドバックアップが未設定です。")?;

    let backups = fetch_backup_list(&config).await?;
    let total_count = backups.len();

    Ok(BackupListResponse {
        backups,
        total_count,
    })
}

/// バックアップからリストアを実行
#[tauri::command]
pub async fn cloud_backup_restore(
    app: AppHandle,
    backup_id: String,
    recovery_code: String,
) -> Result<RestoreResult, String> {
    let config = load_config(&app)?
        .ok_or("クラウドバックアップが未設定です。")?;

    // 1. バックアップをダウンロード
    log::info!("クラウドバックアップ: ダウンロード中 ({})", backup_id);
    let encrypted_data = download_backup(&config, &backup_id).await?;

    // 2. パース
    let encrypted_backup: EncryptedBackup = serde_json::from_slice(&encrypted_data)
        .map_err(|e| format!("バックアップデータのパースに失敗: {}", e))?;

    // 3. 復号
    let nonce = BASE64
        .decode(&encrypted_backup.nonce)
        .map_err(|e| format!("Nonceのデコードに失敗: {}", e))?;
    let ciphertext = BASE64
        .decode(&encrypted_backup.ciphertext)
        .map_err(|e| format!("暗号文のデコードに失敗: {}", e))?;

    // リカバリーコードで鍵を導出（入力されたコードを使用）
    let key = derive_encryption_key(&config.device_id, &recovery_code);
    let compressed = decrypt_data(&ciphertext, &key, &nonce)?;

    // 4. 展開
    let json_data = decompress_data(&compressed)?;

    // 5. パース
    let payload: BackupPayload = serde_json::from_slice(&json_data)
        .map_err(|e| format!("バックアップペイロードのパースに失敗: {}", e))?;

    // 6. DB にリストア
    log::info!("クラウドバックアップ: リストア中...");
    let result = restore_to_db(&app, &payload).await?;

    log::info!(
        "クラウドバックアップ リストア完了: papers={}, notes={}, highlights={}, links={}",
        result.papers_restored,
        result.notes_restored,
        result.highlights_restored,
        result.links_restored
    );

    Ok(result)
}

/// リカバリーコードを使って別デバイスからリストア
/// (新しいPC等で、デバイスIDを持っていない場合)
#[tauri::command]
pub async fn cloud_backup_recover(
    app: AppHandle,
    recovery_code: String,
) -> Result<CloudBackupStatus, String> {
    // リカバリーコードから既存のバックアップを検索
    // APIに問い合わせてデバイスIDを解決する
    let client = reqwest::Client::new();
    let api_url = match load_config(&app)? {
        Some(c) => c.api_url,
        None => DEFAULT_BACKUP_API_URL.to_string(),
    };

    let resp = client
        .post(format!("{}/api/recover", api_url))
        .json(&serde_json::json!({ "recoveryCode": recovery_code }))
        .send()
        .await
        .map_err(|e| format!("リカバリーリクエストに失敗: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!(
            "リカバリーに失敗しました (HTTP {}): {}",
            status, body
        ));
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct RecoverResponse {
        device_id: String,
    }

    let recover_resp: RecoverResponse = resp
        .json()
        .await
        .map_err(|e| format!("レスポンスのパースに失敗: {}", e))?;

    // 設定を保存
    let config = CloudBackupConfig {
        device_id: recover_resp.device_id.clone(),
        recovery_code: recovery_code.clone(),
        auto_backup_enabled: false,
        last_backup_at: None,
        api_url,
    };
    save_config(&app, &config)?;

    log::info!(
        "リカバリー成功: device_id={}",
        &recover_resp.device_id[..8]
    );

    Ok(CloudBackupStatus {
        is_configured: true,
        device_id: Some(recover_resp.device_id),
        recovery_code: Some(recovery_code),
        auto_backup_enabled: false,
        last_backup_at: None,
        api_url: config.api_url.clone(),
    })
}

/// 自動バックアップの有効/無効を切り替える
#[tauri::command]
pub async fn cloud_backup_toggle_auto(
    app: AppHandle,
    enabled: bool,
) -> Result<CloudBackupStatus, String> {
    let mut config = load_config(&app)?
        .ok_or("クラウドバックアップが未設定です。")?;

    config.auto_backup_enabled = enabled;
    save_config(&app, &config)?;

    log::info!("自動バックアップ: {}", if enabled { "有効" } else { "無効" });

    Ok(CloudBackupStatus {
        is_configured: true,
        device_id: Some(config.device_id),
        recovery_code: Some(config.recovery_code),
        auto_backup_enabled: enabled,
        last_backup_at: config.last_backup_at,
        api_url: config.api_url,
    })
}

/// バックアップAPIのURLを変更する（セルフホスト対応）
#[tauri::command]
pub async fn cloud_backup_set_api_url(
    app: AppHandle,
    api_url: String,
) -> Result<CloudBackupStatus, String> {
    let mut config = load_config(&app)?
        .ok_or("クラウドバックアップが未設定です。")?;

    config.api_url = api_url;
    save_config(&app, &config)?;

    Ok(CloudBackupStatus {
        is_configured: true,
        device_id: Some(config.device_id),
        recovery_code: Some(config.recovery_code),
        auto_backup_enabled: config.auto_backup_enabled,
        last_backup_at: config.last_backup_at,
        api_url: config.api_url,
    })
}

// ════════════════════════════════════════════════════════════
// 内部: 圧縮・展開
// ════════════════════════════════════════════════════════════

/// データを ZIP 圧縮する
fn compress_data(data: &[u8]) -> Result<Vec<u8>, String> {
    let compressed = flate2_compress(data)?;
    Ok(compressed)
}

/// flate2 互換の圧縮（zip crate の deflate を利用）
fn flate2_compress(data: &[u8]) -> Result<Vec<u8>, String> {
    use std::io::Cursor;
    let mut buf = Vec::new();
    {
        let cursor = Cursor::new(&mut buf);
        let mut zip_writer = zip::ZipWriter::new(cursor);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);
        zip_writer
            .start_file("backup.json", options)
            .map_err(|e| format!("ZIP エントリの作成に失敗: {}", e))?;
        zip_writer
            .write_all(data)
            .map_err(|e| format!("ZIP 書き込みに失敗: {}", e))?;
        zip_writer
            .finish()
            .map_err(|e| format!("ZIP 完了に失敗: {}", e))?;
    }
    Ok(buf)
}

/// ZIP データを展開する
fn decompress_data(compressed: &[u8]) -> Result<Vec<u8>, String> {
    use std::io::Cursor;
    let cursor = Cursor::new(compressed);
    let mut archive =
        zip::ZipArchive::new(cursor).map_err(|e| format!("ZIP アーカイブの読み込みに失敗: {}", e))?;

    let mut entry = archive
        .by_name("backup.json")
        .map_err(|_| "バックアップデータが見つかりません".to_string())?;

    let mut buf = Vec::new();
    entry
        .read_to_end(&mut buf)
        .map_err(|e| format!("ZIP 展開に失敗: {}", e))?;

    Ok(buf)
}

// ════════════════════════════════════════════════════════════
// 内部: ネットワーク操作 (S3互換API)
// ════════════════════════════════════════════════════════════

/// バックアップをアップロード
async fn upload_backup(config: &CloudBackupConfig, data: &[u8]) -> Result<String, String> {
    let client = reqwest::Client::new();
    let backup_id = format!(
        "backup_{}",
        chrono::Utc::now().format("%Y%m%d_%H%M%S")
    );

    let resp = client
        .put(format!(
            "{}/api/backups/{}/{}",
            config.api_url, config.device_id, backup_id
        ))
        .header("Content-Type", "application/octet-stream")
        .header("X-Device-Id", &config.device_id)
        .body(data.to_vec())
        .send()
        .await
        .map_err(|e| format!("バックアップのアップロードに失敗: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();

        // ネットワーク未接続やサーバー未配置の場合はローカルにも保存
        if status.as_u16() >= 500 || status.as_u16() == 0 {
            log::warn!("クラウドアップロード失敗 (HTTP {}), ローカルに保存します", status);
            save_backup_locally(&config, data, &backup_id)?;
            return Ok(format!("local:{}", backup_id));
        }

        return Err(format!(
            "アップロードに失敗 (HTTP {}): {}",
            status, body
        ));
    }

    Ok(backup_id)
}

/// バックアップ一覧を取得
async fn fetch_backup_list(config: &CloudBackupConfig) -> Result<Vec<BackupEntry>, String> {
    let client = reqwest::Client::new();

    let resp = client
        .get(format!(
            "{}/api/backups/{}",
            config.api_url, config.device_id
        ))
        .header("X-Device-Id", &config.device_id)
        .send()
        .await;

    match resp {
        Ok(response) if response.status().is_success() => {
            let entries: Vec<BackupEntry> = response
                .json()
                .await
                .map_err(|e| format!("レスポンスのパースに失敗: {}", e))?;
            Ok(entries)
        }
        _ => {
            // ネットワークエラーやサーバー未配置の場合、ローカルのバックアップを返す
            log::warn!("クラウドAPI接続失敗、ローカルバックアップ一覧を返します");
            list_local_backups(config)
        }
    }
}

/// バックアップをダウンロード
async fn download_backup(
    config: &CloudBackupConfig,
    backup_id: &str,
) -> Result<Vec<u8>, String> {
    // ローカルバックアップの場合
    if backup_id.starts_with("local:") {
        let local_id = &backup_id[6..];
        return load_local_backup(config, local_id);
    }

    let client = reqwest::Client::new();

    let resp = client
        .get(format!(
            "{}/api/backups/{}/{}",
            config.api_url, config.device_id, backup_id
        ))
        .header("X-Device-Id", &config.device_id)
        .send()
        .await
        .map_err(|e| format!("バックアップのダウンロードに失敗: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        // フォールバック: ローカルを試す
        if let Ok(data) = load_local_backup(config, backup_id) {
            return Ok(data);
        }
        return Err(format!("ダウンロードに失敗 (HTTP {})", status));
    }

    resp.bytes()
        .await
        .map(|b| b.to_vec())
        .map_err(|e| format!("データの読み込みに失敗: {}", e))
}

// ════════════════════════════════════════════════════════════
// 内部: ローカルバックアップ（フォールバック）
// ════════════════════════════════════════════════════════════

/// ローカルにバックアップを保存（ネットワーク接続が無い場合のフォールバック）
fn save_backup_locally(
    _config: &CloudBackupConfig,
    data: &[u8],
    backup_id: &str,
) -> Result<(), String> {
    let home = dirs_fallback();
    let backup_dir = home.join(".stellar").join("cloud_backups");
    std::fs::create_dir_all(&backup_dir)
        .map_err(|e| format!("バックアップディレクトリの作成に失敗: {}", e))?;

    let path = backup_dir.join(format!("{}.enc", backup_id));
    std::fs::write(&path, data)
        .map_err(|e| format!("ローカルバックアップの書き込みに失敗: {}", e))?;

    log::info!("ローカルバックアップを保存しました: {}", path.display());
    Ok(())
}

/// ローカルのバックアップ一覧を取得
fn list_local_backups(_config: &CloudBackupConfig) -> Result<Vec<BackupEntry>, String> {
    let home = dirs_fallback();
    let backup_dir = home.join(".stellar").join("cloud_backups");

    if !backup_dir.exists() {
        return Ok(vec![]);
    }

    let mut entries = Vec::new();
    let dir_entries = std::fs::read_dir(&backup_dir)
        .map_err(|e| format!("バックアップディレクトリの読み込みに失敗: {}", e))?;

    for entry in dir_entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("enc") {
            let filename = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();

            let metadata = std::fs::metadata(&path).ok();
            let size = metadata.as_ref().map(|m| m.len()).unwrap_or(0);

            // ファイルの中身をパースして summary を取得
            let summary = if let Ok(data) = std::fs::read(&path) {
                if let Ok(enc_backup) = serde_json::from_slice::<EncryptedBackup>(&data) {
                    enc_backup.summary
                } else {
                    BackupDataSummary {
                        paper_count: 0,
                        note_count: 0,
                        highlight_count: 0,
                        link_count: 0,
                    }
                }
            } else {
                BackupDataSummary {
                    paper_count: 0,
                    note_count: 0,
                    highlight_count: 0,
                    link_count: 0,
                }
            };

            entries.push(BackupEntry {
                backup_id: format!("local:{}", filename),
                created_at: metadata
                    .and_then(|m| m.modified().ok())
                    .map(|t| {
                        chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339()
                    })
                    .unwrap_or_default(),
                size_bytes: size,
                summary,
            });
        }
    }

    // 新しい順にソート
    entries.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(entries)
}

/// ローカルバックアップを読み込む
fn load_local_backup(_config: &CloudBackupConfig, backup_id: &str) -> Result<Vec<u8>, String> {
    let home = dirs_fallback();
    let path = home
        .join(".stellar")
        .join("cloud_backups")
        .join(format!("{}.enc", backup_id));

    std::fs::read(&path).map_err(|e| format!("ローカルバックアップの読み込みに失敗: {}", e))
}

/// ホームディレクトリのフォールバック取得
fn dirs_fallback() -> std::path::PathBuf {
    if let Ok(home) = std::env::var("HOME") {
        std::path::PathBuf::from(home)
    } else if let Ok(home) = std::env::var("USERPROFILE") {
        std::path::PathBuf::from(home)
    } else {
        std::path::PathBuf::from(".")
    }
}

// ════════════════════════════════════════════════════════════
// 内部: DB リストア
// ════════════════════════════════════════════════════════════

/// バックアップデータを DB にリストア（マージ方式）
async fn restore_to_db(app: &AppHandle, payload: &BackupPayload) -> Result<RestoreResult, String> {
    let pool = get_pool(app)?;
    let mut result = RestoreResult {
        success: true,
        papers_restored: 0,
        notes_restored: 0,
        highlights_restored: 0,
        links_restored: 0,
        restored_at: chrono::Utc::now().to_rfc3339(),
    };

    // 論文のリストア（ID重複チェック + マージ）
    for paper_val in &payload.papers {
        let id = paper_val["id"].as_str().unwrap_or("");
        if id.is_empty() {
            continue;
        }

        // 既存チェック
        let existing = sqlx::query("SELECT id FROM papers WHERE id = ?")
            .bind(id)
            .fetch_optional(pool.as_ref())
            .await
            .map_err(|e| format!("論文の存在チェックに失敗: {}", e))?;

        if existing.is_some() {
            // 既存の場合は更新（バックアップの方が新しければ）
            let backup_updated = paper_val["updatedAt"].as_str().unwrap_or("");
            let current: Option<String> =
                sqlx::query("SELECT updated_at FROM papers WHERE id = ?")
                    .bind(id)
                    .fetch_optional(pool.as_ref())
                    .await
                    .map_err(|e| format!("更新日時の取得に失敗: {}", e))?
                    .and_then(|row| row.try_get("updated_at").ok());

            if let Some(ref current_updated) = current {
                if backup_updated <= current_updated.as_str() {
                    continue; // ローカルの方が新しいのでスキップ
                }
            }
        }

        // INSERT OR REPLACE
        let title = paper_val["title"].as_str().unwrap_or("Untitled");
        let authors = paper_val["authors"].to_string();
        let year = paper_val["year"].as_i64().map(|v| v as i32);
        let journal = paper_val["journal"].as_str();
        let volume = paper_val["volume"].as_str();
        let issue = paper_val["issue"].as_str();
        let pages = paper_val["pages"].as_str();
        let doi = paper_val["doi"].as_str();
        let url = paper_val["url"].as_str();
        let abs = paper_val["abstract"].as_str();
        let pdf_path = paper_val["pdfPath"].as_str();
        let tags = paper_val["tags"].to_string();
        let now_str = chrono::Utc::now().to_rfc3339();
        let created_at = paper_val["createdAt"]
            .as_str()
            .unwrap_or(&now_str);
        let updated_at = paper_val["updatedAt"]
            .as_str()
            .unwrap_or(&now_str);

        sqlx::query(
            "INSERT OR REPLACE INTO papers (id, title, authors, year, journal, volume, issue, pages, doi, url, abstract, pdf_path, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(id)
        .bind(title)
        .bind(&authors)
        .bind(year)
        .bind(journal)
        .bind(volume)
        .bind(issue)
        .bind(pages)
        .bind(doi)
        .bind(url)
        .bind(abs)
        .bind(pdf_path)
        .bind(&tags)
        .bind(created_at)
        .bind(updated_at)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("論文のリストアに失敗: {}", e))?;

        result.papers_restored += 1;
    }

    // ノートのリストア
    for note_val in &payload.notes {
        let id = note_val["id"].as_str().unwrap_or("");
        if id.is_empty() {
            continue;
        }

        let existing = sqlx::query("SELECT id, updated_at FROM notes WHERE id = ?")
            .bind(id)
            .fetch_optional(pool.as_ref())
            .await
            .map_err(|e| format!("ノートの存在チェックに失敗: {}", e))?;

        if let Some(row) = &existing {
            let current_updated: String = row.try_get("updated_at").unwrap_or_default();
            let backup_updated = note_val["updatedAt"].as_str().unwrap_or("");
            if backup_updated <= current_updated.as_str() {
                continue;
            }
        }

        let title = note_val["title"].as_str().unwrap_or("Untitled");
        let content = note_val["content"].as_str().unwrap_or("");
        let paper_id = note_val["paperId"].as_str();
        let tags = note_val["tags"].to_string();
        let now_str = chrono::Utc::now().to_rfc3339();
        let created_at = note_val["createdAt"]
            .as_str()
            .unwrap_or(&now_str);
        let updated_at = note_val["updatedAt"]
            .as_str()
            .unwrap_or(&now_str);

        sqlx::query(
            "INSERT OR REPLACE INTO notes (id, title, content, paper_id, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(id)
        .bind(title)
        .bind(content)
        .bind(paper_id)
        .bind(&tags)
        .bind(created_at)
        .bind(updated_at)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("ノートのリストアに失敗: {}", e))?;

        result.notes_restored += 1;
    }

    // ハイライトのリストア（上書き方式 — ハイライトは更新日がないため）
    for hl_val in &payload.highlights {
        let id = hl_val["id"].as_str().unwrap_or("");
        if id.is_empty() {
            continue;
        }

        let existing = sqlx::query("SELECT id FROM highlights WHERE id = ?")
            .bind(id)
            .fetch_optional(pool.as_ref())
            .await
            .map_err(|e| format!("ハイライトの存在チェックに失敗: {}", e))?;

        if existing.is_some() {
            continue; // 既存のハイライトはスキップ
        }

        let paper_id = hl_val["paperId"].as_str().unwrap_or("");
        let text = hl_val["text"].as_str().unwrap_or("");
        let comment = hl_val["comment"].as_str();
        let color = hl_val["color"].as_str().unwrap_or("#FFEB3B");
        let page = hl_val["page"].as_i64().unwrap_or(1) as i32;
        let rect = hl_val["rect"].to_string();
        let now_str = chrono::Utc::now().to_rfc3339();
        let created_at = hl_val["createdAt"]
            .as_str()
            .unwrap_or(&now_str);

        sqlx::query(
            "INSERT OR IGNORE INTO highlights (id, paper_id, text, comment, color, page, rect, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(id)
        .bind(paper_id)
        .bind(text)
        .bind(comment)
        .bind(color)
        .bind(page)
        .bind(&rect)
        .bind(created_at)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("ハイライトのリストアに失敗: {}", e))?;

        result.highlights_restored += 1;
    }

    // リンクのリストア
    for link_val in &payload.links {
        let id = link_val["id"].as_str().unwrap_or("");
        if id.is_empty() {
            continue;
        }

        let existing = sqlx::query("SELECT id FROM links WHERE id = ?")
            .bind(id)
            .fetch_optional(pool.as_ref())
            .await
            .map_err(|e| format!("リンクの存在チェックに失敗: {}", e))?;

        if existing.is_some() {
            continue;
        }

        let source_type = link_val["sourceType"].as_str().unwrap_or("note");
        let source_id = link_val["sourceId"].as_str().unwrap_or("");
        let target_type = link_val["targetType"].as_str().unwrap_or("note");
        let target_id = link_val["targetId"].as_str().unwrap_or("");
        let context = link_val["context"].as_str();
        let now_str = chrono::Utc::now().to_rfc3339();
        let created_at = link_val["createdAt"]
            .as_str()
            .unwrap_or(&now_str);

        sqlx::query(
            "INSERT OR IGNORE INTO links (id, source_type, source_id, target_type, target_id, context, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(id)
        .bind(source_type)
        .bind(source_id)
        .bind(target_type)
        .bind(target_id)
        .bind(context)
        .bind(created_at)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("リンクのリストアに失敗: {}", e))?;

        result.links_restored += 1;
    }

    Ok(result)
}
