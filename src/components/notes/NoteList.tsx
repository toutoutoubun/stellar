// src/components/notes/NoteList.tsx
// Stellar — ノート一覧サイドパネル
// 検索バー、ノートリスト（タイトル・更新日・タグ・プレビュー）、新規作成ボタン

import type React from "react";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useNoteStore } from "../../stores/useNoteStore";
import { useUIStore } from "../../stores/useUIStore";
import { useT } from "../../stores/useI18nStore";
import type { Note, NoteSortKey } from "../../types";
import { Badge } from "../ui/Badge";
import { toast } from "../ui/Toast";

/** 日付フォーマット（相対表示・i18n対応） */
function formatRelativeDate(
  isoStr: string,
  labels: { justNow: string; minutesAgo: string; hoursAgo: string; daysAgo: string },
): string {
  const date = new Date(isoStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return labels.justNow;
  if (diffMin < 60) return labels.minutesAgo.replace("{n}", String(diffMin));
  if (diffHour < 24) return labels.hoursAgo.replace("{n}", String(diffHour));
  if (diffDay < 30) return labels.daysAgo.replace("{n}", String(diffDay));

  // 30日以上前は年月日表示
  const y = date.getFullYear();
  const currentYear = now.getFullYear();
  if (y === currentYear) {
    return `${String(date.getMonth() + 1)}/${String(date.getDate())}`;
  }
  return `${String(y)}/${String(date.getMonth() + 1)}/${String(date.getDate())}`;
}

export const NoteList: React.FC = () => {
  const t = useT();

  /** ソートキーラベル（i18n） */
  const SORT_KEY_LABELS: Record<NoteSortKey, string> = {
    updatedAt: t.notes.sortUpdated,
    createdAt: t.notes.sortCreated,
    title: t.notes.sortTitle,
  };

  // ストア
  const notes = useNoteStore((s) => s.notes);
  const loading = useNoteStore((s) => s.loading);
  const sortKey = useNoteStore((s) => s.sortKey);
  const sortDirection = useNoteStore((s) => s.sortDirection);
  const filterQuery = useNoteStore((s) => s.filterQuery);
  const fetchNotes = useNoteStore((s) => s.fetchNotes);
  const createNote = useNoteStore((s) => s.createNote);
  const setSortKey = useNoteStore((s) => s.setSortKey);
  const setFilterQuery = useNoteStore((s) => s.setFilterQuery);

  const openNote = useUIStore((s) => s.openNote);
  const mainPaneContent = useUIStore((s) => s.mainPaneContent);

  const [searchFocused, setSearchFocused] = useState(false);

  /** 初回読み込み */
  useEffect(() => {
    void fetchNotes();
  }, [fetchNotes]);

  /** フィルタ + ソート済みノート */
  const filteredNotes = useMemo(() => {
    let result = [...notes];

    // テキストフィルタ
    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    // ソート
    result.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "title") {
        cmp = a.title.localeCompare(b.title, "ja");
      } else {
        const aVal = new Date(a[sortKey]).getTime();
        const bVal = new Date(b[sortKey]).getTime();
        cmp = aVal - bVal;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });

    return result;
  }, [notes, filterQuery, sortKey, sortDirection]);

  /** 新規ノート作成 */
  const handleCreateNote = useCallback(async () => {
    try {
      const note = await createNote({
        title: t.notes.untitled,
        content: "",
        tags: [],
      });
      openNote(note.id);
    } catch {
      toast.error(t.notes.createFailed);
    }
  }, [createNote, openNote]);

  /** 現在選択中のノートID */
  const selectedNoteId =
    mainPaneContent.type === "note" ? mainPaneContent.noteId : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ヘッダー: タイトル + 新規作成ボタン */}
      <header
        className="flex items-center justify-between px-4 shrink-0"
        style={{
          height: "48px",
          borderBottom: "1px solid var(--color-border-primary)",
        }}
      >
        <div className="flex items-center gap-2">
          <h2
            className="text-sm font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            {t.notes.title}
          </h2>
          <span
            className="text-xs"
            style={{
              color: "var(--color-text-tertiary)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {notes.length > 0 ? `${notes.length}` : ""}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void handleCreateNote()}
          className="flex items-center justify-center"
          style={{
            color: "var(--color-accent-primary)",
            width: "28px",
            height: "28px",
            borderRadius: "8px",
            backgroundColor: "transparent",
            transition: "background-color 150ms ease-out",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
          title={t.notes.createNote}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </header>

      {/* 検索バー */}
      <div
        className="px-3 py-2 shrink-0"
        style={{
          borderBottom: "1px solid var(--color-border-secondary)",
        }}
      >
        <div
          className="flex items-center gap-2"
          style={{
            backgroundColor: "var(--color-bg-tertiary)",
            borderRadius: "8px",
            padding: "6px 10px",
            border: searchFocused
              ? "1px solid var(--color-accent-primary)"
              : "1px solid transparent",
            transition: "border-color 150ms ease-out",
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
            style={{ color: "var(--color-text-tertiary)", flexShrink: 0 }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder={t.notes.searchPlaceholder}
            className="flex-1 text-xs"
            style={{
              backgroundColor: "transparent",
              color: "var(--color-text-primary)",
              border: "none",
              outline: "none",
            }}
          />
          {filterQuery && (
            <button
              type="button"
              onClick={() => setFilterQuery("")}
              style={{ color: "var(--color-text-tertiary)" }}
              aria-label={t.notes.clearSearch}
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
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ソートコントロール */}
      <div
        className="flex items-center gap-1 px-3 py-1.5 shrink-0"
        style={{ borderBottom: "1px solid var(--color-border-secondary)" }}
      >
        {(Object.keys(SORT_KEY_LABELS) as NoteSortKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSortKey(key)}
            className="text-xs"
            style={{
              color:
                sortKey === key
                  ? "var(--color-accent-primary)"
                  : "var(--color-text-tertiary)",
              fontWeight: sortKey === key ? 600 : 400,
              padding: "3px 8px",
              borderRadius: "6px",
              backgroundColor:
                sortKey === key
                  ? "var(--color-bg-hover)"
                  : "transparent",
              transition: "all 150ms ease-out",
            }}
          >
            {SORT_KEY_LABELS[key]}
            {sortKey === key && (
              <span className="ml-0.5" style={{ fontSize: "10px" }}>
                {sortDirection === "asc" ? "↑" : "↓"}
              </span>
            )}
          </button>
        ))}
        {filterQuery.trim() && (
          <span
            className="text-xs ml-auto"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {filteredNotes.length} {t.common.items}
          </span>
        )}
      </div>

      {/* ノートリスト */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          // スケルトンローディング
          <div className="flex flex-col gap-1 p-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={`skeleton-${String(i)}`}
                style={{
                  height: "64px",
                  borderRadius: "8px",
                  backgroundColor: "var(--color-bg-tertiary)",
                  animation: "pulse 1.5s ease-in-out infinite",
                }}
              />
            ))}
          </div>
        ) : filteredNotes.length === 0 ? (
          // 空状態
          <div
            className="flex flex-col items-center justify-center h-full gap-3 px-4"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ opacity: 0.4 }}
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <p className="text-sm text-center">
              {filterQuery
                ? t.notes.noResults
                : t.notes.empty}
            </p>
            {!filterQuery && (
              <button
                type="button"
                onClick={() => void handleCreateNote()}
                className="text-xs"
                style={{
                  color: "var(--color-accent-primary)",
                  padding: "6px 16px",
                  borderRadius: "8px",
                  border: "1px solid var(--color-accent-primary)",
                }}
              >
                {t.notes.createFirst}
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 p-1">
            {filteredNotes.map((note) => (
              <NoteListItem
                key={note.id}
                note={note}
                isSelected={selectedNoteId === note.id}
                onClick={() => openNote(note.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// ノートリストアイテム
// ============================================================

const NoteListItem: React.FC<{
  note: Note;
  isSelected: boolean;
  onClick: () => void;
}> = ({ note, isSelected, onClick }) => {
  const t = useT();
  /** コンテンツプレビュー（最初の60文字、Markdown記法を除去） */
  const preview = useMemo(() => {
    const text = note.content
      .replace(/^#{1,6}\s+/gm, "") // 見出し
      .replace(/[\*_~`>\-\[\]]/g, "") // 装飾
      .replace(/\n+/g, " ")          // 改行をスペースに
      .trim();
    return text.slice(0, 60) || "";
  }, [note.content]);

  const charCount = note.content.length;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col w-full text-left"
      style={{
        padding: "10px 12px",
        borderRadius: "10px",
        backgroundColor: isSelected
          ? "var(--color-bg-hover)"
          : "transparent",
        borderLeft: isSelected
          ? "3px solid var(--color-accent-primary)"
          : "3px solid transparent",
        transition: "all 150ms ease-out",
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.backgroundColor = "transparent";
        }
      }}
    >
      {/* タイトル行 */}
      <div className="flex items-center gap-2 mb-1" style={{ minWidth: 0 }}>
        <span
          className="text-sm font-medium truncate"
          style={{ color: "var(--color-text-primary)", minWidth: 0, display: "block" }}
        >
          {note.title || t.notes.untitled}
        </span>
      </div>

      {/* プレビューテキスト（空ノートでは非表示） */}
      {preview && (
        <span
          className="text-xs block mb-1.5"
          style={{
            color: "var(--color-text-tertiary)",
            lineHeight: "1.5",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
          }}
        >
          {preview}
        </span>
      )}

      {/* メタ情報行: 更新日 · 文字数 + タグ */}
      <div className="flex items-center gap-1.5" style={{ minWidth: 0 }}>
        <span
          className="text-xs shrink-0"
          style={{ color: "var(--color-text-disabled)", fontSize: "10px" }}
        >
          {formatRelativeDate(note.updatedAt, {
            justNow: t.notes.justNow,
            minutesAgo: t.notes.minutesAgo,
            hoursAgo: t.notes.hoursAgo,
            daysAgo: t.notes.daysAgo,
          })}
        </span>
        {charCount > 0 && (
          <>
            <span
              style={{ color: "var(--color-text-disabled)", fontSize: "10px" }}
            >
              ·
            </span>
            <span
              className="text-xs shrink-0"
              style={{ color: "var(--color-text-disabled)", fontSize: "10px" }}
            >
              {charCount.toLocaleString()}{t.common.chars}
            </span>
          </>
        )}
        {note.tags.length > 0 && (
          <div className="flex items-center gap-1 ml-auto overflow-hidden">
            {note.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} style={{ fontSize: "9px", padding: "1px 5px" }}>
                {tag}
              </Badge>
            ))}
            {note.tags.length > 2 && (
              <span
                className="text-xs"
                style={{ color: "var(--color-text-disabled)", fontSize: "9px" }}
              >
                +{note.tags.length - 2}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
};
