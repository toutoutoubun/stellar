// src/components/quantitative/results/InferentialResult.tsx
// Stellar — 推測統計結果表示コンポーネント
// TTestResultCard / ChiSquareResultCard / RegressionResultCard

import type React from "react";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import * as d3 from "d3";
import type { Analysis, Variable, DataRow } from "../../../types";
import type {
  TTestResult,
  MannWhitneyResult,
  ChiSquareResult,
  RegressionResult,
} from "../../../lib/stats/types";

interface Props {
  analysis: Analysis;
  variables: Variable[];
  dataRows: DataRow[];
}

// ── ヘルパー ──
function fmt(v: number, dp = 2): string {
  if (!Number.isFinite(v)) return "—";
  return v.toFixed(dp);
}

function fmtP(p: number): string {
  if (!Number.isFinite(p)) return "—";
  if (p < 0.001) return "p < .001";
  return `p = ${p.toFixed(3)}`;
}

function getCSSVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// ============================================================================
// VerdictBadge — 有意/非有意バッジ
// ============================================================================
const VerdictBadge: React.FC<{ significant: boolean }> = ({ significant }) => (
  <span
    className="px-2.5 py-1 text-xs font-semibold"
    style={{
      backgroundColor: significant
        ? "color-mix(in srgb, var(--color-accent-secondary) 15%, transparent)"
        : "color-mix(in srgb, var(--color-text-tertiary) 10%, transparent)",
      color: significant
        ? "var(--color-accent-secondary)"
        : "var(--color-text-tertiary)",
      borderRadius: "var(--radius-md)",
      border: `1px solid ${significant
        ? "color-mix(in srgb, var(--color-accent-secondary) 30%, transparent)"
        : "color-mix(in srgb, var(--color-text-tertiary) 15%, transparent)"}`,
    }}
  >
    {significant ? "有意差あり" : "有意差なし"}
  </span>
);

// ============================================================================
// EffectSizeBar — 効果量バー
// ============================================================================
const EffectSizeBar: React.FC<{
  value: number;
  max?: number;
  label: string;
  color?: string;
}> = ({ value, max = 1.5, label, color }) => {
  const ratio = Math.min(Math.abs(value) / max, 1);
  const barColor = color || "var(--color-accent-primary)";

  return (
    <div className="flex items-center gap-3">
      <span
        className="text-xs shrink-0"
        style={{ color: "var(--color-text-tertiary)", width: "80px", fontSize: "10px" }}
      >
        {label}
      </span>
      <div
        className="flex-1 relative"
        style={{
          height: "8px",
          backgroundColor: "var(--color-bg-hover)",
          borderRadius: "4px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            width: `${ratio * 100}%`,
            backgroundColor: barColor,
            borderRadius: "4px",
            transition: "width 0.5s ease-out",
          }}
        />
      </div>
      <span
        className="text-xs font-semibold shrink-0"
        style={{ color: "var(--color-text-primary)", width: "48px", textAlign: "right" }}
      >
        {fmt(value, 3)}
      </span>
    </div>
  );
};

// ============================================================================
// BoxPlotPairChart — 2群並列箱ひげ図 (D3)
// ============================================================================
const BoxPlotPairChart: React.FC<{
  group1: number[];
  group2: number[];
  label1: string;
  label2: string;
  width?: number;
  height?: number;
}> = ({ group1, group2, label1, label2, width = 320, height = 180 }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 12, right: 16, bottom: 28, left: 40 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const textColor = getCSSVar("--color-text-tertiary") || "#888";
    const colors = [
      getCSSVar("--color-accent-primary") || "#4285f4",
      getCSSVar("--color-accent-warning") || "#fbbc04",
    ];

    const allValues = [...group1, ...group2];
    const y = d3.scaleLinear()
      .domain(d3.extent(allValues) as [number, number])
      .nice()
      .range([h, 0]);

    const x = d3.scaleBand()
      .domain([label1, label2])
      .range([0, w])
      .padding(0.4);

    const groups = [
      { data: group1, label: label1 },
      { data: group2, label: label2 },
    ];

    for (let gi = 0; gi < groups.length; gi++) {
      const grp = groups[gi]!;
      const sorted = [...grp.data].sort((a, b) => a - b);
      if (sorted.length === 0) continue;

      const q1 = d3.quantile(sorted, 0.25) ?? 0;
      const median = d3.quantile(sorted, 0.5) ?? 0;
      const q3 = d3.quantile(sorted, 0.75) ?? 0;
      const min = sorted[0]!;
      const max = sorted[sorted.length - 1]!;
      const bw = x.bandwidth();
      const cx = (x(grp.label) ?? 0) + bw / 2;

      // Box
      g.append("rect")
        .attr("x", cx - bw / 2)
        .attr("y", y(q3))
        .attr("width", bw)
        .attr("height", Math.max(0, y(q1) - y(q3)))
        .attr("fill", colors[gi]!)
        .attr("opacity", 0.2)
        .attr("stroke", colors[gi]!)
        .attr("stroke-width", 1.5)
        .attr("rx", 3);

      // Median
      g.append("line")
        .attr("x1", cx - bw / 2)
        .attr("x2", cx + bw / 2)
        .attr("y1", y(median))
        .attr("y2", y(median))
        .attr("stroke", colors[gi]!)
        .attr("stroke-width", 2);

      // Whiskers
      g.append("line")
        .attr("x1", cx).attr("x2", cx)
        .attr("y1", y(min)).attr("y2", y(q1))
        .attr("stroke", colors[gi]!).attr("stroke-width", 1.5);
      g.append("line")
        .attr("x1", cx).attr("x2", cx)
        .attr("y1", y(q3)).attr("y2", y(max))
        .attr("stroke", colors[gi]!).attr("stroke-width", 1.5);

      // Caps
      for (const val of [min, max]) {
        g.append("line")
          .attr("x1", cx - bw * 0.25).attr("x2", cx + bw * 0.25)
          .attr("y1", y(val)).attr("y2", y(val))
          .attr("stroke", colors[gi]!).attr("stroke-width", 1.5);
      }
    }

    // Y axis
    g.append("g")
      .call(d3.axisLeft(y).ticks(5).tickSize(3))
      .call((g) => g.select(".domain").attr("stroke", textColor).attr("opacity", 0.3))
      .call((g) => g.selectAll(".tick line").attr("stroke", textColor).attr("opacity", 0.2))
      .call((g) => g.selectAll(".tick text").attr("fill", textColor).attr("font-size", "9px"));

    // X axis
    g.append("g")
      .attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).tickSize(0))
      .call((g) => g.select(".domain").attr("stroke", textColor).attr("opacity", 0.3))
      .call((g) => g.selectAll(".tick text").attr("fill", textColor).attr("font-size", "10px"));
  }, [group1, group2, label1, label2, width, height]);

  return <svg ref={svgRef} width={width} height={height} />;
};

// ============================================================================
// ScatterPlotChart — 散布図＋回帰直線 (D3)
// ============================================================================
const ScatterPlotChart: React.FC<{
  xValues: number[];
  yValues: number[];
  xLabel: string;
  yLabel: string;
  intercept: number;
  slope: number;
  width?: number;
  height?: number;
}> = ({ xValues, yValues, xLabel, yLabel, intercept, slope, width = 360, height = 240 }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || xValues.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 12, right: 16, bottom: 32, left: 44 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const accentColor = getCSSVar("--color-accent-primary") || "#4285f4";
    const dangerColor = getCSSVar("--color-accent-danger") || "#e03131";
    const textColor = getCSSVar("--color-text-tertiary") || "#888";

    const x = d3.scaleLinear()
      .domain(d3.extent(xValues) as [number, number])
      .nice()
      .range([0, w]);

    const y = d3.scaleLinear()
      .domain(d3.extent(yValues) as [number, number])
      .nice()
      .range([h, 0]);

    // Points
    g.selectAll("circle")
      .data(xValues.map((xv, i) => ({ x: xv, y: yValues[i]! })))
      .join("circle")
      .attr("cx", (d) => x(d.x))
      .attr("cy", (d) => y(d.y))
      .attr("r", 3)
      .attr("fill", accentColor)
      .attr("opacity", 0.5);

    // Regression line
    const xDom = x.domain();
    const lineData = [
      { x: xDom[0]!, y: intercept + slope * xDom[0]! },
      { x: xDom[1]!, y: intercept + slope * xDom[1]! },
    ];

    g.append("line")
      .attr("x1", x(lineData[0]!.x))
      .attr("y1", y(lineData[0]!.y))
      .attr("x2", x(lineData[1]!.x))
      .attr("y2", y(lineData[1]!.y))
      .attr("stroke", dangerColor)
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "6 3");

    // X axis
    g.append("g")
      .attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(6).tickSize(3))
      .call((g) => g.select(".domain").attr("stroke", textColor).attr("opacity", 0.3))
      .call((g) => g.selectAll(".tick line").attr("stroke", textColor).attr("opacity", 0.2))
      .call((g) => g.selectAll(".tick text").attr("fill", textColor).attr("font-size", "9px"));

    // X label
    g.append("text")
      .attr("x", w / 2)
      .attr("y", h + 26)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("fill", textColor)
      .text(xLabel);

    // Y axis
    g.append("g")
      .call(d3.axisLeft(y).ticks(5).tickSize(3))
      .call((g) => g.select(".domain").attr("stroke", textColor).attr("opacity", 0.3))
      .call((g) => g.selectAll(".tick line").attr("stroke", textColor).attr("opacity", 0.2))
      .call((g) => g.selectAll(".tick text").attr("fill", textColor).attr("font-size", "9px"));

    // Y label
    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -h / 2)
      .attr("y", -34)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("fill", textColor)
      .text(yLabel);
  }, [xValues, yValues, xLabel, yLabel, intercept, slope, width, height]);

  return <svg ref={svgRef} width={width} height={height} />;
};

// ============================================================================
// TTestResultCard
// ============================================================================
const TTestResultCard: React.FC<{
  result: TTestResult;
  dataRows: DataRow[];
  config: Record<string, unknown>;
}> = ({ result, dataRows, config }) => {
  const [showDetails, setShowDetails] = useState(false);

  // 群別データ取得
  const { group1, group2, label1, label2 } = useMemo(() => {
    const categories = (config.categories as string[]) ?? [];
    const groupVarName = (config.groupVar as string) ?? (result.groupVar ?? "");
    const g1: number[] = [];
    const g2: number[] = [];

    // groupVarは "label1 vs label2" 形式
    const parts = groupVarName.includes(" vs ")
      ? groupVarName.split(" vs ")
      : categories;
    const l1 = parts[0] ?? "群1";
    const l2 = parts[1] ?? "群2";

    for (const row of dataRows) {
      const gVal = String(row.values[config.groupVar as string] ?? "");
      const tVal = row.values[result.targetVar];
      if (!tVal && tVal !== 0) continue;
      const num = Number(tVal);
      if (!Number.isFinite(num)) continue;
      if (gVal === String(categories[0])) g1.push(num);
      else if (gVal === String(categories[1])) g2.push(num);
    }

    return { group1: g1, group2: g2, label1: l1, label2: l2 };
  }, [result, dataRows, config]);

  return (
    <div
      className="p-5"
      style={{
        backgroundColor: "var(--color-bg-secondary)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border-primary)",
      }}
    >
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            {result.targetVar}
          </span>
          <VerdictBadge significant={result.significant} />
        </div>
      </div>

      {/* 統計量行 */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {[
          { label: "t値", value: fmt(result.t, 3) },
          { label: "df", value: fmt(result.df, 1) },
          { label: "p値", value: fmtP(result.pValue) },
          { label: "Cohen's d", value: fmt(result.effectSize, 3) },
          { label: "95% CI", value: `[${fmt(result.ci95Lower)}, ${fmt(result.ci95Upper)}]` },
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
            <div className="text-xs" style={{ color: "var(--color-text-tertiary)", fontSize: "10px" }}>
              {item.label}
            </div>
            <div className="text-xs font-semibold mt-0.5" style={{ color: "var(--color-text-primary)" }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* 効果量バー */}
      <div className="mb-4">
        <EffectSizeBar
          value={Math.abs(result.effectSize)}
          max={1.5}
          label={`効果量（${result.effectSizeLabel}）`}
          color={
            Math.abs(result.effectSize) >= 0.8
              ? "var(--color-accent-danger)"
              : Math.abs(result.effectSize) >= 0.5
                ? "var(--color-accent-warning)"
                : "var(--color-accent-primary)"
          }
        />
      </div>

      {/* 箱ひげ図 */}
      {group1.length > 0 && group2.length > 0 && (
        <div
          className="p-3 mb-4"
          style={{
            backgroundColor: "var(--color-bg-primary)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border-primary)",
          }}
        >
          <BoxPlotPairChart
            group1={group1}
            group2={group2}
            label1={label1}
            label2={label2}
          />
        </div>
      )}

      {/* 解釈 */}
      <div
        className="p-3 text-xs leading-relaxed mb-3"
        style={{
          backgroundColor: "color-mix(in srgb, var(--color-accent-primary) 5%, var(--color-bg-primary))",
          borderRadius: "var(--radius-md)",
          border: "1px solid color-mix(in srgb, var(--color-accent-primary) 20%, transparent)",
          color: "var(--color-text-secondary)",
        }}
      >
        <div className="flex items-start gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span>{result.interpretation}</span>
        </div>
      </div>

      {/* 詳細トグル */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-1.5 text-xs"
        style={{
          color: "var(--color-text-tertiary)",
          cursor: "pointer",
          transition: "color var(--transition-fast)",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-text-primary)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-tertiary)"; }}
      >
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: showDetails ? "rotate(180deg)" : "rotate(0deg)", transition: "transform var(--transition-fast)" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        {showDetails ? "詳細を隠す" : "数値の詳細を表示"}
      </button>

      {showDetails && (
        <div
          className="mt-2 p-3 text-xs"
          style={{
            backgroundColor: "var(--color-bg-primary)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border-primary)",
            color: "var(--color-text-secondary)",
          }}
        >
          <div className="grid grid-cols-2 gap-1">
            <span>群1平均: {fmt(result.mean1, 4)}</span>
            <span>群2平均: {fmt(result.mean2 ?? NaN, 4)}</span>
            <span>t統計量: {fmt(result.t, 6)}</span>
            <span>自由度: {fmt(result.df, 4)}</span>
            <span>p値: {result.pValue.toExponential(4)}</span>
            <span>Cohen's d: {fmt(result.effectSize, 6)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MannWhitneyResultCard
// ============================================================================
const MannWhitneyResultCard: React.FC<{
  result: MannWhitneyResult;
}> = ({ result }) => (
  <div
    className="p-5"
    style={{
      backgroundColor: "var(--color-bg-secondary)",
      borderRadius: "var(--radius-lg)",
      border: "1px solid var(--color-border-primary)",
    }}
  >
    <div className="flex items-center gap-2.5 mb-4">
      <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
        {result.targetVar} (Mann-Whitney U)
      </span>
      <VerdictBadge significant={result.significant} />
    </div>

    <div className="grid grid-cols-3 gap-2 mb-4">
      {[
        { label: "U値", value: fmt(result.U) },
        { label: "p値", value: fmtP(result.pValue) },
        { label: "効果量 r", value: fmt(result.effectSizeR, 3) },
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
          <div className="text-xs" style={{ color: "var(--color-text-tertiary)", fontSize: "10px" }}>{item.label}</div>
          <div className="text-xs font-semibold mt-0.5" style={{ color: "var(--color-text-primary)" }}>{item.value}</div>
        </div>
      ))}
    </div>

    <EffectSizeBar value={result.effectSizeR} max={1} label="効果量 r" />

    <div
      className="mt-4 p-3 text-xs leading-relaxed"
      style={{
        backgroundColor: "color-mix(in srgb, var(--color-accent-primary) 5%, var(--color-bg-primary))",
        borderRadius: "var(--radius-md)",
        border: "1px solid color-mix(in srgb, var(--color-accent-primary) 20%, transparent)",
        color: "var(--color-text-secondary)",
      }}
    >
      {result.interpretation}
    </div>
  </div>
);

// ============================================================================
// ChiSquareResultCard
// ============================================================================
const ChiSquareResultCard: React.FC<{ result: ChiSquareResult }> = ({ result }) => (
  <div
    className="p-5"
    style={{
      backgroundColor: "var(--color-bg-secondary)",
      borderRadius: "var(--radius-lg)",
      border: "1px solid var(--color-border-primary)",
    }}
  >
    <div className="flex items-center gap-2.5 mb-4">
      <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
        {result.var1Id} × {result.var2Id}
      </span>
      <VerdictBadge significant={result.significant} />
    </div>

    <div className="grid grid-cols-4 gap-2 mb-4">
      {[
        { label: "カイ二乗値", value: fmt(result.chi2, 3) },
        { label: "df", value: String(result.df) },
        { label: "p値", value: fmtP(result.pValue) },
        { label: "Cramer's V", value: fmt(result.cramersV, 3) },
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
          <div className="text-xs" style={{ color: "var(--color-text-tertiary)", fontSize: "10px" }}>{item.label}</div>
          <div className="text-xs font-semibold mt-0.5" style={{ color: "var(--color-text-primary)" }}>{item.value}</div>
        </div>
      ))}
    </div>

    {/* Cramer's V バー */}
    <div className="mb-4">
      <EffectSizeBar
        value={result.cramersV}
        max={1}
        label={`効果量（${result.effectSizeLabel}）`}
        color={
          result.cramersV >= 0.5
            ? "var(--color-accent-danger)"
            : result.cramersV >= 0.3
              ? "var(--color-accent-warning)"
              : "var(--color-accent-primary)"
        }
      />
    </div>

    {/* クロス集計表 */}
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th
              className="py-1.5 px-2 text-left font-medium"
              style={{
                color: "var(--color-text-tertiary)",
                borderBottom: "2px solid var(--color-border-primary)",
                fontSize: "10px",
              }}
            />
            {result.colLabels.map((cl) => (
              <th
                key={cl}
                className="py-1.5 px-2 text-center font-medium"
                style={{
                  color: "var(--color-text-tertiary)",
                  borderBottom: "2px solid var(--color-border-primary)",
                  fontSize: "10px",
                }}
              >
                {cl}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.contingencyTable.map((row, ri) => (
            <tr key={ri}>
              <td
                className="py-1.5 px-2 font-medium"
                style={{
                  color: "var(--color-text-primary)",
                  borderBottom: "1px solid var(--color-border-primary)",
                  fontSize: "10px",
                }}
              >
                {result.rowLabels[ri]}
              </td>
              {row.map((cell, ci) => {
                const residual = cell.expected > 0
                  ? (cell.observed - cell.expected) ** 2 / cell.expected
                  : 0;
                const isHighlighted = residual > 2;

                return (
                  <td
                    key={ci}
                    className="py-1.5 px-2 text-center"
                    style={{
                      borderBottom: "1px solid var(--color-border-primary)",
                      backgroundColor: isHighlighted
                        ? "color-mix(in srgb, var(--color-accent-warning) 15%, transparent)"
                        : "transparent",
                      color: "var(--color-text-primary)",
                      fontSize: "11px",
                    }}
                  >
                    <div className="font-semibold">{cell.observed}</div>
                    <div
                      className="text-xs"
                      style={{ color: "var(--color-text-tertiary)", fontSize: "9px" }}
                    >
                      ({cell.expected.toFixed(1)})
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
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
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span>{result.interpretation}</span>
      </div>
    </div>
  </div>
);

// ============================================================================
// RegressionResultCard
// ============================================================================
const RegressionResultCard: React.FC<{
  result: RegressionResult;
  dataRows: DataRow[];
}> = ({ result, dataRows }) => {
  const [predictorValues, setPredictorValues] = useState<Record<string, string>>({});

  const prediction = useMemo(() => {
    if (Object.keys(predictorValues).length === 0) return null;
    let yHat = result.intercept;
    for (const coef of result.coefficients) {
      const val = Number(predictorValues[coef.varName]);
      if (!Number.isFinite(val)) return null;
      yHat += coef.b * val;
    }
    return yHat;
  }, [predictorValues, result]);

  // 散布図用データ（単回帰のみ）
  const scatterData = useMemo(() => {
    if (result.type !== "simple" || result.coefficients.length !== 1) return null;
    const xVar = result.independentVars[0]!;
    const yVar = result.dependentVar;

    const xVals: number[] = [];
    const yVals: number[] = [];
    for (const row of dataRows) {
      const xv = Number(row.values[xVar]);
      const yv = Number(row.values[yVar]);
      if (Number.isFinite(xv) && Number.isFinite(yv)) {
        xVals.push(xv);
        yVals.push(yv);
      }
    }
    return { xVals, yVals, xLabel: xVar, yLabel: yVar };
  }, [result, dataRows]);

  return (
    <div
      className="p-5"
      style={{
        backgroundColor: "var(--color-bg-secondary)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border-primary)",
      }}
    >
      {/* ヘッダー */}
      <div className="flex items-center gap-2.5 mb-4">
        <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
          {result.type === "simple" ? "単回帰分析" : "重回帰分析"}
        </span>
        <span
          className="text-xs px-1.5 py-0.5"
          style={{
            backgroundColor: result.fPValue < 0.05
              ? "color-mix(in srgb, var(--color-accent-secondary) 15%, transparent)"
              : "color-mix(in srgb, var(--color-text-tertiary) 10%, transparent)",
            color: result.fPValue < 0.05
              ? "var(--color-accent-secondary)"
              : "var(--color-text-tertiary)",
            borderRadius: "var(--radius-sm)",
            fontSize: "10px",
            fontWeight: 600,
          }}
        >
          {result.fPValue < 0.05 ? "モデル有意" : "モデル非有意"}
        </span>
      </div>

      {/* R²プログレスバー */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
            説明率
          </span>
          <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            {fmt(result.r2 * 100, 1)}%
          </span>
        </div>
        <div
          style={{
            height: "10px",
            backgroundColor: "var(--color-bg-hover)",
            borderRadius: "5px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.min(result.r2 * 100, 100)}%`,
              background: `linear-gradient(90deg, var(--color-accent-primary), var(--color-accent-secondary))`,
              borderRadius: "5px",
              transition: "width 0.5s ease-out",
            }}
          />
        </div>
      </div>

      {/* 係数テーブル */}
      <div className="overflow-x-auto mb-4">
        <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["変数名", "係数", "標準誤差", "p値", "有意性"].map((h) => (
                <th
                  key={h}
                  className="py-2 px-2 text-left font-medium"
                  style={{
                    color: "var(--color-text-tertiary)",
                    borderBottom: "2px solid var(--color-border-primary)",
                    fontSize: "10px",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.coefficients.map((coef) => (
              <tr key={coef.varName}>
                <td
                  className="py-2 px-2 font-medium"
                  style={{
                    color: "var(--color-text-primary)",
                    borderBottom: "1px solid var(--color-border-primary)",
                  }}
                >
                  {coef.varName}
                </td>
                <td
                  className="py-2 px-2 text-right font-mono"
                  style={{
                    color: "var(--color-text-primary)",
                    borderBottom: "1px solid var(--color-border-primary)",
                  }}
                >
                  {fmt(coef.b, 4)}
                </td>
                <td
                  className="py-2 px-2 text-right font-mono"
                  style={{
                    color: "var(--color-text-secondary)",
                    borderBottom: "1px solid var(--color-border-primary)",
                  }}
                >
                  {fmt(coef.stdError, 4)}
                </td>
                <td
                  className="py-2 px-2 text-right"
                  style={{
                    color: coef.significant ? "var(--color-accent-secondary)" : "var(--color-text-secondary)",
                    borderBottom: "1px solid var(--color-border-primary)",
                    fontWeight: coef.significant ? 600 : 400,
                  }}
                >
                  {fmtP(coef.pValue)}
                </td>
                <td
                  className="py-2 px-2 text-center"
                  style={{
                    borderBottom: "1px solid var(--color-border-primary)",
                  }}
                >
                  {coef.pValue < 0.001 ? (
                    <span style={{ color: "var(--color-accent-danger)" }}>★★★</span>
                  ) : coef.pValue < 0.01 ? (
                    <span style={{ color: "var(--color-accent-warning)" }}>★★</span>
                  ) : coef.pValue < 0.05 ? (
                    <span style={{ color: "var(--color-accent-secondary)" }}>★</span>
                  ) : (
                    <span style={{ color: "var(--color-text-disabled)" }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 散布図（単回帰のみ） */}
      {scatterData && (
        <div
          className="p-3 mb-4"
          style={{
            backgroundColor: "var(--color-bg-primary)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border-primary)",
          }}
        >
          <ScatterPlotChart
            xValues={scatterData.xVals}
            yValues={scatterData.yVals}
            xLabel={scatterData.xLabel}
            yLabel={scatterData.yLabel}
            intercept={result.intercept}
            slope={result.coefficients[0]?.b ?? 0}
          />
        </div>
      )}

      {/* 解釈 */}
      <div
        className="p-3 text-xs leading-relaxed mb-4"
        style={{
          backgroundColor: "color-mix(in srgb, var(--color-accent-primary) 5%, var(--color-bg-primary))",
          borderRadius: "var(--radius-md)",
          border: "1px solid color-mix(in srgb, var(--color-accent-primary) 20%, transparent)",
          color: "var(--color-text-secondary)",
        }}
      >
        <div className="flex items-start gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span>{result.interpretation}</span>
        </div>
      </div>

      {/* 予測計算機 */}
      <div
        className="p-4"
        style={{
          backgroundColor: "var(--color-bg-primary)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--color-border-primary)",
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--color-accent-primary)" }}>
            <rect x="4" y="2" width="16" height="20" rx="2" />
            <line x1="8" y1="6" x2="16" y2="6" />
            <line x1="8" y1="10" x2="10" y2="10" />
            <line x1="12" y1="10" x2="14" y2="10" />
            <line x1="8" y1="14" x2="10" y2="14" />
            <line x1="12" y1="14" x2="14" y2="14" />
            <line x1="8" y1="18" x2="14" y2="18" />
          </svg>
          <span className="text-xs font-semibold" style={{ color: "var(--color-text-primary)" }}>
            予測計算機
          </span>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          {result.independentVars.map((varName) => (
            <div key={varName} className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: "var(--color-text-tertiary)", fontSize: "10px" }}>
                {varName}
              </label>
              <input
                type="number"
                value={predictorValues[varName] ?? ""}
                onChange={(e) =>
                  setPredictorValues((prev) => ({ ...prev, [varName]: e.target.value }))
                }
                placeholder="値を入力"
                className="px-2 py-1.5 text-xs"
                style={{
                  width: "100px",
                  backgroundColor: "var(--color-bg-secondary)",
                  color: "var(--color-text-primary)",
                  border: "1px solid var(--color-border-primary)",
                  borderRadius: "var(--radius-sm)",
                  outline: "none",
                }}
              />
            </div>
          ))}

          {prediction !== null && (
            <div
              className="px-3 py-2"
              style={{
                backgroundColor: "color-mix(in srgb, var(--color-accent-secondary) 12%, transparent)",
                borderRadius: "var(--radius-md)",
                border: "1px solid color-mix(in srgb, var(--color-accent-secondary) 30%, transparent)",
              }}
            >
              <div className="text-xs" style={{ color: "var(--color-text-tertiary)", fontSize: "10px" }}>
                {result.dependentVar} の予測値
              </div>
              <div className="text-sm font-bold" style={{ color: "var(--color-accent-secondary)" }}>
                {fmt(prediction, 4)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// InferentialResult メインコンポーネント
// ============================================================================
export const InferentialResult: React.FC<Props> = ({ analysis, variables, dataRows }) => {
  const result = analysis.result as Record<string, unknown> | null;
  const config = (analysis.config as Record<string, unknown>) ?? {};

  if (!result) return null;

  const type = analysis.analysisType;

  return (
    <div className="h-full overflow-y-auto p-6 scrollable-area">
      <h3
        className="text-sm font-semibold mb-4 flex items-center gap-2"
        style={{ color: "var(--color-text-primary)" }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
        {analysis.name}
      </h3>

      <div className="flex flex-col gap-5">
        {/* t検定結果 */}
        {(type === "t-test") && (result.results as TTestResult[] | undefined)?.map((r, i) => (
          <TTestResultCard key={i} result={r} dataRows={dataRows} config={config} />
        ))}

        {/* Mann-Whitney結果 */}
        {(type === "mann-whitney") && (result.results as MannWhitneyResult[] | undefined)?.map((r, i) => (
          <MannWhitneyResultCard key={i} result={r} />
        ))}

        {/* カイ二乗結果 */}
        {(type === "chi-square" || type === "correlation") &&
          (result.chiSquareResults as ChiSquareResult[] | undefined)?.map((r, i) => (
            <ChiSquareResultCard key={i} result={r} />
          ))
        }

        {/* 相関結果がある場合は記述統計コンポーネントに委譲 */}
        {type === "correlation" &&
          ((result.correlations as unknown[]) ?? []).length > 0 && (
            <div
              className="p-4 text-xs"
              style={{
                backgroundColor: "var(--color-bg-secondary)",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--color-border-primary)",
                color: "var(--color-text-secondary)",
              }}
            >
              相関行列の結果は記述統計ビューで確認できます。
            </div>
          )
        }

        {/* 回帰結果 */}
        {type === "regression" && (
          <RegressionResultCard result={result as unknown as RegressionResult} dataRows={dataRows} />
        )}
      </div>
    </div>
  );
};
