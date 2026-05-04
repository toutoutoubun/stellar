// src/components/search/SearchResults.tsx
// Stellar — 検索結果表示コンポーネント
// タブ切り替え + グループ化された結果リスト + 空状態 + 最近開いた項目

import type React from "react";
import type {
  SearchTab,
  GroupedSearchResults,
  SearchResultItem,
  RecentItem,
} from "../../types";
import { SearchResultCard } from "./SearchResultItem";

interface SearchResultsProps {
  /** 検索クエリ */
  query: string;
  /** アクティブタブ */
  activeTab: SearchTab;
  /** タブ変更 */
  onTabChange: (tab: SearchTab) => void;
  /** グループ化された検索結果 */
  results: GroupedSearchResults | null;
  /** フラット化された結果（表示順） */
  flatResults: SearchResultItem[];
  /** ローディング中 */
  isLoading: boolean;
  /** 選択中インデックス */
  selectedIndex: number;
  /** 選択インデックス設定 */
  onSelectedIndexChange: (index: number) => void;
  /** アイテムクリック */
  onItemClick: (item: SearchResultItem) => void;
  /** 最近開いた項目 */
  recentItems: RecentItem[];
  /** 最近開いた項目クリック */
  onRecentItemClick: (item: RecentItem) => void;
}

/** タブ定義 */
const TABS: { key: SearchTab; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "paper", label: "論文" },
  { key: "note", label: "ノート" },
  { key: "highlight", label: "ハイライト" },
];

/** タブごとの件数を取得 */
function getTabCount(
  results: GroupedSearchResults | null,
  tab: SearchTab,
): number {
  if (!results) return 0;
  switch (tab) {
    case "paper":
      return results.papers.length;
    case "note":
      return results.notes.length;
    case "highlight":
      return results.highlights.length;
    case "all":
      return results.total;
  }
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  query,
  activeTab,
  onTabChange,
  results,
  flatResults,
  isLoading,
  selectedIndex,
  onSelectedIndexChange,
  onItemClick,
  recentItems,
  onRecentItemClick,
}) => {
  // ── 検索前（空クエリ）: 最近開いた項目を表示 ──
  if (query.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto" style={{ padding: "12px 16px" }}>
        {recentItems.length > 0 ? (
          <>
            <div
              className="text-xs font-semibold uppercase tracking-wider mb-3"
              style={{ color: "var(--color-text-tertiary)", padding: "0 4px" }}
            >
              最近開いた項目
            </div>
            <div className="flex flex-col gap-0.5">
              {recentItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onRecentItemClick(item)}
                  className="w-full text-left flex items-center gap-3"
                  style={{
                    padding: "8px 12px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    border: "none",
                    backgroundColor: "transparent",
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
                  <span style={{ fontSize: "13px" }}>
                    {item.itemType === "paper" ? "📄" : "📝"}
                  </span>
                  <span
                    className="text-sm truncate flex-1"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {item.title}
                  </span>
                  <span
                    className="text-xs shrink-0"
                    style={{ color: "var(--color-text-tertiary)" }}
                  >
                    {item.meta}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div
            className="flex flex-col items-center justify-center py-12 gap-3"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ opacity: 0.4 }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <p className="text-sm">キーワードを入力して検索</p>
          </div>
        )}
      </div>
    );
  }

  // ── 1文字のみ入力: ヒント表示 ──
  if (query.length === 1) {
    return (
      <div
        className="flex items-center justify-center py-12"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        <p className="text-sm">2文字以上入力してください</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* ── タブバー ── */}
      <div
        className="flex items-center gap-1 shrink-0"
        style={{
          padding: "8px 16px",
          borderBottom: "1px solid var(--color-border-secondary)",
        }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const count = getTabCount(results, tab.key);
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              className="text-xs font-medium"
              style={{
                padding: "4px 10px",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                backgroundColor: isActive
                  ? "var(--color-accent-primary)"
                  : "transparent",
                color: isActive
                  ? "var(--color-text-inverse)"
                  : "var(--color-text-secondary)",
                transition: "all var(--transition-fast)",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor =
                    "var(--color-bg-hover)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = "transparent";
                }
              }}
            >
              {tab.label}
              {results && count > 0 && (
                <span
                  className="ml-1"
                  style={{
                    opacity: 0.7,
                    fontSize: "10px",
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── 結果リスト ── */}
      <div
        className="flex-1 overflow-y-auto scrollable-area"
        style={{ padding: "8px 8px" }}
      >
        {isLoading && flatResults.length === 0 ? (
          // ローディング中（初回検索）
          <div
            className="flex items-center justify-center py-12"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ animation: "spin 0.8s linear infinite" }}
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          </div>
        ) : flatResults.length === 0 ? (
          // 結果なし
          <div
            className="flex flex-col items-center justify-center py-12 gap-3"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ opacity: 0.4 }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
            <p className="text-sm">
              &ldquo;{query}&rdquo; の検索結果はありません
            </p>
            <div className="text-xs text-center" style={{ maxWidth: "280px", lineHeight: "1.7" }}>
              <p>検索のコツ:</p>
              <p>・キーワードを短くする</p>
              <p>・別の表現で試す</p>
              <p>・タブを「すべて」にする</p>
            </div>
          </div>
        ) : (
          // 結果あり
          <ResultList
            results={results}
            flatResults={flatResults}
            activeTab={activeTab}
            selectedIndex={selectedIndex}
            onSelectedIndexChange={onSelectedIndexChange}
            onItemClick={onItemClick}
          />
        )}
      </div>

      {/* ── フッター（キーボードヒント） ── */}
      <div
        className="flex items-center gap-4 shrink-0"
        style={{
          padding: "8px 16px",
          borderTop: "1px solid var(--color-border-secondary)",
          color: "var(--color-text-tertiary)",
          fontSize: "11px",
        }}
      >
        <span className="flex items-center gap-1">
          <kbd
            style={{
              padding: "0 4px",
              borderRadius: "3px",
              backgroundColor: "var(--color-bg-tertiary)",
              border: "1px solid var(--color-border-secondary)",
              fontSize: "10px",
              lineHeight: "16px",
            }}
          >
            ↑↓
          </kbd>
          移動
        </span>
        <span className="flex items-center gap-1">
          <kbd
            style={{
              padding: "0 4px",
              borderRadius: "3px",
              backgroundColor: "var(--color-bg-tertiary)",
              border: "1px solid var(--color-border-secondary)",
              fontSize: "10px",
              lineHeight: "16px",
            }}
          >
            Enter
          </kbd>
          開く
        </span>
        <span className="flex items-center gap-1">
          <kbd
            style={{
              padding: "0 4px",
              borderRadius: "3px",
              backgroundColor: "var(--color-bg-tertiary)",
              border: "1px solid var(--color-border-secondary)",
              fontSize: "10px",
              lineHeight: "16px",
            }}
          >
            Esc
          </kbd>
          閉じる
        </span>
      </div>
    </div>
  );
};

// ============================================================
// 結果リスト（グループ表示 or フラット表示）
// ============================================================

interface ResultListProps {
  results: GroupedSearchResults | null;
  flatResults: SearchResultItem[];
  activeTab: SearchTab;
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
  onItemClick: (item: SearchResultItem) => void;
}

const ResultList: React.FC<ResultListProps> = ({
  results,
  flatResults,
  activeTab,
  selectedIndex,
  onSelectedIndexChange,
  onItemClick,
}) => {
  // 「すべて」タブはグループ表示
  if (activeTab === "all" && results) {
    let runningIndex = 0;

    const groups: { label: string; items: SearchResultItem[] }[] = [];
    if (results.papers.length > 0)
      groups.push({ label: `論文 (${results.papers.length}件)`, items: results.papers });
    if (results.notes.length > 0)
      groups.push({ label: `ノート (${results.notes.length}件)`, items: results.notes });
    if (results.highlights.length > 0)
      groups.push({
        label: `ハイライト (${results.highlights.length}件)`,
        items: results.highlights,
      });

    return (
      <div className="flex flex-col gap-2">
        {groups.map((group) => {
          const startIdx = runningIndex;
          runningIndex += group.items.length;
          return (
            <div key={group.label}>
              <div
                className="text-xs font-semibold uppercase tracking-wider mb-1"
                style={{
                  color: "var(--color-text-tertiary)",
                  padding: "4px 16px 2px",
                }}
              >
                {group.label}
              </div>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item, i) => {
                  const globalIdx = startIdx + i;
                  return (
                    <SearchResultCard
                      key={`${item.itemType}-${item.id}`}
                      item={item}
                      isSelected={globalIdx === selectedIndex}
                      onClick={() => onItemClick(item)}
                      onMouseEnter={() => onSelectedIndexChange(globalIdx)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // 特定タブ: フラット表示
  return (
    <div className="flex flex-col gap-0.5">
      {flatResults.map((item, i) => (
        <SearchResultCard
          key={`${item.itemType}-${item.id}`}
          item={item}
          isSelected={i === selectedIndex}
          onClick={() => onItemClick(item)}
          onMouseEnter={() => onSelectedIndexChange(i)}
        />
      ))}
    </div>
  );
};
