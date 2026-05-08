// src/utils/ipc.ts
// Stellar — 型安全な Tauri IPC ラッパー
// invoke<T> ヘルパーと、papers / notes / highlights / links / search の API オブジェクト

import { invoke as tauriInvoke } from "../lib/tauriShim";
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
  CloudBackupStatus,
  CloudBackupResult,
  BackupListResponse,
  RestoreResult,
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
      throw new Error(error, { cause: error });
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(String(error), { cause: error });
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

/** データ管理 API — Rust バックエンドコマンドを呼び出し、未実装の場合はフロントで代替 */
export const dataApi = {
  /** データサマリーを取得（論文・ノート・ハイライト数 + ディスク使用量） */
  getSummary: async (): Promise<DataSummary> => {
    try {
      // Rust 側に get_data_summary コマンドがあればそれを使う
      return await invoke<DataSummary>("get_data_summary");
    } catch {
      // フォールバック: 各APIから件数を集計
      try {
        const [papersRes, notesRes] = await Promise.all([
          invoke<{ items: Paper[]; totalItems: number }>("get_papers", { limit: 1 }),
          invoke<{ items: Note[]; totalItems: number }>("get_notes", { limit: 1 }),
        ]);

        let highlightCount = 0;
        try {
          // ハイライト数はざっくり取得（全論文のハイライトを数えると重いのでバックエンドに任せる）
          const hlResult = await invoke<number>("get_highlight_count");
          highlightCount = hlResult;
        } catch {
          highlightCount = 0;
        }

        // ディスク使用量の取得を試みる
        let diskUsage = "—";
        try {
          diskUsage = await invoke<string>("get_disk_usage");
        } catch {
          diskUsage = "—";
        }

        // データパスの取得を試みる
        let dataPath = "~/Stellar";
        try {
          dataPath = await invoke<string>("get_data_path");
        } catch {
          dataPath = "~/Stellar";
        }

        return {
          paperCount: papersRes?.totalItems ?? papersRes?.items?.length ?? 0,
          noteCount: notesRes?.totalItems ?? notesRes?.items?.length ?? 0,
          highlightCount,
          diskUsage,
          dataPath,
        };
      } catch {
        return {
          paperCount: 0,
          noteCount: 0,
          highlightCount: 0,
          diskUsage: "—",
          dataPath: "~/Stellar",
        };
      }
    }
  },

  /** データパスを変更 */
  changePath: async (newPath: string): Promise<void> => {
    try {
      await invoke<void>("change_data_path", { newPath });
    } catch {
      // バックエンド未対応の場合はログのみ
      console.warn("[dataApi] change_data_path not available on backend");
    }
  },

  /** データをエクスポート（JSON + PDF ZIP） */
  export: async (): Promise<string> => {
    try {
      // Rust 側で ZIP を生成してパスを返す
      return await invoke<string>("export_data");
    } catch {
      // フォールバック: フロントでJSONエクスポート
      try {
        const [papers, notes] = await Promise.all([
          invoke<{ items: Paper[] }>("get_papers", { limit: 10000 }).then((r) => r.items),
          invoke<{ items: Note[] }>("get_notes", { limit: 10000 }).then((r) => r.items),
        ]);

        const exportData = {
          version: "1.0",
          exportedAt: new Date().toISOString(),
          papers,
          notes,
        };

        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `stellar_export_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return a.download;
      } catch (e) {
        throw new Error(`Export failed: ${String(e)}`, { cause: e });
      }
    }
  },

  /** バックアップを作成 (stellar_backup_YYYYMMDD.zip) */
  createBackup: async (): Promise<string> => {
    try {
      // Rust 側でバックアップを作成してパスを返す
      return await invoke<string>("create_backup");
    } catch {
      // フォールバック: フロントでJSONバックアップ
      try {
        const [papers, notes] = await Promise.all([
          invoke<{ items: Paper[] }>("get_papers", { limit: 10000 }).then((r) => r.items),
          invoke<{ items: Note[] }>("get_notes", { limit: 10000 }).then((r) => r.items),
        ]);

        let highlights: Highlight[] = [];
        try {
          // 全論文のハイライトを取得
          const allHighlights = await Promise.all(
            papers.map((p) =>
              invoke<Highlight[]>("get_highlights", { paperId: p.id }).catch(() => [])
            )
          );
          highlights = allHighlights.flat();
        } catch {
          highlights = [];
        }

        const backup = {
          version: "1.0",
          type: "backup",
          createdAt: new Date().toISOString(),
          papers,
          notes,
          highlights,
        };

        const json = JSON.stringify(backup, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `stellar_backup_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return a.download;
      } catch (e) {
        throw new Error(`Backup failed: ${String(e)}`, { cause: e });
      }
    }
  },
};

/** クラウドバックアップ API */
export const cloudBackupApi = {
  /** 初期セットアップ（デバイスID・リカバリーコード生成） */
  setup: () => invoke<CloudBackupStatus>("cloud_backup_setup"),

  /** ステータスを取得 */
  getStatus: () => invoke<CloudBackupStatus>("cloud_backup_get_status"),

  /** バックアップを実行 */
  create: () => invoke<CloudBackupResult>("cloud_backup_create"),

  /** バックアップ一覧を取得 */
  list: () => invoke<BackupListResponse>("cloud_backup_list"),

  /** バックアップからリストア */
  restore: (backupId: string, recoveryCode: string) =>
    invoke<RestoreResult>("cloud_backup_restore", { backupId, recoveryCode }),

  /** リカバリーコードで別デバイスからリストア */
  recover: (recoveryCode: string) =>
    invoke<CloudBackupStatus>("cloud_backup_recover", { recoveryCode }),

  /** 自動バックアップの有効/無効切替 */
  toggleAuto: (enabled: boolean) =>
    invoke<CloudBackupStatus>("cloud_backup_toggle_auto", { enabled }),

  /** バックアップAPIのURLを変更（セルフホスト対応） */
  setApiUrl: (apiUrl: string) =>
    invoke<CloudBackupStatus>("cloud_backup_set_api_url", { apiUrl }),
};

/** すべての API をまとめたオブジェクト */
export const api = {
  papers: papersApi,
  notes: notesApi,
  highlights: highlightsApi,
  links: linksApi,
  search: searchApi,
  data: dataApi,
  cloudBackup: cloudBackupApi,
} as const;
