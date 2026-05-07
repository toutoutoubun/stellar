// src/components/quantitative/results/DescriptiveResult.tsx
// Stellar — 記述統計結果表示コンポーネント
// 変数ごとの統計量カード + D3チャートコンポーネント + 相関ヒートマップ
// パフォーマンス最適化: React.memo, useMemo, useCallback, lazy描画

import type React from "react";
import { useState, useMemo, useCallback, memo, useRef } from "react";
import type { Analysis, Variable, DataRow } from "../../../types";
import type {
  DescriptiveResult as DescriptiveResultType,
  FrequencyTable,
  CorrelationResult,
} from "../../../lib/stats/types";
import {
  Histogram,
  BoxPlot,
  BarChart,
  CorrelationHeatmap,
} from "../charts";
import { fmt } from "../charts/chartTheme";
import { downloadSVG, downloadPNG } from "../../../lib/utils/exportChart";
import { useI18nStore } from "../../../stores/useI18nStore";

interface Props {
  analysis: Analysis;
  variables: Variable[];
  dataRows: DataRow[];
}

// ── ミニチャートタイプ ──
type ChartType = "histogram" | "boxplot" | "bar";

// ── SVGアイコン ──
const BarChartIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const GridIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const HeatmapIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18" />
    <path d="M3 15h18" />
    <path d="M9 3v18" />
    <path d="M15 3v18" />
  </svg>
);

const InfoIcon: React.FC<{ color?: string }> = ({ color = "var(--color-accent-primary)" }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

// ============================================================================
// ExportMenu — チャートエクスポートドロップダウン
// ============================================================================
const ExportMenu = memo<{ containerRef: React.RefObject<HTMLDivElement | null>; name: string }>(
  ({ containerRef, name }) => {
    const [open, setOpen] = useState(false);

    const handleExport = useCallback(
      (format: "svg" | "png") => {
        const svg = containerRef.current?.querySelector("svg");
        if (!svg) return;
        const filename = `${name}_${Date.now()}`;
        if (format === "svg") downloadSVG(svg, filename);
        else downloadPNG(svg, filename).catch(console.error);
        setOpen(false);
      },
      [containerRef, name],
    );

    return (
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1 px-1.5 py-1 text-xs"
          style={{
            color: "var(--color-text-tertiary)",
            cursor: "pointer",
            borderRadius: "var(--radius-sm)",
            transition: "all var(--transition-fast)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-text-primary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-tertiary)"; }}
        >
          <DownloadIcon />
        </button>
        {open && (
          <div
            className="absolute right-0 top-full mt-1 z-50 flex flex-col gap-0.5 p-1"
            style={{
              backgroundColor: "var(--color-bg-primary)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border-primary)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              minWidth: "80px",
            }}
          >
            {(["svg", "png"] as const).map((f) => (
              <button
                key={f}
                onClick={() => handleExport(f)}
                className="px-2 py-1.5 text-xs text-left"
                style={{
                  color: "var(--color-text-secondary)",
                  cursor: "pointer",
                  borderRadius: "var(--radius-sm)",
                  transition: "background var(--transition-fast)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-bg-hover)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                {f.toUpperCase()} 保存
              </button>
            ))}
          </div>
        )}
      </div>
    );
  },
);

// ============================================================================
// DescriptiveCard — 個別変数の記述統計カード（メモ化済み）
// ============================================================================
const DescriptiveCard = memo<{
  desc: DescriptiveResultType;
  dataRows: DataRow[];
}>(({ desc, dataRows }) => {
  const [chartType, setChartType] = useState<ChartType>("histogram");
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const values = useMemo(() => {
    return dataRows
      .map((row) => {
        const v = row.values[desc.variableName];
        if (v == null || v === "") return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      })
      .filter((v): v is number => v !== null);
  }, [dataRows, desc.variableName]);

  // BoxPlot用データ
  const boxGroups = useMemo(
    () => [{ label: desc.variableName, values }],
    [desc.variableName, values],
  );

  const handleChartSwitch = useCallback((type: ChartType) => setChartType(type), []);

  return (
    <div
      className="p-4"
      style={{
        backgroundColor: "var(--color-bg-secondary)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border-primary)",
      }}
    >
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            {desc.variableName}
          </span>
          <span
            className="text-xs px-1.5 py-0.5"
            style={{
              backgroundColor: "color-mix(in srgb, var(--color-accent-primary) 12%, transparent)",
              color: "var(--color-accent-primary)",
              borderRadius: "var(--radius-sm)",
              fontSize: "10px",
              fontWeight: 500,
            }}
          >
            n={desc.n}
          </span>
          {desc.missingCount > 0 && (
            <span
              className="text-xs px-1.5 py-0.5"
              style={{
                backgroundColor: "color-mix(in srgb, var(--color-accent-warning) 12%, transparent)",
                color: "var(--color-accent-warning)",
                borderRadius: "var(--radius-sm)",
                fontSize: "10px",
                fontWeight: 500,
              }}
            >
              欠損 {desc.missingCount}件
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* チャートタイプ切り替え */}
          {([
            { key: "histogram" as const, label: useI18nStore.getState().t.quantResults.str_5ogujq },
            { key: "boxplot" as const, label: useI18nStore.getState().t.quantResults.str_fsz0xu },
          ] as const).map((ct) => (
            <button
              key={ct.key}
              onClick={() => handleChartSwitch(ct.key)}
              className="px-2 py-1 text-xs"
              style={{
                color: chartType === ct.key ? "var(--color-accent-primary)" : "var(--color-text-tertiary)",
                backgroundColor: chartType === ct.key
                  ? "color-mix(in srgb, var(--color-accent-primary) 10%, transparent)"
                  : "transparent",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                fontSize: "10px",
                fontWeight: chartType === ct.key ? 600 : 400,
                transition: "all var(--transition-fast)",
              }}
            >
              {ct.label}
            </button>
          ))}
          <ExportMenu containerRef={chartContainerRef} name={desc.variableName} />
        </div>
      </div>

      {/* 統計量グリッド */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {[
          { label: useI18nStore.getState().t.quantResults.str_gjlg, value: fmt(desc.mean) },
          { label: useI18nStore.getState().t.quantResults.str_bvtsz, value: fmt(desc.median) },
          { label: useI18nStore.getState().t.quantResults.str_ftg7d, value: desc.mode.length > 0 ? fmt(desc.mode[0]!) : "—" },
          { label: "SD", value: fmt(desc.sd) },
          { label: useI18nStore.getState().t.quantResults.str_i0wf, value: fmt(desc.min) },
          { label: useI18nStore.getState().t.quantResults.str_i0br, value: fmt(desc.max) },
          { label: "Q1", value: fmt(desc.q1) },
          { label: "Q3", value: fmt(desc.q3) },
        ].map((item) => (
          <div
            key={item.label}
            className="p-2 text-center"
            style={{
              backgroundColor: "var(--color-bg-primary)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border-primary)",
            }}
          >
            <div className="text-xs mb-0.5" style={{ color: "var(--color-text-tertiary)", fontSize: "10px" }}>
              {item.label}
            </div>
            <div className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* チャート */}
      <div
        ref={chartContainerRef}
        className="p-2 mb-3"
        style={{
          backgroundColor: "var(--color-bg-primary)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--color-border-primary)",
        }}
      >
        {chartType === "histogram" && (
          <Histogram values={values} showNormalCurve height={160} />
        )}
        {chartType === "boxplot" && (
          <BoxPlot groups={boxGroups} showOutliers showMean height={140} />
        )}
      </div>

      {/* 解釈 */}
      <div
        className="p-3 text-xs leading-relaxed"
        style={{
          backgroundColor: "color-mix(in srgb, var(--color-accent-primary) 5%, var(--color-bg-primary))",
          borderRadius: "var(--radius-md)",
          border: "1px solid color-mix(in srgb, var(--color-accent-primary) 20%, transparent)",
          color: "var(--color-text-secondary)",
        }}
      >
        <div className="flex items-start gap-2">
          <InfoIcon />
          <span>{desc.interpretation}</span>
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// FrequencyCard — 度数分布カード（メモ化済み）
// ============================================================================
const FrequencyCard = memo<{ freq: FrequencyTable }>(({ freq }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const barData = useMemo(
    () => freq.rows.slice(0, 10).map((r) => ({ label: r.value, value: r.count })),
    [freq.rows],
  );

  return (
    <div
      className="p-4"
      style={{
        backgroundColor: "var(--color-bg-secondary)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border-primary)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            {freq.variableName}
          </span>
          <span
            className="text-xs px-1.5 py-0.5"
            style={{
              backgroundColor: "color-mix(in srgb, var(--color-accent-warning) 12%, transparent)",
              color: "var(--color-accent-warning)",
              borderRadius: "var(--radius-sm)",
              fontSize: "10px",
              fontWeight: 500,
            }}
          >
            {freq.rows.length} カテゴリ
          </span>
        </div>
        <ExportMenu containerRef={chartContainerRef} name={freq.variableName} />
      </div>

      <div className="flex gap-4">
        {/* テーブル */}
        <div className="flex-1">
          <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {[useI18nStore.getState().t.quantResults.k_ftw, useI18nStore.getState().t.quantCharts.str_gnm2, "%", useI18nStore.getState().t.quantResults.str_iww6f].map((h) => (
                  <th
                    key={h}
                    className="text-left py-1.5 px-2 font-medium"
                    style={{
                      color: "var(--color-text-tertiary)",
                      borderBottom: "1px solid var(--color-border-primary)",
                      fontSize: "10px",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {freq.rows.map((row) => (
                <tr key={row.value}>
                  <td className="py-1.5 px-2" style={{ color: "var(--color-text-primary)", borderBottom: "1px solid var(--color-border-primary)" }}>
                    {row.value}
                  </td>
                  <td className="py-1.5 px-2 text-right" style={{ color: "var(--color-text-primary)", borderBottom: "1px solid var(--color-border-primary)" }}>
                    {row.count}
                  </td>
                  <td className="py-1.5 px-2 text-right" style={{ color: "var(--color-text-secondary)", borderBottom: "1px solid var(--color-border-primary)" }}>
                    {row.percent.toFixed(1)}%
                  </td>
                  <td className="py-1.5 px-2 text-right" style={{ color: "var(--color-text-tertiary)", borderBottom: "1px solid var(--color-border-primary)" }}>
                    {row.cumPercent.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 棒グラフ */}
        <div ref={chartContainerRef} className="shrink-0" style={{ width: "240px" }}>
          <BarChart data={barData} width={240} height={140} />
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// DescriptiveResult メインコンポーネント
// ============================================================================
export const DescriptiveResult: React.FC<Props> = ({ analysis, variables: _variables, dataRows }) => {
  const result = analysis.result as {
    descriptives?: DescriptiveResultType[];
    frequencies?: FrequencyTable[];
    correlations?: CorrelationResult[];
  } | null;

  if (!result) return null;

  const { descriptives = [], frequencies = [], correlations = [] } = result;

  // 相関マトリクス用変数名
  const corrVarNames = useMemo(() => {
    if (correlations.length === 0) return [];
    const names = new Set<string>();
    for (const c of correlations) {
      names.add(c.var1Name);
      names.add(c.var2Name);
    }
    return [...names];
  }, [correlations]);

  return (
    <div className="h-full overflow-y-auto p-6 scrollable-area">
      {/* ── 記述統計カード ── */}
      {descriptives.length > 0 && (
        <div className="mb-6">
          <h3
            className="text-sm font-semibold mb-4 flex items-center gap-2"
            style={{ color: "var(--color-text-primary)" }}
          >
            <BarChartIcon />
            スケール変数の記述統計
          </h3>
          <div className="flex flex-col gap-4">
            {descriptives.map((desc) => (
              <DescriptiveCard key={desc.variableId} desc={desc} dataRows={dataRows} />
            ))}
          </div>
        </div>
      )}

      {/* ── 度数分布 ── */}
      {frequencies.length > 0 && (
        <div className="mb-6">
          <h3
            className="text-sm font-semibold mb-4 flex items-center gap-2"
            style={{ color: "var(--color-text-primary)" }}
          >
            <GridIcon />
            カテゴリ変数の度数分布
          </h3>
          <div className="flex flex-col gap-4">
            {frequencies.map((freq) => (
              <FrequencyCard key={freq.variableId} freq={freq} />
            ))}
          </div>
        </div>
      )}

      {/* ── 相関ヒートマップ ── */}
      {correlations.length > 0 && (
        <div className="mb-6">
          <h3
            className="text-sm font-semibold mb-4 flex items-center gap-2"
            style={{ color: "var(--color-text-primary)" }}
          >
            <HeatmapIcon />
            相関行列
          </h3>
          <div
            className="p-4"
            style={{
              backgroundColor: "var(--color-bg-secondary)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--color-border-primary)",
            }}
          >
            <CorrelationHeatmap correlations={correlations} variables={corrVarNames} />

            {/* 個別相関の解釈 */}
            <div className="mt-4 flex flex-col gap-2">
              {correlations.map((c, i) => (
                <div
                  key={i}
                  className="p-3 text-xs leading-relaxed"
                  style={{
                    backgroundColor: "var(--color-bg-primary)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-border-primary)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
                      {c.var1Name} × {c.var2Name}
                    </span>
                    <span
                      className="px-1.5 py-0.5 text-xs"
                      style={{
                        backgroundColor: c.pValue < 0.05
                          ? "color-mix(in srgb, var(--color-accent-secondary) 15%, transparent)"
                          : "color-mix(in srgb, var(--color-text-tertiary) 10%, transparent)",
                        color: c.pValue < 0.05
                          ? "var(--color-accent-secondary)"
                          : "var(--color-text-tertiary)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "10px",
                        fontWeight: 600,
                      }}
                    >
                      {c.pValue < 0.05 ? useI18nStore.getState().t.quantResults.str_i23q : useI18nStore.getState().t.quantResults.str_mo7pg}
                    </span>
                  </div>
                  {c.interpretation}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
