-- V002__qualitative.sql
-- 質的研究モジュール — CAQDAS + 歴史・政治研究ツール
-- projects, codes (hierarchical), highlight_codes, note_segment_codes,
-- memos, source_critiques, timeline_events, actors, actor_relations,
-- pt_hypotheses, pt_evidences, comparative_designs, comparative_cases,
-- comparative_variables, comparative_cells, frames, highlight_frames

-- ════════════════════════════════════════════════════════════════
-- プロジェクト
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    method_type TEXT NOT NULL DEFAULT 'thematic',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at);

-- ════════════════════════════════════════════════════════════════
-- コード（階層型）
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS codes (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL,
    parent_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL DEFAULT '#6366F1',
    code_type TEXT NOT NULL DEFAULT 'thematic',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES codes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_codes_project_id ON codes(project_id);
CREATE INDEX IF NOT EXISTS idx_codes_parent_id ON codes(parent_id);

-- ════════════════════════════════════════════════════════════════
-- ハイライト × コード（多対多）
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS highlight_codes (
    id TEXT PRIMARY KEY NOT NULL,
    highlight_id TEXT NOT NULL,
    code_id TEXT NOT NULL,
    coder_id TEXT,
    assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (highlight_id) REFERENCES highlights(id) ON DELETE CASCADE,
    FOREIGN KEY (code_id) REFERENCES codes(id) ON DELETE CASCADE,
    UNIQUE(highlight_id, code_id)
);

CREATE INDEX IF NOT EXISTS idx_highlight_codes_highlight ON highlight_codes(highlight_id);
CREATE INDEX IF NOT EXISTS idx_highlight_codes_code ON highlight_codes(code_id);

-- ════════════════════════════════════════════════════════════════
-- ノートセグメント × コード
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS note_segment_codes (
    id TEXT PRIMARY KEY NOT NULL,
    note_id TEXT NOT NULL,
    code_id TEXT NOT NULL,
    segment_text TEXT,
    offset_start INTEGER,
    offset_end INTEGER,
    coder_id TEXT,
    assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
    FOREIGN KEY (code_id) REFERENCES codes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_note_segment_codes_note ON note_segment_codes(note_id);
CREATE INDEX IF NOT EXISTS idx_note_segment_codes_code ON note_segment_codes(code_id);

-- ════════════════════════════════════════════════════════════════
-- メモ（分析メモ）
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS memos (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    content TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memos_project_id ON memos(project_id);
CREATE INDEX IF NOT EXISTS idx_memos_target ON memos(target_type, target_id);

-- ════════════════════════════════════════════════════════════════
-- 史料批判シート
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS source_critiques (
    id TEXT PRIMARY KEY NOT NULL,
    paper_id TEXT NOT NULL,
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
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE,
    UNIQUE(paper_id)
);

CREATE INDEX IF NOT EXISTS idx_source_critiques_paper ON source_critiques(paper_id);

-- ════════════════════════════════════════════════════════════════
-- タイムラインイベント
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS timeline_events (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    event_date TEXT NOT NULL,
    date_type TEXT NOT NULL DEFAULT 'exact',
    event_type TEXT NOT NULL DEFAULT 'political',
    importance INTEGER NOT NULL DEFAULT 3,
    lane TEXT,
    paper_id TEXT,
    highlight_id TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE SET NULL,
    FOREIGN KEY (highlight_id) REFERENCES highlights(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_timeline_events_project ON timeline_events(project_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_date ON timeline_events(event_date);

-- ════════════════════════════════════════════════════════════════
-- アクター
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS actors (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    actor_type TEXT NOT NULL DEFAULT 'state',
    position TEXT NOT NULL DEFAULT 'neutral',
    influence INTEGER NOT NULL DEFAULT 3,
    level TEXT NOT NULL DEFAULT 'national',
    description TEXT,
    x_position REAL,
    y_position REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_actors_project ON actors(project_id);

-- ════════════════════════════════════════════════════════════════
-- アクター関係
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS actor_relations (
    id TEXT PRIMARY KEY NOT NULL,
    actor_from TEXT NOT NULL,
    actor_to TEXT NOT NULL,
    relation_type TEXT NOT NULL DEFAULT 'alliance',
    start_year INTEGER,
    end_year INTEGER,
    description TEXT,
    paper_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (actor_from) REFERENCES actors(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_to) REFERENCES actors(id) ON DELETE CASCADE,
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_actor_relations_from ON actor_relations(actor_from);
CREATE INDEX IF NOT EXISTS idx_actor_relations_to ON actor_relations(actor_to);

-- ════════════════════════════════════════════════════════════════
-- プロセス・トレーシング — 仮説
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pt_hypotheses (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    is_main INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pt_hypotheses_project ON pt_hypotheses(project_id);

-- ════════════════════════════════════════════════════════════════
-- プロセス・トレーシング — 証拠
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pt_evidences (
    id TEXT PRIMARY KEY NOT NULL,
    hypothesis_id TEXT NOT NULL,
    description TEXT NOT NULL,
    test_type TEXT NOT NULL DEFAULT 'hoop',
    result TEXT NOT NULL DEFAULT 'pending',
    paper_id TEXT,
    highlight_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (hypothesis_id) REFERENCES pt_hypotheses(id) ON DELETE CASCADE,
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE SET NULL,
    FOREIGN KEY (highlight_id) REFERENCES highlights(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_pt_evidences_hypothesis ON pt_evidences(hypothesis_id);

-- ════════════════════════════════════════════════════════════════
-- 比較ケース設計
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS comparative_designs (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL,
    design_type TEXT NOT NULL DEFAULT 'MSSD',
    title TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comparative_designs_project ON comparative_designs(project_id);

-- ════════════════════════════════════════════════════════════════
-- 比較ケース
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS comparative_cases (
    id TEXT PRIMARY KEY NOT NULL,
    design_id TEXT NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (design_id) REFERENCES comparative_designs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comparative_cases_design ON comparative_cases(design_id);

-- ════════════════════════════════════════════════════════════════
-- 比較変数
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS comparative_variables (
    id TEXT PRIMARY KEY NOT NULL,
    design_id TEXT NOT NULL,
    name TEXT NOT NULL,
    var_type TEXT NOT NULL DEFAULT 'independent',
    sort_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (design_id) REFERENCES comparative_designs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comparative_variables_design ON comparative_variables(design_id);

-- ════════════════════════════════════════════════════════════════
-- 比較セル（ケース × 変数のマトリクス値）
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS comparative_cells (
    id TEXT PRIMARY KEY NOT NULL,
    case_id TEXT NOT NULL,
    variable_id TEXT NOT NULL,
    value TEXT,
    paper_id TEXT,
    FOREIGN KEY (case_id) REFERENCES comparative_cases(id) ON DELETE CASCADE,
    FOREIGN KEY (variable_id) REFERENCES comparative_variables(id) ON DELETE CASCADE,
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE SET NULL,
    UNIQUE(case_id, variable_id)
);

CREATE INDEX IF NOT EXISTS idx_comparative_cells_case ON comparative_cells(case_id);
CREATE INDEX IF NOT EXISTS idx_comparative_cells_variable ON comparative_cells(variable_id);

-- ════════════════════════════════════════════════════════════════
-- フレーム（Entman のフレーミング分析）
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS frames (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    problem_definition TEXT,
    causal_interpretation TEXT,
    moral_evaluation TEXT,
    treatment_recommendation TEXT,
    color TEXT NOT NULL DEFAULT '#8B5CF6',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_frames_project ON frames(project_id);

-- ════════════════════════════════════════════════════════════════
-- ハイライト × フレーム（多対多）
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS highlight_frames (
    id TEXT PRIMARY KEY NOT NULL,
    highlight_id TEXT NOT NULL,
    frame_id TEXT NOT NULL,
    assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (highlight_id) REFERENCES highlights(id) ON DELETE CASCADE,
    FOREIGN KEY (frame_id) REFERENCES frames(id) ON DELETE CASCADE,
    UNIQUE(highlight_id, frame_id)
);

CREATE INDEX IF NOT EXISTS idx_highlight_frames_highlight ON highlight_frames(highlight_id);
CREATE INDEX IF NOT EXISTS idx_highlight_frames_frame ON highlight_frames(frame_id);
