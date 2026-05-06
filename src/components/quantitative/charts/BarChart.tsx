// src/components/quantitative/charts/BarChart.tsx
// Stellar — D3 棒グラフ（水平/垂直切替、カテゴリカラー対応）
// ResizeObserver対応、テーマ対応、日本語ツールチップ

import { useRef, useEffect, useCallback, useMemo, memo } from "react";
import * as d3 from "d3";
import {
  getThemeColors,
  getCategoryColors,
  hexToRgba,
  styleAxis,
  createTooltip,
  fmt,
} from "./chartTheme";

export interface BarChartDatum {
  label: string;
  value: number;
  color?: string;
}

export interface BarChartProps {
  /** データ配列 */
  data: BarChartDatum[];
  /** 水平棒グラフ */
  horizontal?: boolean;
  /** 最大表示件数（上位N件） */
  maxItems?: number;
  /** X軸ラベル */
  xLabel?: string;
  /** Y軸ラベル */
  yLabel?: string;
  /** 値ラベルを棒の上に表示 */
  showValueLabels?: boolean;
  /** 固定幅 */
  width?: number;
  /** 固定高さ */
  height?: number;
  /** 追加CSSクラス */
  className?: string;
}

export const BarChart: React.FC<BarChartProps> = memo(function BarChart({
  data,
  horizontal = false,
  maxItems = 20,
  xLabel,
  yLabel,
  showValueLabels = false,
  width: fixedWidth,
  height: fixedHeight,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // データの事前トリミングをメモ化
  const trimmedData = useMemo(
    () => data.slice(0, maxItems),
    [data, maxItems],
  );

  const draw = useCallback(() => {
    if (!svgRef.current || !containerRef.current || trimmedData.length === 0) return;

    const trimmed = trimmedData;
    const containerW = fixedWidth ?? containerRef.current.clientWidth;
    const width = Math.max(200, containerW);
    const defaultH = horizontal ? Math.max(120, trimmed.length * 28 + 60) : 220;
    const height = fixedHeight ?? defaultH;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const colors = getThemeColors();
    const catColors = getCategoryColors();
    const tooltip = createTooltip(containerRef.current);

    const total = d3.sum(trimmed, (d) => d.value);

    if (horizontal) {
      // 水平棒グラフ
      const margin = { top: 8, right: showValueLabels ? 48 : 16, bottom: xLabel ? 38 : 24, left: 100 };
      const w = width - margin.left - margin.right;
      const h = height - margin.top - margin.bottom;

      const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

      const x = d3.scaleLinear()
        .domain([0, d3.max(trimmed, (d) => d.value) ?? 0])
        .nice().range([0, w]);

      const y = d3.scaleBand()
        .domain(trimmed.map((d) => d.label))
        .range([0, h]).padding(0.2);

      g.selectAll("rect")
        .data(trimmed)
        .join("rect")
        .attr("x", 0)
        .attr("y", (d) => y(d.label)!)
        .attr("width", (d) => Math.max(0, x(d.value)))
        .attr("height", y.bandwidth())
        .attr("fill", (d, i) => d.color ?? hexToRgba(catColors[i % catColors.length]!, 0.7))
        .attr("rx", 4)
        .attr("cursor", "pointer")
        .on("mouseenter", function (event, d) {
          d3.select(this).attr("opacity", 0.85);
          const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
          tooltip.show(`<strong>${d.label}</strong><br/>値: ${fmt(d.value)}<br/>割合: ${pct}%`, event.offsetX, event.offsetY);
        })
        .on("mousemove", (event) => { tooltip.show(tooltip.el.innerHTML, event.offsetX, event.offsetY); })
        .on("mouseleave", function () {
          d3.select(this).attr("opacity", 1);
          tooltip.hide();
        });

      if (showValueLabels) {
        g.selectAll(".val-label")
          .data(trimmed)
          .join("text")
          .attr("class", "val-label")
          .attr("x", (d) => x(d.value) + 6)
          .attr("y", (d) => (y(d.label) ?? 0) + y.bandwidth() / 2)
          .attr("dominant-baseline", "middle")
          .attr("font-size", "10px")
          .attr("fill", colors.textSecondary)
          .text((d) => fmt(d.value, d.value % 1 === 0 ? 0 : 1));
      }

      const xAxisG = g.append("g").attr("transform", `translate(0,${h})`)
        .call(d3.axisBottom(x).ticks(5).tickSize(3));
      styleAxis(xAxisG as unknown as d3.Selection<SVGGElement, unknown, null, undefined>, colors.textTertiary);

      const yAxisG = g.append("g").call(d3.axisLeft(y).tickSize(0));
      styleAxis(yAxisG as unknown as d3.Selection<SVGGElement, unknown, null, undefined>, colors.textTertiary, { fontSize: "10px" });
      yAxisG.selectAll(".tick text").each(function () {
        const el = d3.select(this);
        const t = el.text();
        if (t.length > 12) el.text(t.slice(0, 11) + "…");
      });

      if (xLabel) {
        g.append("text").attr("x", w / 2).attr("y", h + 32)
          .attr("text-anchor", "middle").attr("font-size", "10px")
          .attr("fill", colors.textTertiary).text(xLabel);
      }
    } else {
      // 垂直棒グラフ
      const margin = { top: 8, right: 8, bottom: xLabel ? 52 : 42, left: yLabel ? 52 : 40 };
      const w = width - margin.left - margin.right;
      const h = height - margin.top - margin.bottom;

      const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

      const x = d3.scaleBand()
        .domain(trimmed.map((d) => d.label))
        .range([0, w]).padding(0.2);

      const y = d3.scaleLinear()
        .domain([0, d3.max(trimmed, (d) => d.value) ?? 0])
        .nice().range([h, 0]);

      g.selectAll("rect")
        .data(trimmed)
        .join("rect")
        .attr("x", (d) => x(d.label)!)
        .attr("y", (d) => y(d.value))
        .attr("width", x.bandwidth())
        .attr("height", (d) => h - y(d.value))
        .attr("fill", (d, i) => d.color ?? hexToRgba(catColors[i % catColors.length]!, 0.7))
        .attr("rx", 3)
        .attr("cursor", "pointer")
        .on("mouseenter", function (event, d) {
          d3.select(this).attr("opacity", 0.85);
          const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
          tooltip.show(`<strong>${d.label}</strong><br/>値: ${fmt(d.value)}<br/>割合: ${pct}%`, event.offsetX, event.offsetY);
        })
        .on("mousemove", (event) => { tooltip.show(tooltip.el.innerHTML, event.offsetX, event.offsetY); })
        .on("mouseleave", function () {
          d3.select(this).attr("opacity", 1);
          tooltip.hide();
        });

      if (showValueLabels) {
        g.selectAll(".val-label")
          .data(trimmed)
          .join("text")
          .attr("class", "val-label")
          .attr("x", (d) => (x(d.label) ?? 0) + x.bandwidth() / 2)
          .attr("y", (d) => y(d.value) - 5)
          .attr("text-anchor", "middle")
          .attr("font-size", "9px")
          .attr("fill", colors.textSecondary)
          .text((d) => fmt(d.value, d.value % 1 === 0 ? 0 : 1));
      }

      const xAxisG = g.append("g").attr("transform", `translate(0,${h})`)
        .call(d3.axisBottom(x).tickSize(0));
      styleAxis(xAxisG as unknown as d3.Selection<SVGGElement, unknown, null, undefined>, colors.textTertiary, { fontSize: "9px" });
      xAxisG.selectAll(".tick text")
        .attr("transform", "rotate(-30)")
        .style("text-anchor", "end")
        .each(function () {
          const el = d3.select(this);
          const t = el.text();
          if (t.length > 8) el.text(t.slice(0, 7) + "…");
        });

      const yAxisG = g.append("g").call(d3.axisLeft(y).ticks(5).tickSize(3));
      styleAxis(yAxisG as unknown as d3.Selection<SVGGElement, unknown, null, undefined>, colors.textTertiary);

      if (yLabel) {
        g.append("text").attr("transform", "rotate(-90)")
          .attr("x", -h / 2).attr("y", -38)
          .attr("text-anchor", "middle").attr("font-size", "10px")
          .attr("fill", colors.textTertiary).text(yLabel);
      }
      if (xLabel) {
        g.append("text").attr("x", w / 2).attr("y", h + 42)
          .attr("text-anchor", "middle").attr("font-size", "10px")
          .attr("fill", colors.textTertiary).text(xLabel);
      }
    }
  }, [trimmedData, horizontal, xLabel, yLabel, showValueLabels, fixedWidth, fixedHeight]);

  useEffect(() => {
    draw();
    if (fixedWidth || !containerRef.current) return;
    const ro = new ResizeObserver(() => { draw(); });
    ro.observe(containerRef.current);
    return () => { ro.disconnect(); };
  }, [draw, fixedWidth]);

  return (
    <div ref={containerRef} className={className} style={{ position: "relative", width: "100%" }}>
      <svg ref={svgRef} />
    </div>
  );
});
