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
