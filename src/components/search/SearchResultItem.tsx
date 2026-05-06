// src/components/search/SearchResultItem.tsx
// Stellar — 個別の検索結果カード
// アイテム種別に応じたアイコン、スニペット強調表示、キーボード/マウスフォーカス

import type React from "react";
import { useRef, useEffect } from "react";
import type { SearchResultItem as SearchResultItemType } from "../../types";
import { parseSnippet } from "../../utils/highlight";
import { IconPaper, IconNote, IconHighlightDot, highlightColorToHex } from "../ui/Icons";

interface SearchResultItemProps {
  /** 検索結果アイテム */
  item: SearchResultItemType;
  /** 選択（キーボードフォーカス）中か */
  isSelected: boolean;
  /** クリック時のコールバック */
  onClick: () => void;
  /** マウスエンター時のコールバック */
  onMouseEnter: () => void;
}

/** アイテム種別に応じたアイコンを返す */
function getItemIcon(item: SearchResultItemType): React.ReactNode {
  if (item.itemType === "paper") return <IconPaper size={14} />;
  if (item.itemType === "note") return <IconNote size={14} />;
  // ハイライトは色に応じたSVGドット
  return <IconHighlightDot size={14} color={highlightColorToHex(item.highlightColor)} />;
}

export const SearchResultCard: React.FC<SearchResultItemProps> = ({
  item,
  isSelected,
  onClick,
  onMouseEnter,
}) => {
  const ref = useRef<HTMLButtonElement>(null);

  // 選択時に自動スクロール
  useEffect(() => {
    if (isSelected && ref.current) {
      ref.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [isSelected]);

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className="w-full text-left flex items-start gap-3"
      style={{
        padding: "10px 16px",
        borderRadius: "10px",
        backgroundColor: isSelected
          ? "var(--color-bg-hover)"
          : "transparent",
        transition: "background-color var(--transition-fast)",
        cursor: "pointer",
        border: "none",
        outline: "none",
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.backgroundColor = "transparent";
        }
      }}
    >
      {/* アイコン */}
      <span
        className="shrink-0 text-sm"
        style={{
          marginTop: "2px",
          lineHeight: 1,
          fontSize: "14px",
        }}
      >
        {getItemIcon(item)}
      </span>

      {/* コンテンツ */}
      <div className="flex-1 min-w-0">
        {/* タイトル行 */}
        <div className="flex items-baseline justify-between gap-2">
          <span
            className="text-sm font-medium truncate"
            style={{
              color: "var(--color-text-primary)",
              lineHeight: "1.4",
            }}
          >
            {item.title || "無題"}
          </span>
          {item.meta && (
            <span
              className="shrink-0 text-xs"
              style={{
                color: "var(--color-text-tertiary)",
                whiteSpace: "nowrap",
              }}
            >
              {item.meta}
            </span>
          )}
        </div>

        {/* スニペット */}
        {item.snippet && (
          <div
            className="text-xs mt-0.5 line-clamp-2"
            style={{
              color: "var(--color-text-secondary)",
              lineHeight: "1.6",
            }}
          >
            {parseSnippet(item.snippet)}
          </div>
        )}
      </div>

      {/* Enter インジケーター（選択時のみ） */}
      {isSelected && (
        <span
          className="shrink-0 self-center"
          style={{
            fontSize: "10px",
            padding: "1px 5px",
            borderRadius: "3px",
            backgroundColor: "var(--color-bg-tertiary)",
            border: "1px solid var(--color-border-secondary)",
            color: "var(--color-text-tertiary)",
            fontFamily: "var(--font-family-sans)",
          }}
        >
          ↵
        </span>
      )}
    </button>
  );
};
