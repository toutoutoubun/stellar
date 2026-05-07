// src/components/quantitative/ReportBuilder.tsx
// Stellar — レポートビルダー
// ドラッグ&ドロップのブロックエディタでレポートを構築
// ブロック種別: 分析結果 / チャート / テキスト / 統計表 / 区切り線
// エクスポート: Markdown保存 / ノートに追加 / クリップボードコピー

import React, {
  useState,
  useCallback,
  useMemo,
  memo,
} from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQuantitativeStore } from "../../stores/useQuantitativeStore";
import { useNoteStore } from "../../stores/useNoteStore";
import { toast } from "../ui/Toast";
import type { Analysis } from "../../types";
import { useI18nStore } from "../../stores/useI18nStore";
// exportChart utilities available if needed
// import { downloadPNG } from "../../lib/utils/exportChart";

// ── Citation styles ──
type CitationStyle = "apa" | "mla" | "chicago" | "wabun";
const CITATION_LABELS: Record<CitationStyle, string> = {
  apa: "APA",
  mla: "MLA",
  chicago: useI18nStore.getState().t.quantitative.k_7df1c,
  wabun: useI18nStore.getState().t.quantitative.k_3g5rx4,
};

// ── Block types ──
type BlockType = "analysis" | "chart" | "text" | "table" | "divider";

interface ReportBlock {
  id: string;
  type: BlockType;
  /** analysis block: analysis ID */
  analysisId?: string;
  /** chart block: analysis ID + chart description */
  chartAnalysisId?: string;
  chartLabel?: string;
  /** text block: Markdown content */
  textContent?: string;
  /** table block: analysis ID + table type */
  tableAnalysisId?: string;
  tableType?: "frequency" | "contingency" | "coefficient";
}

// ── SVG Icons ──
const AnalysisIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);
const ChartIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);
const TextIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);
const TableIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" />
  </svg>
);
const DividerIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="2" y1="12" x2="22" y2="12" />
  </svg>
);
const GripIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="5" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="19" r="1" />
    <circle cx="15" cy="5" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="19" r="1" />
  </svg>
);
const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);
const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
const SaveIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
  </svg>
);
const NoteIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

// ── Block type definitions for add-menu ──
const BLOCK_TYPES: { type: BlockType; label: string; icon: React.ReactNode; color: string }[] = [
  { type: "analysis", label: useI18nStore.getState().t.quantitative.k_tw441z, icon: <AnalysisIcon />, color: "var(--color-accent-primary)" },
  { type: "chart", label: useI18nStore.getState().t.quantitative.k_1tmwen, icon: <ChartIcon />, color: "var(--color-accent-secondary)" },
  { type: "text", label: useI18nStore.getState().t.quantitative.k_sa606x, icon: <TextIcon />, color: "#a78bfa" },
  { type: "table", label: useI18nStore.getState().t.quantitative.k_6me2ks, icon: <TableIcon />, color: "var(--color-accent-warning)" },
  { type: "divider", label: useI18nStore.getState().t.quantitative.k_au5vml, icon: <DividerIcon />, color: "var(--color-text-tertiary)" },
];

let blockCounter = 0;
function newBlockId(): string {

  return `block_${Date.now()}_${++blockCounter}`;
}

// ── Props ──
interface ReportBuilderProps {
  onClose: () => void;
}

// ====================================================================
// Stat formatting helpers (citation-style aware)
// ====================================================================
function formatStat(key: string, value: number | string, style: CitationStyle): string {
  const v = typeof value === "number" ? value : parseFloat(value);
  if (!Number.isFinite(v)) return `${key} = ${value}`;
  const fmtP = (p: number) => p < .001 ? "< .001" : p.toFixed(3).replace(/^0/, "");
  if (style === "wabun") {
    if (key === "t") return t.quantitative.k_psdes8;
    if (key === "df") return t.quantitative.k_7d97mo;
    if (key === "p") return t.quantitative.k_4r1gog;
    if (key === "d" || key === "r" || key === "V") return t.quantitative.k_h8smxg;
    if (key === "R²") return t.quantitative.k_wkddi2;
    if (key === "F") return t.quantitative.k_9bfi1i;
    if (key === "χ²") return t.quantitative.k_t658bz;
    return `${key}=${typeof value === "number" ? v.toFixed(3) : value}`;
  }
  // APA / MLA / Chicago (all very similar for stats)
  if (key === "p") return `p ${fmtP(v)}`;
  if (key === "df") return `${Math.round(v)}`;
  return `${v.toFixed(2)}`;
}

function buildStatString(analysis: Analysis, style: CitationStyle): string {
  const r = analysis.result as Record<string, unknown> | null;
  if (!r) return "";
  const type = analysis.analysisType;

  // t-test
  if (type === "t-test" || type === "mann-whitney") {
    const results = (r.results as Array<Record<string, unknown>>) ?? [];
    if (results.length === 0) return "";
    const first = results[0]!;
    if (type === "t-test") {
      const t = first.t as number;
      const df = first.df as number;
      const p = first.pValue as number;
      const d = first.effectSize as number;
      if (style === "wabun") {
        return `${formatStat("t", t, style)}、${formatStat("df", df, style)}、${formatStat("p", p, style)}、${formatStat("d", d, style)}`;
      }
      return `t(${formatStat("df", df, style)}) = ${formatStat("t", t, style)}, p ${formatStat("p", p, style)}, d = ${formatStat("d", d, style)}`;
    }
    // Mann-Whitney
    const U = first.U as number;
    const p = first.pValue as number;
    const ef = first.effectSizeR as number;
    if (style === "wabun") return `U=${U.toFixed(1)}、${formatStat("p", p, style)}、${formatStat("r", ef, style)}`;
    return `U = ${U.toFixed(1)}, p ${formatStat("p", p, style)}, r = ${ef.toFixed(2)}`;
  }

  // Chi-square
  if (type === "chi-square") {
    const results = (r.chiSquareResults as Array<Record<string, unknown>>) ?? [];
    if (results.length === 0) return "";
    const first = results[0]!;
    const chi2 = first.chi2 as number;
    const df = first.df as number;
    const p = first.pValue as number;
    const V = first.cramersV as number;
    if (style === "wabun") return `${formatStat("χ²", chi2, style)}、${formatStat("df", df, style)}、${formatStat("p", p, style)}、${formatStat("V", V, style)}`;
    return `χ²(${formatStat("df", df, style)}) = ${formatStat("χ²", chi2, style)}, p ${formatStat("p", p, style)}, V = ${V.toFixed(2)}`;
  }

  // Regression
  if (type === "regression") {
    const R2 = r.r2 as number;
    const F = r.fStatistic as number;
    const p = r.fPValue as number;
    if (style === "wabun") return `${formatStat("R²", R2, style)}、${formatStat("F", F, style)}、${formatStat("p", p, style)}`;
    return `R² = ${R2.toFixed(3)}, F = ${F.toFixed(2)}, p ${formatStat("p", p, style)}`;
  }

  // Descriptive — just note count
  if (type === "descriptive") {
    const descs = (r.descriptives as Array<Record<string, unknown>>) ?? [];
    return descs.length > 0 ? t.quantitative.k_j2vela : "";
  }

  return analysis.analysisType;
}

// ── Interpretation text extraction ──
function getInterpretation(analysis: Analysis): string {
  const r = analysis.result as Record<string, unknown> | null;
  if (!r) return "";

  // Look for interpretation strings in various result shapes
  if (typeof r.interpretation === "string") return r.interpretation;

  // Array results — concatenate interpretations
  const tryArrays = ["descriptives", "results", "chiSquareResults", "correlations", "textResults", "networkResults"];
  for (const key of tryArrays) {
    const arr = r[key] as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(arr)) {
      const interps = arr
        .map((item) => (typeof item.interpretation === "string" ? item.interpretation : ""))
        .filter(Boolean);
      if (interps.length > 0) return interps.join("\n");
    }
  }

  return "";
}

// ====================================================================
// SortableBlock component
// ====================================================================
interface SortableBlockProps {
  block: ReportBlock;
  analyses: Analysis[];
  citationStyle: CitationStyle;
  onUpdate: (id: string, updates: Partial<ReportBlock>) => void;
  onDelete: (id: string) => void;
}

const SortableBlock: React.FC<SortableBlockProps> = memo(({ block, analyses, citationStyle, onUpdate, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : "auto",
  };

  const selectedAnalysis = block.analysisId ? analyses.find((a) => a.id === block.analysisId) : null;
  const chartAnalysis = block.chartAnalysisId ? analyses.find((a) => a.id === block.chartAnalysisId) : null;
  const tableAnalysis = block.tableAnalysisId ? analyses.find((a) => a.id === block.tableAnalysisId) : null;

  const renderContent = () => {
    switch (block.type) {
      case "analysis":
        return (
          <div className="flex flex-col gap-2">
            <select
              value={block.analysisId ?? ""}
              onChange={(e) => onUpdate(block.id, { analysisId: e.target.value || undefined })}
              className="w-full px-2 py-1.5 text-xs"
              style={{
                backgroundColor: "var(--color-bg-primary)",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-border-primary)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <option value="">分析を選択...</option>
              {analyses.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.analysisType})</option>
              ))}
            </select>
            {selectedAnalysis && (
              <div className="text-xs p-2" style={{ backgroundColor: "var(--color-bg-primary)", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border-primary)" }}>
                <p className="font-medium mb-1" style={{ color: "var(--color-text-primary)" }}>
                  {buildStatString(selectedAnalysis, citationStyle)}
                </p>
                <p className="leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                  {getInterpretation(selectedAnalysis).slice(0, 300)}
                  {getInterpretation(selectedAnalysis).length > 300 ? "..." : ""}
                </p>
              </div>
            )}
          </div>
        );

      case "chart":
        return (
          <div className="flex flex-col gap-2">
            <select
              value={block.chartAnalysisId ?? ""}
              onChange={(e) => onUpdate(block.id, { chartAnalysisId: e.target.value || undefined, chartLabel: analyses.find((a) => a.id === e.target.value)?.name })}
              className="w-full px-2 py-1.5 text-xs"
              style={{
                backgroundColor: "var(--color-bg-primary)",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-border-primary)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <option value="">チャートの分析を選択...</option>
              {analyses.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            {chartAnalysis && (
              <div className="flex items-center gap-2 p-2 text-xs" style={{ backgroundColor: "var(--color-bg-primary)", borderRadius: "var(--radius-sm)", border: "1px dashed var(--color-border-primary)", color: "var(--color-text-tertiary)" }}>
                <ChartIcon />
                <span>チャート: {chartAnalysis.name} のグラフが挿入されます</span>
              </div>
            )}
          </div>
        );

      case "text":
        return (
          <textarea
            value={block.textContent ?? ""}
            onChange={(e) => onUpdate(block.id, { textContent: e.target.value })}
            placeholder={useI18nStore.getState().t.quantitative.k_se4z4d}
            rows={4}
            className="w-full px-3 py-2 text-xs"
            style={{
              backgroundColor: "var(--color-bg-primary)",
              color: "var(--color-text-primary)",
              border: "1px solid var(--color-border-primary)",
              borderRadius: "var(--radius-sm)",
              resize: "vertical",
              minHeight: "60px",
              fontFamily: "monospace",
              outline: "none",
            }}
          />
        );

      case "table":
        return (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <select
                value={block.tableAnalysisId ?? ""}
                onChange={(e) => onUpdate(block.id, { tableAnalysisId: e.target.value || undefined })}
                className="flex-1 px-2 py-1.5 text-xs"
                style={{
                  backgroundColor: "var(--color-bg-primary)",
                  color: "var(--color-text-primary)",
                  border: "1px solid var(--color-border-primary)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <option value="">分析を選択...</option>
                {analyses.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <select
                value={block.tableType ?? "frequency"}
                onChange={(e) => onUpdate(block.id, { tableType: e.target.value as ReportBlock["tableType"] })}
                className="px-2 py-1.5 text-xs"
                style={{
                  backgroundColor: "var(--color-bg-primary)",
                  color: "var(--color-text-primary)",
                  border: "1px solid var(--color-border-primary)",
                  borderRadius: "var(--radius-sm)",
                  width: "130px",
                }}
              >
                <option value="frequency">{t.quantitative.k_s253lt}</option>
                <option value="contingency">{t.quantitative.k_cfa2k}</option>
                <option value="coefficient">{t.quantitative.k_c6kai}</option>
              </select>
            </div>
            {tableAnalysis && (
              <div className="flex items-center gap-2 p-2 text-xs" style={{ backgroundColor: "var(--color-bg-primary)", borderRadius: "var(--radius-sm)", border: "1px dashed var(--color-border-primary)", color: "var(--color-text-tertiary)" }}>
                <TableIcon />
                <span>{tableAnalysis.name} の{block.tableType === "frequency" ? useI18nStore.getState().t.quantitative.k_cd0slj : block.tableType === "contingency" ? useI18nStore.getState().t.quantitative.k_cfa2k : useI18nStore.getState().t.quantitative.k_e4fi}表が挿入されます</span>
              </div>
            )}
          </div>
        );

      case "divider":
        return (
          <div style={{ borderTop: "2px solid var(--color-border-primary)", margin: "4px 0" }} />
        );

      default:
        return null;
    }
  };

  const typeInfo = BLOCK_TYPES.find((bt) => bt.type === block.type);

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        backgroundColor: "var(--color-bg-secondary)",
        borderRadius: "var(--radius-lg)",
        border: `1px solid ${isDragging ? "var(--color-accent-primary)" : "var(--color-border-primary)"}`,
        overflow: "hidden",
      }}
    >
      {/* Block header with drag handle */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ borderBottom: block.type !== "divider" ? "1px solid var(--color-border-primary)" : "none" }}
      >
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-0.5"
          style={{ color: "var(--color-text-tertiary)", touchAction: "none" }}
        >
          <GripIcon />
        </span>
        <span style={{ color: typeInfo?.color ?? "var(--color-text-secondary)" }}>{typeInfo?.icon}</span>
        <span className="text-xs font-medium flex-1" style={{ color: "var(--color-text-secondary)" }}>
          {typeInfo?.label}
        </span>
        <button
          onClick={() => onDelete(block.id)}
          className="p-1"
          style={{ color: "var(--color-accent-danger)", cursor: "pointer", borderRadius: "var(--radius-sm)" }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--color-accent-danger) 10%, transparent)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
        >
          <TrashIcon />
        </button>
      </div>
      {/* Block content */}
      {block.type !== "divider" && (
        <div className="px-3 py-2.5">
          {renderContent()}
        </div>
      )}
    </div>
  );
});

// ====================================================================
// Main ReportBuilder component
// ====================================================================
export const ReportBuilder: React.FC<ReportBuilderProps> = ({ onClose }) => {
  const analyses = useQuantitativeStore((s) => s.analyses);
  const selectedDataset = useQuantitativeStore((s) => s.selectedDataset);
  const createNote = useNoteStore((s) => s.createNote);

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [citationStyle, setCitationStyle] = useState<CitationStyle>("apa");
  const [blocks, setBlocks] = useState<ReportBlock[]>([]);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setBlocks((prev) => {
      const oldIndex = prev.findIndex((b) => b.id === active.id);
      const newIndex = prev.findIndex((b) => b.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const addBlock = useCallback((type: BlockType) => {
    const block: ReportBlock = {
      id: newBlockId(),
      type,
      textContent: type === "text" ? "" : undefined,
      tableType: type === "table" ? "frequency" : undefined,
    };
    setBlocks((prev) => [...prev, block]);
    setAddMenuOpen(false);
  }, []);

  const updateBlock = useCallback((id: string, updates: Partial<ReportBlock>) => {
    setBlocks((prev) => prev.map((b) => b.id === id ? { ...b, ...updates } : b));
  }, []);

  const deleteBlock = useCallback((id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  // ── Generate Markdown ──
  const generateMarkdown = useCallback((): string => {
    const lines: string[] = [];

    // Header
    lines.push(`# ${title || useI18nStore.getState().t.quantitative.k_5zkqdc}`);
    lines.push("");
    if (author) lines.push(t.quantitative.k_6osg6f);
    lines.push(t.quantitative.k_4st9kc);
    if (selectedDataset) lines.push(t.quantitative.k_iojhgy);
    lines.push(t.quantitative.k_gn6b87);
    lines.push("");
    lines.push("---");
    lines.push("");

    for (const block of blocks) {
      switch (block.type) {
        case "analysis": {
          const a = analyses.find((x) => x.id === block.analysisId);
          if (a) {
            lines.push(`## ${a.name}`);
            lines.push("");
            lines.push(t.quantitative.k_91pdf);
            lines.push("");
            const interp = getInterpretation(a);
            if (interp) {
              lines.push(interp);
              lines.push("");
            }
          }
          break;
        }
        case "chart": {
          const a = analyses.find((x) => x.id === block.chartAnalysisId);
          if (a) {
            lines.push(t.quantitative.k_y4b0mh);
            lines.push("");
            lines.push(`![${a.name}](chart-${a.id}.png)`);
            lines.push("");
          }
          break;
        }
        case "text":
          if (block.textContent) {
            lines.push(block.textContent);
            lines.push("");
          }
          break;
        case "table": {
          const a = analyses.find((x) => x.id === block.tableAnalysisId);
          if (a) {
            lines.push(`### ${a.name} — ${block.tableType === "frequency" ? useI18nStore.getState().t.quantitative.k_s253lt : block.tableType === "contingency" ? useI18nStore.getState().t.quantitative.k_cfa2k : useI18nStore.getState().t.quantitative.k_c6kai}`);
            lines.push("");
            lines.push(generateTableMarkdown(a, block.tableType ?? "frequency"));
            lines.push("");
          }
          break;
        }
        case "divider":
          lines.push("---");
          lines.push("");
          break;
      }
    }

    return lines.join("\n");
  }, [title, author, today, selectedDataset, citationStyle, blocks, analyses]);

  // ── Export: Markdown to clipboard ──
  const handleCopyMarkdown = useCallback(async () => {
    try {
      const md = generateMarkdown();
      await navigator.clipboard.writeText(md);
      toast.success(useI18nStore.getState().t.qualitative.k_rexm4q);
    } catch {
      toast.error(useI18nStore.getState().t.quantitative.k_czy3x7);
    }
  }, [generateMarkdown]);

  // ── Export: Save as Markdown file ──
  const handleSaveMarkdown = useCallback(async () => {
    try {
      const md = generateMarkdown();
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title || "report"}.md`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(useI18nStore.getState().t.quantitative.k_3qxq6y);
    } catch {
      toast.error(useI18nStore.getState().t.quantitative.k_r6tyd);
    }
  }, [generateMarkdown, title]);

  // ── Export: Create Note ──
  const handleCreateNote = useCallback(async () => {
    setExporting(true);
    try {
      const md = generateMarkdown();

      // Build tags
      const tags = [useI18nStore.getState().t.quantitative.k_jf913u];
      const usedTypes = new Set(
        blocks
          .map((b) => {
            const aId = b.analysisId ?? b.chartAnalysisId ?? b.tableAnalysisId;
            return aId ? analyses.find((a) => a.id === aId)?.analysisType : null;
          })
          .filter(Boolean) as string[],
      );
      for (const t of usedTypes) tags.push(`#${t}`);

      const note = await createNote({
        title: title || useI18nStore.getState().t.quantitative.k_5zkqdc,
        content: md,
        tags,
      });

      toast.success(t.qualitative.k_fpwqww);
    } catch (err) {
      toast.error(useI18nStore.getState().t.notes.createFailed);
      console.error(err);
    } finally {
      setExporting(false);
    }
  }, [generateMarkdown, title, blocks, analyses, createNote]);

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: "var(--z-modal)", backgroundColor: "rgba(0,0,0,0.5)" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="flex flex-col"
        style={{
          width: "820px",
          maxWidth: "95vw",
          height: "85vh",
          backgroundColor: "var(--color-bg-primary)",
          borderRadius: "var(--radius-xl)",
          border: "1px solid var(--color-border-primary)",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
          animation: "scaleIn var(--transition-normal) ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          className="shrink-0 flex items-center justify-between px-6"
          style={{ height: "52px", borderBottom: "1px solid var(--color-border-primary)" }}
        >
          <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            レポート作成
          </span>
          <button
            onClick={onClose}
            className="p-1"
            style={{ color: "var(--color-text-tertiary)", borderRadius: "var(--radius-sm)", cursor: "pointer" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-bg-hover)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Scroll container ── */}
        <div className="flex-1 overflow-y-auto scrollable-area">
          <div className="px-6 py-5 flex flex-col gap-5">
            {/* Report meta */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <label className="text-xs font-medium mb-1 block" style={{ color: "var(--color-text-secondary)" }}>レポートタイトル</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={useI18nStore.getState().t.quantitative.k_cndyfp}
                  className="w-full px-3 py-2 text-xs"
                  style={{
                    backgroundColor: "var(--color-bg-secondary)",
                    color: "var(--color-text-primary)",
                    border: "1px solid var(--color-border-primary)",
                    borderRadius: "var(--radius-md)",
                    outline: "none",
                  }}
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "var(--color-text-secondary)" }}>著者名</label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder={useI18nStore.getState().t.quantitative.k_1rui8f}
                  className="w-full px-3 py-2 text-xs"
                  style={{
                    backgroundColor: "var(--color-bg-secondary)",
                    color: "var(--color-text-primary)",
                    border: "1px solid var(--color-border-primary)",
                    borderRadius: "var(--radius-md)",
                    outline: "none",
                  }}
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "var(--color-text-secondary)" }}>{t.tabs.citation}</label>
                <div className="flex gap-1">
                  {(Object.entries(CITATION_LABELS) as [CitationStyle, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setCitationStyle(key)}
                      className="px-2 py-1.5 text-xs font-medium"
                      style={{
                        color: citationStyle === key ? "#fff" : "var(--color-text-secondary)",
                        backgroundColor: citationStyle === key ? "var(--color-accent-primary)" : "var(--color-bg-secondary)",
                        border: `1px solid ${citationStyle === key ? "var(--color-accent-primary)" : "var(--color-border-primary)"}`,
                        borderRadius: "var(--radius-sm)",
                        cursor: "pointer",
                        fontSize: "10px",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Date (auto) */}
            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--color-text-tertiary)" }}>
              <span>日付: {today}</span>
              {selectedDataset && <span>| データセット: {selectedDataset.name}</span>}
            </div>

            {/* Blocks area */}
            <div>
              <h3 className="text-xs font-semibold mb-3 tracking-wide uppercase" style={{ color: "var(--color-text-tertiary)", letterSpacing: "0.08em" }}>
                レポートブロック
              </h3>

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-2.5">
                    {blocks.map((block) => (
                      <SortableBlock
                        key={block.id}
                        block={block}
                        analyses={analyses}
                        citationStyle={citationStyle}
                        onUpdate={updateBlock}
                        onDelete={deleteBlock}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {blocks.length === 0 && (
                <div
                  className="flex flex-col items-center justify-center py-10 text-center"
                  style={{ color: "var(--color-text-tertiary)", borderRadius: "var(--radius-lg)", border: "2px dashed var(--color-border-primary)" }}
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ opacity: 0.4 }} className="mb-2">
                    <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
                  </svg>
                  <p className="text-xs">下の「ブロックを追加」ボタンからレポートを組み立ててください</p>
                </div>
              )}

              {/* Add block button */}
              <div className="relative mt-3">
                <button
                  onClick={() => setAddMenuOpen(!addMenuOpen)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium"
                  style={{
                    color: "var(--color-accent-primary)",
                    backgroundColor: "color-mix(in srgb, var(--color-accent-primary) 6%, transparent)",
                    border: "1px dashed var(--color-accent-primary)",
                    borderRadius: "var(--radius-md)",
                    cursor: "pointer",
                    transition: "all var(--transition-fast)",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--color-accent-primary) 12%, transparent)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--color-accent-primary) 6%, transparent)"; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  ブロックを追加
                </button>

                {addMenuOpen && (
                  <div
                    className="absolute left-0 right-0 mt-1 z-50 flex flex-col py-1"
                    style={{
                      backgroundColor: "var(--color-bg-primary)",
                      border: "1px solid var(--color-border-primary)",
                      borderRadius: "var(--radius-md)",
                      boxShadow: "var(--shadow-lg)",
                    }}
                  >
                    {BLOCK_TYPES.map((bt) => (
                      <button
                        key={bt.type}
                        onClick={() => addBlock(bt.type)}
                        className="flex items-center gap-2.5 px-4 py-2 text-xs text-left"
                        style={{ color: "var(--color-text-primary)", cursor: "pointer" }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-bg-hover)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                      >
                        <span style={{ color: bt.color }}>{bt.icon}</span>
                        <span className="font-medium">{bt.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer: Export actions ── */}
        <div
          className="shrink-0 flex items-center justify-between px-6"
          style={{
            height: "56px",
            borderTop: "1px solid var(--color-border-primary)",
            backgroundColor: "var(--color-bg-secondary)",
          }}
        >
          <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
            {blocks.length} ブロック
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void handleSaveMarkdown()}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium"
              style={{
                color: "var(--color-text-primary)",
                backgroundColor: "var(--color-bg-primary)",
                border: "1px solid var(--color-border-primary)",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-bg-hover)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--color-bg-primary)"; }}
            >
              <SaveIcon /> Markdownで保存
            </button>
            <button
              onClick={() => void handleCreateNote()}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium"
              style={{
                color: "#fff",
                backgroundColor: "var(--color-accent-primary)",
                borderRadius: "var(--radius-md)",
                cursor: exporting ? "not-allowed" : "pointer",
                opacity: exporting ? 0.6 : 1,
              }}
            >
              <NoteIcon /> {exporting ? useI18nStore.getState().t.qualitative.k_2zb0kr : useI18nStore.getState().t.quantitative.k_4tjifo}
            </button>
            <button
              onClick={() => void handleCopyMarkdown()}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium"
              style={{
                color: "var(--color-text-primary)",
                backgroundColor: "var(--color-bg-primary)",
                border: "1px solid var(--color-border-primary)",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-bg-hover)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--color-bg-primary)"; }}
            >
              <CopyIcon /> テキストをコピー
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ====================================================================
// Table Markdown generator helper
// ====================================================================
function generateTableMarkdown(analysis: Analysis, tableType: string): string {
  const r = analysis.result as Record<string, unknown> | null;
  if (!r) return useI18nStore.getState().t.quantitative.k_lbqwcj;

  if (tableType === "frequency") {
    // Look for frequency tables
    const freqs = (r.frequencies as Array<Record<string, unknown>>) ?? [];
    if (freqs.length === 0) return useI18nStore.getState().t.quantitative.k_stosas;
    const lines: string[] = [];
    for (const freq of freqs) {
      const name = freq.variableName as string ?? useI18nStore.getState().t.quantitative.k_fp8n;
      const rows = (freq.rows as Array<Record<string, unknown>>) ?? [];
      lines.push(`**${name}**`);
      lines.push("");
      lines.push(useI18nStore.getState().t.quantitative.k_wh35ei);
      lines.push("|---|---|---|---|");
      for (const row of rows) {
        lines.push(`| ${row.value} | ${row.count} | ${(row.percent as number ?? 0).toFixed(1)} | ${(row.cumPercent as number ?? 0).toFixed(1)} |`);
      }
      lines.push("");
    }
    return lines.join("\n");
  }

  if (tableType === "contingency") {
    const chiResults = (r.chiSquareResults as Array<Record<string, unknown>>) ?? [];
    if (chiResults.length === 0) return useI18nStore.getState().t.quantitative.k_morh23;
    const lines: string[] = [];
    for (const chi of chiResults) {
      const rowLabels = (chi.rowLabels as string[]) ?? [];
      const colLabels = (chi.colLabels as string[]) ?? [];
      const table = (chi.contingencyTable as Array<Array<Record<string, number>>>) ?? [];
      lines.push(`| | ${colLabels.join(" | ")} |`);
      lines.push(`|---|${colLabels.map(() => "---").join("|")}|`);
      for (let i = 0; i < rowLabels.length; i++) {
        const cells = (table[i] ?? []).map((c) => String(c.observed ?? 0));
        lines.push(`| ${rowLabels[i]} | ${cells.join(" | ")} |`);
      }
      lines.push("");
    }
    return lines.join("\n");
  }

  if (tableType === "coefficient") {
    // Regression coefficients or correlation matrix
    const coefficients = (r.coefficients as Array<Record<string, unknown>>) ?? [];
    if (coefficients.length > 0) {
      const lines: string[] = [];
      lines.push(useI18nStore.getState().t.quantitative.k_oj4l51);
      lines.push("|---|---|---|---|---|");
      for (const coef of coefficients) {
        lines.push(`| ${coef.varName} | ${(coef.b as number).toFixed(3)} | ${(coef.stdError as number).toFixed(3)} | ${(coef.t as number).toFixed(2)} | ${(coef.pValue as number).toFixed(3)} |`);
      }
      return lines.join("\n");
    }
    // Correlation matrix
    const correlations = (r.correlations as Array<Record<string, unknown>>) ?? [];
    if (correlations.length > 0) {
      const lines: string[] = [];
      lines.push(useI18nStore.getState().t.quantitative.k_5aijhf);
      lines.push("|---|---|---|---|");
      for (const corr of correlations) {
        lines.push(`| ${corr.var1Name} | ${corr.var2Name} | ${(corr.r as number).toFixed(3)} | ${(corr.pValue as number).toFixed(3)} |`);
      }
      return lines.join("\n");
    }
    return useI18nStore.getState().t.quantitative.k_x8sr4l;
  }

  return useI18nStore.getState().t.quantitative.k_jq1vax;
}
