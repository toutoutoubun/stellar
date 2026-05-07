// src/stores/useLibraryStore.ts
// Stellar — 文献ライブラリストア
// 論文データの CRUD 操作・フィルタリング・ソート・表示モード・選択状態を管理する

import { create } from "zustand";
import type {
  Paper,
  CreatePaperInput,
  UpdatePaperInput,
  PaperSortKey,
  SortDirection,
  LibraryViewMode,
} from "../types";
import { invoke } from "../lib/tauriShim";

/** ライブラリストアの状態型 */
interface LibraryState {
  /** 全論文リスト（キャッシュ） */
  papers: Paper[];
  /** 選択中の論文ID */
  selectedPaperId: string | null;
  /** チェック済み論文IDセット（リスト表示のバッチ操作用） */
  checkedPaperIds: Set<string>;
  /** 読み込み中フラグ */
  loading: boolean;
  /** エラーメッセージ */
  error: string | null;

  // ── フィルター ──
  /** フィルタータグ（null = フィルタなし） */
  filterTag: string | null;
  /** フィルター年（null = フィルタなし） */
  filterYear: number | null;
  /** PDFありフィルタ（null = フィルタなし） */
  filterHasPdf: boolean | null;
  /** 検索クエリ（ライブラリ内フィルタ） */
  filterQuery: string;

  // ── ソート ──
  /** ソートキー */
  sortBy: PaperSortKey;
  /** ソート方向 */
  sortOrder: SortDirection;

  // ── 表示 ──
  /** 表示モード（グリッド / リスト） */
  viewMode: LibraryViewMode;

  // ── モーダル ──
  /** 論文追加モーダルの表示状態 */
  addModalOpen: boolean;

  // ── アクション ──
  /** 全論文を Tauri バックエンドから取得する */
  fetchPapers: () => Promise<void>;
  /** 論文を新規作成する */
  createPaper: (input: CreatePaperInput) => Promise<Paper>;
  /** 論文を更新する */
  updatePaper: (id: string, input: UpdatePaperInput) => Promise<Paper>;
  /** 論文を削除する（確認は呼び出し側で行う） */
  deletePaper: (id: string) => Promise<void>;
  /** 論文を楽観的にUI追加する（バックエンド保存前） */
  addPaperOptimistic: (paper: Paper) => void;
  /** 既存の論文にPDFを添付する */
  attachPdf: (id: string, pdfPath: string) => Promise<Paper>;
  /** 論文を選択する */
  selectPaper: (id: string | null) => void;
  /** チェック済み論文IDをトグルする */
  toggleCheckedPaper: (id: string) => void;
  /** 全チェックをクリアする */
  clearCheckedPapers: () => void;
  /** 全論文をチェックする */
  checkAllPapers: () => void;

  // ── フィルター設定 ──
  setFilterTag: (tag: string | null) => void;
  setFilterYear: (year: number | null) => void;
  setFilterHasPdf: (hasPdf: boolean | null) => void;
  setFilterQuery: (query: string) => void;
  /** すべてのフィルターをリセットする */
  clearFilters: () => void;

  // ── ソート設定 ──
  setSortBy: (key: PaperSortKey) => void;
  setSortOrder: (direction: SortDirection) => void;

  // ── 表示設定 ──
  setViewMode: (mode: LibraryViewMode) => void;

  // ── モーダル ──
  openAddModal: () => void;
  closeAddModal: () => void;

  // ── 派生データ（セレクタ的に使う） ──
  /** フィルタリング・ソート済みの論文一覧を取得する */
  getFilteredPapers: () => Paper[];
  /** 全タグのユニークリスト（頻出順） */
  getAllTags: () => string[];
  /** 全年のユニークリスト（降順） */
  getAllYears: () => number[];
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  papers: [],
  selectedPaperId: null,
  checkedPaperIds: new Set<string>(),
  loading: false,
  error: null,

  filterTag: null,
  filterYear: null,
  filterHasPdf: null,
  filterQuery: "",

  sortBy: "createdAt",
  sortOrder: "desc",

  viewMode: "grid",

  addModalOpen: false,

  // ────────────────────────────────────────────
  // CRUD アクション
  // ────────────────────────────────────────────

  fetchPapers: async () => {
    set({ loading: true, error: null });
    try {
      const result = await invoke<{ items: Paper[]; totalPages: number; totalItems: number }>("get_papers", { limit: 1000 });
      const papers = result.items;
      set({ papers, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  createPaper: async (input) => {
    const paper = await invoke<Paper>("create_paper", { input });
    if (!paper || !paper.id) {
      throw new Error("論文の作成に失敗しました（空のレスポンス）");
    }
    set((state) => ({ papers: [paper, ...state.papers] }));
    return paper;
  },

  updatePaper: async (id, input) => {
    const paper = await invoke<Paper>("update_paper", { id, input });
    if (!paper || !paper.id) {
      throw new Error("論文の更新に失敗しました（空のレスポンス）");
    }
    set((state) => ({
      papers: state.papers.map((p) => (p.id === id ? paper : p)),
    }));
    return paper;
  },

  deletePaper: async (id) => {
    await invoke("delete_paper", { id });
    set((state) => ({
      papers: state.papers.filter((p) => p.id !== id),
      // 選択中の論文が削除された場合はクリア
      selectedPaperId: state.selectedPaperId === id ? null : state.selectedPaperId,
    }));
  },

  addPaperOptimistic: (paper) => {
    set((state) => ({ papers: [paper, ...state.papers] }));
  },

  attachPdf: async (id, pdfPath) => {
    const paper = await invoke<Paper>("update_paper", {
      id,
      input: { pdfPath },
    });
    if (!paper || !paper.id) {
      throw new Error("PDF添付に失敗しました（空のレスポンス）");
    }
    set((state) => ({
      papers: state.papers.map((p) => (p.id === id ? paper : p)),
    }));
    return paper;
  },

  // ────────────────────────────────────────────
  // 選択・チェック
  // ────────────────────────────────────────────

  selectPaper: (id) => set({ selectedPaperId: id }),

  toggleCheckedPaper: (id) => {
    set((state) => {
      const next = new Set(state.checkedPaperIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { checkedPaperIds: next };
    });
  },

  clearCheckedPapers: () => set({ checkedPaperIds: new Set<string>() }),

  checkAllPapers: () => {
    const filtered = get().getFilteredPapers();
    set({ checkedPaperIds: new Set(filtered.map((p) => p.id)) });
  },

  // ────────────────────────────────────────────
  // フィルター
  // ────────────────────────────────────────────

  setFilterTag: (tag) => set({ filterTag: tag }),
  setFilterYear: (year) => set({ filterYear: year }),
  setFilterHasPdf: (hasPdf) => set({ filterHasPdf: hasPdf }),
  setFilterQuery: (query) => set({ filterQuery: query }),

  clearFilters: () =>
    set({
      filterTag: null,
      filterYear: null,
      filterHasPdf: null,
      filterQuery: "",
    }),

  // ────────────────────────────────────────────
  // ソート
  // ────────────────────────────────────────────

  setSortBy: (key) => {
    const current = get().sortBy;
    if (current === key) {
      // 同じキーの場合はソート方向を反転
      set((state) => ({
        sortOrder: state.sortOrder === "asc" ? "desc" : "asc",
      }));
    } else {
      set({ sortBy: key, sortOrder: "desc" });
    }
  },

  setSortOrder: (direction) => set({ sortOrder: direction }),

  // ────────────────────────────────────────────
  // 表示
  // ────────────────────────────────────────────

  setViewMode: (mode) => set({ viewMode: mode }),

  // ────────────────────────────────────────────
  // モーダル
  // ────────────────────────────────────────────

  openAddModal: () => set({ addModalOpen: true }),
  closeAddModal: () => set({ addModalOpen: false }),

  // ────────────────────────────────────────────
  // 派生データ
  // ────────────────────────────────────────────

  getFilteredPapers: () => {
    const {
      papers,
      filterTag,
      filterYear,
      filterHasPdf,
      filterQuery,
      sortBy,
      sortOrder,
    } = get();

    let filtered = [...papers];

    // タグフィルター
    if (filterTag !== null) {
      filtered = filtered.filter((p) => p.tags.includes(filterTag));
    }

    // 年フィルター
    if (filterYear !== null) {
      filtered = filtered.filter((p) => p.year === filterYear);
    }

    // PDFありフィルター
    if (filterHasPdf !== null) {
      filtered = filtered.filter((p) =>
        filterHasPdf ? p.pdfPath !== null : p.pdfPath === null
      );
    }

    // テキスト検索（タイトル・著者・ジャーナル名に対する部分一致）
    if (filterQuery.trim() !== "") {
      const q = filterQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.authors.some((a) => a.toLowerCase().includes(q)) ||
          (p.journal && p.journal.toLowerCase().includes(q)) ||
          (p.doi && p.doi.toLowerCase().includes(q))
      );
    }

    // ソート
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "title":
          cmp = a.title.localeCompare(b.title, "ja");
          break;
        case "year":
          cmp = (a.year ?? 0) - (b.year ?? 0);
          break;
        case "createdAt":
          cmp = a.createdAt.localeCompare(b.createdAt);
          break;
        case "updatedAt":
          cmp = a.updatedAt.localeCompare(b.updatedAt);
          break;
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });

    return filtered;
  },

  getAllTags: () => {
    const { papers } = get();
    // タグの出現回数をカウントし、頻出順にソート
    const tagCount = new Map<string, number>();
    for (const paper of papers) {
      for (const tag of paper.tags) {
        tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
      }
    }
    return [...tagCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);
  },

  getAllYears: () => {
    const { papers } = get();
    const years = new Set<number>();
    for (const paper of papers) {
      if (paper.year !== null) {
        years.add(paper.year);
      }
    }
    return [...years].sort((a, b) => b - a);
  },
}));
