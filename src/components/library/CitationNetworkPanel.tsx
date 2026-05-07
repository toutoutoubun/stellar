// src/components/library/CitationNetworkPanel.tsx
// Stellar — 引用ネットワークパネル（PaperDetailPanel 内セクション）
// 参照文献 / 被引用文献 / レコメンデーション / BibTeX・RIS エクスポート

import type React from "react";
import { useState, useCallback, useEffect } from "react";
import type { Paper, CitationEntry, PaperRecommendation } from "../../types";
import { useCitationStore } from "../../stores/useCitationStore";
import { useLibraryStore } from "../../stores/useLibraryStore";
import { Button } from "../ui/Button";
import { toast } from "../ui/Toast";
import { useT } from "../../stores/useI18nStore";

interface CitationNetworkPanelProps {
  paper: Paper;
}

// ────────────────────────────────────────────
// サブコンポーネント: 引用エントリ行
// ────────────────────────────────────────────

const CitationEntryRow: React.FC<{
  entry: CitationEntry;
  index: number;
}> = ({ entry, index }) => {
  const handleOpenUrl = useCallback(async () => {
    const url = entry.doi
      ? `https://doi.org/${entry.doi}`
      : entry.url;
    if (!url) return;
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(url);
    } catch {
      window.open(url, "_blank");
    }
  }, [entry.doi, entry.url]);

  const hasLink = entry.doi || entry.url;
  const authors = entry.authors.length > 0
    ? entry.authors.length > 2
      ? `${entry.authors[0]} et al.`
      : entry.authors.join(", ")
    : "";

  return (
    <div
      className="flex items-start gap-2 py-1.5 text-xs"
      style={{
        animation: `fade-in 150ms ease-out ${index * 30}ms both`,
      }}
    >
      {/* 番号 */}
      <span
        className="shrink-0 mt-0.5"
        style={{
          color: "var(--color-text-disabled)",
          fontVariantNumeric: "tabular-nums",
          width: "18px",
          textAlign: "right",
        }}
      >
        {index + 1}.
      </span>

      {/* 本体 */}
      <div className="flex-1 min-w-0">
        {/* タイトル */}
        <p
          className="leading-snug"
          style={{
            color: hasLink ? "var(--color-text-link)" : "var(--color-text-secondary)",
            cursor: hasLink ? "pointer" : "default",
            transition: "opacity var(--transition-fast)",
          }}
          onClick={hasLink ? handleOpenUrl : undefined}
          onMouseEnter={(e) => {
            if (hasLink) e.currentTarget.style.opacity = "0.8";
          }}
          onMouseLeave={(e) => {
            if (hasLink) e.currentTarget.style.opacity = "1";
          }}
          title={entry.title}
        >
          {entry.title}
        </p>
        {/* メタ情報 */}
        <p
          className="mt-0.5 truncate"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          {authors}
          {authors && entry.year ? " · " : ""}
          {entry.year ?? ""}
        </p>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────
// サブコンポーネント: レコメンデーション行
// ────────────────────────────────────────────

const RecommendationRow: React.FC<{
  rec: PaperRecommendation;
  paperId: string;
  index: number;
}> = ({ rec, paperId, index }) => {
  const t = useT();
  const [importing, setImporting] = useState(false);
  const importRecommendation = useCitationStore((s) => s.importRecommendation);
  const fetchPapers = useLibraryStore((s) => s.fetchPapers);

  let parsedAuthors: string[];
  try {
    parsedAuthors = JSON.parse(rec.authors);
  } catch {
    parsedAuthors = rec.authors ? [rec.authors] : [];
  }
  const authorsStr = parsedAuthors.length > 2
    ? `${parsedAuthors[0]} et al.`
    : parsedAuthors.join(", ");

  const handleImport = useCallback(async () => {
    setImporting(true);
    try {
      await importRecommendation(rec.id, paperId);
      toast.success(t.citationNetwork.importSuccess);
      // ライブラリを再取得
      void fetchPapers();
    } catch {
      toast.error(t.citationNetwork.importFailed);
    } finally {
      setImporting(false);
    }
  }, [rec.id, paperId, importRecommendation, fetchPapers, t]);

  const handleOpenUrl = useCallback(async () => {
    const url = rec.doi
      ? `https://doi.org/${rec.doi}`
      : rec.url;
    if (!url) return;
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(url);
    } catch {
      window.open(url, "_blank");
    }
  }, [rec.doi, rec.url]);

  const hasLink = rec.doi || rec.url;
  const isImported = rec.isImported === 1;

  return (
    <div
      className="py-2"
      style={{
        borderBottom: "1px solid var(--color-border-secondary)",
        animation: `fade-in 150ms ease-out ${index * 40}ms both`,
      }}
    >
      {/* タイトル */}
      <p
        className="text-xs leading-snug font-medium"
        style={{
          color: hasLink ? "var(--color-text-link)" : "var(--color-text-primary)",
          cursor: hasLink ? "pointer" : "default",
        }}
        onClick={hasLink ? handleOpenUrl : undefined}
        onMouseEnter={(e) => {
          if (hasLink) e.currentTarget.style.opacity = "0.8";
        }}
        onMouseLeave={(e) => {
          if (hasLink) e.currentTarget.style.opacity = "1";
        }}
        title={rec.title}
      >
        {rec.title}
      </p>

      {/* メタ情報 */}
      <p
        className="text-xs mt-0.5 truncate"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        {authorsStr}
        {authorsStr && rec.year ? " · " : ""}
        {rec.year ?? ""}
        {rec.relevanceScore != null && (
          <span style={{ marginLeft: "6px", opacity: 0.7 }}>
            {t.citationNetwork.relevanceScore}: {(rec.relevanceScore * 100).toFixed(0)}%
          </span>
        )}
      </p>

      {/* アブストラクトプレビュー */}
      {rec.abstract && (
        <p
          className="text-xs mt-1"
          style={{
            color: "var(--color-text-tertiary)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            lineHeight: "var(--line-height-relaxed)",
          }}
        >
          {rec.abstract}
        </p>
      )}

      {/* インポートボタン */}
      <div className="mt-1.5">
        {isImported ? (
          <span
            className="inline-flex items-center gap-1 text-xs"
            style={{ color: "rgb(34, 197, 94)" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {t.citationNetwork.imported}
          </span>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            loading={importing}
            icon={
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            }
            onClick={(e) => {
              e.stopPropagation();
              void handleImport();
            }}
            style={{ fontSize: "10px", padding: "2px 6px" }}
          >
            {t.citationNetwork.importToLibrary}
          </Button>
        )}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────
// セクションヘッダー（折りたたみ可能）
// ────────────────────────────────────────────

const SectionHeader: React.FC<{
  title: string;
  count?: number;
  expanded: boolean;
  onToggle: () => void;
  badge?: React.ReactNode;
}> = ({ title, count, expanded, onToggle, badge }) => (
  <button
    className="flex items-center justify-between w-full py-2 text-xs font-semibold uppercase tracking-wide"
    style={{ color: "var(--color-text-tertiary)" }}
    onClick={onToggle}
  >
    <span className="flex items-center gap-2">
      {title}
      {count !== undefined && (
        <span
          className="font-normal"
          style={{ color: "var(--color-text-disabled)" }}
        >
          ({count})
        </span>
      )}
      {badge}
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
    style={{ height: "1px", backgroundColor: "var(--color-border-secondary)" }}
  />
);

// ────────────────────────────────────────────
// メインパネル
// ────────────────────────────────────────────

export const CitationNetworkPanel: React.FC<CitationNetworkPanelProps> = ({
  paper,
}) => {
  const t = useT();

  // ── ストア ──
  const citationData = useCitationStore((s) => s.citationData[paper.id]);
  const fetchingCitation = useCitationStore((s) =>
    s.fetchingCitationIds.has(paper.id)
  );
  const recommendations = useCitationStore(
    (s) => s.recommendations[paper.id]
  );
  const fetchingRecs = useCitationStore((s) =>
    s.fetchingRecommendationIds.has(paper.id)
  );
  const exporting = useCitationStore((s) => s.exporting);
  const fetchCitationNetwork = useCitationStore((s) => s.fetchCitationNetwork);
  const fetchRecommendations = useCitationStore(
    (s) => s.fetchRecommendations
  );
  const getRecommendations = useCitationStore((s) => s.getRecommendations);
  const exportBibtex = useCitationStore((s) => s.exportBibtex);
  const exportRis = useCitationStore((s) => s.exportRis);

  // ── 折りたたみ ──
  const [refsExpanded, setRefsExpanded] = useState(true);
  const [citedByExpanded, setCitedByExpanded] = useState(true);
  const [recsExpanded, setRecsExpanded] = useState(true);
  const [exportExpanded, setExportExpanded] = useState(false);

  // ── 初回マウント時にキャッシュ済みレコメンデーションを取得 ──
  useEffect(() => {
    void getRecommendations(paper.id);
  }, [paper.id, getRecommendations]);

  // ── 引用データ取得 ──
  const handleFetchCitations = useCallback(async () => {
    if (!paper.doi && !paper.url) {
      toast.info(t.citationNetwork.noDoi);
      return;
    }
    try {
      await fetchCitationNetwork(paper.id);
    } catch {
      toast.error(t.citationNetwork.fetchFailed);
    }
  }, [paper.id, paper.doi, paper.url, fetchCitationNetwork, t]);

  // ── レコメンデーション取得 ──
  const handleFetchRecs = useCallback(async () => {
    try {
      await fetchRecommendations(paper.id);
    } catch {
      toast.error(t.citationNetwork.fetchFailed);
    }
  }, [paper.id, fetchRecommendations, t]);

  // ── エクスポート ──
  const handleExport = useCallback(
    async (format: "bibtex" | "ris") => {
      try {
        const result =
          format === "bibtex"
            ? await exportBibtex([paper.id])
            : await exportRis([paper.id]);
        await navigator.clipboard.writeText(result);
        toast.success(t.citationNetwork.copied);
      } catch {
        toast.error(t.citationNetwork.exportFailed);
      }
    },
    [paper.id, exportBibtex, exportRis, t]
  );

  const hasDoi = !!paper.doi || !!paper.url;

  return (
    <div>
      {/* ══════════════════════════════════════
          引用データセクション
          ══════════════════════════════════════ */}
      <Separator />

      {/* 引用データ取得ボタン or キャッシュ情報 */}
      <div className="py-2">
        <div className="flex items-center justify-between">
          <span
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {t.citationNetwork.title}
          </span>
          {citationData?.fetchedAt && (
            <span
              className="text-xs"
              style={{ color: "var(--color-text-disabled)" }}
            >
              {new Date(citationData.fetchedAt).toLocaleDateString()}
            </span>
          )}
        </div>

        {!citationData && (
          <div className="mt-2">
            <Button
              variant="secondary"
              size="sm"
              loading={fetchingCitation}
              disabled={!hasDoi}
              icon={
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                </svg>
              }
              onClick={handleFetchCitations}
            >
              {fetchingCitation
                ? t.citationNetwork.fetchingCitations
                : t.citationNetwork.fetchCitations}
            </Button>
            {!hasDoi && (
              <p
                className="text-xs mt-1"
                style={{ color: "var(--color-text-disabled)" }}
              >
                {t.citationNetwork.noDoi}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── 参照文献 ── */}
      {citationData && (
        <>
          <SectionHeader
            title={t.citationNetwork.references}
            count={citationData.references.length}
            expanded={refsExpanded}
            onToggle={() => setRefsExpanded((v) => !v)}
          />
          {refsExpanded && (
            <div className="flex flex-col">
              {citationData.references.length === 0 ? (
                <p
                  className="text-xs py-1"
                  style={{ color: "var(--color-text-disabled)" }}
                >
                  —
                </p>
              ) : (
                citationData.references.map((entry, i) => (
                  <CitationEntryRow
                    key={entry.ssPaperId ?? `ref-${i}`}
                    entry={entry}
                    index={i}
                  />
                ))
              )}
            </div>
          )}

          <Separator />

          {/* ── 被引用文献 ── */}
          <SectionHeader
            title={t.citationNetwork.citedBy}
            count={citationData.citedBy.length}
            expanded={citedByExpanded}
            onToggle={() => setCitedByExpanded((v) => !v)}
          />
          {citedByExpanded && (
            <div className="flex flex-col">
              {citationData.citedBy.length === 0 ? (
                <p
                  className="text-xs py-1"
                  style={{ color: "var(--color-text-disabled)" }}
                >
                  —
                </p>
              ) : (
                citationData.citedBy.map((entry, i) => (
                  <CitationEntryRow
                    key={entry.ssPaperId ?? `citedby-${i}`}
                    entry={entry}
                    index={i}
                  />
                ))
              )}
            </div>
          )}

          {/* 再取得ボタン */}
          <div className="mt-2 mb-1">
            <Button
              variant="ghost"
              size="sm"
              loading={fetchingCitation}
              onClick={handleFetchCitations}
              style={{ fontSize: "10px", color: "var(--color-text-tertiary)" }}
            >
              {t.citationNetwork.fetchCitations}
            </Button>
          </div>
        </>
      )}

      <Separator />

      {/* ══════════════════════════════════════
          レコメンデーションセクション
          ══════════════════════════════════════ */}
      <SectionHeader
        title={t.citationNetwork.recommendations}
        count={recommendations?.length}
        expanded={recsExpanded}
        onToggle={() => setRecsExpanded((v) => !v)}
      />
      {recsExpanded && (
        <div>
          {/* 取得ボタン */}
          <div className="mb-2">
            <Button
              variant="secondary"
              size="sm"
              loading={fetchingRecs}
              icon={
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              }
              onClick={handleFetchRecs}
            >
              {fetchingRecs
                ? t.citationNetwork.fetchingRecommendations
                : t.citationNetwork.fetchRecommendations}
            </Button>
          </div>

          {/* レコメンデーションリスト */}
          {recommendations && recommendations.length > 0 ? (
            <div className="flex flex-col">
              {recommendations.map((rec, i) => (
                <RecommendationRow
                  key={rec.id}
                  rec={rec}
                  paperId={paper.id}
                  index={i}
                />
              ))}
            </div>
          ) : recommendations && recommendations.length === 0 ? (
            <p
              className="text-xs py-1"
              style={{ color: "var(--color-text-disabled)" }}
            >
              {t.citationNetwork.noRecommendations}
            </p>
          ) : null}
        </div>
      )}

      <Separator />

      {/* ══════════════════════════════════════
          エクスポートセクション
          ══════════════════════════════════════ */}
      <SectionHeader
        title={`${t.citationNetwork.exportBibtex} / ${t.citationNetwork.exportRis}`}
        expanded={exportExpanded}
        onToggle={() => setExportExpanded((v) => !v)}
      />
      {exportExpanded && (
        <div className="flex items-center gap-2 py-1">
          <Button
            variant="secondary"
            size="sm"
            loading={exporting}
            onClick={() => void handleExport("bibtex")}
            style={{ fontSize: "10px" }}
          >
            {t.citationNetwork.exportBibtex}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            loading={exporting}
            onClick={() => void handleExport("ris")}
            style={{ fontSize: "10px" }}
          >
            {t.citationNetwork.exportRis}
          </Button>
        </div>
      )}
    </div>
  );
};
