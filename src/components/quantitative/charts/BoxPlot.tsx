// src/components/quantitative/charts/BoxPlot.tsx
// Stellar — D3 箱ひげ図（ウィスカー・外れ値・複数群対応）
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

export interface BoxPlotGroup {
  label: string;
  values: number[];
}

export interface BoxPlotProps {
  /** 群ごとのデータ（1群でもOK） */
  groups: BoxPlotGroup[];
  /** 水平表示 */
  horizontal?: boolean;
  /** 外れ値を表示 */
  showOutliers?: boolean;
  /** 平均値のドットを表示 */
  showMean?: boolean;
  /** Y軸ラベル */
  yLabel?: string;
  /** 固定幅（省略時はResizeObserver） */
  width?: number;
  /** 固定高さ */
  height?: number;
  /** 追加CSSクラス */
  className?: string;
}

interface BoxStats {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  mean: number;
  iqr: number;
  lowerFence: number;
  upperFence: number;
  outliers: number[];
}

function computeBoxStats(values: number[]): BoxStats | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = d3.quantile(sorted, 0.25) ?? 0;
  const median = d3.quantile(sorted, 0.5) ?? 0;
  const q3 = d3.quantile(sorted, 0.75) ?? 0;
  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  const mean = d3.mean(sorted) ?? 0;

  const outliers = sorted.filter((v) => v < lowerFence || v > upperFence);
  const whiskerLow = Math.max(sorted[0]!, lowerFence);
  const whiskerHigh = Math.min(sorted[sorted.length - 1]!, upperFence);

  return {
    min: whiskerLow,
    q1,
    median,
    q3,
    max: whiskerHigh,
    mean,
    iqr,
    lowerFence,
    upperFence,
    outliers,
  };
}

export const BoxPlot: React.FC<BoxPlotProps> = memo(function BoxPlot({
  groups,
  horizontal = false,
  showOutliers = true,
  showMean = true,
  yLabel,
  width: fixedWidth,
  height: fixedHeight = 220,
  className,
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // 統計量の事前計算をメモ化
  const statsData = useMemo(
    () => groups.map((grp) => ({ label: grp.label, stats: computeBoxStats(grp.values) })),
    [groups],
  );

  const allValues = useMemo(
    () => groups.flatMap((grp) => grp.values),
    [groups],
  );

  const draw = useCallback(() => {
    if (!svgRef.current || !containerRef.current || groups.length === 0) return;

    const containerW = fixedWidth ?? containerRef.current.clientWidth;
    const width = Math.max(200, containerW);
    const height = fixedHeight;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const colors = getThemeColors();
    const catColors = getCategoryColors();
    const margin = { top: 12, right: 16, bottom: 32, left: yLabel ? 52 : 40 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    if (allValues.length === 0) return;

    const tooltip = createTooltip(containerRef.current);

    if (horizontal) {
      // 水平箱ひげ図
      const x = d3
        .scaleLinear()
        .domain(d3.extent(allValues) as [number, number])
        .nice()
        .range([0, w]);

      const y = d3
        .scaleBand()
        .domain(groups.map((g) => g.label))
        .range([0, h])
        .padding(0.3);

      for (let gi = 0; gi < statsData.length; gi++) {
        const { label, stats } = statsData[gi]!;
        if (!stats) continue;

        const color = catColors[gi % catColors.length]!;
        const cy = (y(label) ?? 0) + y.bandwidth() / 2;
        const bh = y.bandwidth();

        // Whisker lines
        g.append("line").attr("x1", x(stats.min)).attr("x2", x(stats.q1))
          .attr("y1", cy).attr("y2", cy).attr("stroke", color).attr("stroke-width", 1.5);
        g.append("line").attr("x1", x(stats.q3)).attr("x2", x(stats.max))
          .attr("y1", cy).attr("y2", cy).attr("stroke", color).attr("stroke-width", 1.5);

        // End caps
        for (const val of [stats.min, stats.max]) {
          g.append("line").attr("x1", x(val)).attr("x2", x(val))
            .attr("y1", cy - bh * 0.25).attr("y2", cy + bh * 0.25)
            .attr("stroke", color).attr("stroke-width", 1.5);
        }

        // Box
        g.append("rect")
          .attr("x", x(stats.q1)).attr("y", y(label)!)
          .attr("width", Math.max(0, x(stats.q3) - x(stats.q1)))
          .attr("height", bh)
          .attr("fill", hexToRgba(color, 0.2))
          .attr("stroke", color).attr("stroke-width", 1.5).attr("rx", 4);

        // Median
        g.append("line").attr("x1", x(stats.median)).attr("x2", x(stats.median))
          .attr("y1", y(label)!).attr("y2", y(label)! + bh)
          .attr("stroke", color).attr("stroke-width", 2.5);

        if (showMean) {
          g.append("circle").attr("cx", x(stats.mean)).attr("cy", cy)
            .attr("r", 3.5).attr("fill", colors.danger).attr("stroke", "#fff").attr("stroke-width", 1);
        }

        // Outliers
        if (showOutliers) {
          for (const ov of stats.outliers) {
            g.append("circle").attr("cx", x(ov)).attr("cy", cy)
              .attr("r", 2.5).attr("fill", "none")
              .attr("stroke", color).attr("stroke-width", 1).attr("opacity", 0.6);
          }
        }

        // Hover target
        g.append("rect")
          .attr("x", 0).attr("y", y(label)!)
          .attr("width", w).attr("height", bh)
          .attr("fill", "transparent").attr("cursor", "pointer")
          .on("mouseenter", (event) => {
            tooltip.show(
              `<strong>${label}</strong><br/>中央値: ${fmt(stats.median)}<br/>Q1: ${fmt(stats.q1)} / Q3: ${fmt(stats.q3)}<br/>平均: ${fmt(stats.mean)}`,
              event.offsetX, event.offsetY,
            );
          })
          .on("mousemove", (event) => { tooltip.show(tooltip.el.innerHTML, event.offsetX, event.offsetY); })
          .on("mouseleave", () => { tooltip.hide(); });
      }

      const xAxisG = g.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).ticks(6).tickSize(3));
      styleAxis(xAxisG as unknown as d3.Selection<SVGGElement, unknown, null, undefined>, colors.textTertiary);
      const yAxisG = g.append("g").call(d3.axisLeft(y).tickSize(0));
      styleAxis(yAxisG as unknown as d3.Selection<SVGGElement, unknown, null, undefined>, colors.textTertiary, { fontSize: "10px" });
    } else {
      // 垂直箱ひげ図
      const x = d3
        .scaleBand()
        .domain(groups.map((g) => g.label))
        .range([0, w])
        .padding(0.3);

      const y = d3
        .scaleLinear()
        .domain(d3.extent(allValues) as [number, number])
        .nice()
        .range([h, 0]);

      for (let gi = 0; gi < statsData.length; gi++) {
        const { label, stats } = statsData[gi]!;
        if (!stats) continue;

        const color = catColors[gi % catColors.length]!;
        const cx = (x(label) ?? 0) + x.bandwidth() / 2;
        const bw = x.bandwidth();

        // Whiskers
        g.append("line").attr("x1", cx).attr("x2", cx)
          .attr("y1", y(stats.min)).attr("y2", y(stats.q1))
          .attr("stroke", color).attr("stroke-width", 1.5);
        g.append("line").attr("x1", cx).attr("x2", cx)
          .attr("y1", y(stats.q3)).attr("y2", y(stats.max))
          .attr("stroke", color).attr("stroke-width", 1.5);

        // End caps
        for (const val of [stats.min, stats.max]) {
          g.append("line").attr("x1", cx - bw * 0.25).attr("x2", cx + bw * 0.25)
            .attr("y1", y(val)).attr("y2", y(val))
            .attr("stroke", color).attr("stroke-width", 1.5);
        }

        // Box
        g.append("rect")
          .attr("x", x(label)!).attr("y", y(stats.q3))
          .attr("width", bw)
          .attr("height", Math.max(0, y(stats.q1) - y(stats.q3)))
          .attr("fill", hexToRgba(color, 0.2))
          .attr("stroke", color).attr("stroke-width", 1.5).attr("rx", 4);

        // Median
        g.append("line").attr("x1", x(label)!).attr("x2", x(label)! + bw)
          .attr("y1", y(stats.median)).attr("y2", y(stats.median))
          .attr("stroke", color).attr("stroke-width", 2.5);

        if (showMean) {
          g.append("circle").attr("cx", cx).attr("cy", y(stats.mean))
            .attr("r", 3.5).attr("fill", colors.danger).attr("stroke", "#fff").attr("stroke-width", 1);
        }

        // Outliers
        if (showOutliers) {
          for (const ov of stats.outliers) {
            g.append("circle").attr("cx", cx).attr("cy", y(ov))
              .attr("r", 2.5).attr("fill", "none")
              .attr("stroke", color).attr("stroke-width", 1).attr("opacity", 0.6);
          }
        }

        // Hover target
        g.append("rect")
          .attr("x", x(label)!).attr("y", 0)
          .attr("width", bw).attr("height", h)
          .attr("fill", "transparent").attr("cursor", "pointer")
          .on("mouseenter", (event) => {
            tooltip.show(
              `<strong>${label}</strong><br/>中央値: ${fmt(stats.median)}<br/>Q1: ${fmt(stats.q1)} / Q3: ${fmt(stats.q3)}<br/>平均: ${fmt(stats.mean)}${stats.outliers.length > 0 ? `<br/>外れ値: ${stats.outliers.length}件` : ""}`,
              event.offsetX, event.offsetY,
            );
          })
          .on("mousemove", (event) => { tooltip.show(tooltip.el.innerHTML, event.offsetX, event.offsetY); })
          .on("mouseleave", () => { tooltip.hide(); });
      }

      const xAxisG = g.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).tickSize(0));
      styleAxis(xAxisG as unknown as d3.Selection<SVGGElement, unknown, null, undefined>, colors.textTertiary, { fontSize: "10px" });

      const yAxisG = g.append("g").call(d3.axisLeft(y).ticks(6).tickSize(3));
      styleAxis(yAxisG as unknown as d3.Selection<SVGGElement, unknown, null, undefined>, colors.textTertiary);

      if (yLabel) {
        g.append("text").attr("transform", "rotate(-90)")
          .attr("x", -h / 2).attr("y", -38)
          .attr("text-anchor", "middle").attr("font-size", "10px")
          .attr("fill", colors.textTertiary).text(yLabel);
      }
    }
  }, [groups, statsData, allValues, horizontal, showOutliers, showMean, yLabel, fixedWidth, fixedHeight]);

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
