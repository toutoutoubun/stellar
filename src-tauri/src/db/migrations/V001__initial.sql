-- V001__initial.sql
-- Stellar — 初期スキーマ
-- papers / notes / highlights / links テーブル
-- FTS5 仮想テーブル（trigram tokenizer による日本語部分一致検索）
-- FTS5 同期トリガー（INSERT / UPDATE / DELETE）
-- updated_at 自動更新トリガー
-- パフォーマンス用インデックス

-- ============================================================
-- 1. papers テーブル — 論文メタデータ
-- ============================================================
CREATE TABLE IF NOT EXISTS papers (
    id         TEXT PRIMARY KEY NOT NULL,
    title      TEXT NOT NULL,
    authors    TEXT NOT NULL DEFAULT '[]',          -- JSON配列文字列
    year       INTEGER,
    journal    TEXT,
    volume     TEXT,
    issue      TEXT,
    pages      TEXT,
    doi        TEXT,
    url        TEXT,
    abstract   TEXT,
    pdf_path   TEXT,
    tags       TEXT NOT NULL DEFAULT '[]',          -- JSON配列文字列
    created_at TEXT NOT NULL,                       -- ISO 8601
    updated_at TEXT NOT NULL                        -- ISO 8601
);

-- ============================================================
-- 2. notes テーブル — Markdown ノート
-- ============================================================
CREATE TABLE IF NOT EXISTS notes (
    id         TEXT PRIMARY KEY NOT NULL,
    title      TEXT NOT NULL,
    content    TEXT NOT NULL DEFAULT '',             -- Markdown 本文
    paper_id   TEXT,                                -- 紐づく論文（NULL可 = 独立ノート）
    tags       TEXT NOT NULL DEFAULT '[]',          -- JSON配列文字列
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE SET NULL
);

-- ============================================================
-- 3. highlights テーブル — PDF ハイライト
-- ============================================================
CREATE TABLE IF NOT EXISTS highlights (
    id         TEXT PRIMARY KEY NOT NULL,
    paper_id   TEXT NOT NULL,
    text       TEXT NOT NULL,                       -- 選択されたテキスト
    comment    TEXT,                                -- ユーザーコメント
    color      TEXT NOT NULL DEFAULT 'yellow',      -- 'yellow' | 'blue' | 'green' | 'pink'
    page       INTEGER NOT NULL,                    -- ページ番号
    rect       TEXT NOT NULL DEFAULT '{}',          -- JSON { x1, y1, x2, y2 }
    created_at TEXT NOT NULL,
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
);

-- ============================================================
-- 4. links テーブル — ノート・論文間の双方向リンク
-- ============================================================
CREATE TABLE IF NOT EXISTS links (
    id          TEXT PRIMARY KEY NOT NULL,
    source_type TEXT NOT NULL,                      -- 'note' | 'paper'
    source_id   TEXT NOT NULL,
    target_type TEXT NOT NULL,                      -- 'note' | 'paper'
    target_id   TEXT NOT NULL,
    context     TEXT,                               -- リンクの文脈（任意）
    created_at  TEXT NOT NULL,
    -- 同一ペアの重複リンクを防止するユニーク制約
    UNIQUE(source_type, source_id, target_type, target_id)
);

-- ============================================================
-- 5. FTS5 仮想テーブル — 全文検索用（trigram tokenizer）
-- trigram tokenizer を使用することで、形態素解析なしで
-- 日本語を含む任意の文字列の部分一致検索を実現する
-- ============================================================
-- 論文・ノート統合検索用
CREATE VIRTUAL TABLE IF NOT EXISTS fts_search USING fts5(
    content_id UNINDEXED,
    content_type UNINDEXED,
    title,
    body,
    tokenize='trigram'
);

-- ハイライト検索用（テキスト + コメント）
CREATE VIRTUAL TABLE IF NOT EXISTS fts_highlights USING fts5(
    highlight_id UNINDEXED,
    paper_id UNINDEXED,
    text,
    comment,
    tokenize='trigram'
);

-- ============================================================
-- 6. updated_at 自動更新トリガー
-- UPDATE 時に updated_at を現在時刻に自動セットする
-- ============================================================

-- papers の updated_at 自動更新
CREATE TRIGGER IF NOT EXISTS trg_papers_updated_at
AFTER UPDATE ON papers
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE papers SET updated_at = strftime('%Y-%m-%dT%H:%M:%S+00:00', 'now')
    WHERE id = NEW.id;
END;

-- notes の updated_at 自動更新
CREATE TRIGGER IF NOT EXISTS trg_notes_updated_at
AFTER UPDATE ON notes
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE notes SET updated_at = strftime('%Y-%m-%dT%H:%M:%S+00:00', 'now')
    WHERE id = NEW.id;
END;

-- ============================================================
-- 7. FTS5 同期トリガー — papers
-- ============================================================

-- papers INSERT → FTS に追加
CREATE TRIGGER IF NOT EXISTS fts_papers_insert
AFTER INSERT ON papers
BEGIN
    INSERT INTO fts_search (content_id, content_type, title, body)
    VALUES (
        NEW.id,
        'paper',
        NEW.title,
        COALESCE(NEW.abstract, '') || ' ' || COALESCE(NEW.authors, '')
    );
END;

-- papers UPDATE → FTS を更新（DELETE + INSERT で再構築）
CREATE TRIGGER IF NOT EXISTS fts_papers_update
AFTER UPDATE ON papers
BEGIN
    DELETE FROM fts_search WHERE content_id = OLD.id AND content_type = 'paper';
    INSERT INTO fts_search (content_id, content_type, title, body)
    VALUES (
        NEW.id,
        'paper',
        NEW.title,
        COALESCE(NEW.abstract, '') || ' ' || COALESCE(NEW.authors, '')
    );
END;

-- papers DELETE → FTS から削除
CREATE TRIGGER IF NOT EXISTS fts_papers_delete
AFTER DELETE ON papers
BEGIN
    DELETE FROM fts_search WHERE content_id = OLD.id AND content_type = 'paper';
END;

-- ============================================================
-- 8. FTS5 同期トリガー — notes
-- ============================================================

-- notes INSERT → FTS に追加
CREATE TRIGGER IF NOT EXISTS fts_notes_insert
AFTER INSERT ON notes
BEGIN
    INSERT INTO fts_search (content_id, content_type, title, body)
    VALUES (NEW.id, 'note', NEW.title, NEW.content);
END;

-- notes UPDATE → FTS を更新
CREATE TRIGGER IF NOT EXISTS fts_notes_update
AFTER UPDATE ON notes
BEGIN
    DELETE FROM fts_search WHERE content_id = OLD.id AND content_type = 'note';
    INSERT INTO fts_search (content_id, content_type, title, body)
    VALUES (NEW.id, 'note', NEW.title, NEW.content);
END;

-- notes DELETE → FTS から削除
CREATE TRIGGER IF NOT EXISTS fts_notes_delete
AFTER DELETE ON notes
BEGIN
    DELETE FROM fts_search WHERE content_id = OLD.id AND content_type = 'note';
END;

-- ============================================================
-- 9. FTS5 同期トリガー — highlights
-- ============================================================

-- highlights INSERT → FTS に追加
CREATE TRIGGER IF NOT EXISTS fts_highlights_insert
AFTER INSERT ON highlights
BEGIN
    INSERT INTO fts_highlights (highlight_id, paper_id, text, comment)
    VALUES (NEW.id, NEW.paper_id, NEW.text, COALESCE(NEW.comment, ''));
END;

-- highlights UPDATE → FTS を更新
CREATE TRIGGER IF NOT EXISTS fts_highlights_update
AFTER UPDATE ON highlights
BEGIN
    DELETE FROM fts_highlights WHERE highlight_id = OLD.id;
    INSERT INTO fts_highlights (highlight_id, paper_id, text, comment)
    VALUES (NEW.id, NEW.paper_id, NEW.text, COALESCE(NEW.comment, ''));
END;

-- highlights DELETE → FTS から削除
CREATE TRIGGER IF NOT EXISTS fts_highlights_delete
AFTER DELETE ON highlights
BEGIN
    DELETE FROM fts_highlights WHERE highlight_id = OLD.id;
END;

-- ============================================================
-- 10. インデックス — 検索パフォーマンス最適化
-- ============================================================

-- papers: DOI での検索を高速化
CREATE INDEX IF NOT EXISTS idx_papers_doi ON papers(doi);

-- papers: 年での絞り込みを高速化
CREATE INDEX IF NOT EXISTS idx_papers_year ON papers(year);

-- papers: 作成日時でのソートを高速化
CREATE INDEX IF NOT EXISTS idx_papers_created_at ON papers(created_at);

-- papers: 更新日時でのソートを高速化
CREATE INDEX IF NOT EXISTS idx_papers_updated_at ON papers(updated_at);

-- papers: PDF有無でのフィルタを高速化
CREATE INDEX IF NOT EXISTS idx_papers_pdf_path ON papers(pdf_path);

-- notes: 論文IDでの関連ノート検索を高速化
CREATE INDEX IF NOT EXISTS idx_notes_paper_id ON notes(paper_id);

-- notes: 更新日時でのソートを高速化
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at);

-- highlights: 論文IDでのハイライト検索を高速化
CREATE INDEX IF NOT EXISTS idx_highlights_paper_id ON highlights(paper_id);

-- highlights: ページ番号での絞り込みを高速化
CREATE INDEX IF NOT EXISTS idx_highlights_page ON highlights(paper_id, page);

-- links: ソース側での検索を高速化
CREATE INDEX IF NOT EXISTS idx_links_source ON links(source_type, source_id);

-- links: ターゲット側での検索を高速化
CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_type, target_id);
