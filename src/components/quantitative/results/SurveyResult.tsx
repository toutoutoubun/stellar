// src/components/quantitative/results/SurveyResult.tsx
// Stellar — 調査データ結果表示コンポーネント
// LikertSummaryChart（ダイバージング積み上げ棒グラフ）+ CrossTabResult

import type React from "react";
import { useRef, useEffect, useMemo } from "react";
import * as d3 from "d3";
import type { Analysis, Variable, DataRow } from "../../../types";

interface Props {
  analysis: Analysis;
  variables: Variable[];
  dataRows: DataRow[];
}

// ── テーマカラー取得 ──
function getCSSVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function fmt(v: number, dp = 1): string {
  if (!Number.isFinite(v)) return "—";
  return v.toFixed(dp);
}

// ── リッカート色スキーム（5段階: 否定→中立→肯定） ──
const LIKERT_COLORS_LIGHT = ["#e03131", "#fa5252", "#ced4da", "#69db7c", "#2f9e44"];
const LIKERT_COLORS_DARK = ["#c92a2a", "#e03131", "#868e96", "#51cf66", "#37b24d"];

function getLikertColors(): string[] {
  const bg = getCSSVar("--color-bg-primary") || "#fff";
  // 暗いテーマかチェック
  const r = parseInt(bg.slice(1, 3), 16) || 255;
  return r < 128 ? LIKERT_COLORS_DARK : LIKERT_COLORS_LIGHT;
}

// ============================================================================
// LikertSummaryChart — ダイバージング積み上げ棒グラフ (D3)
// ============================================================================
const LikertSummaryChart: React.FC<{
  items: Array<{
    label: string;
    counts: number[]; // 各レベルの件数（例: [10, 15, 30, 25, 20]）
    labels: string[]; // レベルラベル
  }>;
  width?: number;
}> = ({ items, width = 560 }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const rowHeight = 36;
  const height = items.length * rowHeight + 60;

  useEffect(() => {
    if (!svgRef.current || items.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 30, right: 80, bottom: 24, left: 140 };
    const w = width - margin.left - margin.right;
    const h = items.length * rowHeight;

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const textColor = getCSSVar("--color-text-primary") || "#333";
    const textSecondary = getCSSVar("--color-text-tertiary") || "#888";
    const colors = getLikertColors();
    const nLevels = items[0]?.counts.length ?? 5;

    // 中央をゼロとして、否定側を左・肯定側を右に配置
    const midIndex = Math.floor(nLevels / 2);

    // 各アイテムのデータを正規化して diverging 形式に
    const processedItems = items.map((item) => {
      const total = item.counts.reduce((s, c) => s + c, 0);
      if (total === 0) return { label: item.label, segments: [], total: 0 };

      const pcts = item.counts.map((c) => (c / total) * 100);
      const segments: Array<{
        x0: number;
        x1: number;
        pct: number;
        color: string;
        levelLabel: string;
        count: number;
      }> = [];

      // 左側 (否定: 0 ~ midIndex-1)
      let leftAccum = 0;
      for (let i = midIndex - 1; i >= 0; i--) {
        const p = pcts[i] ?? 0;
        segments.push({
          x0: -(leftAccum + p),
          x1: -leftAccum,
          pct: p,
          color: colors[i] ?? "#ccc",
          levelLabel: item.labels[i] ?? String(i + 1),
          count: item.counts[i] ?? 0,
        });
        leftAccum += p;
      }

      // 中央 (奇数レベルの場合)
      if (nLevels % 2 === 1) {
        const mid = pcts[midIndex] ?? 0;
        segments.push({
          x0: -mid / 2,
          x1: mid / 2,
          pct: mid,
          color: colors[midIndex] ?? "#ccc",
          levelLabel: item.labels[midIndex] ?? String(midIndex + 1),
          count: item.counts[midIndex] ?? 0,
        });
      }

      // 右側 (肯定: midIndex+1 ~ nLevels-1)  ※奇数:midIndex+1, 偶数:midIndex
      let rightAccum = 0;
      const rightStart = nLevels % 2 === 1 ? midIndex + 1 : midIndex;
      for (let i = rightStart; i < nLevels; i++) {
        const p = pcts[i] ?? 0;
        segments.push({
          x0: rightAccum,
          x1: rightAccum + p,
          pct: p,
          color: colors[i] ?? "#ccc",
          levelLabel: item.labels[i] ?? String(i + 1),
          count: item.counts[i] ?? 0,
        });
        rightAccum += p;
      }

      return { label: item.label, segments, total };
    });

    // X スケール
    const maxExtent = d3.max(processedItems, (d) => {
      const minX = d3.min(d.segments, (s) => s.x0) ?? -50;
      const maxX = d3.max(d.segments, (s) => s.x1) ?? 50;
      return Math.max(Math.abs(minX), Math.abs(maxX));
    }) ?? 50;

    const x = d3.scaleLinear().domain([-maxExtent, maxExtent]).range([0, w]);

    // Y スケール
    const y = d3
      .scaleBand()
      .domain(processedItems.map((d) => d.label))
      .range([0, h])
      .padding(0.25);

    // 中央線
    g.append("line")
      .attr("x1", x(0))
      .attr("x2", x(0))
      .attr("y1", -4)
      .attr("y2", h + 4)
      .attr("stroke", textSecondary)
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3 3")
      .attr("opacity", 0.5);

    // 棒を描画
    for (const item of processedItems) {
      for (const seg of item.segments) {
        g.append("rect")
          .attr("x", x(seg.x0))
          .attr("y", y(item.label)!)
          .attr("width", Math.max(0, x(seg.x1) - x(seg.x0)))
          .attr("height", y.bandwidth())
          .attr("fill", seg.color)
          .attr("rx", 2);
      }

      // パーセンテージラベル（右端）
      const total = item.total;
      if (total > 0) {
        const positiveSum = item.segments
          .filter((s) => s.x1 > 0 && s.x0 >= 0)
          .reduce((s, seg) => s + seg.pct, 0);
        g.append("text")
          .attr("x", w + 8)
          .attr("y", (y(item.label) ?? 0) + y.bandwidth() / 2)
          .attr("dominant-baseline", "middle")
          .attr("font-size", "10px")
          .attr("fill", textSecondary)
          .text(`${positiveSum.toFixed(0)}%`);
      }
    }

    // 行ラベル（左側）
    g.selectAll(".row-label")
      .data(processedItems)
      .join("text")
      .attr("class", "row-label")
      .attr("x", -8)
      .attr("y", (d) => (y(d.label) ?? 0) + y.bandwidth() / 2)
      .attr("text-anchor", "end")
      .attr("dominant-baseline", "middle")
      .attr("font-size", "10px")
      .attr("fill", textColor)
      .text((d) => d.label.length > 18 ? d.label.slice(0, 17) + "..." : d.label);

    // 凡例
    const legendG = svg
      .append("g")
      .attr("transform", `translate(${margin.left}, 6)`);

    const levelLabels = items[0]?.labels ?? [];
    let legendX = 0;
    for (let i = 0; i < nLevels; i++) {
      legendG
        .append("rect")
        .attr("x", legendX)
        .attr("y", 0)
        .attr("width", 10)
        .attr("height", 10)
        .attr("fill", colors[i] ?? "#ccc")
        .attr("rx", 2);

      legendG
        .append("text")
        .attr("x", legendX + 14)
        .attr("y", 9)
        .attr("font-size", "9px")
        .attr("fill", textSecondary)
        .text(levelLabels[i] ?? String(i + 1));

      legendX += 14 + (levelLabels[i]?.length ?? 1) * 7 + 8;
    }
  }, [items, width]);

  return <svg ref={svgRef} width={width} height={height} />;
};

// ============================================================================
// CrossTabResult — クロス集計表
// ============================================================================
const CrossTabResult: React.FC<{
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
}> = ({ rowVar, colVar, dataRows, chiSquareResult }) => {
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

    return {
      rowLabels: rl,
      colLabels: cl,
      table: tbl,
      rowTotals: rt,
      colTotals: ct,
      grandTotal: gt,
    };
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
                style={{
                  color: "var(--color-text-tertiary)",
                  borderBottom: "2px solid var(--color-border-primary)",
                  fontSize: "10px",
                }}
              >
                {rowVar} \ {colVar}
              </th>
              {colLabels.map((cl) => (
                <th
                  key={cl}
                  className="py-2 px-2 text-center font-medium"
                  style={{
                    color: "var(--color-text-tertiary)",
                    borderBottom: "2px solid var(--color-border-primary)",
                    fontSize: "10px",
                  }}
                >
                  {cl}
                </th>
              ))}
              <th
                className="py-2 px-2 text-center font-semibold"
                style={{
                  color: "var(--color-text-primary)",
                  borderBottom: "2px solid var(--color-border-primary)",
                  fontSize: "10px",
                }}
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
                  style={{
                    color: "var(--color-text-primary)",
                    borderBottom: "1px solid var(--color-border-primary)",
                    fontSize: "11px",
                  }}
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
                      style={{
                        borderBottom: "1px solid var(--color-border-primary)",
                        color: "var(--color-text-primary)",
                        fontSize: "11px",
                      }}
                    >
                      <div className="font-semibold">{count}</div>
                      <div
                        style={{
                          color: "var(--color-text-tertiary)",
                          fontSize: "9px",
                        }}
                      >
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
                style={{
                  color: "var(--color-text-primary)",
                  borderTop: "2px solid var(--color-border-primary)",
                  fontSize: "10px",
                }}
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
              {chiSquareResult.significant ? "有意" : "非有意"}
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
};

// ============================================================================
// SurveyResult メインコンポーネント
// ============================================================================
export const SurveyResult: React.FC<Props> = ({ analysis, variables, dataRows }) => {
  const result = analysis.result as Record<string, unknown> | null;
  const config = (analysis.config as Record<string, unknown>) ?? {};

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

      // リッカートラベルがある場合使用
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

      const counts = new Array(nLevels).fill(0);
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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          <path d="M9 14l2 2 4-4" />
        </svg>
        {analysis.name}
      </h3>

      {/* ── リッカート集計チャート ── */}
      {likertItems.length > 0 && (
        <div className="mb-6">
          <h4
            className="text-xs font-semibold mb-3 flex items-center gap-2"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            リッカート尺度集計
          </h4>
          <div
            className="p-4 overflow-x-auto"
            style={{
              backgroundColor: "var(--color-bg-secondary)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--color-border-primary)",
            }}
          >
            <LikertSummaryChart items={likertItems} />

            {/* 各項目の要約テーブル */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["項目", "n", "平均", "SD", "肯定率"].map((h) => (
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
                  {likertItems.map((item) => {
                    const total = item.counts.reduce((s, c) => s + c, 0);
                    const nLevels = item.counts.length;
                    const midIndex = Math.floor(nLevels / 2);

                    // 加重平均
                    let sum = 0;
                    for (let i = 0; i < nLevels; i++) {
                      sum += (item.counts[i] ?? 0) * (i + 1);
                    }
                    const mean = total > 0 ? sum / total : 0;

                    // SD
                    let variance = 0;
                    for (let i = 0; i < nLevels; i++) {
                      variance += (item.counts[i] ?? 0) * Math.pow(i + 1 - mean, 2);
                    }
                    const sd = total > 1 ? Math.sqrt(variance / (total - 1)) : 0;

                    // 肯定率（中央より上）
                    const positiveCount = item.counts
                      .slice(nLevels % 2 === 1 ? midIndex + 1 : midIndex)
                      .reduce((s, c) => s + c, 0);
                    const positiveRate = total > 0 ? (positiveCount / total) * 100 : 0;

                    return (
                      <tr key={item.label}>
                        <td
                          className="py-1.5 px-2"
                          style={{
                            color: "var(--color-text-primary)",
                            borderBottom: "1px solid var(--color-border-primary)",
                          }}
                        >
                          {item.label}
                        </td>
                        <td
                          className="py-1.5 px-2 text-right"
                          style={{
                            color: "var(--color-text-secondary)",
                            borderBottom: "1px solid var(--color-border-primary)",
                          }}
                        >
                          {total}
                        </td>
                        <td
                          className="py-1.5 px-2 text-right font-mono"
                          style={{
                            color: "var(--color-text-primary)",
                            borderBottom: "1px solid var(--color-border-primary)",
                          }}
                        >
                          {fmt(mean, 2)}
                        </td>
                        <td
                          className="py-1.5 px-2 text-right font-mono"
                          style={{
                            color: "var(--color-text-secondary)",
                            borderBottom: "1px solid var(--color-border-primary)",
                          }}
                        >
                          {fmt(sd, 2)}
                        </td>
                        <td
                          className="py-1.5 px-2 text-right"
                          style={{
                            color: positiveRate >= 50
                              ? "var(--color-accent-secondary)"
                              : "var(--color-accent-danger)",
                            borderBottom: "1px solid var(--color-border-primary)",
                            fontWeight: 600,
                          }}
                        >
                          {fmt(positiveRate)}%
                        </td>
                      </tr>
                    );
                  })}
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18" />
              <path d="M3 15h18" />
              <path d="M9 3v18" />
            </svg>
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
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35 }}>
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          </svg>
          <p className="text-xs">
            調査データの集計結果を表示するには、順序変数（リッカート尺度）を含むデータセットが必要です
          </p>
        </div>
      )}
    </div>
  );
};
