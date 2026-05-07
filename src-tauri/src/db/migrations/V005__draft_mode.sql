-- V005__draft_mode.sql
-- 下書きモード — 長文執筆・章管理・引用挿入機能

-- notes テーブルに下書き関連カラムを追加
ALTER TABLE notes ADD COLUMN is_draft INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notes ADD COLUMN draft_meta TEXT NOT NULL DEFAULT '{}';
ALTER TABLE notes ADD COLUMN word_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notes ADD COLUMN reading_time_min INTEGER NOT NULL DEFAULT 0;

-- 下書き引用テーブル（ノート内で使用する論文引用を管理）
CREATE TABLE IF NOT EXISTS draft_citations (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  citation_key TEXT NOT NULL,
  citation_style TEXT NOT NULL DEFAULT 'apa7',
  inline_text TEXT NOT NULL,
  bibliography_text TEXT NOT NULL,
  page_ref TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(note_id, paper_id, page_ref)
);

-- 下書き章テーブル（長文ノートの章構成を管理）
CREATE TABLE IF NOT EXISTS draft_chapters (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  word_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- インデックス
CREATE INDEX idx_notes_is_draft ON notes(is_draft);
CREATE INDEX idx_draft_citations_note_id ON draft_citations(note_id);
CREATE INDEX idx_draft_citations_paper_id ON draft_citations(paper_id);
CREATE INDEX idx_draft_chapters_note_id ON draft_chapters(note_id, order_index);
