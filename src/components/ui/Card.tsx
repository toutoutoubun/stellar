// src/components/ui/Card.tsx
// Stellar — カードコンポーネント
// 改善: ホバー時のリフトエフェクト強化、選択状態の視覚強化、スタガードアニメーション対応

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
  /** スタガードアニメーション用の遅延（ms） */
  animationDelay?: number;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  style,
  onClick,
  hoverable = false,
  selected = false,
  animationDelay,
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
        boxShadow: selected ? "var(--shadow-card-hover)" : "var(--shadow-card)",
        border: selected
          ? "2px solid var(--color-accent-primary)"
          : "1px solid var(--color-border-secondary)",
        padding: "var(--space-4)",
        transition: "all var(--transition-normal)",
        ...(hoverable ? { cursor: "pointer" } : {}),
        ...(animationDelay !== undefined
          ? {
              animation: "card-stagger-in 300ms ease both",
              animationDelay: `${animationDelay}ms`,
            }
          : {}),
        ...style,
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (hoverable) {
          e.currentTarget.style.boxShadow = "var(--shadow-card-hover)";
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.borderColor = "var(--color-border-focus)";
        }
      }}
      onMouseLeave={(e) => {
        if (hoverable) {
          e.currentTarget.style.boxShadow = selected
            ? "var(--shadow-card-hover)"
            : "var(--shadow-card)";
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.borderColor = selected
            ? "var(--color-accent-primary)"
            : "var(--color-border-secondary)";
        }
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* 選択状態インジケーター */}
      {selected && (
        <span
          style={{
            position: "absolute",
            top: "var(--space-3)",
            right: "var(--space-3)",
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor: "var(--color-accent-primary)",
            boxShadow: "0 0 0 2px var(--color-bg-card)",
          }}
        />
      )}
      {children}
    </div>
  );
};
