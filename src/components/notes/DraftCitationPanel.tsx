// src/components/notes/DraftCitationPanel.tsx
// Stellar — 草稿引用管理パネル（右サイドタブ）
// 論文検索 → 引用挿入（ページ参照ポップオーバー付き）+ 参考文献リスト表示

import type React from "react";
import { useState, useCallback, useEffect, useMemo } from "react";
import { invoke } from "../../lib/tauriShim";
import type { DraftCitation, Paper } from "../../types";
import { toast } from "../ui/Toast";
import { useT } from "../../stores/useI18nStore";

interface DraftCitationPanelProps {
  noteId: string;
  citationStyle: string;
}

export const DraftCitationPanel: React.FC<DraftCitationPanelProps> = ({
  noteId,
  citationStyle,
}) => {
  const t = useT();
  const [citations, setCitations] = useState<DraftCitation[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [pageRefOpen, setPageRefOpen] = useState<string | null>(null);
  const [pageRefValue, setPageRefValue] = useState("");

  /** 引用一覧とペーパー一覧を取得 */
  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [cites, paperResult] = await Promise.all([
          invoke<DraftCitation[]>("get_citations_for_note", { noteId }),
          invoke<{ items: Paper[] }>("get_papers", {}),
        ]);
        if (!cancelled) {
          setCitations(cites);
          setPapers(paperResult.items ?? []);
        }
      } catch {
        // 静かに処理
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchData();
    return () => { cancelled = true; };
  }, [noteId]);

  /** 検索フィルタ済みの論文リスト */
  const filteredPapers = useMemo(() => {
    if (!search.trim()) return papers;
    const q = search.toLowerCase();
    return papers.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.authors.some((a) => a.toLowerCase().includes(q)),
    );
  }, [papers, search]);

  /** 引用を挿入 */
  const handleInsertCitation = useCallback(
    async (paperId: string, pageRef?: string) => {
      try {
        const result = await invoke<DraftCitation | null>("insert_citation", {
          noteId,
          paperId,
          citationStyle,
          pageRef: pageRef || null,
        });
        if (result && result.id) {
          setCitations((prev) => [...prev, result]);
          toast.success(t.draftMode.citationInserted);
        } else {
          // mock が null を返した場合（論文が見つからない等）
          toast.error(t.draftMode.citationInsertFailed);
        }
      } catch {
        toast.error(t.draftMode.citationInsertFailed);
      }
      setPageRefOpen(null);
      setPageRefValue("");
    },
    [noteId, citationStyle, t],
  );

  /** 引用を削除 */
  const handleDeleteCitation = useCallback(
    async (citationId: string) => {
      try {
        await invoke("delete_citation", { id: citationId });
        setCitations((prev) => prev.filter((c) => c.id !== citationId));
        toast.success(t.draftMode.citationDeleted);
      } catch {
        toast.error(t.draftMode.citationDeleteFailed);
      }
    },
    [t],
  );

  /** 参考文献リストを生成 */
  const handleGenerateBibliography = useCallback(async () => {
    try {
      const bib = await invoke<string>("generate_bibliography", {
        noteId,
        style: citationStyle,
      });
      if (bib) {
        await navigator.clipboard.writeText(bib);
        toast.success(t.draftMode.bibliographyGenerated);
      }
    } catch {
      toast.error(t.draftMode.bibliographyFailed);
    }
  }, [noteId, citationStyle, t]);

  /** 著者名の短縮表示 */
  const shortAuthors = (authors: string[]): string => {
    if (authors.length === 0) return "";
    if (authors.length === 1) return authors[0] ?? "";
    return `${authors[0] ?? ""} et al.`;
  };

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-32"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        <span className="text-xs">{t.draftMode.citations}...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 論文検索セクション */}
      <div
        className="shrink-0 p-3"
        style={{ borderBottom: "1px solid var(--color-border-secondary)" }}
      >
        <h4
          className="text-xs font-semibold uppercase tracking-wider mb-2"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {t.draftMode.insertCitation}
        </h4>
        <div
          className="flex items-center gap-2"
          style={{
            backgroundColor: "var(--color-bg-tertiary)",
            borderRadius: "8px",
            padding: "5px 8px",
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
            style={{ color: "var(--color-text-tertiary)", flexShrink: 0 }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.draftMode.searchPapers}
            className="flex-1 text-xs"
            style={{
              backgroundColor: "transparent",
              color: "var(--color-text-primary)",
              border: "none",
              outline: "none",
            }}
          />
        </div>

        {/* 論文リスト（最大5件表示） */}
        <div
          className="flex flex-col gap-0.5 mt-2"
          style={{ maxHeight: "180px", overflowY: "auto" }}
        >
          {filteredPapers.slice(0, 8).map((paper) => (
            <div
              key={paper.id}
              className="flex items-center gap-1.5 relative"
              style={{
                padding: "5px 6px",
                borderRadius: "6px",
                transition: "background-color 120ms ease-out",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              {/* 論文アイコン */}
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "var(--color-text-tertiary)", flexShrink: 0 }}
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>

              {/* タイトル */}
              <div className="flex-1 min-w-0">
                <p
                  className="text-xs truncate"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {paper.title}
                </p>
                <p
                  className="text-xs truncate"
                  style={{ color: "var(--color-text-tertiary)", fontSize: "10px" }}
                >
                  {shortAuthors(paper.authors)}
                  {paper.year ? ` (${paper.year})` : ""}
                </p>
              </div>

              {/* 引用ボタン */}
              {pageRefOpen === paper.id ? (
                <div
                  className="flex items-center gap-1 shrink-0"
                  style={{
                    backgroundColor: "var(--color-bg-secondary)",
                    border: "1px solid var(--color-border-secondary)",
                    borderRadius: "6px",
                    padding: "2px 4px",
                  }}
                >
                  <input
                    type="text"
                    value={pageRefValue}
                    onChange={(e) => setPageRefValue(e.target.value)}
                    placeholder={t.draftMode.pageRefPlaceholder}
                    autoFocus
                    className="text-xs"
                    style={{
                      width: "60px",
                      backgroundColor: "transparent",
                      color: "var(--color-text-primary)",
                      border: "none",
                      outline: "none",
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        void handleInsertCitation(paper.id, pageRefValue);
                      }
                      if (e.key === "Escape") {
                        setPageRefOpen(null);
                        setPageRefValue("");
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => void handleInsertCitation(paper.id, pageRefValue)}
                    className="text-xs shrink-0"
                    style={{
                      color: "var(--color-accent-primary)",
                      padding: "1px 4px",
                      borderRadius: "4px",
                      fontSize: "10px",
                    }}
                  >
                    OK
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setPageRefOpen(paper.id);
                    setPageRefValue("");
                  }}
                  className="text-xs shrink-0"
                  style={{
                    color: "var(--color-accent-primary)",
                    padding: "2px 8px",
                    borderRadius: "6px",
                    border: "1px solid var(--color-accent-primary)",
                    fontSize: "10px",
                    transition: "all 120ms ease-out",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--color-accent-primary)";
                    e.currentTarget.style.color = "#fff";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "var(--color-accent-primary)";
                  }}
                >
                  {t.draftMode.cite}
                </button>
              )}
            </div>
          ))}
          {filteredPapers.length === 0 && (
            <p
              className="text-xs text-center py-2"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {t.notes.noResults}
            </p>
          )}
        </div>
      </div>

      {/* 引用リストセクション */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex items-center justify-between mb-2">
          <h4
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {t.draftMode.bibliographyText} ({citations.length})
          </h4>
        </div>

        {citations.length === 0 ? (
          <p
            className="text-xs text-center py-4"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {t.draftMode.noCitations}
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {citations.map((cite) => (
              <div
                key={cite.id}
                className="flex items-start gap-1.5 group"
                style={{
                  padding: "6px 8px",
                  borderRadius: "8px",
                  border: "1px solid var(--color-border-secondary)",
                  backgroundColor: "var(--color-bg-primary)",
                }}
              >
                {/* 引用キーバッジ */}
                <span
                  className="text-xs shrink-0"
                  style={{
                    backgroundColor: "var(--color-accent-primary)",
                    color: "#fff",
                    padding: "1px 6px",
                    borderRadius: "999px",
                    fontSize: "9px",
                    fontWeight: 600,
                    marginTop: "2px",
                  }}
                >
                  {cite.citationKey}
                </span>

                {/* 引用テキスト */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-xs"
                    style={{
                      color: "var(--color-text-primary)",
                      lineHeight: "1.5",
                      wordBreak: "break-word",
                    }}
                  >
                    {cite.inlineText}
                  </p>
                  {cite.pageRef && (
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: "var(--color-text-tertiary)", fontSize: "10px" }}
                    >
                      {cite.pageRef}
                    </p>
                  )}
                </div>

                {/* 削除ボタン */}
                <button
                  type="button"
                  onClick={() => void handleDeleteCitation(cite.id)}
                  className="opacity-0 group-hover:opacity-100 shrink-0"
                  style={{
                    color: "var(--color-text-disabled)",
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
                  title={t.draftMode.deleteCitation}
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

      {/* 参考文献生成ボタン */}
      {citations.length > 0 && (
        <div
          className="shrink-0 p-3"
          style={{ borderTop: "1px solid var(--color-border-secondary)" }}
        >
          <button
            type="button"
            onClick={() => void handleGenerateBibliography()}
            className="flex items-center justify-center gap-1.5 w-full text-xs"
            style={{
              color: "var(--color-accent-primary)",
              padding: "7px 12px",
              borderRadius: "8px",
              border: "1px solid var(--color-accent-primary)",
              transition: "all 150ms ease-out",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-accent-primary)";
              e.currentTarget.style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--color-accent-primary)";
            }}
          >
            {/* 書類アイコン */}
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
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            {t.draftMode.generateBibliography}
          </button>
        </div>
      )}
    </div>
  );
};
