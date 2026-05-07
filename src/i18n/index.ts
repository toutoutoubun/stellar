// src/i18n/index.ts — i18n エントリポイント
// ロケールに応じた翻訳リソースを返すユーティリティ

import type { Locale } from "../types";
import type { TranslationKeys } from "./ja";
import ja from "./ja";
import en from "./en";
import fr from "./fr";
import af from "./af";

/** ロケール → 翻訳リソースのマッピング */
const resources: Record<Locale, TranslationKeys> = { ja, en, fr, af };

/** 指定ロケールの翻訳リソースを取得 */
export function getTranslations(locale: Locale): TranslationKeys {
  return resources[locale] ?? ja;
}

/** サポートされているロケール一覧 */
export const SUPPORTED_LOCALES: Locale[] = ["ja", "en", "fr", "af"];

/** ロケールの表示名（各言語のネイティブ名） */
export const LOCALE_NATIVE_NAMES: Record<Locale, string> = {
  ja: "日本語",
  en: "English",
  fr: "Français",
  af: "Afrikaans",
};

/** ロケールの国旗絵文字 */
export const LOCALE_FLAGS: Record<Locale, string> = {
  ja: "🇯🇵",
  en: "🇬🇧",
  fr: "🇫🇷",
  af: "🇿🇦",
};

export type { TranslationKeys };
