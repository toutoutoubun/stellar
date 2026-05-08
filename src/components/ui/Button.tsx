// src/components/ui/Button.tsx
// Stellar — 汎用ボタンコンポーネント
// 改善: ホバー時の視覚フィードバック強化、アクティブ押し込みエフェクト、アイコンアライメント

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
const variantStyles: Record<ButtonVariant, {
  base: React.CSSProperties;
  hover: React.CSSProperties;
}> = {
  primary: {
    base: {
      backgroundColor: "var(--color-accent-primary)",
      color: "var(--color-text-inverse)",
      border: "none",
      boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
    },
    hover: {
      backgroundColor: "var(--color-accent-primary-hover)",
      boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
    },
  },
  secondary: {
    base: {
      backgroundColor: "var(--color-bg-secondary)",
      color: "var(--color-text-primary)",
      border: "1px solid var(--color-border-primary)",
    },
    hover: {
      backgroundColor: "var(--color-bg-hover)",
      borderColor: "var(--color-border-focus)",
    },
  },
  ghost: {
    base: {
      backgroundColor: "transparent",
      color: "var(--color-text-secondary)",
      border: "1px solid transparent",
    },
    hover: {
      backgroundColor: "var(--color-bg-hover)",
      color: "var(--color-text-primary)",
    },
  },
  danger: {
    base: {
      backgroundColor: "var(--color-accent-danger)",
      color: "var(--color-text-inverse)",
      border: "none",
      boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
    },
    hover: {
      backgroundColor: "var(--color-accent-danger)",
      opacity: "0.9",
      boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
    },
  },
};

/** サイズ別のスタイル */
const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: {
    padding: "5px 10px",
    fontSize: "var(--font-size-xs)",
    gap: "var(--space-1)",
    height: "28px",
  },
  md: {
    padding: "6px 14px",
    fontSize: "var(--font-size-sm)",
    gap: "6px",
    height: "34px",
  },
  lg: {
    padding: "8px 18px",
    fontSize: "var(--font-size-base)",
    gap: "var(--space-2)",
    height: "40px",
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
  const vStyle = variantStyles[variant];

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
        whiteSpace: "nowrap",
        ...vStyle.base,
        ...sizeStyles[size],
        ...style,
      }}
      disabled={isDisabled}
      onMouseEnter={(e) => {
        if (!isDisabled) {
          Object.assign(e.currentTarget.style, vStyle.hover);
        }
        props.onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        if (!isDisabled) {
          Object.assign(e.currentTarget.style, vStyle.base, style);
        }
        props.onMouseLeave?.(e);
      }}
      {...props}
    >
      {loading ? (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{ animation: "spin 0.8s linear infinite" }}
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      ) : icon ? (
        <span className="shrink-0 flex items-center">{icon}</span>
      ) : null}
      {children && <span>{children}</span>}
    </button>
  );
};
