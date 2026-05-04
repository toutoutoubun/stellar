// src/stores/useThemeStore.ts
// Stellar — テーマストア
// アプリのカラーテーマを管理する（localStorage に永続化）

import { create } from "zustand";
import type { Theme } from "../types";

/** テーマストアの状態型 */
interface ThemeState {
  /** 現在のテーマ */
  theme: Theme;
  /** テーマを設定する */
  setTheme: (theme: Theme) => void;
  /** 次のテーマに切り替える（ローテーション） */
  cycleTheme: () => void;
}

/** テーマの順序（ローテーション用） */
const THEME_ORDER: Theme[] = ["white", "ivory", "dark-blue", "black"];

/** localStorage からテーマを復元する */
const loadTheme = (): Theme => {
  try {
    const stored = localStorage.getItem("stellar-theme");
    if (stored && THEME_ORDER.includes(stored as Theme)) {
      return stored as Theme;
    }
  } catch {
    // localStorage が利用できない場合は無視
  }
  return "white";
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: loadTheme(),

  setTheme: (theme: Theme) => {
    set({ theme });
    try {
      localStorage.setItem("stellar-theme", theme);
    } catch {
      // localStorage が利用できない場合は無視
    }
    document.documentElement.setAttribute("data-theme", theme);
  },

  cycleTheme: () => {
    const currentIndex = THEME_ORDER.indexOf(get().theme);
    const nextIndex = (currentIndex + 1) % THEME_ORDER.length;
    const nextTheme = THEME_ORDER[nextIndex];
    if (nextTheme) {
      get().setTheme(nextTheme);
    }
  },
}));
