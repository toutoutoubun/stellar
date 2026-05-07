// src/components/quantitative/charts/Histogram.tsx
// Stellar — D3 ヒストグラム（正規曲線オーバーレイ付き）
// ResizeObserver対応、テーマ対応、日本語ツールチップ

import { useRef, useEffect, useCallback, useMemo, memo } from "react";
import * as d3 from "d3";
import {
  getThemeColors,
  accentWithOpacity,
  styleAxis,
  createTooltip,
} from "./chartTheme";
import { useI18nStore } from "../../../stores/useI18nStore";

export interface HistogramProps {
  /** 数値データ配列 */
  values: number[];
  /** ビン数（省略時は自動計算） */
  bins?: number;
  /** 正規曲線オーバーレイを表示 */
  showNormalCurve?: boolean;
  /** X軸ラベル */
  xLabel?: string;
  /** Y軸ラベル */
  yLabel?: string;
  /** 固定幅（省略時はResizeObserver） */
  width?: number;
  /** 固定高さ */
  height?: number;
  /** 追加CSSクラス */
  className?: string;
}

export const Histogram: React.FC<HistogramProps> = memo(function Histogram({
  values,
  bins,
  showNormalCurve = true,
  xLabel,
  yLabel = useI18nStore.getState().t.quantCharts.str_gnm2,
  width: fixedWidth,
  height: fixedHeight = 220,
  className,
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // 重い計算をメモ化: ビン数の自動計算
  const nBins = useMemo(
    () => bins ?? Math.min(30, Math.max(5, Math.ceil(Math.sqrt(values.length)))),
    [bins, values.length],
  );

  const draw = useCallback(() => {
    if (!svgRef.current || !containerRef.current || values.length === 0) return;

    const containerW = fixedWidth ?? containerRef.current.clientWidth;
    const width = Math.max(200, containerW);
    const height = fixedHeight;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const colors = getThemeColors();
    const margin = { top: 12, right: 16, bottom: xLabel ? 40 : 28, left: 44 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // スケール
    const xExtent = d3.extent(values) as [number, number];
    const x = d3.scaleLinear().domain(xExtent).nice().range([0, w]);

    const histogram = d3
      .bin()
      .domain(x.domain() as [number, number])
      .thresholds(x.ticks(nBins));
    const binsData = histogram(values);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(binsData, (d) => d.length) ?? 0])
      .nice()
      .range([h, 0]);

    const fillColor = accentWithOpacity(0.7);

    // ツールチップ
    const tooltip = createTooltip(containerRef.current);

    // バー描画
    g.selectAll("rect")
      .data(binsData)
      .join("rect")
      .attr("x", (d) => x(d.x0!) + 1)
      .attr("y", (d) => y(d.length))
      .attr("width", (d) => Math.max(0, x(d.x1!) - x(d.x0!) - 2))
      .attr("height", (d) => h - y(d.length))
      .attr("fill", fillColor)
      .attr("rx", 3)
      .attr("cursor", "pointer")
      .on("mouseenter", function (event) {
        d3.select(this).attr("fill", colors.accent).attr("opacity", 0.9);
        tooltip.show(
          useI18nStore.getState().t.quantCharts.k_5jzdhe,
          event.offsetX,
          event.offsetY,
        );
      })
      .on("mousemove", (event) => {
        tooltip.show(tooltip.el.innerHTML, event.offsetX, event.offsetY);
      })
      .on("mouseleave", function () {
        d3.select(this).attr("fill", fillColor).attr("opacity", 1);
        tooltip.hide();
      });

    // 正規曲線オーバーレイ
    if (showNormalCurve && values.length >= 3) {
      const mean = d3.mean(values) ?? 0;
      const sd = d3.deviation(values) ?? 1;

      if (sd > 0) {
        // 密度スケール（ヒストグラムのビン幅に合わせる）
        const binWidth = binsData.length > 0 ? (binsData[0]!.x1! - binsData[0]!.x0!) : 1;
        const densityScale = values.length * binWidth;

        const normalLine = d3.line<number>()
          .x((xv) => x(xv))
          .y((xv) => {
            const z = (xv - mean) / sd;
            const density = Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
            return y(density * densityScale);
          })
          .curve(d3.curveBasis);

        const xDom = x.domain();
        const step = (xDom[1]! - xDom[0]!) / 100;
        const curvePoints: number[] = [];
        for (let xi = xDom[0]!; xi <= xDom[1]!; xi += step) {
          curvePoints.push(xi);
        }

        g.append("path")
          .datum(curvePoints)
          .attr("d", normalLine)
          .attr("fill", "none")
          .attr("stroke", colors.danger)
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "6 3")
          .attr("opacity", 0.8);
      }
    }

    // X軸
    const xAxis = g
      .append("g")
      .attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(Math.min(8, nBins)).tickSize(3));
    styleAxis(xAxis as unknown as d3.Selection<SVGGElement, unknown, null, undefined>, colors.textTertiary);

    if (xLabel) {
      g.append("text")
        .attr("x", w / 2)
        .attr("y", h + 34)
        .attr("text-anchor", "middle")
        .attr("font-size", "10px")
        .attr("fill", colors.textTertiary)
        .text(xLabel);
    }

    // Y軸
    const yAxis = g.append("g").call(d3.axisLeft(y).ticks(5).tickSize(3));
    styleAxis(yAxis as unknown as d3.Selection<SVGGElement, unknown, null, undefined>, colors.textTertiary);

    if (yLabel) {
      g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -h / 2)
        .attr("y", -34)
        .attr("text-anchor", "middle")
        .attr("font-size", "10px")
        .attr("fill", colors.textTertiary)
        .text(yLabel);
    }
  }, [values, nBins, showNormalCurve, xLabel, yLabel, fixedWidth, fixedHeight]);

  // ResizeObserver
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
