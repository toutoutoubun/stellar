// src/components/search/SearchResults.tsx
// Stellar — 検索結果表示コンポーネント
// タブ切り替え + グループ化された結果リスト + 空状態 + 最近開いた項目
// 100件超の結果には @tanstack/react-virtual による仮想スクロールを適用

import type React from "react";
import { useRef, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type {
  SearchTab,
  GroupedSearchResults,
  SearchResultItem,
  RecentItem,
} from "../../types";
import { SearchResultCard } from "./SearchResultItem";
import { IconItemType } from "../ui/Icons";
import { useI18nStore } from "../../stores/useI18nStore";

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
  { key: "all", label: useI18nStore.getState().t.quantResults.str_7bg2u },
  { key: "paper", label: useI18nStore.getState().t.settings.data.papers },
  { key: "note", label: useI18nStore.getState().t.notes.title },
  { key: "highlight", label: useI18nStore.getState().t.settings.data.highlights },
];

/** 仮想スクロールを有効にする閾値 */
const VIRTUAL_SCROLL_THRESHOLD = 100;

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
                  <IconItemType
                    itemType={item.itemType as "paper" | "note"}
                    size={14}
                    style={{ flexShrink: 0 }}
                  />
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
              <p>{useI18nStore.getState().t.search.k_tips_title}</p>
              <p>{useI18nStore.getState().t.search.k_tip_shorter}</p>
              <p>{useI18nStore.getState().t.search.k_tip_different}</p>
              <p>{useI18nStore.getState().t.search.k_tip_all_tab}</p>
            </div>
          </div>
        ) : (
          // 結果あり — 100件超なら仮想スクロール
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
          {useI18nStore.getState().t.common.close}
        </span>
      </div>
    </div>
  );
};

// ============================================================
// 結果リスト（グループ表示 or フラット表示）
// 100件超の場合は仮想スクロールを使用
// ============================================================

interface ResultListProps {
  results: GroupedSearchResults | null;
  flatResults: SearchResultItem[];
  activeTab: SearchTab;
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
  onItemClick: (item: SearchResultItem) => void;
}

/** 仮想スクロール対応のフラットリスト */
const VirtualResultList: React.FC<{
  items: SearchResultItem[];
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
  onItemClick: (item: SearchResultItem) => void;
}> = ({ items, selectedIndex, onSelectedIndexChange, onItemClick }) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56, // 推定行高さ (px)
    overscan: 10,
  });

  // 選択中アイテムが変わったらスクロール追従
  useEffect(() => {
    if (selectedIndex >= 0 && selectedIndex < items.length) {
      virtualizer.scrollToIndex(selectedIndex, { align: "auto" });
    }
  }, [selectedIndex, items.length, virtualizer]);

  return (
    <div
      ref={parentRef}
      style={{
        height: "100%",
        overflow: "auto",
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index];
          if (!item) return null;
          return (
            <div
              key={`${item.itemType}-${item.id}`}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <SearchResultCard
                item={item}
                isSelected={virtualRow.index === selectedIndex}
                onClick={() => onItemClick(item)}
                onMouseEnter={() => onSelectedIndexChange(virtualRow.index)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ResultList: React.FC<ResultListProps> = ({
  results,
  flatResults,
  activeTab,
  selectedIndex,
  onSelectedIndexChange,
  onItemClick,
}) => {
  const useVirtual = flatResults.length > VIRTUAL_SCROLL_THRESHOLD;

  // 「すべて」タブはグループ表示（仮想スクロール閾値以下の場合のみ）
  if (activeTab === "all" && results && !useVirtual) {
    let runningIndex = 0;

    const groups: { label: string; items: SearchResultItem[] }[] = [];
    if (results.papers.length > 0)
      groups.push({ label: useI18nStore.getState().t.search.k_c4sqz, items: results.papers });
    if (results.notes.length > 0)
      groups.push({ label: useI18nStore.getState().t.search.k_nd06pg, items: results.notes });
    if (results.highlights.length > 0)
      groups.push({
        label: useI18nStore.getState().t.search.k_8aeu7e,
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

  // 100件超 → 仮想スクロール
  if (useVirtual) {
    return (
      <VirtualResultList
        items={flatResults}
        selectedIndex={selectedIndex}
        onSelectedIndexChange={onSelectedIndexChange}
        onItemClick={onItemClick}
      />
    );
  }

  // 特定タブ or 100件以下: 通常フラット表示
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
