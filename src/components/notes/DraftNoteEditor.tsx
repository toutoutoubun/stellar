// src/components/notes/DraftNoteEditor.tsx
// Stellar — 草稿エディタ（3カラムレイアウト）
// 左: DraftOutlinePanel (220px) / 中央: NoteEditor / 右: タブパネル (280px)

import type React from "react";
import { useState, useCallback, useEffect } from "react";
import { invoke } from "../../lib/tauriShim";
import type { DraftChapter, CitationStyle } from "../../types";
import { CITATION_STYLE_LABELS } from "../../types";
import { useNoteStore } from "../../stores/useNoteStore";
import { useUIStore } from "../../stores/useUIStore";
import { NoteEditor } from "./NoteEditor";
import { DraftOutlinePanel } from "./DraftOutlinePanel";
import { DraftCitationPanel } from "./DraftCitationPanel";
import { NoteContextPanel } from "./NoteContextPanel";
import { useT } from "../../stores/useI18nStore";
import type { NodeType } from "../../types";

interface DraftNoteEditorProps {
  noteId: string;
}

/** 右パネルのタブ種別 */
type RightTab = "citations" | "context";

export const DraftNoteEditor: React.FC<DraftNoteEditorProps> = ({ noteId }) => {
  const t = useT();

  // ストア
  const activeNote = useNoteStore((s) => s.activeNote);
  const updateNote = useNoteStore((s) => s.updateNote);
  const openNoteAction = useNoteStore((s) => s.openNote);
  const openPaperUI = useUIStore((s) => s.openPaper);
  const openNoteUI = useUIStore((s) => s.openNote);
  const setMainPaneContent = useUIStore((s) => s.setMainPaneContent);

  // ローカル状態
  const [chapters, setChapters] = useState<DraftChapter[]>([]);
  const [rightTab, setRightTab] = useState<RightTab>("citations");
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [citationStyle, setCitationStyle] = useState<CitationStyle>("apa7");
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const [editorContent, setEditorContent] = useState("");

  /** ノートデータの取得 */
  useEffect(() => {
    void openNoteAction(noteId);
  }, [noteId, openNoteAction]);

  /** 章リストを取得 */
  const fetchChapters = useCallback(async () => {
    try {
      const result = await invoke<DraftChapter[]>("get_draft_chapters", {
        noteId,
      });
      setChapters(result);
    } catch {
      // 静かに処理
    }
  }, [noteId]);

  useEffect(() => {
    void fetchChapters();
  }, [fetchChapters]);

  /** activeNote が読み込まれたらコンテンツを同期 */
  useEffect(() => {
    if (activeNote) {
      setEditorContent(activeNote.content);
    }
  }, [activeNote]);

  /** 章クリック — 該当位置へスクロール（将来拡張） */
  const handleChapterClick = useCallback((_chapterId: string) => {
    // 将来: StellarEditor ref で該当見出しまでスクロール
  }, []);

  /** 引用スタイル変更 */
  const handleStyleChange = useCallback(
    async (style: CitationStyle) => {
      setCitationStyle(style);
      setStyleMenuOpen(false);
      if (activeNote) {
        try {
          await updateNote(activeNote.id, {});
        } catch {
          // 静かに処理
        }
      }
    },
    [activeNote, updateNote],
  );

  /** split-view を開く */
  const handleOpenSplitView = useCallback(() => {
    if (activeNote?.paperId) {
      setMainPaneContent({
        type: "split-view",
        paperId: activeNote.paperId,
        noteId,
      });
    }
  }, [activeNote, noteId, setMainPaneContent]);

  /** WikiLink / バックリンク遷移 */
  const handleNavigate = useCallback(
    (targetId: string, targetType: NodeType) => {
      if (targetType === "note") {
        openNoteUI(targetId);
      } else {
        openPaperUI(targetId);
      }
    },
    [openNoteUI, openPaperUI],
  );

  /** 見出しクリック（将来拡張） */
  const handleHeadingClick = useCallback((_line: number) => {
    // 将来: StellarEditor ref で該当行へスクロール
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ツールバー — NoteEditor の上に追加ボタンを配置 */}
      <header
        className="flex items-center gap-2 px-3 shrink-0 select-none"
        style={{
          height: "36px",
          backgroundColor: "var(--color-bg-secondary)",
          borderBottom: "1px solid var(--color-border-primary)",
        }}
      >
        {/* 草稿バッジ */}
        <span
          className="flex items-center gap-1 text-xs"
          style={{
            backgroundColor: "var(--color-accent-primary)",
            color: "#fff",
            padding: "2px 8px",
            borderRadius: "999px",
            fontWeight: 600,
            fontSize: "10px",
          }}
        >
          {/* ペンアイコン */}
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
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          {t.draftMode.draftBadge}
        </span>

        <div className="flex-1" />

        {/* 引用スタイルセレクター */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setStyleMenuOpen((p) => !p)}
            className="flex items-center gap-1 text-xs"
            style={{
              color: "var(--color-text-secondary)",
              padding: "3px 8px",
              borderRadius: "6px",
              border: "1px solid var(--color-border-secondary)",
              transition: "all 120ms ease-out",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--color-accent-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--color-border-secondary)";
            }}
          >
            {CITATION_STYLE_LABELS[citationStyle]}
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
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {styleMenuOpen && (
            <div
              className="absolute right-0 top-full mt-1"
              style={{
                backgroundColor: "var(--color-bg-secondary)",
                border: "1px solid var(--color-border-primary)",
                borderRadius: "8px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                padding: "4px",
                zIndex: 50,
                minWidth: "140px",
              }}
            >
              {(Object.keys(CITATION_STYLE_LABELS) as CitationStyle[]).map(
                (style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => void handleStyleChange(style)}
                    className="flex items-center gap-2 w-full text-left text-xs px-3 py-1.5"
                    style={{
                      color:
                        citationStyle === style
                          ? "var(--color-accent-primary)"
                          : "var(--color-text-secondary)",
                      fontWeight: citationStyle === style ? 600 : 400,
                      borderRadius: "6px",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "var(--color-bg-hover)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    {CITATION_STYLE_LABELS[style]}
                  </button>
                ),
              )}
            </div>
          )}
        </div>

        {/* split-view ボタン */}
        {activeNote?.paperId && (
          <button
            type="button"
            onClick={handleOpenSplitView}
            className="flex items-center justify-center"
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              color: "var(--color-text-secondary)",
              transition: "color 120ms ease-out",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--color-accent-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--color-text-secondary)";
            }}
            title={t.draftMode.splitViewTooltip}
          >
            {/* split-view アイコン */}
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
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="12" y1="3" x2="12" y2="21" />
            </svg>
          </button>
        )}

        {/* 右パネルトグル */}
        <button
          type="button"
          onClick={() => setRightPanelOpen((p) => !p)}
          className="flex items-center justify-center"
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "6px",
            color: rightPanelOpen
              ? "var(--color-accent-primary)"
              : "var(--color-text-secondary)",
          }}
          title={t.draftMode.contextPanel}
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
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="15" y1="3" x2="15" y2="21" />
          </svg>
        </button>
      </header>

      {/* 3カラムレイアウト */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左: DraftOutlinePanel */}
        <DraftOutlinePanel
          noteId={noteId}
          chapters={chapters}
          onChapterClick={handleChapterClick}
          onReorder={() => void fetchChapters()}
        />

        {/* 中央: NoteEditor */}
        <div className="flex-1 overflow-hidden">
          <NoteEditor noteId={noteId} />
        </div>

        {/* 右: タブパネル */}
        {rightPanelOpen && (
          <aside
            className="flex flex-col h-full overflow-hidden"
            style={{
              width: "280px",
              minWidth: "280px",
              maxWidth: "280px",
              borderLeft: "1px solid var(--color-border-primary)",
              backgroundColor: "var(--color-bg-secondary)",
            }}
          >
            {/* タブヘッダー */}
            <div
              className="flex shrink-0"
              style={{
                borderBottom: "1px solid var(--color-border-secondary)",
              }}
            >
              <button
                type="button"
                onClick={() => setRightTab("citations")}
                className="flex-1 text-xs text-center py-2"
                style={{
                  color:
                    rightTab === "citations"
                      ? "var(--color-accent-primary)"
                      : "var(--color-text-tertiary)",
                  fontWeight: rightTab === "citations" ? 600 : 400,
                  borderBottom:
                    rightTab === "citations"
                      ? "2px solid var(--color-accent-primary)"
                      : "2px solid transparent",
                  transition: "all 150ms ease-out",
                }}
              >
                {t.draftMode.citations}
              </button>
              <button
                type="button"
                onClick={() => setRightTab("context")}
                className="flex-1 text-xs text-center py-2"
                style={{
                  color:
                    rightTab === "context"
                      ? "var(--color-accent-primary)"
                      : "var(--color-text-tertiary)",
                  fontWeight: rightTab === "context" ? 600 : 400,
                  borderBottom:
                    rightTab === "context"
                      ? "2px solid var(--color-accent-primary)"
                      : "2px solid transparent",
                  transition: "all 150ms ease-out",
                }}
              >
                {t.draftMode.contextPanel}
              </button>
            </div>

            {/* タブコンテンツ */}
            <div className="flex-1 overflow-hidden">
              {rightTab === "citations" ? (
                <DraftCitationPanel
                  noteId={noteId}
                  citationStyle={citationStyle}
                />
              ) : activeNote ? (
                <NoteContextPanel
                  note={activeNote}
                  editorContent={editorContent}
                  onHeadingClick={handleHeadingClick}
                  onNavigate={handleNavigate}
                />
              ) : null}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
