// src/components/quantitative/charts/LineChart.tsx
// Stellar — D3 折れ線グラフ（複数系列・マーカー・グリッド対応）
// ResizeObserver対応、テーマ対応、日本語ツールチップ

import { useRef, useEffect, useCallback, useMemo, memo } from "react";
import * as d3 from "d3";
import {
  getThemeColors,
  getCategoryColors,
  styleAxis,
  createTooltip,
  fmt,
} from "./chartTheme";

export interface LineChartSeries {
  label: string;
  values: number[];
  color?: string;
}

export interface LineChartProps {
  /** X軸のカテゴリラベル（全系列共通） */
  xLabels: string[];
  /** 系列データ配列 */
  series: LineChartSeries[];
  /** X軸ラベル */
  xLabel?: string;
  /** Y軸ラベル */
  yLabel?: string;
  /** マーカーを表示 */
  showMarkers?: boolean;
  /** グリッドを表示 */
  showGrid?: boolean;
  /** 凡例を表示 */
  showLegend?: boolean;
  /** 曲線補間 */
  curve?: "linear" | "smooth" | "step";
  /** 固定幅 */
  width?: number;
  /** 固定高さ */
  height?: number;
  /** 追加CSSクラス */
  className?: string;
}

export const LineChart: React.FC<LineChartProps> = memo(function LineChart({
  xLabels,
  series,
  xLabel,
  yLabel,
  showMarkers = true,
  showGrid = true,
  showLegend = true,
  curve = "smooth",
  width: fixedWidth,
  height: fixedHeight = 260,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // 全系列の値範囲をメモ化
  const allVals = useMemo(
    () => series.flatMap((s) => s.values),
    [series],
  );

  const draw = useCallback(() => {
    if (!svgRef.current || !containerRef.current || xLabels.length === 0 || series.length === 0) return;

    const containerW = fixedWidth ?? containerRef.current.clientWidth;
    const width = Math.max(240, containerW);
    const height = fixedHeight;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const colors = getThemeColors();
    const catColors = getCategoryColors();
    const legendH = showLegend ? 28 : 0;
    const margin = {
      top: 8 + legendH,
      right: 16,
      bottom: xLabel ? 44 : 30,
      left: yLabel ? 56 : 44,
    };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const tooltip = createTooltip(containerRef.current);

    // スケール
    const x = d3.scalePoint<string>()
      .domain(xLabels)
      .range([0, w])
      .padding(0.1);
    const y = d3.scaleLinear()
      .domain(d3.extent(allVals) as [number, number])
      .nice()
      .range([h, 0]);

    // グリッド
    if (showGrid) {
      g.append("g")
        .call(d3.axisLeft(y).ticks(5).tickSize(-w).tickFormat(() => ""))
        .call((gg) => gg.select(".domain").remove())
        .call((gg) => gg.selectAll(".tick line")
          .attr("stroke", colors.border).attr("opacity", 0.25).attr("stroke-dasharray", "2 3"));
    }

    // カーブ関数
    const curveF = curve === "smooth" ? d3.curveMonotoneX
      : curve === "step" ? d3.curveStepAfter
      : d3.curveLinear;

    // 各系列を描画
    for (let si = 0; si < series.length; si++) {
      const s = series[si]!;
      const lineColor = s.color ?? catColors[si % catColors.length]!;

      const lineData = xLabels
        .map((label, i) => ({
          label,
          value: s.values[i],
          x: x(label) ?? 0,
        }))
        .filter((d) => d.value != null && Number.isFinite(d.value)) as Array<{ label: string; value: number; x: number }>;

      // 線
      const line = d3.line<{ x: number; value: number }>()
        .x((d) => d.x)
        .y((d) => y(d.value))
        .curve(curveF);

      g.append("path")
        .datum(lineData)
        .attr("d", line)
        .attr("fill", "none")
        .attr("stroke", lineColor)
        .attr("stroke-width", 2)
        .attr("opacity", 0.85);

      // マーカー
      if (showMarkers) {
        g.selectAll(`.marker-${si}`)
          .data(lineData)
          .join("circle")
          .attr("class", `marker-${si}`)
          .attr("cx", (d) => d.x)
          .attr("cy", (d) => y(d.value))
          .attr("r", 3.5)
          .attr("fill", lineColor)
          .attr("stroke", "#fff")
          .attr("stroke-width", 1.5)
          .attr("cursor", "pointer")
          .on("mouseenter", function (event, d) {
            d3.select(this).attr("r", 5.5);
            tooltip.show(
              `<strong>${s.label}</strong><br/>${d.label}: ${fmt(d.value)}`,
              event.offsetX, event.offsetY,
            );
          })
          .on("mousemove", (event) => { tooltip.show(tooltip.el.innerHTML, event.offsetX, event.offsetY); })
          .on("mouseleave", function () {
            d3.select(this).attr("r", 3.5);
            tooltip.hide();
          });
      }
    }

    // X軸
    const xAxisG = g.append("g").attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).tickSize(3));
    styleAxis(xAxisG as unknown as d3.Selection<SVGGElement, unknown, null, undefined>, colors.textTertiary, { fontSize: "9px" });

    // ラベルが多い場合は回転
    if (xLabels.length > 8) {
      xAxisG.selectAll(".tick text")
        .attr("transform", "rotate(-30)")
        .style("text-anchor", "end");
    }

    if (xLabel) {
      g.append("text").attr("x", w / 2).attr("y", h + 36)
        .attr("text-anchor", "middle").attr("font-size", "10px")
        .attr("fill", colors.textTertiary).text(xLabel);
    }

    // Y軸
    const yAxisG = g.append("g").call(d3.axisLeft(y).ticks(6).tickSize(3));
    styleAxis(yAxisG as unknown as d3.Selection<SVGGElement, unknown, null, undefined>, colors.textTertiary);

    if (yLabel) {
      g.append("text").attr("transform", "rotate(-90)")
        .attr("x", -h / 2).attr("y", -42)
        .attr("text-anchor", "middle").attr("font-size", "10px")
        .attr("fill", colors.textTertiary).text(yLabel);
    }

    // 凡例
    if (showLegend && series.length > 1) {
      const legendG = svg.append("g").attr("transform", `translate(${margin.left}, 8)`);
      let lx = 0;
      for (let si = 0; si < series.length; si++) {
        const s = series[si]!;
        const lineColor = s.color ?? catColors[si % catColors.length]!;

        legendG.append("line")
          .attr("x1", lx).attr("x2", lx + 14)
          .attr("y1", 6).attr("y2", 6)
          .attr("stroke", lineColor).attr("stroke-width", 2);

        if (showMarkers) {
          legendG.append("circle")
            .attr("cx", lx + 7).attr("cy", 6)
            .attr("r", 3).attr("fill", lineColor);
        }

        legendG.append("text")
          .attr("x", lx + 18).attr("y", 10)
          .attr("font-size", "10px")
          .attr("fill", colors.textSecondary)
          .text(s.label);

        lx += 20 + s.label.length * 8 + 12;
      }
    }
  }, [xLabels, series, allVals, xLabel, yLabel, showMarkers, showGrid, showLegend, curve, fixedWidth, fixedHeight]);

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
