-- V007__qualitative_sources.sql
-- 質的分析用の分析ソースを、文献ライブラリ(papers)から分離して管理する。

CREATE TABLE IF NOT EXISTS qualitative_sources (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'primary_source',
    file_type TEXT NOT NULL,
    file_path TEXT,
    content TEXT NOT NULL DEFAULT '',
    word_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_qualitative_sources_project
    ON qualitative_sources(project_id, updated_at);

CREATE TABLE IF NOT EXISTS source_segment_codes (
    id TEXT PRIMARY KEY NOT NULL,
    source_id TEXT NOT NULL,
    code_id TEXT NOT NULL,
    segment_text TEXT NOT NULL,
    offset_start INTEGER,
    offset_end INTEGER,
    memo TEXT,
    assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (source_id) REFERENCES qualitative_sources(id) ON DELETE CASCADE,
    FOREIGN KEY (code_id) REFERENCES codes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_source_segment_codes_source
    ON source_segment_codes(source_id);

CREATE INDEX IF NOT EXISTS idx_source_segment_codes_code
    ON source_segment_codes(code_id);

CREATE TABLE IF NOT EXISTS qual_source_critiques (
    id TEXT PRIMARY KEY NOT NULL,
    source_id TEXT NOT NULL,
    author_info TEXT,
    creation_date TEXT,
    is_date_estimated INTEGER NOT NULL DEFAULT 0,
    location TEXT,
    source_type TEXT,
    authenticity TEXT,
    archive_info TEXT,
    intent TEXT,
    audience TEXT,
    bias_level TEXT,
    bias_reason TEXT,
    consistency TEXT,
    reliability_score INTEGER NOT NULL DEFAULT 3,
    researcher_notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (source_id) REFERENCES qualitative_sources(id) ON DELETE CASCADE,
    UNIQUE(source_id)
);

CREATE INDEX IF NOT EXISTS idx_qual_source_critiques_source
    ON qual_source_critiques(source_id);
