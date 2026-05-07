// src/components/reader/HighlightCard.tsx
// Stellar — ハイライトカード
// 色インジケーター、ページバッジ、引用ブロック風テキスト、
// コメント編集、右クリックコンテキストメニュー（ノート変換・削除・引用コピー）

import type React from "react";
import { useState, useCallback, useRef, useEffect } from "react";
import type { Highlight } from "../../types";
import { HIGHLIGHT_COLORS } from "../../utils/highlightColors";
import { toast } from "../ui/Toast";
import { useT } from "../../stores/useI18nStore";

interface HighlightCardProps {
  /** ハイライトデータ */
  highlight: Highlight;
  /** 選択状態 */
  isSelected: boolean;
  /** コメント保存中か */
  isSavingComment: boolean;
  /** PDF上でスクロール先に指定されているか */
  isScrolledTo: boolean;
  /** カードクリック → PDF該当位置へスクロール */
  onScrollToPdf: (highlight: Highlight) => void;
  /** コメント更新コールバック（debounce付き） */
  onUpdateComment: (highlightId: string, comment: string) => void;
  /** 削除コールバック */
  onDelete: (highlightId: string) => void;
  /** 選択トグルコールバック */
  onToggleSelect: (highlightId: string) => void;
}

export const HighlightCard: React.FC<HighlightCardProps> = ({
  highlight,
  isSelected,
  isSavingComment,
  isScrolledTo,
  onScrollToPdf,
  onUpdateComment,
  onDelete,
  onToggleSelect,
}) => {
  const t = useT();
  const colorConfig = HIGHLIGHT_COLORS[highlight.color];
  const [localComment, setLocalComment] = useState(highlight.comment ?? "");
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // 外部からハイライトのコメントが変わった場合にローカル状態を同期
  useEffect(() => {
    setLocalComment(highlight.comment ?? "");
  }, [highlight.comment]);

  // isScrolledTo になったらカードをビューに入れる
  useEffect(() => {
    if (isScrolledTo && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isScrolledTo]);

  /** コメント変更ハンドラ */
  const handleCommentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setLocalComment(value);
      onUpdateComment(highlight.id, value);
    },
    [highlight.id, onUpdateComment],
  );

  /** 右クリックメニュー表示 */
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY });
    },
    [],
  );

  /** コンテキストメニューを閉じる */
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // コンテキストメニュー外クリックで閉じる
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        closeContextMenu();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [contextMenu, closeContextMenu]);

  /** 引用テキストをクリップボードにコピー */
  const handleCopyQuote = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(highlight.text);
      toast.success(t.reader.str_vakekh);
    } catch {
      toast.error(t.quantitative.k_czy3x7);
    }
    closeContextMenu();
  }, [highlight.text, closeContextMenu]);

  /** 削除 */
  const handleDelete = useCallback(() => {
    onDelete(highlight.id);
    closeContextMenu();
  }, [highlight.id, onDelete, closeContextMenu]);

  return (
    <>
      <div
        ref={cardRef}
        className="relative group"
        style={{
          borderRadius: "10px",
          border: isScrolledTo
            ? `2px solid ${colorConfig.borderColor}`
            : isSelected
              ? "2px solid var(--color-accent-primary)"
              : "1px solid var(--color-border-primary)",
          backgroundColor: "var(--color-bg-primary)",
          padding: isScrolledTo || isSelected ? "11px" : "12px",
          transition: "border-color 150ms ease-out, box-shadow 150ms ease-out",
          boxShadow: isScrolledTo
            ? `0 0 0 3px ${colorConfig.bg}`
            : "none",
          cursor: "pointer",
        }}
        onClick={() => onScrollToPdf(highlight)}
        onContextMenu={handleContextMenu}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onScrollToPdf(highlight);
          }
        }}
        aria-label={t.reader.k_nz9we3}
      >
        {/* 左側カラーインジケーターバー */}
        <div
          style={{
            position: "absolute",
            left: "0",
            top: "8px",
            bottom: "8px",
            width: "3px",
            borderRadius: "0 3px 3px 0",
            backgroundColor: colorConfig.bgSolid,
          }}
        />

        {/* ヘッダー: ページバッジ + チェックボックス */}
        <div className="flex items-center justify-between mb-2 ml-2">
          <div className="flex items-center gap-2">
            {/* ページ番号バッジ */}
            <span
              className="text-xs px-1.5 py-0.5"
              style={{
                backgroundColor: colorConfig.bg,
                color: colorConfig.textColor,
                borderRadius: "4px",
                fontWeight: 500,
              }}
            >
              p.{highlight.page}
            </span>
            {/* 色ラベル */}
            <span
              className="text-xs"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              <span style={{ color: colorConfig.iconColor }}>{colorConfig.icon}</span> {colorConfig.label}
            </span>
          </div>

          {/* 選択チェックボックス */}
          <label
            className="flex items-center"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(highlight.id)}
              className="sr-only"
              aria-label={t.reader.str_zblg00}
            />
            <div
              className="flex items-center justify-center"
              style={{
                width: "16px",
                height: "16px",
                borderRadius: "4px",
                border: isSelected
                  ? "none"
                  : "1.5px solid var(--color-border-secondary)",
                backgroundColor: isSelected
                  ? "var(--color-accent-primary)"
                  : "transparent",
                transition: "all 150ms ease-out",
              }}
            >
              {isSelected && (
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
              )}
            </div>
          </label>
        </div>

        {/* ハイライトテキスト（引用ブロック風） */}
        <blockquote
          className="text-sm ml-2 mb-2"
          style={{
            paddingLeft: "8px",
            borderLeft: `2px solid ${colorConfig.borderColor}`,
            color: "var(--color-text-primary)",
            lineHeight: "1.6",
            fontStyle: "italic",
            // 最大4行で省略
            display: "-webkit-box",
            WebkitLineClamp: 4,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {highlight.text}
        </blockquote>

        {/* コメント編集エリア */}
        <div className="ml-2 relative" onClick={(e) => e.stopPropagation()}>
          <textarea
            value={localComment}
            onChange={handleCommentChange}
            placeholder={t.reader.str_cf0uz0}
            rows={2}
            className="w-full text-xs resize-none"
            style={{
              backgroundColor: "var(--color-bg-tertiary)",
              color: "var(--color-text-primary)",
              border: "1px solid var(--color-border-secondary)",
              borderRadius: "6px",
              padding: "6px 8px",
              lineHeight: "1.5",
              outline: "none",
              transition: "border-color 150ms ease-out",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor =
                "var(--color-accent-primary)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor =
                "var(--color-border-secondary)";
            }}
          />
          {/* 保存中インジケータ */}
          {isSavingComment && (
            <span
              className="absolute text-xs"
              style={{
                right: "8px",
                bottom: "8px",
                color: "var(--color-text-tertiary)",
                fontSize: "10px",
              }}
            >
              {t.qualitative.k_vts3p8}
            </span>
          )}
        </div>
      </div>

      {/* 右クリックコンテキストメニュー */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            backgroundColor: "var(--color-bg-secondary)",
            border: "1px solid var(--color-border-primary)",
            borderRadius: "10px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
            minWidth: "160px",
            padding: "4px",
          }}
        >
          {/* ノートに変換 */}
          <button
            type="button"
            className="flex items-center gap-2 w-full text-left text-xs px-3 py-2"
            style={{
              color: "var(--color-text-primary)",
              borderRadius: "6px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                "var(--color-bg-tertiary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
            onClick={() => {
              onToggleSelect(highlight.id);
              closeContextMenu();
            }}
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
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            {isSelected ? t.reader.str_in3h53 : t.reader.str_hjicln}
          </button>

          {/* 引用コピー */}
          <button
            type="button"
            className="flex items-center gap-2 w-full text-left text-xs px-3 py-2"
            style={{
              color: "var(--color-text-primary)",
              borderRadius: "6px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                "var(--color-bg-tertiary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
            onClick={() => void handleCopyQuote()}
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
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            引用テキストをコピー
          </button>

          {/* セパレータ */}
          <div
            style={{
              height: "1px",
              backgroundColor: "var(--color-border-secondary)",
              margin: "4px 8px",
            }}
          />

          {/* 削除 */}
          <button
            type="button"
            className="flex items-center gap-2 w-full text-left text-xs px-3 py-2"
            style={{
              color: "var(--color-accent-danger)",
              borderRadius: "6px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                "var(--color-bg-tertiary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
            onClick={handleDelete}
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
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            {t.common.delete}
          </button>
        </div>
      )}
    </>
  );
};
