// src/components/ui/Input.tsx
// Stellar — 入力フィールドコンポーネント
// 改善: フォーカス時のリングエフェクト強化、ラベルの視覚階層、エラー表示

import type React from "react";
import { forwardRef } from "react";
import { clsx } from "clsx";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** 入力フィールドのラベル */
  label?: string;
  /** エラーメッセージ */
  error?: string;
  /** ヘルプテキスト */
  hint?: string;
  /** 左側のアイコン */
  icon?: React.ReactNode;
  /** フルwidthにするか */
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, fullWidth = false, className, style, ...props }, ref) => {
    return (
      <div
        className={clsx("flex flex-col", fullWidth && "w-full")}
        style={{ gap: "5px" }}
      >
        {label && (
          <label
            className="text-xs font-medium"
            style={{
              color: error ? "var(--color-accent-danger)" : "var(--color-text-secondary)",
              letterSpacing: "0.01em",
            }}
          >
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span
              className="absolute top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center"
              style={{
                color: "var(--color-text-tertiary)",
                left: "10px",
                width: "16px",
              }}
            >
              {icon}
            </span>
          )}
          <input
            ref={ref}
            className={clsx(
              "w-full text-sm transition-all",
              className
            )}
            style={{
              backgroundColor: "var(--color-bg-input)",
              color: "var(--color-text-primary)",
              border: error
                ? "1px solid var(--color-border-error)"
                : "1px solid var(--color-border-primary)",
              borderRadius: "var(--radius-input)",
              padding: "6px var(--space-3)",
              paddingLeft: icon ? "34px" : "var(--space-3)",
              height: "34px",
              fontSize: "var(--font-size-sm)",
              transition: "all var(--transition-fast)",
              outline: "none",
              ...style,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = error
                ? "var(--color-border-error)"
                : "var(--color-border-focus)";
              e.currentTarget.style.boxShadow = error
                ? "0 0 0 3px rgba(224, 49, 49, 0.12)"
                : "0 0 0 3px var(--color-bg-selection)";
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = error
                ? "var(--color-border-error)"
                : "var(--color-border-primary)";
              e.currentTarget.style.boxShadow = "none";
              props.onBlur?.(e);
            }}
            {...props}
          />
        </div>
        {/* エラーメッセージ */}
        {error && (
          <div
            className="flex items-center gap-1 text-xs"
            style={{ color: "var(--color-accent-danger)" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}
        {/* ヘルプテキスト */}
        {hint && !error && (
          <span
            className="text-xs"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {hint}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
