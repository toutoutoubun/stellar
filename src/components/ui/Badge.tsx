// src/components/ui/Badge.tsx
// Stellar — バッジ / タグコンポーネント
// 論文・ノートのタグ表示に使用する

import type React from "react";
import { clsx } from "clsx";
import { useT } from "../../stores/useI18nStore";

interface BadgeProps {
  /** バッジのテキスト */
  children: React.ReactNode;
  /** 削除ボタンを表示するか */
  removable?: boolean;
  /** 削除時のコールバック */
  onRemove?: () => void;
  /** カスタムクラス */
  className?: string;
  /** カスタムスタイル */
  style?: React.CSSProperties;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  removable = false,
  onRemove,
  className,
  style,
}) => {
  const t = useT();
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 text-xs font-medium select-none",
        className
      )}
      style={{
        backgroundColor: "var(--color-tag-bg)",
        color: "var(--color-tag-text)",
        border: "1px solid var(--color-tag-border)",
        borderRadius: "var(--radius-tag)",
        padding: "2px 8px",
        lineHeight: "1.4",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      <span>{children}</span>
      {removable && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="flex items-center justify-center shrink-0 -mr-1"
          style={{
            width: "14px",
            height: "14px",
            borderRadius: "999px",
            color: "var(--color-tag-text)",
            opacity: 0.6,
            transition: "opacity var(--transition-fast)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "1";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "0.6";
          }}
          aria-label={t.ui.str_g5a39h}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </span>
  );
};
