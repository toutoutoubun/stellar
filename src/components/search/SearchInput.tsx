// src/components/search/SearchInput.tsx
// Stellar — 検索入力コンポーネント
// debounce はフック側で処理、ここは見た目と入力制御のみ担当
// スピナー表示、クリアボタン、自動フォーカス

import type React from "react";
import { useRef, useEffect } from "react";

interface SearchInputProps {
  /** 検索クエリ */
  value: string;
  /** クエリ変更 */
  onChange: (value: string) => void;
  /** ローディング中 */
  isLoading: boolean;
  /** キーボードイベント（ナビゲーション） */
  onKeyDown: (e: React.KeyboardEvent) => void;
  /** Enter キー押下 */
  onEnter: () => void;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  isLoading,
  onKeyDown,
  onEnter,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // マウント時に自動フォーカス
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onEnter();
      return;
    }
    onKeyDown(e);
  };

  return (
    <div
      className="flex items-center gap-3"
      style={{
        padding: "16px 20px",
        borderBottom: "1px solid var(--color-border-primary)",
      }}
    >
      {/* 検索アイコン or スピナー */}
      <span
        className="shrink-0"
        style={{ color: "var(--color-text-tertiary)", width: "20px", height: "20px" }}
      >
        {isLoading ? (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ animation: "spin 0.8s linear infinite" }}
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        ) : (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        )}
      </span>

      {/* 入力フィールド */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="論文、ノート、ハイライトを検索..."
        className="flex-1 text-sm outline-none user-select-text"
        style={{
          backgroundColor: "transparent",
          color: "var(--color-text-primary)",
          caretColor: "var(--color-accent-primary)",
          fontSize: "15px",
          lineHeight: "1.5",
        }}
        autoComplete="off"
        spellCheck={false}
      />

      {/* クリアボタン */}
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="shrink-0 flex items-center justify-center"
          style={{
            width: "24px",
            height: "24px",
            borderRadius: "6px",
            color: "var(--color-text-tertiary)",
            transition: "all var(--transition-fast)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
            e.currentTarget.style.color = "var(--color-text-secondary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "var(--color-text-tertiary)";
          }}
          aria-label="検索をクリア"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}

      {/* ESC ヒント */}
      <kbd
        className="shrink-0"
        style={{
          fontSize: "10px",
          padding: "2px 6px",
          borderRadius: "4px",
          backgroundColor: "var(--color-bg-tertiary)",
          border: "1px solid var(--color-border-secondary)",
          color: "var(--color-text-tertiary)",
          fontFamily: "var(--font-family-sans)",
        }}
      >
        ESC
      </kbd>
    </div>
  );
};
