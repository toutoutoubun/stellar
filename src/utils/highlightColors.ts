// src/utils/highlightColors.ts
// Stellar — ハイライト色定義
// 4色のハイライトカラー設定（意味別ラベル・CSS変数・アイコン）

import type { HighlightColor } from "../types";

/** 各ハイライト色の詳細設定 */
export interface HighlightColorConfig {
  /** 色キー */
  key: HighlightColor;
  /** 日本語ラベル（用途説明） */
  label: string;
  /** ハイライト背景色（半透明） */
  bg: string;
  /** ハイライト背景色（濃い目、選択時） */
  bgSolid: string;
  /** テキストカラー */
  textColor: string;
  /** ボーダーカラー */
  borderColor: string;
  /** アイコンラベル（色名） */
  icon: string;
  /** アイコン色コード（SVG用） */
  iconColor: string;
  /** ショートカットキー（1〜4） */
  shortcutKey: string;
}

/** ハイライト色定義マップ */
export const HIGHLIGHT_COLORS: Record<HighlightColor, HighlightColorConfig> = {
  yellow: {
    key: "yellow",
    label: "重要",
    bg: "rgba(255, 235, 59, 0.3)",
    bgSolid: "rgba(255, 235, 59, 0.5)",
    textColor: "#f57f17",
    borderColor: "#fdd835",
    icon: "●",
    iconColor: "#EAB308",
    shortcutKey: "1",
  },
  blue: {
    key: "blue",
    label: "引用",
    bg: "rgba(66, 165, 245, 0.3)",
    bgSolid: "rgba(66, 165, 245, 0.5)",
    textColor: "#1565c0",
    borderColor: "#42a5f5",
    icon: "●",
    iconColor: "#3B82F6",
    shortcutKey: "2",
  },
  green: {
    key: "green",
    label: "反論",
    bg: "rgba(102, 187, 106, 0.3)",
    bgSolid: "rgba(102, 187, 106, 0.5)",
    textColor: "#2e7d32",
    borderColor: "#66bb6a",
    icon: "●",
    iconColor: "#22C55E",
    shortcutKey: "3",
  },
  pink: {
    key: "pink",
    label: "定義",
    bg: "rgba(240, 98, 146, 0.3)",
    bgSolid: "rgba(240, 98, 146, 0.5)",
    textColor: "#c2185b",
    borderColor: "#f06292",
    icon: "●",
    iconColor: "#EC4899",
    shortcutKey: "4",
  },
};

/** ハイライト色の配列（ツールバー表示順） */
export const HIGHLIGHT_COLOR_LIST: HighlightColorConfig[] = [
  HIGHLIGHT_COLORS.yellow,
  HIGHLIGHT_COLORS.blue,
  HIGHLIGHT_COLORS.green,
  HIGHLIGHT_COLORS.pink,
];

/** ショートカットキーからハイライト色を取得する */
export function getColorByShortcut(key: string): HighlightColor | null {
  const entry = HIGHLIGHT_COLOR_LIST.find((c) => c.shortcutKey === key);
  return entry ? entry.key : null;
}
