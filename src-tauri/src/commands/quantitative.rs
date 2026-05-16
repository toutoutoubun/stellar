// src-tauri/src/commands/quantitative.rs
// Stellar — 量的研究モジュール Tauri コマンド
// Quantitative Lab: データセット管理・変数定義・CSV インポート・
// 分析結果保存・トークン頻度・QDA 統合

use crate::db::get_pool;
use crate::db::models::*;
use crate::models::quantitative::*;
use sqlx::Row;
use std::collections::{HashMap, HashSet};
use tauri::AppHandle;

// ════════════════════════════════════════════════════════════════
// Dataset CRUD
// ════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn create_dataset(app: AppHandle, input: CreateDatasetInput) -> Result<Dataset, String> {
    let pool = get_pool(&app)?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO datasets (id, name, description, source_type, source_ref, row_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?)",
    )
    .bind(&id)
    .bind(&input.name)
    .bind(&input.description)
    .bind(&input.source_type)
    .bind(&input.source_ref)
    .bind(&now)
    .bind(&now)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("データセット作成に失敗: {}", e))?;

    Ok(Dataset {
        id,
        name: input.name,
        description: input.description,
        source_type: input.source_type,
        source_ref: input.source_ref,
        row_count: 0,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub async fn get_datasets(app: AppHandle) -> Result<Vec<Dataset>, String> {
    let pool = get_pool(&app)?;

    let rows = sqlx::query_as::<_, Dataset>(
        "SELECT id, name, description, source_type, source_ref, row_count, created_at, updated_at
         FROM datasets ORDER BY updated_at DESC",
    )
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("データセット一覧の取得に失敗: {}", e))?;

    Ok(rows)
}

#[tauri::command]
pub async fn get_dataset(app: AppHandle, id: String) -> Result<Dataset, String> {
    let pool = get_pool(&app)?;

    sqlx::query_as::<_, Dataset>(
        "SELECT id, name, description, source_type, source_ref, row_count, created_at, updated_at
         FROM datasets WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(pool.as_ref())
    .await
    .map_err(|e| format!("データセット取得に失敗: {}", e))?
    .ok_or_else(|| format!("データセットが見つかりません: {}", id))
}

#[tauri::command]
pub async fn update_dataset(
    app: AppHandle,
    id: String,
    name: String,
    description: Option<String>,
) -> Result<Dataset, String> {
    let pool = get_pool(&app)?;
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query("UPDATE datasets SET name = ?, description = ?, updated_at = ? WHERE id = ?")
        .bind(&name)
        .bind(&description)
        .bind(&now)
        .bind(&id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("データセット更新に失敗: {}", e))?;

    get_dataset(app, id).await
}

#[tauri::command]
pub async fn delete_dataset(app: AppHandle, id: String) -> Result<bool, String> {
    let pool = get_pool(&app)?;

    let result = sqlx::query("DELETE FROM datasets WHERE id = ?")
        .bind(&id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("データセット削除に失敗: {}", e))?;

    Ok(result.rows_affected() > 0)
}

// ════════════════════════════════════════════════════════════════
// Variable CRUD
// ════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn create_variable(
    app: AppHandle,
    input: CreateVariableInput,
) -> Result<Variable, String> {
    let pool = get_pool(&app)?;
    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO variables (id, dataset_id, column_index, name, label, var_type, unit, likert_min, likert_max, likert_labels)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&input.dataset_id)
    .bind(input.column_index)
    .bind(&input.name)
    .bind(&input.label)
    .bind(&input.var_type)
    .bind(&input.unit)
    .bind(input.likert_min)
    .bind(input.likert_max)
    .bind(&input.likert_labels)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("変数作成に失敗: {}", e))?;

    Ok(Variable {
        id,
        dataset_id: input.dataset_id,
        column_index: input.column_index,
        name: input.name,
        label: input.label,
        var_type: input.var_type,
        unit: input.unit,
        likert_min: input.likert_min,
        likert_max: input.likert_max,
        likert_labels: input.likert_labels,
    })
}

#[tauri::command]
pub async fn get_variables(app: AppHandle, dataset_id: String) -> Result<Vec<Variable>, String> {
    let pool = get_pool(&app)?;

    sqlx::query_as::<_, Variable>(
        "SELECT id, dataset_id, column_index, name, label, var_type, unit, likert_min, likert_max, likert_labels
         FROM variables WHERE dataset_id = ? ORDER BY column_index ASC",
    )
    .bind(&dataset_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("変数一覧の取得に失敗: {}", e))
}

#[tauri::command]
pub async fn update_variable(
    app: AppHandle,
    id: String,
    name: Option<String>,
    label: Option<String>,
    var_type: String,
    unit: Option<String>,
    likert_labels: Option<String>,
) -> Result<Variable, String> {
    let pool = get_pool(&app)?;

    sqlx::query(
        "UPDATE variables SET name = COALESCE(?, name), label = ?, var_type = ?, unit = ?, likert_labels = ? WHERE id = ?",
    )
    .bind(&name)
    .bind(&label)
    .bind(&var_type)
    .bind(&unit)
    .bind(&likert_labels)
    .bind(&id)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("変数更新に失敗: {}", e))?;

    sqlx::query_as::<_, Variable>(
        "SELECT id, dataset_id, column_index, name, label, var_type, unit, likert_min, likert_max, likert_labels
         FROM variables WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(pool.as_ref())
    .await
    .map_err(|e| format!("変数取得に失敗: {}", e))?
    .ok_or_else(|| format!("変数が見つかりません: {}", id))
}

#[tauri::command]
pub async fn delete_variable(app: AppHandle, id: String) -> Result<bool, String> {
    let pool = get_pool(&app)?;

    let result = sqlx::query("DELETE FROM variables WHERE id = ?")
        .bind(&id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("変数削除に失敗: {}", e))?;

    Ok(result.rows_affected() > 0)
}

/// 変数の型を自動検出する
/// ロジック:
/// - 値の 80% 以上が f64 にパース可能 → scale
/// - ユニーク値が 10 以下かつ非数値 → nominal
/// - 列名に「日付」「年」を含む → date
#[tauri::command]
pub async fn auto_detect_variable_types(
    app: AppHandle,
    dataset_id: String,
) -> Result<Vec<Variable>, String> {
    let pool = get_pool(&app)?;

    // 変数一覧を取得
    let variables = sqlx::query_as::<_, Variable>(
        "SELECT id, dataset_id, column_index, name, label, var_type, unit, likert_min, likert_max, likert_labels
         FROM variables WHERE dataset_id = ? ORDER BY column_index ASC",
    )
    .bind(&dataset_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("変数取得に失敗: {}", e))?;

    // 全データ行を取得
    let data_rows = sqlx::query_as::<_, DataRow>(
        "SELECT id, dataset_id, row_index, \"values\", created_at
         FROM data_rows WHERE dataset_id = ? ORDER BY row_index ASC",
    )
    .bind(&dataset_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("データ行取得に失敗: {}", e))?;

    if data_rows.is_empty() {
        return Ok(variables);
    }

    let mut updated_variables = Vec::new();

    for var in &variables {
        // 各変数の値を収集
        let mut values: Vec<String> = Vec::new();
        for dr in &data_rows {
            if let Ok(obj) = serde_json::from_str::<serde_json::Value>(&dr.values) {
                let value = obj
                    .get(&var.id)
                    .or_else(|| obj.get(&var.name))
                    .or_else(|| var.label.as_ref().and_then(|label| obj.get(label)));
                if let Some(val) = value {
                    let v = match val {
                        serde_json::Value::String(s) => s.clone(),
                        serde_json::Value::Number(n) => n.to_string(),
                        serde_json::Value::Null => String::new(),
                        other => other.to_string(),
                    };
                    if !v.trim().is_empty() {
                        values.push(v);
                    }
                }
            }
        }

        let detected_type = if values.is_empty() {
            "text".to_string()
        } else {
            // 列名で日付型を検出
            let name_lower = var.name.to_lowercase();
            if name_lower.contains("日付")
                || name_lower.contains("年")
                || name_lower.contains("date")
            {
                "date".to_string()
            } else {
                // 数値パース可能率を計算
                let numeric_count = values.iter().filter(|v| v.parse::<f64>().is_ok()).count();
                let numeric_ratio = numeric_count as f64 / values.len() as f64;

                if numeric_ratio >= 0.8 {
                    "scale".to_string()
                } else {
                    // ユニーク値数を確認
                    let unique: HashSet<&String> = values.iter().collect();
                    if unique.len() <= 10 {
                        "nominal".to_string()
                    } else {
                        "text".to_string()
                    }
                }
            }
        };

        // 型を更新
        sqlx::query("UPDATE variables SET var_type = ? WHERE id = ?")
            .bind(&detected_type)
            .bind(&var.id)
            .execute(pool.as_ref())
            .await
            .map_err(|e| format!("変数型更新に失敗: {}", e))?;

        updated_variables.push(Variable {
            id: var.id.clone(),
            dataset_id: var.dataset_id.clone(),
            column_index: var.column_index,
            name: var.name.clone(),
            label: var.label.clone(),
            var_type: detected_type,
            unit: var.unit.clone(),
            likert_min: var.likert_min,
            likert_max: var.likert_max,
            likert_labels: var.likert_labels.clone(),
        });
    }

    Ok(updated_variables)
}

// ════════════════════════════════════════════════════════════════
// Data Row CRUD
// ════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn insert_data_rows(
    app: AppHandle,
    dataset_id: String,
    rows: Vec<serde_json::Value>,
) -> Result<usize, String> {
    let pool = get_pool(&app)?;

    let variables = sqlx::query_as::<_, Variable>(
        "SELECT id, dataset_id, column_index, name, label, var_type, unit, likert_min, likert_max, likert_labels
         FROM variables WHERE dataset_id = ? ORDER BY column_index ASC",
    )
    .bind(&dataset_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("変数一覧の取得に失敗: {}", e))?;
    let variable_ids: HashSet<String> = variables.iter().map(|v| v.id.clone()).collect();
    let variable_id_by_name: HashMap<String, String> = variables
        .iter()
        .map(|v| (v.name.clone(), v.id.clone()))
        .collect();

    // 現在の最大 row_index を取得
    let max_row: i64 = sqlx::query(
        "SELECT COALESCE(MAX(row_index), -1) as max_idx FROM data_rows WHERE dataset_id = ?",
    )
    .bind(&dataset_id)
    .fetch_one(pool.as_ref())
    .await
    .map_err(|e| format!("最大行インデックス取得に失敗: {}", e))?
    .try_get::<i64, _>("max_idx")
    .unwrap_or(-1);

    let mut inserted = 0usize;
    for (i, row_value) in rows.iter().enumerate() {
        let id = uuid::Uuid::new_v4().to_string();
        let row_index = max_row + 1 + i as i64;
        let normalized_row = match row_value {
            serde_json::Value::Object(values) => {
                let mut normalized = serde_json::Map::new();
                for (key, value) in values {
                    let storage_key = if variable_ids.contains(key) {
                        key.clone()
                    } else {
                        variable_id_by_name
                            .get(key)
                            .cloned()
                            .unwrap_or_else(|| key.clone())
                    };
                    normalized.insert(storage_key, value.clone());
                }
                serde_json::Value::Object(normalized)
            }
            other => other.clone(),
        };
        let values_str = serde_json::to_string(&normalized_row)
            .map_err(|e| format!("JSON シリアライズに失敗: {}", e))?;

        sqlx::query(
            "INSERT INTO data_rows (id, dataset_id, row_index, \"values\") VALUES (?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&dataset_id)
        .bind(row_index)
        .bind(&values_str)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("データ行挿入に失敗 (行 {}): {}", row_index, e))?;

        inserted += 1;
    }

    Ok(inserted)
}

#[tauri::command]
pub async fn get_data_rows(
    app: AppHandle,
    dataset_id: String,
    offset: i64,
    limit: i64,
) -> Result<Vec<DataRow>, String> {
    let pool = get_pool(&app)?;

    sqlx::query_as::<_, DataRow>(
        "SELECT id, dataset_id, row_index, \"values\", created_at
         FROM data_rows WHERE dataset_id = ?
         ORDER BY row_index ASC
         LIMIT ? OFFSET ?",
    )
    .bind(&dataset_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("データ行取得に失敗: {}", e))
}

#[tauri::command]
pub async fn delete_data_rows(app: AppHandle, dataset_id: String) -> Result<bool, String> {
    let pool = get_pool(&app)?;

    let result = sqlx::query("DELETE FROM data_rows WHERE dataset_id = ?")
        .bind(&dataset_id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("データ行削除に失敗: {}", e))?;

    Ok(result.rows_affected() > 0)
}

// ════════════════════════════════════════════════════════════════
// CSV Import
// ════════════════════════════════════════════════════════════════

/// CSV テキストをパースしてデータセットにインポートする
/// UTF-8 / Shift-JIS のエンコーディング自動検出に対応
#[tauri::command]
pub async fn import_csv(app: AppHandle, input: ImportCsvInput) -> Result<ImportCsvResult, String> {
    let pool = get_pool(&app)?;
    let mut warnings: Vec<String> = Vec::new();

    // エンコーディング検出 — UTF-8 で失敗したら Shift-JIS を試みる
    let csv_text =
        if input.csv_text.is_ascii() || std::str::from_utf8(input.csv_text.as_bytes()).is_ok() {
            // 既に有効な UTF-8
            input.csv_text.clone()
        } else {
            // Shift-JIS (Windows-31J) としてデコードを試みる
            let (decoded, _, had_errors) = encoding_rs::SHIFT_JIS.decode(input.csv_text.as_bytes());
            if had_errors {
                warnings.push("エンコーディング変換中に一部文字が置換されました".to_string());
            }
            decoded.into_owned()
        };

    // デリミタ文字を取得
    let delimiter = if input.delimiter.is_empty() {
        b','
    } else {
        input.delimiter.as_bytes()[0]
    };

    // CSV パース
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(input.has_header)
        .delimiter(delimiter)
        .flexible(true)
        .from_reader(csv_text.as_bytes());

    // ヘッダー処理
    let headers: Vec<String> = if input.has_header {
        reader
            .headers()
            .map_err(|e| format!("CSV ヘッダー読み取りに失敗: {}", e))?
            .iter()
            .map(|h| h.to_string())
            .collect()
    } else {
        // ヘッダーなしの場合、最初のレコードから列数を推定して自動命名
        // peek できないので一旦全レコードを集める
        vec![]
    };

    // 全レコードを読み取り
    let mut records: Vec<csv::StringRecord> = Vec::new();
    for result in reader.records() {
        match result {
            Ok(record) => records.push(record),
            Err(e) => {
                warnings.push(format!(
                    "行 {} の読み取りをスキップ: {}",
                    records.len() + 1,
                    e
                ));
            }
        }
    }

    if records.is_empty() {
        return Err("CSV にデータ行がありません".to_string());
    }

    // ヘッダーなしの場合の列名生成
    let col_count = records.iter().map(|r| r.len()).max().unwrap_or(0);
    let final_headers: Vec<String> = if headers.is_empty() {
        (0..col_count)
            .map(|i| format!("column_{}", i + 1))
            .collect()
    } else {
        headers
    };

    // 既存変数をクリアして再作成
    sqlx::query("DELETE FROM variables WHERE dataset_id = ?")
        .bind(&input.dataset_id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("既存変数のクリアに失敗: {}", e))?;

    // 既存データ行もクリア
    sqlx::query("DELETE FROM data_rows WHERE dataset_id = ?")
        .bind(&input.dataset_id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("既存データ行のクリアに失敗: {}", e))?;

    // Variable レコードを作成
    let mut variable_ids: Vec<String> = Vec::new();
    for (col_idx, header) in final_headers.iter().enumerate() {
        let var_id = uuid::Uuid::new_v4().to_string();

        sqlx::query(
            "INSERT INTO variables (id, dataset_id, column_index, name, var_type)
             VALUES (?, ?, ?, ?, 'text')",
        )
        .bind(&var_id)
        .bind(&input.dataset_id)
        .bind(col_idx as i64)
        .bind(header)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("変数 '{}' の作成に失敗: {}", header, e))?;

        variable_ids.push(var_id);
    }

    // DataRow レコードを作成
    for (row_idx, record) in records.iter().enumerate() {
        let row_id = uuid::Uuid::new_v4().to_string();
        let mut values_map = serde_json::Map::new();

        for (col_idx, field) in record.iter().enumerate() {
            if col_idx < variable_ids.len() {
                values_map.insert(
                    variable_ids[col_idx].clone(),
                    serde_json::Value::String(field.to_string()),
                );
            }
        }

        // 列数が足りない場合は空文字列で補完
        for col_idx in record.len()..variable_ids.len() {
            values_map.insert(
                variable_ids[col_idx].clone(),
                serde_json::Value::String(String::new()),
            );
        }

        let values_json = serde_json::to_string(&serde_json::Value::Object(values_map))
            .map_err(|e| format!("JSON シリアライズに失敗: {}", e))?;

        sqlx::query(
            "INSERT INTO data_rows (id, dataset_id, row_index, \"values\") VALUES (?, ?, ?, ?)",
        )
        .bind(&row_id)
        .bind(&input.dataset_id)
        .bind(row_idx as i64)
        .bind(&values_json)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("データ行 {} の挿入に失敗: {}", row_idx, e))?;
    }

    // source_type を csv に更新
    sqlx::query(
        "UPDATE datasets SET source_type = 'csv', updated_at = datetime('now') WHERE id = ?",
    )
    .bind(&input.dataset_id)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("データセット更新に失敗: {}", e))?;

    Ok(ImportCsvResult {
        dataset_id: input.dataset_id,
        row_count: records.len(),
        variable_count: variable_ids.len(),
        warnings,
    })
}

// ════════════════════════════════════════════════════════════════
// Analysis CRUD
// ════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn save_analysis(app: AppHandle, input: SaveAnalysisInput) -> Result<Analysis, String> {
    let pool = get_pool(&app)?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO analyses (id, dataset_id, analysis_type, name, parameters, result, interpretation, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&input.dataset_id)
    .bind(&input.analysis_type)
    .bind(&input.name)
    .bind(&input.parameters)
    .bind(&input.result)
    .bind(&input.interpretation)
    .bind(&now)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("分析結果保存に失敗: {}", e))?;

    Ok(Analysis {
        id,
        dataset_id: input.dataset_id,
        analysis_type: input.analysis_type,
        name: input.name,
        parameters: input.parameters,
        result: input.result,
        interpretation: input.interpretation,
        created_at: now,
    })
}

#[tauri::command]
pub async fn get_analyses(app: AppHandle, dataset_id: String) -> Result<Vec<Analysis>, String> {
    let pool = get_pool(&app)?;

    sqlx::query_as::<_, Analysis>(
        "SELECT id, dataset_id, analysis_type, name, parameters, result, interpretation, created_at
         FROM analyses WHERE dataset_id = ? ORDER BY created_at DESC",
    )
    .bind(&dataset_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("分析一覧の取得に失敗: {}", e))
}

#[tauri::command]
pub async fn get_analysis(app: AppHandle, id: String) -> Result<Analysis, String> {
    let pool = get_pool(&app)?;

    sqlx::query_as::<_, Analysis>(
        "SELECT id, dataset_id, analysis_type, name, parameters, result, interpretation, created_at
         FROM analyses WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(pool.as_ref())
    .await
    .map_err(|e| format!("分析取得に失敗: {}", e))?
    .ok_or_else(|| format!("分析が見つかりません: {}", id))
}

#[tauri::command]
pub async fn delete_analysis(app: AppHandle, id: String) -> Result<bool, String> {
    let pool = get_pool(&app)?;

    let result = sqlx::query("DELETE FROM analyses WHERE id = ?")
        .bind(&id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("分析削除に失敗: {}", e))?;

    Ok(result.rows_affected() > 0)
}

// ════════════════════════════════════════════════════════════════
// Token Frequencies
// ════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn save_token_frequencies(
    app: AppHandle,
    input: SaveTokenFrequenciesInput,
) -> Result<usize, String> {
    let pool = get_pool(&app)?;

    // 既存のトークン頻度をクリア（同一 dataset_id + variable_id の組み合わせ）
    sqlx::query("DELETE FROM token_frequencies WHERE dataset_id = ? AND variable_id = ?")
        .bind(&input.dataset_id)
        .bind(&input.variable_id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("既存トークン頻度のクリアに失敗: {}", e))?;

    let mut inserted = 0usize;
    for item in &input.tokens {
        let id = uuid::Uuid::new_v4().to_string();

        sqlx::query(
            "INSERT INTO token_frequencies (id, dataset_id, variable_id, token, frequency, tf_idf, pos, document_count)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&input.dataset_id)
        .bind(&input.variable_id)
        .bind(&item.token)
        .bind(item.frequency)
        .bind(item.tf_idf)
        .bind(&item.pos)
        .bind(item.document_count)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("トークン '{}' の保存に失敗: {}", item.token, e))?;

        inserted += 1;
    }

    Ok(inserted)
}

#[tauri::command]
pub async fn get_token_frequencies(
    app: AppHandle,
    dataset_id: String,
    variable_id: String,
    limit: i64,
) -> Result<Vec<TokenFrequency>, String> {
    let pool = get_pool(&app)?;

    sqlx::query_as::<_, TokenFrequency>(
        "SELECT id, dataset_id, variable_id, token, frequency, tf_idf, pos, document_count
         FROM token_frequencies
         WHERE dataset_id = ? AND variable_id = ?
         ORDER BY frequency DESC
         LIMIT ?",
    )
    .bind(&dataset_id)
    .bind(&variable_id)
    .bind(limit)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("トークン頻度取得に失敗: {}", e))
}

// ════════════════════════════════════════════════════════════════
// QDA Integration — コードからデータセットを生成
// ════════════════════════════════════════════════════════════════

/// QDA プロジェクトのコーディングデータから量的データセットを生成する
/// 行 = ハイライト（セグメント）、列 = コード名（存在 0/1）
/// 追加列: document_id, text_length, segment_length（scale 変数）
#[tauri::command]
pub async fn create_dataset_from_codes(
    app: AppHandle,
    project_id: String,
    dataset_name: String,
) -> Result<Dataset, String> {
    let pool = get_pool(&app)?;

    // 1. プロジェクトに属するコード一覧を取得
    let code_rows =
        sqlx::query("SELECT id, name FROM codes WHERE project_id = ? ORDER BY sort_order ASC")
            .bind(&project_id)
            .fetch_all(pool.as_ref())
            .await
            .map_err(|e| format!("コード取得に失敗: {}", e))?;

    if code_rows.is_empty() {
        return Err("プロジェクトにコードが登録されていません".to_string());
    }

    let code_ids: Vec<String> = code_rows.iter().map(|r| col_str(r, "id")).collect();
    let code_names: Vec<String> = code_rows.iter().map(|r| col_str(r, "name")).collect();

    let mut tx = pool
        .begin()
        .await
        .map_err(|e| format!("トランザクション開始に失敗: {}", e))?;

    // 2. データセットを作成
    let ds_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO datasets (id, name, description, source_type, source_ref, row_count, created_at, updated_at)
         VALUES (?, ?, ?, 'from_codes', ?, 0, ?, ?)",
    )
    .bind(&ds_id)
    .bind(&dataset_name)
    .bind(format!("QDA プロジェクト {} からコーディングデータを変換", &project_id).as_str())
    .bind(&project_id)
    .bind(&now)
    .bind(&now)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("データセット作成に失敗: {}", e))?;

    // 3. 変数を作成: document_id, text_length, segment_length + 各コード（0/1）
    let mut variable_ids: Vec<String> = Vec::new();
    let meta_vars = vec![
        ("document_id", "nominal", "文書ID"),
        ("text_length", "scale", "テキスト長（文字数）"),
        ("segment_length", "scale", "セグメント長（文字数）"),
    ];

    for (col_idx, (name, var_type, label)) in meta_vars.iter().enumerate() {
        let var_id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO variables (id, dataset_id, column_index, name, label, var_type)
             VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(&var_id)
        .bind(&ds_id)
        .bind(col_idx as i64)
        .bind(name)
        .bind(label)
        .bind(var_type)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("メタ変数 '{}' の作成に失敗: {}", name, e))?;
        variable_ids.push(var_id);
    }

    // コード変数
    let mut code_var_ids: Vec<String> = Vec::new();
    for (i, code_name) in code_names.iter().enumerate() {
        let var_id = uuid::Uuid::new_v4().to_string();
        let col_idx = meta_vars.len() + i;
        sqlx::query(
            "INSERT INTO variables (id, dataset_id, column_index, name, label, var_type)
             VALUES (?, ?, ?, ?, ?, 'nominal')",
        )
        .bind(&var_id)
        .bind(&ds_id)
        .bind(col_idx as i64)
        .bind(code_name)
        .bind(format!("コード: {}", code_name).as_str())
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("コード変数 '{}' の作成に失敗: {}", code_name, e))?;
        code_var_ids.push(var_id);
    }

    // 4. highlight_codes からコーディングされたハイライトを取得
    let highlights = sqlx::query(
        "SELECT DISTINCT h.id, h.paper_id, h.text, h.page
         FROM highlights h
         JOIN highlight_codes hc ON hc.highlight_id = h.id
         JOIN codes c ON c.id = hc.code_id AND c.project_id = ?
         ORDER BY h.paper_id, h.page, h.id",
    )
    .bind(&project_id)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| format!("ハイライト取得に失敗: {}", e))?;

    // 5. 各ハイライトについてコード割り当てを取得してデータ行を生成
    for (row_idx, highlight) in highlights.iter().enumerate() {
        let h_id = col_str(highlight, "id");
        let paper_id = col_str(highlight, "paper_id");
        let text = col_str(highlight, "text");

        // このハイライトに割り当てられたコードID集合を取得
        let assigned_rows =
            sqlx::query("SELECT code_id FROM highlight_codes WHERE highlight_id = ?")
                .bind(&h_id)
                .fetch_all(&mut *tx)
                .await
                .map_err(|e| format!("コード割り当て取得に失敗: {}", e))?;

        let assigned_code_ids: HashSet<String> = assigned_rows
            .iter()
            .map(|r| col_str(r, "code_id"))
            .collect();

        // values マップを構築
        let mut values_map = serde_json::Map::new();

        // メタ変数
        values_map.insert(variable_ids[0].clone(), serde_json::Value::String(paper_id));
        values_map.insert(
            variable_ids[1].clone(),
            serde_json::Value::String(text.len().to_string()),
        );
        values_map.insert(
            variable_ids[2].clone(),
            serde_json::Value::String(text.len().to_string()),
        );

        // コード変数（0/1）
        for (i, code_id) in code_ids.iter().enumerate() {
            let presence = if assigned_code_ids.contains(code_id) {
                "1"
            } else {
                "0"
            };
            values_map.insert(
                code_var_ids[i].clone(),
                serde_json::Value::String(presence.to_string()),
            );
        }

        let row_id = uuid::Uuid::new_v4().to_string();
        let values_json = serde_json::to_string(&serde_json::Value::Object(values_map))
            .map_err(|e| format!("JSON シリアライズに失敗: {}", e))?;

        sqlx::query(
            "INSERT INTO data_rows (id, dataset_id, row_index, \"values\") VALUES (?, ?, ?, ?)",
        )
        .bind(&row_id)
        .bind(&ds_id)
        .bind(row_idx as i64)
        .bind(&values_json)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("データ行挿入に失敗: {}", e))?;
    }

    // 結果を返す
    let dataset = sqlx::query_as::<_, Dataset>(
        "SELECT id, name, description, source_type, source_ref, row_count, created_at, updated_at
         FROM datasets WHERE id = ?",
    )
    .bind(&ds_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| format!("データセット取得に失敗: {}", e))?;

    tx.commit()
        .await
        .map_err(|e| format!("トランザクション確定に失敗: {}", e))?;

    Ok(dataset)
}

// ════════════════════════════════════════════════════════════════
// QDA Integration — ハイライトからデータセットを生成
// ════════════════════════════════════════════════════════════════

/// ハイライトテーブルから量的データセットを生成する
/// 列: paper_id(nominal), color(nominal), page(scale), text_length(scale), comment(text)
#[tauri::command]
pub async fn create_dataset_from_highlights(
    app: AppHandle,
    paper_id: Option<String>,
) -> Result<Dataset, String> {
    let pool = get_pool(&app)?;

    // 1. データセットを作成
    let ds_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let ds_name = match &paper_id {
        Some(pid) => format!("ハイライト (論文: {})", pid),
        None => "全ハイライト".to_string(),
    };
    let source_ref = paper_id.clone();

    // 先にハイライトを確認する。0件のときに空データセットを残すと、
    // UI 側の再試行や一覧描画が壊れた状態を引きずってしまう。
    let highlights = if let Some(ref pid) = paper_id {
        sqlx::query(
            "SELECT id, paper_id, text, comment, color, page FROM highlights WHERE paper_id = ? ORDER BY page ASC, id ASC",
        )
        .bind(pid)
        .fetch_all(pool.as_ref())
        .await
        .map_err(|e| format!("ハイライト取得に失敗: {}", e))?
    } else {
        sqlx::query(
            "SELECT id, paper_id, text, comment, color, page FROM highlights ORDER BY paper_id ASC, page ASC, id ASC",
        )
        .fetch_all(pool.as_ref())
        .await
        .map_err(|e| format!("ハイライト取得に失敗: {}", e))?
    };

    if highlights.is_empty() {
        return Err("この論文にはデータセット化できるハイライトがありません".to_string());
    }

    let mut tx = pool
        .begin()
        .await
        .map_err(|e| format!("トランザクション開始に失敗: {}", e))?;

    sqlx::query(
        "INSERT INTO datasets (id, name, description, source_type, source_ref, row_count, created_at, updated_at)
         VALUES (?, ?, 'ハイライトデータから自動生成', 'from_highlights', ?, 0, ?, ?)",
    )
    .bind(&ds_id)
    .bind(&ds_name)
    .bind(&source_ref)
    .bind(&now)
    .bind(&now)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("データセット作成に失敗: {}", e))?;

    // 2. 変数を定義
    let var_defs = vec![
        ("paper_id", "nominal", "論文ID"),
        ("color", "nominal", "ハイライト色"),
        ("page", "scale", "ページ番号"),
        ("text_length", "scale", "テキスト長（文字数）"),
        ("comment", "text", "コメント"),
    ];

    let mut variable_ids: Vec<String> = Vec::new();
    for (col_idx, (name, var_type, label)) in var_defs.iter().enumerate() {
        let var_id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO variables (id, dataset_id, column_index, name, label, var_type)
             VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(&var_id)
        .bind(&ds_id)
        .bind(col_idx as i64)
        .bind(name)
        .bind(label)
        .bind(var_type)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("変数 '{}' の作成に失敗: {}", name, e))?;
        variable_ids.push(var_id);
    }

    // 3. データ行を作成
    for (row_idx, h) in highlights.iter().enumerate() {
        let h_paper_id = col_str(h, "paper_id");
        let text = col_str(h, "text");
        let comment: Option<String> = h.try_get::<Option<String>, _>("comment").unwrap_or(None);
        let color = col_str(h, "color");
        let page: i32 = h.try_get("page").unwrap_or(0);

        let mut values_map = serde_json::Map::new();
        values_map.insert(
            variable_ids[0].clone(),
            serde_json::Value::String(h_paper_id),
        );
        values_map.insert(variable_ids[1].clone(), serde_json::Value::String(color));
        values_map.insert(
            variable_ids[2].clone(),
            serde_json::Value::String(page.to_string()),
        );
        values_map.insert(
            variable_ids[3].clone(),
            serde_json::Value::String(text.len().to_string()),
        );
        values_map.insert(
            variable_ids[4].clone(),
            serde_json::Value::String(comment.unwrap_or_default()),
        );

        let row_id = uuid::Uuid::new_v4().to_string();
        let values_json = serde_json::to_string(&serde_json::Value::Object(values_map))
            .map_err(|e| format!("JSON シリアライズに失敗: {}", e))?;

        sqlx::query(
            "INSERT INTO data_rows (id, dataset_id, row_index, \"values\") VALUES (?, ?, ?, ?)",
        )
        .bind(&row_id)
        .bind(&ds_id)
        .bind(row_idx as i64)
        .bind(&values_json)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("データ行挿入に失敗: {}", e))?;
    }

    // 結果を返す
    let dataset = sqlx::query_as::<_, Dataset>(
        "SELECT id, name, description, source_type, source_ref, row_count, created_at, updated_at
         FROM datasets WHERE id = ?",
    )
    .bind(&ds_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| format!("データセット取得に失敗: {}", e))?;

    tx.commit()
        .await
        .map_err(|e| format!("トランザクション確定に失敗: {}", e))?;

    Ok(dataset)
}
