/* eslint-disable react-refresh/only-export-components */
// src/components/ui/Icons.tsx
// Stellar — 独自 SVG アイコンライブラリ
// システム絵文字を排除し、全てのアイコンを統一された SVG で提供する

import type React from "react";

interface IconProps {
  /** アイコンのサイズ (px) */
  size?: number;
  /** CSSクラス名 */
  className?: string;
  /** インラインスタイル */
  style?: React.CSSProperties;
}

/** 論文 / ドキュメントアイコン (旧: 📄) */
export const IconPaper: React.FC<IconProps> = ({ size = 14, className, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

/** ノートアイコン (旧: 📝) */
export const IconNote: React.FC<IconProps> = ({ size = 14, className, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

/** ディスク / ストレージアイコン (旧: 💾) */
export const IconDisk: React.FC<IconProps> = ({ size = 14, className, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
  >
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

/** ハイライト丸アイコン — 色を props で指定 (旧: 🟡🔵🟢🩷) */
export const IconHighlightDot: React.FC<IconProps & { color: string }> = ({
  size = 14,
  color,
  className,
  style,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={className}
    style={style}
  >
    <circle cx="12" cy="12" r="8" fill={color} opacity="0.85" />
    <circle cx="12" cy="12" r="8" fill="none" stroke={color} strokeWidth="2" opacity="0.5" />
  </svg>
);

/** アイテム種別に応じた統合アイコン（paper/note を自動判定） */
export const IconItemType: React.FC<IconProps & { itemType: "paper" | "note" }> = ({
  itemType,
  ...rest
}) => (itemType === "paper" ? <IconPaper {...rest} /> : <IconNote {...rest} />);

// ────────────────────────────────────────────
// 量的分析・データ系アイコン (旧: 📊📋📝✏️🏷📅🗑⚠️)
// ────────────────────────────────────────────

/** グラフ / チャートアイコン (旧: 📊) */
export const IconChart: React.FC<IconProps> = ({ size = 14, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

/** クリップボード / リストアイコン (旧: 📋) */
export const IconClipboard: React.FC<IconProps> = ({ size = 14, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
  </svg>
);

/** 編集 / ペンアイコン (旧: ✏️) */
export const IconEdit: React.FC<IconProps> = ({ size = 14, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

/** タグアイコン (旧: 🏷) */
export const IconTag: React.FC<IconProps> = ({ size = 14, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

/** カレンダーアイコン (旧: 📅) */
export const IconCalendar: React.FC<IconProps> = ({ size = 14, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

/** ゴミ箱アイコン (旧: 🗑) */
export const IconTrash: React.FC<IconProps> = ({ size = 14, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

/** 警告三角アイコン (旧: ⚠️) */
export const IconWarning: React.FC<IconProps> = ({ size = 14, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

/** ハイライト色から色コードへの変換 */
export function highlightColorToHex(color: string | undefined): string {
  switch (color) {
    case "yellow":
      return "#EAB308";
    case "blue":
      return "#3B82F6";
    case "green":
      return "#22C55E";
    case "pink":
      return "#EC4899";
    default:
      return "#EAB308";
  }
}
