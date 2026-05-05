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
  /** 全論文を取得（ページネーション付き） */
  list: () => invoke<{ items: Paper[]; totalPages: number; totalItems: number }>("get_papers", { limit: 1000 }).then(r => r.items),

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
  attachPdf: (id: string, pdfPath: string) =>
    invoke<Paper>("attach_pdf", { id, pdfPath }),

  /** DOI からメタデータを取得 */
  fetchMetadataByDoi: (doi: string) =>
    invoke<Partial<Paper>>("fetch_metadata_by_doi", { doi }),

  /** URL からメタデータを取得 */
  fetchMetadataFromUrl: (url: string) =>
    invoke<Partial<Paper>>("fetch_metadata_from_url", { url }),
};

/** ノート API */
export const notesApi = {
  /** 全ノートを取得（ページネーション付き） */
  list: () => invoke<{ items: Note[]; totalPages: number; totalItems: number }>("get_notes", { limit: 1000 }).then(r => r.items),

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
    invoke<Highlight[]>("get_highlights", { paperId }),

  /** ハイライトを作成 */
  create: (input: CreateHighlightInput) =>
    invoke<Highlight>("create_highlight", { input }),

  /** ハイライトコメントを更新 */
  update: (id: string, input: UpdateHighlightInput) =>
    invoke<Highlight>("update_highlight_comment", { id, comment: input.comment ?? "" }),

  /** ハイライトを削除 */
  delete: (id: string) => invoke<void>("delete_highlight", { id }),
};

/** リンク API */
export const linksApi = {
  /** 特定ノードに接続されたバックリンクを取得 */
  listByNode: (itemType: string, itemId: string) =>
    invoke<Link[]>("get_backlinks", { itemType, itemId }),

  /** リンクを作成 */
  create: (input: CreateLinkInput) =>
    invoke<Link>("create_link", { input }),

  /** リンクを削除 */
  delete: (id: string) => invoke<void>("delete_link", { id }),

  /** WikiLink オートコンプリート候補を取得 */
  suggest: (query: string) =>
    invoke<LinkSuggestion[]>("get_link_suggestions", { query }),
};

/** バックエンドの検索結果型 */
interface BackendSearchResults {
  papers: { id: string; itemType: string; title: string; snippet: string; score: number }[];
  notes: { id: string; itemType: string; title: string; snippet: string; score: number }[];
  highlights: { id: string; itemType: string; title: string; snippet: string; score: number }[];
}

/** 検索 API */
export const searchApi = {
  /** 全文検索 */
  search: (query: string) =>
    invoke<BackendSearchResults>("full_text_search", { query }),

  /** インクリメンタル検索（デバウンス済みのクエリを想定） */
  quickSearch: (query: string) =>
    invoke<BackendSearchResults>("full_text_search", { query }),
};

/** データ管理 API（未実装 — 将来のバックエンドコマンド追加後に有効化） */
export const dataApi = {
  /** データサマリーを取得 */
  getSummary: () => Promise.resolve({} as DataSummary),

  /** データパスを変更 */
  changePath: (_newPath: string) => Promise.resolve(),

  /** データをエクスポート（JSON + PDF ZIP） */
  export: () => Promise.resolve(""),

  /** バックアップを作成 (stellar_backup_YYYYMMDD.zip) */
  createBackup: () => Promise.resolve(""),
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
