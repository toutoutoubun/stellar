// src/stores/useI18nStore.ts
// Stellar — i18n ストア（Zustand persist）
// localStorage に永続化、ロケール切り替え、翻訳リソース取得

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Locale } from "../types";
import { getTranslations } from "../i18n";
import type { TranslationKeys } from "../i18n";

/** i18n ストアの状態型 */
interface I18nStore {
  /** 現在のロケール */
  locale: Locale;
  /** ロケールを設定する */
  setLocale: (locale: Locale) => void;
  /** 現在のロケールの翻訳リソースを取得する */
  t: TranslationKeys;
}

/** ブラウザの言語設定からデフォルトロケールを推定 */
function detectBrowserLocale(): Locale {
  try {
    const lang = navigator.language?.toLowerCase() ?? "";
    if (lang.startsWith("ja")) return "ja";
    if (lang.startsWith("fr")) return "fr";
    if (lang.startsWith("af")) return "af";
    if (lang.startsWith("en")) return "en";
  } catch {
    // SSR やテスト環境では無視
  }
  return "ja";
}

export const useI18nStore = create<I18nStore>()(
  persist(
    (set) => {
      const initialLocale = detectBrowserLocale();
      return {
        locale: initialLocale,
        t: getTranslations(initialLocale),

        setLocale: (locale: Locale) => {
          set({ locale, t: getTranslations(locale) });
        },
      };
    },
    {
      name: "stellar-i18n",
      partialize: (state) => ({ locale: state.locale }),
      onRehydrateStorage: () => {
        return (rehydratedState?: I18nStore) => {
          if (rehydratedState) {
            // 永続化されたロケールから翻訳リソースを再設定
            rehydratedState.t = getTranslations(rehydratedState.locale);
          }
        };
      },
    }
  )
);

/** フック: 翻訳リソースを取得するショートハンド */
export function useT(): TranslationKeys {
  return useI18nStore((s) => s.t);
}
