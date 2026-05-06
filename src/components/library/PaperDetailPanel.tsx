// src/components/library/PaperDetailPanel.tsx
// Stellar — 論文詳細パネル（右コンテキストパネル）
// selectedPaperId が選択されたときに表示される
// タイトル / 著者 / 年 / ジャーナル / DOI / タグ / アブストラクト / 関連ノート / バックリンク / ハイライト

import type React from "react";
import { useState, useCallback, useEffect } from "react";
import type { Paper, Note, Highlight, Link, CitationStyle } from "../../types";
import { CITATION_STYLE_LABELS } from "../../types";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { copyCitationToClipboard } from "../../utils/citation";
import { toast } from "../ui/Toast";
import { invoke } from "@tauri-apps/api/core";

interface PaperDetailPanelProps {
  paper: Paper;
  onClose: () => void;
  onOpenPdf: (paperId: string) => void;
  onDelete: (paperId: string) => void;
  onAttachPdf?: (paperId: string) => void;
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

export const PaperDetailPanel: React.FC<PaperDetailPanelProps> = ({
  paper,
  onClose,
  onOpenPdf,
  onDelete,
  onAttachPdf,
}) => {
  // ── 引用コピーのドロップダウン ──
  const [showCitationDropdown, setShowCitationDropdown] = useState(false);

  // ── セクション折りたたみ ──
  const [abstractExpanded, setAbstractExpanded] = useState(true);
  const [notesExpanded, setNotesExpanded] = useState(true);
  const [backlinksExpanded, setBacklinksExpanded] = useState(true);
  const [highlightsExpanded, setHighlightsExpanded] = useState(true);

  // ── 関連データ（Tauri から取得） ──
  const [relatedNotes, setRelatedNotes] = useState<Note[]>([]);
  const [backlinks, setBacklinks] = useState<Link[]>([]);
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
          invoke<{ items: Note[]; totalPages: number; totalItems: number }>("get_notes", { paperId: paper.id, limit: 1000 }).then(r => r.items).catch(
            () => [] as Note[]
          ),
          invoke<Link[]>("get_backlinks", {
            itemType: "paper",
            itemId: paper.id,
          }).catch(() => [] as Link[]),
          invoke<Highlight[]>("get_highlights", {
            paperId: paper.id,
          }).catch(() => [] as Highlight[]),
        ]);

        if (!cancelled) {
          setRelatedNotes(notes);
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

    return () => {
      cancelled = true;
    };
  }, [paper.id]);

  // ── 引用コピー ──
  const handleCopyCitation = useCallback(
    async (style: CitationStyle) => {
      const success = await copyCitationToClipboard(paper, style);
      if (success) {
        toast.success(
          `${CITATION_STYLE_LABELS[style]} 形式で引用をコピーしました`
        );
      } else {
        toast.error("クリップボードへのコピーに失敗しました");
      }
      setShowCitationDropdown(false);
    },
    [paper]
  );

  // ── DOIをブラウザで開く ──
  const handleOpenDoi = useCallback(async () => {
    if (!paper.doi) return;
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(`https://doi.org/${paper.doi}`);
    } catch {
      // フォールバック: window.open
      window.open(`https://doi.org/${paper.doi}`, "_blank");
    }
  }, [paper.doi]);

  // ── タグ追加（Enter押下） ──
  const handleAddTag = useCallback(
    async (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter") return;
      const tag = newTag.trim();
      if (tag === "" || paper.tags.includes(tag)) {
        setNewTag("");
        setShowTagInput(false);
        return;
      }
      try {
        await invoke("update_paper", {
          id: paper.id,
          input: { tags: [...paper.tags, tag] },
        });
        toast.success(`タグ「${tag}」を追加しました`);
      } catch (err) {
        toast.error(`タグの追加に失敗しました: ${String(err)}`);
      }
      setNewTag("");
      setShowTagInput(false);
    },
    [newTag, paper.id, paper.tags]
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
          論文情報
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
          aria-label="パネルを閉じる"
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
          {paper.title}
        </h2>

        {/* 著者 · 年 · ジャーナル */}
        <p
          className="text-xs mb-1"
          style={{
            color: "var(--color-text-secondary)",
            lineHeight: "var(--line-height-relaxed)",
          }}
        >
          {paper.authors.join(", ") || "著者不明"}
        </p>
        <p
          className="text-xs mb-3"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          {paper.year ?? "年不明"}
          {paper.journal && ` · ${paper.journal}`}
          {paper.volume && `, Vol. ${paper.volume}`}
          {paper.issue && `(${paper.issue})`}
          {paper.pages && `, pp. ${paper.pages}`}
        </p>

        {/* DOI（クリックでブラウザ開く） */}
        {paper.doi && (
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
            title={`https://doi.org/${paper.doi}`}
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
            <span>DOI: {paper.doi}</span>
          </button>
        )}

        {/* アクションボタン群 */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {paper.pdfPath ? (
            <Button
              variant="primary"
              size="sm"
              icon={
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              }
              onClick={() => onOpenPdf(paper.id)}
            >
              PDFを開く
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
              onClick={() => onAttachPdf?.(paper.id)}
            >
              PDFを添付
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
              引用をコピー
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

          <Button
            variant="ghost"
            size="sm"
            icon={
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            }
            onClick={() => onDelete(paper.id)}
            style={{ color: "var(--color-accent-danger)" }}
          >
            削除
          </Button>
        </div>

        <Separator />

        {/* ── タグ ── */}
        <div className="py-2">
          <div className="flex items-center justify-between mb-2">
            <span
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              タグ
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {paper.tags.map((tag) => (
              <Badge key={tag}>{tag}</Badge>
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
                placeholder="タグ名..."
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
                <span>追加</span>
              </button>
            )}
          </div>
        </div>

        <Separator />

        {/* ── アブストラクト（折りたたみ可能） ── */}
        <div className="py-1">
          <SectionHeader
            title="アブストラクト"
            expanded={abstractExpanded}
            onToggle={() => setAbstractExpanded((v) => !v)}
          />
          {abstractExpanded && (
            <div
              className="text-xs leading-relaxed mt-1"
              style={{
                color: paper.abstract
                  ? "var(--color-text-secondary)"
                  : "var(--color-text-disabled)",
                lineHeight: "var(--line-height-relaxed)",
              }}
            >
              {paper.abstract ?? "アブストラクトはありません"}
            </div>
          )}
        </div>

        <Separator />

        {/* ── 関連ノート ── */}
        <div className="py-1">
          <SectionHeader
            title="関連ノート"
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
                    読み込み中...
                  </span>
                </div>
              ) : relatedNotes.length === 0 ? (
                <p
                  className="text-xs py-1"
                  style={{ color: "var(--color-text-disabled)" }}
                >
                  関連するノートはありません
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

        {/* ── バックリンク ── */}
        <div className="py-1">
          <SectionHeader
            title="バックリンク"
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
                    読み込み中...
                  </span>
                </div>
              ) : backlinks.length === 0 ? (
                <p
                  className="text-xs py-1"
                  style={{ color: "var(--color-text-disabled)" }}
                >
                  この論文へのリンクはありません
                </p>
              ) : (
                backlinks.map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs"
                    style={{
                      borderRadius: "var(--radius-button)",
                      color: "var(--color-text-secondary)",
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
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                    <span className="truncate">
                      {link.sourceType === "note" ? "ノート" : "論文"}:{" "}
                      {link.sourceId.slice(0, 8)}...
                    </span>
                    {link.context && (
                      <span
                        className="text-xs truncate"
                        style={{ color: "var(--color-text-disabled)" }}
                      >
                        — {link.context}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* ── ハイライト ── */}
        <div className="py-1">
          <SectionHeader
            title="ハイライト"
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
                    読み込み中...
                  </span>
                </div>
              ) : highlights.length === 0 ? (
                <p
                  className="text-xs py-1"
                  style={{ color: "var(--color-text-disabled)" }}
                >
                  ハイライトはありません
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
                  他 {highlights.length - 3} 件を表示...
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
