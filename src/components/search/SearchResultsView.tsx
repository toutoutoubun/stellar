// src/components/search/SearchResultsView.tsx
// Stellar — 検索結果ビュー（MainPane 内に表示）
// useSearch フックを利用してリアルタイム検索 + タブフィルタ + 結果一覧表示

import type React from "react";
import { useState, useCallback } from "react";
import { useSearch } from "../../hooks/useSearch";
import { useUIStore } from "../../stores/useUIStore";
import { useI18nStore } from "../../stores/useI18nStore";
import { Badge } from "../ui/Badge";
import type { SearchTab, SearchResultItem } from "../../types";

// ============================================================
// ハイライトカラーマップ
// ============================================================

const highlightColorMap: Record<string, string> = {
  yellow: "rgba(250, 204, 21, 0.15)",
  blue: "rgba(59, 130, 246, 0.15)",
  green: "rgba(34, 197, 94, 0.15)",
  pink: "rgba(236, 72, 153, 0.15)",
};

const highlightBorderMap: Record<string, string> = {
  yellow: "#FACC15",
  blue: "#3B82F6",
  green: "#22C55E",
  pink: "#EC4899",
};

// ============================================================
// アイコンコンポーネント
// ============================================================

const PaperIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const NoteIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const HighlightIcon: React.FC<{ size?: number; color?: string }> = ({ size = 16, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="8" fill={color ?? "#EAB308"} opacity="0.85" />
    <circle cx="12" cy="12" r="8" fill="none" stroke={color ?? "#EAB308"} strokeWidth="2" opacity="0.5" />
  </svg>
);

const SearchIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

// ============================================================
// スニペット内の [[match]] をハイライト表示
// ============================================================

const HighlightedSnippet: React.FC<{ text: string }> = ({ text }) => {
  // [[match]] 形式のマッチ箇所をハイライト
  const parts = text.split(/\[\[|\]\]/);
  return (
    <span>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark
            key={i}
            style={{
              backgroundColor: "rgba(250, 204, 21, 0.3)",
              color: "var(--color-text-primary)",
              padding: "0 2px",
              borderRadius: "2px",
            }}
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
};

// ============================================================
// 検索結果アイテム行
// ============================================================

const ResultItem: React.FC<{
  item: SearchResultItem;
  selected: boolean;
  onClick: () => void;
}> = ({ item, selected, onClick }) => {
  const isHighlight = item.itemType === "highlight";

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left flex items-start gap-3 px-4 py-3"
      style={{
        backgroundColor: selected ? "var(--color-bg-hover)" : "transparent",
        border: "none",
        cursor: "pointer",
        transition: "background-color var(--transition-fast)",
        borderBottom: "1px solid var(--color-border-secondary)",
        ...(isHighlight && item.highlightColor
          ? { borderLeft: `3px solid ${highlightBorderMap[item.highlightColor] ?? "#FACC15"}` }
          : {}),
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {/* アイコン */}
      <span className="shrink-0 mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>
        {item.itemType === "paper" ? (
          <PaperIcon size={16} />
        ) : item.itemType === "note" ? (
          <NoteIcon size={16} />
        ) : (
          <HighlightIcon
            size={16}
            color={item.highlightColor ? highlightBorderMap[item.highlightColor] : undefined}
          />
        )}
      </span>

      {/* テキスト */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
          {item.title}
        </div>
        {item.snippet && (
          <div
            className="text-xs mt-0.5 line-clamp-2"
            style={{ color: "var(--color-text-secondary)", lineHeight: "1.5" }}
          >
            <HighlightedSnippet text={item.snippet} />
          </div>
        )}
        {item.meta && (
          <div className="text-[10px] mt-1" style={{ color: "var(--color-text-tertiary)" }}>
            {item.meta}
          </div>
        )}
      </div>

      {/* タイプバッジ */}
      <Badge
        style={{
          fontSize: "10px",
          padding: "1px 6px",
          ...(isHighlight && item.highlightColor
            ? { backgroundColor: highlightColorMap[item.highlightColor] }
            : {}),
        }}
      >
        {item.itemType}
      </Badge>
    </button>
  );
};

// ============================================================
// タブ切替バー
// ============================================================

const TabBar: React.FC<{
  activeTab: SearchTab;
  onTabChange: (tab: SearchTab) => void;
  counts: { all: number; papers: number; notes: number; highlights: number };
}> = ({ activeTab, onTabChange, counts }) => {
  const t = useI18nStore.getState().t;
  const tabs: { id: SearchTab; label: string; count: number }[] = [
    { id: "all", label: t.search.k_tips_title ? "All" : "All", count: counts.all },
    { id: "paper", label: t.settings.data.papers, count: counts.papers },
    { id: "note", label: t.settings.data.notes, count: counts.notes },
    { id: "highlight", label: t.settings.data.highlights, count: counts.highlights },
  ];

  return (
    <div className="flex gap-1 px-4" style={{ borderBottom: "1px solid var(--color-border-secondary)" }}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium"
          style={{
            color: activeTab === tab.id ? "var(--color-accent-primary)" : "var(--color-text-tertiary)",
            borderBottom: activeTab === tab.id ? "2px solid var(--color-accent-primary)" : "2px solid transparent",
            backgroundColor: "transparent",
            border: "none",
            borderBottomWidth: "2px",
            borderBottomStyle: "solid",
            borderBottomColor: activeTab === tab.id ? "var(--color-accent-primary)" : "transparent",
            cursor: "pointer",
            transition: "all var(--transition-fast)",
          }}
        >
          {tab.label}
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full"
            style={{
              backgroundColor: activeTab === tab.id ? "var(--color-accent-primary)" : "var(--color-bg-tertiary)",
              color: activeTab === tab.id ? "var(--color-text-inverse)" : "var(--color-text-tertiary)",
              minWidth: "18px",
              textAlign: "center",
            }}
          >
            {tab.count}
          </span>
        </button>
      ))}
    </div>
  );
};

// ============================================================
// 検索ヒントコンポーネント（検索前の空状態）
// ============================================================

const SearchTips: React.FC = () => {
  const t = useI18nStore.getState().t;
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 select-none" style={{ color: "var(--color-text-tertiary)" }}>
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <div className="text-center">
        <h3 className="text-base font-semibold mb-3" style={{ color: "var(--color-text-secondary)" }}>
          {t.layout.str_ap0rmt}
        </h3>
        <div className="flex flex-col gap-1.5 text-xs" style={{ lineHeight: "1.6" }}>
          <p>{t.search.k_tips_title}</p>
          <p>{t.search.k_tip_shorter}</p>
          <p>{t.search.k_tip_different}</p>
          <p>{t.search.k_tip_all_tab}</p>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// 検索結果なし
// ============================================================

const NoResults: React.FC<{ query: string }> = ({ query }) => {
  const t = useI18nStore.getState().t;
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4" style={{ color: "var(--color-text-tertiary)" }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
        <line x1="8" y1="8" x2="14" y2="14" />
        <line x1="14" y1="8" x2="8" y2="14" />
      </svg>
      <div className="text-center">
        <p className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
          "{query}"
        </p>
        <p className="text-xs mt-1">{t.search.k_tip_shorter}</p>
        <p className="text-xs">{t.search.k_tip_different}</p>
      </div>
    </div>
  );
};

// ============================================================
// メイン検索結果ビュー
// ============================================================

export const SearchResultsView: React.FC = () => {
  const t = useI18nStore.getState().t;
  const openPaper = useUIStore((s) => s.openPaper);
  const openNote = useUIStore((s) => s.openNote);

  const {
    query,
    setQuery,
    activeTab,
    setActiveTab,
    results,
    isLoading,
    flatResults,
  } = useSearch();

  const [selectedIndex, setSelectedIndex] = useState(-1);

  // 検索結果のアイテムをクリック
  const handleItemClick = useCallback(
    (item: SearchResultItem) => {
      switch (item.itemType) {
        case "paper":
          openPaper(item.paperId ?? item.id);
          break;
        case "note":
          openNote(item.noteId ?? item.id);
          break;
        case "highlight":
          if (item.paperId) openPaper(item.paperId);
          break;
      }
    },
    [openPaper, openNote]
  );

  // カウント
  const counts = {
    all: results?.total ?? 0,
    papers: results?.papers.length ?? 0,
    notes: results?.notes.length ?? 0,
    highlights: results?.highlights.length ?? 0,
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: "var(--color-bg-primary)" }}>
      {/* 検索ヘッダー */}
      <div className="shrink-0" style={{ borderBottom: "1px solid var(--color-border-secondary)" }}>
        {/* 検索バー */}
        <div className="flex items-center gap-3 px-4 py-3">
          <span style={{ color: "var(--color-text-tertiary)" }}>
            <SearchIcon size={18} />
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search.k_bu5fmx}
            autoFocus
            className="flex-1 text-sm bg-transparent outline-none"
            style={{
              color: "var(--color-text-primary)",
              border: "none",
            }}
          />
          {isLoading && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ color: "var(--color-text-tertiary)", animation: "spin 1s linear infinite" }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          )}
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="flex items-center justify-center w-5 h-5"
              style={{
                color: "var(--color-text-tertiary)",
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
                borderRadius: "50%",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* タブバー */}
        {results && (
          <TabBar activeTab={activeTab} onTabChange={setActiveTab} counts={counts} />
        )}
      </div>

      {/* 検索結果コンテンツ */}
      <div className="flex-1 overflow-y-auto scrollable-area">
        {/* 検索前の空状態 */}
        {!query && !results && <SearchTips />}

        {/* 検索結果なし */}
        {query && results && flatResults.length === 0 && !isLoading && (
          <NoResults query={query} />
        )}

        {/* 検索結果一覧 */}
        {flatResults.length > 0 && (
          <div className="flex flex-col">
            {flatResults.map((item, index) => (
              <ResultItem
                key={`${item.itemType}-${item.id}`}
                item={item}
                selected={index === selectedIndex}
                onClick={() => {
                  setSelectedIndex(index);
                  handleItemClick(item);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* フッター: 結果件数 */}
      {results && (
        <div
          className="shrink-0 flex items-center justify-between px-4 py-2 text-xs"
          style={{
            borderTop: "1px solid var(--color-border-secondary)",
            color: "var(--color-text-tertiary)",
            backgroundColor: "var(--color-bg-secondary)",
          }}
        >
          <span>{results.total} {t.common.items}</span>
          <span className="flex items-center gap-1.5">
            <kbd
              className="px-1 py-0.5"
              style={{
                backgroundColor: "var(--color-bg-tertiary)",
                borderRadius: "3px",
                border: "1px solid var(--color-border-secondary)",
                fontSize: "10px",
              }}
            >
              Ctrl+K
            </kbd>
            {t.layout.str_ap0rmt}
          </span>
        </div>
      )}
    </div>
  );
};
