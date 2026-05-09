// src/components/library/PaperDetailPanel.tsx
// Stellar — 論文詳細パネル（右コンテキストパネル）
// selectedPaperId が選択されたときに表示される
// タイトル / 著者 / 年 / ジャーナル / DOI / タグ / アブストラクト / 関連ノート / バックリンク / ハイライト
// リンクサジェスト / 双方向リンク作成

import type React from "react";
import { useState, useCallback, useEffect } from "react";
import type { Paper, Note, Highlight, BacklinkItem, CitationStyle, NodeType } from "../../types";
import { CITATION_STYLE_LABELS } from "../../types";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { copyCitationToClipboard } from "../../utils/citation";
import { toast } from "../ui/Toast";
import { invoke } from "../../lib/tauriShim";
import { useT } from "../../stores/useI18nStore";
import { useLibraryStore } from "../../stores/useLibraryStore";
import { ReadingStatusBadge } from "./ReadingStatusBadge";
import { CitationNetworkPanel } from "./CitationNetworkPanel";
import { IconItemType } from "../ui/Icons";

interface PaperDetailPanelProps {
  paper: Paper;
  onClose: () => void;
  onOpenPdf: (paperId: string) => void;
  onDelete: (paperId: string) => void;
  onAttachPdf?: (paperId: string) => void;
  onEdit?: (paperId: string) => void;
  onNavigate?: (targetId: string, targetType: NodeType) => void;
}

/** セクションの折りたたみ可能なヘッダー */
const SectionHeader: React.FC<{
  title: string;
  count?: number;
  expanded: boolean;
  onToggle: () => void;
}> = ({ title, count, expanded, onToggle }) => (
  <button
    className="flex items-center justify-between w-full py-2 text-xs font-semibold uppercase tracking-wide"
    style={{ color: "var(--color-text-tertiary)" }}
    onClick={onToggle}
  >
    <span>
      {title}
      {count !== undefined && (
        <span
          className="ml-1.5 font-normal"
          style={{ color: "var(--color-text-disabled)" }}
        >
          ({count})
        </span>
      )}
    </span>
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
        transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
        transition: "transform var(--transition-fast)",
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  </button>
);

/** セパレータ */
const Separator: React.FC = () => (
  <div
    className="my-1"
    style={{
      height: "1px",
      backgroundColor: "var(--color-border-secondary)",
    }}
  />
);

// ============================================================
// リンクサジェストセクション（論文用 — 双方向リンク作成）
// ============================================================

interface PaperLinkSuggestion {
  id: string;
  type: string;
  title: string;
  score: number;
  reason: string;
}

function peerFromBacklink(link: BacklinkItem, currentId: string) {
  const isSource = link.sourceId === currentId;
  return {
    id: isSource ? link.targetId : link.sourceId,
    type: isSource ? link.targetType : link.sourceType,
    title: isSource ? link.targetTitle : link.sourceTitle,
  };
}

function mergeLinkedNotes(baseNotes: Note[], links: BacklinkItem[], currentPaperId: string): Note[] {
  const notesById = new Map(baseNotes.map((note) => [note.id, note]));

  for (const link of links) {
    const peer = peerFromBacklink(link, currentPaperId);
    if (peer.type !== "note" || notesById.has(peer.id)) continue;
    notesById.set(peer.id, {
      id: peer.id,
      title: peer.title || "Untitled Note",
      content: "",
      paperId: currentPaperId,
      tags: [],
      createdAt: "",
      updatedAt: "",
    });
  }

  return Array.from(notesById.values());
}

const PaperLinkSuggestionsSection: React.FC<{
  paperId: string;
  onNavigate?: (targetId: string, targetType: NodeType) => void;
}> = ({ paperId, onNavigate }) => {
  const t = useT();
  const [suggestions, setSuggestions] = useState<PaperLinkSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchSuggestions = async () => {
      setLoading(true);
      try {
        const items = await invoke<PaperLinkSuggestion[]>("get_link_suggestions", {
          itemId: paperId,
          itemType: "paper",
        });
        if (!cancelled) setSuggestions(items);
      } catch {
        // サジェスト取得失敗は静かに処理
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchSuggestions();
    return () => { cancelled = true; };
  }, [paperId]);

  /** サジェストから双方向リンクを作成 */
  const handleCreateLink = useCallback(
    async (targetId: string, targetType: string) => {
      setCreating(targetId);
      try {
        await invoke("create_link", {
          input: {
            sourceId: paperId,
            sourceType: "paper",
            targetId,
            targetType,
          },
        });
        toast.success(t.library.k_link_created);
        window.dispatchEvent(new CustomEvent("stellar-links-changed"));
        // 作成済みサジェストをリストから除去
        setSuggestions((prev) => prev.filter((s) => s.id !== targetId));
      } catch {
        toast.error(t.library.k_link_create_failed);
      } finally {
        setCreating(null);
      }
    },
    [paperId, t],
  );

  return (
    <div className="py-1">
      <SectionHeader
        title={t.library.k_link_suggestions}
        count={suggestions.length}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
      />
      {expanded && (
        <div className="flex flex-col gap-1.5 mt-1">
          {loading ? (
            <div className="flex items-center gap-2 py-2">
              <div
                className="w-3 h-3 rounded-full animate-pulse"
                style={{ backgroundColor: "var(--color-text-disabled)" }}
              />
              <span
                className="text-xs"
                style={{ color: "var(--color-text-disabled)" }}
              >
                {t.common.loading}
              </span>
            </div>
          ) : suggestions.length === 0 ? (
            <p
              className="text-xs py-1"
              style={{ color: "var(--color-text-disabled)" }}
            >
              {t.library.k_no_suggestions}
            </p>
          ) : (
            suggestions.map((sg) => (
              <div
                key={sg.id}
                className="flex flex-col gap-1 w-full p-2"
                style={{
                  borderRadius: "8px",
                  border: "1px solid var(--color-border-secondary)",
                  backgroundColor: "var(--color-bg-primary)",
                }}
              >
                {/* タイトル行 */}
                <div className="flex items-center gap-1.5" style={{ minWidth: 0 }}>
                  <IconItemType
                    itemType={sg.type as "paper" | "note"}
                    size={12}
                    style={{ flexShrink: 0 }}
                  />
                  <button
                    type="button"
                    onClick={() => onNavigate?.(sg.id, sg.type as NodeType)}
                    className="text-xs font-medium text-left"
                    style={{
                      color: "var(--color-text-primary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      minWidth: 0,
                      flex: 1,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "var(--color-accent-primary)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "var(--color-text-primary)";
                    }}
                  >
                    {sg.title}
                  </button>
                </div>
                {/* 理由 */}
                <span
                  className="text-xs"
                  style={{
                    color: "var(--color-text-tertiary)",
                    fontSize: "10px",
                    paddingLeft: "18px",
                  }}
                >
                  {sg.reason}
                </span>
                {/* 双方向リンク作成ボタン */}
                <div style={{ paddingLeft: "18px" }}>
                  <button
                    type="button"
                    onClick={() => void handleCreateLink(sg.id, sg.type)}
                    disabled={creating === sg.id}
                    className="text-xs inline-flex items-center gap-1"
                    style={{
                      color: "var(--color-accent-primary)",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      border: "1px solid var(--color-accent-primary)",
                      fontSize: "10px",
                      transition: "all 120ms ease-out",
                      opacity: creating === sg.id ? 0.5 : 1,
                      cursor: creating === sg.id ? "wait" : "pointer",
                    }}
                    onMouseEnter={(e) => {
                      if (creating !== sg.id) {
                        e.currentTarget.style.backgroundColor = "var(--color-accent-primary)";
                        e.currentTarget.style.color = "#fff";
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = "var(--color-accent-primary)";
                    }}
                  >
                    {/* 双方向リンクアイコン */}
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
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                    {t.library.k_create_bilink}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================
// メインコンポーネント
// ============================================================

export const PaperDetailPanel: React.FC<PaperDetailPanelProps> = ({
  paper,
  onClose,
  onOpenPdf,
  onDelete,
  onAttachPdf,
  onEdit,
  onNavigate,
}) => {
  const t = useT();
  const updatePaperInStore = useLibraryStore((s) => s.updatePaper);

  // ── ストアから最新の paper を取得（タグ等の更新を即座に反映するため） ──
  const storePaper = useLibraryStore((s) => s.papers.find((p) => p.id === paper.id));
  const currentPaper = storePaper ?? paper;

  // ── 引用コピーのドロップダウン ──
  const [showCitationDropdown, setShowCitationDropdown] = useState(false);

  // ── セクション折りたたみ ──
  const [abstractExpanded, setAbstractExpanded] = useState(true);
  const [notesExpanded, setNotesExpanded] = useState(true);
  const [backlinksExpanded, setBacklinksExpanded] = useState(true);
  const [highlightsExpanded, setHighlightsExpanded] = useState(true);

  // ── 関連データ（Tauri から取得） ──
  const [relatedNotes, setRelatedNotes] = useState<Note[]>([]);
  const [backlinks, setBacklinks] = useState<BacklinkItem[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  // ── タグ追加 ──
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTag, setNewTag] = useState("");

  // ── 論文選択時に関連データを取得する ──
  useEffect(() => {
    let cancelled = false;

    const fetchRelatedData = async () => {

      setLoadingRelated(true);
      try {
        // 並列で関連ノート・バックリンク・ハイライトを取得
        const [notes, links, hlights] = await Promise.all([
          invoke<{ items: Note[]; totalPages: number; totalItems: number }>("get_notes", { paperId: currentPaper.id, limit: 1000 }).then(r => Array.isArray(r?.items) ? r.items : []).catch(
            () => [] as Note[]
          ),
          invoke<BacklinkItem[]>("get_backlinks", {
            itemType: "paper",
            itemId: currentPaper.id,
          }).catch(() => [] as BacklinkItem[]),
          invoke<Highlight[]>("get_highlights", {
            paperId: currentPaper.id,
          }).catch(() => [] as Highlight[]),
        ]);

        if (!cancelled) {
          setRelatedNotes(mergeLinkedNotes(notes, links, currentPaper.id));
          setBacklinks(links);
          setHighlights(hlights);
        }
      } catch {
        // エラーは静かに処理（パネルには空リストを表示）
      } finally {
        if (!cancelled) {
          setLoadingRelated(false);
        }
      }
    };

    void fetchRelatedData();
    window.addEventListener("stellar-links-changed", fetchRelatedData);

    return () => {
      cancelled = true;
      window.removeEventListener("stellar-links-changed", fetchRelatedData);
    };
  }, [currentPaper.id]);

  // ── 引用コピー ──
  const handleCopyCitation = useCallback(
    async (style: CitationStyle) => {
      const success = await copyCitationToClipboard(currentPaper, style);
      if (success) {
        toast.success(
          t.library.k_nd5w89
        );
      } else {
        toast.error(t.library.k_pytgr9);
      }
      setShowCitationDropdown(false);
    },
    [currentPaper]
  );

  // ── DOIをブラウザで開く ──
  const handleOpenDoi = useCallback(async () => {
    if (!currentPaper.doi) return;
    try {
      const { shellOpen } = await import("../../lib/tauriShim");
      await shellOpen(`https://doi.org/${currentPaper.doi}`);
    } catch {
      // フォールバック: window.open
      window.open(`https://doi.org/${currentPaper.doi}`, "_blank");
    }
  }, [currentPaper.doi]);

  // ── タグ追加（Enter押下） ──
  const handleAddTag = useCallback(
    async (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter") return;
      const tag = newTag.trim();
      if (tag === "" || currentPaper.tags.includes(tag)) {
        setNewTag("");
        setShowTagInput(false);
        return;
      }
      try {
        await updatePaperInStore(currentPaper.id, { tags: [...currentPaper.tags, tag] });
        toast.success(t.library.k_4ibxuc);
      } catch {
        toast.error(t.library.k_wbna9r);
      }
      setNewTag("");
      setShowTagInput(false);
    },
    [newTag, currentPaper.id, currentPaper.tags, updatePaperInStore, t]
  );

  // ── タグ削除 ──
  const handleRemoveTag = useCallback(
    async (tagToRemove: string) => {
      try {
        await updatePaperInStore(currentPaper.id, {
          tags: currentPaper.tags.filter((t) => t !== tagToRemove),
        });
        toast.success(t.library.k_tag_removed);
      } catch {
        toast.error(t.library.k_tag_remove_failed);
      }
    },
    [currentPaper.id, currentPaper.tags, updatePaperInStore, t]
  );

  return (
    <aside
      className="flex flex-col h-full overflow-hidden animate-slide-in-right"
      style={{
        width: "var(--context-panel-width)",
        backgroundColor: "var(--color-bg-secondary)",
        borderLeft: "1px solid var(--color-border-secondary)",
      }}
    >
      {/* ── パネルヘッダー ── */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{
          borderBottom: "1px solid var(--color-border-secondary)",
        }}
      >
        <h3
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          {t.library.k_paper_info}
        </h3>
        <button
          onClick={onClose}
          className="flex items-center justify-center w-6 h-6"
          style={{
            borderRadius: "var(--radius-button)",
            color: "var(--color-text-tertiary)",
            transition: "all var(--transition-fast)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
          aria-label={t.layout.str_tq8rjt}
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
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* ── スクロール可能コンテンツ ── */}
      <div
        className="flex-1 overflow-y-auto selectable"
        style={{ padding: "var(--space-4)" }}
        data-selectable="true"
      >
        {/* タイトル */}
        <h2
          className="text-base font-semibold leading-snug mb-2"
          style={{ color: "var(--color-text-primary)" }}
        >
          {currentPaper.title}
        </h2>

        {/* 読書ステータスバッジ */}
        <div className="mb-2">
          <ReadingStatusBadge paperId={currentPaper.id} />
        </div>

        {/* 著者 · 年 · ジャーナル */}
        <p
          className="text-xs mb-1"
          style={{
            color: "var(--color-text-secondary)",
            lineHeight: "var(--line-height-relaxed)",
          }}
        >
          {currentPaper.authors.join(", ") || t.library.k_h81ga7}
        </p>
        <p
          className="text-xs mb-3"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          {currentPaper.year ?? t.library.k_e7vv9}
          {currentPaper.journal && ` · ${currentPaper.journal}`}
          {currentPaper.volume && `, Vol. ${currentPaper.volume}`}
          {currentPaper.issue && `(${currentPaper.issue})`}
          {currentPaper.pages && `, pp. ${currentPaper.pages}`}
        </p>

        {/* DOI（クリックでブラウザ開く） */}
        {currentPaper.doi && (
          <button
            className="text-xs mb-3 inline-flex items-center gap-1"
            style={{
              color: "var(--color-text-link)",
              transition: "opacity var(--transition-fast)",
            }}
            onClick={handleOpenDoi}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.8";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
            title={`https://doi.org/${currentPaper.doi}`}
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
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            <span>DOI: {currentPaper.doi}</span>
          </button>
        )}

        {/* アクションボタン群 */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {currentPaper.pdfPath ? (
            <Button
              variant="primary"
              size="sm"
              icon={
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              }
              onClick={() => onOpenPdf(currentPaper.id)}
            >
              {t.library.k_open_pdf_btn}
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              icon={
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              }
              onClick={() => onAttachPdf?.(currentPaper.id)}
            >
              {t.library.k_attach_pdf_btn}
            </Button>
          )}

          {/* 引用コピーボタン */}
          <div className="relative">
            <Button
              variant="secondary"
              size="sm"
              icon={
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              }
              onClick={() => setShowCitationDropdown((prev) => !prev)}
            >
              {t.library.k_ezke84}
            </Button>

            {/* 引用スタイルドロップダウン */}
            {showCitationDropdown && (
              <div
                className="absolute left-0 top-full mt-1"
                style={{
                  minWidth: "160px",
                  backgroundColor: "var(--color-bg-card)",
                  borderRadius: "var(--radius-input)",
                  boxShadow: "var(--shadow-dropdown)",
                  border: "1px solid var(--color-border-secondary)",
                  padding: "var(--space-1) 0",
                  zIndex: "var(--z-dropdown)",
                  animation: "scale-in 150ms ease-out both",
                }}
              >
                {(
                  Object.entries(CITATION_STYLE_LABELS) as [
                    CitationStyle,
                    string,
                  ][]
                ).map(([style, label]) => (
                  <button
                    key={style}
                    className="flex items-center w-full px-3 py-2 text-xs text-left"
                    style={{
                      color: "var(--color-text-primary)",
                      transition: "background-color var(--transition-fast)",
                    }}
                    onClick={() => void handleCopyCitation(style)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "var(--color-bg-hover)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 編集ボタン */}
          {onEdit && (
            <Button
              variant="secondary"
              size="sm"
              icon={
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              }
              onClick={() => onEdit(currentPaper.id)}
            >
              {t.common.edit}
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            icon={
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            }
            onClick={() => onDelete(currentPaper.id)}
            style={{ color: "var(--color-accent-danger)" }}
          >
            {t.common.delete}
          </Button>
        </div>

        <Separator />

        {/* ── タグ（削除可能 + 追加） ── */}
        <div className="py-2">
          <div className="flex items-center justify-between mb-2">
            <span
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {t.library.k_tags_header}
            </span>
            <span
              className="text-xs px-1.5 py-0.5"
              style={{
                backgroundColor: "var(--color-bg-tertiary)",
                color: "var(--color-text-tertiary)",
                borderRadius: "999px",
              }}
            >
              {currentPaper.tags.length}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {currentPaper.tags.map((tag) => (
              <Badge
                key={tag}
                removable
                onRemove={() => void handleRemoveTag(tag)}
              >
                {tag}
              </Badge>
            ))}
            {/* タグ追加ボタン / 入力 */}
            {showTagInput ? (
              <input
                className="text-xs px-2 py-0.5"
                style={{
                  backgroundColor: "var(--color-bg-input)",
                  border: "1px solid var(--color-border-focus)",
                  borderRadius: "var(--radius-tag)",
                  color: "var(--color-text-primary)",
                  outline: "none",
                  width: "80px",
                }}
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={handleAddTag}
                onBlur={() => {
                  setShowTagInput(false);
                  setNewTag("");
                }}
                placeholder={t.library.k_sgs5u}
                autoFocus
              />
            ) : (
              <button
                className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5"
                style={{
                  border: "1px dashed var(--color-border-primary)",
                  borderRadius: "var(--radius-tag)",
                  color: "var(--color-text-tertiary)",
                  transition: "all var(--transition-fast)",
                }}
                onClick={() => setShowTagInput(true)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor =
                    "var(--color-accent-primary)";
                  e.currentTarget.style.color = "var(--color-accent-primary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor =
                    "var(--color-border-primary)";
                  e.currentTarget.style.color = "var(--color-text-tertiary)";
                }}
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>{t.library.k_add_label}</span>
              </button>
            )}
          </div>
        </div>

        <Separator />

        {/* ── アブストラクト（折りたたみ可能） ── */}
        <div className="py-1">
          <SectionHeader
            title={t.library.k_hq997l}
            expanded={abstractExpanded}
            onToggle={() => setAbstractExpanded((v) => !v)}
          />
          {abstractExpanded && (
            <div
              className="text-xs leading-relaxed mt-1"
              style={{
                color: currentPaper.abstract
                  ? "var(--color-text-secondary)"
                  : "var(--color-text-disabled)",
                lineHeight: "var(--line-height-relaxed)",
              }}
            >
              {currentPaper.abstract ?? t.library.k_h0cdlq}
            </div>
          )}
        </div>

        <Separator />

        {/* ── 関連ノート ── */}
        <div className="py-1">
          <SectionHeader
            title={`関連する${t.settings.data.notes}`}
            count={relatedNotes.length}
            expanded={notesExpanded}
            onToggle={() => setNotesExpanded((v) => !v)}
          />
          {notesExpanded && (
            <div className="flex flex-col gap-1 mt-1">
              {loadingRelated ? (
                <div className="flex items-center gap-2 py-2">
                  <div
                    className="w-3 h-3 rounded-full animate-pulse"
                    style={{
                      backgroundColor: "var(--color-text-disabled)",
                    }}
                  />
                  <span
                    className="text-xs"
                    style={{ color: "var(--color-text-disabled)" }}
                  >
                    {t.common.loading}
                  </span>
                </div>
              ) : relatedNotes.length === 0 ? (
                <p
                  className="text-xs py-1"
                  style={{ color: "var(--color-text-disabled)" }}
                >
                  {t.library.k_no_related_notes}
                </p>
              ) : (
                relatedNotes.map((note) => (
                  <button
                    key={note.id}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs text-left w-full"
                    style={{
                      borderRadius: "var(--radius-button)",
                      color: "var(--color-text-secondary)",
                      transition: "background-color var(--transition-fast)",
                    }}
                    onClick={() => onNavigate?.(note.id, "note")}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "var(--color-bg-hover)";
                    }}
                    onMouseLeave={(e) => {
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
                      className="shrink-0"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                    <span className="truncate">{note.title}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* ── バックリンク（双方向リンク表示） ── */}
        <div className="py-1">
          <SectionHeader
            title={t.library.k_4vgs8a}
            count={backlinks.length}
            expanded={backlinksExpanded}
            onToggle={() => setBacklinksExpanded((v) => !v)}
          />
          {backlinksExpanded && (
            <div className="flex flex-col gap-1 mt-1">
              {loadingRelated ? (
                <div className="flex items-center gap-2 py-2">
                  <div
                    className="w-3 h-3 rounded-full animate-pulse"
                    style={{
                      backgroundColor: "var(--color-text-disabled)",
                    }}
                  />
                  <span
                    className="text-xs"
                    style={{ color: "var(--color-text-disabled)" }}
                  >
                    {t.common.loading}
                  </span>
                </div>
              ) : backlinks.length === 0 ? (
                <p
                  className="text-xs py-1"
                  style={{ color: "var(--color-text-disabled)" }}
                >
                  {t.library.k_no_paper_links}
                </p>
              ) : (
                backlinks.map((link) => {
                  // 双方向リンクの相手側を特定
                  const isSource = link.sourceId === currentPaper.id;
                  const peerId = isSource ? link.targetId : link.sourceId;
                  const peerType = isSource ? link.targetType : link.sourceType;
                  const peerTitle = isSource
                    ? (link.targetTitle ?? `${peerType}: ${peerId.slice(0, 8)}...`)
                    : (link.sourceTitle ?? `${peerType}: ${peerId.slice(0, 8)}...`);

                  return (
                    <button
                      key={link.id}
                      type="button"
                      onClick={() => onNavigate?.(peerId, peerType)}
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
                        {/* 双方向リンクアイコン */}
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="shrink-0"
                          style={{ color: "var(--color-accent-primary)" }}
                        >
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        </svg>
                        <IconItemType
                          itemType={peerType as "paper" | "note"}
                          size={12}
                          style={{ flexShrink: 0 }}
                        />
                        <span
                          className="text-xs font-medium"
                          style={{
                            color: "var(--color-text-primary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            minWidth: 0,
                          }}
                        >
                          {peerTitle}
                        </span>
                      </div>
                      {link.context && (
                        <span
                          className="text-xs"
                          style={{
                            color: "var(--color-text-tertiary)",
                            paddingLeft: "30px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            display: "block",
                          }}
                        >
                          {link.context}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* ── リンクサジェスト（双方向リンク候補） ── */}
        <PaperLinkSuggestionsSection
          paperId={currentPaper.id}
          onNavigate={onNavigate}
        />

        <Separator />

        {/* ── ハイライト ── */}
        <div className="py-1">
          <SectionHeader
            title={t.settings.data.highlights}
            count={highlights.length}
            expanded={highlightsExpanded}
            onToggle={() => setHighlightsExpanded((v) => !v)}
          />
          {highlightsExpanded && (
            <div className="flex flex-col gap-2 mt-1">
              {loadingRelated ? (
                <div className="flex items-center gap-2 py-2">
                  <div
                    className="w-3 h-3 rounded-full animate-pulse"
                    style={{
                      backgroundColor: "var(--color-text-disabled)",
                    }}
                  />
                  <span
                    className="text-xs"
                    style={{ color: "var(--color-text-disabled)" }}
                  >
                    {t.common.loading}
                  </span>
                </div>
              ) : highlights.length === 0 ? (
                <p
                  className="text-xs py-1"
                  style={{ color: "var(--color-text-disabled)" }}
                >
                  {t.library.k_no_highlights_yet}
                </p>
              ) : (
                /* 最新3件のプレビュー */
                highlights.slice(0, 3).map((h) => (
                  <div
                    key={h.id}
                    className="px-2 py-1.5 text-xs"
                    style={{
                      borderLeft: `3px solid var(--color-highlight-${h.color})`,
                      backgroundColor: "var(--color-bg-tertiary)",
                      borderRadius: "0 var(--radius-button) var(--radius-button) 0",
                      color: "var(--color-text-secondary)",
                      lineHeight: "var(--line-height-normal)",
                    }}
                  >
                    <p className="truncate-multiline">{h.text}</p>
                    {h.comment && (
                      <p
                        className="mt-1 italic"
                        style={{ color: "var(--color-text-tertiary)" }}
                      >
                        {h.comment}
                      </p>
                    )}
                    <span
                      className="text-xs mt-0.5 block"
                      style={{ color: "var(--color-text-disabled)" }}
                    >
                      p.{h.page}
                    </span>
                  </div>
                ))
              )}
              {highlights.length > 3 && (
                <button
                  className="text-xs py-1"
                  style={{
                    color: "var(--color-text-link)",
                    transition: "opacity var(--transition-fast)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = "0.8";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = "1";
                  }}
                >
                  {t.library.k_show_more_highlights.replace("${count}", String(highlights.length - 3))}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── 引用ネットワーク（参照・被引用・レコメンデーション・エクスポート） ── */}
        <CitationNetworkPanel paper={currentPaper} />
      </div>
    </aside>
  );
};
