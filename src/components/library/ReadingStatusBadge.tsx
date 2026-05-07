// src/components/library/ReadingStatusBadge.tsx
// Stellar — 読書ステータスバッジ（ドロップダウン切替付き）
// PaperCard / PaperListRow / PaperDetailPanel に埋め込んで使用

import type React from "react";
import { useState, useCallback, useRef, useEffect } from "react";
import type { ReadingStatus } from "../../types";
import { useCitationStore } from "../../stores/useCitationStore";
import { toast } from "../ui/Toast";
import { useT } from "../../stores/useI18nStore";

interface ReadingStatusBadgeProps {
  paperId: string;
  /** 現在のステータス（親から渡す or ストアから取得） */
  status?: ReadingStatus;
  /** コンパクト表示（カード内など） */
  compact?: boolean;
}

/** ステータスごとのカラートークン */
const STATUS_COLORS: Record<ReadingStatus, { bg: string; text: string; dot: string }> = {
  unread: {
    bg: "var(--color-bg-tertiary)",
    text: "var(--color-text-tertiary)",
    dot: "var(--color-text-disabled)",
  },
  reading: {
    bg: "rgba(59, 130, 246, 0.12)",
    text: "rgb(59, 130, 246)",
    dot: "rgb(59, 130, 246)",
  },
  done: {
    bg: "rgba(34, 197, 94, 0.12)",
    text: "rgb(34, 197, 94)",
    dot: "rgb(34, 197, 94)",
  },
  revisit: {
    bg: "rgba(245, 158, 11, 0.12)",
    text: "rgb(245, 158, 11)",
    dot: "rgb(245, 158, 11)",
  },
};

const ALL_STATUSES: ReadingStatus[] = ["unread", "reading", "done", "revisit"];

export const ReadingStatusBadge: React.FC<ReadingStatusBadgeProps> = ({
  paperId,
  status: externalStatus,
  compact = false,
}) => {
  const t = useT();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const storeStatus = useCitationStore((s) => s.readingStatuses[paperId]);
  const updating = useCitationStore((s) => s.updatingStatusIds.has(paperId));
  const updateReadingStatus = useCitationStore((s) => s.updateReadingStatus);

  const currentStatus: ReadingStatus = externalStatus ?? storeStatus ?? "unread";

  /** ステータスラベルマッピング */
  const statusLabel: Record<ReadingStatus, string> = {
    unread: t.citationNetwork.unread,
    reading: t.citationNetwork.reading,
    done: t.citationNetwork.done,
    revisit: t.citationNetwork.revisit,
  };

  // 外クリックで閉じる
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleSelect = useCallback(
    async (newStatus: ReadingStatus) => {
      setOpen(false);
      if (newStatus === currentStatus) return;
      try {
        await updateReadingStatus(paperId, newStatus);
        toast.success(t.citationNetwork.statusUpdated);
      } catch {
        toast.error(t.citationNetwork.statusUpdateFailed);
      }
    },
    [paperId, currentStatus, updateReadingStatus, t]
  );

  const colors = STATUS_COLORS[currentStatus];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* トリガーバッジ */}
      <button
        className="inline-flex items-center gap-1.5 select-none"
        style={{
          padding: compact ? "2px 6px" : "3px 8px",
          borderRadius: "var(--radius-tag)",
          backgroundColor: colors.bg,
          color: colors.text,
          fontSize: compact ? "10px" : "11px",
          fontWeight: 500,
          lineHeight: "1.4",
          transition: "all var(--transition-fast)",
          cursor: updating ? "wait" : "pointer",
          opacity: updating ? 0.6 : 1,
          border: "none",
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (!updating) setOpen((v) => !v);
        }}
        title={t.citationNetwork.readingStatus}
      >
        {/* ステータスドット */}
        <span
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: colors.dot,
            flexShrink: 0,
          }}
        />
        <span>{statusLabel[currentStatus]}</span>
        {/* ドロップダウン矢印 */}
        <svg
          width="8"
          height="8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform var(--transition-fast)",
            opacity: 0.6,
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* ドロップダウン */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: "4px",
            minWidth: "120px",
            backgroundColor: "var(--color-bg-card)",
            borderRadius: "var(--radius-input)",
            boxShadow: "var(--shadow-dropdown)",
            border: "1px solid var(--color-border-secondary)",
            padding: "var(--space-1) 0",
            zIndex: "var(--z-dropdown)",
            animation: "scale-in 150ms ease-out both",
          }}
        >
          {ALL_STATUSES.map((s) => {
            const sc = STATUS_COLORS[s];
            const isActive = s === currentStatus;
            return (
              <button
                key={s}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left"
                style={{
                  color: isActive ? sc.text : "var(--color-text-primary)",
                  fontWeight: isActive ? 600 : 400,
                  backgroundColor: isActive ? sc.bg : "transparent",
                  transition: "background-color var(--transition-fast)",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleSelect(s);
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
              >
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    backgroundColor: sc.dot,
                    flexShrink: 0,
                  }}
                />
                <span>{statusLabel[s]}</span>
                {isActive && (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="ml-auto"
                    style={{ opacity: 0.7 }}
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
