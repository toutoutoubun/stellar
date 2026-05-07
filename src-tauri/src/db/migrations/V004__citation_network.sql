-- V004__citation_network.sql
-- 引用ネットワーク・読書ステータス・関連論文サジェスト

-- papers テーブルに新カラムを追加
ALTER TABLE papers ADD COLUMN reading_status TEXT NOT NULL DEFAULT 'unread'
  CHECK(reading_status IN ('unread','reading','done','revisit'));

ALTER TABLE papers ADD COLUMN ss_paper_id TEXT;

ALTER TABLE papers ADD COLUMN references_json TEXT NOT NULL DEFAULT '[]';

ALTER TABLE papers ADD COLUMN cited_by_json TEXT NOT NULL DEFAULT '[]';

ALTER TABLE papers ADD COLUMN references_fetched_at TEXT;

-- 関連論文サジェストテーブル
CREATE TABLE IF NOT EXISTS paper_recommendations (
  id TEXT PRIMARY KEY,
  paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  recommended_paper_id TEXT,
  title TEXT NOT NULL,
  authors TEXT NOT NULL DEFAULT '[]',
  year INTEGER,
  doi TEXT,
  url TEXT,
  abstract TEXT,
  ss_paper_id TEXT,
  relevance_score REAL,
  is_imported INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- インデックス
CREATE INDEX idx_papers_reading_status ON papers(reading_status);
CREATE INDEX idx_papers_ss_paper_id ON papers(ss_paper_id);
CREATE INDEX idx_recommendations_paper_id ON paper_recommendations(paper_id);
CREATE INDEX idx_recommendations_is_imported ON paper_recommendations(is_imported);
