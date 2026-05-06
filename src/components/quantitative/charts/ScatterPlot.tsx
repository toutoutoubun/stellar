// src/components/quantitative/charts/ScatterPlot.tsx
// Stellar — D3 散布図（回帰直線・ブラシ選択対応）
// ResizeObserver対応、テーマ対応、日本語ツールチップ

import { useRef, useEffect, useCallback, useMemo, memo } from "react";
import * as d3 from "d3";
import {
  getThemeColors,
  accentWithOpacity,
  styleAxis,
  createTooltip,
  fmt,
} from "./chartTheme";

export interface ScatterPlotProps {
  /** X値配列 */
  xValues: number[];
  /** Y値配列（xValuesと同長） */
  yValues: number[];
  /** X軸ラベル */
  xLabel?: string;
  /** Y軸ラベル */
  yLabel?: string;
  /** 回帰直線を表示 */
  showRegressionLine?: boolean;
  /** 回帰の切片（showRegressionLine時） */
  intercept?: number;
  /** 回帰の傾き（showRegressionLine時） */
  slope?: number;
  /** ブラシ選択を有効化 */
  enableBrush?: boolean;
  /** ブラシ選択時コールバック */
  onBrushSelect?: (indices: number[]) => void;
  /** ポイント半径 */
  pointRadius?: number;
  /** 固定幅 */
  width?: number;
  /** 固定高さ */
  height?: number;
  /** 追加CSSクラス */
  className?: string;
}

export const ScatterPlot: React.FC<ScatterPlotProps> = memo(function ScatterPlot({
  xValues,
  yValues,
  xLabel,
  yLabel,
  showRegressionLine = false,
  intercept = 0,
  slope = 0,
  enableBrush = false,
  onBrushSelect,
  pointRadius = 3.5,
  width: fixedWidth,
  height: fixedHeight = 280,
  className,
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // ポイントデータのメモ化
  const pointData = useMemo(
    () => xValues.map((xv, i) => ({ x: xv, y: yValues[i]!, idx: i })),
    [xValues, yValues],
  );

  const draw = useCallback(() => {
    if (!svgRef.current || !containerRef.current || xValues.length === 0) return;

    const containerW = fixedWidth ?? containerRef.current.clientWidth;
    const width = Math.max(240, containerW);
    const height = fixedHeight;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const colors = getThemeColors();
    const margin = {
      top: 12,
      right: 16,
      bottom: xLabel ? 44 : 30,
      left: yLabel ? 56 : 44,
    };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // スケール
    const x = d3.scaleLinear()
      .domain(d3.extent(xValues) as [number, number])
      .nice().range([0, w]);

    const y = d3.scaleLinear()
      .domain(d3.extent(yValues) as [number, number])
      .nice().range([h, 0]);

    const tooltip = createTooltip(containerRef.current);

    // グリッド線
    g.append("g")
      .attr("class", "grid-x")
      .attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(6).tickSize(-h).tickFormat(() => ""))
      .call((gg) => gg.select(".domain").remove())
      .call((gg) => gg.selectAll(".tick line")
        .attr("stroke", colors.border).attr("opacity", 0.3).attr("stroke-dasharray", "2 3"));

    g.append("g")
      .attr("class", "grid-y")
      .call(d3.axisLeft(y).ticks(6).tickSize(-w).tickFormat(() => ""))
      .call((gg) => gg.select(".domain").remove())
      .call((gg) => gg.selectAll(".tick line")
        .attr("stroke", colors.border).attr("opacity", 0.3).attr("stroke-dasharray", "2 3"));

    // ポイント描画
    const fillColor = accentWithOpacity(0.55);

    const dots = g.selectAll("circle.dot")
      .data(pointData)
      .join("circle")
      .attr("class", "dot")
      .attr("cx", (d) => x(d.x))
      .attr("cy", (d) => y(d.y))
      .attr("r", pointRadius)
      .attr("fill", fillColor)
      .attr("stroke", colors.accent)
      .attr("stroke-width", 0.5)
      .attr("cursor", "pointer")
      .on("mouseenter", function (event, d) {
        d3.select(this).attr("r", pointRadius + 2).attr("fill", colors.accent);
        tooltip.show(
          `${xLabel ?? "X"}: ${fmt(d.x, 3)}<br/>${yLabel ?? "Y"}: ${fmt(d.y, 3)}`,
          event.offsetX, event.offsetY,
        );
      })
      .on("mousemove", (event) => { tooltip.show(tooltip.el.innerHTML, event.offsetX, event.offsetY); })
      .on("mouseleave", function () {
        d3.select(this).attr("r", pointRadius).attr("fill", fillColor);
        tooltip.hide();
      });

    // 回帰直線
    if (showRegressionLine) {
      const xDom = x.domain();
      const lineData = [
        { x: xDom[0]!, y: intercept + slope * xDom[0]! },
        { x: xDom[1]!, y: intercept + slope * xDom[1]! },
      ];

      g.append("line")
        .attr("x1", x(lineData[0]!.x)).attr("y1", y(lineData[0]!.y))
        .attr("x2", x(lineData[1]!.x)).attr("y2", y(lineData[1]!.y))
        .attr("stroke", colors.danger)
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "6 3")
        .attr("opacity", 0.8);
    }

    // ブラシ選択
    if (enableBrush) {
      const brush = d3.brush()
        .extent([[0, 0], [w, h]])
        .on("end", (event) => {
          if (!event.selection) {
            dots.attr("opacity", 1);
            return;
          }
          const [[x0, y0], [x1, y1]] = event.selection as [[number, number], [number, number]];
          const selected: number[] = [];

          dots.attr("opacity", (d) => {
            const px = x(d.x);
            const py = y(d.y);
            const inside = px >= x0 && px <= x1 && py >= y0 && py <= y1;
            if (inside) selected.push(d.idx);
            return inside ? 1 : 0.15;
          });

          onBrushSelect?.(selected);
        });

      g.append("g")
        .attr("class", "brush")
        .call(brush);
    }

    // X軸
    const xAxisG = g.append("g").attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(6).tickSize(3));
    styleAxis(xAxisG as unknown as d3.Selection<SVGGElement, unknown, null, undefined>, colors.textTertiary);

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
  }, [xValues, yValues, pointData, xLabel, yLabel, showRegressionLine, intercept, slope, enableBrush, onBrushSelect, pointRadius, fixedWidth, fixedHeight]);

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
