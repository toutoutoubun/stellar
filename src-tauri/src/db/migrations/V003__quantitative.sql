-- V003__quantitative.sql
-- 量的研究モジュール — Quantitative Lab
-- datasets, variables, data_rows, analyses, token_frequencies
-- トリガー: row_count 自動更新, updated_at 自動更新
-- インデックス: パフォーマンス最適化

-- ════════════════════════════════════════════════════════════════
-- データセット
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS datasets (
    id          TEXT PRIMARY KEY NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    source_type TEXT NOT NULL CHECK(source_type IN ('csv','manual','from_codes','from_highlights','from_timeline')),
    source_ref  TEXT,
    row_count   INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ════════════════════════════════════════════════════════════════
-- 変数（データセットの列定義）
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS variables (
    id            TEXT PRIMARY KEY NOT NULL,
    dataset_id    TEXT NOT NULL,
    column_index  INTEGER NOT NULL,
    name          TEXT NOT NULL,
    label         TEXT,
    var_type      TEXT NOT NULL CHECK(var_type IN ('nominal','ordinal','scale','text','date')),
    unit          TEXT,
    likert_min    INTEGER,
    likert_max    INTEGER,
    likert_labels TEXT,
    FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
);

-- ════════════════════════════════════════════════════════════════
-- データ行
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS data_rows (
    id          TEXT PRIMARY KEY NOT NULL,
    dataset_id  TEXT NOT NULL,
    row_index   INTEGER NOT NULL,
    "values"    TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
);

-- ════════════════════════════════════════════════════════════════
-- 分析結果
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS analyses (
    id              TEXT PRIMARY KEY NOT NULL,
    dataset_id      TEXT NOT NULL,
    analysis_type   TEXT NOT NULL,
    name            TEXT NOT NULL,
    parameters      TEXT NOT NULL,
    result          TEXT NOT NULL,
    interpretation  TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
);

-- ════════════════════════════════════════════════════════════════
-- トークン頻度（テキストマイニング用）
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS token_frequencies (
    id              TEXT PRIMARY KEY NOT NULL,
    dataset_id      TEXT NOT NULL,
    variable_id     TEXT NOT NULL,
    token           TEXT NOT NULL,
    frequency       INTEGER NOT NULL DEFAULT 1,
    tf_idf          REAL,
    pos             TEXT,
    document_count  INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE,
    FOREIGN KEY (variable_id) REFERENCES variables(id) ON DELETE CASCADE
);

-- ════════════════════════════════════════════════════════════════
-- トリガー: data_rows INSERT → datasets.row_count 自動更新
-- ════════════════════════════════════════════════════════════════

CREATE TRIGGER IF NOT EXISTS trg_data_rows_insert_count
AFTER INSERT ON data_rows
BEGIN
    UPDATE datasets SET row_count = (
        SELECT COUNT(*) FROM data_rows WHERE dataset_id = NEW.dataset_id
    ) WHERE id = NEW.dataset_id;
END;

-- ════════════════════════════════════════════════════════════════
-- トリガー: data_rows DELETE → datasets.row_count 自動更新
-- ════════════════════════════════════════════════════════════════

CREATE TRIGGER IF NOT EXISTS trg_data_rows_delete_count
AFTER DELETE ON data_rows
BEGIN
    UPDATE datasets SET row_count = (
        SELECT COUNT(*) FROM data_rows WHERE dataset_id = OLD.dataset_id
    ) WHERE id = OLD.dataset_id;
END;

-- ════════════════════════════════════════════════════════════════
-- トリガー: datasets の updated_at 自動更新
-- ════════════════════════════════════════════════════════════════

CREATE TRIGGER IF NOT EXISTS trg_datasets_updated_at
AFTER UPDATE ON datasets
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE datasets SET updated_at = datetime('now')
    WHERE id = NEW.id;
END;

-- ════════════════════════════════════════════════════════════════
-- トリガー: variables の更新時に親 dataset の updated_at を更新
-- ════════════════════════════════════════════════════════════════

CREATE TRIGGER IF NOT EXISTS trg_variables_update_dataset
AFTER UPDATE ON variables
BEGIN
    UPDATE datasets SET updated_at = datetime('now')
    WHERE id = NEW.dataset_id;
END;

-- ════════════════════════════════════════════════════════════════
-- トリガー: analyses の更新時に親 dataset の updated_at を更新
-- ════════════════════════════════════════════════════════════════

CREATE TRIGGER IF NOT EXISTS trg_analyses_update_dataset
AFTER UPDATE ON analyses
BEGIN
    UPDATE datasets SET updated_at = datetime('now')
    WHERE id = NEW.dataset_id;
END;

-- ════════════════════════════════════════════════════════════════
-- インデックス
-- ════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_data_rows_dataset_row
    ON data_rows(dataset_id, row_index);

CREATE INDEX IF NOT EXISTS idx_variables_dataset_col
    ON variables(dataset_id, column_index);

CREATE INDEX IF NOT EXISTS idx_token_frequencies_dataset_token
    ON token_frequencies(dataset_id, token, frequency DESC);

CREATE INDEX IF NOT EXISTS idx_analyses_dataset_type
    ON analyses(dataset_id, analysis_type);

CREATE INDEX IF NOT EXISTS idx_datasets_updated_at
    ON datasets(updated_at);

CREATE INDEX IF NOT EXISTS idx_token_frequencies_variable
    ON token_frequencies(variable_id);
