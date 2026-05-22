// src/components/quantitative/charts/index.ts
// Stellar — D3チャートコンポーネント バレルエクスポート

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
