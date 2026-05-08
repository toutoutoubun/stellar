// src/components/layout/ContextPanel.tsx
// Stellar — コンテキストパネル
// 論文のメタデータ・ハイライト一覧・関連ノート等を表示するサイドパネル
// ノート選択時はバックリンク・タグ・アウトラインを表示
// メインペイン右側にスライドインで表示される

import type React from "react";
import { useState, useEffect } from "react";
import { useUIStore } from "../../stores/useUIStore";
import { useLibraryStore } from "../../stores/useLibraryStore";
import { useNoteStore } from "../../stores/useNoteStore";
import { useT } from "../../stores/useI18nStore";
import { useI18nStore } from "../../stores/useI18nStore";
import { invoke } from "../../lib/tauriShim";
import { Badge } from "../ui/Badge";
import { IconItemType } from "../ui/Icons";
import type { Paper, Note, Highlight, BacklinkItem, NodeType } from "../../types";

// ============================================================
// 折りたたみセクション
// ============================================================

const CollapsibleSection: React.FC<{
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ title, open, onToggle, children }) => (
  <div style={{ borderBottom: "1px solid var(--color-border-secondary)" }}>
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-2.5"
      style={{
        backgroundColor: "transparent",
        border: "none",
        cursor: "pointer",
        transition: "background-color var(--transition-fast)",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-bg-hover)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
    >
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>
        {title}
      </span>
      <svg
        width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{
          color: "var(--color-text-tertiary)",
          transform: open ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform var(--transition-fast)",
        }}
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
    {open && children}
  </div>
);

// ============================================================
// ハイライトカラーマップ
// ============================================================

const highlightColorMap: Record<string, string> = {
  yellow: "rgba(250, 204, 21, 0.12)",
  blue: "rgba(59, 130, 246, 0.12)",
  green: "rgba(34, 197, 94, 0.12)",
  pink: "rgba(236, 72, 153, 0.12)",
};

const highlightBorderMap: Record<string, string> = {
  yellow: "#FACC15",
  blue: "#3B82F6",
  green: "#22C55E",
  pink: "#EC4899",
};

// ============================================================
// ローディングスピナー
// ============================================================

const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center py-8" style={{ color: "var(--color-text-tertiary)" }}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      style={{ animation: "spin 1s linear infinite" }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  </div>
);

// ============================================================
// リンクアイテムボタン
// ============================================================

const LinkItemButton: React.FC<{
  itemType: "paper" | "note";
  title: string;
  subtitle?: string;
  onClick: () => void;
}> = ({ itemType, title, subtitle, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded"
    style={{
      backgroundColor: "transparent",
      border: "none",
      cursor: "pointer",
      transition: "background-color var(--transition-fast)",
    }}
    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-bg-hover)"; }}
    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
  >
    <IconItemType itemType={itemType} size={12} style={{ flexShrink: 0, color: "var(--color-text-tertiary)" }} />
    <span className="text-xs truncate flex-1" style={{ color: "var(--color-text-primary)" }}>
      {title}
    </span>
    {subtitle && (
      <span className="text-[10px] truncate shrink-0 ml-auto" style={{ color: "var(--color-text-tertiary)", maxWidth: "80px" }}>
        {subtitle}
      </span>
    )}
  </button>
);

// ============================================================
// 論文詳細セクション
// ============================================================

const PaperContextContent: React.FC<{ paperId: string }> = ({ paperId }) => {
  const t = useI18nStore.getState().t;
  const papers = useLibraryStore((s) => s.papers);
  const openNote = useUIStore((s) => s.openNote);
  const openPaper = useUIStore((s) => s.openPaper);

  const [paper, setPaper] = useState<Paper | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [relatedNotes, setRelatedNotes] = useState<Note[]>([]);
  const [backlinks, setBacklinks] = useState<BacklinkItem[]>([]);
  const [loading, setLoading] = useState(true);

  // セクション折りたたみ
  const [metaOpen, setMetaOpen] = useState(true);
  const [highlightsOpen, setHighlightsOpen] = useState(true);
  const [notesOpen, setNotesOpen] = useState(true);
  const [backlinksOpen, setBacklinksOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        // ストアから論文を取得
        const found = papers.find((p) => p.id === paperId);
        if (found && !cancelled) setPaper(found);

        // ハイライト取得
        try {
          const hl = await invoke<Highlight[]>("get_highlights", { paperId });
          if (!cancelled) setHighlights(hl ?? []);
        } catch { if (!cancelled) setHighlights([]); }

        // 関連ノート取得（紐付けノート）
        try {
          const result = await invoke<{ items: Note[] }>("get_notes", { paperId, limit: 100 });
          if (!cancelled) setRelatedNotes(result?.items ?? []);
        } catch { if (!cancelled) setRelatedNotes([]); }

        // バックリンク取得
        try {
          const bl = await invoke<BacklinkItem[]>("get_backlinks", {
            itemType: "paper" as NodeType, itemId: paperId,
          });
          if (!cancelled) setBacklinks(bl ?? []);
        } catch { if (!cancelled) setBacklinks([]); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchData();
    return () => { cancelled = true; };
  }, [paperId, papers]);

  if (loading) return <LoadingSpinner />;

  if (!paper) {
    return (
      <div className="p-4 text-sm" style={{ color: "var(--color-text-tertiary)" }}>
        {t.library.k_context_placeholder}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0">
      {/* メタデータセクション */}
      <CollapsibleSection title={t.library.k_detail_info} open={metaOpen} onToggle={() => setMetaOpen((v) => !v)}>
        <div className="flex flex-col gap-2.5 px-4 pb-3">
          {/* タイトル */}
          <div>
            <div className="text-[10px] font-medium mb-0.5 uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>
              {t.library.k_3n500e.replace(" *", "")}
            </div>
            <div className="text-sm font-semibold" style={{ color: "var(--color-text-primary)", lineHeight: "1.5" }}>
              {paper.title}
            </div>
          </div>

          {/* 著者 */}
          {paper.authors.length > 0 && (
            <div>
              <div className="text-[10px] font-medium mb-0.5 uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>
                {t.library.k_tm1buw.replace("（カンマ区切り）", "")}
              </div>
              <div className="text-xs" style={{ color: "var(--color-text-secondary)", lineHeight: "1.5" }}>
                {paper.authors.join(", ")}
              </div>
            </div>
          )}

          {/* 年・ジャーナル */}
          <div className="flex gap-4">
            {paper.year && (
              <div>
                <div className="text-[10px] font-medium mb-0.5 uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>
                  {t.library.k_ck7ty}
                </div>
                <div className="text-xs" style={{ color: "var(--color-text-secondary)" }}>{paper.year}</div>
              </div>
            )}
            {paper.journal && (
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-medium mb-0.5 uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>
                  {t.library.k_f45ryr}
                </div>
                <div className="text-xs truncate" style={{ color: "var(--color-text-secondary)" }}>{paper.journal}</div>
              </div>
            )}
          </div>

          {/* Volume / Issue / Pages */}
          {(paper.volume || paper.issue || paper.pages) && (
            <div className="flex gap-3 flex-wrap">
              {paper.volume && (
                <div>
                  <div className="text-[10px] font-medium mb-0.5 uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>
                    {t.library.k_ikb}
                  </div>
                  <div className="text-xs" style={{ color: "var(--color-text-secondary)" }}>{paper.volume}</div>
                </div>
              )}
              {paper.issue && (
                <div>
                  <div className="text-[10px] font-medium mb-0.5 uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>
                    {t.library.k_gl3}
                  </div>
                  <div className="text-xs" style={{ color: "var(--color-text-secondary)" }}>{paper.issue}</div>
                </div>
              )}
              {paper.pages && (
                <div>
                  <div className="text-[10px] font-medium mb-0.5 uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>
                    {t.library.k_7e6xi}
                  </div>
                  <div className="text-xs" style={{ color: "var(--color-text-secondary)" }}>{paper.pages}</div>
                </div>
              )}
            </div>
          )}

          {/* DOI */}
          {paper.doi && (
            <div>
              <div className="text-[10px] font-medium mb-0.5 uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>DOI</div>
              <a
                href={`https://doi.org/${paper.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs break-all"
                style={{ color: "var(--color-accent-primary)" }}
              >
                {paper.doi}
              </a>
            </div>
          )}

          {/* タグ */}
          {paper.tags.length > 0 && (
            <div>
              <div className="text-[10px] font-medium mb-1 uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>
                {t.library.k_tag_filter}
              </div>
              <div className="flex flex-wrap gap-1">
                {paper.tags.map((tag) => (
                  <Badge key={tag}>{tag}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* PDF ステータス */}
          <div className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ color: paper.pdfPath ? "var(--color-accent-primary)" : "var(--color-text-disabled)" }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="text-xs" style={{ color: paper.pdfPath ? "var(--color-accent-primary)" : "var(--color-text-tertiary)" }}>
              {paper.pdfPath ? t.library.k_e5u2bq : t.library.k_vn8gmj}
            </span>
          </div>
        </div>
      </CollapsibleSection>

      {/* アブストラクトセクション */}
      {paper.abstract && (
        <CollapsibleSection
          title={t.library.k_hq997l}
          open={true}
          onToggle={() => {}}
        >
          <div className="px-4 pb-3">
            <div
              className="text-xs"
              style={{
                color: "var(--color-text-secondary)",
                lineHeight: "1.7",
                maxHeight: "200px",
                overflow: "auto",
              }}
            >
              {paper.abstract}
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* ハイライトセクション */}
      <CollapsibleSection
        title={`${t.settings.data.highlights} (${highlights.length})`}
        open={highlightsOpen}
        onToggle={() => setHighlightsOpen((v) => !v)}
      >
        <div className="px-4 pb-3">
          {highlights.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
              {t.library.k_h0cdlq}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {highlights.slice(0, 10).map((hl) => (
                <div
                  key={hl.id}
                  className="p-2 rounded"
                  style={{
                    backgroundColor: highlightColorMap[hl.color] ?? "rgba(250, 204, 21, 0.12)",
                    borderLeft: `3px solid ${highlightBorderMap[hl.color] ?? "#FACC15"}`,
                  }}
                >
                  <p className="text-xs" style={{ color: "var(--color-text-primary)", lineHeight: "1.5" }}>
                    {hl.text.length > 120 ? `${hl.text.slice(0, 120)}...` : hl.text}
                  </p>
                  {hl.comment && (
                    <p className="text-xs mt-1" style={{ color: "var(--color-text-tertiary)", fontStyle: "italic" }}>
                      {hl.comment}
                    </p>
                  )}
                  <span className="text-[10px]" style={{ color: "var(--color-text-tertiary)" }}>
                    p.{hl.page}
                  </span>
                </div>
              ))}
              {highlights.length > 10 && (
                <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                  {t.library.k_show_more_highlights.replace("${count}", String(highlights.length - 10))}
                </p>
              )}
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* 関連ノートセクション */}
      <CollapsibleSection
        title={`${t.library.k_z75cmx} (${relatedNotes.length})`}
        open={notesOpen}
        onToggle={() => setNotesOpen((v) => !v)}
      >
        <div className="px-4 pb-3">
          {relatedNotes.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
              {t.library.k_context_note}
            </p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {relatedNotes.map((note) => (
                <LinkItemButton
                  key={note.id}
                  itemType="note"
                  title={note.title}
                  onClick={() => openNote(note.id)}
                />
              ))}
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* バックリンクセクション */}
      <CollapsibleSection
        title={`${t.library.k_4vgs8a} (${backlinks.length})`}
        open={backlinksOpen}
        onToggle={() => setBacklinksOpen((v) => !v)}
      >
        <div className="px-4 pb-3">
          {backlinks.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
              {t.library.k_no_paper_links}
            </p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {backlinks.map((bl) => {
                const isSource = bl.sourceId === paperId;
                const peerType = isSource ? bl.targetType : bl.sourceType;
                const peerId = isSource ? bl.targetId : bl.sourceId;
                const peerTitle = isSource ? bl.targetTitle : bl.sourceTitle;
                return (
                  <LinkItemButton
                    key={bl.id}
                    itemType={peerType as "paper" | "note"}
                    title={peerTitle}
                    subtitle={bl.context ?? undefined}
                    onClick={() => {
                      if (peerType === "note") openNote(peerId);
                      else openPaper(peerId);
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
};

// ============================================================
// ノート詳細セクション
// ============================================================

const NoteContextContent: React.FC<{ noteId: string }> = ({ noteId }) => {
  const t = useI18nStore.getState().t;
  const notes = useNoteStore((s) => s.notes);
  const openNote = useUIStore((s) => s.openNote);
  const openPaper = useUIStore((s) => s.openPaper);

  const [note, setNote] = useState<Note | null>(null);
  const [backlinks, setBacklinks] = useState<BacklinkItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [infoOpen, setInfoOpen] = useState(true);
  const [tagsOpen, setTagsOpen] = useState(true);
  const [backlinksOpen, setBacklinksOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const found = notes.find((n) => n.id === noteId);
        if (found && !cancelled) setNote(found);

        try {
          const bl = await invoke<BacklinkItem[]>("get_backlinks", {
            itemType: "note" as NodeType, itemId: noteId,
          });
          if (!cancelled) setBacklinks(bl ?? []);
        } catch { if (!cancelled) setBacklinks([]); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchData();
    return () => { cancelled = true; };
  }, [noteId, notes]);

  if (loading) return <LoadingSpinner />;

  if (!note) {
    return (
      <div className="p-4 text-sm" style={{ color: "var(--color-text-tertiary)" }}>
        {t.library.k_context_placeholder}
      </div>
    );
  }

  const wordCount = note.wordCount ?? note.content.length;
  const readingTime = note.readingTimeMin ?? Math.max(1, Math.ceil(wordCount / 400));
  const createdDate = new Date(note.createdAt).toLocaleDateString();
  const updatedDate = new Date(note.updatedAt).toLocaleDateString();

  return (
    <div className="flex flex-col gap-0">
      {/* ノート情報セクション */}
      <CollapsibleSection title={t.library.k_detail_info} open={infoOpen} onToggle={() => setInfoOpen((v) => !v)}>
        <div className="flex flex-col gap-2.5 px-4 pb-3">
          {/* タイトル */}
          <div>
            <div className="text-[10px] font-medium mb-0.5 uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>
              {t.library.k_3n500e.replace(" *", "")}
            </div>
            <div className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
              {note.title}
            </div>
          </div>

          {/* 統計情報 */}
          <div className="flex gap-4">
            <div>
              <div className="text-[10px] font-medium mb-0.5 uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>
                {t.common.chars}
              </div>
              <div className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                {wordCount.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium mb-0.5 uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>
                ~min
              </div>
              <div className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                {readingTime}
              </div>
            </div>
          </div>

          {/* 日付情報 */}
          <div className="flex gap-4">
            <div>
              <div className="text-[10px] font-medium mb-0.5 uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>
                {t.notes.sortCreated}
              </div>
              <div className="text-xs" style={{ color: "var(--color-text-secondary)" }}>{createdDate}</div>
            </div>
            <div>
              <div className="text-[10px] font-medium mb-0.5 uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>
                {t.notes.sortUpdated}
              </div>
              <div className="text-xs" style={{ color: "var(--color-text-secondary)" }}>{updatedDate}</div>
            </div>
          </div>

          {/* 関連論文リンク */}
          {note.paperId && (
            <div>
              <div className="text-[10px] font-medium mb-0.5 uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>
                {t.settings.data.papers}
              </div>
              <button
                type="button"
                onClick={() => openPaper(note.paperId!)}
                className="flex items-center gap-1.5 text-xs"
                style={{
                  color: "var(--color-accent-primary)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <IconItemType itemType="paper" size={12} />
                <span>{t.library.k_context_paper}</span>
              </button>
            </div>
          )}

          {/* 下書きフラグ */}
          {note.isDraft === 1 && (
            <div className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--color-accent-warning)" }}>
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              <span className="text-xs" style={{ color: "var(--color-accent-warning)" }}>
                {t.draftMode.title}
              </span>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* タグセクション */}
      <CollapsibleSection
        title={`${t.library.k_tag_filter} (${note.tags.length})`}
        open={tagsOpen}
        onToggle={() => setTagsOpen((v) => !v)}
      >
        <div className="px-4 pb-3">
          {note.tags.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
              {t.library.k_no_tags}
            </p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {note.tags.map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* バックリンクセクション */}
      <CollapsibleSection
        title={`${t.library.k_4vgs8a} (${backlinks.length})`}
        open={backlinksOpen}
        onToggle={() => setBacklinksOpen((v) => !v)}
      >
        <div className="px-4 pb-3">
          {backlinks.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
              {t.notes.k_no_backlinks}
            </p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {backlinks.map((bl) => {
                const isSource = bl.sourceId === noteId;
                const peerType = isSource ? bl.targetType : bl.sourceType;
                const peerId = isSource ? bl.targetId : bl.sourceId;
                const peerTitle = isSource ? bl.targetTitle : bl.sourceTitle;
                return (
                  <LinkItemButton
                    key={bl.id}
                    itemType={peerType as "paper" | "note"}
                    title={peerTitle}
                    subtitle={bl.context ?? undefined}
                    onClick={() => {
                      if (peerType === "note") openNote(peerId);
                      else openPaper(peerId);
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
};

// ============================================================
// メインコンテキストパネル
// ============================================================

export const ContextPanel: React.FC = () => {
  const t = useT();
  const contextPanelOpen = useUIStore((s) => s.contextPanelOpen);
  const toggleContextPanel = useUIStore((s) => s.toggleContextPanel);
  const mainPaneContent = useUIStore((s) => s.mainPaneContent);

  if (!contextPanelOpen) {
    return null;
  }

  // 現在の選択に応じたコンテンツを決定
  const renderContent = () => {
    switch (mainPaneContent.type) {
      case "paper":
        return <PaperContextContent paperId={mainPaneContent.paperId} />;
      case "note":
        return <NoteContextContent noteId={mainPaneContent.noteId} />;
      case "draft":
        return <NoteContextContent noteId={mainPaneContent.noteId} />;
      case "split-view":
        return <PaperContextContent paperId={mainPaneContent.paperId} />;
      default:
        return (
          <div className="p-4">
            <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>
              {t.library.k_context_placeholder}
            </p>
            <p className="text-xs mt-2" style={{ color: "var(--color-text-tertiary)", lineHeight: "var(--line-height-relaxed)" }}>
              {t.library.k_context_paper}
              <br />
              {t.library.k_context_note}
            </p>
          </div>
        );
    }
  };

  return (
    <aside
      className="shrink-0 overflow-y-auto animate-slide-in-right scrollable-area"
      style={{
        width: "var(--context-panel-width)",
        backgroundColor: "var(--color-bg-secondary)",
        borderLeft: "1px solid var(--color-border-secondary)",
      }}
    >
      {/* パネルヘッダー */}
      <div
        className="flex items-center justify-between px-4 py-3 sticky top-0"
        style={{
          backgroundColor: "var(--color-bg-secondary)",
          borderBottom: "1px solid var(--color-border-secondary)",
          zIndex: 1,
        }}
      >
        <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
          {t.library.k_detail_info}
        </h3>
        <button
          onClick={toggleContextPanel}
          className="flex items-center justify-center w-6 h-6"
          style={{
            borderRadius: "var(--radius-button)",
            color: "var(--color-text-tertiary)",
            transition: "all var(--transition-fast)",
            backgroundColor: "transparent",
            border: "none",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-bg-hover)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          title={t.layout.str_tq8rjt}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* パネルコンテンツ */}
      {renderContent()}
    </aside>
  );
};
