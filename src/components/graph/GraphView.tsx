// src/components/graph/GraphView.tsx
// Stellar — グラフビュー本体
// 全画面キャンバス + 浮遊パネル（凡例 / フィルタ） + ノードポップアップ
// ノートと論文のつながりを Force-Directed Graph として可視化する

import type React from "react";
import { useState, useCallback, useRef, useEffect } from "react";
import type { ForceGraphMethods } from "react-force-graph-2d";
import { useGraphData } from "../../hooks/useGraphData";
import { useUIStore } from "../../stores/useUIStore";
import type { GraphNodeExtended, GraphLink } from "../../types";
import { ForceGraph } from "./ForceGraph";
import { GraphFilterPanel } from "./GraphFilterPanel";
import { GraphLegendPanel } from "./GraphLegendPanel";
import { GraphMiniMap } from "./GraphMiniMap";
import { NodeDetailPopup } from "./NodeDetailPopup";
import { useT } from "../../stores/useI18nStore";

export const GraphView: React.FC = () => {
  const t = useT();
  // グラフデータフック
  const {
    filteredNodes,
    filteredLinks,
    isLoading,
    error,
    selectedNodeId,
    setSelectedNodeId,
    filters,
    setFilters,
    resetFilters,
    refetch,
    allTags,
    rawData,
  } = useGraphData();

  // UI ストア
  const openNote = useUIStore((s) => s.openNote);
  const openPaper = useUIStore((s) => s.openPaper);

  // ローカル状態
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<GraphNodeExtended | null>(
    null,
  );
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const graphMethodsRef = useRef<ForceGraphMethods<
    GraphNodeExtended,
    GraphLink
  > | null>(null);

  /** コンテナサイズの監視 */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerSize({ width, height });
      }
    });

    observer.observe(container);
    // 初期サイズ設定
    setContainerSize({
      width: container.clientWidth,
      height: container.clientHeight,
    });

    return () => observer.disconnect();
  }, []);

  /** マウス位置の追跡（ポップアップ用） */
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  }, []);

  /** ノードクリック → 選択 */
  const handleNodeClick = useCallback(
    (node: GraphNodeExtended) => {
      setSelectedNodeId(
        selectedNodeId === node.id ? null : node.id,
      );
    },
    [selectedNodeId, setSelectedNodeId],
  );

  /** ノードダブルクリック → 遷移 */
  const handleNodeDoubleClick = useCallback(
    (node: GraphNodeExtended) => {
      if (node.type === "note") {
        openNote(node.id);
      } else {
        openPaper(node.id);
      }
    },
    [openNote, openPaper],
  );

  /** ノードホバー */
  const handleNodeHover = useCallback(
    (node: GraphNodeExtended | null) => {
      setHoveredNode(node);
    },
    [],
  );

  /** 背景クリック → 選択解除 */
  const handleBackgroundClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  /** zoomToFit */
  const handleZoomToFit = useCallback(() => {
    graphMethodsRef.current?.zoomToFit(400, 60);
  }, []);

  /** ForceGraph ref 受け取り — ref 取得後に zoomToFit を実行 */
  const handleGraphReady = useCallback(
    (methods: ForceGraphMethods<GraphNodeExtended, GraphLink>) => {
      graphMethodsRef.current = methods;
      // ref が有効になった直後に zoomToFit を段階的に実行
      // シミュレーションが安定するまで複数回試行
      setTimeout(() => {
        try { methods.zoomToFit(400, 60); } catch { /* ignore */ }
      }, 300);
      setTimeout(() => {
        try { methods.zoomToFit(400, 60); } catch { /* ignore */ }
      }, 1200);
    },
    [],
  );

  /** ミニマップからグラフ中心を移動 */
  const handleMiniMapCenterAt = useCallback(
    (x: number, y: number) => {
      graphMethodsRef.current?.centerAt(x, y, 400);
    },
    [],
  );

  /** キーボードショートカット */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC → 選択解除
      if (e.key === "Escape") {
        setSelectedNodeId(null);
      }
      // Ctrl/Cmd + 0 → 全体表示
      if ((e.metaKey || e.ctrlKey) && e.key === "0") {
        e.preventDefault();
        handleZoomToFit();
      }
      // Cmd/Ctrl + A → 全ノード選択（スコープテスト用）
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        // 全ノードの最初のノードを選択状態にする（全選択のインジケータ）
        // 実際の全選択ハイライトは connectedNodeIds が全ノードを含む形で実現
        if (filteredNodes.length > 0) {
          setSelectedNodeId("__all__");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setSelectedNodeId, handleZoomToFit, filteredNodes]);

  // ローディング状態
  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ animation: "spin 1s linear infinite" }}
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <span className="text-sm">{t.graph.k_loading_data}</span>
        </div>
      </div>
    );
  }

  // エラー状態
  if (error) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "var(--color-accent-danger)" }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="text-sm">{t.graph.k_load_failed}</span>
          <button
            type="button"
            onClick={refetch}
            className="text-xs"
            style={{
              color: "var(--color-accent-primary)",
              padding: "6px 16px",
              borderRadius: "8px",
              border: "1px solid var(--color-accent-primary)",
            }}
          >
            {t.graph.k_reload}
          </button>
        </div>
      </div>
    );
  }

  // 空データ
  if (filteredNodes.length === 0 && !isLoading) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        <div className="flex flex-col items-center gap-4">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: 0.35 }}
          >
            <circle cx="12" cy="12" r="3" />
            <circle cx="19" cy="5" r="2" />
            <circle cx="5" cy="5" r="2" />
            <circle cx="5" cy="19" r="2" />
            <circle cx="19" cy="19" r="2" />
            <line x1="14.5" y1="9.5" x2="17.5" y2="6.5" />
            <line x1="9.5" y1="9.5" x2="6.5" y2="6.5" />
            <line x1="9.5" y1="14.5" x2="6.5" y2="17.5" />
            <line x1="14.5" y1="14.5" x2="17.5" y2="17.5" />
          </svg>
          <div className="text-center">
            <p className="text-sm mb-1">{t.graph.k_no_nodes}</p>
            <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
              {t.graph.k_create_links_hint}
            </p>
          </div>
          {rawData && rawData.nodes.length > 0 && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs"
              style={{
                color: "var(--color-accent-primary)",
                padding: "6px 16px",
                borderRadius: "8px",
                border: "1px solid var(--color-accent-primary)",
              }}
            >
              フィルタをリセット
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden"
      onMouseMove={handleMouseMove}
      style={{ backgroundColor: "var(--color-bg-primary)" }}
    >
      {/* グラフキャンバス */}
      {containerSize.width > 0 && containerSize.height > 0 && (
        <ForceGraph
          nodes={filteredNodes}
          links={filteredLinks}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onNodeHover={handleNodeHover}
          onBackgroundClick={handleBackgroundClick}
          selectedNodeId={selectedNodeId}
          width={containerSize.width}
          height={containerSize.height}
          onGraphReady={handleGraphReady}
        />
      )}

      {/* 凡例パネル（左下） */}
      <GraphLegendPanel
        onZoomToFit={handleZoomToFit}
        nodeCount={filteredNodes.length}
        linkCount={filteredLinks.length}
      />

      {/* フィルタパネル（右上） */}
      <GraphFilterPanel
        filters={filters}
        onFiltersChange={setFilters}
        onReset={resetFilters}
        allTags={allTags}
        totalNodes={rawData?.nodes.length ?? 0}
        filteredNodes={filteredNodes.length}
        isOpen={filterPanelOpen}
        onToggle={() => setFilterPanelOpen((p) => !p)}
      />

      {/* ミニマップ（右下） */}
      {filteredNodes.length > 0 && (
        <GraphMiniMap
          nodes={filteredNodes}
          links={filteredLinks}
          selectedNodeId={selectedNodeId}
          width={200}
          height={150}
          onCenterAt={handleMiniMapCenterAt}
        />
      )}

      {/* ノード詳細ポップアップ */}
      <NodeDetailPopup
        node={hoveredNode}
        mouseX={mousePos.x}
        mouseY={mousePos.y}
        containerWidth={containerSize.width}
        containerHeight={containerSize.height}
      />

      {/* 選択中ノード情報バー（下部） */}
      {selectedNodeId && (
        <div
          style={{
            position: "absolute",
            bottom: "12px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 20,
            animation: "fade-in 200ms ease-out both",
          }}
        >
          <div
            className="flex items-center gap-3"
            style={{
              backgroundColor: "var(--color-bg-card)",
              border: "1px solid var(--color-border-primary)",
              borderRadius: "10px",
              boxShadow: "var(--shadow-card)",
              padding: "8px 16px",
              fontSize: "12px",
              color: "var(--color-text-secondary)",
            }}
          >
            <span className="flex items-center gap-1.5">
              {filteredNodes.find((n) => n.id === selectedNodeId)?.type ===
              "note" ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              )}
              {filteredNodes.find((n) => n.id === selectedNodeId)?.name ??
                t.graph.k_lmzev}
            </span>
            <span style={{ color: "var(--color-text-tertiary)" }}>|</span>
            <button
              type="button"
              onClick={() => {
                const node = filteredNodes.find(
                  (n) => n.id === selectedNodeId,
                );
                if (node) handleNodeDoubleClick(node);
              }}
              className="text-xs"
              style={{
                color: "var(--color-accent-primary)",
                cursor: "pointer",
              }}
            >
              開く
            </button>
            <button
              type="button"
              onClick={() => setSelectedNodeId(null)}
              className="text-xs"
              style={{
                color: "var(--color-text-tertiary)",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
