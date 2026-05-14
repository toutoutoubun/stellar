// src/stores/useThemeStore.ts
// Stellar — テーマストア（Zustand persist）
// localStorage に永続化、OS prefers-color-scheme 検出、テーマメタデータ管理

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Theme, BuiltInTheme } from "../types";
import { useI18nStore } from "./useI18nStore";
import { getThemeAddons } from "../plugins/addonRegistry";

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
    label: useI18nStore.getState().t.themes.white,
    description: useI18nStore.getState().t.themes.whiteDesc,
    icon: "sun",
    previewBg: "#ffffff",
    previewText: "#1a1a2e",
    previewAccent: "#4285f4",
    previewSidebar: "#f8f9fa",
  },
  {
    id: "ivory",
    label: useI18nStore.getState().t.themes.ivory,
    description: useI18nStore.getState().t.themes.ivoryDesc,
    icon: "sunrise",
    previewBg: "#faf8f5",
    previewText: "#2c2416",
    previewAccent: "#b4783c",
    previewSidebar: "#f5f0eb",
  },
  {
    id: "dark-blue",
    label: useI18nStore.getState().t.stores.k_1txb7w,
    description: useI18nStore.getState().t.stores.k_e19fm3,
    icon: "moon",
    previewBg: "#1a1f2e",
    previewText: "#e0e4ec",
    previewAccent: "#64a0ff",
    previewSidebar: "#161b28",
  },
  {
    id: "black",
    label: useI18nStore.getState().t.themes.black,
    description: useI18nStore.getState().t.themes.blackDesc,
    icon: "circle",
    previewBg: "#0a0a0a",
    previewText: "#e8e8e8",
    previewAccent: "#a08cff",
    previewSidebar: "#0e0e0e",
  },
];

/** ビルトインテーマの順序（ローテーション用） */
const BUILT_IN_THEME_ORDER: BuiltInTheme[] = ["white", "ivory", "dark-blue", "black"];

/** テーマの全順序（ビルトイン + プラグインテーマ）を動的に取得 */
function getThemeOrder(): Theme[] {
  const pluginThemeIds = getThemeAddons().map((a) => a.id);
  return [...BUILT_IN_THEME_ORDER, ...pluginThemeIds];
}

/** ビルトイン + プラグインテーマの全メタデータを取得 */
export function getAllThemes(): ThemeMeta[] {
  const pluginMetas: ThemeMeta[] = getThemeAddons().map((addon) => ({
    id: addon.id,
    label: addon.label,
    description: addon.description ?? "",
    icon: "circle" as const,
    previewBg: addon.preview?.bg ?? "#888888",
    previewText: addon.preview?.text ?? "#ffffff",
    previewAccent: addon.preview?.accent ?? "#4285f4",
    previewSidebar: addon.preview?.sidebar ?? "#666666",
  }));
  return [...THEMES, ...pluginMetas];
}

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
        const order = getThemeOrder();
        const currentIndex = order.indexOf(get().theme);
        const nextIndex = (currentIndex + 1) % order.length;
        const nextTheme = order[nextIndex];
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
  const order = getThemeOrder();
  const idx = order.indexOf(current);
  return order[(idx + 1) % order.length] ?? "white";
};

/** テーマIDからメタデータを取得する（プラグインテーマ含む） */
export const getThemeMeta = (theme: Theme): ThemeMeta => {
  return getAllThemes().find((t) => t.id === theme) ?? THEMES[0]!;
};
