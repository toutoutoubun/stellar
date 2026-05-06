// src/components/quantitative/charts/index.ts
// Stellar — D3チャートコンポーネント バレルエクスポート
// 通常エクスポート + React.lazy による遅延ロードエクスポート

import { lazy } from "react";

// ── 通常エクスポート（同期読み込み） ──
export { Histogram } from "./Histogram";
export type { HistogramProps } from "./Histogram";

export { BoxPlot } from "./BoxPlot";
export type { BoxPlotProps, BoxPlotGroup } from "./BoxPlot";

export { BarChart } from "./BarChart";
export type { BarChartProps, BarChartDatum } from "./BarChart";

export { ScatterPlot } from "./ScatterPlot";
export type { ScatterPlotProps } from "./ScatterPlot";

export { CorrelationHeatmap } from "./CorrelationHeatmap";
export type { CorrelationHeatmapProps } from "./CorrelationHeatmap";

export { LineChart } from "./LineChart";
export type { LineChartProps, LineChartSeries } from "./LineChart";

export { WordCloud } from "./WordCloud";
export type { WordCloudProps, WordCloudDatum } from "./WordCloud";

export { DivergingStackedBar } from "./DivergingStackedBar";
export type { DivergingStackedBarProps, DivergingStackedBarItem } from "./DivergingStackedBar";

// ── 遅延ロードエクスポート（React.lazy） ──
// 使用例: <Suspense fallback={<div>Loading...</div>}><LazyScatterPlot ... /></Suspense>
export const LazyHistogram = lazy(() =>
  import("./Histogram").then((m) => ({ default: m.Histogram })),
);
export const LazyBoxPlot = lazy(() =>
  import("./BoxPlot").then((m) => ({ default: m.BoxPlot })),
);
export const LazyBarChart = lazy(() =>
  import("./BarChart").then((m) => ({ default: m.BarChart })),
);
export const LazyScatterPlot = lazy(() =>
  import("./ScatterPlot").then((m) => ({ default: m.ScatterPlot })),
);
export const LazyCorrelationHeatmap = lazy(() =>
  import("./CorrelationHeatmap").then((m) => ({ default: m.CorrelationHeatmap })),
);
export const LazyLineChart = lazy(() =>
  import("./LineChart").then((m) => ({ default: m.LineChart })),
);
export const LazyWordCloud = lazy(() =>
  import("./WordCloud").then((m) => ({ default: m.WordCloud })),
);
export const LazyDivergingStackedBar = lazy(() =>
  import("./DivergingStackedBar").then((m) => ({ default: m.DivergingStackedBar })),
);

// ── テーマユーティリティ ──
export {
  getCSSVar,
  getThemeColors,
  isDarkTheme,
  accentWithOpacity,
  hexToRgba,
  getCategoryColors,
  getLikertColors,
  styleAxis,
  createTooltip,
  fmt,
} from "./chartTheme";
