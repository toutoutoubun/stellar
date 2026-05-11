// src-tauri/src/commands/plugins.rs
// Stellar — downloaded add-on / plugin installation and management

use serde::{Deserialize, Serialize};
use std::{
    fs::{self, File},
    io,
    path::{Component, Path, PathBuf},
};
use tauri::{AppHandle, Manager};
use uuid::Uuid;
use zip::ZipArchive;

const MANIFEST_FILE: &str = "stellar-plugin.json";
const STATE_FILE: &str = ".stellar-plugin-state.json";
const STAGING_DIR: &str = ".plugin-staging";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub version: Option<String>,
    pub description: Option<String>,
    pub author: Option<String>,
    pub entry: Option<String>,
    pub homepage: Option<String>,
    #[serde(default)]
    pub capabilities: Vec<String>,
    pub min_stellar_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PluginState {
    enabled: bool,
    installed_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledPlugin {
    pub id: String,
    pub name: String,
    pub version: Option<String>,
    pub description: Option<String>,
    pub author: Option<String>,
    pub entry: String,
    pub homepage: Option<String>,
    pub capabilities: Vec<String>,
    pub min_stellar_version: Option<String>,
    pub enabled: bool,
    pub installed_at: String,
    pub path: String,
    pub entry_path: String,
    pub package_size_bytes: u64,
}

#[tauri::command]
pub async fn list_installed_plugins(app: AppHandle) -> Result<Vec<InstalledPlugin>, String> {
    let plugins_dir = ensure_plugins_dir(&app)?;
    let mut plugins = Vec::new();

    let entries = fs::read_dir(&plugins_dir)
        .map_err(|e| format!("プラグインディレクトリの読み込みに失敗: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        if path
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.starts_with('.'))
        {
            continue;
        }

        match installed_plugin_from_dir(&path) {
            Ok(plugin) => plugins.push(plugin),
            Err(err) => log::warn!("プラグインをスキップしました ({}): {}", path.display(), err),
        }
    }

    plugins.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(plugins)
}

#[tauri::command]
pub async fn install_plugin_package(
    app: AppHandle,
    source_path: String,
) -> Result<InstalledPlugin, String> {
    let source = PathBuf::from(&source_path);
    if !source.exists() {
        return Err(format!("プラグインパッケージが見つかりません: {}", source_path));
    }

    let plugins_dir = ensure_plugins_dir(&app)?;
    let staging_root = ensure_staging_dir(&app)?;
    let staging_dir = staging_root.join(Uuid::new_v4().to_string());
    fs::create_dir_all(&staging_dir)
        .map_err(|e| format!("一時ディレクトリの作成に失敗: {}", e))?;

    let result = install_plugin_package_inner(&source, &plugins_dir, &staging_dir);
    let _ = fs::remove_dir_all(&staging_dir);
    result
}

#[tauri::command]
pub async fn set_installed_plugin_enabled(
    app: AppHandle,
    plugin_id: String,
    enabled: bool,
) -> Result<InstalledPlugin, String> {
    let id = normalize_plugin_id(&plugin_id)?;
    let plugin_dir = ensure_plugins_dir(&app)?.join(id);
    if !plugin_dir.is_dir() {
        return Err(format!("プラグインが見つかりません: {}", plugin_id));
    }

    let mut state = read_state(&plugin_dir);
    state.enabled = enabled;
    if state.installed_at.trim().is_empty() {
        state.installed_at = chrono::Utc::now().to_rfc3339();
    }
    write_state(&plugin_dir, &state)?;
    installed_plugin_from_dir(&plugin_dir)
}

#[tauri::command]
pub async fn remove_installed_plugin(app: AppHandle, plugin_id: String) -> Result<(), String> {
    let id = normalize_plugin_id(&plugin_id)?;
    let plugin_dir = ensure_plugins_dir(&app)?.join(id);
    if !plugin_dir.exists() {
        return Ok(());
    }
    fs::remove_dir_all(&plugin_dir)
        .map_err(|e| format!("プラグインの削除に失敗 ({}): {}", plugin_id, e))?;
    Ok(())
}

fn install_plugin_package_inner(
    source: &Path,
    plugins_dir: &Path,
    staging_dir: &Path,
) -> Result<InstalledPlugin, String> {
    let plugin_root = if source.is_dir() {
        find_manifest_root(source)?
    } else if is_zip_like(source) {
        extract_zip(source, staging_dir)?;
        find_manifest_root(staging_dir)?
    } else {
        return Err("プラグインは .zip / .stellar-plugin ファイル、または manifest を含むフォルダを選択してください。".to_string());
    };

    let manifest = read_manifest(&plugin_root)?;
    validate_manifest(&manifest)?;

    let id = normalize_plugin_id(&manifest.id)?;
    let entry = manifest.entry.as_deref().unwrap_or("index.js").to_string();
    let entry_rel = safe_relative_path(&entry)?;
    let source_entry = plugin_root.join(&entry_rel);
    if !source_entry.is_file() {
        return Err(format!("エントリーファイルが見つかりません: {}", entry));
    }

    let temp_dest = plugins_dir.join(format!(".{}.installing-{}", id, Uuid::new_v4()));
    let final_dest = plugins_dir.join(&id);

    if temp_dest.exists() {
        fs::remove_dir_all(&temp_dest)
            .map_err(|e| format!("一時インストール先の削除に失敗: {}", e))?;
    }
    copy_dir_all(&plugin_root, &temp_dest)?;

    let state = PluginState {
        enabled: true,
        installed_at: chrono::Utc::now().to_rfc3339(),
    };
    write_state(&temp_dest, &state)?;

    if final_dest.exists() {
        fs::remove_dir_all(&final_dest)
            .map_err(|e| format!("既存プラグインの置き換えに失敗: {}", e))?;
    }
    fs::rename(&temp_dest, &final_dest)
        .map_err(|e| format!("プラグインのインストールに失敗: {}", e))?;

    installed_plugin_from_dir(&final_dest)
}

fn ensure_plugins_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("アプリ設定ディレクトリの取得に失敗: {}", e))?
        .join("plugins");
    fs::create_dir_all(&dir)
        .map_err(|e| format!("プラグインディレクトリの作成に失敗: {}", e))?;
    Ok(dir)
}

fn ensure_staging_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("アプリ設定ディレクトリの取得に失敗: {}", e))?
        .join(STAGING_DIR);
    fs::create_dir_all(&dir).map_err(|e| format!("一時ディレクトリの作成に失敗: {}", e))?;
    Ok(dir)
}

fn installed_plugin_from_dir(plugin_dir: &Path) -> Result<InstalledPlugin, String> {
    let manifest = read_manifest(plugin_dir)?;
    validate_manifest(&manifest)?;
    let state = read_state(plugin_dir);
    let entry = manifest.entry.as_deref().unwrap_or("index.js").to_string();
    let entry_path = plugin_dir.join(safe_relative_path(&entry)?);

    if !entry_path.is_file() {
        return Err(format!("エントリーファイルが見つかりません: {}", entry));
    }

    Ok(InstalledPlugin {
        id: normalize_plugin_id(&manifest.id)?,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        author: manifest.author,
        entry,
        homepage: manifest.homepage,
        capabilities: manifest.capabilities,
        min_stellar_version: manifest.min_stellar_version,
        enabled: state.enabled,
        installed_at: state.installed_at,
        path: plugin_dir.to_string_lossy().to_string(),
        entry_path: entry_path.to_string_lossy().to_string(),
        package_size_bytes: dir_size(plugin_dir),
    })
}

fn read_manifest(plugin_dir: &Path) -> Result<PluginManifest, String> {
    let manifest_path = plugin_dir.join(MANIFEST_FILE);
    let contents = fs::read_to_string(&manifest_path)
        .map_err(|e| format!("manifest の読み込みに失敗 ({}): {}", manifest_path.display(), e))?;
    serde_json::from_str(&contents)
        .map_err(|e| format!("manifest の形式が正しくありません ({}): {}", manifest_path.display(), e))
}

fn validate_manifest(manifest: &PluginManifest) -> Result<(), String> {
    normalize_plugin_id(&manifest.id)?;
    if manifest.name.trim().is_empty() {
        return Err("manifest の name が空です。".to_string());
    }

    let entry = manifest.entry.as_deref().unwrap_or("index.js");
    let entry_path = safe_relative_path(entry)?;
    let ext = entry_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_lowercase();
    if ext != "js" && ext != "mjs" {
        return Err("プラグインの entry は .js または .mjs にしてください。".to_string());
    }

    Ok(())
}

fn normalize_plugin_id(id: &str) -> Result<String, String> {
    let trimmed = id.trim();
    if trimmed.is_empty() {
        return Err("manifest の id が空です。".to_string());
    }
    if trimmed.len() > 80 {
        return Err("manifest の id が長すぎます。".to_string());
    }
    if !trimmed
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
    {
        return Err("manifest の id は英数字、ハイフン、アンダースコア、ドットのみ使用できます。".to_string());
    }
    Ok(trimmed.to_string())
}

fn safe_relative_path(value: &str) -> Result<PathBuf, String> {
    let path = Path::new(value);
    if path.is_absolute() {
        return Err("entry には相対パスを指定してください。".to_string());
    }

    let mut output = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Normal(part) => output.push(part),
            Component::CurDir => {}
            _ => {
                return Err("entry に親ディレクトリ参照や特殊なパスは使用できません。".to_string());
            }
        }
    }

    if output.as_os_str().is_empty() {
        return Err("entry が空です。".to_string());
    }
    Ok(output)
}

fn read_state(plugin_dir: &Path) -> PluginState {
    let path = plugin_dir.join(STATE_FILE);
    fs::read_to_string(&path)
        .ok()
        .and_then(|contents| serde_json::from_str::<PluginState>(&contents).ok())
        .unwrap_or_else(|| PluginState {
            enabled: true,
            installed_at: String::new(),
        })
}

fn write_state(plugin_dir: &Path, state: &PluginState) -> Result<(), String> {
    let path = plugin_dir.join(STATE_FILE);
    let contents = serde_json::to_string_pretty(state)
        .map_err(|e| format!("プラグイン状態の保存に失敗: {}", e))?;
    fs::write(&path, contents)
        .map_err(|e| format!("プラグイン状態の書き込みに失敗 ({}): {}", path.display(), e))
}

fn find_manifest_root(root: &Path) -> Result<PathBuf, String> {
    if root.join(MANIFEST_FILE).is_file() {
        return Ok(root.to_path_buf());
    }

    let mut matches = Vec::new();
    for entry in fs::read_dir(root).map_err(|e| format!("プラグインフォルダの読み込みに失敗: {}", e))? {
        let path = entry
            .map_err(|e| format!("プラグインフォルダの読み込みに失敗: {}", e))?
            .path();
        if path.is_dir() && path.join(MANIFEST_FILE).is_file() {
            matches.push(path);
        }
    }

    match matches.len() {
        1 => Ok(matches.remove(0)),
        0 => Err(format!("{} が見つかりません。", MANIFEST_FILE)),
        _ => Err(format!("{} が複数見つかりました。1つのプラグインだけを含めてください。", MANIFEST_FILE)),
    }
}

fn is_zip_like(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| {
            let lower = ext.to_lowercase();
            lower == "zip" || lower == "stellar-plugin"
        })
        .unwrap_or(false)
}

fn extract_zip(zip_path: &Path, dest: &Path) -> Result<(), String> {
    let file = File::open(zip_path)
        .map_err(|e| format!("ZIP ファイルを開けません ({}): {}", zip_path.display(), e))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|e| format!("ZIP ファイルの読み込みに失敗 ({}): {}", zip_path.display(), e))?;

    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|e| format!("ZIP エントリの読み込みに失敗: {}", e))?;
        let enclosed = entry
            .enclosed_name()
            .ok_or_else(|| "ZIP に安全ではないパスが含まれています。".to_string())?;
        let out_path = dest.join(enclosed);

        if entry.is_dir() {
            fs::create_dir_all(&out_path)
                .map_err(|e| format!("ZIP ディレクトリの展開に失敗: {}", e))?;
            continue;
        }

        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("ZIP 展開先ディレクトリの作成に失敗: {}", e))?;
        }
        let mut out_file = File::create(&out_path)
            .map_err(|e| format!("ZIP ファイルの展開に失敗 ({}): {}", out_path.display(), e))?;
        io::copy(&mut entry, &mut out_file)
            .map_err(|e| format!("ZIP ファイルの書き込みに失敗: {}", e))?;
    }

    Ok(())
}

fn copy_dir_all(src: &Path, dst: &Path) -> Result<(), String> {
    fs::create_dir_all(dst)
        .map_err(|e| format!("ディレクトリの作成に失敗 ({}): {}", dst.display(), e))?;

    for entry in fs::read_dir(src)
        .map_err(|e| format!("ディレクトリの読み込みに失敗 ({}): {}", src.display(), e))?
    {
        let entry = entry.map_err(|e| format!("ディレクトリエントリの読み込みに失敗: {}", e))?;
        let file_name = entry.file_name();
        if file_name == STATE_FILE {
            continue;
        }

        let src_path = entry.path();
        let dst_path = dst.join(&file_name);
        let file_type = entry
            .file_type()
            .map_err(|e| format!("ファイル種別の取得に失敗: {}", e))?;

        if file_type.is_symlink() {
            return Err("プラグインパッケージにシンボリックリンクは含められません。".to_string());
        }
        if file_type.is_dir() {
            copy_dir_all(&src_path, &dst_path)?;
        } else if file_type.is_file() {
            fs::copy(&src_path, &dst_path).map_err(|e| {
                format!(
                    "ファイルのコピーに失敗 ({} -> {}): {}",
                    src_path.display(),
                    dst_path.display(),
                    e
                )
            })?;
        }
    }

    Ok(())
}

fn dir_size(path: &Path) -> u64 {
    let mut total = 0;
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let entry_path = entry.path();
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_dir() {
                    total += dir_size(&entry_path);
                } else if metadata.is_file() {
                    total += metadata.len();
                }
            }
        }
    }
    total
}
