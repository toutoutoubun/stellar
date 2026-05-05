// src/hooks/useSearch.ts
// Stellar — 全文検索カスタムフック
// debounce 200ms でリアルタイム検索、キーボードナビゲーション、タブフィルタ
// invoke('full_text_search') でRustバックエンドに問い合わせる

import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  SearchTab,
  SearchResultItem,
  GroupedSearchResults,
  RecentItem,
} from "../types";

/** フック戻り値の型 */
interface UseSearchReturn {
  /** 検索クエリ */
  query: string;
  /** クエリ設定 */
  setQuery: (q: string) => void;
  /** アクティブタブ */
  activeTab: SearchTab;
  /** タブ設定 */
  setActiveTab: (tab: SearchTab) => void;
  /** グループ化された検索結果 */
  results: GroupedSearchResults | null;
  /** ローディング状態 */
  isLoading: boolean;
  /** 選択中のインデックス（フラット化した結果配列のインデックス） */
  selectedIndex: number;
  /** 選択インデックス設定 */
  setSelectedIndex: (i: number) => void;
  /** キーボードイベントハンドラ */
  handleKeyDown: (e: React.KeyboardEvent) => void;
  /** 選択中のアイテムを取得 */
  getSelectedItem: () => SearchResultItem | null;
  /** フラット化した結果配列 */
  flatResults: SearchResultItem[];
  /** 最近開いた項目 */
  recentItems: RecentItem[];
  /** 検索リセット */
  reset: () => void;
}

/**
 * GroupedSearchResults から表示対象のアイテムをフラット化して返す
 */
function flattenResults(
  results: GroupedSearchResults | null,
  activeTab: SearchTab,
): SearchResultItem[] {
  if (!results) return [];

  switch (activeTab) {
    case "paper":
      return results.papers;
    case "note":
      return results.notes;
    case "highlight":
      return results.highlights;
    case "all":
    default:
      return [...results.papers, ...results.notes, ...results.highlights];
  }
}

/**
 * Rustの SearchResult を SearchResultItem に変換
 */
/** バックエンドの SearchHit 型 */
interface SearchHit {
  id: string;
  itemType: string;
  title: string;
  snippet: string;
  score: number;
}

/** バックエンドの SearchResults 型（full_text_search の戻り値） */
interface BackendSearchResults {
  papers: SearchHit[];
  notes: SearchHit[];
  highlights: SearchHit[];
}

function hitToItem(hit: SearchHit): SearchResultItem {
  const itemType = hit.itemType as SearchResultItem["itemType"];
  return {
    id: hit.id,
    itemType,
    title: hit.title,
    snippet: hit.snippet,
    meta: "",
    rank: hit.score,
    ...(itemType === "paper" ? { paperId: hit.id } : {}),
    ...(itemType === "note" ? { noteId: hit.id } : {}),
    ...(itemType === "highlight" ? { paperId: hit.id } : {}),
  };
}

/**
 * SearchResult 配列をグループ化
 */
function groupResults(items: SearchResultItem[]): GroupedSearchResults {
  const papers: SearchResultItem[] = [];
  const notes: SearchResultItem[] = [];
  const highlights: SearchResultItem[] = [];

  for (const item of items) {
    switch (item.itemType) {
      case "paper":
        papers.push(item);
        break;
      case "note":
        notes.push(item);
        break;
      case "highlight":
        highlights.push(item);
        break;
    }
  }

  return {
    papers,
    notes,
    highlights,
    total: papers.length + notes.length + highlights.length,
  };
}

export function useSearch(): UseSearchReturn {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SearchTab>("all");
  const [results, setResults] = useState<GroupedSearchResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const abortRef = useRef(0);

  /** 最近開いた項目を取得（初回マウント時） */
  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const items = await invoke<RecentItem[]>("get_recent_items", {
          limit: 8,
        });
        setRecentItems(items);
      } catch {
        // バックエンドにコマンドがない場合は空配列
        setRecentItems([]);
      }
    };
    void fetchRecent();
  }, []);

  /** debounce 付き検索実行 */
  useEffect(() => {
    // 2文字未満はクリア
    if (query.length < 2) {
      setResults(null);
      setSelectedIndex(0);
      return;
    }

    setIsLoading(true);
    const requestId = ++abortRef.current;

    const timer = setTimeout(async () => {
      try {
        // Rustバックエンドの full_text_search を呼び出す
        const data = await invoke<BackendSearchResults>("full_text_search", {
          query,
          itemTypes:
            activeTab === "all" ? null : [activeTab],
          limit: 30,
        });

        // このリクエストが最新か確認（古い結果を破棄）
        if (requestId !== abortRef.current) return;

        const items = [
          ...data.papers.map(hitToItem),
          ...data.notes.map(hitToItem),
          ...data.highlights.map(hitToItem),
        ];
        setResults(groupResults(items));
        setSelectedIndex(0);
      } catch {
        if (requestId !== abortRef.current) return;
        // エラー時は空結果
        setResults({ papers: [], notes: [], highlights: [], total: 0 });
      } finally {
        if (requestId === abortRef.current) {
          setIsLoading(false);
        }
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, activeTab]);

  /** フラット化された結果配列 */
  const flatResults = flattenResults(results, activeTab);

  /** 選択中のアイテムを取得 */
  const getSelectedItem = useCallback((): SearchResultItem | null => {
    if (flatResults.length === 0) return null;
    return flatResults[Math.min(selectedIndex, flatResults.length - 1)] ?? null;
  }, [flatResults, selectedIndex]);

  /** キーボードナビゲーション */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const total = flatResults.length;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, total - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Tab":
          // Tab でタブ切り替え
          if (!e.shiftKey) {
            e.preventDefault();
            const tabs: SearchTab[] = ["all", "paper", "note", "highlight"];
            const currentIdx = tabs.indexOf(activeTab);
            const nextTab = tabs[(currentIdx + 1) % tabs.length] ?? "all";
            setActiveTab(nextTab);
          }
          break;
        // Enter は SearchModal 側で処理
      }
    },
    [flatResults.length, activeTab],
  );

  /** リセット */
  const reset = useCallback(() => {
    setQuery("");
    setActiveTab("all");
    setResults(null);
    setSelectedIndex(0);
  }, []);

  return {
    query,
    setQuery,
    activeTab,
    setActiveTab,
    results,
    isLoading,
    selectedIndex,
    setSelectedIndex,
    handleKeyDown,
    getSelectedItem,
    flatResults,
    recentItems,
    reset,
  };
}
