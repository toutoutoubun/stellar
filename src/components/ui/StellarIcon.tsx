// src/components/ui/StellarIcon.tsx
// Stellar — 統一アプリアイコン（幾何学的星型）
// Titlebar, Onboarding, Tutorial, Sidebar 等すべてで共通使用
// 影・グラデーション不使用 / フラットな幾何学デザイン

import type React from "react";

interface StellarIconProps {
  /** アイコンの幅・高さ (px) */
  size?: number;
  /** メインカラー（デフォルト: --color-accent-primary） */
  color?: string;
  /** className を追加 */
  className?: string;
  /** インラインスタイル追加 */
  style?: React.CSSProperties;
}

/**
 * Stellar 統一星型アイコン
 * フラットな幾何学デザイン。影・グラデーション不使用。
 * 六芒星ベースの星に中央の円を組み合わせた学術的デザイン。
 */
export const StellarIcon: React.FC<StellarIconProps> = ({
  size = 18,
  color,
  className,
  style,
}) => {
  const main = color || "var(--color-accent-primary)";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      {/* 外側の八芒星 — 2つの正方形を45°回転して重ね合わせ */}
      <rect x="10" y="10" width="28" height="28" rx="2" fill={main} />
      <rect
        x="10"
        y="10"
        width="28"
        height="28"
        rx="2"
        fill={main}
        transform="rotate(45 24 24)"
      />
      {/* 中心の白い円 — 知のシンボル */}
      <circle cx="24" cy="24" r="9" fill="white" />
      {/* 中心の星 — 小さな四芒星 */}
      <path
        d="M24 17 L25.8 22.2 L31 24 L25.8 25.8 L24 31 L22.2 25.8 L17 24 L22.2 22.2 Z"
        fill={main}
      />
    </svg>
  );
};
