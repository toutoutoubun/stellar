// src/components/quantitative/charts/WordCloud.tsx
// Stellar — D3 ワードクラウド（手動スパイラルレイアウト）
// ResizeObserver対応、テーマ対応、日本語ツールチップ

import { useRef, useEffect, useCallback, useMemo, memo } from "react";
import * as d3 from "d3";
import {
  getCategoryColors,
  hexToRgba,
  createTooltip,
} from "./chartTheme";

export interface WordCloudDatum {
  text: string;
  value: number;
  /** 品詞など追加情報 */
  category?: string;
}

export interface WordCloudProps {
  /** 単語データ配列 */
  words: WordCloudDatum[];
  /** 最大表示単語数 */
  maxWords?: number;
  /** 最小フォントサイズ */
  minFontSize?: number;
  /** 最大フォントサイズ */
  maxFontSize?: number;
  /** 固定幅 */
  width?: number;
  /** 固定高さ */
  height?: number;
  /** 追加CSSクラス */
  className?: string;
}

interface PlacedWord {
  text: string;
  value: number;
  category?: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  rotate: number;
  width: number;
  height: number;
}

/** スパイラルレイアウト: 衝突判定付きで単語を配置 */
function spiralLayout(
  words: WordCloudDatum[],
  width: number,
  height: number,
  minFont: number,
  maxFont: number,
  catColors: string[],
): PlacedWord[] {
  if (words.length === 0) return [];

  const extent = d3.extent(words, (w) => w.value) as [number, number];
  const fontScale = d3.scaleSqrt().domain(extent).range([minFont, maxFont]);

  const placed: PlacedWord[] = [];
  const cx = width / 2;
  const cy = height / 2;

  // 衝突判定用の配置済み矩形
  const rects: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];

  function intersects(x1: number, y1: number, x2: number, y2: number): boolean {
    for (const r of rects) {
      if (x1 < r.x2 && x2 > r.x1 && y1 < r.y2 && y2 > r.y1) return true;
    }
    return false;
  }

  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    const fontSize = fontScale(w.value);
    const rotate = Math.random() > 0.7 ? 90 : 0;

    // テキスト幅/高さの推定（日本語文字は幅 ≈ fontSize）
    const charW = w.text.length * fontSize * 0.65;
    const charH = fontSize * 1.2;
    const ww = rotate === 90 ? charH : charW;
    const hh = rotate === 90 ? charW : charH;

    // アルキメデス螺旋でポジション探索
    let px = cx;
    let py = cy;
    let found = false;

    for (let t = 0; t < 1500; t++) {
      const angle = t * 0.15;
      const radius = 2 + t * 0.4;
      px = cx + radius * Math.cos(angle);
      py = cy + radius * Math.sin(angle);

      const x1 = px - ww / 2;
      const y1 = py - hh / 2;
      const x2 = px + ww / 2;
      const y2 = py + hh / 2;

      // 境界チェック
      if (x1 < 2 || y1 < 2 || x2 > width - 2 || y2 > height - 2) continue;
      // 衝突チェック
      if (!intersects(x1, y1, x2, y2)) {
        rects.push({ x1, y1, x2, y2 });
        found = true;
        break;
      }
    }

    if (!found) continue;

    const color = catColors[i % catColors.length]!;
    placed.push({
      text: w.text,
      value: w.value,
      category: w.category,
      x: px,
      y: py,
      fontSize,
      color,
      rotate,
      width: ww,
      height: hh,
    });
  }

  return placed;
}

export const WordCloud: React.FC<WordCloudProps> = memo(function WordCloud({
  words,
  maxWords = 80,
  minFontSize = 10,
  maxFontSize = 48,
  width: fixedWidth,
  height: fixedHeight = 320,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // ソート済みデータをメモ化
  const sortedWords = useMemo(
    () => [...words].sort((a, b) => b.value - a.value).slice(0, maxWords),
    [words, maxWords],
  );

  const draw = useCallback(() => {
    if (!svgRef.current || !containerRef.current || sortedWords.length === 0) return;

    const containerW = fixedWidth ?? containerRef.current.clientWidth;
    const width = Math.max(240, containerW);
    const height = fixedHeight;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const catColors = getCategoryColors();
    const tooltip = createTooltip(containerRef.current);

    // レイアウト計算
    const placed = spiralLayout(sortedWords, width, height, minFontSize, maxFontSize, catColors);

    // 描画
    const g = svg.append("g");

    g.selectAll("text")
      .data(placed)
      .join("text")
      .attr("x", (d) => d.x)
      .attr("y", (d) => d.y)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", (d) => `${d.fontSize}px`)
      .attr("font-weight", (d) => d.fontSize > maxFontSize * 0.6 ? "700" : "500")
      .attr("fill", (d) => hexToRgba(d.color, 0.8))
      .attr("transform", (d) => d.rotate ? `rotate(${d.rotate}, ${d.x}, ${d.y})` : "")
      .attr("cursor", "pointer")
      .text((d) => d.text)
      .on("mouseenter", function (event, d) {
        d3.select(this).attr("fill", d.color).attr("font-weight", "700");
        const catLine = d.category ? `<br/>品詞: ${d.category}` : "";
        tooltip.show(
          `<strong>${d.text}</strong><br/>頻度: ${d.value}${catLine}`,
          event.offsetX, event.offsetY,
        );
      })
      .on("mousemove", (event) => { tooltip.show(tooltip.el.innerHTML, event.offsetX, event.offsetY); })
      .on("mouseleave", function (_, d) {
        d3.select(this).attr("fill", hexToRgba(d.color, 0.8)).attr("font-weight", d.fontSize > maxFontSize * 0.6 ? "700" : "500");
        tooltip.hide();
      });
  }, [sortedWords, minFontSize, maxFontSize, fixedWidth, fixedHeight]);

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
