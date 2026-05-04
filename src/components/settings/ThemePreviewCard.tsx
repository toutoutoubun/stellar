// src/components/settings/ThemePreviewCard.tsx
// Stellar — テーマプレビューカード
// 64×48px ミニプレビュー + テーマ名・説明・選択状態（チェックマーク＋アクティブボーダー）

import type React from "react";
import { useCallback } from "react";
import type { ThemeMeta } from "../../stores/useThemeStore";

interface ThemePreviewCardProps {
  /** テーマメタデータ */
  meta: ThemeMeta;
  /** 現在選択中か */
  isSelected: boolean;
  /** クリック時にテーマを切り替える */
  onSelect: (themeId: ThemeMeta["id"]) => void;
}

export const ThemePreviewCard: React.FC<ThemePreviewCardProps> = ({
  meta,
  isSelected,
  onSelect,
}) => {
  const handleClick = useCallback(() => {
    onSelect(meta.id);
  }, [meta.id, onSelect]);

  return (
    <button
      onClick={handleClick}
      className="flex flex-col items-start gap-2 p-3 text-left transition-all"
      style={{
        borderRadius: "var(--radius-card)",
        border: isSelected
          ? "2px solid var(--color-accent-primary)"
          : "2px solid var(--color-border-secondary)",
        backgroundColor: isSelected
          ? "var(--color-bg-hover)"
          : "var(--color-bg-card)",
        cursor: "pointer",
        minWidth: "140px",
        transition: "all var(--transition-normal)",
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = "var(--color-border-focus)";
          e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = "var(--color-border-secondary)";
          e.currentTarget.style.backgroundColor = "var(--color-bg-card)";
        }
      }}
    >
      {/* ミニプレビュー (64×48px) */}
      <div className="relative" style={{ width: "64px", height: "48px" }}>
        <div
          style={{
            width: "64px",
            height: "48px",
            borderRadius: "6px",
            overflow: "hidden",
            border: "1px solid var(--color-border-secondary)",
            display: "flex",
          }}
        >
          {/* サイドバー */}
          <div
            style={{
              width: "14px",
              height: "100%",
              backgroundColor: meta.previewSidebar,
              borderRight: `1px solid ${meta.previewText}20`,
              display: "flex",
              flexDirection: "column",
              gap: "3px",
              padding: "6px 3px",
            }}
          >
            <div
              style={{
                width: "8px",
                height: "2px",
                borderRadius: "1px",
                backgroundColor: meta.previewAccent,
              }}
            />
            <div
              style={{
                width: "8px",
                height: "2px",
                borderRadius: "1px",
                backgroundColor: `${meta.previewText}30`,
              }}
            />
            <div
              style={{
                width: "8px",
                height: "2px",
                borderRadius: "1px",
                backgroundColor: `${meta.previewText}30`,
              }}
            />
          </div>
          {/* メインエリア */}
          <div
            style={{
              flex: 1,
              backgroundColor: meta.previewBg,
              padding: "6px 5px",
              display: "flex",
              flexDirection: "column",
              gap: "3px",
            }}
          >
            {/* タイトル行 */}
            <div
              style={{
                width: "24px",
                height: "3px",
                borderRadius: "1px",
                backgroundColor: meta.previewText,
                opacity: 0.8,
              }}
            />
            {/* テキスト行 */}
            <div
              style={{
                width: "32px",
                height: "2px",
                borderRadius: "1px",
                backgroundColor: meta.previewText,
                opacity: 0.3,
              }}
            />
            <div
              style={{
                width: "28px",
                height: "2px",
                borderRadius: "1px",
                backgroundColor: meta.previewText,
                opacity: 0.3,
              }}
            />
            {/* アクセントバー */}
            <div
              style={{
                width: "18px",
                height: "3px",
                borderRadius: "2px",
                backgroundColor: meta.previewAccent,
                marginTop: "2px",
              }}
            />
          </div>
        </div>

        {/* 選択チェックマーク */}
        {isSelected && (
          <div
            style={{
              position: "absolute",
              top: "-4px",
              right: "-4px",
              width: "18px",
              height: "18px",
              borderRadius: "50%",
              backgroundColor: "var(--color-accent-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
      </div>

      {/* テーマ名 + 説明 */}
      <div>
        <div
          className="text-xs font-medium"
          style={{ color: "var(--color-text-primary)" }}
        >
          {meta.label}
        </div>
        <div
          className="text-xs mt-0.5"
          style={{
            color: "var(--color-text-tertiary)",
            fontSize: "10px",
          }}
        >
          {meta.description}
        </div>
      </div>
    </button>
  );
};
