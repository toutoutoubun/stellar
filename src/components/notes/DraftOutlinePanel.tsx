// src/components/notes/DraftOutlinePanel.tsx
// Stellar — 草稿アウトラインパネル（左サイド 220px）
// ドラッグ可能な章カード、章追加ボタン、並び替え

import type React from "react";
import { useState, useCallback, useRef } from "react";
import { invoke } from "../../lib/tauriShim";
import type { DraftChapter } from "../../types";
import { toast } from "../ui/Toast";
import { useT } from "../../stores/useI18nStore";

interface DraftOutlinePanelProps {
  noteId: string;
  chapters: DraftChapter[];
  onChapterClick: (chapterId: string) => void;
  onReorder: () => void;
}

export const DraftOutlinePanel: React.FC<DraftOutlinePanelProps> = ({
  noteId,
  chapters,
  onChapterClick,
  onReorder,
}) => {
  const t = useT();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  /** 章を追加 */
  const handleAddChapter = useCallback(async () => {
    const title = newTitle.trim() || t.draftMode.chapterTitle;
    try {
      await invoke("create_draft_chapter", {
        noteId,
        title,
        orderIndex: chapters.length,
      });
      toast.success(t.draftMode.chapterCreated);
      setNewTitle("");
      setAdding(false);
      onReorder();
    } catch {
      toast.error(t.draftMode.chapterCreateFailed);
    }
  }, [noteId, newTitle, chapters.length, onReorder, t]);

  /** 章タイトル更新 */
  const handleUpdateTitle = useCallback(
    async (chapterId: string) => {
      const trimmed = editTitle.trim();
      if (!trimmed) {
        setEditingId(null);
        return;
      }
      try {
        await invoke("update_draft_chapter", {
          id: chapterId,
          title: trimmed,
        });
        toast.success(t.draftMode.chapterUpdated);
        onReorder();
      } catch {
        toast.error(t.draftMode.chapterUpdateFailed);
      }
      setEditingId(null);
    },
    [editTitle, onReorder, t],
  );

  /** 章を削除 */
  const handleDeleteChapter = useCallback(
    async (chapterId: string) => {
      try {
        await invoke("delete_draft_chapter", { id: chapterId });
        toast.success(t.draftMode.chapterDeleted);
        onReorder();
      } catch {
        toast.error(t.draftMode.chapterDeleteFailed);
      }
    },
    [onReorder, t],
  );

  /** ドラッグ開始 */
  const handleDragStart = useCallback((index: number) => {
    dragItem.current = index;
  }, []);

  /** ドラッグオーバー */
  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragOverItem.current = index;
  }, []);

  /** ドロップ — 並び替えを実行 */
  const handleDrop = useCallback(async () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) return;

    const reordered = [...chapters];
    const removed = reordered.splice(dragItem.current, 1)[0];
    if (!removed) return;
    reordered.splice(dragOverItem.current, 0, removed);

    const orderedIds = reordered.map((c) => c.id);
    try {
      await invoke("reorder_draft_chapters", { noteId, orderedIds });
      toast.success(t.draftMode.chaptersReordered);
      onReorder();
    } catch {
      toast.error(t.draftMode.reorderFailed);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  }, [chapters, noteId, onReorder, t]);

  return (
    <aside
      className="flex flex-col h-full overflow-hidden"
      style={{
        width: "220px",
        minWidth: "220px",
        maxWidth: "220px",
        borderRight: "1px solid var(--color-border-primary)",
        backgroundColor: "var(--color-bg-secondary)",
      }}
    >
      {/* ヘッダー */}
      <header
        className="flex items-center justify-between px-3 shrink-0"
        style={{
          height: "36px",
          borderBottom: "1px solid var(--color-border-secondary)",
        }}
      >
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {t.draftMode.outlinePanel}
        </span>
        <span
          className="text-xs"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          {chapters.length}
        </span>
      </header>

      {/* 章リスト */}
      <div className="flex-1 overflow-y-auto p-2">
        {chapters.length === 0 && !adding ? (
          <div
            className="flex items-center justify-center h-full"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            <p className="text-xs text-center">{t.draftMode.noChapters}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {chapters.map((chapter, index) => (
              <div
                key={chapter.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={() => void handleDrop()}
                onDragEnd={() => {
                  dragItem.current = null;
                  dragOverItem.current = null;
                }}
                className="flex items-center gap-1.5 group"
                style={{
                  padding: "6px 8px",
                  borderRadius: "8px",
                  border: "1px solid var(--color-border-secondary)",
                  backgroundColor: "var(--color-bg-primary)",
                  cursor: "grab",
                  transition: "background-color 150ms ease-out",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--color-bg-primary)";
                }}
              >
                {/* ドラッグハンドル */}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    color: "var(--color-text-disabled)",
                    flexShrink: 0,
                    cursor: "grab",
                  }}
                >
                  <circle cx="9" cy="6" r="1" fill="currentColor" />
                  <circle cx="15" cy="6" r="1" fill="currentColor" />
                  <circle cx="9" cy="12" r="1" fill="currentColor" />
                  <circle cx="15" cy="12" r="1" fill="currentColor" />
                  <circle cx="9" cy="18" r="1" fill="currentColor" />
                  <circle cx="15" cy="18" r="1" fill="currentColor" />
                </svg>

                {/* 章番号 */}
                <span
                  className="text-xs shrink-0"
                  style={{
                    color: "var(--color-accent-primary)",
                    fontWeight: 600,
                    fontSize: "10px",
                    minWidth: "18px",
                  }}
                >
                  {index + 1}
                </span>

                {/* タイトル（編集可能） */}
                {editingId === chapter.id ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => void handleUpdateTitle(chapter.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleUpdateTitle(chapter.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    autoFocus
                    className="text-xs flex-1"
                    style={{
                      minWidth: 0,
                      backgroundColor: "var(--color-bg-primary)",
                      color: "var(--color-text-primary)",
                      border: "1px solid var(--color-accent-primary)",
                      borderRadius: "4px",
                      padding: "1px 4px",
                      outline: "none",
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="text-xs flex-1 text-left truncate"
                    style={{
                      color: "var(--color-text-primary)",
                      minWidth: 0,
                    }}
                    onClick={() => onChapterClick(chapter.id)}
                    onDoubleClick={() => {
                      setEditingId(chapter.id);
                      setEditTitle(chapter.title);
                    }}
                    title={chapter.title}
                  >
                    {chapter.title}
                  </button>
                )}

                {/* 文字数バッジ */}
                {chapter.wordCount > 0 && (
                  <span
                    className="text-xs shrink-0"
                    style={{
                      color: "var(--color-text-disabled)",
                      fontSize: "9px",
                    }}
                  >
                    {chapter.wordCount}
                  </span>
                )}

                {/* 削除ボタン */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDeleteChapter(chapter.id);
                  }}
                  className="opacity-0 group-hover:opacity-100"
                  style={{
                    color: "var(--color-text-disabled)",
                    flexShrink: 0,
                    transition: "opacity 150ms, color 150ms",
                    padding: "2px",
                    borderRadius: "4px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--color-accent-danger)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--color-text-disabled)";
                  }}
                  title={t.draftMode.deleteChapter}
                >
                  <svg
                    width="10"
                    height="10"
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
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 章追加ボタン / 入力フォーム */}
      <div
        className="shrink-0 p-2"
        style={{
          borderTop: "1px solid var(--color-border-secondary)",
        }}
      >
        {adding ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleAddChapter();
                if (e.key === "Escape") {
                  setAdding(false);
                  setNewTitle("");
                }
              }}
              autoFocus
              placeholder={t.draftMode.chapterTitle}
              className="text-xs flex-1"
              style={{
                minWidth: 0,
                padding: "4px 8px",
                borderRadius: "6px",
                border: "1px solid var(--color-border-secondary)",
                backgroundColor: "var(--color-bg-primary)",
                color: "var(--color-text-primary)",
                outline: "none",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--color-accent-primary)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--color-border-secondary)";
              }}
            />
            <button
              type="button"
              onClick={() => void handleAddChapter()}
              className="text-xs shrink-0"
              style={{
                color: "var(--color-accent-primary)",
                padding: "4px 8px",
                borderRadius: "6px",
              }}
            >
              OK
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 w-full text-xs"
            style={{
              color: "var(--color-text-tertiary)",
              padding: "6px 8px",
              borderRadius: "8px",
              transition: "all 150ms ease-out",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--color-accent-primary)";
              e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--color-text-tertiary)";
              e.currentTarget.style.backgroundColor = "transparent";
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
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {t.draftMode.addChapter}
          </button>
        )}
      </div>
    </aside>
  );
};
