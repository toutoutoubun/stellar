// src-tauri/src/commands/qualitative.rs
// Stellar — 質的研究モジュール Tauri コマンド
// CAQDAS + 歴史・政治研究ツール: プロジェクト管理・コーディング・ICR・
// 史料批判・タイムライン・アクターマップ・プロセストレーシング・
// 比較ケース設計・フレーミング分析・レポート生成

use crate::db::{get_pool, models::*};
use crate::utils::text::{normalize_nfc, normalize_nfc_trimmed, normalize_opt_nfc};
use sqlx::Row;
use std::{collections::HashMap, fs::File, io::Read, path::Path};
use tauri::AppHandle;

// ════════════════════════════════════════════════════════════════
// プロジェクト管理
// ════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn create_project(
    app: AppHandle,
    input: CreateProjectDto,
) -> Result<ProjectResponse, String> {
    let pool = get_pool(&app)?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let name = normalize_nfc(&input.name);
    let description = normalize_opt_nfc(input.description);

    sqlx::query(
        "INSERT INTO projects (id, name, description, method_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&name)
    .bind(&description)
    .bind(&input.method_type)
    .bind(&now)
    .bind(&now)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("プロジェクト作成に失敗: {}", e))?;

    Ok(ProjectResponse {
        id,
        name,
        description,
        method_type: input.method_type,
        created_at: now.clone(),
        updated_at: Some(now),
    })
}

#[tauri::command]
pub async fn get_projects(app: AppHandle) -> Result<Vec<ProjectResponse>, String> {
    let pool = get_pool(&app)?;
    let rows = sqlx::query("SELECT * FROM projects ORDER BY updated_at DESC")
        .fetch_all(pool.as_ref())
        .await
        .map_err(|e| format!("プロジェクト一覧の取得に失敗: {}", e))?;

    rows.iter().map(parse_project).collect()
}

#[tauri::command]
pub async fn update_project(
    app: AppHandle,
    id: String,
    input: UpdateProjectDto,
) -> Result<ProjectResponse, String> {
    let pool = get_pool(&app)?;
    let now = chrono::Utc::now().to_rfc3339();

    let row = sqlx::query("SELECT * FROM projects WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.as_ref())
        .await
        .map_err(|e| format!("プロジェクト取得に失敗: {}", e))?
        .ok_or_else(|| format!("プロジェクトが見つかりません: {}", id))?;

    let current = parse_project(&row)?;
    let name = normalize_nfc(&input.name.unwrap_or(current.name));
    let description = normalize_opt_nfc(input.description.or(current.description));
    let method_type = input.method_type.unwrap_or(current.method_type);

    sqlx::query("UPDATE projects SET name = ?, description = ?, method_type = ?, updated_at = ? WHERE id = ?")
        .bind(&name)
        .bind(&description)
        .bind(&method_type)
        .bind(&now)
        .bind(&id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("プロジェクト更新に失敗: {}", e))?;

    Ok(ProjectResponse {
        id,
        name,
        description,
        method_type,
        created_at: current.created_at,
        updated_at: Some(now),
    })
}

#[tauri::command]
pub async fn delete_project(app: AppHandle, id: String) -> Result<(), String> {
    let pool = get_pool(&app)?;
    sqlx::query("DELETE FROM projects WHERE id = ?")
        .bind(&id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("プロジェクト削除に失敗: {}", e))?;
    Ok(())
}

// ════════════════════════════════════════════════════════════════
// 分析ソース（質的分析専用）
// ════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn get_qualitative_sources(
    app: AppHandle,
    project_id: String,
) -> Result<Vec<QualitativeSourceResponse>, String> {
    let pool = get_pool(&app)?;
    let rows = sqlx::query(
        "SELECT * FROM qualitative_sources WHERE project_id = ? ORDER BY updated_at DESC, title ASC",
    )
    .bind(&project_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("分析ソース一覧の取得に失敗: {}", e))?;

    rows.iter().map(parse_qualitative_source).collect()
}

#[tauri::command]
pub async fn get_qualitative_source(
    app: AppHandle,
    id: String,
) -> Result<QualitativeSourceResponse, String> {
    let pool = get_pool(&app)?;
    let row = sqlx::query("SELECT * FROM qualitative_sources WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.as_ref())
        .await
        .map_err(|e| format!("分析ソース取得に失敗: {}", e))?
        .ok_or_else(|| format!("分析ソースが見つかりません: {}", id))?;

    parse_qualitative_source(&row)
}

#[tauri::command]
pub async fn import_qualitative_source(
    app: AppHandle,
    input: ImportQualitativeSourceDto,
) -> Result<QualitativeSourceResponse, String> {
    let pool = get_pool(&app)?;
    let path = Path::new(&input.file_path);
    let file_type = path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    let content = match extract_source_text(&input.file_path, &file_type) {
        Ok(text) => text,
        Err(err) if file_type == "pdf" => {
            eprintln!(
                "[qualitative] PDF text extraction failed for {}: {}",
                input.file_path, err
            );
            String::new()
        }
        Err(err) => return Err(err),
    };
    let title = input.title.unwrap_or_else(|| {
        path.file_stem()
            .and_then(|name| name.to_str())
            .unwrap_or("Untitled source")
            .replace('_', " ")
            .replace('-', " ")
    });
    let title = normalize_nfc(&title);
    let content = normalize_nfc(&content);
    let source_type = input
        .source_type
        .unwrap_or_else(|| "primary_source".to_string());
    let word_count = count_words(&content);
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO qualitative_sources (id, project_id, title, source_type, file_type, file_path, content, word_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&input.project_id)
    .bind(&title)
    .bind(&source_type)
    .bind(&file_type)
    .bind(&input.file_path)
    .bind(&content)
    .bind(word_count)
    .bind(&now)
    .bind(&now)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("分析ソースの取り込みに失敗: {}", e))?;

    Ok(QualitativeSourceResponse {
        id,
        project_id: input.project_id,
        title,
        source_type,
        file_type,
        file_path: Some(input.file_path),
        content,
        word_count,
        created_at: now.clone(),
        updated_at: Some(now),
    })
}

#[tauri::command]
pub async fn update_qualitative_source(
    app: AppHandle,
    id: String,
    input: UpdateQualitativeSourceDto,
) -> Result<QualitativeSourceResponse, String> {
    let pool = get_pool(&app)?;
    let row = sqlx::query("SELECT * FROM qualitative_sources WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.as_ref())
        .await
        .map_err(|e| format!("分析ソース取得に失敗: {}", e))?
        .ok_or_else(|| format!("分析ソースが見つかりません: {}", id))?;

    let current = parse_qualitative_source(&row)?;
    let title = normalize_nfc(&input.title.unwrap_or(current.title));
    let source_type = input.source_type.unwrap_or(current.source_type);
    let content = normalize_nfc(&input.content.unwrap_or(current.content));
    let word_count = count_words(&content);
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "UPDATE qualitative_sources SET title = ?, source_type = ?, content = ?, word_count = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&title)
    .bind(&source_type)
    .bind(&content)
    .bind(word_count)
    .bind(&now)
    .bind(&id)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("分析ソース更新に失敗: {}", e))?;

    get_qualitative_source(app, id).await
}

#[tauri::command]
pub async fn delete_qualitative_source(app: AppHandle, id: String) -> Result<(), String> {
    let pool = get_pool(&app)?;
    sqlx::query("DELETE FROM qualitative_sources WHERE id = ?")
        .bind(&id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("分析ソース削除に失敗: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn assign_code_to_source_segment(
    app: AppHandle,
    input: CreateSourceSegmentCodeDto,
) -> Result<SourceSegmentCodeResponse, String> {
    let segment_text = normalize_nfc_trimmed(&input.segment_text);
    if segment_text.is_empty() {
        return Err("コード化するテキストを選択してください".to_string());
    }
    let memo = normalize_opt_nfc(input.memo);

    let pool = get_pool(&app)?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO source_segment_codes (id, source_id, code_id, segment_text, offset_start, offset_end, memo, assigned_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&input.source_id)
    .bind(&input.code_id)
    .bind(&segment_text)
    .bind(input.offset_start)
    .bind(input.offset_end)
    .bind(&memo)
    .bind(&now)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("分析ソースセグメントへのコード付与に失敗: {}", e))?;

    let row = sqlx::query(
        "SELECT ssc.*, qs.title as source_title
         FROM source_segment_codes ssc
         JOIN qualitative_sources qs ON qs.id = ssc.source_id
         WHERE ssc.id = ?",
    )
    .bind(&id)
    .fetch_one(pool.as_ref())
    .await
    .map_err(|e| format!("コード化セグメント取得に失敗: {}", e))?;

    parse_source_segment_code(&row)
}

#[tauri::command]
pub async fn get_source_segments(
    app: AppHandle,
    source_id: String,
) -> Result<Vec<SourceSegmentCodeResponse>, String> {
    let pool = get_pool(&app)?;
    let rows = sqlx::query(
        "SELECT ssc.*, qs.title as source_title
         FROM source_segment_codes ssc
         JOIN qualitative_sources qs ON qs.id = ssc.source_id
         WHERE ssc.source_id = ?
         ORDER BY COALESCE(ssc.offset_start, 2147483647) ASC, ssc.assigned_at ASC",
    )
    .bind(&source_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("コード化セグメント一覧の取得に失敗: {}", e))?;

    rows.iter().map(parse_source_segment_code).collect()
}

#[tauri::command]
pub async fn get_source_segments_by_code(
    app: AppHandle,
    code_id: String,
) -> Result<Vec<SourceSegmentCodeResponse>, String> {
    let pool = get_pool(&app)?;
    let rows = sqlx::query(
        "SELECT ssc.*, qs.title as source_title
         FROM source_segment_codes ssc
         JOIN qualitative_sources qs ON qs.id = ssc.source_id
         WHERE ssc.code_id = ?
         ORDER BY qs.title ASC, COALESCE(ssc.offset_start, 2147483647) ASC, ssc.assigned_at ASC",
    )
    .bind(&code_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("コード別分析ソースセグメント取得に失敗: {}", e))?;

    rows.iter().map(parse_source_segment_code).collect()
}

#[tauri::command]
pub async fn delete_source_segment_code(app: AppHandle, id: String) -> Result<(), String> {
    let pool = get_pool(&app)?;
    sqlx::query("DELETE FROM source_segment_codes WHERE id = ?")
        .bind(&id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("分析ソースセグメントのコード解除に失敗: {}", e))?;
    Ok(())
}

// ════════════════════════════════════════════════════════════════
// コーディング
// ════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn get_code_tree(app: AppHandle, project_id: String) -> Result<Vec<CodeNode>, String> {
    let pool = get_pool(&app)?;

    // 全コードを取得
    let rows = sqlx::query(
        "SELECT c.*, (
            SELECT COUNT(*) FROM highlight_codes hc WHERE hc.code_id = c.id
        ) + (
            SELECT COUNT(*) FROM note_segment_codes nsc WHERE nsc.code_id = c.id
        ) + (
            SELECT COUNT(*) FROM source_segment_codes ssc WHERE ssc.code_id = c.id
        ) + (
            SELECT COUNT(*) FROM source_highlight_codes shc WHERE shc.code_id = c.id
        ) as assignment_count
        FROM codes c WHERE c.project_id = ? ORDER BY c.sort_order ASC, c.name ASC",
    )
    .bind(&project_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("コードツリーの取得に失敗: {}", e))?;

    let mut codes: Vec<(CodeResponse, u32)> = Vec::new();
    for row in &rows {
        let code = parse_code(row)?;
        let count: i64 = row.try_get("assignment_count").unwrap_or(0);
        codes.push((code, count as u32));
    }

    // ツリー構造を構築
    fn build_tree(codes: &[(CodeResponse, u32)], parent_id: Option<&str>) -> Vec<CodeNode> {
        codes
            .iter()
            .filter(|(c, _)| c.parent_id.as_deref() == parent_id)
            .map(|(c, count)| {
                let children = build_tree(codes, Some(&c.id));
                CodeNode {
                    code: c.clone(),
                    children,
                    assignment_count: *count,
                }
            })
            .collect()
    }

    Ok(build_tree(&codes, None))
}

#[tauri::command]
pub async fn create_code(app: AppHandle, input: CreateCodeDto) -> Result<CodeResponse, String> {
    let pool = get_pool(&app)?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let name = normalize_nfc(&input.name);
    let description = normalize_opt_nfc(input.description);

    sqlx::query(
        "INSERT INTO codes (id, project_id, parent_id, name, description, color, code_type, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&input.project_id)
    .bind(&input.parent_id)
    .bind(&name)
    .bind(&description)
    .bind(&input.color)
    .bind(&input.code_type)
    .bind(input.sort_order)
    .bind(&now)
    .bind(&now)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("コード作成に失敗: {}", e))?;

    Ok(CodeResponse {
        id,
        project_id: input.project_id,
        parent_id: input.parent_id,
        name,
        description,
        color: input.color,
        code_type: input.code_type,
        sort_order: input.sort_order,
        created_at: now.clone(),
        updated_at: Some(now),
    })
}

#[tauri::command]
pub async fn update_code(
    app: AppHandle,
    id: String,
    input: UpdateCodeDto,
) -> Result<CodeResponse, String> {
    let pool = get_pool(&app)?;
    let now = chrono::Utc::now().to_rfc3339();

    let row = sqlx::query("SELECT * FROM codes WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.as_ref())
        .await
        .map_err(|e| format!("コード取得に失敗: {}", e))?
        .ok_or_else(|| format!("コードが見つかりません: {}", id))?;

    let current = parse_code(&row)?;
    let name = normalize_nfc(&input.name.unwrap_or(current.name));
    let description = normalize_opt_nfc(input.description.or(current.description));
    let color = input.color.unwrap_or(current.color);
    let code_type = input.code_type.unwrap_or(current.code_type);
    let parent_id = match input.parent_id {
        Some(p) => p,
        None => current.parent_id,
    };
    let sort_order = input.sort_order.unwrap_or(current.sort_order);

    sqlx::query(
        "UPDATE codes SET name = ?, description = ?, color = ?, code_type = ?, parent_id = ?, sort_order = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&name)
    .bind(&description)
    .bind(&color)
    .bind(&code_type)
    .bind(&parent_id)
    .bind(sort_order)
    .bind(&now)
    .bind(&id)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("コード更新に失敗: {}", e))?;

    Ok(CodeResponse {
        id,
        project_id: current.project_id,
        parent_id,
        name,
        description,
        color,
        code_type,
        sort_order,
        created_at: current.created_at,
        updated_at: Some(now),
    })
}

#[tauri::command]
pub async fn delete_code(app: AppHandle, id: String) -> Result<(), String> {
    let pool = get_pool(&app)?;
    sqlx::query("DELETE FROM codes WHERE id = ?")
        .bind(&id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("コード削除に失敗: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn assign_code_to_highlight(
    app: AppHandle,
    highlight_id: String,
    code_id: String,
) -> Result<(), String> {
    let pool = get_pool(&app)?;
    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT OR IGNORE INTO highlight_codes (id, highlight_id, code_id, assigned_at) VALUES (?, ?, ?, datetime('now'))",
    )
    .bind(&id)
    .bind(&highlight_id)
    .bind(&code_id)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("コード割り当てに失敗: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn remove_code_from_highlight(
    app: AppHandle,
    highlight_id: String,
    code_id: String,
) -> Result<(), String> {
    let pool = get_pool(&app)?;
    sqlx::query("DELETE FROM highlight_codes WHERE highlight_id = ? AND code_id = ?")
        .bind(&highlight_id)
        .bind(&code_id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("コード割り当て解除に失敗: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn get_highlights_by_code(
    app: AppHandle,
    code_id: String,
) -> Result<Vec<HighlightWithContext>, String> {
    let pool = get_pool(&app)?;

    let rows = sqlx::query(
        "SELECT h.id, h.paper_id, h.text, h.comment, h.color, h.page, h.created_at, p.title as paper_title
         FROM highlight_codes hc
         JOIN highlights h ON h.id = hc.highlight_id
         JOIN papers p ON p.id = h.paper_id
         WHERE hc.code_id = ?
         ORDER BY p.title ASC, h.page ASC",
    )
    .bind(&code_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("コード別ハイライト取得に失敗: {}", e))?;

    let mut result: Vec<HighlightWithContext> = rows
        .iter()
        .map(|row| {
            Ok(HighlightWithContext {
                id: col_str(row, "id"),
                paper_id: col_str(row, "paper_id"),
                text: col_str(row, "text"),
                comment: col_opt_str(row, "comment"),
                color: col_str(row, "color"),
                page: col_i32(row, "page"),
                paper_title: col_str(row, "paper_title"),
                created_at: col_str(row, "created_at"),
            })
        })
        .collect::<Result<Vec<_>, String>>()?;

    let source_rows = sqlx::query(
        "SELECT h.id, h.source_id, h.text, h.comment, h.color, h.page, h.created_at, qs.title as source_title
         FROM source_highlight_codes shc
         JOIN qualitative_source_highlights h ON h.id = shc.source_highlight_id
         JOIN qualitative_sources qs ON qs.id = h.source_id
         JOIN codes c ON c.id = shc.code_id
         WHERE shc.code_id = ?
         ORDER BY qs.title ASC, h.page ASC",
    )
    .bind(&code_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("コード別分析ソースハイライト取得に失敗: {}", e))?;

    for row in &source_rows {
        result.push(HighlightWithContext {
            id: col_str(row, "id"),
            paper_id: col_str(row, "source_id"),
            text: col_str(row, "text"),
            comment: col_opt_str(row, "comment"),
            color: col_str(row, "color"),
            page: col_i32(row, "page"),
            paper_title: format!("{} · 分析ソース", col_str(row, "source_title")),
            created_at: col_str(row, "created_at"),
        });
    }

    Ok(result)
}

// ════════════════════════════════════════════════════════════════
// コーディングマトリクス
// ════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn get_coding_matrix(app: AppHandle, project_id: String) -> Result<CodingMatrix, String> {
    let pool = get_pool(&app)?;

    // コード一覧（行）
    let code_rows = sqlx::query(
        "SELECT id, name, color FROM codes WHERE project_id = ? ORDER BY sort_order ASC",
    )
    .bind(&project_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("コード取得に失敗: {}", e))?;

    let rows: Vec<CodingMatrixRow> = code_rows
        .iter()
        .map(|r| CodingMatrixRow {
            code_id: col_str(r, "id"),
            code_name: col_str(r, "name"),
            code_color: col_str(r, "color"),
        })
        .collect();

    // 分析ソース一覧（列）— コードが割り当てられている分析ソースのみ
    let source_rows = sqlx::query(
        "SELECT DISTINCT qs.id, qs.title FROM qualitative_sources qs
         WHERE qs.project_id = ?
           AND (
             EXISTS (
               SELECT 1 FROM source_segment_codes ssc
               JOIN codes c ON c.id = ssc.code_id AND c.project_id = ?
               WHERE ssc.source_id = qs.id
             )
             OR EXISTS (
               SELECT 1 FROM qualitative_source_highlights qsh
               JOIN source_highlight_codes shc ON shc.source_highlight_id = qsh.id
               JOIN codes c ON c.id = shc.code_id AND c.project_id = ?
               WHERE qsh.source_id = qs.id
             )
           )
         ORDER BY qs.title ASC",
    )
    .bind(&project_id)
    .bind(&project_id)
    .bind(&project_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("分析ソース取得に失敗: {}", e))?;

    let cols: Vec<CodingMatrixCol> = source_rows
        .iter()
        .map(|r| CodingMatrixCol {
            paper_id: col_str(r, "id"),
            paper_title: col_str(r, "title"),
        })
        .collect();

    // セル（code_id:source_id → count）
    let cell_rows = sqlx::query(
        "SELECT ssc.code_id, ssc.source_id, COUNT(*) as cnt
         FROM source_segment_codes ssc
         JOIN qualitative_sources qs ON qs.id = ssc.source_id
         JOIN codes c ON c.id = ssc.code_id AND c.project_id = ?
         WHERE qs.project_id = ?
         GROUP BY ssc.code_id, ssc.source_id",
    )
    .bind(&project_id)
    .bind(&project_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("マトリクスセル取得に失敗: {}", e))?;

    let mut cells: HashMap<String, u32> = HashMap::new();
    for row in &cell_rows {
        let key = format!("{}:{}", col_str(row, "code_id"), col_str(row, "source_id"));
        let cnt: i64 = row.try_get("cnt").unwrap_or(0);
        cells.insert(key, cnt as u32);
    }

    let source_highlight_cell_rows = sqlx::query(
        "SELECT shc.code_id, qsh.source_id, COUNT(*) as cnt
         FROM source_highlight_codes shc
         JOIN qualitative_source_highlights qsh ON qsh.id = shc.source_highlight_id
         JOIN qualitative_sources qs ON qs.id = qsh.source_id
         JOIN codes c ON c.id = shc.code_id AND c.project_id = ?
         WHERE qs.project_id = ?
         GROUP BY shc.code_id, qsh.source_id",
    )
    .bind(&project_id)
    .bind(&project_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("PDFハイライト由来マトリクスセル取得に失敗: {}", e))?;

    for row in &source_highlight_cell_rows {
        let key = format!("{}:{}", col_str(row, "code_id"), col_str(row, "source_id"));
        let cnt: i64 = row.try_get("cnt").unwrap_or(0);
        cells
            .entry(key)
            .and_modify(|value| *value += cnt as u32)
            .or_insert(cnt as u32);
    }

    Ok(CodingMatrix { rows, cols, cells })
}

// ════════════════════════════════════════════════════════════════
// ICR（インターコーダー信頼性）— Cohen's κ
// ════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn calculate_icr(
    app: AppHandle,
    project_id: String,
    imported_codings: Vec<ImportedCoding>,
) -> Result<IcrResult, String> {
    let pool = get_pool(&app)?;

    // メインコーダーのコーディングを取得
    let main_rows = sqlx::query(
        "SELECT hc.highlight_id, hc.code_id
         FROM highlight_codes hc
         JOIN codes c ON c.id = hc.code_id AND c.project_id = ?",
    )
    .bind(&project_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("メインコーディング取得に失敗: {}", e))?;

    // メインコーダーのマップ: highlight_id → Set<code_id>
    let mut main_map: HashMap<String, Vec<String>> = HashMap::new();
    for row in &main_rows {
        let hid = col_str(row, "highlight_id");
        let cid = col_str(row, "code_id");
        main_map.entry(hid).or_default().push(cid);
    }

    // インポートされたコーダーのマップ
    let mut imported_map: HashMap<String, Vec<String>> = HashMap::new();
    for ic in &imported_codings {
        imported_map.insert(ic.highlight_id.clone(), ic.code_ids.clone());
    }

    // 全ハイライトIDの集合
    let mut all_highlights: Vec<String> = main_map.keys().cloned().collect();
    for k in imported_map.keys() {
        if !all_highlights.contains(k) {
            all_highlights.push(k.clone());
        }
    }
    all_highlights.sort();

    let total_segments = all_highlights.len() as u32;
    if total_segments == 0 {
        return Ok(IcrResult {
            cohen_kappa: 1.0,
            percent_agreement: 1.0,
            total_segments: 0,
            agreements: 0,
            disagreements: vec![],
        });
    }

    // 全コードIDの集合
    let mut all_codes: Vec<String> = Vec::new();
    for codes in main_map.values() {
        for c in codes {
            if !all_codes.contains(c) {
                all_codes.push(c.clone());
            }
        }
    }
    for codes in imported_map.values() {
        for c in codes {
            if !all_codes.contains(c) {
                all_codes.push(c.clone());
            }
        }
    }
    all_codes.sort();

    // Po（観測一致率）を計算
    let mut agreements = 0u32;
    let mut disagreements: Vec<DisagreementItem> = Vec::new();

    for hid in &all_highlights {
        let main_codes = main_map.get(hid).cloned().unwrap_or_default();
        let imp_codes = imported_map.get(hid).cloned().unwrap_or_default();

        let mut main_sorted = main_codes.clone();
        let mut imp_sorted = imp_codes.clone();
        main_sorted.sort();
        imp_sorted.sort();

        if main_sorted == imp_sorted {
            agreements += 1;
        } else {
            disagreements.push(DisagreementItem {
                highlight_id: hid.clone(),
                main_codes,
                imported_codes: imp_codes,
            });
        }
    }

    let po = agreements as f64 / total_segments as f64;

    // Pe（期待一致率）を計算
    // 各コードについて、コーダーAがそのコードを割り当てた確率 × コーダーBがそのコードを割り当てた確率
    // を合計する
    let mut pe = 0.0f64;

    // "コード割り当てなし" カテゴリも考慮
    let mut main_none_count = 0u32;
    let mut imp_none_count = 0u32;

    for hid in &all_highlights {
        if !main_map.contains_key(hid) || main_map[hid].is_empty() {
            main_none_count += 1;
        }
        if !imported_map.contains_key(hid) || imported_map[hid].is_empty() {
            imp_none_count += 1;
        }
    }

    // "なし" カテゴリの期待一致率
    let p_main_none = main_none_count as f64 / total_segments as f64;
    let p_imp_none = imp_none_count as f64 / total_segments as f64;
    pe += p_main_none * p_imp_none;

    // 各コードカテゴリの期待一致率
    for code_id in &all_codes {
        let main_count = all_highlights
            .iter()
            .filter(|hid| {
                main_map
                    .get(*hid)
                    .map(|codes| codes.contains(code_id))
                    .unwrap_or(false)
            })
            .count() as f64;

        let imp_count = all_highlights
            .iter()
            .filter(|hid| {
                imported_map
                    .get(*hid)
                    .map(|codes| codes.contains(code_id))
                    .unwrap_or(false)
            })
            .count() as f64;

        let p_main = main_count / total_segments as f64;
        let p_imp = imp_count / total_segments as f64;
        pe += p_main * p_imp;
    }

    // Cohen's κ = (Po - Pe) / (1 - Pe)
    let kappa = if (1.0 - pe).abs() < f64::EPSILON {
        if (po - 1.0).abs() < f64::EPSILON {
            1.0
        } else {
            0.0
        }
    } else {
        (po - pe) / (1.0 - pe)
    };

    Ok(IcrResult {
        cohen_kappa: kappa,
        percent_agreement: po,
        total_segments,
        agreements,
        disagreements,
    })
}

// ════════════════════════════════════════════════════════════════
// 史料批判
// ════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn get_source_critique(
    app: AppHandle,
    paper_id: String,
) -> Result<Option<SourceCritiqueResponse>, String> {
    let pool = get_pool(&app)?;

    let row = sqlx::query("SELECT * FROM source_critiques WHERE paper_id = ?")
        .bind(&paper_id)
        .fetch_optional(pool.as_ref())
        .await
        .map_err(|e| format!("史料批判取得に失敗: {}", e))?;

    match row {
        Some(r) => Ok(Some(parse_source_critique(&r)?)),
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn upsert_source_critique(
    app: AppHandle,
    dto: SourceCritiqueDto,
) -> Result<SourceCritiqueResponse, String> {
    let pool = get_pool(&app)?;
    let now = chrono::Utc::now().to_rfc3339();

    // 既存チェック
    let existing = sqlx::query("SELECT id FROM source_critiques WHERE paper_id = ?")
        .bind(&dto.paper_id)
        .fetch_optional(pool.as_ref())
        .await
        .map_err(|e| format!("史料批判確認に失敗: {}", e))?;

    let id = if let Some(row) = existing {
        let existing_id = col_str(&row, "id");
        sqlx::query(
            "UPDATE source_critiques SET author_info = ?, creation_date = ?, is_date_estimated = ?, location = ?, source_type = ?, authenticity = ?, archive_info = ?, intent = ?, audience = ?, bias_level = ?, bias_reason = ?, consistency = ?, reliability_score = ?, researcher_notes = ?, updated_at = ? WHERE id = ?",
        )
        .bind(&dto.author_info)
        .bind(&dto.creation_date)
        .bind(dto.is_date_estimated as i32)
        .bind(&dto.location)
        .bind(&dto.source_type)
        .bind(&dto.authenticity)
        .bind(&dto.archive_info)
        .bind(&dto.intent)
        .bind(&dto.audience)
        .bind(&dto.bias_level)
        .bind(&dto.bias_reason)
        .bind(&dto.consistency)
        .bind(dto.reliability_score)
        .bind(&dto.researcher_notes)
        .bind(&now)
        .bind(&existing_id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("史料批判更新に失敗: {}", e))?;
        existing_id
    } else {
        let new_id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO source_critiques (id, paper_id, author_info, creation_date, is_date_estimated, location, source_type, authenticity, archive_info, intent, audience, bias_level, bias_reason, consistency, reliability_score, researcher_notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&new_id)
        .bind(&dto.paper_id)
        .bind(&dto.author_info)
        .bind(&dto.creation_date)
        .bind(dto.is_date_estimated as i32)
        .bind(&dto.location)
        .bind(&dto.source_type)
        .bind(&dto.authenticity)
        .bind(&dto.archive_info)
        .bind(&dto.intent)
        .bind(&dto.audience)
        .bind(&dto.bias_level)
        .bind(&dto.bias_reason)
        .bind(&dto.consistency)
        .bind(dto.reliability_score)
        .bind(&dto.researcher_notes)
        .bind(&now)
        .bind(&now)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("史料批判作成に失敗: {}", e))?;
        new_id
    };

    Ok(SourceCritiqueResponse {
        id,
        paper_id: dto.paper_id,
        author_info: dto.author_info,
        creation_date: dto.creation_date,
        is_date_estimated: dto.is_date_estimated,
        location: dto.location,
        source_type: dto.source_type,
        authenticity: dto.authenticity,
        archive_info: dto.archive_info,
        intent: dto.intent,
        audience: dto.audience,
        bias_level: dto.bias_level,
        bias_reason: dto.bias_reason,
        consistency: dto.consistency,
        reliability_score: dto.reliability_score,
        researcher_notes: dto.researcher_notes,
        created_at: now.clone(),
        updated_at: Some(now),
    })
}

#[tauri::command]
pub async fn get_qual_source_critique(
    app: AppHandle,
    source_id: String,
) -> Result<Option<QualSourceCritiqueResponse>, String> {
    let pool = get_pool(&app)?;

    let row = sqlx::query("SELECT * FROM qual_source_critiques WHERE source_id = ?")
        .bind(&source_id)
        .fetch_optional(pool.as_ref())
        .await
        .map_err(|e| format!("分析ソース批判取得に失敗: {}", e))?;

    match row {
        Some(r) => Ok(Some(parse_qual_source_critique(&r)?)),
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn upsert_qual_source_critique(
    app: AppHandle,
    dto: QualSourceCritiqueDto,
) -> Result<QualSourceCritiqueResponse, String> {
    let pool = get_pool(&app)?;
    let now = chrono::Utc::now().to_rfc3339();

    let existing = sqlx::query("SELECT id FROM qual_source_critiques WHERE source_id = ?")
        .bind(&dto.source_id)
        .fetch_optional(pool.as_ref())
        .await
        .map_err(|e| format!("分析ソース批判確認に失敗: {}", e))?;

    let id = if let Some(row) = existing {
        let existing_id = col_str(&row, "id");
        sqlx::query(
            "UPDATE qual_source_critiques SET author_info = ?, creation_date = ?, is_date_estimated = ?, location = ?, source_type = ?, authenticity = ?, archive_info = ?, intent = ?, audience = ?, bias_level = ?, bias_reason = ?, consistency = ?, reliability_score = ?, researcher_notes = ?, updated_at = ? WHERE id = ?",
        )
        .bind(&dto.author_info)
        .bind(&dto.creation_date)
        .bind(dto.is_date_estimated as i32)
        .bind(&dto.location)
        .bind(&dto.source_type)
        .bind(&dto.authenticity)
        .bind(&dto.archive_info)
        .bind(&dto.intent)
        .bind(&dto.audience)
        .bind(&dto.bias_level)
        .bind(&dto.bias_reason)
        .bind(&dto.consistency)
        .bind(dto.reliability_score)
        .bind(&dto.researcher_notes)
        .bind(&now)
        .bind(&existing_id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("分析ソース批判更新に失敗: {}", e))?;
        existing_id
    } else {
        let new_id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO qual_source_critiques (id, source_id, author_info, creation_date, is_date_estimated, location, source_type, authenticity, archive_info, intent, audience, bias_level, bias_reason, consistency, reliability_score, researcher_notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&new_id)
        .bind(&dto.source_id)
        .bind(&dto.author_info)
        .bind(&dto.creation_date)
        .bind(dto.is_date_estimated as i32)
        .bind(&dto.location)
        .bind(&dto.source_type)
        .bind(&dto.authenticity)
        .bind(&dto.archive_info)
        .bind(&dto.intent)
        .bind(&dto.audience)
        .bind(&dto.bias_level)
        .bind(&dto.bias_reason)
        .bind(&dto.consistency)
        .bind(dto.reliability_score)
        .bind(&dto.researcher_notes)
        .bind(&now)
        .bind(&now)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("分析ソース批判作成に失敗: {}", e))?;
        new_id
    };

    Ok(QualSourceCritiqueResponse {
        id,
        source_id: dto.source_id,
        author_info: dto.author_info,
        creation_date: dto.creation_date,
        is_date_estimated: dto.is_date_estimated,
        location: dto.location,
        source_type: dto.source_type,
        authenticity: dto.authenticity,
        archive_info: dto.archive_info,
        intent: dto.intent,
        audience: dto.audience,
        bias_level: dto.bias_level,
        bias_reason: dto.bias_reason,
        consistency: dto.consistency,
        reliability_score: dto.reliability_score,
        researcher_notes: dto.researcher_notes,
        created_at: now.clone(),
        updated_at: Some(now),
    })
}

#[tauri::command]
pub async fn get_qual_source_critiques_by_project(
    app: AppHandle,
    project_id: String,
) -> Result<Vec<QualSourceCritiqueResponse>, String> {
    let pool = get_pool(&app)?;
    let rows = sqlx::query(
        "SELECT qsc.* FROM qual_source_critiques qsc
         JOIN qualitative_sources qs ON qs.id = qsc.source_id
         WHERE qs.project_id = ?
         ORDER BY qsc.updated_at DESC",
    )
    .bind(&project_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("分析ソース批判一覧取得に失敗: {}", e))?;

    rows.iter().map(parse_qual_source_critique).collect()
}

#[tauri::command]
pub async fn delete_qual_source_critique(app: AppHandle, id: String) -> Result<(), String> {
    let pool = get_pool(&app)?;
    sqlx::query("DELETE FROM qual_source_critiques WHERE id = ?")
        .bind(&id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("分析ソース批判削除に失敗: {}", e))?;
    Ok(())
}

// ════════════════════════════════════════════════════════════════
// タイムライン
// ════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn get_timeline_events(
    app: AppHandle,
    project_id: String,
) -> Result<Vec<TimelineEventResponse>, String> {
    let pool = get_pool(&app)?;

    let rows =
        sqlx::query("SELECT * FROM timeline_events WHERE project_id = ? ORDER BY event_date ASC")
            .bind(&project_id)
            .fetch_all(pool.as_ref())
            .await
            .map_err(|e| format!("タイムライン取得に失敗: {}", e))?;

    rows.iter().map(parse_timeline_event).collect()
}

#[tauri::command]
pub async fn create_timeline_event(
    app: AppHandle,
    input: CreateTimelineEventDto,
) -> Result<TimelineEventResponse, String> {
    let pool = get_pool(&app)?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO timeline_events (id, project_id, title, description, event_date, date_type, event_type, importance, lane, paper_id, highlight_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&input.project_id)
    .bind(&input.title)
    .bind(&input.description)
    .bind(&input.event_date)
    .bind(&input.date_type)
    .bind(&input.event_type)
    .bind(input.importance)
    .bind(&input.lane)
    .bind(&input.paper_id)
    .bind(&input.highlight_id)
    .bind(&now)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("タイムラインイベント作成に失敗: {}", e))?;

    Ok(TimelineEventResponse {
        id,
        project_id: input.project_id,
        title: input.title,
        description: input.description,
        event_date: input.event_date,
        date_type: input.date_type,
        event_type: input.event_type,
        importance: input.importance,
        lane: input.lane,
        paper_id: input.paper_id,
        highlight_id: input.highlight_id,
        created_at: now,
    })
}

#[tauri::command]
pub async fn update_timeline_event(
    app: AppHandle,
    id: String,
    input: UpdateTimelineEventDto,
) -> Result<TimelineEventResponse, String> {
    let pool = get_pool(&app)?;

    let row = sqlx::query("SELECT * FROM timeline_events WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.as_ref())
        .await
        .map_err(|e| format!("タイムラインイベント取得に失敗: {}", e))?
        .ok_or_else(|| format!("タイムラインイベントが見つかりません: {}", id))?;

    let current = parse_timeline_event(&row)?;
    let title = input.title.unwrap_or(current.title);
    let description = input.description.or(current.description);
    let event_date = input.event_date.unwrap_or(current.event_date);
    let date_type = input.date_type.unwrap_or(current.date_type);
    let event_type = input.event_type.unwrap_or(current.event_type);
    let importance = input.importance.unwrap_or(current.importance);
    let lane = input.lane.or(current.lane);
    let paper_id = match input.paper_id {
        Some(p) => p,
        None => current.paper_id,
    };
    let highlight_id = match input.highlight_id {
        Some(h) => h,
        None => current.highlight_id,
    };

    sqlx::query(
        "UPDATE timeline_events SET title = ?, description = ?, event_date = ?, date_type = ?, event_type = ?, importance = ?, lane = ?, paper_id = ?, highlight_id = ? WHERE id = ?",
    )
    .bind(&title)
    .bind(&description)
    .bind(&event_date)
    .bind(&date_type)
    .bind(&event_type)
    .bind(importance)
    .bind(&lane)
    .bind(&paper_id)
    .bind(&highlight_id)
    .bind(&id)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("タイムラインイベント更新に失敗: {}", e))?;

    Ok(TimelineEventResponse {
        id,
        project_id: current.project_id,
        title,
        description,
        event_date,
        date_type,
        event_type,
        importance,
        lane,
        paper_id,
        highlight_id,
        created_at: current.created_at,
    })
}

#[tauri::command]
pub async fn delete_timeline_event(app: AppHandle, id: String) -> Result<(), String> {
    let pool = get_pool(&app)?;
    sqlx::query("DELETE FROM timeline_events WHERE id = ?")
        .bind(&id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("タイムラインイベント削除に失敗: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn get_timeline_lanes(app: AppHandle, project_id: String) -> Result<Vec<String>, String> {
    let pool = get_pool(&app)?;

    let rows = sqlx::query(
        "SELECT DISTINCT lane FROM timeline_events WHERE project_id = ? AND lane IS NOT NULL AND lane != '' ORDER BY lane ASC",
    )
    .bind(&project_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("レーン取得に失敗: {}", e))?;

    Ok(rows.iter().map(|r| col_str(r, "lane")).collect())
}

// ════════════════════════════════════════════════════════════════
// アクターマップ
// ════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn get_actor_map(app: AppHandle, project_id: String) -> Result<ActorMapData, String> {
    let pool = get_pool(&app)?;

    let actor_rows = sqlx::query("SELECT * FROM actors WHERE project_id = ? ORDER BY name ASC")
        .bind(&project_id)
        .fetch_all(pool.as_ref())
        .await
        .map_err(|e| format!("アクター取得に失敗: {}", e))?;

    let actors: Vec<ActorResponse> = actor_rows
        .iter()
        .map(parse_actor)
        .collect::<Result<_, _>>()?;

    let actor_ids: Vec<String> = actors.iter().map(|a| a.id.clone()).collect();
    let relations = if actor_ids.is_empty() {
        vec![]
    } else {
        let placeholders = actor_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let query_str = format!(
            "SELECT * FROM actor_relations WHERE actor_from IN ({}) OR actor_to IN ({}) ORDER BY created_at ASC",
            placeholders, placeholders
        );
        let mut query = sqlx::query(&query_str);
        for id in &actor_ids {
            query = query.bind(id);
        }
        for id in &actor_ids {
            query = query.bind(id);
        }
        let rel_rows = query
            .fetch_all(pool.as_ref())
            .await
            .map_err(|e| format!("アクター関係取得に失敗: {}", e))?;

        rel_rows
            .iter()
            .map(parse_actor_relation)
            .collect::<Result<_, _>>()?
    };

    Ok(ActorMapData { actors, relations })
}

#[tauri::command]
pub async fn create_actor(app: AppHandle, input: CreateActorDto) -> Result<ActorResponse, String> {
    let pool = get_pool(&app)?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO actors (id, project_id, name, actor_type, position, influence, level, description, x_position, y_position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&input.project_id)
    .bind(&input.name)
    .bind(&input.actor_type)
    .bind(&input.position)
    .bind(input.influence)
    .bind(&input.level)
    .bind(&input.description)
    .bind(input.x_position)
    .bind(input.y_position)
    .bind(&now)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("アクター作成に失敗: {}", e))?;

    Ok(ActorResponse {
        id,
        project_id: input.project_id,
        name: input.name,
        actor_type: input.actor_type,
        position: input.position,
        influence: input.influence,
        level: input.level,
        description: input.description,
        x_position: input.x_position,
        y_position: input.y_position,
        created_at: now,
    })
}

#[tauri::command]
pub async fn update_actor(
    app: AppHandle,
    id: String,
    input: UpdateActorDto,
) -> Result<ActorResponse, String> {
    let pool = get_pool(&app)?;

    let row = sqlx::query("SELECT * FROM actors WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.as_ref())
        .await
        .map_err(|e| format!("アクター取得に失敗: {}", e))?
        .ok_or_else(|| format!("アクターが見つかりません: {}", id))?;

    let current = parse_actor(&row)?;
    let name = input.name.unwrap_or(current.name);
    let actor_type = input.actor_type.unwrap_or(current.actor_type);
    let position = input.position.unwrap_or(current.position);
    let influence = input.influence.unwrap_or(current.influence);
    let level = input.level.unwrap_or(current.level);
    let description = input.description.or(current.description);
    let x_position = input.x_position.or(current.x_position);
    let y_position = input.y_position.or(current.y_position);

    sqlx::query(
        "UPDATE actors SET name = ?, actor_type = ?, position = ?, influence = ?, level = ?, description = ?, x_position = ?, y_position = ? WHERE id = ?",
    )
    .bind(&name)
    .bind(&actor_type)
    .bind(&position)
    .bind(influence)
    .bind(&level)
    .bind(&description)
    .bind(x_position)
    .bind(y_position)
    .bind(&id)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("アクター更新に失敗: {}", e))?;

    Ok(ActorResponse {
        id,
        project_id: current.project_id,
        name,
        actor_type,
        position,
        influence,
        level,
        description,
        x_position,
        y_position,
        created_at: current.created_at,
    })
}

#[tauri::command]
pub async fn delete_actor(app: AppHandle, id: String) -> Result<(), String> {
    let pool = get_pool(&app)?;
    sqlx::query("DELETE FROM actors WHERE id = ?")
        .bind(&id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("アクター削除に失敗: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn create_actor_relation(
    app: AppHandle,
    input: CreateActorRelationDto,
) -> Result<ActorRelationResponse, String> {
    let pool = get_pool(&app)?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO actor_relations (id, actor_from, actor_to, relation_type, start_year, end_year, description, paper_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&input.actor_from)
    .bind(&input.actor_to)
    .bind(&input.relation_type)
    .bind(input.start_year)
    .bind(input.end_year)
    .bind(&input.description)
    .bind(&input.paper_id)
    .bind(&now)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("アクター関係作成に失敗: {}", e))?;

    Ok(ActorRelationResponse {
        id,
        actor_from: input.actor_from,
        actor_to: input.actor_to,
        relation_type: input.relation_type,
        start_year: input.start_year,
        end_year: input.end_year,
        description: input.description,
        paper_id: input.paper_id,
        created_at: now,
    })
}

#[tauri::command]
pub async fn delete_actor_relation(app: AppHandle, id: String) -> Result<(), String> {
    let pool = get_pool(&app)?;
    sqlx::query("DELETE FROM actor_relations WHERE id = ?")
        .bind(&id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("アクター関係削除に失敗: {}", e))?;
    Ok(())
}

// ════════════════════════════════════════════════════════════════
// プロセス・トレーシング
// ════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn get_pt_data(app: AppHandle, project_id: String) -> Result<PtData, String> {
    let pool = get_pool(&app)?;

    let hyp_rows = sqlx::query(
        "SELECT * FROM pt_hypotheses WHERE project_id = ? ORDER BY is_main DESC, sort_order ASC",
    )
    .bind(&project_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("PT仮説取得に失敗: {}", e))?;

    let mut hypotheses: Vec<HypothesisWithEvidences> = Vec::new();

    for hyp_row in &hyp_rows {
        let hyp = parse_pt_hypothesis(hyp_row)?;

        let ev_rows = sqlx::query(
            "SELECT * FROM pt_evidences WHERE hypothesis_id = ? ORDER BY created_at ASC",
        )
        .bind(&hyp.id)
        .fetch_all(pool.as_ref())
        .await
        .map_err(|e| format!("PT証拠取得に失敗: {}", e))?;

        let evidences: Vec<PtEvidenceResponse> = ev_rows
            .iter()
            .map(parse_pt_evidence)
            .collect::<Result<_, _>>()?;

        hypotheses.push(HypothesisWithEvidences {
            hypothesis: hyp,
            evidences,
        });
    }

    Ok(PtData { hypotheses })
}

#[tauri::command]
pub async fn create_pt_hypothesis(
    app: AppHandle,
    input: CreatePtHypothesisDto,
) -> Result<PtHypothesisResponse, String> {
    let pool = get_pool(&app)?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO pt_hypotheses (id, project_id, title, description, is_main, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&input.project_id)
    .bind(&input.title)
    .bind(&input.description)
    .bind(input.is_main as i32)
    .bind(input.sort_order)
    .bind(&now)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("PT仮説作成に失敗: {}", e))?;

    Ok(PtHypothesisResponse {
        id,
        project_id: input.project_id,
        title: input.title,
        description: input.description,
        is_main: input.is_main,
        sort_order: input.sort_order,
        created_at: now,
    })
}

#[tauri::command]
pub async fn add_pt_evidence(
    app: AppHandle,
    input: CreatePtEvidenceDto,
) -> Result<PtEvidenceResponse, String> {
    let pool = get_pool(&app)?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO pt_evidences (id, hypothesis_id, description, test_type, result, paper_id, highlight_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&input.hypothesis_id)
    .bind(&input.description)
    .bind(&input.test_type)
    .bind(&input.result)
    .bind(&input.paper_id)
    .bind(&input.highlight_id)
    .bind(&now)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("PT証拠追加に失敗: {}", e))?;

    Ok(PtEvidenceResponse {
        id,
        hypothesis_id: input.hypothesis_id,
        description: input.description,
        test_type: input.test_type,
        result: input.result,
        paper_id: input.paper_id,
        highlight_id: input.highlight_id,
        created_at: now,
    })
}

#[tauri::command]
pub async fn update_pt_evidence_result(
    app: AppHandle,
    id: String,
    result: String,
) -> Result<PtEvidenceResponse, String> {
    let pool = get_pool(&app)?;

    sqlx::query("UPDATE pt_evidences SET result = ? WHERE id = ?")
        .bind(&result)
        .bind(&id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("PT証拠結果更新に失敗: {}", e))?;

    let row = sqlx::query("SELECT * FROM pt_evidences WHERE id = ?")
        .bind(&id)
        .fetch_one(pool.as_ref())
        .await
        .map_err(|e| format!("PT証拠取得に失敗: {}", e))?;

    parse_pt_evidence(&row)
}

#[tauri::command]
pub async fn get_pt_summary(app: AppHandle, project_id: String) -> Result<PtSummary, String> {
    let pool = get_pool(&app)?;

    // 主仮説の証拠を取得
    let rows = sqlx::query(
        "SELECT e.test_type, e.result
         FROM pt_evidences e
         JOIN pt_hypotheses h ON h.id = e.hypothesis_id
         WHERE h.project_id = ? AND h.is_main = 1",
    )
    .bind(&project_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("PTサマリー取得に失敗: {}", e))?;

    let mut hoop_total = 0u32;
    let mut hoop_pass = 0u32;
    let mut has_smoking_gun = false;

    for row in &rows {
        let test_type = col_str(row, "test_type");
        let result_val = col_str(row, "result");

        match test_type.as_str() {
            "hoop" => {
                hoop_total += 1;
                if result_val == "pass" {
                    hoop_pass += 1;
                }
            }
            "smoking_gun" => {
                if result_val == "pass" {
                    has_smoking_gun = true;
                }
            }
            _ => {}
        }
    }

    let hoop_pass_rate = if hoop_total > 0 {
        hoop_pass as f32 / hoop_total as f32
    } else {
        0.0
    };

    let overall_verdict = if has_smoking_gun && hoop_pass_rate >= 0.5 {
        "仮説を支持".to_string()
    } else if hoop_total > 0 && hoop_pass_rate < 0.5 {
        "仮説を棄却".to_string()
    } else {
        "証拠不十分".to_string()
    };

    Ok(PtSummary {
        hoop_pass_rate,
        has_smoking_gun,
        overall_verdict,
    })
}

// ════════════════════════════════════════════════════════════════
// 比較ケース設計
// ════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn get_comparative_design(
    app: AppHandle,
    project_id: String,
) -> Result<Vec<ComparativeDesignFull>, String> {
    let pool = get_pool(&app)?;

    let design_rows = sqlx::query(
        "SELECT * FROM comparative_designs WHERE project_id = ? ORDER BY created_at ASC",
    )
    .bind(&project_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("比較デザイン取得に失敗: {}", e))?;

    let mut result = Vec::new();

    for dr in &design_rows {
        let design = parse_comparative_design(dr)?;

        let case_rows = sqlx::query(
            "SELECT * FROM comparative_cases WHERE design_id = ? ORDER BY sort_order ASC",
        )
        .bind(&design.id)
        .fetch_all(pool.as_ref())
        .await
        .map_err(|e| format!("比較ケース取得に失敗: {}", e))?;

        let cases: Vec<ComparativeCaseResponse> = case_rows
            .iter()
            .map(parse_comparative_case)
            .collect::<Result<_, _>>()?;

        let var_rows = sqlx::query(
            "SELECT * FROM comparative_variables WHERE design_id = ? ORDER BY sort_order ASC",
        )
        .bind(&design.id)
        .fetch_all(pool.as_ref())
        .await
        .map_err(|e| format!("比較変数取得に失敗: {}", e))?;

        let variables: Vec<ComparativeVariableResponse> = var_rows
            .iter()
            .map(parse_comparative_variable)
            .collect::<Result<_, _>>()?;

        let cell_rows = sqlx::query(
            "SELECT cc.* FROM comparative_cells cc
             JOIN comparative_cases c ON c.id = cc.case_id
             WHERE c.design_id = ?",
        )
        .bind(&design.id)
        .fetch_all(pool.as_ref())
        .await
        .map_err(|e| format!("比較セル取得に失敗: {}", e))?;

        let cells: Vec<ComparativeCellResponse> = cell_rows
            .iter()
            .map(parse_comparative_cell)
            .collect::<Result<_, _>>()?;

        result.push(ComparativeDesignFull {
            design,
            cases,
            variables,
            cells,
        });
    }

    Ok(result)
}

#[tauri::command]
pub async fn create_comparative_design(
    app: AppHandle,
    input: CreateComparativeDesignDto,
) -> Result<ComparativeDesignResponse, String> {
    let pool = get_pool(&app)?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO comparative_designs (id, project_id, design_type, title, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&input.project_id)
    .bind(&input.design_type)
    .bind(&input.title)
    .bind(&now)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("比較デザイン作成に失敗: {}", e))?;

    Ok(ComparativeDesignResponse {
        id,
        project_id: input.project_id,
        design_type: input.design_type,
        title: input.title,
        created_at: now,
    })
}

#[tauri::command]
pub async fn add_comparative_case(
    app: AppHandle,
    design_id: String,
    name: String,
    sort_order: i32,
) -> Result<ComparativeCaseResponse, String> {
    let pool = get_pool(&app)?;
    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO comparative_cases (id, design_id, name, sort_order) VALUES (?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&design_id)
    .bind(&name)
    .bind(sort_order)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("比較ケース追加に失敗: {}", e))?;

    Ok(ComparativeCaseResponse {
        id,
        design_id,
        name,
        sort_order,
    })
}

#[tauri::command]
pub async fn add_comparative_variable(
    app: AppHandle,
    design_id: String,
    name: String,
    var_type: String,
    sort_order: i32,
) -> Result<ComparativeVariableResponse, String> {
    let pool = get_pool(&app)?;
    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO comparative_variables (id, design_id, name, var_type, sort_order) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&design_id)
    .bind(&name)
    .bind(&var_type)
    .bind(sort_order)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("比較変数追加に失敗: {}", e))?;

    Ok(ComparativeVariableResponse {
        id,
        design_id,
        name,
        var_type,
        sort_order,
    })
}

#[tauri::command]
pub async fn upsert_comparative_cell(
    app: AppHandle,
    case_id: String,
    variable_id: String,
    value: String,
    paper_id: Option<String>,
) -> Result<(), String> {
    let pool = get_pool(&app)?;

    let existing =
        sqlx::query("SELECT id FROM comparative_cells WHERE case_id = ? AND variable_id = ?")
            .bind(&case_id)
            .bind(&variable_id)
            .fetch_optional(pool.as_ref())
            .await
            .map_err(|e| format!("比較セル確認に失敗: {}", e))?;

    if let Some(row) = existing {
        let existing_id = col_str(&row, "id");
        sqlx::query("UPDATE comparative_cells SET value = ?, paper_id = ? WHERE id = ?")
            .bind(&value)
            .bind(&paper_id)
            .bind(&existing_id)
            .execute(pool.as_ref())
            .await
            .map_err(|e| format!("比較セル更新に失敗: {}", e))?;
    } else {
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO comparative_cells (id, case_id, variable_id, value, paper_id) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&case_id)
        .bind(&variable_id)
        .bind(&value)
        .bind(&paper_id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("比較セル作成に失敗: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn export_qca_csv(app: AppHandle, design_id: String) -> Result<String, String> {
    let pool = get_pool(&app)?;

    let case_rows =
        sqlx::query("SELECT * FROM comparative_cases WHERE design_id = ? ORDER BY sort_order ASC")
            .bind(&design_id)
            .fetch_all(pool.as_ref())
            .await
            .map_err(|e| format!("ケース取得に失敗: {}", e))?;

    let var_rows = sqlx::query(
        "SELECT * FROM comparative_variables WHERE design_id = ? ORDER BY sort_order ASC",
    )
    .bind(&design_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("変数取得に失敗: {}", e))?;

    let cell_rows = sqlx::query(
        "SELECT cc.* FROM comparative_cells cc
         JOIN comparative_cases c ON c.id = cc.case_id
         WHERE c.design_id = ?",
    )
    .bind(&design_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("セル取得に失敗: {}", e))?;

    // セルマップ: "case_id:variable_id" → value
    let mut cell_map: HashMap<String, String> = HashMap::new();
    for row in &cell_rows {
        let key = format!(
            "{}:{}",
            col_str(row, "case_id"),
            col_str(row, "variable_id")
        );
        cell_map.insert(key, col_str(row, "value"));
    }

    // CSV ヘッダー
    let var_names: Vec<String> = var_rows.iter().map(|r| col_str(r, "name")).collect();
    let var_ids: Vec<String> = var_rows.iter().map(|r| col_str(r, "id")).collect();
    let mut csv = format!("case,{}\n", var_names.join(","));

    // CSV データ行
    for case_row in &case_rows {
        let case_id = col_str(case_row, "id");
        let case_name = col_str(case_row, "name");
        let values: Vec<String> = var_ids
            .iter()
            .map(|vid| {
                let key = format!("{}:{}", case_id, vid);
                cell_map.get(&key).cloned().unwrap_or_default()
            })
            .collect();
        csv.push_str(&format!("{},{}\n", case_name, values.join(",")));
    }

    Ok(csv)
}

// ════════════════════════════════════════════════════════════════
// フレーミング分析
// ════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn get_frames(app: AppHandle, project_id: String) -> Result<Vec<FrameResponse>, String> {
    let pool = get_pool(&app)?;

    let rows = sqlx::query("SELECT * FROM frames WHERE project_id = ? ORDER BY created_at ASC")
        .bind(&project_id)
        .fetch_all(pool.as_ref())
        .await
        .map_err(|e| format!("フレーム取得に失敗: {}", e))?;

    rows.iter().map(parse_frame).collect()
}

#[tauri::command]
pub async fn create_frame(app: AppHandle, input: CreateFrameDto) -> Result<FrameResponse, String> {
    let pool = get_pool(&app)?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO frames (id, project_id, name, problem_definition, causal_interpretation, moral_evaluation, treatment_recommendation, color, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&input.project_id)
    .bind(&input.name)
    .bind(&input.problem_definition)
    .bind(&input.causal_interpretation)
    .bind(&input.moral_evaluation)
    .bind(&input.treatment_recommendation)
    .bind(&input.color)
    .bind(&now)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("フレーム作成に失敗: {}", e))?;

    Ok(FrameResponse {
        id,
        project_id: input.project_id,
        name: input.name,
        problem_definition: input.problem_definition,
        causal_interpretation: input.causal_interpretation,
        moral_evaluation: input.moral_evaluation,
        treatment_recommendation: input.treatment_recommendation,
        color: input.color,
        created_at: now,
    })
}

#[tauri::command]
pub async fn assign_frame_to_highlight(
    app: AppHandle,
    highlight_id: String,
    frame_id: String,
) -> Result<(), String> {
    let pool = get_pool(&app)?;
    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT OR IGNORE INTO highlight_frames (id, highlight_id, frame_id, assigned_at) VALUES (?, ?, ?, datetime('now'))",
    )
    .bind(&id)
    .bind(&highlight_id)
    .bind(&frame_id)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("フレーム割り当てに失敗: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn get_framing_matrix(
    app: AppHandle,
    project_id: String,
) -> Result<FramingMatrix, String> {
    let pool = get_pool(&app)?;

    // フレーム一覧
    let frame_rows =
        sqlx::query("SELECT * FROM frames WHERE project_id = ? ORDER BY created_at ASC")
            .bind(&project_id)
            .fetch_all(pool.as_ref())
            .await
            .map_err(|e| format!("フレーム取得に失敗: {}", e))?;

    let frames: Vec<FrameResponse> = frame_rows
        .iter()
        .map(parse_frame)
        .collect::<Result<_, _>>()?;

    // 論文一覧
    let paper_rows = sqlx::query(
        "SELECT DISTINCT p.id, p.title FROM papers p
         JOIN highlights h ON h.paper_id = p.id
         JOIN highlight_frames hf ON hf.highlight_id = h.id
         JOIN frames f ON f.id = hf.frame_id AND f.project_id = ?
         ORDER BY p.title ASC",
    )
    .bind(&project_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("論文取得に失敗: {}", e))?;

    let papers: Vec<CodingMatrixCol> = paper_rows
        .iter()
        .map(|r| CodingMatrixCol {
            paper_id: col_str(r, "id"),
            paper_title: col_str(r, "title"),
        })
        .collect();

    // セル集計
    let count_rows = sqlx::query(
        "SELECT hf.frame_id, h.paper_id, COUNT(*) as cnt
         FROM highlight_frames hf
         JOIN highlights h ON h.id = hf.highlight_id
         JOIN frames f ON f.id = hf.frame_id AND f.project_id = ?
         GROUP BY hf.frame_id, h.paper_id",
    )
    .bind(&project_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("フレーミングマトリクスセル取得に失敗: {}", e))?;

    let mut counts: HashMap<String, u32> = HashMap::new();
    for row in &count_rows {
        let key = format!("{}:{}", col_str(row, "frame_id"), col_str(row, "paper_id"));
        let cnt: i64 = row.try_get("cnt").unwrap_or(0);
        counts.insert(key, cnt as u32);
    }

    Ok(FramingMatrix {
        frames,
        papers,
        counts,
    })
}

// ════════════════════════════════════════════════════════════════
// 追加 CRUD — PT 仮説/証拠の削除、比較ケース/変数の削除、
// フレーム削除・解除、highlight_frames 取得
// ════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn delete_pt_hypothesis(app: AppHandle, id: String) -> Result<(), String> {
    let pool = get_pool(&app)?;
    sqlx::query("DELETE FROM pt_hypotheses WHERE id = ?")
        .bind(&id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("PT仮説削除に失敗: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn delete_pt_evidence(app: AppHandle, id: String) -> Result<(), String> {
    let pool = get_pool(&app)?;
    sqlx::query("DELETE FROM pt_evidences WHERE id = ?")
        .bind(&id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("PT証拠削除に失敗: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn delete_comparative_case(app: AppHandle, id: String) -> Result<(), String> {
    let pool = get_pool(&app)?;
    sqlx::query("DELETE FROM comparative_cases WHERE id = ?")
        .bind(&id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("比較ケース削除に失敗: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn delete_comparative_variable(app: AppHandle, id: String) -> Result<(), String> {
    let pool = get_pool(&app)?;
    sqlx::query("DELETE FROM comparative_variables WHERE id = ?")
        .bind(&id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("比較変数削除に失敗: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn delete_frame(app: AppHandle, id: String) -> Result<(), String> {
    let pool = get_pool(&app)?;
    sqlx::query("DELETE FROM frames WHERE id = ?")
        .bind(&id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("フレーム削除に失敗: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn remove_frame_from_highlight(
    app: AppHandle,
    highlight_id: String,
    frame_id: String,
) -> Result<(), String> {
    let pool = get_pool(&app)?;
    sqlx::query("DELETE FROM highlight_frames WHERE highlight_id = ? AND frame_id = ?")
        .bind(&highlight_id)
        .bind(&frame_id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("フレーム割り当て解除に失敗: {}", e))?;
    Ok(())
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HighlightFrameRow {
    pub id: String,
    pub highlight_id: String,
    pub frame_id: String,
    pub assigned_at: String,
}

#[tauri::command]
pub async fn get_highlight_frames(
    app: AppHandle,
    project_id: String,
) -> Result<Vec<HighlightFrameRow>, String> {
    let pool = get_pool(&app)?;
    let rows = sqlx::query(
        "SELECT hf.* FROM highlight_frames hf
         JOIN frames f ON f.id = hf.frame_id
         WHERE f.project_id = ?
         ORDER BY hf.assigned_at ASC",
    )
    .bind(&project_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("ハイライトフレーム取得に失敗: {}", e))?;

    Ok(rows
        .iter()
        .map(|r| HighlightFrameRow {
            id: col_str(r, "id"),
            highlight_id: col_str(r, "highlight_id"),
            frame_id: col_str(r, "frame_id"),
            assigned_at: col_str(r, "assigned_at"),
        })
        .collect())
}

#[tauri::command]
pub async fn get_source_critiques_by_project(
    app: AppHandle,
    project_id: String,
) -> Result<Vec<SourceCritiqueResponse>, String> {
    let pool = get_pool(&app)?;
    // project_idに紐づくpaperのsource_critiquesを取得
    // Note: source_critiquesはpaper_idでリンクされているが、
    // プロジェクトスコープではハイライト経由で紐づく論文を使う
    let rows = sqlx::query(
        "SELECT DISTINCT sc.* FROM source_critiques sc
         WHERE sc.paper_id IN (
             SELECT DISTINCT h.paper_id FROM highlights h
             JOIN highlight_codes hc ON hc.highlight_id = h.id
             JOIN codes c ON c.id = hc.code_id
             WHERE c.project_id = ?
         )
         ORDER BY sc.updated_at DESC",
    )
    .bind(&project_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| format!("史料批判一覧取得に失敗: {}", e))?;

    rows.iter().map(parse_source_critique).collect()
}

#[tauri::command]
pub async fn delete_source_critique(app: AppHandle, id: String) -> Result<(), String> {
    let pool = get_pool(&app)?;
    sqlx::query("DELETE FROM source_critiques WHERE id = ?")
        .bind(&id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| format!("史料批判削除に失敗: {}", e))?;
    Ok(())
}

// ════════════════════════════════════════════════════════════════
// レポート生成（Markdown — AIなし・データの機械的な構造化のみ）
// ════════════════════════════════════════════════════════════════

struct ReportLabels {
    title: &'static str,
    method: &'static str,
    generated_at: &'static str,
    codebook: &'static str,
    no_codes: &'static str,
    code_name: &'static str,
    kind: &'static str,
    assignment_count: &'static str,
    description: &'static str,
    coding_matrix: &'static str,
    no_data: &'static str,
    code: &'static str,
    timeline: &'static str,
    no_events: &'static str,
    approx_suffix: &'static str,
    importance: &'static str,
    actor_map: &'static str,
    no_actors: &'static str,
    name: &'static str,
    position: &'static str,
    influence: &'static str,
    level: &'static str,
    relations: &'static str,
    process_tracing: &'static str,
    overall_assessment: &'static str,
    hypothesis_supported: &'static str,
    hypothesis_rejected: &'static str,
    insufficient_evidence: &'static str,
    main_hypothesis: &'static str,
    alternative_hypothesis: &'static str,
    test_type: &'static str,
    result: &'static str,
    comparative_design: &'static str,
    no_comparative_designs: &'static str,
    case: &'static str,
    framing: &'static str,
    no_frames: &'static str,
    problem_definition: &'static str,
    causal_interpretation: &'static str,
    moral_evaluation: &'static str,
    treatment_recommendation: &'static str,
}

fn report_labels(language: Option<&str>) -> ReportLabels {
    let key = language
        .unwrap_or("ja")
        .split(|c| c == '-' || c == '_')
        .next()
        .unwrap_or("ja")
        .to_ascii_lowercase();

    match key.as_str() {
        "en" => ReportLabels {
            title: "Analysis Report",
            method: "Analysis Method",
            generated_at: "Generated At",
            codebook: "Codebook",
            no_codes: "*No codes registered*",
            code_name: "Code Name",
            kind: "Type",
            assignment_count: "Assignments",
            description: "Description",
            coding_matrix: "Coding Matrix",
            no_data: "*No data*",
            code: "Code",
            timeline: "Timeline",
            no_events: "*No events registered*",
            approx_suffix: " (approx.)",
            importance: "Importance",
            actor_map: "Actor Map",
            no_actors: "*No actors registered*",
            name: "Name",
            position: "Position",
            influence: "Influence",
            level: "Level",
            relations: "Relations",
            process_tracing: "Process Tracing",
            overall_assessment: "Overall Assessment",
            hypothesis_supported: "Hypothesis supported",
            hypothesis_rejected: "Hypothesis rejected",
            insufficient_evidence: "Insufficient evidence",
            main_hypothesis: "Main Hypothesis",
            alternative_hypothesis: "Alternative Hypothesis",
            test_type: "Test Type",
            result: "Result",
            comparative_design: "Comparative Case Design",
            no_comparative_designs: "*No comparative designs registered*",
            case: "Case",
            framing: "Framing Analysis",
            no_frames: "*No frames registered*",
            problem_definition: "Problem Definition",
            causal_interpretation: "Causal Interpretation",
            moral_evaluation: "Moral Evaluation",
            treatment_recommendation: "Treatment Recommendation",
        },
        "fr" => ReportLabels {
            title: "Rapport d'analyse",
            method: "Méthode d'analyse",
            generated_at: "Généré le",
            codebook: "Livre de codes",
            no_codes: "*Aucun code enregistré*",
            code_name: "Nom du code",
            kind: "Type",
            assignment_count: "Assignations",
            description: "Description",
            coding_matrix: "Matrice de codage",
            no_data: "*Aucune donnée*",
            code: "Code",
            timeline: "Chronologie",
            no_events: "*Aucun événement enregistré*",
            approx_suffix: " (env.)",
            importance: "Importance",
            actor_map: "Carte des acteurs",
            no_actors: "*Aucun acteur enregistré*",
            name: "Nom",
            position: "Position",
            influence: "Influence",
            level: "Niveau",
            relations: "Relations",
            process_tracing: "Traçage de processus",
            overall_assessment: "Évaluation globale",
            hypothesis_supported: "Hypothèse soutenue",
            hypothesis_rejected: "Hypothèse rejetée",
            insufficient_evidence: "Preuves insuffisantes",
            main_hypothesis: "Hypothèse principale",
            alternative_hypothesis: "Hypothèse alternative",
            test_type: "Type de test",
            result: "Résultat",
            comparative_design: "Design comparatif de cas",
            no_comparative_designs: "*Aucun design comparatif enregistré*",
            case: "Cas",
            framing: "Analyse de cadrage",
            no_frames: "*Aucun cadre enregistré*",
            problem_definition: "Définition du problème",
            causal_interpretation: "Interprétation causale",
            moral_evaluation: "Évaluation morale",
            treatment_recommendation: "Recommandation de traitement",
        },
        "af" => ReportLabels {
            title: "Analiseverslag",
            method: "Ontledingsmetode",
            generated_at: "Gegenereer op",
            codebook: "Kodeboek",
            no_codes: "*Geen kodes geregistreer nie*",
            code_name: "Kodenaam",
            kind: "Tipe",
            assignment_count: "Toekennings",
            description: "Beskrywing",
            coding_matrix: "Koderingsmatriks",
            no_data: "*Geen data nie*",
            code: "Kode",
            timeline: "Tydlyn",
            no_events: "*Geen gebeure geregistreer nie*",
            approx_suffix: " (ongeveer)",
            importance: "Belangrikheid",
            actor_map: "Akteurkaart",
            no_actors: "*Geen akteurs geregistreer nie*",
            name: "Naam",
            position: "Posisie",
            influence: "Invloed",
            level: "Vlak",
            relations: "Verhoudings",
            process_tracing: "Prosesnasporing",
            overall_assessment: "Algehele beoordeling",
            hypothesis_supported: "Hipotese ondersteun",
            hypothesis_rejected: "Hipotese verwerp",
            insufficient_evidence: "Onvoldoende bewyse",
            main_hypothesis: "Hoofhipotese",
            alternative_hypothesis: "Alternatiewe hipotese",
            test_type: "Toetstipe",
            result: "Resultaat",
            comparative_design: "Vergelykende gevalontwerp",
            no_comparative_designs: "*Geen vergelykende ontwerpe geregistreer nie*",
            case: "Geval",
            framing: "Raamwerk-ontleding",
            no_frames: "*Geen rame geregistreer nie*",
            problem_definition: "Probleemdefinisie",
            causal_interpretation: "Kousale interpretasie",
            moral_evaluation: "Morele evaluering",
            treatment_recommendation: "Behandelingsaanbeveling",
        },
        _ => ReportLabels {
            title: "分析レポート",
            method: "分析手法",
            generated_at: "生成日時",
            codebook: "コードブック",
            no_codes: "*コードが登録されていません*",
            code_name: "コード名",
            kind: "種別",
            assignment_count: "割当数",
            description: "説明",
            coding_matrix: "コーディングマトリクス",
            no_data: "*データなし*",
            code: "コード",
            timeline: "タイムライン",
            no_events: "*イベントが登録されていません*",
            approx_suffix: "頃",
            importance: "重要度",
            actor_map: "アクターマップ",
            no_actors: "*アクターが登録されていません*",
            name: "名前",
            position: "立場",
            influence: "影響力",
            level: "レベル",
            relations: "関係",
            process_tracing: "プロセス・トレーシング",
            overall_assessment: "総合評価",
            hypothesis_supported: "仮説を支持",
            hypothesis_rejected: "仮説を棄却",
            insufficient_evidence: "証拠不十分",
            main_hypothesis: "主仮説",
            alternative_hypothesis: "対抗仮説",
            test_type: "テスト種別",
            result: "結果",
            comparative_design: "比較ケース設計",
            no_comparative_designs: "*比較デザインが登録されていません*",
            case: "ケース",
            framing: "フレーミング分析",
            no_frames: "*フレームが登録されていません*",
            problem_definition: "問題定義",
            causal_interpretation: "因果解釈",
            moral_evaluation: "道徳評価",
            treatment_recommendation: "処方",
        },
    }
}

#[tauri::command]
pub async fn generate_analysis_report(
    app: AppHandle,
    project_id: String,
    sections: Vec<String>,
    language: Option<String>,
) -> Result<String, String> {
    let pool = get_pool(&app)?;
    let labels = report_labels(language.as_deref());

    // プロジェクト情報
    let proj_row = sqlx::query("SELECT * FROM projects WHERE id = ?")
        .bind(&project_id)
        .fetch_optional(pool.as_ref())
        .await
        .map_err(|e| format!("プロジェクト取得に失敗: {}", e))?
        .ok_or_else(|| "プロジェクトが見つかりません".to_string())?;

    let project = parse_project(&proj_row)?;
    let mut report = format!(
        "# {}: {}\n\n**{}**: {}  \n**{}**: {}\n\n---\n\n",
        labels.title,
        project.name,
        labels.method,
        project.method_type,
        labels.generated_at,
        chrono::Utc::now().format("%Y-%m-%d %H:%M")
    );

    for section in &sections {
        match section.as_str() {
            "codebook" => {
                report.push_str(&format!("## {}\n\n", labels.codebook));
                let code_rows = sqlx::query(
                    "SELECT c.*, (
                        SELECT COUNT(*) FROM highlight_codes hc WHERE hc.code_id = c.id
                    ) + (
                        SELECT COUNT(*) FROM note_segment_codes nsc WHERE nsc.code_id = c.id
                    ) + (
                        SELECT COUNT(*) FROM source_segment_codes ssc WHERE ssc.code_id = c.id
                    ) as count FROM codes c WHERE c.project_id = ? ORDER BY c.sort_order ASC",
                )
                .bind(&project_id)
                .fetch_all(pool.as_ref())
                .await
                .map_err(|e| format!("コード取得に失敗: {}", e))?;

                if code_rows.is_empty() {
                    report.push_str(&format!("{}\n\n", labels.no_codes));
                } else {
                    report.push_str(&format!(
                        "| {} | {} | {} | {} |\n",
                        labels.code_name, labels.kind, labels.assignment_count, labels.description
                    ));
                    report.push_str("|----------|------|--------|------|\n");
                    for row in &code_rows {
                        let name = col_str(row, "name");
                        let code_type = col_str(row, "code_type");
                        let count: i64 = row.try_get("count").unwrap_or(0);
                        let desc = col_opt_str(row, "description").unwrap_or_default();
                        report.push_str(&format!(
                            "| {} | {} | {} | {} |\n",
                            name, code_type, count, desc
                        ));
                    }
                    report.push('\n');
                }
            }
            "matrix" => {
                report.push_str(&format!("## {}\n\n", labels.coding_matrix));
                let matrix = get_coding_matrix(app.clone(), project_id.clone()).await?;
                if matrix.rows.is_empty() || matrix.cols.is_empty() {
                    report.push_str(&format!("{}\n\n", labels.no_data));
                } else {
                    // ヘッダー
                    let headers: Vec<String> =
                        matrix.cols.iter().map(|c| c.paper_title.clone()).collect();
                    report.push_str(&format!("| {} | {} |\n", labels.code, headers.join(" | ")));
                    report.push_str(&format!(
                        "|-{}-|\n",
                        headers
                            .iter()
                            .map(|_| "---")
                            .collect::<Vec<_>>()
                            .join("-|-")
                    ));
                    for row in &matrix.rows {
                        let vals: Vec<String> = matrix
                            .cols
                            .iter()
                            .map(|col| {
                                let key = format!("{}:{}", row.code_id, col.paper_id);
                                matrix
                                    .cells
                                    .get(&key)
                                    .map(|v| v.to_string())
                                    .unwrap_or_else(|| "0".to_string())
                            })
                            .collect();
                        report.push_str(&format!("| {} | {} |\n", row.code_name, vals.join(" | ")));
                    }
                    report.push('\n');
                }
            }
            "timeline" => {
                report.push_str(&format!("## {}\n\n", labels.timeline));
                let events = get_timeline_events(app.clone(), project_id.clone()).await?;
                if events.is_empty() {
                    report.push_str(&format!("{}\n\n", labels.no_events));
                } else {
                    for event in &events {
                        let date_marker = if event.date_type == "approximate" {
                            labels.approx_suffix
                        } else {
                            ""
                        };
                        report.push_str(&format!(
                            "- **{}{}** — {} ({}: {}/5)\n",
                            event.event_date, date_marker, event.title, labels.importance, event.importance
                        ));
                        if let Some(desc) = &event.description {
                            report.push_str(&format!("  {}\n", desc));
                        }
                    }
                    report.push('\n');
                }
            }
            "actors" => {
                report.push_str(&format!("## {}\n\n", labels.actor_map));
                let map = get_actor_map(app.clone(), project_id.clone()).await?;
                if map.actors.is_empty() {
                    report.push_str(&format!("{}\n\n", labels.no_actors));
                } else {
                    report.push_str(&format!(
                        "| {} | {} | {} | {} | {} |\n",
                        labels.name, labels.kind, labels.position, labels.influence, labels.level
                    ));
                    report.push_str("|------|------|------|--------|--------|\n");
                    for actor in &map.actors {
                        report.push_str(&format!(
                            "| {} | {} | {} | {}/5 | {} |\n",
                            actor.name,
                            actor.actor_type,
                            actor.position,
                            actor.influence,
                            actor.level
                        ));
                    }
                    report.push('\n');
                    if !map.relations.is_empty() {
                        report.push_str(&format!("### {}\n\n", labels.relations));
                        for rel in &map.relations {
                            report.push_str(&format!(
                                "- {} → {} ({})\n",
                                rel.actor_from, rel.actor_to, rel.relation_type
                            ));
                        }
                        report.push('\n');
                    }
                }
            }
            "process_tracing" => {
                report.push_str(&format!("## {}\n\n", labels.process_tracing));
                let pt = get_pt_data(app.clone(), project_id.clone()).await?;
                let summary = get_pt_summary(app.clone(), project_id.clone()).await?;
                let overall_verdict = match summary.overall_verdict.as_str() {
                    "仮説を支持" => labels.hypothesis_supported,
                    "仮説を棄却" => labels.hypothesis_rejected,
                    "証拠不十分" => labels.insufficient_evidence,
                    other => other,
                };

                report.push_str(&format!(
                    "**{}**: {}\n\n",
                    labels.overall_assessment, overall_verdict
                ));

                for hw in &pt.hypotheses {
                    let hyp_type = if hw.hypothesis.is_main {
                        labels.main_hypothesis
                    } else {
                        labels.alternative_hypothesis
                    };
                    report.push_str(&format!("### {} ({})\n\n", hw.hypothesis.title, hyp_type));
                    if let Some(desc) = &hw.hypothesis.description {
                        report.push_str(&format!("{}\n\n", desc));
                    }
                    if !hw.evidences.is_empty() {
                        report.push_str(&format!(
                            "| {} | {} | {} |\n",
                            labels.test_type, labels.description, labels.result
                        ));
                        report.push_str("|------------|------|------|\n");
                        for ev in &hw.evidences {
                            report.push_str(&format!(
                                "| {} | {} | {} |\n",
                                ev.test_type, ev.description, ev.result
                            ));
                        }
                        report.push('\n');
                    }
                }
            }
            "comparative" => {
                report.push_str(&format!("## {}\n\n", labels.comparative_design));
                let designs = get_comparative_design(app.clone(), project_id.clone()).await?;
                if designs.is_empty() {
                    report.push_str(&format!("{}\n\n", labels.no_comparative_designs));
                } else {
                    for d in &designs {
                        report.push_str(&format!(
                            "### {} ({})\n\n",
                            d.design.title, d.design.design_type
                        ));
                        if !d.cases.is_empty() && !d.variables.is_empty() {
                            let var_names: Vec<&str> =
                                d.variables.iter().map(|v| v.name.as_str()).collect();
                            report.push_str(&format!("| {} | {} |\n", labels.case, var_names.join(" | ")));
                            report.push_str(&format!(
                                "|-{}-|\n",
                                var_names
                                    .iter()
                                    .map(|_| "---")
                                    .collect::<Vec<_>>()
                                    .join("-|-")
                            ));
                            for case in &d.cases {
                                let vals: Vec<String> = d
                                    .variables
                                    .iter()
                                    .map(|var| {
                                        d.cells
                                            .iter()
                                            .find(|c| {
                                                c.case_id == case.id && c.variable_id == var.id
                                            })
                                            .and_then(|c| c.value.clone())
                                            .unwrap_or_else(|| "-".to_string())
                                    })
                                    .collect();
                                report.push_str(&format!(
                                    "| {} | {} |\n",
                                    case.name,
                                    vals.join(" | ")
                                ));
                            }
                            report.push('\n');
                        }
                    }
                }
            }
            "framing" => {
                report.push_str(&format!("## {}\n\n", labels.framing));
                let frames = get_frames(app.clone(), project_id.clone()).await?;
                if frames.is_empty() {
                    report.push_str(&format!("{}\n\n", labels.no_frames));
                } else {
                    for frame in &frames {
                        report.push_str(&format!("### {}\n\n", frame.name));
                        if let Some(pd) = &frame.problem_definition {
                            report.push_str(&format!("- **{}**: {}\n", labels.problem_definition, pd));
                        }
                        if let Some(ci) = &frame.causal_interpretation {
                            report.push_str(&format!("- **{}**: {}\n", labels.causal_interpretation, ci));
                        }
                        if let Some(me) = &frame.moral_evaluation {
                            report.push_str(&format!("- **{}**: {}\n", labels.moral_evaluation, me));
                        }
                        if let Some(tr) = &frame.treatment_recommendation {
                            report.push_str(&format!("- **{}**: {}\n", labels.treatment_recommendation, tr));
                        }
                        report.push('\n');
                    }
                }
            }
            _ => {}
        }
    }

    Ok(report)
}

fn extract_source_text(path: &str, file_type: &str) -> Result<String, String> {
    match file_type {
        "md" | "markdown" | "txt" => std::fs::read_to_string(path)
            .map(|text| normalize_extracted_text(&text))
            .map_err(|e| format!("テキストファイルの読み込みに失敗: {}", e)),
        "docx" => extract_docx_text(path).map(|text| normalize_extracted_text(&text)),
        "pdf" => extract_pdf_text(path).map(|text| normalize_extracted_text(&text)),
        other => Err(format!(
            "未対応のファイル形式です: {}。docx / pdf / md を選択してください",
            if other.is_empty() {
                "(拡張子なし)"
            } else {
                other
            }
        )),
    }
}

fn extract_docx_text(path: &str) -> Result<String, String> {
    let file = File::open(path).map_err(|e| format!("DOCXを開けません: {}", e))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("DOCXの展開に失敗: {}", e))?;
    let mut document = archive
        .by_name("word/document.xml")
        .map_err(|e| format!("DOCX本文が見つかりません: {}", e))?;

    let mut xml = String::new();
    document
        .read_to_string(&mut xml)
        .map_err(|e| format!("DOCX本文の読み込みに失敗: {}", e))?;

    Ok(strip_docx_xml(&xml))
}

fn extract_pdf_text(path: &str) -> Result<String, String> {
    let document = lopdf::Document::load(path).map_err(|e| format!("PDFを開けません: {}", e))?;
    let pages: Vec<u32> = document.get_pages().keys().copied().collect();
    if pages.is_empty() {
        return Ok(String::new());
    }
    document
        .extract_text(&pages)
        .map_err(|e| format!("PDF本文の抽出に失敗: {}", e))
}

fn strip_docx_xml(xml: &str) -> String {
    let with_breaks = xml
        .replace("</w:p>", "\n")
        .replace("<w:tab/>", "\t")
        .replace("<w:tab />", "\t")
        .replace("<w:br/>", "\n")
        .replace("<w:br />", "\n")
        .replace("<w:cr/>", "\n")
        .replace("<w:cr />", "\n");

    let mut text = String::new();
    let mut in_tag = false;
    for ch in with_breaks.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => text.push(ch),
            _ => {}
        }
    }

    decode_xml_entities(&text)
}

fn decode_xml_entities(text: &str) -> String {
    text.replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
}

fn normalize_extracted_text(text: &str) -> String {
    let mut lines = Vec::new();
    let mut previous_blank = false;

    for raw_line in text.lines() {
        let line = raw_line.trim();
        if line.is_empty() {
            if !previous_blank && !lines.is_empty() {
                lines.push(String::new());
            }
            previous_blank = true;
        } else {
            lines.push(line.to_string());
            previous_blank = false;
        }
    }

    while lines.last().is_some_and(|line| line.is_empty()) {
        lines.pop();
    }

    normalize_nfc(&lines.join("\n"))
}

fn count_words(text: &str) -> i32 {
    text.split_whitespace().count() as i32
}

// ════════════════════════════════════════════════════════════════
// エイリアスコマンド — フロントエンドが get_qual_projects 等で呼び出す
// Rust 側は create_project / get_projects / delete_project だが
// フロントエンド (useQualitativeStore) は create_qual_project 等を使用
// ════════════════════════════════════════════════════════════════

/// get_qual_projects — get_projects のエイリアス
#[tauri::command]
pub async fn get_qual_projects(app: AppHandle) -> Result<Vec<ProjectResponse>, String> {
    get_projects(app).await
}

/// create_qual_project — フロントエンドは name, description をトップレベル引数で渡す
#[tauri::command]
pub async fn create_qual_project(
    app: AppHandle,
    name: String,
    description: Option<String>,
) -> Result<ProjectResponse, String> {
    let input = CreateProjectDto {
        name,
        description,
        method_type: "thematic".to_string(),
    };
    create_project(app, input).await
}

/// delete_qual_project — delete_project のエイリアス
#[tauri::command]
pub async fn delete_qual_project(app: AppHandle, id: String) -> Result<(), String> {
    delete_project(app, id).await
}

/// get_codes — get_code_tree のエイリアス（フロントエンドが get_codes で呼ぶ場合の互換）
#[tauri::command]
pub async fn get_codes(app: AppHandle, project_id: String) -> Result<Vec<CodeNode>, String> {
    get_code_tree(app, project_id).await
}
