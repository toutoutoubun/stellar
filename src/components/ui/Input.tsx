// src/components/ui/Input.tsx
// Stellar — 入力フィールドコンポーネント
// テキスト入力・検索フィールド等に使用する汎用インプット

import type React from "react";
import { forwardRef } from "react";
import { clsx } from "clsx";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** 入力フィールドのラベル */
  label?: string;
  /** エラーメッセージ */
  error?: string;
  /** 左側のアイコン */
  icon?: React.ReactNode;
  /** フルwidthにするか */
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, fullWidth = false, className, style, ...props }, ref) => {
    return (
      <div
        className={clsx("flex flex-col gap-1", fullWidth && "w-full")}
      >
        {label && (
          <label
            className="text-xs font-medium"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span
              className="absolute top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center"
              style={{ color: "var(--color-text-tertiary)", left: "10px", width: "16px" }}
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
              padding: "var(--space-2) var(--space-3)",
              paddingLeft: icon ? "34px" : "var(--space-3)",
              fontSize: "var(--font-size-sm)",
              transition: "all var(--transition-fast)",
              outline: "none",
              ...style,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--color-border-focus)";
              e.currentTarget.style.boxShadow =
                "0 0 0 3px var(--color-bg-selection)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = error
                ? "var(--color-border-error)"
                : "var(--color-border-primary)";
              e.currentTarget.style.boxShadow = "none";
            }}
            {...props}
          />
        </div>
        {error && (
          <span
            className="text-xs"
            style={{ color: "var(--color-accent-danger)" }}
          >
            {error}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
