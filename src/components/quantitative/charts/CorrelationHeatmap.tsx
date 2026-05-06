// src/components/quantitative/charts/CorrelationHeatmap.tsx
// Stellar — D3 相関行列ヒートマップ（有意性スター付き）
// ResizeObserver対応、テーマ対応、日本語ツールチップ

import { useRef, useEffect, useCallback, useMemo, memo } from "react";
import * as d3 from "d3";
import {
  getThemeColors,
  isDarkTheme,
  createTooltip,
  fmt,
} from "./chartTheme";
import type { CorrelationResult } from "../../../lib/stats/types";

export interface CorrelationHeatmapProps {
  /** 相関結果配列 */
  correlations: CorrelationResult[];
  /** 変数名リスト（行列の行/列順序） */
  variables: string[];
  /** セルサイズ（px） */
  cellSize?: number;
  /** 固定幅（省略時は自動計算） */
  width?: number;
  /** 追加CSSクラス */
  className?: string;
}

export const CorrelationHeatmap: React.FC<CorrelationHeatmapProps> = memo(function CorrelationHeatmap({
  correlations,
  variables: varNames,
  cellSize: fixedCellSize,
  width: fixedWidth,
  className,
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // 相関マトリクスの事前構築をメモ化
  const matrix = useMemo(() => {
    const m: Record<string, Record<string, { r: number; p: number }>> = {};
    for (const v of varNames) {
      m[v] = {};
      m[v]![v] = { r: 1, p: 0 };
    }
    for (const c of correlations) {
      if (!m[c.var1Name]) m[c.var1Name] = {};
      if (!m[c.var2Name]) m[c.var2Name] = {};
      m[c.var1Name]![c.var2Name] = { r: c.r, p: c.pValue };
      m[c.var2Name]![c.var1Name] = { r: c.r, p: c.pValue };
    }
    return m;
  }, [correlations, varNames]);

  const draw = useCallback(() => {
    if (!svgRef.current || !containerRef.current || varNames.length === 0) return;

    const containerW = fixedWidth ?? containerRef.current.clientWidth;
    const labelWidth = 90;
    const maxCellSize = fixedCellSize ?? Math.max(32, Math.floor((containerW - labelWidth) / varNames.length));
    const cellSize = Math.min(maxCellSize, 64);
    const totalW = cellSize * varNames.length + labelWidth;
    const totalH = cellSize * varNames.length + labelWidth;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", totalW).attr("height", totalH);

    const colors = getThemeColors();
    const dark = isDarkTheme();
    const tooltip = createTooltip(containerRef.current);

    const g = svg.append("g").attr("transform", `translate(${labelWidth}, ${labelWidth})`);

    // 相関マトリクス（メモ化済み）を使用

    // 色スケール
    const colorScale = d3
      .scaleLinear<string>()
      .domain([-1, 0, 1])
      .range(dark ? ["#c92a2a", "#2d2d44", "#1c7ed6"] : ["#e03131", "#f8f9fa", "#4285f4"]);

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
          .attr("fill", Number.isFinite(r) ? colorScale(r) : (dark ? "#2d2d44" : "#f8f9fa"))
          .attr("stroke", colors.border)
          .attr("stroke-width", 0.5)
          .attr("rx", 3)
          .attr("cursor", "pointer")
          .on("mouseenter", (event) => {
            if (!Number.isFinite(r)) return;
            const sigLabel = p < 0.001 ? "p < .001" : p < 0.01 ? "p < .01" : p < 0.05 ? "p < .05" : `p = ${fmt(p, 3)}`;
            tooltip.show(
              `<strong>${varNames[i]} × ${varNames[j]}</strong><br/>r = ${fmt(r, 3)}<br/>${sigLabel}`,
              event.offsetX, event.offsetY,
            );
          })
          .on("mousemove", (event) => { tooltip.show(tooltip.el.innerHTML, event.offsetX, event.offsetY); })
          .on("mouseleave", () => { tooltip.hide(); });

        if (Number.isFinite(r)) {
          const textOnDark = Math.abs(r) > 0.4;
          const cellTextColor = textOnDark ? "#fff" : colors.textPrimary;

          // 相関係数
          g.append("text")
            .attr("x", j * cellSize + cellSize / 2)
            .attr("y", i * cellSize + cellSize / 2 - (cellSize > 40 ? 4 : 0))
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("font-size", cellSize > 44 ? "11px" : "9px")
            .attr("font-weight", "600")
            .attr("fill", cellTextColor)
            .attr("pointer-events", "none")
            .text(r.toFixed(2));

          // 有意性スター
          if (cellSize > 36) {
            const stars = p < 0.001 ? "***" : p < 0.01 ? "**" : p < 0.05 ? "*" : "";
            if (stars) {
              g.append("text")
                .attr("x", j * cellSize + cellSize / 2)
                .attr("y", i * cellSize + cellSize / 2 + (cellSize > 44 ? 10 : 7))
                .attr("text-anchor", "middle")
                .attr("font-size", "9px")
                .attr("fill", textOnDark ? "rgba(255,255,255,0.75)" : colors.textTertiary)
                .attr("pointer-events", "none")
                .text(stars);
            }
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
        .attr("fill", colors.textPrimary)
        .text(varNames[i]!.length > 11 ? varNames[i]!.slice(0, 10) + "…" : varNames[i]!);
    }

    // 列ラベル（回転）
    for (let j = 0; j < varNames.length; j++) {
      g.append("text")
        .attr("x", j * cellSize + cellSize / 2)
        .attr("y", -6)
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .attr("font-size", "10px")
        .attr("fill", colors.textPrimary)
        .attr("transform", `rotate(-45, ${j * cellSize + cellSize / 2}, -6)`)
        .text(varNames[j]!.length > 11 ? varNames[j]!.slice(0, 10) + "…" : varNames[j]!);
    }
  }, [correlations, varNames, matrix, fixedCellSize, fixedWidth]);

  useEffect(() => {
    draw();
    if (fixedWidth || !containerRef.current) return;
    const ro = new ResizeObserver(() => { draw(); });
    ro.observe(containerRef.current);
    return () => { ro.disconnect(); };
  }, [draw, fixedWidth]);

  return (
    <div ref={containerRef} className={className} style={{ position: "relative", width: "100%", overflowX: "auto" }}>
      <svg ref={svgRef} />
      <div className="flex items-center gap-3 mt-2" style={{ color: "var(--color-text-tertiary)", fontSize: "10px" }}>
        <span>* p &lt; .05</span>
        <span>** p &lt; .01</span>
        <span>*** p &lt; .001</span>
      </div>
    </div>
  );
});
