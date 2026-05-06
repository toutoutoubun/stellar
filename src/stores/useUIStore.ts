// src/stores/useUIStore.ts
// Stellar — UI 状態ストア
// サイドバー・メインペイン・モーダル等のUI状態を管理する
// ナビゲーション履歴（goBack / goForward）対応

import { create } from "zustand";
import type { SidebarView, MainPaneContent } from "../types";

/** ナビゲーション履歴エントリ */
interface NavEntry {
  mainPaneContent: MainPaneContent;
  sidebarView: SidebarView;
}

/** 画面遷移の方向（CSS アニメーション用） */
export type TransitionDirection = "forward" | "backward" | "none";

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

  /** ナビゲーション履歴スタック（戻る用） */
  navigationHistory: NavEntry[];
  /** ナビゲーション前方スタック（進む用） */
  navigationForward: NavEntry[];
  /** 現在の遷移方向（アニメーション制御用） */
  transitionDirection: TransitionDirection;

  /** サイドバービューを変更する */
  setSidebarView: (view: SidebarView) => void;
  /** サイドバーの折りたたみをトグルする */
  toggleSidebar: () => void;
  /** サイドバーの折りたたみ状態を設定する */
  setSidebarCollapsed: (collapsed: boolean) => void;
  /** メインペインのコンテンツを設定する（履歴に追加） */
  setMainPaneContent: (content: MainPaneContent) => void;

  /** 論文を開く（履歴に追加） */
  openPaper: (paperId: string) => void;
  /** ノートを開く（履歴に追加） */
  openNote: (noteId: string) => void;
  /** グラフビューを開く（履歴に追加） */
  openGraph: () => void;
  /** 設定ビューを開く（履歴に追加） */
  openSettings: () => void;
  /** 質的分析ビューを開く（履歴に追加） */
  openQualitative: () => void;
  /** 量的分析ビューを開く（履歴に追加） */
  openQuantitative: () => void;

  /** ナビゲーション: 戻る */
  goBack: () => void;
  /** ナビゲーション: 進む */
  goForward: () => void;
  /** 戻れるか */
  canGoBack: () => boolean;
  /** 進めるか */
  canGoForward: () => boolean;

  /** コンテキストパネルの表示をトグルする */
  toggleContextPanel: () => void;
  /** 検索モーダルの表示をトグルする */
  toggleSearchModal: () => void;
  /** 検索モーダルを閉じる */
  closeSearchModal: () => void;

  /** 遷移方向をクリアする */
  clearTransition: () => void;
}

/** 最大履歴数 */
const MAX_HISTORY = 50;

/** 現在の状態からナビエントリを作る */
const makeEntry = (state: {
  mainPaneContent: MainPaneContent;
  sidebarView: SidebarView;
}): NavEntry => ({
  mainPaneContent: state.mainPaneContent,
  sidebarView: state.sidebarView,
});

export const useUIStore = create<UIState>((set, get) => ({
  sidebarView: "library",
  sidebarCollapsed: false,
  mainPaneContent: { type: "empty" },
  contextPanelOpen: false,
  searchModalOpen: false,
  navigationHistory: [],
  navigationForward: [],
  transitionDirection: "none",

  setSidebarView: (view) => set({ sidebarView: view }),

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  setMainPaneContent: (content) => {
    const state = get();
    const history = [
      ...state.navigationHistory,
      makeEntry(state),
    ].slice(-MAX_HISTORY);
    set({
      mainPaneContent: content,
      navigationHistory: history,
      navigationForward: [],
      transitionDirection: "forward",
    });
  },

  openPaper: (paperId) => {
    const state = get();
    const history = [
      ...state.navigationHistory,
      makeEntry(state),
    ].slice(-MAX_HISTORY);
    set({
      mainPaneContent: { type: "paper", paperId },
      sidebarView: "library",
      navigationHistory: history,
      navigationForward: [],
      transitionDirection: "forward",
    });
  },

  openNote: (noteId) => {
    const state = get();
    const history = [
      ...state.navigationHistory,
      makeEntry(state),
    ].slice(-MAX_HISTORY);
    set({
      mainPaneContent: { type: "note", noteId },
      sidebarView: "notes",
      navigationHistory: history,
      navigationForward: [],
      transitionDirection: "forward",
    });
  },

  openGraph: () => {
    const state = get();
    const history = [
      ...state.navigationHistory,
      makeEntry(state),
    ].slice(-MAX_HISTORY);
    set({
      mainPaneContent: { type: "graph" },
      sidebarView: "graph",
      navigationHistory: history,
      navigationForward: [],
      transitionDirection: "forward",
    });
  },

  openSettings: () => {
    const state = get();
    const history = [
      ...state.navigationHistory,
      makeEntry(state),
    ].slice(-MAX_HISTORY);
    set({
      mainPaneContent: { type: "settings" },
      sidebarView: "settings",
      navigationHistory: history,
      navigationForward: [],
      transitionDirection: "forward",
    });
  },

  openQualitative: () => {
    const state = get();
    const history = [
      ...state.navigationHistory,
      makeEntry(state),
    ].slice(-MAX_HISTORY);
    set({
      mainPaneContent: { type: "qualitative" },
      sidebarView: "qualitative",
      navigationHistory: history,
      navigationForward: [],
      transitionDirection: "forward",
    });
  },

  openQuantitative: () => {
    const state = get();
    const history = [
      ...state.navigationHistory,
      makeEntry(state),
    ].slice(-MAX_HISTORY);
    set({
      mainPaneContent: { type: "quantitative" },
      sidebarView: "quantitative",
      navigationHistory: history,
      navigationForward: [],
      transitionDirection: "forward",
    });
  },

  goBack: () => {
    const state = get();
    if (state.navigationHistory.length === 0) return;

    const history = [...state.navigationHistory];
    const prev = history.pop()!;
    const forward = [
      ...state.navigationForward,
      makeEntry(state),
    ].slice(-MAX_HISTORY);

    set({
      mainPaneContent: prev.mainPaneContent,
      sidebarView: prev.sidebarView,
      navigationHistory: history,
      navigationForward: forward,
      transitionDirection: "backward",
    });
  },

  goForward: () => {
    const state = get();
    if (state.navigationForward.length === 0) return;

    const forward = [...state.navigationForward];
    const next = forward.pop()!;
    const history = [
      ...state.navigationHistory,
      makeEntry(state),
    ].slice(-MAX_HISTORY);

    set({
      mainPaneContent: next.mainPaneContent,
      sidebarView: next.sidebarView,
      navigationHistory: history,
      navigationForward: forward,
      transitionDirection: "forward",
    });
  },

  canGoBack: () => get().navigationHistory.length > 0,
  canGoForward: () => get().navigationForward.length > 0,

  toggleContextPanel: () =>
    set((state) => ({ contextPanelOpen: !state.contextPanelOpen })),

  toggleSearchModal: () =>
    set((state) => ({ searchModalOpen: !state.searchModalOpen })),

  closeSearchModal: () => set({ searchModalOpen: false }),

  clearTransition: () => set({ transitionDirection: "none" }),
}));
