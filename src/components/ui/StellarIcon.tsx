// src/components/ui/StellarIcon.tsx
// Stellar — 統一アプリアイコン（星型）
// Titlebar, Onboarding, Tutorial, Sidebar 等すべてで共通使用

import type React from "react";

interface StellarIconProps {
  /** アイコンの幅・高さ (px) */
  size?: number;
  /** 色を指定（デフォルト: --color-accent-primary） */
  color?: string;
  /** className を追加 */
  className?: string;
  /** インラインスタイル追加 */
  style?: React.CSSProperties;
}

/**
 * Stellar 統一星型アイコン
 * グラデーション付きの星型 SVG。すべての場所で同じアイコンを使用する。
 */
export const StellarIcon: React.FC<StellarIconProps> = ({
  size = 18,
  color,
  className,
  style,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={style}
  >
    <defs>
      <linearGradient id="stellar-icon-grad" x1="24" y1="2" x2="24" y2="46" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor={color || "var(--color-accent-primary)"} />
        <stop offset="100%" stopColor={color || "var(--color-accent-secondary, var(--color-accent-primary))"} />
      </linearGradient>
    </defs>
    <polygon
      points="24,2 30.18,16.52 46,18.54 34,28.28 36.36,44.02 24,37.54 11.64,44.02 14,28.28 2,18.54 17.82,16.52"
      fill="url(#stellar-icon-grad)"
    />
    <polygon
      points="24,8 28.36,18.12 39.2,19.6 31.2,26.8 32.72,37.56 24,32.54 15.28,37.56 16.8,26.8 8.8,19.6 19.64,18.12"
      fill="white"
      fillOpacity="0.2"
    />
  </svg>
);
