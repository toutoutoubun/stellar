// src/utils/ipc.ts
// Stellar — 型安全な Tauri IPC ラッパー
// invoke<T> ヘルパーと、papers / notes / highlights / links / search の API オブジェクト

import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import type {
  Paper,
  CreatePaperInput,
  UpdatePaperInput,
  Note,
  CreateNoteInput,
  UpdateNoteInput,
  Highlight,
  CreateHighlightInput,
  UpdateHighlightInput,
  Link,
  CreateLinkInput,
  SearchResult,
  DataSummary,
  LinkSuggestion,
} from "../types";

// ============================================================
// 型安全な invoke ラッパー
// ============================================================

/**
 * Tauri invoke の型安全ラッパー。
 * コマンド名とペイロードを受け取り、型パラメータ T で戻り値を推論する。
 * エラーは string に正規化して reject する。
 */
export async function invoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  try {
    const result = await tauriInvoke<T>(cmd, args);
    return result;
  } catch (error: unknown) {
    // Tauri のエラーを文字列に正規化
    if (typeof error === "string") {
      throw new Error(error);
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(String(error));
  }
}

// ============================================================
// API オブジェクト — ドメイン別にグループ化した IPC 関数群
// ============================================================

/** 論文 API */
export const papersApi = {
  /** 全論文を取得 */
  list: () => invoke<Paper[]>("list_papers"),

  /** 論文を1件取得 */
  get: (id: string) => invoke<Paper>("get_paper", { id }),

  /** 論文を作成 */
  create: (input: CreatePaperInput) =>
    invoke<Paper>("create_paper", { input }),

  /** 論文を更新 */
  update: (id: string, input: UpdatePaperInput) =>
    invoke<Paper>("update_paper", { id, input }),

  /** 論文を削除 */
  delete: (id: string) => invoke<void>("delete_paper", { id }),

  /** PDF を添付 */
  attachPdf: (id: string, filePath: string) =>
    invoke<Paper>("attach_pdf", { id, filePath }),

  /** DOI / URL からメタデータを取得 */
  fetchMetadata: (query: string) =>
    invoke<Partial<Paper>>("fetch_paper_metadata", { query }),
};

/** ノート API */
export const notesApi = {
  /** 全ノートを取得 */
  list: () => invoke<Note[]>("list_notes"),

  /** ノートを1件取得 */
  get: (id: string) => invoke<Note>("get_note", { id }),

  /** ノートを作成 */
  create: (input: CreateNoteInput) =>
    invoke<Note>("create_note", { input }),

  /** ノートを更新 */
  update: (id: string, input: UpdateNoteInput) =>
    invoke<Note>("update_note", { id, input }),

  /** ノートを削除 */
  delete: (id: string) => invoke<void>("delete_note", { id }),
};

/** ハイライト API */
export const highlightsApi = {
  /** 論文のハイライト一覧を取得 */
  listByPaper: (paperId: string) =>
    invoke<Highlight[]>("list_highlights", { paperId }),

  /** ハイライトを1件取得 */
  get: (id: string) => invoke<Highlight>("get_highlight", { id }),

  /** ハイライトを作成 */
  create: (input: CreateHighlightInput) =>
    invoke<Highlight>("create_highlight", { input }),

  /** ハイライトを更新 */
  update: (id: string, input: UpdateHighlightInput) =>
    invoke<Highlight>("update_highlight", { id, input }),

  /** ハイライトを削除 */
  delete: (id: string) => invoke<void>("delete_highlight", { id }),
};

/** リンク API */
export const linksApi = {
  /** 全リンクを取得 */
  list: () => invoke<Link[]>("list_links"),

  /** 特定ノードに接続されたリンクを取得 */
  listByNode: (nodeType: string, nodeId: string) =>
    invoke<Link[]>("list_links_by_node", { nodeType, nodeId }),

  /** リンクを作成 */
  create: (input: CreateLinkInput) =>
    invoke<Link>("create_link", { input }),

  /** リンクを削除 */
  delete: (id: string) => invoke<void>("delete_link", { id }),

  /** WikiLink オートコンプリート候補を取得 */
  suggest: (query: string) =>
    invoke<LinkSuggestion[]>("suggest_links", { query }),
};

/** 検索 API */
export const searchApi = {
  /** 全文検索 */
  search: (query: string) =>
    invoke<SearchResult[]>("search", { query }),

  /** インクリメンタル検索（デバウンス済みのクエリを想定） */
  quickSearch: (query: string) =>
    invoke<SearchResult[]>("quick_search", { query }),
};

/** データ管理 API */
export const dataApi = {
  /** データサマリーを取得 */
  getSummary: () => invoke<DataSummary>("get_data_summary"),

  /** データパスを変更 */
  changePath: (newPath: string) =>
    invoke<void>("change_data_path", { newPath }),

  /** データをエクスポート（JSON + PDF ZIP） */
  export: () => invoke<string>("export_data"),

  /** バックアップを作成 (stellar_backup_YYYYMMDD.zip) */
  createBackup: () => invoke<string>("create_backup"),
};

/** すべての API をまとめたオブジェクト */
export const api = {
  papers: papersApi,
  notes: notesApi,
  highlights: highlightsApi,
  links: linksApi,
  search: searchApi,
  data: dataApi,
} as const;
