// src/components/ui/Button.tsx
// Stellar — 汎用ボタンコンポーネント
// variant / size / disabled / loading 状態に対応

import type React from "react";
import { clsx } from "clsx";

/** ボタンのバリアント */
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

/** ボタンのサイズ */
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

/** バリアント別のスタイル */
const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    backgroundColor: "var(--color-accent-primary)",
    color: "var(--color-text-inverse)",
    border: "none",
  },
  secondary: {
    backgroundColor: "var(--color-bg-secondary)",
    color: "var(--color-text-primary)",
    border: "1px solid var(--color-border-primary)",
  },
  ghost: {
    backgroundColor: "transparent",
    color: "var(--color-text-secondary)",
    border: "none",
  },
  danger: {
    backgroundColor: "var(--color-accent-danger)",
    color: "var(--color-text-inverse)",
    border: "none",
  },
};

/** サイズ別のスタイル */
const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: {
    padding: "var(--space-1) var(--space-2)",
    fontSize: "var(--font-size-xs)",
    gap: "var(--space-1)",
  },
  md: {
    padding: "var(--space-2) var(--space-3)",
    fontSize: "var(--font-size-sm)",
    gap: "var(--space-2)",
  },
  lg: {
    padding: "var(--space-3) var(--space-4)",
    fontSize: "var(--font-size-base)",
    gap: "var(--space-2)",
  },
};

export const Button: React.FC<ButtonProps> = ({
  variant = "secondary",
  size = "md",
  loading = false,
  disabled = false,
  icon,
  children,
  className,
  style,
  ...props
}) => {
  const isDisabled = disabled || loading;

  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center font-medium select-none",
        "transition-all",
        className
      )}
      style={{
        borderRadius: "var(--radius-button)",
        transition: "all var(--transition-fast)",
        opacity: isDisabled ? 0.5 : 1,
        cursor: isDisabled ? "not-allowed" : "pointer",
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <svg
          className="animate-spin"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children && <span>{children}</span>}
    </button>
  );
};
