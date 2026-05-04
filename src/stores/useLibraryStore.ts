// src/stores/useLibraryStore.ts
// Stellar — 文献ライブラリストア
// 論文データの CRUD 操作とフィルタリング・ソート状態を管理する

import { create } from "zustand";
import type {
  Paper,
  CreatePaperInput,
  UpdatePaperInput,
  PaperSortKey,
  SortDirection,
} from "../types";
import { invoke } from "@tauri-apps/api/core";

/** ライブラリストアの状態型 */
interface LibraryState {
  /** 全論文リスト */
  papers: Paper[];
  /** 読み込み中フラグ */
  loading: boolean;
  /** エラーメッセージ */
  error: string | null;
  /** ソートキー */
  sortKey: PaperSortKey;
  /** ソート方向 */
  sortDirection: SortDirection;
  /** フィルタータグ */
  filterTags: string[];
  /** 検索クエリ（ライブラリ内フィルタ） */
  filterQuery: string;

  /** 全論文を取得する */
  fetchPapers: () => Promise<void>;
  /** 論文を新規作成する */
  createPaper: (input: CreatePaperInput) => Promise<Paper>;
  /** 論文を更新する */
  updatePaper: (id: string, input: UpdatePaperInput) => Promise<Paper>;
  /** 論文を削除する */
  deletePaper: (id: string) => Promise<void>;
  /** ソートキーを設定する */
  setSortKey: (key: PaperSortKey) => void;
  /** ソート方向を設定する */
  setSortDirection: (direction: SortDirection) => void;
  /** フィルタータグを設定する */
  setFilterTags: (tags: string[]) => void;
  /** フィルタークエリを設定する */
  setFilterQuery: (query: string) => void;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  papers: [],
  loading: false,
  error: null,
  sortKey: "updatedAt",
  sortDirection: "desc",
  filterTags: [],
  filterQuery: "",

  fetchPapers: async () => {
    set({ loading: true, error: null });
    try {
      const papers = await invoke<Paper[]>("get_all_papers");
      set({ papers, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  createPaper: async (input) => {
    const paper = await invoke<Paper>("create_paper", { input });
    set((state) => ({ papers: [paper, ...state.papers] }));
    return paper;
  },

  updatePaper: async (id, input) => {
    const paper = await invoke<Paper>("update_paper", { id, input });
    set((state) => ({
      papers: state.papers.map((p) => (p.id === id ? paper : p)),
    }));
    return paper;
  },

  deletePaper: async (id) => {
    await invoke("delete_paper", { id });
    set((state) => ({
      papers: state.papers.filter((p) => p.id !== id),
    }));
  },

  setSortKey: (key) => {
    const currentKey = get().sortKey;
    if (currentKey === key) {
      // 同じキーの場合はソート方向を反転
      set((state) => ({
        sortDirection: state.sortDirection === "asc" ? "desc" : "asc",
      }));
    } else {
      set({ sortKey: key, sortDirection: "desc" });
    }
  },

  setSortDirection: (direction) => set({ sortDirection: direction }),
  setFilterTags: (tags) => set({ filterTags: tags }),
  setFilterQuery: (query) => set({ filterQuery: query }),
}));
