// src/components/library/PaperCard.tsx
// Stellar — 論文カード（グリッド表示用）
// React.memo + カスタム props 比較でメモ化
// IntersectionObserver による PDF サムネイルの遅延読み込み（rootMargin "100px"）

import type React from "react";
import { useState, useCallback, useRef, useEffect, memo } from "react";
import type { Paper, CitationStyle } from "../../types";
import { CITATION_STYLE_LABELS } from "../../types";
import { Badge } from "../ui/Badge";
import { copyCitationToClipboard } from "../../utils/citation";
import { toast } from "../ui/Toast";
import { useI18nStore } from "../../stores/useI18nStore";

interface PaperCardProps {
  paper: Paper;
  selected: boolean;
  /** カード出現のスタガー遅延（ms） */
  animationDelay: number;
  onSelect: (id: string) => void;
  onDoubleClick: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onAttachPdf?: (id: string) => void;
}

/** カスタム props 比較: paper.id, selected, animationDelay のみ比較 */
function arePropsEqual(prev: PaperCardProps, next: PaperCardProps): boolean {

  return (
    prev.paper.id === next.paper.id &&
    prev.paper.updatedAt === next.paper.updatedAt &&
    prev.paper.pdfPath === next.paper.pdfPath &&
    prev.selected === next.selected &&
    prev.animationDelay === next.animationDelay &&
    prev.onSelect === next.onSelect &&
    prev.onDoubleClick === next.onDoubleClick &&
    prev.onDelete === next.onDelete &&
    prev.onEdit === next.onEdit &&
    prev.onAttachPdf === next.onAttachPdf
  );
}

/** 著者表示のフォーマット（1行、複数著者は et al.） */
const formatAuthorsShort = (authors: string[]): string => {
  if (authors.length === 0) return useI18nStore.getState().t.library.k_h81ga7;
  if (authors.length === 1) return authors[0] ?? useI18nStore.getState().t.library.k_h81ga7;
  if (authors.length === 2) return `${authors[0]}, ${authors[1]}`;
  return `${authors[0]} et al.`;
};

/** コンテキストメニューのアイテム定義 */
interface ContextMenuItem {
  label: string;
  icon: React.ReactNode;
  action: () => void;
  danger?: boolean;
  submenu?: { label: string; action: () => void }[];
}

/** PDF サムネイル遅延読み込みコンポーネント */
const LazyPdfThumbnail: React.FC<{ pdfPath: string | null }> = ({
  pdfPath,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="w-full flex items-center justify-center shrink-0"
      style={{
        height: "140px",
        backgroundColor: "var(--color-bg-tertiary)",
        borderBottom: "1px solid var(--color-border-secondary)",
      }}
    >
      {isVisible ? (
        pdfPath ? (
          /* PDF がありビューポートに入ったらアイコンを表示 */
          <div className="flex flex-col items-center gap-2">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: "var(--color-accent-primary)" }}
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <span
              className="text-xs"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              PDF
            </span>
          </div>
        ) : (
          /* PDF なしのプレースホルダー */
          <div className="flex flex-col items-center gap-2">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: "var(--color-text-disabled)" }}
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span
              className="text-xs"
              style={{ color: "var(--color-text-disabled)" }}
            >
              {t.library.k_vn8gmj}
            </span>
          </div>
        )
      ) : (
        /* ビューポート外: 空プレースホルダー */
        null
      )}
    </div>
  );
};

const PaperCardInner: React.FC<PaperCardProps> = ({
  paper,
  selected,
  animationDelay,
  onSelect,
  onDoubleClick,
  onDelete,
  onEdit,
  onAttachPdf,
}) => {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [showCitationSub, setShowCitationSub] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // 最大表示タグ数
  const MAX_VISIBLE_TAGS = 3;
  const visibleTags = paper.tags.slice(0, MAX_VISIBLE_TAGS);
  const remainingTagCount = paper.tags.length - MAX_VISIBLE_TAGS;

  // ── コンテキストメニュー外クリックで閉じる ──
  useEffect(() => {
    if (!contextMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setContextMenu(null);
        setShowCitationSub(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [contextMenu]);

  // ── 右クリック ──
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onSelect(paper.id);
      setContextMenu({ x: e.clientX, y: e.clientY });
      setShowCitationSub(false);
    },
    [paper.id, onSelect],
  );

  // ── 引用コピー ──
  const handleCopyCitation = useCallback(
    async (style: CitationStyle) => {
      const success = await copyCitationToClipboard(paper, style);
      if (success) {
        toast.success(
          t.library.k_nd5w89,
        );
      } else {
        toast.error(useI18nStore.getState().t.library.k_pytgr9);
      }
      setContextMenu(null);
      setShowCitationSub(false);
    },
    [paper],
  );

  // ── コンテキストメニュー定義 ──
  const menuItems: ContextMenuItem[] = [
    {
      label: useI18nStore.getState().t.common.edit,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      ),
      action: () => {
        onEdit(paper.id);
        setContextMenu(null);
      },
    },
    {
      label: useI18nStore.getState().t.library.k_ezke84,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      ),
      action: () => {
        setShowCitationSub(true);
      },
      submenu: (
        Object.entries(CITATION_STYLE_LABELS) as [CitationStyle, string][]
      ).map(([style, label]) => ({
        label,
        action: () => {
          void handleCopyCitation(style);
        },
      })),
    },
    {
      label: useI18nStore.getState().t.common.delete,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      ),
      action: () => {
        onDelete(paper.id);
        setContextMenu(null);
      },
      danger: true,
    },
  ];

  return (
    <>
      <div
        ref={cardRef}
        className="relative flex flex-col overflow-hidden cursor-pointer select-none"
        style={{
          backgroundColor: "var(--color-bg-card)",
          borderRadius: "var(--radius-card)",
          boxShadow: "var(--shadow-card)",
          border: "1px solid",
          borderColor: selected
            ? "var(--color-accent-primary)"
            : "var(--color-border-secondary)",
          outline: selected
            ? "1px solid var(--color-accent-primary)"
            : "none",
          outlineOffset: "-1px",
          transition: "all var(--transition-fast)",
          animation: `card-stagger-in 200ms ease-out ${animationDelay}ms both`,
        }}
        onClick={() => onSelect(paper.id)}
        onDoubleClick={() => onDoubleClick(paper.id)}
        onContextMenu={handleContextMenu}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = "var(--shadow-card-hover)";
          e.currentTarget.style.transform = "translateY(-2px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = "var(--shadow-card)";
          e.currentTarget.style.transform = "translateY(0)";
        }}
        role="button"
        tabIndex={0}
        aria-label={t.library.k_52o3ij}
      >
        {/* ── PDF サムネイル (IntersectionObserver 遅延読み込み) ── */}
        <LazyPdfThumbnail pdfPath={paper.pdfPath} />

        {/* ── カード本体情報 ── */}
        <div
          className="flex flex-col gap-1.5 flex-1"
          style={{ padding: "var(--space-3) var(--space-4) var(--space-4)" }}
        >
          {/* タイトル（2行で truncate） */}
          <h3
            className="font-semibold text-sm leading-snug"
            style={{
              color: "var(--color-text-primary)",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              minHeight: "2.6em",
            }}
            title={paper.title}
          >
            {paper.title}
          </h3>

          {/* 著者（1行） */}
          <p
            className="text-xs truncate"
            style={{ color: "var(--color-text-secondary)", lineHeight: "1.4" }}
            title={paper.authors.join(", ")}
          >
            {formatAuthorsShort(paper.authors)}
          </p>

          {/* 年 + ジャーナル名（ドット区切り） */}
          <p
            className="text-xs truncate"
            style={{ color: "var(--color-text-tertiary)", lineHeight: "1.4" }}
          >
            {paper.year !== null ? `${paper.year}` : ""}
            {paper.year !== null && paper.journal ? " \u00B7 " : ""}
            {paper.journal ?? ""}
            {!paper.year && !paper.journal && "\u2014"}
          </p>

          {/* タグバッジ */}
          {paper.tags.length > 0 && (
            <div
              className="flex flex-wrap items-center gap-1"
              style={{ marginTop: "2px" }}
            >
              {visibleTags.map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
              {remainingTagCount > 0 && (
                <span
                  className="text-xs"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  +{remainingTagCount}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── PDF未添付時の「PDFを追加」ボタン ── */}
        {!paper.pdfPath && (
          <button
            className="absolute bottom-3 right-3 flex items-center gap-1 text-xs"
            style={{
              color: "var(--color-accent-primary)",
              opacity: 0.8,
              transition: "opacity var(--transition-fast)",
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (onAttachPdf) {
                onAttachPdf(paper.id);
              }
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "0.8";
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
            <span>PDFを追加</span>
          </button>
        )}
      </div>

      {/* ── コンテキストメニュー ── */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            zIndex: "var(--z-dropdown)",
            minWidth: "180px",
            backgroundColor: "var(--color-bg-card)",
            borderRadius: "var(--radius-input)",
            boxShadow: "var(--shadow-dropdown)",
            border: "1px solid var(--color-border-secondary)",
            padding: "var(--space-1) 0",
            animation: "scale-in 150ms ease-out both",
          }}
        >
          {menuItems.map((item) => (
            <div key={item.label} className="relative">
              <button
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left"
                style={{
                  color: item.danger
                    ? "var(--color-accent-danger)"
                    : "var(--color-text-primary)",
                  transition: "background-color var(--transition-fast)",
                }}
                onClick={item.action}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    "var(--color-bg-hover)";
                  if (item.label !== useI18nStore.getState().t.library.k_ezke84) {
                    setShowCitationSub(false);
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <span className="shrink-0" style={{ opacity: 0.7 }}>
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
                {item.submenu && (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ opacity: 0.5 }}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                )}
              </button>

              {/* 引用スタイルサブメニュー */}
              {item.submenu && showCitationSub && (
                <div
                  className="absolute left-full top-0 ml-1"
                  style={{
                    minWidth: "160px",
                    backgroundColor: "var(--color-bg-card)",
                    borderRadius: "var(--radius-input)",
                    boxShadow: "var(--shadow-dropdown)",
                    border: "1px solid var(--color-border-secondary)",
                    padding: "var(--space-1) 0",
                    animation: "scale-in 100ms ease-out both",
                  }}
                >
                  {item.submenu.map((sub) => (
                    <button
                      key={sub.label}
                      className="flex items-center w-full px-3 py-2 text-xs text-left"
                      style={{
                        color: "var(--color-text-primary)",
                        transition: "background-color var(--transition-fast)",
                      }}
                      onClick={sub.action}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                          "var(--color-bg-hover)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
};

/** メモ化された PaperCard — カスタム比較でリレンダリングを最小化 */
export const PaperCard = memo(PaperCardInner, arePropsEqual);
