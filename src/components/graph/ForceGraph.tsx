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
// Canvas フォールバック（react-force-graph-2d ロード失敗時）
// 簡易 Force レイアウトを Canvas で直接描画する
// ============================================================

interface CanvasFallbackProps {
  nodes: GraphNodeExtended[];
  links: GraphLink[];
  width: number;
  height: number;
  selectedNodeId: string | null;
  onNodeClick: (node: GraphNodeExtended) => void;
  onRetry: () => void;
  errorMessage: string;
}

/** 簡易 Force-Directed Layout を Canvas で描画 */
const CanvasFallbackGraph: React.FC<CanvasFallbackProps> = ({
  nodes: inputNodes,
  links: inputLinks,
  width,
  height,
  selectedNodeId,
  onNodeClick,
  onRetry,
  errorMessage,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const positionsRef = useRef<Map<string, { x: number; y: number; vx: number; vy: number }>>(new Map());
  const rafRef = useRef(0);
  const tickRef = useRef(0);

  // ノード位置の初期化
  useEffect(() => {
    const pos = positionsRef.current;
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.35;

    inputNodes.forEach((node, i) => {
      if (!pos.has(node.id)) {
        const angle = (2 * Math.PI * i) / Math.max(inputNodes.length, 1);
        pos.set(node.id, {
          x: cx + radius * Math.cos(angle) + (Math.random() - 0.5) * 30,
          y: cy + radius * Math.sin(angle) + (Math.random() - 0.5) * 30,
          vx: 0,
          vy: 0,
        });
      }
    });
    tickRef.current = 0;
  }, [inputNodes, width, height]);

  // Force シミュレーション + 描画ループ
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || inputNodes.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pos = positionsRef.current;
    const cx = width / 2;
    const cy = height / 2;

    // リンクのソース/ターゲットIDを解決
    const resolvedLinks = inputLinks.map((l) => ({
      source: typeof l.source === "string" ? l.source : (l.source as { id: string }).id,
      target: typeof l.target === "string" ? l.target : (l.target as { id: string }).id,
    }));

    function simulate() {
      const alpha = Math.max(0.01, 1 - tickRef.current / 200);

      // 斥力（ノード間）
      const nodeArr = inputNodes;
      for (let i = 0; i < nodeArr.length; i++) {
        const ni = nodeArr[i];
        if (!ni) continue;
        const a = pos.get(ni.id);
        if (!a) continue;
        for (let j = i + 1; j < nodeArr.length; j++) {
          const nj = nodeArr[j];
          if (!nj) continue;
          const b = pos.get(nj.id);
          if (!b) continue;
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (150 * alpha) / (dist * dist);
          dx *= force;
          dy *= force;
          a.vx += dx;
          a.vy += dy;
          b.vx -= dx;
          b.vy -= dy;
        }
      }

      // 引力（リンク）
      for (const link of resolvedLinks) {
        const a = pos.get(link.source);
        const b = pos.get(link.target);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 80) * 0.005 * alpha;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }

      // 中心引力
      for (const node of nodeArr) {
        const p = pos.get(node.id);
        if (!p) continue;
        p.vx += (cx - p.x) * 0.001 * alpha;
        p.vy += (cy - p.y) * 0.001 * alpha;
        // 減衰 + 位置更新
        p.vx *= 0.9;
        p.vy *= 0.9;
        p.x += p.vx;
        p.y += p.vy;
        // 画面内に収める
        p.x = Math.max(20, Math.min(width - 20, p.x));
        p.y = Math.max(20, Math.min(height - 20, p.y));
      }

      tickRef.current++;
    }

    function draw() {
      if (!ctx) return;
      const bgColor = getCSSVar("--color-bg-primary") || "#ffffff";
      const noteColor = getCSSVar("--color-graph-node-note") || "#6366f1";
      const paperColor = getCSSVar("--color-graph-node-paper") || "#f59e0b";
      const edgeColor = getCSSVar("--color-graph-edge") || "#94a3b8";
      const labelColor = getCSSVar("--color-graph-label") || "#64748b";

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);

      // エッジ描画
      ctx.strokeStyle = edgeColor;
      ctx.lineWidth = 0.8;
      ctx.globalAlpha = 0.4;
      for (const link of resolvedLinks) {
        const a = pos.get(link.source);
        const b = pos.get(link.target);
        if (!a || !b) continue;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // ノード描画
      for (const node of inputNodes) {
        const p = pos.get(node.id);
        if (!p) continue;
        const isSelected = node.id === selectedNodeId;
        const baseSize = node.type === "note" ? 6 : 8;
        const size = baseSize + Math.sqrt(node.linkCount ?? 0) * 2;
        const color = node.type === "note" ? noteColor : paperColor;

        if (isSelected) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 15;
        }

        if (node.type === "note") {
          ctx.beginPath();
          ctx.arc(p.x, p.y, size, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        } else {
          drawHexagon(ctx, p.x, p.y, size);
          ctx.fillStyle = color;
          ctx.fill();
        }

        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;

        // ラベル
        const label = truncateLabel(node.name, 12);
        ctx.font = '10px "Inter", "Hiragino Kaku Gothic ProN", sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = labelColor;
        ctx.globalAlpha = 0.8;
        ctx.fillText(label, p.x, p.y + size + 3);
        ctx.globalAlpha = 1;
      }

      // フォールバック表示のバッジ
      ctx.fillStyle = labelColor;
      ctx.globalAlpha = 0.3;
      ctx.font = '9px "Inter", sans-serif';
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText("Canvas fallback mode", width - 8, height - 8);
      ctx.globalAlpha = 1;
    }

    function loop() {
      simulate();
      draw();
      if (tickRef.current < 300) {
        rafRef.current = requestAnimationFrame(loop);
      }
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [inputNodes, inputLinks, width, height, selectedNodeId]);

  // ノードクリック検出
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const pos = positionsRef.current;

      for (const node of inputNodes) {
        const p = pos.get(node.id);
        if (!p) continue;
        const size = (node.type === "note" ? 6 : 8) + Math.sqrt(node.linkCount ?? 0) * 2 + 4;
        const dx = mx - p.x;
        const dy = my - p.y;
        if (dx * dx + dy * dy <= size * size) {
          onNodeClick(node);
          return;
        }
      }
    },
    [inputNodes, onNodeClick],
  );

  return (
    <div style={{ position: "relative", width, height }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onClick={handleCanvasClick}
        style={{ cursor: "pointer" }}
      />
      <div
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          display: "flex",
          gap: 6,
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: 9,
            color: "var(--color-text-tertiary)",
            opacity: 0.6,
          }}
          title={errorMessage}
        >
          簡易モード
        </span>
        <button
          type="button"
          onClick={onRetry}
          style={{
            fontSize: 10,
            color: "var(--color-accent-primary)",
            background: "transparent",
            border: "1px solid var(--color-accent-primary)",
            borderRadius: 6,
            padding: "2px 8px",
            cursor: "pointer",
          }}
        >
          再試行
        </button>
      </div>
    </div>
  );
};

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

  /**
   * ノードに初期位置を付与する。
   * react-force-graph-2d はデフォルトで全ノードを (0,0) に配置するため、
   * 円形に散らしておかないとシミュレーション初期に全ノードが重なる。
   *
   * 【重要】graphData の参照安定化:
   * react-force-graph-2d は graphData が変わるたびにシミュレーションを
   * リセットするため、ノード ID リストが同じなら同一オブジェクトを返す。
   * シミュレーション中のノードは内部で x/y を書き換えるため、
   * ここでは初期位置の「種」だけ与え、以降は react-force-graph に任せる。
   */
  const prevNodeIdsRef = useRef<string>("");
  const prevGraphDataRef = useRef<{ nodes: GraphNodeExtended[]; links: GraphLink[] } | null>(null);

  const graphData = useMemo(() => {
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.3;
    const n = nodes.length || 1;

    // ノードIDリストのフィンガープリント
    const nodeIdKey = nodes.map((nd) => nd.id).join(",");

    // ノードID構成が同じ場合はプロパティ更新のみ行い、オブジェクト参照を維持する
    // これにより react-force-graph-2d のシミュレーションリセットを防ぐ
    if (prevNodeIdsRef.current === nodeIdKey && prevGraphDataRef.current) {
      const prev = prevGraphDataRef.current;
      // 既存ノードのプロパティ（name, tags等）だけ同期
      const nodeMap = new Map(nodes.map((nd) => [nd.id, nd]));
      for (const existing of prev.nodes) {
        const updated = nodeMap.get(existing.id);
        if (updated) {
          existing.name = updated.name;
          existing.type = updated.type;
          existing.linkCount = updated.linkCount;
          existing.tags = updated.tags;
          existing.updatedAt = updated.updatedAt;
        }
      }
      prev.links = links as GraphLink[];
      return prev;
    }

    // 新しいノード構成 → 初期位置を円形配置して新規作成
    const positioned = (nodes as GraphNodeExtended[]).map((node, i) => {
      const angle = (2 * Math.PI * i) / n;
      return {
        ...node,
        x: cx + radius * Math.cos(angle) + (Math.random() - 0.5) * 20,
        y: cy + radius * Math.sin(angle) + (Math.random() - 0.5) * 20,
      };
    });

    const data = {
      nodes: positioned,
      links: links as GraphLink[],
    };

    prevNodeIdsRef.current = nodeIdKey;
    prevGraphDataRef.current = data;
    return data;
  }, [nodes, links, width, height]);

  /** シミュレーション安定後に zoomToFit する回数制限付きフラグ */
  const hasZoomedRef = useRef(false);
  /** ノードID構成の前回値（Force再設定＋zoomToFitをトリガーする判定用） */
  const prevForceNodeKeyRef = useRef<string>("");

  /** Force シミュレーション設定 */
  useEffect(() => {
    const fg = graphRef.current;
    if (!fg) return;

    // ノードID構成が変わっていない場合は Force 再設定をスキップ
    // （フィルタ以外のプロパティ更新でシミュレーションが暴れるのを防止）
    const nodeKey = nodes.map((nd) => nd.id).sort().join(",");
    const isNewConfig = nodeKey !== prevForceNodeKeyRef.current;
    prevForceNodeKeyRef.current = nodeKey;

    try {
      // 斥力: ノード間を十分に離す（デフォルト -30 では全く足りない）
      const charge = fg.d3Force("charge");
      if (charge && typeof charge === "object" && "strength" in charge) {
        (charge as { strength: (v: number) => void }).strength(-300);
      }

      // リンク距離: ノード間の理想距離
      const link = fg.d3Force("link");
      if (link && typeof link === "object" && "distance" in link) {
        (link as { distance: (v: number) => void }).distance(100);
      }

      // 中心引力
      const center = fg.d3Force("center");
      if (center && typeof center === "object" && "strength" in center) {
        (center as { strength: (v: number) => void }).strength(0.05);
      }
    } catch (e) {
      console.error(t.graph.k_i4xtrj, e);
    }

    // ノード構成が変わった場合のみ zoomToFit を段階的に実行
    if (isNewConfig) {
      hasZoomedRef.current = false;
      const timers = [
        setTimeout(() => {
          try { fg.zoomToFit(400, 60); } catch { /* ignore */ }
        }, 800),
        setTimeout(() => {
          try { fg.zoomToFit(400, 60); } catch { /* ignore */ }
        }, 2000),
        setTimeout(() => {
          if (!hasZoomedRef.current) {
            try { fg.zoomToFit(400, 60); } catch { /* ignore */ }
            hasZoomedRef.current = true;
          }
        }, 4000),
      ];

      return () => timers.forEach(clearTimeout);
    }
  }, [nodes, ForceGraph2D, width, height]);

  /**
   * graphRef を親に公開。
   * ForceGraph2D の ref は最初のレンダリング後にセットされるため、
   * レンダリング完了を検知する onEngineStop / setTimeout で公開する。
   * useEffect の依存に ForceGraph2D だけでは ref がまだ null の場合がある。
   */
  const graphReadyNotifiedRef = useRef(false);

  useEffect(() => {
    graphReadyNotifiedRef.current = false;
  }, [ForceGraph2D]);

  // レンダリング後に ref をチェックして親に通知
  useEffect(() => {
    if (graphReadyNotifiedRef.current) return;
    if (!graphRef.current || !onGraphReady) return;

    // ref がセットされたら即座に通知
    onGraphReady(graphRef.current);
    graphReadyNotifiedRef.current = true;
  });

  /** シミュレーション cooldown 完了時に最終 zoomToFit + graphReady 通知 */
  const handleEngineStop = useCallback(() => {
    if (!hasZoomedRef.current) {
      hasZoomedRef.current = true;
      try {
        graphRef.current?.zoomToFit(400, 60);
      } catch { /* ignore */ }
    }
    // エンジン停止時に ref が確実にセットされているので、ここでも通知
    if (!graphReadyNotifiedRef.current && graphRef.current && onGraphReady) {
      onGraphReady(graphRef.current);
      graphReadyNotifiedRef.current = true;
    }
  }, [onGraphReady]);

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
      _globalScale: number, // eslint-disable-line @typescript-eslint/no-unused-vars
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
      <CanvasFallbackGraph
        nodes={nodes}
        links={links}
        width={width}
        height={height}
        selectedNodeId={selectedNodeId}
        onNodeClick={onNodeClick}
        onRetry={() => setRetryCount((c) => c + 1)}
        errorMessage={loadErr.message}
      />
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
        // warmupTicks: 描画前にシミュレーションを事前実行してノードを散らす
        // cooldownTicks: シミュレーション収束までのティック数
        cooldownTicks={200}
        warmupTicks={100}
        onEngineStop={handleEngineStop}
        minZoom={0.3}
        maxZoom={8}
      />
  );
};
