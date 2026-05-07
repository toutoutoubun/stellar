// src/components/notes/NoteContextPanel.tsx
// Stellar — ノートコンテキストパネル（右側）
// バックリンク・アウトライン（見出し一覧）・タグ管理を表示する

import type React from "react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { invoke } from "../../lib/tauriShim";
import type { Note, BacklinkItem, OutlineHeading, NodeType } from "../../types";
import { useNoteStore } from "../../stores/useNoteStore";
import { Badge } from "../ui/Badge";
import { toast } from "../ui/Toast";
import { IconItemType } from "../ui/Icons";
import { useI18nStore } from "../../stores/useI18nStore";

interface NoteContextPanelProps {
  /** 現在のノート */
  note: Note;
  /** エディタの現在のコンテンツ（リアルタイム同期用） */
  editorContent: string;
  /** アウトライン見出しクリック → エディタの該当行にスクロール */
  onHeadingClick: (line: number) => void;
  /** リンク先に遷移 */
  onNavigate: (targetId: string, targetType: NodeType) => void;
}

// ============================================================
// バックリンクセクション
// ============================================================

const BacklinksSection: React.FC<{
  noteId: string;
  onNavigate: (targetId: string, targetType: NodeType) => void;
}> = ({ noteId, onNavigate }) => {
  const [backlinks, setBacklinks] = useState<BacklinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      setLoading(true);
      try {
        const items = await invoke<BacklinkItem[]>("get_backlinks", {
          itemType: "note" as NodeType,
          itemId: noteId,
        });
        if (!cancelled) setBacklinks(items);
      } catch {
        // バックリンク取得失敗は静かに処理
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetch();
    return () => { cancelled = true; };
  }, [noteId]);

  return (
    <section>
      <button
        type="button"
        onClick={() => setCollapsed((p) => !p)}
        className="flex items-center gap-2 w-full text-left py-1.5"
        style={{ color: "var(--color-text-secondary)" }}
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
          style={{
            transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
            transition: "transform 150ms ease-out",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        <span className="text-xs font-semibold uppercase tracking-wider">
          バックリンク
        </span>
        <span
          className="text-xs px-1.5 py-0.5 ml-auto"
          style={{
            backgroundColor: "var(--color-bg-tertiary)",
            color: "var(--color-text-tertiary)",
            borderRadius: "999px",
          }}
        >
          {backlinks.length}
        </span>
      </button>

      {!collapsed && (
        <div className="flex flex-col gap-1.5 mt-1">
          {loading ? (
            <div
              className="text-xs py-2"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              読み込み中…
            </div>
          ) : backlinks.length === 0 ? (
            <div
              className="text-xs py-2"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              バックリンクはありません
            </div>
          ) : (
            backlinks.map((bl) => (
              <button
                key={bl.id}
                type="button"
                onClick={() => onNavigate(bl.sourceId, bl.sourceType)}
                className="flex flex-col gap-0.5 w-full text-left p-2"
                style={{
                  borderRadius: "8px",
                  border: "1px solid var(--color-border-secondary)",
                  backgroundColor: "var(--color-bg-primary)",
                  transition: "background-color 150ms ease-out",
                  minWidth: 0,
                  overflow: "hidden",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    "var(--color-bg-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    "var(--color-bg-primary)";
                }}
              >
                <div className="flex items-center gap-1.5" style={{ minWidth: 0 }}>
                  <IconItemType
                    itemType={bl.sourceType as "paper" | "note"}
                    size={12}
                    style={{ flexShrink: 0 }}
                  />
                  <span
                    className="text-xs font-medium"
                    style={{ color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}
                  >
                    {bl.sourceTitle}
                  </span>
                </div>
                {bl.context && (
                  <span
                    className="text-xs"
                    style={{
                      color: "var(--color-text-tertiary)",
                      paddingLeft: "18px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      display: "block",
                    }}
                  >
                    {bl.context}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </section>
  );
};

// ============================================================
// アウトラインセクション
// ============================================================

/** Markdown コンテンツから見出しを抽出する */
function extractHeadings(content: string): OutlineHeading[] {
  const headings: OutlineHeading[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const match = /^(#{1,6})\s+(.+)$/.exec(line);
    if (match?.[1] && match[2]) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        line: i + 1, // 1-indexed
      });
    }
  }
  return headings;
}

const OutlineSection: React.FC<{
  content: string;
  onHeadingClick: (line: number) => void;
}> = ({ content, onHeadingClick }) => {
  const [collapsed, setCollapsed] = useState(false);
  const headings = useMemo(() => extractHeadings(content), [content]);

  return (
    <section>
      <button
        type="button"
        onClick={() => setCollapsed((p) => !p)}
        className="flex items-center gap-2 w-full text-left py-1.5"
        style={{ color: "var(--color-text-secondary)" }}
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
          style={{
            transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
            transition: "transform 150ms ease-out",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        <span className="text-xs font-semibold uppercase tracking-wider">
          アウトライン
        </span>
      </button>

      {!collapsed && (
        <div className="flex flex-col mt-1">
          {headings.length === 0 ? (
            <div
              className="text-xs py-2"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              見出しがありません
            </div>
          ) : (
            headings.map((h, idx) => (
              <button
                key={`${h.line}-${String(idx)}`}
                type="button"
                onClick={() => onHeadingClick(h.line)}
                className="text-left text-xs py-1"
                style={{
                  paddingLeft: `${(h.level - 1) * 12 + 4}px`,
                  color: "var(--color-text-secondary)",
                  borderRadius: "4px",
                  transition: "color 150ms ease-out",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  display: "block",
                  width: "100%",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--color-accent-primary)";
                  e.currentTarget.style.backgroundColor =
                    "var(--color-bg-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--color-text-secondary)";
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                {h.text}
              </button>
            ))
          )}
        </div>
      )}
    </section>
  );
};

// ============================================================
// タグセクション
// ============================================================

const TagsSection: React.FC<{
  note: Note;
}> = ({ note }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newTag, setNewTag] = useState("");
  const updateNote = useNoteStore((s) => s.updateNote);

  /** タグ追加 */
  const handleAddTag = useCallback(async () => {
    const trimmed = newTag.trim();
    if (!trimmed) return;
    if (note.tags.includes(trimmed)) {
      toast.info(useI18nStore.getState().t.notes.k_rz3qm7);
      setNewTag("");
      return;
    }
    try {
      await updateNote(note.id, { tags: [...note.tags, trimmed] });
      setNewTag("");
      setIsAdding(false);
    } catch {
      toast.error(useI18nStore.getState().t.notes.k_15jcbk);
    }
  }, [newTag, note.id, note.tags, updateNote]);

  /** タグ削除 */
  const handleRemoveTag = useCallback(
    async (tag: string) => {
      try {
        await updateNote(note.id, {
          tags: note.tags.filter((t) => t !== tag),
        });
      } catch {
        toast.error(useI18nStore.getState().t.notes.k_xhhiw9);
      }
    },
    [note.id, note.tags, updateNote],
  );

  return (
    <section>
      <button
        type="button"
        onClick={() => setCollapsed((p) => !p)}
        className="flex items-center gap-2 w-full text-left py-1.5"
        style={{ color: "var(--color-text-secondary)" }}
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
          style={{
            transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
            transition: "transform 150ms ease-out",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        <span className="text-xs font-semibold uppercase tracking-wider">
          タグ
        </span>
        <span
          className="text-xs px-1.5 py-0.5 ml-auto"
          style={{
            backgroundColor: "var(--color-bg-tertiary)",
            color: "var(--color-text-tertiary)",
            borderRadius: "999px",
          }}
        >
          {note.tags.length}
        </span>
      </button>

      {!collapsed && (
        <div className="mt-1">
          {/* タグ一覧 */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {note.tags.map((tag) => (
              <Badge
                key={tag}
                removable
                onRemove={() => void handleRemoveTag(tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>

          {/* タグ追加 */}
          {isAdding ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleAddTag();
                  if (e.key === "Escape") {
                    setIsAdding(false);
                    setNewTag("");
                  }
                }}
                placeholder={useI18nStore.getState().t.notes.k_7ds2k}
                autoFocus
                className="text-xs flex-1"
                style={{
                  padding: "4px 8px",
                  borderRadius: "6px",
                  border: "1px solid var(--color-border-secondary)",
                  backgroundColor: "var(--color-bg-primary)",
                  color: "var(--color-text-primary)",
                  outline: "none",
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
              <button
                type="button"
                onClick={() => void handleAddTag()}
                className="text-xs"
                style={{
                  color: "var(--color-accent-primary)",
                  padding: "4px 8px",
                  borderRadius: "6px",
                }}
              >
                追加
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="text-xs flex items-center gap-1"
              style={{
                color: "var(--color-text-tertiary)",
                padding: "2px 0",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--color-accent-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--color-text-tertiary)";
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
              タグを追加
            </button>
          )}
        </div>
      )}
    </section>
  );
};

// ============================================================
// メインコンポーネント
// ============================================================

export const NoteContextPanel: React.FC<NoteContextPanelProps> = ({
  note,
  editorContent,
  onHeadingClick,
  onNavigate,
}) => {
  return (
    <aside
      className="flex flex-col h-full overflow-y-auto"
      style={{
        width: "280px",
        minWidth: "280px",
        maxWidth: "280px",
        borderLeft: "1px solid var(--color-border-primary)",
        backgroundColor: "var(--color-bg-secondary)",
        padding: "16px",
        overflow: "hidden auto",
      }}
    >
      <div className="flex flex-col gap-5">
        {/* バックリンク */}
        <BacklinksSection noteId={note.id} onNavigate={onNavigate} />

        {/* セパレータ */}
        <div
          style={{
            height: "1px",
            backgroundColor: "var(--color-border-secondary)",
          }}
        />

        {/* アウトライン */}
        <OutlineSection content={editorContent} onHeadingClick={onHeadingClick} />

        {/* セパレータ */}
        <div
          style={{
            height: "1px",
            backgroundColor: "var(--color-border-secondary)",
          }}
        />

        {/* タグ */}
        <TagsSection note={note} />
      </div>
    </aside>
  );
};
