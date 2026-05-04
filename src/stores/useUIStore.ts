// src/stores/useUIStore.ts
// Stellar — UI 状態ストア
// サイドバー・メインペイン・モーダル等のUI状態を管理する

import { create } from "zustand";
import type { SidebarView, MainPaneContent } from "../types";

/** UI ストアの状態型 */
interface UIState {
  /** サイドバーの現在のビュー */
  sidebarView: SidebarView;
  /** サイドバーの折りたたみ状態 */
  sidebarCollapsed: boolean;
  /** メインペインのコンテンツ */
  mainPaneContent: MainPaneContent;
  /** コンテキストパネルの表示状態 */
  contextPanelOpen: boolean;
  /** 検索モーダルの表示状態 */
  searchModalOpen: boolean;

  /** サイドバービューを変更する */
  setSidebarView: (view: SidebarView) => void;
  /** サイドバーの折りたたみをトグルする */
  toggleSidebar: () => void;
  /** サイドバーの折りたたみ状態を設定する */
  setSidebarCollapsed: (collapsed: boolean) => void;
  /** メインペインのコンテンツを設定する */
  setMainPaneContent: (content: MainPaneContent) => void;
  /** 論文を開く */
  openPaper: (paperId: string) => void;
  /** ノートを開く */
  openNote: (noteId: string) => void;
  /** グラフビューを開く */
  openGraph: () => void;
  /** コンテキストパネルの表示をトグルする */
  toggleContextPanel: () => void;
  /** 検索モーダルの表示をトグルする */
  toggleSearchModal: () => void;
  /** 検索モーダルを閉じる */
  closeSearchModal: () => void;
  /** 設定ビューを開く */
  openSettings: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarView: "library",
  sidebarCollapsed: false,
  mainPaneContent: { type: "empty" },
  contextPanelOpen: false,
  searchModalOpen: false,

  setSidebarView: (view) => set({ sidebarView: view }),

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  setMainPaneContent: (content) => set({ mainPaneContent: content }),

  openPaper: (paperId) =>
    set({
      mainPaneContent: { type: "paper", paperId },
      sidebarView: "library",
    }),

  openNote: (noteId) =>
    set({
      mainPaneContent: { type: "note", noteId },
      sidebarView: "notes",
    }),

  openGraph: () =>
    set({
      mainPaneContent: { type: "graph" },
      sidebarView: "graph",
    }),

  toggleContextPanel: () =>
    set((state) => ({ contextPanelOpen: !state.contextPanelOpen })),

  toggleSearchModal: () =>
    set((state) => ({ searchModalOpen: !state.searchModalOpen })),

  closeSearchModal: () => set({ searchModalOpen: false }),

  openSettings: () =>
    set({
      mainPaneContent: { type: "settings" },
      sidebarView: "settings",
    }),
}));
