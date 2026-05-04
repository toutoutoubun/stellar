// src/hooks/useGraphData.ts
// Stellar — グラフデータ管理フック
// invoke('get_graph_data') でRustからデータ取得し、フィルタを適用して返す
// フィルタ変更時はクライアント側で再計算（APIは再コールしない）

import { useState, useEffect, useMemo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  GraphData,
  GraphNode,
  GraphLink,
  GraphNodeExtended,
  GraphFilters,
} from "../types";
import { DEFAULT_GRAPH_FILTERS } from "../types";

/** フック戻り値の型 */
interface UseGraphDataReturn {
  /** 元データ（フィルタ前） */
  rawData: GraphData | null;
  /** フィルタ済みの拡張ノード */
  filteredNodes: GraphNodeExtended[];
  /** フィルタ済みのリンク */
  filteredLinks: GraphLink[];
  /** 読み込み中フラグ */
  isLoading: boolean;
  /** エラー */
  error: string | null;
  /** 選択ノードID */
  selectedNodeId: string | null;
  /** 選択ノードを設定 */
  setSelectedNodeId: (id: string | null) => void;
  /** フィルタ設定 */
  filters: GraphFilters;
  /** フィルタ更新 */
  setFilters: (filters: GraphFilters) => void;
  /** フィルタリセット */
  resetFilters: () => void;
  /** データの再取得 */
  refetch: () => void;
  /** 全タグリスト（フィルタUIで使用） */
  allTags: string[];
  /** フィルタ済みノードIDセット */
  filteredNodeIds: Set<string>;
}

/** ノードごとのリンク数をカウント */
function countLinks(
  links: GraphLink[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const link of links) {
    const src = typeof link.source === "string" ? link.source : (link.source as GraphNode).id;
    const tgt = typeof link.target === "string" ? link.target : (link.target as GraphNode).id;
    counts.set(src, (counts.get(src) ?? 0) + 1);
    counts.set(tgt, (counts.get(tgt) ?? 0) + 1);
  }
  return counts;
}

/** rawGraphNode を拡張ノードに変換する */
function toExtendedNodes(
  nodes: GraphNode[],
  linkCounts: Map<string, number>,
): GraphNodeExtended[] {
  return nodes.map((node) => ({
    ...node,
    linkCount: linkCounts.get(node.id) ?? 0,
    // タグ・updatedAtはRustからのGraphNodeにない場合の安全なデフォルト
    tags: (node as GraphNodeExtended).tags ?? [],
    updatedAt: (node as GraphNodeExtended).updatedAt ?? "",
  }));
}

/** フィルタを適用して表示対象のノードとリンクを算出 */
function applyFilters(
  nodes: GraphNodeExtended[],
  links: GraphLink[],
  filters: GraphFilters,
): { nodes: GraphNodeExtended[]; links: GraphLink[] } {
  let filtered = [...nodes];

  // 1. ノードタイプフィルタ
  if (!filters.showNotes) {
    filtered = filtered.filter((n) => n.type !== "note");
  }
  if (!filters.showPapers) {
    filtered = filtered.filter((n) => n.type !== "paper");
  }

  // 2. タグフィルタ（選択タグを持つノードのみ）
  if (filters.selectedTags.length > 0) {
    const tagSet = new Set(filters.selectedTags);
    filtered = filtered.filter(
      (n) => n.tags.length === 0 || n.tags.some((t) => tagSet.has(t)),
    );
  }

  // 3. 最小リンク数フィルタ
  if (filters.minLinkCount > 0) {
    filtered = filtered.filter((n) => n.linkCount >= filters.minLinkCount);
  }

  // 4. フィルタ後に孤立するエッジを除去
  const nodeIdSet = new Set(filtered.map((n) => n.id));
  const filteredLinks = links.filter((link) => {
    const src = typeof link.source === "string" ? link.source : (link.source as GraphNode).id;
    const tgt = typeof link.target === "string" ? link.target : (link.target as GraphNode).id;
    return nodeIdSet.has(src) && nodeIdSet.has(tgt);
  });

  return { nodes: filtered, links: filteredLinks };
}

export function useGraphData(): UseGraphDataReturn {
  const [rawData, setRawData] = useState<GraphData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [filters, setFilters] = useState<GraphFilters>(DEFAULT_GRAPH_FILTERS);

  /** データ取得 */
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await invoke<GraphData>("get_graph_data");
      setRawData(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初回読み込み
  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  /** リンク数マップ */
  const linkCounts = useMemo(
    () => (rawData ? countLinks(rawData.links) : new Map<string, number>()),
    [rawData],
  );

  /** 拡張ノード（フィルタ前） */
  const extendedNodes = useMemo(
    () => (rawData ? toExtendedNodes(rawData.nodes, linkCounts) : []),
    [rawData, linkCounts],
  );

  /** 全タグリスト */
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const node of extendedNodes) {
      for (const tag of node.tags) {
        tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b, "ja"));
  }, [extendedNodes]);

  /** フィルタ適用結果 */
  const { nodes: filteredNodes, links: filteredLinks } = useMemo(
    () =>
      rawData
        ? applyFilters(extendedNodes, rawData.links, filters)
        : { nodes: [], links: [] },
    [rawData, extendedNodes, filters],
  );

  /** フィルタ済みノードIDセット */
  const filteredNodeIds = useMemo(
    () => new Set(filteredNodes.map((n) => n.id)),
    [filteredNodes],
  );

  /** フィルタリセット */
  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_GRAPH_FILTERS);
  }, []);

  return {
    rawData,
    filteredNodes,
    filteredLinks,
    isLoading,
    error,
    selectedNodeId,
    setSelectedNodeId,
    filters,
    setFilters,
    resetFilters,
    refetch: fetchData,
    allTags,
    filteredNodeIds,
  };
}
