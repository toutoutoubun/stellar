// src/components/graph/ForceGraph.tsx
// Stellar — react-force-graph-2d ラッパーコンポーネント
// カスタムノード描画（円 / 六角形）・カスタムエッジ描画（Bezier + 矢印）
// Force シミュレーション設定・ノードドラッグ・ズーム・パン
//
// 【Safari WKWebView 対策】
// react-force-graph-2d を動的 import し、ロード失敗時にフォールバック UI を表示。
// d3-force / d3-color 等の依存が Safari WKWebView (Tauri) のモジュール評価で
// クラッシュする問題に対する防御策。

import type React from "react";
import {
  useRef,
  useCallback,
  useEffect,
  useState,
  useMemo,
} from "react";
import type { ForceGraphMethods } from "react-force-graph-2d";
import type { GraphNodeExtended, GraphLink } from "../../types";
import { useT, useI18nStore } from "../../stores/useI18nStore";

// ============================================================
// ForceGraph2D の動的ロード
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ForceGraph2DComponent = any;

let _cachedForceGraph2D: ForceGraph2DComponent | null = null;
let _loadError: Error | null = null;
let _loadPromise: Promise<ForceGraph2DComponent> | null = null;

/**
 * react-force-graph-2d を動的にロードし、結果をキャッシュする。
 * Safari WKWebView でモジュール評価がクラッシュする場合、
 * エラーを捕捉してフォールバック UI を表示する。
 */
function loadForceGraph2D(): Promise<ForceGraph2DComponent> {

  if (_cachedForceGraph2D) return Promise.resolve(_cachedForceGraph2D);
  if (_loadError) return Promise.reject(_loadError);
  if (_loadPromise) return _loadPromise;

  _loadPromise = import("react-force-graph-2d")
    .then((mod) => {
      _cachedForceGraph2D = mod.default || mod;
      return _cachedForceGraph2D;
    })
    .catch((err) => {
      _loadError = err instanceof Error ? err : new Error(String(err));
      console.error(useI18nStore.getState().t.graph.k_wnpdzs, _loadError);
      throw _loadError;
    });

  return _loadPromise;
}

// ============================================================
// Props
// ============================================================

interface ForceGraphProps {
  /** 表示するノード */
  nodes: GraphNodeExtended[];
  /** 表示するリンク */
  links: GraphLink[];
  /** ノードクリック */
  onNodeClick: (node: GraphNodeExtended) => void;
  /** ノードダブルクリック → 遷移 */
  onNodeDoubleClick: (node: GraphNodeExtended) => void;
  /** ノードホバー */
  onNodeHover: (node: GraphNodeExtended | null, event?: MouseEvent) => void;
  /** 背景クリック */
  onBackgroundClick: () => void;
  /** 選択中ノードID */
  selectedNodeId: string | null;
  /** コンテナ幅 */
  width: number;
  /** コンテナ高さ */
  height: number;
  /** zoomToFit トリガー用コールバック（ref公開） */
  onGraphReady?: (methods: ForceGraphMethods<GraphNodeExtended, GraphLink>) => void;
}

// ============================================================
// テーマ色取得ユーティリティ
// ============================================================

function getCSSVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

/** 六角形のパスを描く */
function drawHexagon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const px = x + size * Math.cos(angle);
    const py = y + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** テキストを指定文字数でtruncate */
function truncateLabel(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}…`;
}

// ============================================================
// コンポーネント
// ============================================================

export const ForceGraph: React.FC<ForceGraphProps> = ({
  nodes,
  links,
  onNodeClick,
  onNodeDoubleClick,
  onNodeHover,
  onBackgroundClick,
  selectedNodeId,
  width,
  height,
  onGraphReady,
}) => {
  const t = useT();
  const graphRef = useRef<ForceGraphMethods<GraphNodeExtended, GraphLink>>(undefined);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const lastClickRef = useRef<{ nodeId: string; time: number } | null>(null);

  // 動的ロード状態
  const [ForceGraph2D, setForceGraph2D] = useState<ForceGraph2DComponent | null>(
    () => _cachedForceGraph2D, // 既にキャッシュされていれば即利用
  );
  const [loadErr, setLoadErr] = useState<Error | null>(() => _loadError);
  const [retryCount, setRetryCount] = useState(0);

  // 動的 import 実行
  useEffect(() => {
    if (ForceGraph2D) return; // 既にロード済み
    if (_loadError && retryCount === 0) return; // 前回エラーでリトライなし

    // リトライ時はキャッシュをクリア
    if (retryCount > 0) {
      _cachedForceGraph2D = null;
      _loadError = null;
      _loadPromise = null;
    }

    let cancelled = false;
    loadForceGraph2D()
      .then((comp) => {
        if (!cancelled) {
          setForceGraph2D(() => comp);
          setLoadErr(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadErr(err instanceof Error ? err : new Error(String(err)));
        }
      });

    return () => { cancelled = true; };
  }, [ForceGraph2D, retryCount]);

  /** 選択ノードに接続しているノードIDセット */
  const connectedNodeIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>([] as string[]);
    // Cmd+A 全選択モード
    if (selectedNodeId === "__all__") {
      return new Set(nodes.map((n) => n.id));
    }
    const ids = new Set<string>([] as string[]);
    ids.add(selectedNodeId);
    for (const link of links) {
      const src = typeof link.source === "string" ? link.source : (link.source as { id: string }).id;
      const tgt = typeof link.target === "string" ? link.target : (link.target as { id: string }).id;
      if (src === selectedNodeId) ids.add(tgt);
      if (tgt === selectedNodeId) ids.add(src);
    }
    return ids;
  }, [selectedNodeId, links, nodes]);

  /** グラフデータ（react-force-graph形式） */
  const graphData = useMemo(
    () => ({
      nodes: nodes as GraphNodeExtended[],
      links: links as GraphLink[],
    }),
    [nodes, links],
  );

  /** Force シミュレーション設定 */
  useEffect(() => {
    const fg = graphRef.current;
    if (!fg) return;

    try {
      const charge = fg.d3Force("charge");
      if (charge && typeof charge === "object" && "strength" in charge) {
        (charge as { strength: (v: number) => void }).strength(-150);
      }

      const link = fg.d3Force("link");
      if (link && typeof link === "object" && "distance" in link) {
        (link as { distance: (v: number) => void }).distance(80);
      }
    } catch (e) {
      console.error(t.graph.k_i4xtrj, e);
    }

    // 初回レンダリング後にフィット表示
    setTimeout(() => {
      try {
        fg.zoomToFit(400, 60);
      } catch (e) {
        console.error(t.graph.k_6u2gub, e);
      }
    }, 500);
  }, [nodes.length, ForceGraph2D]);

  /** graphRef を親に公開 */
  useEffect(() => {
    if (graphRef.current && onGraphReady) {
      onGraphReady(graphRef.current);
    }
  }, [onGraphReady, ForceGraph2D]);

  /** カスタムノード描画 */
  const nodeCanvasObject = useCallback(
    (
      node: GraphNodeExtended,
      ctx: CanvasRenderingContext2D,
      globalScale: number,
    ) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const linkCount = node.linkCount ?? 0;
      const isSelected = node.id === selectedNodeId;
      const isHovered = node.id === hoveredNodeId;
      const isConnected = connectedNodeIds.has(node.id);
      const isFiltered = selectedNodeId != null && !isConnected;

      // 色取得
      const noteColor = getCSSVar("--color-graph-node-note");
      const paperColor = getCSSVar("--color-graph-node-paper");
      const labelColor = getCSSVar("--color-graph-label");
      const color = node.type === "note" ? noteColor : paperColor;

      // サイズ計算
      const baseSize = node.type === "note" ? 6 : 8;
      const size = baseSize + Math.sqrt(linkCount) * 2;
      const renderSize = isHovered ? size * 1.3 : size;

      // 透過度
      const alpha = isFiltered ? 0.15 : 1;
      ctx.globalAlpha = alpha;

      // 選択時グロウ
      if (isSelected) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 20;
      } else {
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
      }

      // ノード描画
      if (node.type === "note") {
        // 円
        ctx.beginPath();
        ctx.arc(x, y, renderSize, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();

        // 枠線（選択時）
        if (isSelected || isHovered) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      } else {
        // 六角形
        drawHexagon(ctx, x, y, renderSize);
        ctx.fillStyle = color;
        ctx.fill();

        if (isSelected || isHovered) {
          drawHexagon(ctx, x, y, renderSize);
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // シャドウリセット
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;

      // ラベル表示の最適化:
      // ノード数が300を超える場合はズーム > 1.5 のときのみラベルを表示
      // それ以外は globalScale > 0.7 で表示
      const nodeCount = nodes.length;
      const showLabel =
        isHovered ||
        isSelected ||
        (nodeCount > 300 ? globalScale > 1.5 : globalScale > 0.7);

      if (showLabel) {
        const label = truncateLabel(node.name, 10);
        const fontSize = Math.max(9 / globalScale, 3);
        ctx.font = `${fontSize}px "Inter", "Hiragino Kaku Gothic ProN", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = labelColor;
        ctx.globalAlpha = isFiltered ? 0.1 : 0.85;
        ctx.fillText(label, x, y + renderSize + 3);
      }

      ctx.globalAlpha = 1;
    },
    [selectedNodeId, hoveredNodeId, connectedNodeIds, nodes.length],
  );

  /** ノードのヒットエリア描画 */
  const nodePointerAreaPaint = useCallback(
    (
      node: GraphNodeExtended,
      paintColor: string,
      ctx: CanvasRenderingContext2D,
    ) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const linkCount = node.linkCount ?? 0;
      const baseSize = node.type === "note" ? 6 : 8;
      const size = baseSize + Math.sqrt(linkCount) * 2 + 4; // 少し大きめ

      ctx.beginPath();
      ctx.arc(x, y, size, 0, 2 * Math.PI);
      ctx.fillStyle = paintColor;
      ctx.fill();
    },
    [],
  );

  /** カスタムリンク描画 */
  const linkCanvasObject = useCallback(
    (
      link: GraphLink,
      ctx: CanvasRenderingContext2D,
      _globalScale: number,
    ) => {
      const sourceNode = link.source as unknown as GraphNodeExtended;
      const targetNode = link.target as unknown as GraphNodeExtended;
      if (!sourceNode?.x || !targetNode?.x) return;

      const sx = sourceNode.x;
      const sy = sourceNode.y ?? 0;
      const tx = targetNode.x;
      const ty = targetNode.y ?? 0;

      const edgeColor = getCSSVar("--color-graph-edge");
      const accentColor = getCSSVar("--color-accent-primary");

      // 選択ノードに接続するエッジか判定
      const isHighlighted =
        selectedNodeId != null &&
        (sourceNode.id === selectedNodeId ||
          targetNode.id === selectedNodeId);
      const isFiltered = selectedNodeId != null && !isHighlighted;

      // Bezier 制御点（中点から垂直方向に20pxオフセット）
      const mx = (sx + tx) / 2;
      const my = (sy + ty) / 2;
      const dx = tx - sx;
      const dy = ty - sy;
      const len = Math.sqrt(dx * dx + dy * dy);
      const offset = Math.min(20, len * 0.15);
      // 垂直方向（法線）にオフセット
      const nx = len > 0 ? -dy / len : 0;
      const ny = len > 0 ? dx / len : 0;
      const cpx = mx + nx * offset;
      const cpy = my + ny * offset;

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(cpx, cpy, tx, ty);

      if (isHighlighted) {
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.8;
      } else if (isFiltered) {
        ctx.strokeStyle = edgeColor;
        ctx.lineWidth = 0.8;
        ctx.globalAlpha = 0.2;
      } else {
        ctx.strokeStyle = edgeColor;
        ctx.lineWidth = 0.8;
        ctx.globalAlpha = 0.5;
      }

      ctx.stroke();

      // 矢印（エッジの終点に三角形）
      if (isHighlighted || !isFiltered) {
        const arrowLen = isHighlighted ? 5 : 3.5;
        const angle = Math.atan2(ty - cpy, tx - cpx);
        const targetSize =
          targetNode.type === "note"
            ? 6 + Math.sqrt(targetNode.linkCount ?? 0) * 2
            : 8 + Math.sqrt(targetNode.linkCount ?? 0) * 2;
        // 矢印をノード境界に配置
        const ax = tx - Math.cos(angle) * (targetSize + 2);
        const ay = ty - Math.sin(angle) * (targetSize + 2);

        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(
          ax - arrowLen * Math.cos(angle - Math.PI / 6),
          ay - arrowLen * Math.sin(angle - Math.PI / 6),
        );
        ctx.lineTo(
          ax - arrowLen * Math.cos(angle + Math.PI / 6),
          ay - arrowLen * Math.sin(angle + Math.PI / 6),
        );
        ctx.closePath();
        ctx.fillStyle = isHighlighted ? accentColor : edgeColor;
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    },
    [selectedNodeId],
  );

  /** ノードホバーハンドラ */
  const handleNodeHover = useCallback(
    (node: GraphNodeExtended | null) => {
      setHoveredNodeId(node?.id ?? null);
      onNodeHover(node);
    },
    [onNodeHover],
  );

  /** ノードドラッグ終了 → 位置固定 */
  const handleNodeDragEnd = useCallback(
    (node: GraphNodeExtended) => {
      node.fx = node.x;
      node.fy = node.y;
    },
    [],
  );

  /** ノードダブルクリック → 固定解除 or 遷移 */
  const handleNodeDoubleClick = useCallback(
    (node: GraphNodeExtended) => {
      // ノードが手動で固定されている場合は解除
      if (node.fx != null || node.fy != null) {
        node.fx = undefined;
        node.fy = undefined;
        // シミュレーションを再加熱して自然な位置に戻す
        graphRef.current?.d3ReheatSimulation();
      } else {
        // 固定されていなければ遷移
        onNodeDoubleClick(node);
      }
    },
    [onNodeDoubleClick],
  );

  // ── ロード中 / エラー時のフォールバック ──

  if (loadErr) {
    return (
      <div
        className="flex items-center justify-center"
        style={{
          width,
          height,
          color: "var(--color-text-tertiary)",
          backgroundColor: "var(--color-bg-primary)",
        }}
      >
        <div className="flex flex-col items-center gap-3">
          <svg
            width="36" height="36" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5"
            style={{ color: "var(--color-accent-danger)", opacity: 0.6 }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-xs" style={{ maxWidth: 280, textAlign: "center" }}>
            グラフエンジンの初期化に失敗しました
          </p>
          <p
            className="text-xs"
            style={{ color: "var(--color-text-tertiary)", maxWidth: 320, textAlign: "center", fontSize: 10 }}
          >
            {loadErr.message}
          </p>
          <button
            type="button"
            onClick={() => setRetryCount((c) => c + 1)}
            className="text-xs"
            style={{
              color: "var(--color-accent-primary)",
              padding: "6px 16px",
              borderRadius: "8px",
              border: "1px solid var(--color-accent-primary)",
              cursor: "pointer",
              background: "transparent",
            }}
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  if (!ForceGraph2D) {
    return (
      <div
        className="flex items-center justify-center"
        style={{
          width,
          height,
          color: "var(--color-text-tertiary)",
          backgroundColor: "var(--color-bg-primary)",
        }}
      >
        <div className="flex flex-col items-center gap-3">
          <svg
            width="28" height="28" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2"
            style={{ animation: "spin 1s linear infinite" }}
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <span className="text-xs">{useI18nStore.getState().t.graph.k_loading_engine}</span>
        </div>
      </div>
    );
  }

  const bgColor = getCSSVar("--color-bg-primary") || "#ffffff";

  return (
      <ForceGraph2D
        ref={graphRef as React.MutableRefObject<ForceGraphMethods<GraphNodeExtended, GraphLink> | undefined>}
        graphData={graphData}
        width={width}
        height={height}
        backgroundColor={bgColor}
        // ノード
        nodeId="id"
        nodeCanvasObject={nodeCanvasObject}
        nodeCanvasObjectMode={() => "replace"}
        nodePointerAreaPaint={nodePointerAreaPaint}
        // リンク
        linkCanvasObject={linkCanvasObject}
        linkCanvasObjectMode={() => "replace"}
        // インタラクション
        onNodeClick={(node: GraphNodeExtended) => {
          const now = Date.now();
          const n = node as GraphNodeExtended;
          const last = lastClickRef.current;
          if (last && last.nodeId === n.id && now - last.time < 400) {
            // ダブルクリック検出
            lastClickRef.current = null;
            handleNodeDoubleClick(n);
          } else {
            lastClickRef.current = { nodeId: n.id, time: now };
            onNodeClick(n);
          }
        }}
        onNodeHover={(node: GraphNodeExtended | null) => handleNodeHover(node as GraphNodeExtended | null)}
        onNodeDragEnd={(node: GraphNodeExtended) => handleNodeDragEnd(node as GraphNodeExtended)}
        onBackgroundClick={onBackgroundClick}
        enableNodeDrag
        enableZoomInteraction
        enablePanInteraction
        // パフォーマンス
        cooldownTicks={100}
        warmupTicks={30}
        minZoom={0.3}
        maxZoom={8}
      />
  );
};
