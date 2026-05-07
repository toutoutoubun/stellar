// src/components/quantitative/results/InferentialResult.tsx
// Stellar — 推測統計結果表示コンポーネント
// TTestResultCard / MannWhitneyResultCard / ChiSquareResultCard / RegressionResultCard
// パフォーマンス最適化: React.memo, useMemo, useCallback

import type React from "react";
import { useState, useMemo, useCallback, memo, useRef } from "react";
import type { Analysis, Variable, DataRow } from "../../../types";
import type {
  TTestResult,
  MannWhitneyResult,
  ChiSquareResult,
  RegressionResult,
} from "../../../lib/stats/types";
import { BoxPlot, ScatterPlot } from "../charts";
import { fmt } from "../charts/chartTheme";
import { downloadSVG, downloadPNG } from "../../../lib/utils/exportChart";
import { useI18nStore } from "../../../stores/useI18nStore";

interface Props {
  analysis: Analysis;
  variables: Variable[];
  dataRows: DataRow[];
}

// ── ヘルパー ──
function fmtP(p: number): string {

  if (!Number.isFinite(p)) return "—";
  if (p < 0.001) return "p < .001";
  return `p = ${p.toFixed(3)}`;
}

// ── SVGアイコン ──
const InfoIcon: React.FC<{ color?: string }> = ({ color = "var(--color-accent-primary)" }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const ChevronIcon: React.FC<{ open: boolean }> = ({ open }) => (
  <svg
    width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform var(--transition-fast)" }}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const PulseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const CalcIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--color-accent-primary)" }}>
    <rect x="4" y="2" width="16" height="20" rx="2" />
    <line x1="8" y1="6" x2="16" y2="6" />
    <line x1="8" y1="10" x2="10" y2="10" />
    <line x1="12" y1="10" x2="14" y2="10" />
    <line x1="8" y1="14" x2="10" y2="14" />
    <line x1="12" y1="14" x2="14" y2="14" />
    <line x1="8" y1="18" x2="14" y2="18" />
  </svg>
);

// ============================================================================
// ExportButton — チャートエクスポート
// ============================================================================
const ExportButton = memo<{ containerRef: React.RefObject<HTMLDivElement | null>; name: string }>(
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
          style={{ color: "var(--color-text-tertiary)", cursor: "pointer", borderRadius: "var(--radius-sm)" }}
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
                style={{ color: "var(--color-text-secondary)", cursor: "pointer", borderRadius: "var(--radius-sm)" }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-bg-hover)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                {f.toUpperCase()} {useI18nStore.getState().t.common.save}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  },
);

// ============================================================================
// VerdictBadge — 有意/非有意バッジ
// ============================================================================
const VerdictBadge = memo<{ significant: boolean }>(({ significant }) => (
  <span
    className="px-2.5 py-1 text-xs font-semibold"
    style={{
      backgroundColor: significant
        ? "color-mix(in srgb, var(--color-accent-secondary) 15%, transparent)"
        : "color-mix(in srgb, var(--color-text-tertiary) 10%, transparent)",
      color: significant
        ? "var(--color-accent-secondary)"
        : "var(--color-text-tertiary)",
      borderRadius: "var(--radius-md)",
      border: `1px solid ${significant
        ? "color-mix(in srgb, var(--color-accent-secondary) 30%, transparent)"
        : "color-mix(in srgb, var(--color-text-tertiary) 15%, transparent)"}`,
    }}
  >
    {significant ? useI18nStore.getState().t.quantResults.str_aoty40 : useI18nStore.getState().t.quantResults.str_aotx6z}
  </span>
));

// ============================================================================
// EffectSizeBar — 効果量バー
// ============================================================================
const EffectSizeBar = memo<{
  value: number;
  max?: number;
  label: string;
  color?: string;
}>(({ value, max = 1.5, label, color }) => {
  const ratio = Math.min(Math.abs(value) / max, 1);
  const barColor = color || "var(--color-accent-primary)";

  return (
    <div className="flex items-center gap-3">
      <span
        className="text-xs shrink-0"
        style={{ color: "var(--color-text-tertiary)", width: "80px", fontSize: "10px" }}
      >
        {label}
      </span>
      <div
        className="flex-1 relative"
        style={{
          height: "8px",
          backgroundColor: "var(--color-bg-hover)",
          borderRadius: "4px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            width: `${ratio * 100}%`,
            backgroundColor: barColor,
            borderRadius: "4px",
            transition: "width 0.5s ease-out",
          }}
        />
      </div>
      <span
        className="text-xs font-semibold shrink-0"
        style={{ color: "var(--color-text-primary)", width: "48px", textAlign: "right" }}
      >
        {fmt(value, 3)}
      </span>
    </div>
  );
});

// ============================================================================
// TTestResultCard
// ============================================================================
const TTestResultCard = memo<{
  result: TTestResult;
  dataRows: DataRow[];
  config: Record<string, unknown>;
}>(({ result, dataRows, config }) => {
  const [showDetails, setShowDetails] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  // 群別データ取得
  const { boxGroups } = useMemo(() => {
    const categories = (config.categories as string[]) ?? [];
    const g1: number[] = [];
    const g2: number[] = [];

    const parts = (result.groupVar ?? "").includes(" vs ")
      ? (result.groupVar ?? "").split(" vs ")
      : categories;
    const l1 = parts[0] ?? useI18nStore.getState().t.quantResults.str_lpn1;
    const l2 = parts[1] ?? useI18nStore.getState().t.quantResults.str_lpn2;

    for (const row of dataRows) {
      const gVal = String(row.values[config.groupVar as string] ?? "");
      const tVal = row.values[result.targetVar];
      if (!tVal && tVal !== 0) continue;
      const num = Number(tVal);
      if (!Number.isFinite(num)) continue;
      if (gVal === String(categories[0])) g1.push(num);
      else if (gVal === String(categories[1])) g2.push(num);
    }

    return {
      boxGroups: [
        { label: l1, values: g1 },
        { label: l2, values: g2 },
      ],
      label1: l1,
      label2: l2,
    };
  }, [result, dataRows, config]);

  const toggleDetails = useCallback(() => setShowDetails((s) => !s), []);

  return (
    <div
      className="p-5"
      style={{
        backgroundColor: "var(--color-bg-secondary)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border-primary)",
      }}
    >
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            {result.targetVar}
          </span>
          <VerdictBadge significant={result.significant} />
        </div>
        <ExportButton containerRef={chartRef} name={`ttest_${result.targetVar}`} />
      </div>

      {/* 統計量行 */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {[
          { label: useI18nStore.getState().t.quantResults.str_ils, value: fmt(result.t, 3) },
          { label: "df", value: fmt(result.df, 1) },
          { label: useI18nStore.getState().t.quantResults.str_iic, value: fmtP(result.pValue) },
          { label: "Cohen's d", value: fmt(result.effectSize, 3) },
          { label: "95% CI", value: `[${fmt(result.ci95Lower)}, ${fmt(result.ci95Upper)}]` },
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
            <div className="text-xs" style={{ color: "var(--color-text-tertiary)", fontSize: "10px" }}>{item.label}</div>
            <div className="text-xs font-semibold mt-0.5" style={{ color: "var(--color-text-primary)" }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* 効果量バー */}
      <div className="mb-4">
        <EffectSizeBar
          value={Math.abs(result.effectSize)}
          max={1.5}
          label={useI18nStore.getState().t.quantResults.k_jy82sw}
          color={
            Math.abs(result.effectSize) >= 0.8
              ? "var(--color-accent-danger)"
              : Math.abs(result.effectSize) >= 0.5
                ? "var(--color-accent-warning)"
                : "var(--color-accent-primary)"
          }
        />
      </div>

      {/* 箱ひげ図 — 新チャートコンポーネント使用 */}
      {boxGroups[0]!.values.length > 0 && boxGroups[1]!.values.length > 0 && (
        <div
          ref={chartRef}
          className="p-3 mb-4"
          style={{
            backgroundColor: "var(--color-bg-primary)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border-primary)",
          }}
        >
          <BoxPlot
            groups={boxGroups}
            showOutliers
            showMean
            yLabel={result.targetVar}
            height={200}
          />
        </div>
      )}

      {/* 解釈 */}
      <div
        className="p-3 text-xs leading-relaxed mb-3"
        style={{
          backgroundColor: "color-mix(in srgb, var(--color-accent-primary) 5%, var(--color-bg-primary))",
          borderRadius: "var(--radius-md)",
          border: "1px solid color-mix(in srgb, var(--color-accent-primary) 20%, transparent)",
          color: "var(--color-text-secondary)",
        }}
      >
        <div className="flex items-start gap-2">
          <InfoIcon />
          <span>{result.interpretation}</span>
        </div>
      </div>

      {/* 詳細トグル */}
      <button
        onClick={toggleDetails}
        className="flex items-center gap-1.5 text-xs"
        style={{ color: "var(--color-text-tertiary)", cursor: "pointer", transition: "color var(--transition-fast)" }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-text-primary)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-tertiary)"; }}
      >
        <ChevronIcon open={showDetails} />
        {showDetails ? useI18nStore.getState().t.quantResults.str_awn1pu : useI18nStore.getState().t.quantResults.str_beqkrx}
      </button>

      {showDetails && (
        <div
          className="mt-2 p-3 text-xs"
          style={{
            backgroundColor: "var(--color-bg-primary)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border-primary)",
            color: "var(--color-text-secondary)",
          }}
        >
          <div className="grid grid-cols-2 gap-1">
            <span>群1平均: {fmt(result.mean1, 4)}</span>
            <span>群2平均: {fmt(result.mean2 ?? NaN, 4)}</span>
            <span>t統計量: {fmt(result.t, 6)}</span>
            <span>自由度: {fmt(result.df, 4)}</span>
            <span>p値: {result.pValue.toExponential(4)}</span>
            <span>Cohen's d: {fmt(result.effectSize, 6)}</span>
          </div>
        </div>
      )}
    </div>
  );
});

// ============================================================================
// MannWhitneyResultCard
// ============================================================================
const MannWhitneyResultCard = memo<{ result: MannWhitneyResult }>(({ result }) => (
  <div
    className="p-5"
    style={{
      backgroundColor: "var(--color-bg-secondary)",
      borderRadius: "var(--radius-lg)",
      border: "1px solid var(--color-border-primary)",
    }}
  >
    <div className="flex items-center gap-2.5 mb-4">
      <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
        {result.targetVar} (Mann-Whitney U)
      </span>
      <VerdictBadge significant={result.significant} />
    </div>

    <div className="grid grid-cols-3 gap-2 mb-4">
      {[
        { label: useI18nStore.getState().t.quantResults.str_hv3, value: fmt(result.U) },
        { label: useI18nStore.getState().t.quantResults.str_iic, value: fmtP(result.pValue) },
        { label: useI18nStore.getState().t.quantResults.str_i1s4ua, value: fmt(result.effectSizeR, 3) },
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
          <div className="text-xs" style={{ color: "var(--color-text-tertiary)", fontSize: "10px" }}>{item.label}</div>
          <div className="text-xs font-semibold mt-0.5" style={{ color: "var(--color-text-primary)" }}>{item.value}</div>
        </div>
      ))}
    </div>

    <EffectSizeBar value={result.effectSizeR} max={1} label={useI18nStore.getState().t.quantResults.str_i1s4ua} />

    <div
      className="mt-4 p-3 text-xs leading-relaxed"
      style={{
        backgroundColor: "color-mix(in srgb, var(--color-accent-primary) 5%, var(--color-bg-primary))",
        borderRadius: "var(--radius-md)",
        border: "1px solid color-mix(in srgb, var(--color-accent-primary) 20%, transparent)",
        color: "var(--color-text-secondary)",
      }}
    >
      {result.interpretation}
    </div>
  </div>
));

// ============================================================================
// ChiSquareResultCard
// ============================================================================
const ChiSquareResultCard = memo<{ result: ChiSquareResult }>(({ result }) => (
  <div
    className="p-5"
    style={{
      backgroundColor: "var(--color-bg-secondary)",
      borderRadius: "var(--radius-lg)",
      border: "1px solid var(--color-border-primary)",
    }}
  >
    <div className="flex items-center gap-2.5 mb-4">
      <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
        {result.var1Id} × {result.var2Id}
      </span>
      <VerdictBadge significant={result.significant} />
    </div>

    <div className="grid grid-cols-4 gap-2 mb-4">
      {[
        { label: useI18nStore.getState().t.quantResults.str_gc4mo0, value: fmt(result.chi2, 3) },
        { label: "df", value: String(result.df) },
        { label: useI18nStore.getState().t.quantResults.str_iic, value: fmtP(result.pValue) },
        { label: "Cramer's V", value: fmt(result.cramersV, 3) },
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
          <div className="text-xs" style={{ color: "var(--color-text-tertiary)", fontSize: "10px" }}>{item.label}</div>
          <div className="text-xs font-semibold mt-0.5" style={{ color: "var(--color-text-primary)" }}>{item.value}</div>
        </div>
      ))}
    </div>

    {/* Cramer's V バー */}
    <div className="mb-4">
      <EffectSizeBar
        value={result.cramersV}
        max={1}
        label={useI18nStore.getState().t.quantResults.k_jy82sw}
        color={
          result.cramersV >= 0.5 ? "var(--color-accent-danger)"
            : result.cramersV >= 0.3 ? "var(--color-accent-warning)"
            : "var(--color-accent-primary)"
        }
      />
    </div>

    {/* クロス集計表 */}
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th
              className="py-1.5 px-2 text-left font-medium"
              style={{ color: "var(--color-text-tertiary)", borderBottom: "2px solid var(--color-border-primary)", fontSize: "10px" }}
            />
            {result.colLabels.map((cl) => (
              <th
                key={cl}
                className="py-1.5 px-2 text-center font-medium"
                style={{ color: "var(--color-text-tertiary)", borderBottom: "2px solid var(--color-border-primary)", fontSize: "10px" }}
              >
                {cl}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.contingencyTable.map((row, ri) => (
            <tr key={ri}>
              <td
                className="py-1.5 px-2 font-medium"
                style={{ color: "var(--color-text-primary)", borderBottom: "1px solid var(--color-border-primary)", fontSize: "10px" }}
              >
                {result.rowLabels[ri]}
              </td>
              {row.map((cell, ci) => {
                const residual = cell.expected > 0
                  ? (cell.observed - cell.expected) ** 2 / cell.expected
                  : 0;
                const isHighlighted = residual > 2;
                return (
                  <td
                    key={ci}
                    className="py-1.5 px-2 text-center"
                    style={{
                      borderBottom: "1px solid var(--color-border-primary)",
                      backgroundColor: isHighlighted
                        ? "color-mix(in srgb, var(--color-accent-warning) 15%, transparent)"
                        : "transparent",
                      color: "var(--color-text-primary)",
                      fontSize: "11px",
                    }}
                  >
                    <div className="font-semibold">{cell.observed}</div>
                    <div style={{ color: "var(--color-text-tertiary)", fontSize: "9px" }}>
                      ({cell.expected.toFixed(1)})
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
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
        <span>{result.interpretation}</span>
      </div>
    </div>
  </div>
));

// ============================================================================
// RegressionResultCard — 散布図はScatterPlotコンポーネント使用
// ============================================================================
const RegressionResultCard = memo<{
  result: RegressionResult;
  dataRows: DataRow[];
}>(({ result, dataRows }) => {
  const [predictorValues, setPredictorValues] = useState<Record<string, string>>({});
  const chartRef = useRef<HTMLDivElement>(null);

  const prediction = useMemo(() => {
    if (Object.keys(predictorValues).length === 0) return null;
    let yHat = result.intercept;
    for (const coef of result.coefficients) {
      const val = Number(predictorValues[coef.varName]);
      if (!Number.isFinite(val)) return null;
      yHat += coef.b * val;
    }
    return yHat;
  }, [predictorValues, result]);

  // 散布図用データ（単回帰のみ）
  const scatterData = useMemo(() => {
    if (result.type !== "simple" || result.coefficients.length !== 1) return null;
    const xVar = result.independentVars[0]!;
    const yVar = result.dependentVar;
    const xVals: number[] = [];
    const yVals: number[] = [];
    for (const row of dataRows) {
      const xv = Number(row.values[xVar]);
      const yv = Number(row.values[yVar]);
      if (Number.isFinite(xv) && Number.isFinite(yv)) {
        xVals.push(xv);
        yVals.push(yv);
      }
    }
    return { xVals, yVals, xLabel: xVar, yLabel: yVar };
  }, [result, dataRows]);

  const handlePredictorChange = useCallback(
    (varName: string, value: string) => {
      setPredictorValues((prev) => ({ ...prev, [varName]: value }));
    },
    [],
  );

  return (
    <div
      className="p-5"
      style={{
        backgroundColor: "var(--color-bg-secondary)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border-primary)",
      }}
    >
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            {result.type === "simple" ? useI18nStore.getState().t.quantResults.str_hxj9ho : useI18nStore.getState().t.quantResults.str_d6izvt}
          </span>
          <span
            className="text-xs px-1.5 py-0.5"
            style={{
              backgroundColor: result.fPValue < 0.05
                ? "color-mix(in srgb, var(--color-accent-secondary) 15%, transparent)"
                : "color-mix(in srgb, var(--color-text-tertiary) 10%, transparent)",
              color: result.fPValue < 0.05 ? "var(--color-accent-secondary)" : "var(--color-text-tertiary)",
              borderRadius: "var(--radius-sm)",
              fontSize: "10px",
              fontWeight: 600,
            }}
          >
            {result.fPValue < 0.05 ? useI18nStore.getState().t.quantResults.str_flhjas : useI18nStore.getState().t.quantResults.str_dwt61q}
          </span>
        </div>
        <ExportButton containerRef={chartRef} name={`regression_${result.dependentVar}`} />
      </div>

      {/* R²プログレスバー */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>{useI18nStore.getState().t.quantResults.str_kt7fp}</span>
          <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            {fmt(result.r2 * 100, 1)}%
          </span>
        </div>
        <div style={{ height: "10px", backgroundColor: "var(--color-bg-hover)", borderRadius: "5px", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${Math.min(result.r2 * 100, 100)}%`,
              background: "linear-gradient(90deg, var(--color-accent-primary), var(--color-accent-secondary))",
              borderRadius: "5px",
              transition: "width 0.5s ease-out",
            }}
          />
        </div>
      </div>

      {/* 係数テーブル */}
      <div className="overflow-x-auto mb-4">
        <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {[useI18nStore.getState().t.qualitative.k_dj71i, useI18nStore.getState().t.quantitative.k_e4fi, useI18nStore.getState().t.quantResults.str_dum6g7, useI18nStore.getState().t.quantResults.str_iic, useI18nStore.getState().t.quantResults.str_fkc75].map((h) => (
                <th
                  key={h}
                  className="py-2 px-2 text-left font-medium"
                  style={{ color: "var(--color-text-tertiary)", borderBottom: "2px solid var(--color-border-primary)", fontSize: "10px" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.coefficients.map((coef) => (
              <tr key={coef.varName}>
                <td className="py-2 px-2 font-medium" style={{ color: "var(--color-text-primary)", borderBottom: "1px solid var(--color-border-primary)" }}>
                  {coef.varName}
                </td>
                <td className="py-2 px-2 text-right font-mono" style={{ color: "var(--color-text-primary)", borderBottom: "1px solid var(--color-border-primary)" }}>
                  {fmt(coef.b, 4)}
                </td>
                <td className="py-2 px-2 text-right font-mono" style={{ color: "var(--color-text-secondary)", borderBottom: "1px solid var(--color-border-primary)" }}>
                  {fmt(coef.stdError, 4)}
                </td>
                <td
                  className="py-2 px-2 text-right"
                  style={{
                    color: coef.significant ? "var(--color-accent-secondary)" : "var(--color-text-secondary)",
                    borderBottom: "1px solid var(--color-border-primary)",
                    fontWeight: coef.significant ? 600 : 400,
                  }}
                >
                  {fmtP(coef.pValue)}
                </td>
                <td className="py-2 px-2 text-center" style={{ borderBottom: "1px solid var(--color-border-primary)" }}>
                  {coef.pValue < 0.001 ? <span style={{ color: "var(--color-accent-danger)" }}>★★★</span>
                    : coef.pValue < 0.01 ? <span style={{ color: "var(--color-accent-warning)" }}>★★</span>
                    : coef.pValue < 0.05 ? <span style={{ color: "var(--color-accent-secondary)" }}>★</span>
                    : <span style={{ color: "var(--color-text-disabled)" }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 散布図（単回帰のみ） — ScatterPlotコンポーネント使用 */}
      {scatterData && (
        <div
          ref={chartRef}
          className="p-3 mb-4"
          style={{
            backgroundColor: "var(--color-bg-primary)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border-primary)",
          }}
        >
          <ScatterPlot
            xValues={scatterData.xVals}
            yValues={scatterData.yVals}
            xLabel={scatterData.xLabel}
            yLabel={scatterData.yLabel}
            showRegressionLine
            intercept={result.intercept}
            slope={result.coefficients[0]?.b ?? 0}
            enableBrush
            height={260}
          />
        </div>
      )}

      {/* 解釈 */}
      <div
        className="p-3 text-xs leading-relaxed mb-4"
        style={{
          backgroundColor: "color-mix(in srgb, var(--color-accent-primary) 5%, var(--color-bg-primary))",
          borderRadius: "var(--radius-md)",
          border: "1px solid color-mix(in srgb, var(--color-accent-primary) 20%, transparent)",
          color: "var(--color-text-secondary)",
        }}
      >
        <div className="flex items-start gap-2">
          <InfoIcon />
          <span>{result.interpretation}</span>
        </div>
      </div>

      {/* 予測計算機 */}
      <div
        className="p-4"
        style={{
          backgroundColor: "var(--color-bg-primary)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--color-border-primary)",
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <CalcIcon />
          <span className="text-xs font-semibold" style={{ color: "var(--color-text-primary)" }}>
            予測計算機
          </span>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          {result.independentVars.map((varName) => (
            <div key={varName} className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: "var(--color-text-tertiary)", fontSize: "10px" }}>
                {varName}
              </label>
              <input
                type="number"
                value={predictorValues[varName] ?? ""}
                onChange={(e) => handlePredictorChange(varName, e.target.value)}
                placeholder={useI18nStore.getState().t.quantResults.str_abedl0}
                className="px-2 py-1.5 text-xs"
                style={{
                  width: "100px",
                  backgroundColor: "var(--color-bg-secondary)",
                  color: "var(--color-text-primary)",
                  border: "1px solid var(--color-border-primary)",
                  borderRadius: "var(--radius-sm)",
                  outline: "none",
                }}
              />
            </div>
          ))}

          {prediction !== null && (
            <div
              className="px-3 py-2"
              style={{
                backgroundColor: "color-mix(in srgb, var(--color-accent-secondary) 12%, transparent)",
                borderRadius: "var(--radius-md)",
                border: "1px solid color-mix(in srgb, var(--color-accent-secondary) 30%, transparent)",
              }}
            >
              <div className="text-xs" style={{ color: "var(--color-text-tertiary)", fontSize: "10px" }}>
                {result.dependentVar} の予測値
              </div>
              <div className="text-sm font-bold" style={{ color: "var(--color-accent-secondary)" }}>
                {fmt(prediction, 4)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// InferentialResult メインコンポーネント
// ============================================================================
export const InferentialResult: React.FC<Props> = ({ analysis, variables: _variables, dataRows }) => {
  const result = analysis.result as Record<string, unknown> | null;
  const config = (analysis.config as Record<string, unknown>) ?? {};

  if (!result) return null;

  const type = analysis.analysisType;

  return (
    <div className="h-full overflow-y-auto p-6 scrollable-area">
      <h3
        className="text-sm font-semibold mb-4 flex items-center gap-2"
        style={{ color: "var(--color-text-primary)" }}
      >
        <PulseIcon />
        {analysis.name}
      </h3>

      <div className="flex flex-col gap-5">
        {/* t検定結果 */}
        {(type === "t-test") && (result.results as TTestResult[] | undefined)?.map((r, i) => (
          <TTestResultCard key={i} result={r} dataRows={dataRows} config={config} />
        ))}

        {/* Mann-Whitney結果 */}
        {(type === "mann-whitney") && (result.results as MannWhitneyResult[] | undefined)?.map((r, i) => (
          <MannWhitneyResultCard key={i} result={r} />
        ))}

        {/* カイ二乗結果 */}
        {(type === "chi-square" || type === "correlation") &&
          (result.chiSquareResults as ChiSquareResult[] | undefined)?.map((r, i) => (
            <ChiSquareResultCard key={i} result={r} />
          ))
        }

        {/* 相関結果がある場合は記述統計コンポーネントに委譲 */}
        {type === "correlation" &&
          ((result.correlations as unknown[]) ?? []).length > 0 && (
            <div
              className="p-4 text-xs"
              style={{
                backgroundColor: "var(--color-bg-secondary)",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--color-border-primary)",
                color: "var(--color-text-secondary)",
              }}
            >
              相関行列の結果は記述統計ビューで確認できます。
            </div>
          )
        }

        {/* 回帰結果 */}
        {type === "regression" && (
          <RegressionResultCard result={result as unknown as RegressionResult} dataRows={dataRows} />
        )}
      </div>
    </div>
  );
};
