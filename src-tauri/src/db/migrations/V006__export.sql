-- V006__export.sql
-- エクスポート設定テーブル — 静的サイト・Stellarパッケージ・BibTeXバンドルの設定管理

CREATE TABLE IF NOT EXISTS export_configs (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    export_type     TEXT NOT NULL CHECK(export_type IN ('static_site', 'stellar_package', 'bibtex_bundle')),
    config_json     TEXT DEFAULT '{}',
    last_exported_at TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
);
