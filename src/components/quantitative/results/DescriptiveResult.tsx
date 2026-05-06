// src/components/quantitative/results/DescriptiveResult.tsx
// Stellar — 記述統計結果表示コンポーネント
// 変数ごとの統計量カード + D3ミニチャート + 相関ヒートマップ

import type React from "react";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import * as d3 from "d3";
import type { Analysis, Variable, DataRow } from "../../../types";
import type {
  DescriptiveResult as DescriptiveResultType,
  FrequencyTable,
  CorrelationResult,
} from "../../../lib/stats/types";

interface Props {
  analysis: Analysis;
  variables: Variable[];
  dataRows: DataRow[];
}

// ── テーマカラー取得ヘルパー ──
function getCSSVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// ── 数値フォーマット ──
function fmt(v: number, dp = 2): string {
  if (!Number.isFinite(v)) return "—";
  return v.toFixed(dp);
}

// ── ミニチャートタイプ ──
type ChartType = "histogram" | "boxplot" | "bar";

// ============================================================================
// HistogramChart — D3 ヒストグラム
// ============================================================================
const HistogramChart: React.FC<{ values: number[]; width?: number; height?: number }> = ({
  values,
  width = 280,
  height = 140,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || values.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 8, right: 8, bottom: 24, left: 32 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleLinear()
      .domain(d3.extent(values) as [number, number])
      .nice()
      .range([0, w]);

    const bins = d3
      .bin()
      .domain(x.domain() as [number, number])
      .thresholds(x.ticks(Math.min(20, Math.ceil(Math.sqrt(values.length)))))
      (values);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(bins, (d) => d.length) ?? 0])
      .nice()
      .range([h, 0]);

    const accentColor = getCSSVar("--color-accent-primary") || "#4285f4";
    const textColor = getCSSVar("--color-text-tertiary") || "#888";

    g.selectAll("rect")
      .data(bins)
      .join("rect")
      .attr("x", (d) => x(d.x0!) + 1)
      .attr("y", (d) => y(d.length))
      .attr("width", (d) => Math.max(0, x(d.x1!) - x(d.x0!) - 2))
      .attr("height", (d) => h - y(d.length))
      .attr("fill", accentColor)
      .attr("opacity", 0.7)
      .attr("rx", 2);

    // X axis
    g.append("g")
      .attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(5).tickSize(3))
      .call((g) => g.select(".domain").attr("stroke", textColor).attr("opacity", 0.3))
      .call((g) => g.selectAll(".tick line").attr("stroke", textColor).attr("opacity", 0.2))
      .call((g) => g.selectAll(".tick text").attr("fill", textColor).attr("font-size", "9px"));

    // Y axis
    g.append("g")
      .call(d3.axisLeft(y).ticks(4).tickSize(3))
      .call((g) => g.select(".domain").attr("stroke", textColor).attr("opacity", 0.3))
      .call((g) => g.selectAll(".tick line").attr("stroke", textColor).attr("opacity", 0.2))
      .call((g) => g.selectAll(".tick text").attr("fill", textColor).attr("font-size", "9px"));
  }, [values, width, height]);

  return <svg ref={svgRef} width={width} height={height} />;
};

// ============================================================================
// BoxPlotChart — D3 箱ひげ図
// ============================================================================
const BoxPlotChart: React.FC<{
  stats: DescriptiveResultType;
  width?: number;
  height?: number;
}> = ({ stats, width = 280, height = 140 }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 12, right: 16, bottom: 24, left: 32 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const accentColor = getCSSVar("--color-accent-primary") || "#4285f4";
    const textColor = getCSSVar("--color-text-tertiary") || "#888";

    const x = d3
      .scaleLinear()
      .domain([stats.min, stats.max])
      .nice()
      .range([0, w]);

    const cy = h / 2;
    const boxH = h * 0.45;

    // Whiskers
    g.append("line")
      .attr("x1", x(stats.min))
      .attr("x2", x(stats.q1))
      .attr("y1", cy)
      .attr("y2", cy)
      .attr("stroke", accentColor)
      .attr("stroke-width", 1.5);

    g.append("line")
      .attr("x1", x(stats.q3))
      .attr("x2", x(stats.max))
      .attr("y1", cy)
      .attr("y2", cy)
      .attr("stroke", accentColor)
      .attr("stroke-width", 1.5);

    // End caps
    for (const val of [stats.min, stats.max]) {
      g.append("line")
        .attr("x1", x(val))
        .attr("x2", x(val))
        .attr("y1", cy - boxH * 0.3)
        .attr("y2", cy + boxH * 0.3)
        .attr("stroke", accentColor)
        .attr("stroke-width", 1.5);
    }

    // Box
    g.append("rect")
      .attr("x", x(stats.q1))
      .attr("y", cy - boxH / 2)
      .attr("width", Math.max(0, x(stats.q3) - x(stats.q1)))
      .attr("height", boxH)
      .attr("fill", accentColor)
      .attr("opacity", 0.2)
      .attr("stroke", accentColor)
      .attr("stroke-width", 1.5)
      .attr("rx", 3);

    // Median
    g.append("line")
      .attr("x1", x(stats.median))
      .attr("x2", x(stats.median))
      .attr("y1", cy - boxH / 2)
      .attr("y2", cy + boxH / 2)
      .attr("stroke", accentColor)
      .attr("stroke-width", 2);

    // Mean dot
    g.append("circle")
      .attr("cx", x(stats.mean))
      .attr("cy", cy)
      .attr("r", 3)
      .attr("fill", getCSSVar("--color-accent-danger") || "#e03131");

    // X axis
    g.append("g")
      .attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(5).tickSize(3))
      .call((g) => g.select(".domain").attr("stroke", textColor).attr("opacity", 0.3))
      .call((g) => g.selectAll(".tick line").attr("stroke", textColor).attr("opacity", 0.2))
      .call((g) => g.selectAll(".tick text").attr("fill", textColor).attr("font-size", "9px"));
  }, [stats, width, height]);

  return <svg ref={svgRef} width={width} height={height} />;
};

// ============================================================================
// BarChart — D3 棒グラフ（名義変数用）
// ============================================================================
const BarChart: React.FC<{
  freq: FrequencyTable;
  width?: number;
  height?: number;
}> = ({ freq, width = 280, height = 140 }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || freq.rows.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 8, right: 8, bottom: 40, left: 36 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const data = freq.rows.slice(0, 10); // 上位10件

    const accentColor = getCSSVar("--color-accent-primary") || "#4285f4";
    const textColor = getCSSVar("--color-text-tertiary") || "#888";

    const x = d3
      .scaleBand()
      .domain(data.map((d) => d.value))
      .range([0, w])
      .padding(0.25);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.count) ?? 0])
      .nice()
      .range([h, 0]);

    g.selectAll("rect")
      .data(data)
      .join("rect")
      .attr("x", (d) => x(d.value)!)
      .attr("y", (d) => y(d.count))
      .attr("width", x.bandwidth())
      .attr("height", (d) => h - y(d.count))
      .attr("fill", accentColor)
      .attr("opacity", 0.7)
      .attr("rx", 2);

    // X axis
    g.append("g")
      .attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).tickSize(0))
      .call((g) => g.select(".domain").attr("stroke", textColor).attr("opacity", 0.3))
      .call((g) =>
        g
          .selectAll(".tick text")
          .attr("fill", textColor)
          .attr("font-size", "8px")
          .attr("transform", "rotate(-30)")
          .style("text-anchor", "end")
          .each(function () {
            const el = d3.select(this);
            const text = el.text();
            if (text.length > 8) el.text(text.slice(0, 7) + "...");
          }),
      );

    // Y axis
    g.append("g")
      .call(d3.axisLeft(y).ticks(4).tickSize(3))
      .call((g) => g.select(".domain").attr("stroke", textColor).attr("opacity", 0.3))
      .call((g) => g.selectAll(".tick line").attr("stroke", textColor).attr("opacity", 0.2))
      .call((g) => g.selectAll(".tick text").attr("fill", textColor).attr("font-size", "9px"));
  }, [freq, width, height]);

  return <svg ref={svgRef} width={width} height={height} />;
};

// ============================================================================
// CorrelationHeatmap — 相関行列ヒートマップ
// ============================================================================
const CorrelationHeatmap: React.FC<{
  correlations: CorrelationResult[];
  variables: string[];
}> = ({ correlations, variables: varNames }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const cellSize = 56;
  const labelWidth = 80;
  const size = cellSize * varNames.length + labelWidth;

  useEffect(() => {
    if (!svgRef.current || varNames.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g").attr("transform", `translate(${labelWidth}, ${labelWidth})`);
    const textColor = getCSSVar("--color-text-primary") || "#333";
    const borderColor = getCSSVar("--color-border-primary") || "#ddd";

    // 相関マトリクス構築
    const matrix: Record<string, Record<string, { r: number; p: number }>> = {};
    for (const v of varNames) {
      matrix[v] = {};
      matrix[v]![v] = { r: 1, p: 0 };
    }
    for (const c of correlations) {
      if (!matrix[c.var1Name]) matrix[c.var1Name] = {};
      if (!matrix[c.var2Name]) matrix[c.var2Name] = {};
      matrix[c.var1Name]![c.var2Name] = { r: c.r, p: c.pValue };
      matrix[c.var2Name]![c.var1Name] = { r: c.r, p: c.pValue };
    }

    const colorScale = d3
      .scaleLinear<string>()
      .domain([-1, 0, 1])
      .range(["#e03131", "#f8f9fa", "#4285f4"]);

    // セル描画
    for (let i = 0; i < varNames.length; i++) {
      for (let j = 0; j < varNames.length; j++) {
        const entry = matrix[varNames[i]!]?.[varNames[j]!];
        const r = entry?.r ?? NaN;
        const p = entry?.p ?? 1;

        // セル背景
        g.append("rect")
          .attr("x", j * cellSize)
          .attr("y", i * cellSize)
          .attr("width", cellSize)
          .attr("height", cellSize)
          .attr("fill", Number.isFinite(r) ? colorScale(r) : "#f8f9fa")
          .attr("stroke", borderColor)
          .attr("stroke-width", 0.5)
          .attr("rx", 2);

        if (Number.isFinite(r)) {
          // 相関係数表示
          g.append("text")
            .attr("x", j * cellSize + cellSize / 2)
            .attr("y", i * cellSize + cellSize / 2 - 4)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("font-size", "11px")
            .attr("font-weight", "600")
            .attr("fill", Math.abs(r) > 0.5 ? "#fff" : textColor)
            .text(r.toFixed(2));

          // 有意性スター
          if (p < 0.001) {
            g.append("text")
              .attr("x", j * cellSize + cellSize / 2)
              .attr("y", i * cellSize + cellSize / 2 + 10)
              .attr("text-anchor", "middle")
              .attr("font-size", "9px")
              .attr("fill", Math.abs(r) > 0.5 ? "rgba(255,255,255,0.8)" : textColor)
              .text("***");
          } else if (p < 0.01) {
            g.append("text")
              .attr("x", j * cellSize + cellSize / 2)
              .attr("y", i * cellSize + cellSize / 2 + 10)
              .attr("text-anchor", "middle")
              .attr("font-size", "9px")
              .attr("fill", Math.abs(r) > 0.5 ? "rgba(255,255,255,0.8)" : textColor)
              .text("**");
          } else if (p < 0.05) {
            g.append("text")
              .attr("x", j * cellSize + cellSize / 2)
              .attr("y", i * cellSize + cellSize / 2 + 10)
              .attr("text-anchor", "middle")
              .attr("font-size", "9px")
              .attr("fill", Math.abs(r) > 0.5 ? "rgba(255,255,255,0.8)" : textColor)
              .text("*");
          }
        }
      }
    }

    // 行ラベル
    for (let i = 0; i < varNames.length; i++) {
      g.append("text")
        .attr("x", -6)
        .attr("y", i * cellSize + cellSize / 2)
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .attr("font-size", "10px")
        .attr("fill", textColor)
        .text(varNames[i]!.length > 10 ? varNames[i]!.slice(0, 9) + "..." : varNames[i]!);
    }

    // 列ラベル
    for (let j = 0; j < varNames.length; j++) {
      g.append("text")
        .attr("x", j * cellSize + cellSize / 2)
        .attr("y", -6)
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .attr("font-size", "10px")
        .attr("fill", textColor)
        .attr("transform", `rotate(-45, ${j * cellSize + cellSize / 2}, -6)`)
        .text(varNames[j]!.length > 10 ? varNames[j]!.slice(0, 9) + "..." : varNames[j]!);
    }
  }, [correlations, varNames]);

  return (
    <div className="overflow-auto">
      <svg ref={svgRef} width={size} height={size} />
      <div className="flex items-center gap-3 mt-2">
        <span className="text-xs" style={{ color: "var(--color-text-tertiary)", fontSize: "10px" }}>
          * p &lt; .05 &nbsp; ** p &lt; .01 &nbsp; *** p &lt; .001
        </span>
      </div>
    </div>
  );
};

// ============================================================================
// DescriptiveResult メインコンポーネント
// ============================================================================
export const DescriptiveResult: React.FC<Props> = ({ analysis, variables, dataRows }) => {
  const result = analysis.result as {
    descriptives?: DescriptiveResultType[];
    frequencies?: FrequencyTable[];
    correlations?: CorrelationResult[];
  } | null;

  if (!result) return null;

  const { descriptives = [], frequencies = [], correlations = [] } = result;

  // 相関マトリクス用変数名
  const corrVarNames = useMemo(() => {
    if (correlations.length === 0) return [];
    const names = new Set<string>();
    for (const c of correlations) {
      names.add(c.var1Name);
      names.add(c.var2Name);
    }
    return [...names];
  }, [correlations]);

  return (
    <div className="h-full overflow-y-auto p-6 scrollable-area">
      {/* ── 記述統計カード ── */}
      {descriptives.length > 0 && (
        <div className="mb-6">
          <h3
            className="text-sm font-semibold mb-4 flex items-center gap-2"
            style={{ color: "var(--color-text-primary)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            スケール変数の記述統計
          </h3>
          <div className="flex flex-col gap-4">
            {descriptives.map((desc) => (
              <DescriptiveCard key={desc.variableId} desc={desc} dataRows={dataRows} />
            ))}
          </div>
        </div>
      )}

      {/* ── 度数分布 ── */}
      {frequencies.length > 0 && (
        <div className="mb-6">
          <h3
            className="text-sm font-semibold mb-4 flex items-center gap-2"
            style={{ color: "var(--color-text-primary)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            カテゴリ変数の度数分布
          </h3>
          <div className="flex flex-col gap-4">
            {frequencies.map((freq) => (
              <FrequencyCard key={freq.variableId} freq={freq} />
            ))}
          </div>
        </div>
      )}

      {/* ── 相関ヒートマップ ── */}
      {correlations.length > 0 && (
        <div className="mb-6">
          <h3
            className="text-sm font-semibold mb-4 flex items-center gap-2"
            style={{ color: "var(--color-text-primary)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18" />
              <path d="M3 15h18" />
              <path d="M9 3v18" />
              <path d="M15 3v18" />
            </svg>
            相関行列
          </h3>
          <div
            className="p-4"
            style={{
              backgroundColor: "var(--color-bg-secondary)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--color-border-primary)",
            }}
          >
            <CorrelationHeatmap correlations={correlations} variables={corrVarNames} />

            {/* 個別相関の解釈 */}
            <div className="mt-4 flex flex-col gap-2">
              {correlations.map((c, i) => (
                <div
                  key={i}
                  className="p-3 text-xs leading-relaxed"
                  style={{
                    backgroundColor: "var(--color-bg-primary)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-border-primary)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="font-semibold"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {c.var1Name} × {c.var2Name}
                    </span>
                    <span
                      className="px-1.5 py-0.5 text-xs"
                      style={{
                        backgroundColor: c.pValue < 0.05
                          ? "color-mix(in srgb, var(--color-accent-secondary) 15%, transparent)"
                          : "color-mix(in srgb, var(--color-text-tertiary) 10%, transparent)",
                        color: c.pValue < 0.05
                          ? "var(--color-accent-secondary)"
                          : "var(--color-text-tertiary)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "10px",
                        fontWeight: 600,
                      }}
                    >
                      {c.pValue < 0.05 ? "有意" : "非有意"}
                    </span>
                  </div>
                  {c.interpretation}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// DescriptiveCard — 個別変数の記述統計カード
// ============================================================================
const DescriptiveCard: React.FC<{
  desc: DescriptiveResultType;
  dataRows: DataRow[];
}> = ({ desc, dataRows }) => {
  const [chartType, setChartType] = useState<ChartType>("histogram");

  const values = useMemo(() => {
    return dataRows
      .map((row) => {
        const v = row.values[desc.variableName];
        if (v == null || v === "") return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      })
      .filter((v): v is number => v !== null);
  }, [dataRows, desc.variableName]);

  return (
    <div
      className="p-4"
      style={{
        backgroundColor: "var(--color-bg-secondary)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border-primary)",
      }}
    >
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            {desc.variableName}
          </span>
          <span
            className="text-xs px-1.5 py-0.5"
            style={{
              backgroundColor: "color-mix(in srgb, var(--color-accent-primary) 12%, transparent)",
              color: "var(--color-accent-primary)",
              borderRadius: "var(--radius-sm)",
              fontSize: "10px",
              fontWeight: 500,
            }}
          >
            n={desc.n}
          </span>
          {desc.missingCount > 0 && (
            <span
              className="text-xs px-1.5 py-0.5"
              style={{
                backgroundColor: "color-mix(in srgb, var(--color-accent-warning) 12%, transparent)",
                color: "var(--color-accent-warning)",
                borderRadius: "var(--radius-sm)",
                fontSize: "10px",
                fontWeight: 500,
              }}
            >
              欠損 {desc.missingCount}件
            </span>
          )}
        </div>

        {/* チャートタイプ切り替え */}
        <div className="flex gap-1">
          {(
            [
              { key: "histogram" as const, label: "ヒストグラム" },
              { key: "boxplot" as const, label: "箱ひげ図" },
            ] as const
          ).map((ct) => (
            <button
              key={ct.key}
              onClick={() => setChartType(ct.key)}
              className="px-2 py-1 text-xs"
              style={{
                color:
                  chartType === ct.key
                    ? "var(--color-accent-primary)"
                    : "var(--color-text-tertiary)",
                backgroundColor:
                  chartType === ct.key
                    ? "color-mix(in srgb, var(--color-accent-primary) 10%, transparent)"
                    : "transparent",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                fontSize: "10px",
                fontWeight: chartType === ct.key ? 600 : 400,
                transition: "all var(--transition-fast)",
              }}
            >
              {ct.label}
            </button>
          ))}
        </div>
      </div>

      {/* 統計量グリッド */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {[
          { label: "平均", value: fmt(desc.mean) },
          { label: "中央値", value: fmt(desc.median) },
          { label: "最頻値", value: desc.mode.length > 0 ? fmt(desc.mode[0]!) : "—" },
          { label: "SD", value: fmt(desc.sd) },
          { label: "最小", value: fmt(desc.min) },
          { label: "最大", value: fmt(desc.max) },
          { label: "Q1", value: fmt(desc.q1) },
          { label: "Q3", value: fmt(desc.q3) },
        ].map((item) => (
          <div
            key={item.label}
            className="p-2 text-center"
            style={{
              backgroundColor: "var(--color-bg-primary)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border-primary)",
            }}
          >
            <div
              className="text-xs mb-0.5"
              style={{ color: "var(--color-text-tertiary)", fontSize: "10px" }}
            >
              {item.label}
            </div>
            <div
              className="text-sm font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* チャート */}
      <div
        className="p-2 mb-3"
        style={{
          backgroundColor: "var(--color-bg-primary)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--color-border-primary)",
        }}
      >
        {chartType === "histogram" && <HistogramChart values={values} />}
        {chartType === "boxplot" && <BoxPlotChart stats={desc} />}
      </div>

      {/* 解釈 */}
      <div
        className="p-3 text-xs leading-relaxed"
        style={{
          backgroundColor: "color-mix(in srgb, var(--color-accent-primary) 5%, var(--color-bg-primary))",
          borderRadius: "var(--radius-md)",
          border: "1px solid color-mix(in srgb, var(--color-accent-primary) 20%, transparent)",
          color: "var(--color-text-secondary)",
        }}
      >
        <div className="flex items-start gap-2">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-accent-primary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 mt-0.5"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span>{desc.interpretation}</span>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// FrequencyCard — 度数分布カード
// ============================================================================
const FrequencyCard: React.FC<{ freq: FrequencyTable }> = ({ freq }) => {
  return (
    <div
      className="p-4"
      style={{
        backgroundColor: "var(--color-bg-secondary)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border-primary)",
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span
          className="text-sm font-semibold"
          style={{ color: "var(--color-text-primary)" }}
        >
          {freq.variableName}
        </span>
        <span
          className="text-xs px-1.5 py-0.5"
          style={{
            backgroundColor: "color-mix(in srgb, var(--color-accent-warning) 12%, transparent)",
            color: "var(--color-accent-warning)",
            borderRadius: "var(--radius-sm)",
            fontSize: "10px",
            fontWeight: 500,
          }}
        >
          {freq.rows.length} カテゴリ
        </span>
      </div>

      <div className="flex gap-4">
        {/* テーブル */}
        <div className="flex-1">
          <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["値", "度数", "%", "累積%"].map((h) => (
                  <th
                    key={h}
                    className="text-left py-1.5 px-2 font-medium"
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
              {freq.rows.map((row) => (
                <tr key={row.value}>
                  <td
                    className="py-1.5 px-2"
                    style={{
                      color: "var(--color-text-primary)",
                      borderBottom: "1px solid var(--color-border-primary)",
                    }}
                  >
                    {row.value}
                  </td>
                  <td
                    className="py-1.5 px-2 text-right"
                    style={{
                      color: "var(--color-text-primary)",
                      borderBottom: "1px solid var(--color-border-primary)",
                    }}
                  >
                    {row.count}
                  </td>
                  <td
                    className="py-1.5 px-2 text-right"
                    style={{
                      color: "var(--color-text-secondary)",
                      borderBottom: "1px solid var(--color-border-primary)",
                    }}
                  >
                    {row.percent.toFixed(1)}%
                  </td>
                  <td
                    className="py-1.5 px-2 text-right"
                    style={{
                      color: "var(--color-text-tertiary)",
                      borderBottom: "1px solid var(--color-border-primary)",
                    }}
                  >
                    {row.cumPercent.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 棒グラフ */}
        <div className="shrink-0">
          <BarChart freq={freq} width={240} height={140} />
        </div>
      </div>
    </div>
  );
};
