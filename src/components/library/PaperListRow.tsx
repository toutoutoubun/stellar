// src/components/library/PaperListRow.tsx
// Stellar — 論文リスト行（リスト表示用）
// 1行に: チェックボックス / タイトル / 著者 / 年 / ジャーナル / タグ / PDF有無アイコン
// クリックで選択、ダブルクリックでPDFリーダーへ遷移

import type React from "react";
import { useCallback } from "react";
import type { Paper } from "../../types";
import { Badge } from "../ui/Badge";
import { useT } from "../../stores/useI18nStore";

interface PaperListRowProps {
  paper: Paper;
  selected: boolean;
  checked: boolean;
  /** 行出現のスタガー遅延（ms） */
  animationDelay: number;
  onSelect: (id: string) => void;
  onDoubleClick: (id: string) => void;
  onToggleCheck: (id: string) => void;
}

/** 著者を短縮表示する（2名以上は et al.） */
const formatAuthorsCompact = (authors: string[]): string => {

  if (authors.length === 0) return "—";
  if (authors.length === 1) return authors[0] ?? "—";
  return `${authors[0]} et al.`;
};

export const PaperListRow: React.FC<PaperListRowProps> = ({
  paper,
  selected,
  checked,
  animationDelay,
  onSelect,
  onDoubleClick,
  onToggleCheck,
}) => {
  const t = useT();
  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleCheck(paper.id);
    },
    [paper.id, onToggleCheck]
  );

  // 最大表示タグ数
  const MAX_TAGS = 2;
  const visibleTags = paper.tags.slice(0, MAX_TAGS);
  const remainingCount = paper.tags.length - MAX_TAGS;

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 cursor-pointer select-none"
      style={{
        backgroundColor: selected
          ? "var(--color-bg-hover)"
          : "transparent",
        borderBottom: "1px solid var(--color-border-secondary)",
        transition: "background-color var(--transition-fast)",
        animation: `fade-in 200ms ease-out ${animationDelay}ms both`,
      }}
      onClick={() => onSelect(paper.id)}
      onDoubleClick={() => onDoubleClick(paper.id)}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.backgroundColor = "var(--color-bg-secondary)";
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.backgroundColor = "transparent";
        }
      }}
      role="row"
      aria-selected={selected}
      tabIndex={0}
    >
      {/* ── チェックボックス ── */}
      <div
        className="shrink-0 flex items-center justify-center"
        onClick={handleCheckboxClick}
        role="checkbox"
        aria-checked={checked}
        tabIndex={-1}
      >
        <div
          className="flex items-center justify-center"
          style={{
            width: "16px",
            height: "16px",
            borderRadius: "4px",
            border: checked
              ? "none"
              : "1.5px solid var(--color-border-primary)",
            backgroundColor: checked
              ? "var(--color-accent-primary)"
              : "transparent",
            transition: "all var(--transition-fast)",
            cursor: "pointer",
          }}
        >
          {checked && (
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
      </div>

      {/* ── タイトル（最大幅付き） ── */}
      <div className="flex-1 min-w-0">
        <span
          className="text-sm font-medium truncate block"
          style={{ color: "var(--color-text-primary)" }}
          title={paper.title}
        >
          {paper.title}
        </span>
      </div>

      {/* ── 著者 ── */}
      <div
        className="shrink-0 text-xs truncate"
        style={{
          color: "var(--color-text-secondary)",
          width: "160px",
          textAlign: "left",
        }}
        title={paper.authors.join(", ")}
      >
        {formatAuthorsCompact(paper.authors)}
      </div>

      {/* ── 年 ── */}
      <div
        className="shrink-0 text-xs"
        style={{
          color: "var(--color-text-tertiary)",
          width: "48px",
          textAlign: "center",
        }}
      >
        {paper.year ?? "—"}
      </div>

      {/* ── ジャーナル ── */}
      <div
        className="shrink-0 text-xs truncate"
        style={{
          color: "var(--color-text-tertiary)",
          width: "140px",
          textAlign: "left",
        }}
        title={paper.journal ?? undefined}
      >
        {paper.journal ?? "—"}
      </div>

      {/* ── タグ ── */}
      <div
        className="shrink-0 flex items-center gap-1"
        style={{ width: "140px" }}
      >
        {visibleTags.map((tag) => (
          <Badge key={tag}>{tag}</Badge>
        ))}
        {remainingCount > 0 && (
          <span
            className="text-xs"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            +{remainingCount}
          </span>
        )}
        {paper.tags.length === 0 && (
          <span
            className="text-xs"
            style={{ color: "var(--color-text-disabled)" }}
          >
            —
          </span>
        )}
      </div>

      {/* ── PDF有無アイコン ── */}
      <div
        className="shrink-0 flex items-center justify-center"
        style={{ width: "28px" }}
        title={paper.pdfPath ? t.library.k_e5u2bq : t.library.k_vn8gmj}
      >
        {paper.pdfPath ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "var(--color-accent-primary)" }}
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        ) : (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "var(--color-text-disabled)" }}
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        )}
      </div>
    </div>
  );
};
