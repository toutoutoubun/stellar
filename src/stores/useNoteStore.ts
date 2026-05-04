// src/stores/useNoteStore.ts
// Stellar — ノートストア
// ノートデータの CRUD 操作と状態管理を行う

import { create } from "zustand";
import type {
  Note,
  CreateNoteInput,
  UpdateNoteInput,
  NoteSortKey,
  SortDirection,
} from "../types";
import { invoke } from "@tauri-apps/api/core";

/** ノートストアの状態型 */
interface NoteState {
  /** 全ノートリスト */
  notes: Note[];
  /** 現在編集中のノート */
  activeNote: Note | null;
  /** 読み込み中フラグ */
  loading: boolean;
  /** エラーメッセージ */
  error: string | null;
  /** ソートキー */
  sortKey: NoteSortKey;
  /** ソート方向 */
  sortDirection: SortDirection;
  /** フィルタークエリ（ノート一覧内フィルタ） */
  filterQuery: string;

  /** 全ノートを取得する */
  fetchNotes: () => Promise<void>;
  /** 特定の論文に紐づくノートを取得する */
  fetchNotesByPaper: (paperId: string) => Promise<Note[]>;
  /** ノートを新規作成する */
  createNote: (input: CreateNoteInput) => Promise<Note>;
  /** ノートを更新する */
  updateNote: (id: string, input: UpdateNoteInput) => Promise<Note>;
  /** ノートを削除する */
  deleteNote: (id: string) => Promise<void>;
  /** 編集中のノートを設定する */
  setActiveNote: (note: Note | null) => void;
  /** ソートキーを設定する */
  setSortKey: (key: NoteSortKey) => void;
  /** ソート方向を設定する */
  setSortDirection: (direction: SortDirection) => void;
  /** フィルタークエリを設定する */
  setFilterQuery: (query: string) => void;
}

export const useNoteStore = create<NoteState>((set, get) => ({
  notes: [],
  activeNote: null,
  loading: false,
  error: null,
  sortKey: "updatedAt",
  sortDirection: "desc",
  filterQuery: "",

  fetchNotes: async () => {
    set({ loading: true, error: null });
    try {
      const notes = await invoke<Note[]>("get_all_notes");
      set({ notes, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  fetchNotesByPaper: async (paperId) => {
    try {
      const notes = await invoke<Note[]>("get_notes_by_paper", { paperId });
      return notes;
    } catch (e) {
      set({ error: String(e) });
      return [];
    }
  },

  createNote: async (input) => {
    const note = await invoke<Note>("create_note", { input });
    set((state) => ({ notes: [note, ...state.notes] }));
    return note;
  },

  updateNote: async (id, input) => {
    const note = await invoke<Note>("update_note", { id, input });
    set((state) => ({
      notes: state.notes.map((n) => (n.id === id ? note : n)),
      // 編集中のノートが更新対象なら同期する
      activeNote: state.activeNote?.id === id ? note : state.activeNote,
    }));
    return note;
  },

  deleteNote: async (id) => {
    await invoke("delete_note", { id });
    set((state) => ({
      notes: state.notes.filter((n) => n.id !== id),
      activeNote: state.activeNote?.id === id ? null : state.activeNote,
    }));
  },

  setActiveNote: (note) => set({ activeNote: note }),

  setSortKey: (key) => {
    const currentKey = get().sortKey;
    if (currentKey === key) {
      set((state) => ({
        sortDirection: state.sortDirection === "asc" ? "desc" : "asc",
      }));
    } else {
      set({ sortKey: key, sortDirection: "desc" });
    }
  },

  setSortDirection: (direction) => set({ sortDirection: direction }),
  setFilterQuery: (query) => set({ filterQuery: query }),
}));
