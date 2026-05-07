// src/components/quantitative/results/TextAnalysisView.tsx
// Stellar — テキスト分析結果ビュー
// Tab 1: 頻出語（Top30 + WordCloud + ストップワード管理）
// Tab 2: 共起ネットワーク（react-force-graph-2d + フィルタ + コミュニティ凡例）
// Tab 3: テキスト統計（TTR, bigrams, per-doc bar chart）

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  memo,
} from "react";
import type { Analysis, Variable, DataRow } from "../../../types";
import type {
  TextAnalysisResult,
  NetworkAnalysisResult,
} from "../../../lib/stats/types";
import { WordCloud } from "../charts";
import { BarChart } from "../charts";
import { downloadSVG, downloadPNG } from "../../../lib/utils/exportChart";
import { useI18nStore } from "../../../stores/useI18nStore";

// ── Force graph dynamic loader (same pattern as main graph view) ──
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

// ── SVG Icons ──
const WordIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7V4h16v3" /><path d="M9 20h6" /><path d="M12 4v16" />
  </svg>
);
const NetworkIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="5" r="2.5" /><circle cx="5" cy="19" r="2.5" /><circle cx="19" cy="19" r="2.5" />
    <line x1="12" y1="7.5" x2="5" y2="16.5" /><line x1="12" y1="7.5" x2="19" y2="16.5" />
  </svg>
);
const StatsIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
const DownloadIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);
const TrashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);
const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

// ── ExportMenu ──
const ExportMenu = memo(({ containerRef, name }: { containerRef: React.RefObject<HTMLDivElement | null>; name: string }) => {
  const [open, setOpen] = useState(false);
  const doExport = useCallback((type: "svg" | "png") => {
    const el = containerRef.current;
    if (!el) return;
    const svg = el.querySelector("svg");
    if (!svg) return;
    if (type === "svg") downloadSVG(svg, `${name}.svg`);
    else downloadPNG(svg, `${name}.png`);
    setOpen(false);
  }, [containerRef, name]);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 text-xs"
        style={{ color: "var(--color-text-secondary)", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border-primary)" }}
      >
        <DownloadIcon /> エクスポート
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 flex flex-col" style={{ backgroundColor: "var(--color-bg-primary)", border: "1px solid var(--color-border-primary)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-md)", minWidth: "120px" }}>
          <button onClick={() => doExport("svg")} className="px-3 py-1.5 text-xs text-left" style={{ color: "var(--color-text-primary)" }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-bg-hover)"; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}>SVG</button>
          <button onClick={() => doExport("png")} className="px-3 py-1.5 text-xs text-left" style={{ color: "var(--color-text-primary)" }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-bg-hover)"; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}>PNG</button>
        </div>
      )}
    </div>
  );
});

// ── Props ──
interface Props {
  analysis: Analysis;
  variables: Variable[];
  dataRows: DataRow[];
}

// ── Tab types ──
type TabKey = "words" | "network" | "stats";
const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "words", label: useI18nStore.getState().t.quantResults.str_mpeu7, icon: <WordIcon /> },
  { key: "network", label: useI18nStore.getState().t.quantResults.str_w9a52i, icon: <NetworkIcon /> },
  { key: "stats", label: useI18nStore.getState().t.quantResults.str_6jq2b, icon: <StatsIcon /> },
];

// ── POS filter presets ──
type PosFilter = "noun" | "noun_verb" | "all";
const POS_LABELS: Record<PosFilter, string> = { noun: useI18nStore.getState().t.quantResults.str_b658qq, noun_verb: useI18nStore.getState().t.quantResults.str_91xmnx, all: useI18nStore.getState().t.quantResults.str_7bg2u };

// ── Community colors (fallbacks) ──
const COMM_COLORS = ["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f", "#edc948", "#b07aa1", "#ff9da7", "#9c755f", "#bab0ac", "#4dc9f6", "#8b5cf6"];

// ====================================================================
// Main component
// ====================================================================
export const TextAnalysisView: React.FC<Props> = ({ analysis, variables, dataRows }) => {
  const [tab, setTab] = useState<TabKey>("words");

  // Extract text analysis results (possibly multi-variable)
  const textResults: TextAnalysisResult[] = useMemo(() => {
    const r = analysis.result as Record<string, unknown> | null;
    if (!r) return [];
    if (Array.isArray(r.textResults)) return r.textResults as TextAnalysisResult[];
    // Single result wrapped
    if (r.totalTokens != null) return [r as unknown as TextAnalysisResult];
    return [];
  }, [analysis]);

  // Use first result as primary (most analyses have one text variable)
  const primary = textResults[0] ?? null;

  // Stopword management state
  const [stopwords, setStopwords] = useState<string[]>([]);
  const [swInput, setSwInput] = useState("");
  const [draftResult, setDraftResult] = useState<TextAnalysisResult | null>(null);
  const [reanalyzing, setReanalyzing] = useState(false);

  const activeResult = draftResult ?? primary;

  // Get text values for re-analysis
  const getTextValues = useCallback((varId: string): string[] => {
    const v = variables.find((x) => x.id === varId);
    if (!v) return [];
    return dataRows.map((row) => row.values[v.name]).filter((x): x is string => x != null && x !== "").map(String);
  }, [variables, dataRows]);

  const addStopword = useCallback(() => {
    const w = swInput.trim();
    if (w && !stopwords.includes(w)) {
      setStopwords((prev) => [...prev, w]);
    }
    setSwInput("");
  }, [swInput, stopwords]);

  const removeStopword = useCallback((w: string) => {
    setStopwords((prev) => prev.filter((x) => x !== w));
  }, []);

  const reanalyze = useCallback(async () => {
    if (!primary || stopwords.length === 0) return;
    setReanalyzing(true);
    try {
      const { analyzeTextVariable } = await import("../../../lib/stats/textAnalysis");
      const texts = getTextValues(primary.variableId);
      const result = await analyzeTextVariable(texts, primary.variableId, stopwords);
      setDraftResult(result);
    } catch (e) {
      console.error("Re-analysis failed:", e);
    } finally {
      setReanalyzing(false);
    }
  }, [primary, stopwords, getTextValues]);

  if (!activeResult) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: "var(--color-text-tertiary)" }}>
        <p className="text-sm">{t.quantResults.str_jlq1le}</p>
      </div>
    );
  }

  const varObj = variables.find((v) => v.id === activeResult.variableId);
  const varName = varObj?.name ?? useI18nStore.getState().t.quantResults.str_6q483;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <div className="shrink-0 px-6 pt-5 pb-3">
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-base font-bold" style={{ color: "var(--color-text-primary)" }}>
            {analysis.name}
          </h2>
          {draftResult && (
            <span className="text-xs px-2 py-0.5" style={{ color: "var(--color-accent-warning)", backgroundColor: "color-mix(in srgb, var(--color-accent-warning) 12%, transparent)", borderRadius: "var(--radius-sm)" }}>
              ドラフト
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs" style={{ color: "var(--color-text-secondary)" }}>
          <span>{t.quantResults.str_diqhf} <strong style={{ color: "var(--color-text-primary)" }}>{varName}</strong></span>
          <span>{t.quantResults.str_yjs3z2} <strong style={{ color: "var(--color-text-primary)" }}>{activeResult.totalTokens.toLocaleString()}</strong></span>
          <span>{t.quantResults.str_b8n4m0} <strong style={{ color: "var(--color-text-primary)" }}>{activeResult.uniqueTokens.toLocaleString()}</strong></span>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="shrink-0 px-6 flex gap-1" style={{ borderBottom: "1px solid var(--color-border-primary)" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium"
            style={{
              color: tab === t.key ? "var(--color-accent-primary)" : "var(--color-text-secondary)",
              borderBottom: tab === t.key ? "2px solid var(--color-accent-primary)" : "2px solid transparent",
              marginBottom: "-1px",
              transition: "all var(--transition-fast)",
            }}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-y-auto p-6 scrollable-area">
        {tab === "words" && <WordsTab result={activeResult} stopwords={stopwords} swInput={swInput} setSwInput={setSwInput} addStopword={addStopword} removeStopword={removeStopword} reanalyze={reanalyze} reanalyzing={reanalyzing} />}
        {tab === "network" && <NetworkTab network={activeResult.cooccurrenceNetwork} />}
        {tab === "stats" && <StatsTab results={textResults} activeResult={activeResult} dataRows={dataRows} variables={variables} />}
      </div>
    </div>
  );
};

// ====================================================================
// Tab 1 — 頻出語
// ====================================================================
interface WordsTabProps {
  result: TextAnalysisResult;
  stopwords: string[];
  swInput: string;
  setSwInput: (v: string) => void;
  addStopword: () => void;
  removeStopword: (w: string) => void;
  reanalyze: () => Promise<void>;
  reanalyzing: boolean;
}

const WordsTab: React.FC<WordsTabProps> = memo(({ result, stopwords, swInput, setSwInput, addStopword, removeStopword, reanalyze, reanalyzing }) => {
  const top30 = useMemo(() => result.topWords.slice(0, 30), [result.topWords]);
  const maxTfidf = useMemo(() => Math.max(...top30.map((w) => w.tfidf), 0.001), [top30]);
  const wcRef = useRef<HTMLDivElement>(null);

  const wcWords = useMemo(() =>
    result.topWords.slice(0, 80).map((w) => ({
      text: w.token,
      value: w.frequency,
      category: w.pos,
    })),
  [result.topWords]);

  return (
    <div className="flex flex-col gap-6">
      {/* Top 30 table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            頻出語 Top 30
          </h3>
        </div>
        <div style={{ border: "1px solid var(--color-border-primary)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
          <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "var(--color-bg-secondary)" }}>
                {[useI18nStore.getState().t.quantResults.str_qakn, useI18nStore.getState().t.quantResults.k_rdq, useI18nStore.getState().t.quantResults.str_f6bh, useI18nStore.getState().t.quantResults.str_qevf, useI18nStore.getState().t.quantResults.TF_IDF].map((h, i) => (
                  <th key={h} className="px-3 py-2 text-left font-medium" style={{ color: "var(--color-text-secondary)", borderBottom: "1px solid var(--color-border-primary)", width: i === 4 ? "200px" : "auto" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {top30.map((w, i) => (
                <tr key={w.token} style={{ borderBottom: i < top30.length - 1 ? "1px solid var(--color-border-primary)" : "none" }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-bg-hover)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  <td className="px-3 py-1.5" style={{ color: "var(--color-text-tertiary)" }}>{i + 1}</td>
                  <td className="px-3 py-1.5 font-medium" style={{ color: "var(--color-text-primary)" }}>{w.token}</td>
                  <td className="px-3 py-1.5">
                    <span className="px-1.5 py-0.5" style={{
                      fontSize: "10px",
                      color: w.pos === useI18nStore.getState().t.quantResults.str_f20h ? "var(--color-accent-primary)" : w.pos === useI18nStore.getState().t.quantResults.str_eujt ? "var(--color-accent-warning)" : "#a78bfa",
                      backgroundColor: w.pos === useI18nStore.getState().t.quantResults.str_f20h ? "color-mix(in srgb, var(--color-accent-primary) 10%, transparent)" : w.pos === useI18nStore.getState().t.quantResults.str_eujt ? "color-mix(in srgb, var(--color-accent-warning) 10%, transparent)" : "color-mix(in srgb, #a78bfa 10%, transparent)",
                      borderRadius: "var(--radius-sm)",
                    }}>
                      {w.pos}
                    </span>
                  </td>
                  <td className="px-3 py-1.5" style={{ color: "var(--color-text-primary)" }}>{w.frequency}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2" style={{ backgroundColor: "var(--color-bg-hover)", borderRadius: "2px", overflow: "hidden" }}>
                        <div style={{ width: `${(w.tfidf / maxTfidf) * 100}%`, height: "100%", backgroundColor: "var(--color-accent-primary)", borderRadius: "2px", transition: "width 0.3s" }} />
                      </div>
                      <span style={{ color: "var(--color-text-tertiary)", fontSize: "10px", minWidth: "36px", textAlign: "right" }}>
                        {w.tfidf.toFixed(3)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* WordCloud */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>{t.quantResults.str_5tfw1z}</h3>
          <ExportMenu containerRef={wcRef} name={`wordcloud-${result.variableId}`} />
        </div>
        <div ref={wcRef} style={{ backgroundColor: "var(--color-bg-secondary)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border-primary)", padding: "16px" }}>
          <WordCloud words={wcWords} maxWords={60} height={320} />
        </div>
      </div>

      {/* Stopword manager */}
      <div style={{ backgroundColor: "var(--color-bg-secondary)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border-primary)", padding: "16px" }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>{t.quantResults.str_fc1bcp}</h3>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={swInput}
            onChange={(e) => setSwInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addStopword(); }}
            placeholder={useI18nStore.getState().t.quantResults.str_4eh4kb}
            className="flex-1 px-3 py-1.5 text-xs"
            style={{
              backgroundColor: "var(--color-bg-primary)",
              color: "var(--color-text-primary)",
              border: "1px solid var(--color-border-primary)",
              borderRadius: "var(--radius-md)",
              outline: "none",
            }}
          />
          <button
            onClick={addStopword}
            disabled={!swInput.trim()}
            className="px-3 py-1.5 text-xs font-medium"
            style={{ color: "#fff", backgroundColor: "var(--color-accent-primary)", borderRadius: "var(--radius-md)", opacity: swInput.trim() ? 1 : 0.4, cursor: swInput.trim() ? "pointer" : "not-allowed" }}
          >
            追加
          </button>
        </div>
        {stopwords.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {stopwords.map((w) => (
              <span key={w} className="flex items-center gap-1 px-2 py-0.5 text-xs" style={{ backgroundColor: "color-mix(in srgb, var(--color-accent-danger) 10%, transparent)", color: "var(--color-accent-danger)", borderRadius: "var(--radius-sm)" }}>
                {w}
                <button onClick={() => removeStopword(w)} className="flex" style={{ cursor: "pointer" }}><TrashIcon /></button>
              </span>
            ))}
          </div>
        )}
        <button
          onClick={() => void reanalyze()}
          disabled={stopwords.length === 0 || reanalyzing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
          style={{
            color: stopwords.length > 0 ? "#fff" : "var(--color-text-disabled)",
            backgroundColor: stopwords.length > 0 ? "var(--color-accent-secondary)" : "var(--color-bg-hover)",
            borderRadius: "var(--radius-md)",
            cursor: stopwords.length > 0 && !reanalyzing ? "pointer" : "not-allowed",
            opacity: stopwords.length > 0 ? 1 : 0.4,
          }}
        >
          <RefreshIcon />
          {reanalyzing ? useI18nStore.getState().t.quantResults.str_eycy4o : useI18nStore.getState().t.quantResults.str_gk62n9}
        </button>
      </div>
    </div>
  );
});

// ====================================================================
// Tab 2 — 共起ネットワーク
// ====================================================================
const NetworkTab: React.FC<{ network: NetworkAnalysisResult }> = memo(({ network }) => {
  const [minCooc, setMinCooc] = useState(2);
  const [posFilter, setPosFilter] = useState<PosFilter>("all");
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 600, h: 400 });
  const [FG2D, setFG2D] = useState<FG2D>(() => _fg);
  const [loadErr, setLoadErr] = useState<Error | null>(() => _fgErr);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [highlightNode, setHighlightNode] = useState<string | null>(null);

  // Load force graph
  useEffect(() => {
    if (FG2D) return;
    let cancelled = false;
    loadFG()
      .then((c) => { if (!cancelled) setFG2D(() => c); })
      .catch((e) => { if (!cancelled) setLoadErr(e); });
    return () => { cancelled = true; };
  }, [FG2D]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDims({ w: entry.contentRect.width, h: Math.max(entry.contentRect.height, 360) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Filter data
  const filtered = useMemo(() => {
    let nodes = network.nodes;
    let edges = network.edges;

    // POS filter: node labels starting with known pos (from community label or check frequency)
    // Since nodes have labels, and we can filter based on edges having min weight
    edges = edges.filter((e) => e.weight >= minCooc);
    const activeNodeIds = new Set<string>();
    for (const e of edges) { activeNodeIds.add(e.source); activeNodeIds.add(e.target); }
    nodes = nodes.filter((n) => activeNodeIds.has(n.id));

    return { nodes, edges };
  }, [network, minCooc, posFilter]);

  // Build graph data for react-force-graph-2d
  const graphData = useMemo(() => {
    const maxDeg = Math.max(...filtered.nodes.map((n) => n.degree), 1);
    const commColors = new Map<number, string>();
    for (const c of network.communities) {
      commColors.set(c.id, c.color.startsWith("var(") ? COMM_COLORS[c.id % COMM_COLORS.length]! : c.color);
    }
    return {
      nodes: filtered.nodes.map((n) => ({
        id: n.id,
        label: n.label,
        degree: n.degree,
        betweenness: n.betweenness,
        closeness: n.closeness,
        community: n.community,
        val: 2 + (n.degree / maxDeg) * 10,
        color: commColors.get(n.community) ?? COMM_COLORS[n.community % COMM_COLORS.length]!,
      })),
      links: filtered.edges.map((e) => ({
        source: e.source,
        target: e.target,
        weight: e.weight,
      })),
    };
  }, [filtered, network.communities]);

  const maxEdgeWeight = useMemo(() => Math.max(...filtered.edges.map((e) => e.weight), 1), [filtered.edges]);

  // Community legend with top-3 words
  const commLegend = useMemo(() => {
    const commNodes = new Map<number, string[]>();
    for (const n of filtered.nodes) {
      const arr = commNodes.get(n.community) ?? [];
      arr.push(n.label);
      commNodes.set(n.community, arr);
    }
    return network.communities
      .filter((c) => commNodes.has(c.id))
      .map((c) => ({
        ...c,
        color: c.color.startsWith("var(") ? COMM_COLORS[c.id % COMM_COLORS.length]! : c.color,
        top3: (commNodes.get(c.id) ?? []).slice(0, 3),
        count: commNodes.get(c.id)?.length ?? 0,
      }));
  }, [network.communities, filtered.nodes]);

  // Node canvas painting
  const paintNode = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const r = Math.sqrt(node.val ?? 4) * 2;
      const isHL = node.id === highlightNode;

      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = node.color ?? "#888";
      ctx.globalAlpha = isHL ? 1 : 0.85;
      ctx.fill();

      if (isHL) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      if (showLabels && (globalScale > 0.6 || isHL)) {
        const fs = Math.max(10 / globalScale, 3);
        ctx.font = `${isHL ? "bold " : ""}${fs}px "Inter", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--color-text-primary").trim() || "#333";
        ctx.globalAlpha = 0.9;
        ctx.fillText(node.label ?? node.id, x, y + r + 2);
      }
      ctx.globalAlpha = 1;
    },
    [showLabels, highlightNode],
  );

  // Link canvas painting
  const paintLink = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (link: any, ctx: CanvasRenderingContext2D) => {
      const s = link.source;
      const t = link.target;
      if (!s?.x || !t?.x) return;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--color-border-primary").trim() || "#ccc";
      ctx.lineWidth = 0.5 + (link.weight / maxEdgeWeight) * 3;
      ctx.globalAlpha = 0.4;
      ctx.stroke();
      ctx.globalAlpha = 1;
    },
    [maxEdgeWeight],
  );

  const exportPNG = useCallback(() => {
    const canvas = containerRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "cooccurrence-network.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex items-center gap-4 flex-wrap">
        <label className="flex items-center gap-2 text-xs" style={{ color: "var(--color-text-secondary)" }}>
          最小共起回数:
          <input
            type="range" min={1} max={10} value={minCooc}
            onChange={(e) => setMinCooc(Number(e.target.value))}
            className="w-24"
          />
          <span className="font-medium" style={{ color: "var(--color-text-primary)", minWidth: "16px" }}>{minCooc}</span>
        </label>
        <div className="flex items-center gap-1.5">
          {(["noun", "noun_verb", "all"] as PosFilter[]).map((pf) => (
            <button
              key={pf}
              onClick={() => setPosFilter(pf)}
              className="px-2 py-1 text-xs"
              style={{
                color: posFilter === pf ? "#fff" : "var(--color-text-secondary)",
                backgroundColor: posFilter === pf ? "var(--color-accent-primary)" : "var(--color-bg-secondary)",
                border: `1px solid ${posFilter === pf ? "var(--color-accent-primary)" : "var(--color-border-primary)"}`,
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
              }}
            >
              {POS_LABELS[pf]}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--color-text-secondary)", cursor: "pointer" }}>
          <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} className="accent-blue-500" />
          ラベル表示
        </label>
        <button onClick={exportPNG} className="flex items-center gap-1 px-2 py-1 text-xs" style={{ color: "var(--color-text-secondary)", border: "1px solid var(--color-border-primary)", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>
          <DownloadIcon /> PNG
        </button>
        <button onClick={() => { fgRef.current?.zoomToFit(400, 40); }} className="px-2 py-1 text-xs" style={{ color: "var(--color-text-secondary)", border: "1px solid var(--color-border-primary)", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>
          リセット
        </button>
      </div>

      {/* Graph */}
      <div
        ref={containerRef}
        style={{
          height: "420px",
          backgroundColor: "var(--color-bg-secondary)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border-primary)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {loadErr ? (
          <div className="flex items-center justify-center h-full text-xs" style={{ color: "var(--color-text-tertiary)" }}>
            グラフエンジンの読み込みに失敗しました
          </div>
        ) : !FG2D ? (
          <div className="flex items-center justify-center h-full text-xs" style={{ color: "var(--color-text-tertiary)" }}>
            {t.common.loading}
          </div>
        ) : filtered.nodes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs" style={{ color: "var(--color-text-tertiary)" }}>
            表示するノードがありません（フィルタ条件を緩めてください）
          </div>
        ) : (
          <FG2D
            ref={fgRef}
            graphData={graphData}
            width={dims.w}
            height={420}
            backgroundColor={getComputedStyle(document.documentElement).getPropertyValue("--color-bg-secondary").trim() || "#f8f8f8"}
            nodeCanvasObject={paintNode}
            nodeCanvasObjectMode={() => "replace"}
            linkCanvasObject={paintLink}
            linkCanvasObjectMode={() => "replace"}
            onNodeHover={(n: { id: string } | null) => setHighlightNode(n?.id ?? null)}
            enableNodeDrag
            enableZoomInteraction
            cooldownTicks={80}
            warmupTicks={20}
            minZoom={0.3}
            maxZoom={6}
          />
        )}
      </div>

      {/* Community legend */}
      {commLegend.length > 0 && (
        <div style={{ backgroundColor: "var(--color-bg-secondary)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border-primary)", padding: "12px 16px" }}>
          <h4 className="text-xs font-semibold mb-2" style={{ color: "var(--color-text-secondary)" }}>{t.quantResults.str_8ei7dd}</h4>
          <div className="flex flex-wrap gap-3">
            {commLegend.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-xs">
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: c.color, display: "inline-block", flexShrink: 0 }} />
                <span style={{ color: "var(--color-text-primary)" }}>{c.label}</span>
                <span style={{ color: "var(--color-text-tertiary)", fontSize: "10px" }}>({c.count}語)</span>
                <span style={{ color: "var(--color-text-secondary)", fontSize: "10px" }}>{c.top3.join(", ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

// ====================================================================
// Tab 3 — テキスト統計
// ====================================================================
const StatsTab: React.FC<{
  results: TextAnalysisResult[];
  activeResult: TextAnalysisResult;
  dataRows: DataRow[];
  variables: Variable[];
}> = memo(({ activeResult, dataRows, variables }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  // Compute per-doc token counts for bar chart
  const perDocData = useMemo(() => {
    const v = variables.find((x) => x.id === activeResult.variableId);
    if (!v) return [];
    return dataRows.map((row, i) => {
      const text = String(row.values[v.name] ?? "");
      // Rough token count (split on whitespace + CJK char count)
      const tokens = text.replace(/[。、！？「」『』（）\s]+/g, " ").split(/\s+/).filter(Boolean);
      return { label: `Doc ${i + 1}`, value: tokens.length };
    }).filter((d) => d.value > 0);
  }, [activeResult.variableId, dataRows, variables]);

  const avgTokens = perDocData.length > 0
    ? Math.round(perDocData.reduce((s, d) => s + d.value, 0) / perDocData.length)
    : 0;

  const ttr = activeResult.totalTokens > 0
    ? (activeResult.uniqueTokens / activeResult.totalTokens).toFixed(4)
    : "0";

  // Top bigrams (from topWords, consecutive pairs)
  const bigrams = useMemo(() => {
    const top = activeResult.topWords.slice(0, 50);
    const pairs: Map<string, number> = new Map();
    for (let i = 0; i < top.length - 1; i++) {
      const key = `${top[i]!.token} + ${top[i + 1]!.token}`;
      pairs.set(key, (top[i]!.frequency + top[i + 1]!.frequency) / 2);
    }
    return [...pairs.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([pair, score]) => ({ pair, score: Math.round(score) }));
  }, [activeResult.topWords]);

  return (
    <div className="flex flex-col gap-6">
      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: useI18nStore.getState().t.quantResults.str_68dq8v, value: avgTokens.toLocaleString(), desc: useI18nStore.getState().t.quantResults.str_3oovm7 },
          { label: "TTR (Type-Token Ratio)", value: ttr, desc: useI18nStore.getState().t.quantResults.str_01 },
          { label: useI18nStore.getState().t.quantResults.str_g1mm06, value: perDocData.length.toLocaleString(), desc: useI18nStore.getState().t.quantResults.str_wqhlfz },
        ].map((card) => (
          <div key={card.label} style={{ backgroundColor: "var(--color-bg-secondary)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border-primary)", padding: "16px" }}>
            <p className="text-xs mb-1" style={{ color: "var(--color-text-secondary)" }}>{card.label}</p>
            <p className="text-xl font-bold" style={{ color: "var(--color-text-primary)" }}>{card.value}</p>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-tertiary)", fontSize: "10px" }}>{card.desc}</p>
          </div>
        ))}
      </div>

      {/* Bigrams table */}
      {bigrams.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>{t.quantResults.str_Top}</h3>
          <div style={{ border: "1px solid var(--color-border-primary)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
            <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "var(--color-bg-secondary)" }}>
                  <th className="px-3 py-2 text-left font-medium" style={{ color: "var(--color-text-secondary)", borderBottom: "1px solid var(--color-border-primary)" }}>{t.quantResults.str_qakn}</th>
                  <th className="px-3 py-2 text-left font-medium" style={{ color: "var(--color-text-secondary)", borderBottom: "1px solid var(--color-border-primary)" }}>{t.quantResults.str_8kqw}</th>
                  <th className="px-3 py-2 text-left font-medium" style={{ color: "var(--color-text-secondary)", borderBottom: "1px solid var(--color-border-primary)" }}>{t.quantResults.str_cadibj}</th>
                </tr>
              </thead>
              <tbody>
                {bigrams.map((b, i) => (
                  <tr key={b.pair} style={{ borderBottom: i < bigrams.length - 1 ? "1px solid var(--color-border-primary)" : "none" }}>
                    <td className="px-3 py-1.5" style={{ color: "var(--color-text-tertiary)" }}>{i + 1}</td>
                    <td className="px-3 py-1.5 font-medium" style={{ color: "var(--color-text-primary)" }}>{b.pair}</td>
                    <td className="px-3 py-1.5" style={{ color: "var(--color-text-primary)" }}>{b.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Per-document token count bar chart */}
      {perDocData.length > 1 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>{t.quantResults.str_xlz9nt}</h3>
            <ExportMenu containerRef={chartRef} name="token-counts" />
          </div>
          <div ref={chartRef} style={{ backgroundColor: "var(--color-bg-secondary)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border-primary)", padding: "16px" }}>
            <BarChart data={perDocData.slice(0, 50)} horizontal={false} yLabel={useI18nStore.getState().t.quantResults.str_fz4r8o} height={280} />
          </div>
        </div>
      )}

      {/* Interpretation */}
      <div style={{ backgroundColor: "color-mix(in srgb, var(--color-accent-info) 6%, var(--color-bg-secondary))", borderRadius: "var(--radius-lg)", border: "1px solid color-mix(in srgb, var(--color-accent-info) 20%, var(--color-border-primary))", padding: "16px" }}>
        <div className="flex items-start gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5" style={{ color: "var(--color-accent-info)" }}>
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div>
            <h4 className="text-xs font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>{t.quantResults.str_o951}</h4>
            <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
              {activeResult.interpretation}
              {Number(ttr) < 0.3 && useI18nStore.getState().t.quantResults.k_h94lm5}
              {Number(ttr) > 0.7 && useI18nStore.getState().t.quantResults.k_j99ahs}
              {avgTokens < 10 && useI18nStore.getState().t.quantResults.k_r7m3yg}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});


