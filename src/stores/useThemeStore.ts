// src/stores/useThemeStore.ts
// Stellar — テーマストア（Zustand persist）
// localStorage に永続化、OS prefers-color-scheme 検出、テーマメタデータ管理

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Theme } from "../types";

// ============================================================
// テーマメタデータ定数
// ============================================================

/** テーマメタデータ */
export interface ThemeMeta {
  /** テーマ識別子 */
  id: Theme;
  /** 表示名（日本語） */
  label: string;
  /** 説明文 */
  description: string;
  /** テーマアイコン（Lucide 風アイコン名） */
  icon: "sun" | "sunrise" | "moon" | "circle";
  /** プレビュー背景色 */
  previewBg: string;
  /** プレビューテキスト色 */
  previewText: string;
  /** プレビューアクセント色 */
  previewAccent: string;
  /** プレビューサイドバー色 */
  previewSidebar: string;
}

/** テーマメタデータ一覧 */
export const THEMES: ThemeMeta[] = [
  {
    id: "white",
    label: "ホワイト",
    description: "清潔感のある純白ベース",
    icon: "sun",
    previewBg: "#ffffff",
    previewText: "#1a1a2e",
    previewAccent: "#4285f4",
    previewSidebar: "#f8f9fa",
  },
  {
    id: "ivory",
    label: "アイボリー",
    description: "温かみのあるアイボリーベース",
    icon: "sunrise",
    previewBg: "#faf8f5",
    previewText: "#2c2416",
    previewAccent: "#b4783c",
    previewSidebar: "#f5f0eb",
  },
  {
    id: "dark-blue",
    label: "ダークブルー",
    description: "落ち着いたダークブルー",
    icon: "moon",
    previewBg: "#1a1f2e",
    previewText: "#e0e4ec",
    previewAccent: "#64a0ff",
    previewSidebar: "#161b28",
  },
  {
    id: "black",
    label: "ブラック",
    description: "真の黒ベース（OLED対応）",
    icon: "circle",
    previewBg: "#0a0a0a",
    previewText: "#e8e8e8",
    previewAccent: "#a08cff",
    previewSidebar: "#0e0e0e",
  },
];

/** テーマの順序（ローテーション用） */
const THEME_ORDER: Theme[] = ["white", "ivory", "dark-blue", "black"];

// ============================================================
// OS プリファレンス検出
// ============================================================

/** OS のダークモード設定を検出してデフォルトテーマを返す */
const detectOSTheme = (): Theme => {
  try {
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ) {
      return "dark-blue";
    }
  } catch {
    // matchMedia が利用できない場合は無視
  }
  return "white";
};

// ============================================================
// テーマストア
// ============================================================

/** テーマストアの状態型 */
interface ThemeStore {
  /** 現在のテーマ */
  theme: Theme;
  /** テーマを設定する */
  setTheme: (theme: Theme) => void;
  /** 次のテーマに切り替える（ローテーション） */
  cycleTheme: () => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: detectOSTheme(),

      setTheme: (theme: Theme) => {
        document.documentElement.setAttribute("data-theme", theme);
        set({ theme });
      },

      cycleTheme: () => {
        const currentIndex = THEME_ORDER.indexOf(get().theme);
        const nextIndex = (currentIndex + 1) % THEME_ORDER.length;
        const nextTheme = THEME_ORDER[nextIndex];
        if (nextTheme) {
          get().setTheme(nextTheme);
        }
      },
    }),
    {
      name: "stellar-theme",
      // persist は theme フィールドのみ永続化
      partialize: (state) => ({ theme: state.theme }),
      // ストア復元時に data-theme 属性も反映
      onRehydrateStorage: () => {
        return (rehydratedState?: ThemeStore) => {
          if (rehydratedState) {
            document.documentElement.setAttribute(
              "data-theme",
              rehydratedState.theme
            );
          }
        };
      },
    }
  )
);

/** 指定テーマの次のテーマを取得する */
export const getNextTheme = (current: Theme): Theme => {
  const idx = THEME_ORDER.indexOf(current);
  return THEME_ORDER[(idx + 1) % THEME_ORDER.length] ?? "white";
};

/** テーマIDからメタデータを取得する */
export const getThemeMeta = (theme: Theme): ThemeMeta => {
  return THEMES.find((t) => t.id === theme) ?? THEMES[0]!;
};
