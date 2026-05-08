// src/stores/useNoteStore.ts
// Stellar — ノートストア（拡張版）
// ノートデータの CRUD 操作・自動保存ステータス・未保存変更フラグを管理

import { create } from "zustand";
import type {
  Note,
  CreateNoteInput,
  UpdateNoteInput,
  NoteSortKey,
  SortDirection,
  AutoSaveStatus,
} from "../types";
import { invoke } from "../lib/tauriShim";

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
  /** 未保存変更ありフラグ */
  isModified: boolean;
  /** 自動保存ステータス */
  autoSaveStatus: AutoSaveStatus;

  /** 全ノートを取得する */
  fetchNotes: () => Promise<void>;
  /** 特定の論文に紐づくノートを取得する */
  fetchNotesByPaper: (paperId: string) => Promise<Note[]>;
  /** ノートを開く（activeNote を設定） */
  openNote: (id: string) => Promise<void>;
  /** ノートを新規作成する */
  createNote: (input: CreateNoteInput) => Promise<Note>;
  /** ノートを更新する */
  updateNote: (id: string, input: UpdateNoteInput) => Promise<Note>;
  /** ノート内容を保存する（autoSaveStatus を連動更新） */
  saveNote: (id: string, content: string) => Promise<void>;
  /** ノートを削除する */
  deleteNote: (id: string) => Promise<void>;
  /** 編集中のノートを設定する */
  setActiveNote: (note: Note | null) => void;
  /** 未保存変更フラグを設定する */
  setIsModified: (modified: boolean) => void;
  /** 自動保存ステータスを設定する */
  setAutoSaveStatus: (status: AutoSaveStatus) => void;
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
  isModified: false,
  autoSaveStatus: "idle",

  fetchNotes: async () => {
    set({ loading: true, error: null });
    try {
      const result = await invoke<{ items: Note[]; totalPages: number; totalItems: number }>("get_notes", { limit: 1000 });
      const notes = Array.isArray(result?.items) ? result.items : [];
      set({ notes, loading: false });
    } catch (e) {
      console.error("[fetchNotes] failed:", e);
      set({ error: String(e), loading: false });
    }
  },

  fetchNotesByPaper: async (paperId) => {
    try {
      const result = await invoke<{ items: Note[]; totalPages: number; totalItems: number }>("get_notes", { paperId, limit: 1000 });
      const notes = Array.isArray(result?.items) ? result.items : [];
      return notes;
    } catch (e) {
      set({ error: String(e) });
      return [];
    }
  },

  openNote: async (id) => {
    set({ loading: true, error: null, isModified: false, autoSaveStatus: "idle" });
    try {
      const note = await invoke<Note>("get_note", { id });
      set({ activeNote: note, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false, activeNote: null });
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
      activeNote: state.activeNote?.id === id ? note : state.activeNote,
    }));
    return note;
  },

  // 自動保存用：content のみ更新し、ステータスを連動させる
  saveNote: async (id, content) => {
    set({ autoSaveStatus: "saving" });
    try {
      const note = await invoke<Note>("update_note", {
        id,
        input: { content } satisfies UpdateNoteInput,
      });
      set((state) => ({
        notes: state.notes.map((n) => (n.id === id ? note : n)),
        activeNote: state.activeNote?.id === id ? note : state.activeNote,
        isModified: false,
        autoSaveStatus: "saved",
      }));
    } catch (e) {
      set({ autoSaveStatus: "error", error: String(e) });
    }
  },

  deleteNote: async (id) => {
    await invoke("delete_note", { id });
    set((state) => ({
      notes: state.notes.filter((n) => n.id !== id),
      activeNote: state.activeNote?.id === id ? null : state.activeNote,
      isModified: state.activeNote?.id === id ? false : state.isModified,
    }));
  },

  setActiveNote: (note) =>
    set({ activeNote: note, isModified: false, autoSaveStatus: "idle" }),

  setIsModified: (modified) => set({ isModified: modified }),

  setAutoSaveStatus: (status) => set({ autoSaveStatus: status }),

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
