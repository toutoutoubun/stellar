-- V008__qualitative_source_highlights.sql
-- 質的分析ソースPDFのハイライトを、文献ハイライトとは別に管理する。

CREATE TABLE IF NOT EXISTS qualitative_source_highlights (
    id TEXT PRIMARY KEY NOT NULL,
    source_id TEXT NOT NULL,
    text TEXT NOT NULL,
    comment TEXT,
    color TEXT NOT NULL DEFAULT 'yellow',
    page INTEGER NOT NULL,
    rect TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY (source_id) REFERENCES qualitative_sources(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_qual_source_highlights_source
    ON qualitative_source_highlights(source_id, page, created_at);

CREATE TABLE IF NOT EXISTS source_highlight_codes (
    id TEXT PRIMARY KEY NOT NULL,
    source_highlight_id TEXT NOT NULL,
    code_id TEXT NOT NULL,
    assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (source_highlight_id) REFERENCES qualitative_source_highlights(id) ON DELETE CASCADE,
    FOREIGN KEY (code_id) REFERENCES codes(id) ON DELETE CASCADE,
    UNIQUE(source_highlight_id, code_id)
);

CREATE INDEX IF NOT EXISTS idx_source_highlight_codes_highlight
    ON source_highlight_codes(source_highlight_id);

CREATE INDEX IF NOT EXISTS idx_source_highlight_codes_code
    ON source_highlight_codes(code_id);
