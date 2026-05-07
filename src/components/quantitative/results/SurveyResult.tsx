// src/components/quantitative/results/SurveyResult.tsx
// Stellar — 調査データ結果表示コンポーネント
// DivergingStackedBar（リッカート尺度）+ CrossTabResult
// パフォーマンス最適化: React.memo, useMemo

import type React from "react";
import { useMemo, memo, useRef, useState, useCallback } from "react";
import type { Analysis, Variable, DataRow } from "../../../types";
import { DivergingStackedBar } from "../charts";
import { fmt } from "../charts/chartTheme";
import { downloadSVG, downloadPNG } from "../../../lib/utils/exportChart";
import { useI18nStore } from "../../../stores/useI18nStore";

interface Props {
  analysis: Analysis;
  variables: Variable[];
  dataRows: DataRow[];
}

// ── SVGアイコン ──
const ClipboardIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    <path d="M9 14l2 2 4-4" />
  </svg>
);

const BarChartIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const GridIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18" />
    <path d="M3 15h18" />
    <path d="M9 3v18" />
  </svg>
);

const EmptyIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35 }}>

    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

// ============================================================================
// ExportButton
// ============================================================================
const ExportButton = memo<{ containerRef: React.RefObject<HTMLDivElement | null>; name: string }>(
  ({ containerRef, name }) => {
    const [open, setOpen] = useState(false);

    const handleExport = useCallback(
      (format: "svg" | "png") => {
        const svg = containerRef.current?.querySelector("svg");
        if (!svg) return;
        const filename = `${name}_${Date.now()}`;
        if (format === "svg") downloadSVG(svg, filename);
        else downloadPNG(svg, filename).catch(console.error);
        setOpen(false);
      },
      [containerRef, name],
    );

    return (
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1 px-1.5 py-1 text-xs"
          style={{ color: "var(--color-text-tertiary)", cursor: "pointer", borderRadius: "var(--radius-sm)" }}
        >
          <DownloadIcon />
        </button>
        {open && (
          <div
            className="absolute right-0 top-full mt-1 z-50 flex flex-col gap-0.5 p-1"
            style={{
              backgroundColor: "var(--color-bg-primary)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border-primary)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              minWidth: "80px",
            }}
          >
            {(["svg", "png"] as const).map((f) => (
              <button
                key={f}
                onClick={() => handleExport(f)}
                className="px-2 py-1.5 text-xs text-left"
                style={{ color: "var(--color-text-secondary)", cursor: "pointer", borderRadius: "var(--radius-sm)" }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-bg-hover)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                {f.toUpperCase()} {useI18nStore.getState().t.common.save}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  },
);

// ============================================================================
// CrossTabResult — クロス集計表（メモ化済み）
// ============================================================================
const CrossTabResult = memo<{
  rowVar: string;
  colVar: string;
  dataRows: DataRow[];
  chiSquareResult?: {
    chi2: number;
    df: number;
    pValue: number;
    cramersV: number;
    significant: boolean;
    interpretation: string;
  } | null;
}>(({ rowVar, colVar, dataRows, chiSquareResult }) => {
  // クロス集計計算
  const { rowLabels, colLabels, table, rowTotals, colTotals, grandTotal } = useMemo(() => {
    const rowVals = new Set<string>();
    const colVals = new Set<string>();

    for (const row of dataRows) {
      const rv = row.values[rowVar];
      const cv = row.values[colVar];
      if (rv != null && rv !== "") rowVals.add(String(rv));
      if (cv != null && cv !== "") colVals.add(String(cv));
    }

    const rl = [...rowVals].sort();
    const cl = [...colVals].sort();

    const tbl = rl.map(() => cl.map(() => 0));
    for (const row of dataRows) {
      const rv = String(row.values[rowVar] ?? "");
      const cv = String(row.values[colVar] ?? "");
      const ri = rl.indexOf(rv);
      const ci = cl.indexOf(cv);
      if (ri >= 0 && ci >= 0) tbl[ri]![ci]!++;
    }

    const rt = tbl.map((row) => row.reduce((s, v) => s + v, 0));
    const ct = cl.map((_, ci) => tbl.reduce((s, row) => s + (row[ci] ?? 0), 0));
    const gt = rt.reduce((s, v) => s + v, 0);

    return { rowLabels: rl, colLabels: cl, table: tbl, rowTotals: rt, colTotals: ct, grandTotal: gt };
  }, [rowVar, colVar, dataRows]);

  return (
    <div
      className="p-5"
      style={{
        backgroundColor: "var(--color-bg-secondary)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border-primary)",
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
          クロス集計: {rowVar} × {colVar}
        </span>
      </div>

      <div className="overflow-x-auto mb-4">
        <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th
                className="py-2 px-2 text-left font-medium"
                style={{ color: "var(--color-text-tertiary)", borderBottom: "2px solid var(--color-border-primary)", fontSize: "10px" }}
              >
                {rowVar} \ {colVar}
              </th>
              {colLabels.map((cl) => (
                <th
                  key={cl}
                  className="py-2 px-2 text-center font-medium"
                  style={{ color: "var(--color-text-tertiary)", borderBottom: "2px solid var(--color-border-primary)", fontSize: "10px" }}
                >
                  {cl}
                </th>
              ))}
              <th
                className="py-2 px-2 text-center font-semibold"
                style={{ color: "var(--color-text-primary)", borderBottom: "2px solid var(--color-border-primary)", fontSize: "10px" }}
              >
                合計
              </th>
            </tr>
          </thead>
          <tbody>
            {table.map((row, ri) => (
              <tr key={ri}>
                <td
                  className="py-2 px-2 font-medium"
                  style={{ color: "var(--color-text-primary)", borderBottom: "1px solid var(--color-border-primary)", fontSize: "11px" }}
                >
                  {rowLabels[ri]}
                </td>
                {row.map((count, ci) => {
                  const rowTotal = rowTotals[ri] ?? 1;
                  const pct = rowTotal > 0 ? (count / rowTotal) * 100 : 0;
                  return (
                    <td
                      key={ci}
                      className="py-2 px-2 text-center"
                      style={{ borderBottom: "1px solid var(--color-border-primary)", color: "var(--color-text-primary)", fontSize: "11px" }}
                    >
                      <div className="font-semibold">{count}</div>
                      <div style={{ color: "var(--color-text-tertiary)", fontSize: "9px" }}>
                        ({fmt(pct)}%)
                      </div>
                    </td>
                  );
                })}
                <td
                  className="py-2 px-2 text-center font-semibold"
                  style={{
                    borderBottom: "1px solid var(--color-border-primary)",
                    color: "var(--color-text-primary)",
                    fontSize: "11px",
                    backgroundColor: "color-mix(in srgb, var(--color-bg-hover) 50%, transparent)",
                  }}
                >
                  {rowTotals[ri]}
                </td>
              </tr>
            ))}
            {/* 列合計行 */}
            <tr>
              <td
                className="py-2 px-2 font-semibold"
                style={{ color: "var(--color-text-primary)", borderTop: "2px solid var(--color-border-primary)", fontSize: "10px" }}
              >
                合計
              </td>
              {colTotals.map((ct, ci) => (
                <td
                  key={ci}
                  className="py-2 px-2 text-center font-semibold"
                  style={{
                    color: "var(--color-text-primary)",
                    borderTop: "2px solid var(--color-border-primary)",
                    fontSize: "11px",
                    backgroundColor: "color-mix(in srgb, var(--color-bg-hover) 50%, transparent)",
                  }}
                >
                  {ct}
                </td>
              ))}
              <td
                className="py-2 px-2 text-center font-bold"
                style={{
                  color: "var(--color-accent-primary)",
                  borderTop: "2px solid var(--color-border-primary)",
                  fontSize: "11px",
                  backgroundColor: "color-mix(in srgb, var(--color-bg-hover) 50%, transparent)",
                }}
              >
                {grandTotal}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* カイ二乗結果 */}
      {chiSquareResult && (
        <div
          className="p-3"
          style={{
            backgroundColor: "color-mix(in srgb, var(--color-accent-primary) 5%, var(--color-bg-primary))",
            borderRadius: "var(--radius-md)",
            border: "1px solid color-mix(in srgb, var(--color-accent-primary) 20%, transparent)",
          }}
        >
          <div className="flex items-center gap-3 mb-2">
            <span
              className="px-2 py-0.5 text-xs font-semibold"
              style={{
                backgroundColor: chiSquareResult.significant
                  ? "color-mix(in srgb, var(--color-accent-secondary) 15%, transparent)"
                  : "color-mix(in srgb, var(--color-text-tertiary) 10%, transparent)",
                color: chiSquareResult.significant
                  ? "var(--color-accent-secondary)"
                  : "var(--color-text-tertiary)",
                borderRadius: "var(--radius-sm)",
                fontSize: "10px",
              }}
            >
              {chiSquareResult.significant ? useI18nStore.getState().t.quantResults.str_i23q : useI18nStore.getState().t.quantResults.str_mo7pg}
            </span>
            <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
              X2({chiSquareResult.df}) = {fmt(chiSquareResult.chi2, 2)}, p = {chiSquareResult.pValue < 0.001 ? "< .001" : fmt(chiSquareResult.pValue, 3)}, V = {fmt(chiSquareResult.cramersV, 3)}
            </span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            {chiSquareResult.interpretation}
          </p>
        </div>
      )}
    </div>
  );
});

// ============================================================================
// SurveyResult メインコンポーネント
// ============================================================================
export const SurveyResult: React.FC<Props> = ({ analysis, variables, dataRows }) => {
  const result = analysis.result as Record<string, unknown> | null;
  const config = (analysis.config as Record<string, unknown>) ?? {};
  const likertChartRef = useRef<HTMLDivElement>(null);

  // リッカート変数の集計データ生成
  const likertItems = useMemo(() => {
    if (!result) return [];

    const selectedVarIds = (config.selectedVarIds as string[]) ?? [];
    const items: Array<{
      label: string;
      counts: number[];
      labels: string[];
    }> = [];

    for (const vid of selectedVarIds) {
      const v = variables.find((vv) => vv.id === vid);
      if (!v) continue;
      if (v.variableType !== "ordinal" && v.variableType !== "scale") continue;

      const likertLabels = v.likertLabels ?? [];
      const vals = dataRows
        .map((r) => r.values[v.name])
        .filter((val) => val != null && val !== "")
        .map((val) => Number(val))
        .filter((n) => Number.isFinite(n));

      if (vals.length === 0) continue;

      const minVal = v.min ?? Math.min(...vals);
      const maxVal = v.max ?? Math.max(...vals);
      const nLevels = Math.round(maxVal - minVal) + 1;

      if (nLevels < 2 || nLevels > 10) continue;

      const counts = new Array(nLevels).fill(0) as number[];
      for (const val of vals) {
        const idx = Math.round(val - minVal);
        if (idx >= 0 && idx < nLevels) counts[idx]!++;
      }

      const labels =
        likertLabels.length === nLevels
          ? likertLabels.map((ll) => ll.label)
          : Array.from({ length: nLevels }, (_, i) => String(minVal + i));

      items.push({ label: v.label || v.name, counts, labels });
    }

    return items;
  }, [result, config, variables, dataRows]);

  // リッカート要約テーブルデータ
  const likertSummary = useMemo(() => {
    return likertItems.map((item) => {
      const total = item.counts.reduce((s, c) => s + c, 0);
      const nLevels = item.counts.length;
      const midIndex = Math.floor(nLevels / 2);

      let sum = 0;
      for (let i = 0; i < nLevels; i++) {
        sum += (item.counts[i] ?? 0) * (i + 1);
      }
      const mean = total > 0 ? sum / total : 0;

      let variance = 0;
      for (let i = 0; i < nLevels; i++) {
        variance += (item.counts[i] ?? 0) * Math.pow(i + 1 - mean, 2);
      }
      const sd = total > 1 ? Math.sqrt(variance / (total - 1)) : 0;

      const positiveCount = item.counts
        .slice(nLevels % 2 === 1 ? midIndex + 1 : midIndex)
        .reduce((s, c) => s + c, 0);
      const positiveRate = total > 0 ? (positiveCount / total) * 100 : 0;

      return { label: item.label, total, mean, sd, positiveRate };
    });
  }, [likertItems]);

  // クロス集計用データ
  const crossTabPairs = useMemo(() => {
    if (!result) return [];
    const selectedVarIds = (config.selectedVarIds as string[]) ?? [];
    const nomVars = selectedVarIds
      .map((id) => variables.find((v) => v.id === id))
      .filter(
        (v): v is Variable =>
          v != null && (v.variableType === "nominal" || v.variableType === "ordinal"),
      );

    const pairs: Array<{ rowVar: string; colVar: string }> = [];
    for (let i = 0; i < nomVars.length; i++) {
      for (let j = i + 1; j < nomVars.length; j++) {
        pairs.push({
          rowVar: nomVars[i]!.name,
          colVar: nomVars[j]!.name,
        });
      }
    }
    return pairs;
  }, [result, config, variables]);

  if (!result) return null;

  return (
    <div className="h-full overflow-y-auto p-6 scrollable-area">
      <h3
        className="text-sm font-semibold mb-4 flex items-center gap-2"
        style={{ color: "var(--color-text-primary)" }}
      >
        <ClipboardIcon />
        {analysis.name}
      </h3>

      {/* ── リッカート集計チャート ── */}
      {likertItems.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h4
              className="text-xs font-semibold flex items-center gap-2"
              style={{ color: "var(--color-text-secondary)" }}
            >
              <BarChartIcon />
              リッカート尺度集計
            </h4>
            <ExportButton containerRef={likertChartRef} name="likert_summary" />
          </div>
          <div
            ref={likertChartRef}
            className="p-4 overflow-x-auto"
            style={{
              backgroundColor: "var(--color-bg-secondary)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--color-border-primary)",
            }}
          >
            {/* DivergingStackedBar コンポーネント使用 */}
            <DivergingStackedBar items={likertItems} />

            {/* 各項目の要約テーブル */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {[useI18nStore.getState().t.quantResults.str_qidl, "n", useI18nStore.getState().t.quantResults.str_gjlg, "SD", useI18nStore.getState().t.quantResults.str_jardo].map((h) => (
                      <th
                        key={h}
                        className="py-1.5 px-2 text-left font-medium"
                        style={{
                          color: "var(--color-text-tertiary)",
                          borderBottom: "1px solid var(--color-border-primary)",
                          fontSize: "10px",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {likertSummary.map((item) => (
                    <tr key={item.label}>
                      <td className="py-1.5 px-2" style={{ color: "var(--color-text-primary)", borderBottom: "1px solid var(--color-border-primary)" }}>
                        {item.label}
                      </td>
                      <td className="py-1.5 px-2 text-right" style={{ color: "var(--color-text-secondary)", borderBottom: "1px solid var(--color-border-primary)" }}>
                        {item.total}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono" style={{ color: "var(--color-text-primary)", borderBottom: "1px solid var(--color-border-primary)" }}>
                        {fmt(item.mean, 2)}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono" style={{ color: "var(--color-text-secondary)", borderBottom: "1px solid var(--color-border-primary)" }}>
                        {fmt(item.sd, 2)}
                      </td>
                      <td
                        className="py-1.5 px-2 text-right"
                        style={{
                          color: item.positiveRate >= 50
                            ? "var(--color-accent-secondary)"
                            : "var(--color-accent-danger)",
                          borderBottom: "1px solid var(--color-border-primary)",
                          fontWeight: 600,
                        }}
                      >
                        {fmt(item.positiveRate)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── クロス集計表 ── */}
      {crossTabPairs.length > 0 && (
        <div className="mb-6">
          <h4
            className="text-xs font-semibold mb-3 flex items-center gap-2"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <GridIcon />
            クロス集計
          </h4>
          <div className="flex flex-col gap-4">
            {crossTabPairs.map((pair, i) => (
              <CrossTabResult
                key={i}
                rowVar={pair.rowVar}
                colVar={pair.colVar}
                dataRows={dataRows}
              />
            ))}
          </div>
        </div>
      )}

      {/* 空状態 */}
      {likertItems.length === 0 && crossTabPairs.length === 0 && (
        <div
          className="flex flex-col items-center justify-center py-12 gap-4"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          <EmptyIcon />
          <p className="text-xs">
            調査データの集計結果を表示するには、順序変数（リッカート尺度）を含むデータセットが必要です
          </p>
        </div>
      )}
    </div>
  );
};
