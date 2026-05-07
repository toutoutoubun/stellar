// src/components/quantitative/results/NetworkAnalysisView.tsx
// Stellar — ネットワーク分析結果ビュー
// Left: react-force-graph-2d with controls
// Right 300px: Global metrics, Top nodes table, Community list

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  memo,
} from "react";
import type { Analysis, Variable, DataRow } from "../../../types";
import type { NetworkAnalysisResult } from "../../../lib/stats/types";
import { useI18nStore } from "../../../stores/useI18nStore";

// ── Force graph dynamic loader ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FG2D = any;
let _fg: FG2D | null = null;
let _fgErr: Error | null = null;
let _fgP: Promise<FG2D> | null = null;
function loadFG(): Promise<FG2D> {

  if (_fg) return Promise.resolve(_fg);
  if (_fgErr) return Promise.reject(_fgErr);
  if (_fgP) return _fgP;
  _fgP = import("react-force-graph-2d")
    .then((m) => { _fg = m.default || m; return _fg; })
    .catch((e) => { _fgErr = e instanceof Error ? e : new Error(String(e)); throw _fgErr; });
  return _fgP;
}

// ── Community fallback colors ──
const COMM_COLORS = [
  "#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f",
  "#edc948", "#b07aa1", "#ff9da7", "#9c755f", "#bab0ac",
  "#4dc9f6", "#8b5cf6",
];

function resolveColor(c: string, idx: number): string {
  return c.startsWith("var(") ? COMM_COLORS[idx % COMM_COLORS.length]! : c;
}

function fmt(v: number, dp = 4): string {
  if (!Number.isFinite(v)) return "—";
  return v.toFixed(dp);
}

function getCSSVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// ── Props ──
interface Props {
  analysis: Analysis;
  variables: Variable[];
  dataRows: DataRow[];
}

// ====================================================================
// Main component
// ====================================================================
export const NetworkAnalysisView: React.FC<Props> = ({ analysis }) => {
  // Extract network result
  const network: NetworkAnalysisResult | null = useMemo(() => {
    const r = analysis.result as Record<string, unknown> | null;
    if (!r) return null;
    // Direct network result
    if (r.nodes && r.edges) return r as unknown as NetworkAnalysisResult;
    // Nested under networkResults array
    if (Array.isArray(r.networkResults) && r.networkResults.length > 0) {
      return r.networkResults[0] as NetworkAnalysisResult;
    }
    return null;
  }, [analysis]);

  if (!network || network.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: "var(--color-text-tertiary)" }}>
        <div className="text-center">
          <p className="text-sm font-medium mb-1">{useI18nStore.getState().t.quantResults.str_lnds10}</p>
          <p className="text-xs">{useI18nStore.getState().t.quantResults.str_1z6kp3}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Graph */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <GraphPanel network={network} analysisName={analysis.name} />
      </div>
      {/* Right: Metrics & Tables */}
      <div
        className="shrink-0 h-full overflow-y-auto scrollable-area"
        style={{
          width: "300px",
          borderLeft: "1px solid var(--color-border-primary)",
          backgroundColor: "var(--color-bg-secondary)",
        }}
      >
        <RightPanel network={network} />
      </div>
    </div>
  );
};

// ====================================================================
// Left panel — Graph
// ====================================================================
const GraphPanel: React.FC<{ network: NetworkAnalysisResult; analysisName: string }> = memo(({ network, analysisName }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 600, h: 500 });
  const [FG2D, setFG2D] = useState<FG2D>(() => _fg);
  const [loadErr, setLoadErr] = useState<Error | null>(() => _fgErr);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [highlightNode, setHighlightNode] = useState<string | null>(null);
  const [tooltipData, setTooltipData] = useState<{ x: number; y: number; node: NetworkAnalysisResult["nodes"][0] } | null>(null);

  // Load
  useEffect(() => {
    if (FG2D) return;
    let cancelled = false;
    loadFG()
      .then((c) => { if (!cancelled) setFG2D(() => c); })
      .catch((e) => { if (!cancelled) setLoadErr(e); });
    return () => { cancelled = true; };
  }, [FG2D]);

  // Resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDims({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Zoom to fit on mount
  useEffect(() => {
    if (!fgRef.current) return;
    const t = setTimeout(() => {
      try { fgRef.current?.zoomToFit(400, 50); } catch { /* ignore */ }
    }, 600);
    return () => clearTimeout(t);
  }, [FG2D, network.nodes.length]);

  // Comm color map
  const commColors = useMemo(() => {
    const m = new Map<number, string>();
    for (const c of network.communities) m.set(c.id, resolveColor(c.color, c.id));
    return m;
  }, [network.communities]);

  // Graph data
  const maxDeg = useMemo(() => Math.max(...network.nodes.map((n) => n.degree), 1), [network.nodes]);
  const maxEdgeW = useMemo(() => Math.max(...network.edges.map((e) => e.weight), 1), [network.edges]);

  const graphData = useMemo(() => ({
    nodes: network.nodes.map((n) => ({
      ...n,
      val: 2 + (n.degree / maxDeg) * 12,
      color: commColors.get(n.community) ?? COMM_COLORS[n.community % COMM_COLORS.length]!,
    })),
    links: network.edges.map((e) => ({
      source: e.source,
      target: e.target,
      weight: e.weight,
    })),
  }), [network, maxDeg, commColors]);

  // Connected nodes for highlight
  const connectedIds = useMemo(() => {
    if (!highlightNode) return new Set<string>();
    const ids = new Set<string>([highlightNode]);
    for (const e of network.edges) {
      if (e.source === highlightNode) ids.add(e.target);
      if (e.target === highlightNode) ids.add(e.source);
    }
    return ids;
  }, [highlightNode, network.edges]);

  // Node paint
  const paintNode = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const r = Math.sqrt(node.val ?? 4) * 2;
      const isHL = node.id === highlightNode;
      const isConn = connectedIds.has(node.id);
      const isFaded = highlightNode != null && !isConn;

      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = node.color ?? "#888";
      ctx.globalAlpha = isFaded ? 0.15 : isHL ? 1 : 0.85;
      ctx.fill();

      if (isHL) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.shadowColor = node.color;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
      }

      if (showLabels && !isFaded && (globalScale > 0.5 || isHL)) {
        const fs = Math.max(10 / globalScale, 3);
        ctx.font = `${isHL ? "bold " : ""}${fs}px "Inter", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = getCSSVar("--color-text-primary") || "#333";
        ctx.globalAlpha = isHL ? 1 : 0.8;
        const label = node.label.length > 12 ? node.label.slice(0, 12) + "…" : node.label;
        ctx.fillText(label, x, y + r + 2);
      }
      ctx.globalAlpha = 1;
    },
    [showLabels, highlightNode, connectedIds],
  );

  // Link paint
  const paintLink = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (link: any, ctx: CanvasRenderingContext2D) => {
      const s = link.source;
      const t = link.target;
      if (!s?.x || !t?.x) return;
      const isHL = highlightNode != null && (s.id === highlightNode || t.id === highlightNode);
      const isFaded = highlightNode != null && !isHL;

      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      ctx.strokeStyle = isHL
        ? getCSSVar("--color-accent-primary") || "#3b82f6"
        : getCSSVar("--color-border-primary") || "#ccc";
      ctx.lineWidth = isHL
        ? 1 + (link.weight / maxEdgeW) * 4
        : 0.5 + (link.weight / maxEdgeW) * 2.5;
      ctx.globalAlpha = isFaded ? 0.08 : isHL ? 0.7 : 0.35;
      ctx.stroke();
      ctx.globalAlpha = 1;
    },
    [highlightNode, maxEdgeW],
  );

  // Hover handler
  const handleHover = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any, event?: MouseEvent) => {
      if (node) {
        setHighlightNode(node.id);
        if (event) {
          setTooltipData({ x: event.clientX, y: event.clientY, node });
        }
      } else {
        setHighlightNode(null);
        setTooltipData(null);
      }
    },
    [],
  );

  // Export PNG
  const exportPNG = useCallback(() => {
    const canvas = containerRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${analysisName}-network.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [analysisName]);

  // External highlight from right panel click
  const highlightFromTable = useCallback((nodeId: string) => {
    setHighlightNode(nodeId);
    // Try to center on node
    const node = graphData.nodes.find((n) => n.id === nodeId);
    if (node && fgRef.current) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fgRef.current.centerAt((node as any).x, (node as any).y, 400);
        fgRef.current.zoom(3, 400);
      } catch { /* ignore */ }
    }
  }, [graphData.nodes]);

  // Expose highlight function via context-like pattern (attach to container dataset)
  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (el as any).__highlightNode = highlightFromTable;
    }
  }, [highlightFromTable]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 py-2 flex items-center justify-between" style={{ borderBottom: "1px solid var(--color-border-primary)" }}>
        <h2 className="text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>{analysisName}</h2>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs" style={{ color: "var(--color-text-secondary)", cursor: "pointer" }}>
            <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} className="accent-blue-500" style={{ width: "13px", height: "13px" }} />
            ラベル
          </label>
          <button onClick={() => fgRef.current?.zoomToFit(400, 40)} className="px-2 py-1 text-xs" style={{ color: "var(--color-text-secondary)", border: "1px solid var(--color-border-primary)", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>
            リセット
          </button>
          <button onClick={() => fgRef.current?.zoom(fgRef.current.zoom() * 1.3, 200)} className="px-1.5 py-1 text-xs font-bold" style={{ color: "var(--color-text-secondary)", border: "1px solid var(--color-border-primary)", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>
            +
          </button>
          <button onClick={() => fgRef.current?.zoom(fgRef.current.zoom() / 1.3, 200)} className="px-1.5 py-1 text-xs font-bold" style={{ color: "var(--color-text-secondary)", border: "1px solid var(--color-border-primary)", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>
            −
          </button>
          <button onClick={exportPNG} className="flex items-center gap-1 px-2 py-1 text-xs" style={{ color: "var(--color-text-secondary)", border: "1px solid var(--color-border-primary)", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            PNG
          </button>
        </div>
      </div>

      {/* Graph area */}
      <div ref={containerRef} className="flex-1 relative" style={{ backgroundColor: "var(--color-bg-primary)" }}>
        {loadErr ? (
          <div className="flex items-center justify-center h-full text-xs" style={{ color: "var(--color-text-tertiary)" }}>
            グラフエンジンの読み込みに失敗しました
          </div>
        ) : !FG2D ? (
          <div className="flex items-center justify-center h-full text-xs" style={{ color: "var(--color-text-tertiary)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            <span className="ml-2">{useI18nStore.getState().t.layout.loading}</span>
          </div>
        ) : (
          <FG2D
            ref={fgRef}
            graphData={graphData}
            width={dims.w}
            height={dims.h}
            backgroundColor={getCSSVar("--color-bg-primary") || "#fff"}
            nodeCanvasObject={paintNode}
            nodeCanvasObjectMode={() => "replace"}
            linkCanvasObject={paintLink}
            linkCanvasObjectMode={() => "replace"}
            onNodeHover={handleHover}
            enableNodeDrag
            enableZoomInteraction
            enablePanInteraction
            cooldownTicks={100}
            warmupTicks={30}
            minZoom={0.2}
            maxZoom={8}
          />
        )}

        {/* Tooltip */}
        {tooltipData && (
          <div
            className="fixed z-50 pointer-events-none px-3 py-2"
            style={{
              left: tooltipData.x + 12,
              top: tooltipData.y - 10,
              backgroundColor: "var(--color-bg-primary)",
              border: "1px solid var(--color-border-primary)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-md)",
              maxWidth: "220px",
            }}
          >
            <p className="text-xs font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>{tooltipData.node.label}</p>
            <div className="flex flex-col gap-0.5 text-xs" style={{ color: "var(--color-text-secondary)" }}>
              <span>{useI18nStore.getState().t.quantitative.k_degree} {tooltipData.node.degree}</span>
              <span>{useI18nStore.getState().t.quantitative.k_betweenness} {fmt(tooltipData.node.betweenness)}</span>
              <span>{useI18nStore.getState().t.quantitative.k_closeness} {fmt(tooltipData.node.closeness)}</span>
              <span>{useI18nStore.getState().t.quantitative.k_community} {tooltipData.node.community + 1}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

// ====================================================================
// Right panel — Metrics, Top Nodes, Communities
// ====================================================================
const RightPanel: React.FC<{ network: NetworkAnalysisResult }> = memo(({ network }) => {
  const [expandedComm, setExpandedComm] = useState<number | null>(null);

  const topNodes = useMemo(
    () => [...network.nodes].sort((a, b) => b.betweenness - a.betweenness).slice(0, 10),
    [network.nodes],
  );

  // Community node lists
  const commNodes = useMemo(() => {
    const m = new Map<number, NetworkAnalysisResult["nodes"]>();
    for (const n of network.nodes) {
      const arr = m.get(n.community) ?? [];
      arr.push(n);
      m.set(n.community, arr);
    }
    return m;
  }, [network.nodes]);

  const handleRowClick = useCallback((nodeId: string) => {
    // Find graph container and call highlight
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const container = document.querySelector("[class*='relative']") as any;
    if (container?.__highlightNode) {
      container.__highlightNode(nodeId);
    }
  }, []);

  const metrics = network.globalMetrics;

  const METRIC_CARDS: { label: string; value: string; tooltip: string }[] = [
    {
      label: useI18nStore.getState().t.quantResults.str_g4o0,
      value: fmt(metrics.density),
      tooltip: useI18nStore.getState().t.quantResults.str_e3b3so,
    },
    {
      label: useI18nStore.getState().t.quantResults.str_ca5vhf,
      value: fmt(metrics.avgDegree, 2),
      tooltip: useI18nStore.getState().t.quantResults.str_ukwvs6,
    },
    {
      label: useI18nStore.getState().t.quantResults.str_87227z,
      value: fmt(metrics.avgClustering),
      tooltip: useI18nStore.getState().t.quantResults.str_pzcgr8,
    },
    {
      label: useI18nStore.getState().t.quantResults.str_f9weib,
      value: fmt(metrics.modularity),
      tooltip: useI18nStore.getState().t.quantResults.str_0_3,
    },
  ];

  return (
    <div className="flex flex-col">
      {/* Global Metrics */}
      <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--color-border-primary)" }}>
        <h3 className="text-xs font-semibold mb-3 uppercase tracking-wide" style={{ color: "var(--color-text-tertiary)", letterSpacing: "0.08em" }}>
          グローバル指標
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {METRIC_CARDS.map((m) => (
            <div
              key={m.label}
              className="relative group"
              style={{
                backgroundColor: "var(--color-bg-primary)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border-primary)",
                padding: "10px",
              }}
            >
              <p className="text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>{m.value}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-secondary)", fontSize: "10px" }}>{m.label}</p>
              {/* Tooltip on hover */}
              <div
                className="absolute left-0 bottom-full mb-1 px-2 py-1.5 text-xs z-50 hidden group-hover:block"
                style={{
                  backgroundColor: "var(--color-bg-primary)",
                  border: "1px solid var(--color-border-primary)",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "var(--shadow-md)",
                  color: "var(--color-text-secondary)",
                  width: "200px",
                  lineHeight: "1.4",
                  fontSize: "10px",
                }}
              >
                {m.tooltip}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Nodes Table */}
      <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--color-border-primary)" }}>
        <h3 className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: "var(--color-text-tertiary)", letterSpacing: "0.08em" }}>
          トップノード
        </h3>
        <div style={{ border: "1px solid var(--color-border-primary)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
          <table className="w-full" style={{ borderCollapse: "collapse", fontSize: "10px" }}>
            <thead>
              <tr style={{ backgroundColor: "var(--color-bg-primary)" }}>
                {[useI18nStore.getState().t.quantResults.str_7dy1n, useI18nStore.getState().t.quantResults.str_is1b, useI18nStore.getState().t.quantResults.str_fu61, useI18nStore.getState().t.quantResults.str_p0c4].map((h) => (
                  <th key={h} className="px-2 py-1.5 text-left font-medium" style={{ color: "var(--color-text-tertiary)", borderBottom: "1px solid var(--color-border-primary)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topNodes.map((n, i) => (
                <tr
                  key={n.id}
                  className="cursor-pointer"
                  style={{ borderBottom: i < topNodes.length - 1 ? "1px solid var(--color-border-primary)" : "none" }}
                  onClick={() => handleRowClick(n.id)}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-bg-hover)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  <td className="px-2 py-1" style={{ color: "var(--color-text-primary)" }}>
                    <div className="flex items-center gap-1">
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: resolveColor(network.communities.find((c) => c.id === n.community)?.color ?? "", n.community), flexShrink: 0 }} />
                      <span className="truncate" style={{ maxWidth: "80px" }}>{n.label}</span>
                    </div>
                  </td>
                  <td className="px-2 py-1" style={{ color: "var(--color-text-secondary)" }}>{n.degree}</td>
                  <td className="px-2 py-1" style={{ color: "var(--color-text-secondary)" }}>{fmt(n.betweenness, 3)}</td>
                  <td className="px-2 py-1" style={{ color: "var(--color-text-secondary)" }}>{fmt(n.closeness, 3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Communities */}
      <div className="px-4 py-3">
        <h3 className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: "var(--color-text-tertiary)", letterSpacing: "0.08em" }}>
          コミュニティ一覧
        </h3>
        <div className="flex flex-col gap-1">
          {network.communities.map((c) => {
            const color = resolveColor(c.color, c.id);
            const nodes = commNodes.get(c.id) ?? [];
            const isExpanded = expandedComm === c.id;
            return (
              <div key={c.id}>
                <button
                  onClick={() => setExpandedComm(isExpanded ? null : c.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs"
                  style={{ borderRadius: "var(--radius-sm)", cursor: "pointer" }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-bg-hover)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  <svg
                    width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    style={{ transition: "transform 0.15s", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", flexShrink: 0, color: "var(--color-text-tertiary)" }}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <span style={{ width: "10px", height: "10px", borderRadius: "3px", backgroundColor: color, flexShrink: 0 }} />
                  <span className="flex-1 text-left" style={{ color: "var(--color-text-primary)" }}>{c.label}</span>
                  <span style={{ color: "var(--color-text-tertiary)", fontSize: "10px" }}>{c.nodeCount}</span>
                </button>
                {isExpanded && nodes.length > 0 && (
                  <div className="ml-7 mb-1 flex flex-wrap gap-1">
                    {nodes.map((n) => (
                      <span
                        key={n.id}
                        className="px-1.5 py-0.5 cursor-pointer"
                        style={{
                          fontSize: "10px",
                          color: "var(--color-text-secondary)",
                          backgroundColor: "var(--color-bg-primary)",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--color-border-primary)",
                        }}
                        onClick={() => handleRowClick(n.id)}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = color; e.currentTarget.style.color = "var(--color-text-primary)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-border-primary)"; e.currentTarget.style.color = "var(--color-text-secondary)"; }}
                      >
                        {n.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Interpretation */}
      <div className="px-4 py-3" style={{ borderTop: "1px solid var(--color-border-primary)" }}>
        <div className="p-3" style={{ backgroundColor: "color-mix(in srgb, var(--color-accent-info) 6%, var(--color-bg-primary))", borderRadius: "var(--radius-md)", border: "1px solid color-mix(in srgb, var(--color-accent-info) 20%, var(--color-border-primary))" }}>
          <p className="text-xs font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>{useI18nStore.getState().t.quantResults.str_o951}</p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-secondary)", fontSize: "10px" }}>
            {network.interpretation}
          </p>
        </div>
      </div>
    </div>
  );
});
