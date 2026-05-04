// src/components/ui/Card.tsx
// Stellar — カードコンポーネント
// 論文・ノートの一覧表示に使用する汎用カード

import type React from "react";
import { clsx } from "clsx";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  /** ホバー時のシャドウ拡大エフェクト */
  hoverable?: boolean;
  /** 選択状態 */
  selected?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  style,
  onClick,
  hoverable = false,
  selected = false,
}) => {
  return (
    <div
      className={clsx(
        "relative overflow-hidden",
        onClick && "cursor-pointer",
        className
      )}
      style={{
        backgroundColor: "var(--color-bg-card)",
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-card)",
        border: selected
          ? "2px solid var(--color-accent-primary)"
          : "1px solid var(--color-border-secondary)",
        padding: "var(--space-4)",
        transition: "all var(--transition-fast)",
        ...(hoverable
          ? {
              cursor: "pointer",
            }
          : {}),
        ...style,
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (hoverable) {
          e.currentTarget.style.boxShadow = "var(--shadow-card-hover)";
          e.currentTarget.style.transform = "translateY(-1px)";
        }
      }}
      onMouseLeave={(e) => {
        if (hoverable) {
          e.currentTarget.style.boxShadow = "var(--shadow-card)";
          e.currentTarget.style.transform = "translateY(0)";
        }
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
};
