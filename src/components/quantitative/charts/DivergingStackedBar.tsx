// src/components/quantitative/charts/DivergingStackedBar.tsx
// Stellar — D3 ダイバージング積み上げ棒グラフ（リッカート尺度用）
// 否定(赤)→中立(灰)→肯定(青/緑) のダイバージング表示
// ResizeObserver対応、テーマ対応、日本語ツールチップ、パーセンテージラベル

import { useRef, useEffect, useCallback, useMemo, memo } from "react";
import * as d3 from "d3";
import {
  getThemeColors,
  getLikertColors,
  createTooltip,
  fmt,
} from "./chartTheme";

export interface DivergingStackedBarItem {
  /** 質問ラベル */
  label: string;
  /** 各レベルの件数（例: [10, 15, 30, 25, 20]） */
  counts: number[];
  /** レベルラベル（例: ["全く同意しない", "同意しない", "どちらでもない", "同意する", "強く同意する"]） */
  labels: string[];
}

export interface DivergingStackedBarProps {
  /** データ配列 */
  items: DivergingStackedBarItem[];
  /** カスタム色配列（省略時はリッカート色スキーム使用） */
  colors?: string[];
  /** 固定幅 */
  width?: number;
  /** 行の高さ */
  rowHeight?: number;
  /** 追加CSSクラス */
  className?: string;
}

export const DivergingStackedBar: React.FC<DivergingStackedBarProps> = memo(function DivergingStackedBar({
  items,
  colors: customColors,
  width: fixedWidth,
  rowHeight = 36,
  className,
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // セグメントデータの事前計算をメモ化
  interface Segment {
    x0: number;
    x1: number;
    pct: number;
    color: string;
    levelLabel: string;
    count: number;
  }

  interface ProcessedItem {
    label: string;
    segments: Segment[];
    total: number;
    positiveSum: number;
  }

  const processedItems: ProcessedItem[] = useMemo(() => {
    const likertColors = customColors ?? getLikertColors();
    const nLevels = items[0]?.counts.length ?? 5;
    const midIndex = Math.floor(nLevels / 2);

    return items.map((item) => {
      const total = item.counts.reduce((s, c) => s + c, 0);
      if (total === 0) return { label: item.label, segments: [], total: 0, positiveSum: 0 };

      const pcts = item.counts.map((c) => (c / total) * 100);
      const segments: Segment[] = [];

      let leftAccum = 0;
      for (let i = midIndex - 1; i >= 0; i--) {
        const p = pcts[i] ?? 0;
        segments.push({
          x0: -(leftAccum + p),
          x1: -leftAccum,
          pct: p,
          color: likertColors[i] ?? "#ccc",
          levelLabel: item.labels[i] ?? String(i + 1),
          count: item.counts[i] ?? 0,
        });
        leftAccum += p;
      }

      if (nLevels % 2 === 1) {
        const mid = pcts[midIndex] ?? 0;
        segments.push({
          x0: -mid / 2,
          x1: mid / 2,
          pct: mid,
          color: likertColors[midIndex] ?? "#ccc",
          levelLabel: item.labels[midIndex] ?? String(midIndex + 1),
          count: item.counts[midIndex] ?? 0,
        });
      }

      let rightAccum = 0;
      const rightStart = nLevels % 2 === 1 ? midIndex + 1 : midIndex;
      for (let i = rightStart; i < nLevels; i++) {
        const p = pcts[i] ?? 0;
        segments.push({
          x0: rightAccum,
          x1: rightAccum + p,
          pct: p,
          color: likertColors[i] ?? "#ccc",
          levelLabel: item.labels[i] ?? String(i + 1),
          count: item.counts[i] ?? 0,
        });
        rightAccum += p;
      }

      const positiveSum = pcts.slice(nLevels % 2 === 1 ? midIndex + 1 : midIndex).reduce((s, p) => s + p, 0);

      return { label: item.label, segments, total, positiveSum };
    });
  }, [items, customColors]);

  const draw = useCallback(() => {
    if (!svgRef.current || !containerRef.current || items.length === 0) return;

    const containerW = fixedWidth ?? containerRef.current.clientWidth;
    const width = Math.max(320, containerW);
    const height = items.length * rowHeight + 68;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const themeColors = getThemeColors();
    const likertColors = customColors ?? getLikertColors();
    const tooltip = createTooltip(containerRef.current);

    const margin = { top: 32, right: 80, bottom: 24, left: 140 };
    const w = width - margin.left - margin.right;
    const h = items.length * rowHeight;

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const nLevels = items[0]?.counts.length ?? 5;

    // メモ化済みのprocessedItemsを使用

    // Xスケール
    const maxExtent = d3.max(processedItems, (d) => {
      const minX = d3.min(d.segments, (s) => s.x0) ?? -50;
      const maxX = d3.max(d.segments, (s) => s.x1) ?? 50;
      return Math.max(Math.abs(minX), Math.abs(maxX));
    }) ?? 50;

    const x = d3.scaleLinear().domain([-maxExtent, maxExtent]).range([0, w]);

    // Yスケール
    const y = d3.scaleBand()
      .domain(processedItems.map((d) => d.label))
      .range([0, h])
      .padding(0.22);

    // 中央線
    g.append("line")
      .attr("x1", x(0)).attr("x2", x(0))
      .attr("y1", -4).attr("y2", h + 4)
      .attr("stroke", themeColors.textTertiary)
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3 3")
      .attr("opacity", 0.4);

    // 棒を描画
    for (const item of processedItems) {
      for (const seg of item.segments) {
        const barW = Math.max(0, x(seg.x1) - x(seg.x0));
        if (barW < 1) continue;

        g.append("rect")
          .attr("x", x(seg.x0))
          .attr("y", y(item.label)!)
          .attr("width", barW)
          .attr("height", y.bandwidth())
          .attr("fill", seg.color)
          .attr("rx", 3)
          .attr("cursor", "pointer")
          .on("mouseenter", (event) => {
            tooltip.show(
              `<strong>${item.label}</strong><br/>${seg.levelLabel}: ${seg.count}件 (${fmt(seg.pct, 1)}%)`,
              event.offsetX, event.offsetY,
            );
          })
          .on("mousemove", (event) => { tooltip.show(tooltip.el.innerHTML, event.offsetX, event.offsetY); })
          .on("mouseleave", () => { tooltip.hide(); });

        // セグメント内ラベル（幅が十分な場合）
        if (barW > 28 && seg.pct >= 5) {
          g.append("text")
            .attr("x", x(seg.x0) + barW / 2)
            .attr("y", (y(item.label) ?? 0) + y.bandwidth() / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .attr("font-size", "9px")
            .attr("font-weight", "600")
            .attr("fill", "#fff")
            .attr("pointer-events", "none")
            .text(`${fmt(seg.pct, 0)}%`);
        }
      }

      // 肯定率ラベル（右端）
      if (item.total > 0) {
        g.append("text")
          .attr("x", w + 8)
          .attr("y", (y(item.label) ?? 0) + y.bandwidth() / 2)
          .attr("dominant-baseline", "middle")
          .attr("font-size", "10px")
          .attr("font-weight", "600")
          .attr("fill", item.positiveSum >= 50 ? themeColors.accentSecondary : themeColors.textTertiary)
          .text(`${fmt(item.positiveSum, 0)}%`);
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
      .attr("fill", themeColors.textPrimary)
      .text((d) => d.label.length > 18 ? d.label.slice(0, 17) + "…" : d.label);

    // 凡例
    const legendG = svg.append("g").attr("transform", `translate(${margin.left}, 6)`);
    const levelLabels = items[0]?.labels ?? [];
    let legendX = 0;

    for (let i = 0; i < nLevels; i++) {
      legendG.append("rect")
        .attr("x", legendX).attr("y", 0)
        .attr("width", 10).attr("height", 10)
        .attr("fill", likertColors[i] ?? "#ccc")
        .attr("rx", 2);

      const lbl = levelLabels[i] ?? String(i + 1);
      legendG.append("text")
        .attr("x", legendX + 14).attr("y", 9)
        .attr("font-size", "9px")
        .attr("fill", themeColors.textTertiary)
        .text(lbl);

      legendX += 14 + lbl.length * 7.5 + 8;
    }
  }, [items, processedItems, customColors, fixedWidth, rowHeight]);

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
    </div>
  );
});
