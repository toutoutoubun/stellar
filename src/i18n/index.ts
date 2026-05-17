// src/i18n/index.ts — i18n エントリポイント
// ロケールに応じた翻訳リソースを返すユーティリティ

import type { Locale } from "../types";
import type { TranslationKeys } from "./ja";
import ja from "./ja";
import en from "./en";
import fr from "./fr";
import af from "./af";
import zu from "./zu";
import xh from "./xh";
import nso from "./nso";
import tn from "./tn";
import st from "./st";

/** ロケール → 翻訳リソースのマッピング */
const resources: Record<Locale, TranslationKeys> = { ja, en, fr, af, zu, xh, nso, tn, st };

/** 指定ロケールの翻訳リソースを取得 */
export function getTranslations(locale: Locale): TranslationKeys {
  return resources[locale] ?? ja;
}

/** サポートされているロケール一覧 */
export const SUPPORTED_LOCALES: Locale[] = ["ja", "en", "fr", "af", "zu", "xh", "nso", "tn", "st"];

/** ロケールの表示名（各言語のネイティブ名） */
export const LOCALE_NATIVE_NAMES: Record<Locale, string> = {
  ja: "日本語",
  en: "English",
  fr: "Français",
  af: "Afrikaans",
  zu: "isiZulu",
  xh: "isiXhosa",
  nso: "Sepedi",
  tn: "Setswana",
  st: "Sesotho",
};

export type { TranslationKeys };
