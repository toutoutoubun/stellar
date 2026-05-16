// src/components/quantitative/AnalysisWizard.tsx
// Stellar — 分析ウィザード: 3ステップモーダル
// Step 1: 分析手法を選択
// Step 2: 変数を選択（手法に応じたバリデーション付き）
// Step 3: オプション設定 + 分析実行

import type React from "react";
import { useState, useCallback, useMemo } from "react";
import { useQuantitativeStore } from "../../stores/useQuantitativeStore";
import { toast } from "../ui/Toast";
import type { Variable, SaveAnalysisInput } from "../../types";
import { getQuantitativeAnalysisAddons } from "../../plugins/analysisAddons";
import {
  computeDescriptive,
  computeFrequencyTable,
  buildCorrelationMatrix,
  independentTTest,
  mannWhitneyU,
  chiSquareTest,
  linearRegression,
} from "../../lib/stats";
import { useT, useI18nStore } from "../../stores/useI18nStore";

// ── 分析手法定義 ──
type BuiltInMethodKey =
  | "descriptive"
  | "t-test"
  | "correlation"
  | "regression"
  | "network"
  | "text"
  | "survey";

type MethodKey = BuiltInMethodKey | (string & {});

interface MethodDef {
  key: MethodKey;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const BUILT_IN_METHODS: MethodDef[] = [
  {
    key: "descriptive",
    label: useI18nStore.getState().t.quantitative.k_i0q6xb,
    description: useI18nStore.getState().t.quantitative.k_nzfrkt,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    color: "var(--color-accent-primary)",
  },
  {
    key: "t-test",
    label: useI18nStore.getState().t.quantitative.k_11tcgk,
    description: useI18nStore.getState().t.quantitative.k_g9yn6a,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
    color: "var(--color-accent-warning)",
  },
  {
    key: "correlation",
    label: useI18nStore.getState().t.quantitative.k_d3lzp,
    description: useI18nStore.getState().t.quantitative.k_s1cpsa,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="7" cy="17" r="1.5" />
        <circle cx="10" cy="11" r="1.5" />
        <circle cx="14" cy="14" r="1.5" />
        <circle cx="17" cy="7" r="1.5" />
        <line x1="4" y1="20" x2="20" y2="4" strokeDasharray="3 3" opacity="0.5" />
      </svg>
    ),
    color: "var(--color-accent-info)",
  },
  {
    key: "regression",
    label: useI18nStore.getState().t.quantitative.k_faj6,
    description: useI18nStore.getState().t.quantitative.k_ar8whr,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="2" y1="20" x2="22" y2="4" />
        <circle cx="6" cy="16" r="1.5" />
        <circle cx="10" cy="12" r="1.5" />
        <circle cx="14" cy="10" r="1.5" />
        <circle cx="18" cy="6" r="1.5" />
      </svg>
    ),
    color: "var(--color-accent-secondary)",
  },
  {
    key: "network",
    label: useI18nStore.getState().t.quantitative.k_3grzn4,
    description: useI18nStore.getState().t.quantitative.k_jxpexd,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="5" r="3" />
        <circle cx="5" cy="19" r="3" />
        <circle cx="19" cy="19" r="3" />
        <line x1="12" y1="8" x2="5" y2="16" />
        <line x1="12" y1="8" x2="19" y2="16" />
      </svg>
    ),
    color: "#a78bfa",
  },
  {
    key: "text",
    label: useI18nStore.getState().t.quantitative.k_6ctu6u,
    description: useI18nStore.getState().t.quantitative.k_3s44i,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
    color: "#f472b6",
  },
  {
    key: "survey",
    label: useI18nStore.getState().t.quantitative.k_cflff6,
    description: useI18nStore.getState().t.quantitative.k_ole19n,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
        <path d="M9 14l2 2 4-4" />
      </svg>
    ),
    color: "#06b6d4",
  },
];

// ── Props ──
interface AnalysisWizardProps {
  onClose: () => void;
  onComplete: (analysisId: string) => void;
}

export const AnalysisWizard: React.FC<AnalysisWizardProps> = ({
  onClose,
  onComplete,
}) => {
  const t = useT();
  const variables = useQuantitativeStore((s) => s.variables);
  const dataRows = useQuantitativeStore((s) => s.dataRows);
  const selectedDataset = useQuantitativeStore((s) => s.selectedDataset);
  const saveAnalysis = useQuantitativeStore((s) => s.saveAnalysis);

  // ── ウィザードステート ──
  const [step, setStep] = useState(1);
  const [method, setMethod] = useState<MethodKey | null>(null);
  const [selectedVarIds, setSelectedVarIds] = useState<string[]>([]);
  const [groupVarId, setGroupVarId] = useState<string | null>(null);
  const [dependentVarId, setDependentVarId] = useState<string | null>(null);
  const [analysisName, setAnalysisName] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  // ── オプション ──
  const [alpha, setAlpha] = useState(0.05);
  const [corrMethod, setCorrMethod] = useState<"pearson" | "spearman">("pearson");
  const [useNonParametric, setUseNonParametric] = useState(false);
  const [includeIntercept, setIncludeIntercept] = useState(true);

  const quantitativeAddons = useMemo(() => getQuantitativeAnalysisAddons(), []);
  const methods = useMemo<MethodDef[]>(
    () => [
      ...BUILT_IN_METHODS,
      ...quantitativeAddons.map((addon) => ({
        key: addon.id,
        label: addon.label,
        description: addon.description,
        icon: addon.icon ?? (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v18" />
            <path d="M3 12h18" />
            <circle cx="12" cy="12" r="8" />
          </svg>
        ),
        color: addon.color ?? "var(--color-accent-info)",
      })),
    ],
    [quantitativeAddons],
  );

  const selectedAddon = useMemo(
    () => (method ? quantitativeAddons.find((addon) => addon.id === method) ?? null : null),
    [method, quantitativeAddons],
  );

  // ── 変数フィルタ ──
  const scaleVars = useMemo(
    () => variables.filter((v) => v.variableType === "scale"),
    [variables],
  );
  const nominalVars = useMemo(
    () => variables.filter((v) => v.variableType === "nominal" || v.variableType === "ordinal"),
    [variables],
  );
  const textVars = useMemo(
    () => variables.filter((v) => v.variableType === "text"),
    [variables],
  );
  const ordinalVars = useMemo(
    () => variables.filter((v) => v.variableType === "ordinal"),
    [variables],
  );
  const selectedVariables = useMemo(
    () => selectedVarIds
      .map((id) => variables.find((v) => v.id === id))
      .filter((v): v is Variable => v != null),
    [selectedVarIds, variables],
  );

  // ── バリデーション警告 ──
  const warnings = useMemo(() => {
    const w: string[] = [];
    if (!method) return w;

    if (method === "t-test") {
      if (!groupVarId) {
        w.push(t.quantitative.k_n87r1m);
      } else {
        const gv = variables.find((v) => v.id === groupVarId);
        if (gv) {
          const uniqueValues = new Set(
            dataRows.map((r) => r.values[gv.name]).filter((v) => v != null),
          );
          if (uniqueValues.size !== 2) {
            w.push(t.quantitative.k_p5rr3n);
          }
        }
      }
      if (selectedVarIds.length === 0) {
        w.push(t.quantitative.k_of65ep);
      }
    }

    if (method === "descriptive" && selectedVarIds.length === 0) {
      w.push(t.quantitative.k_skg9n2);
    }

    if (method === "correlation") {
      if (selectedVarIds.length < 2) {
        w.push(t.quantitative.k_2p1du7);
      }
    }

    if (method === "regression") {
      if (!dependentVarId) {
        w.push(t.quantitative.k_rmakzv);
      }
      if (selectedVarIds.length === 0) {
        w.push(t.quantitative.k_j8zr04);
      }
      if (dependentVarId && selectedVarIds.includes(dependentVarId)) {
        w.push(t.quantitative.k_do1ewq);
      }
    }

    if (method === "text" && selectedVarIds.length === 0) {
      w.push(t.quantitative.k_s19ryv);
    }

    if (selectedAddon) {
      const minVariables = selectedAddon.minVariables ?? 1;
      if (selectedVarIds.length < minVariables) {
        w.push(`少なくとも ${minVariables} 個の変数を選択してください。`);
      }
      if (selectedAddon.maxVariables != null && selectedVarIds.length > selectedAddon.maxVariables) {
        w.push(`${selectedAddon.maxVariables} 個以下の変数を選択してください。`);
      }
      const addonWarnings = selectedAddon.validate?.({
        datasetId: selectedDataset?.id ?? "",
        variables,
        dataRows,
        selectedVariables,
        selectedVarIds,
        alpha,
        config: { method, corrMethod, useNonParametric, includeIntercept },
      }) ?? [];
      w.push(...addonWarnings);
    }

    return w;
  }, [
    method,
    selectedVarIds,
    groupVarId,
    dependentVarId,
    variables,
    dataRows,
    selectedVariables,
    selectedAddon,
    selectedDataset,
    alpha,
    corrMethod,
    useNonParametric,
    includeIntercept,
    t,
  ]);

  const canProceedStep2 = method !== null;
  const canProceedStep3 =
    warnings.length === 0 && selectedVarIds.length >= (selectedAddon?.minVariables ?? 1);
  const canExecute = canProceedStep3 && analysisName.trim().length > 0;

  // ── 自動名前提案 ──
  const suggestedName = useMemo(() => {
    if (!method) return "";
    const methodLabel = methods.find((m) => m.key === method)?.label ?? "";
    const varNames = selectedVarIds
      .map((id) => variables.find((v) => v.id === id)?.name ?? "")
      .filter(Boolean)
      .slice(0, 3);
    const suffix = varNames.length > 0 ? ` (${varNames.join(", ")})` : "";
    return `${methodLabel}${suffix}`;
  }, [method, selectedVarIds, variables, methods]);

  // ── 変数チェックボックス切り替え ──
  const toggleVar = useCallback((id: string) => {
    setSelectedVarIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  }, []);

  // ── データ抽出ヘルパー ──
  const getNumericValues = useCallback(
    (varName: string): { clean: number[]; all: (number | null)[] } => {
      const all = dataRows.map((row) => {
        const v = row.values[varName];
        if (v == null || v === "") return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      });
      return { clean: all.filter((v): v is number => v !== null), all };
    },
    [dataRows],
  );

  const getStringValues = useCallback(
    (varName: string): string[] => {
      return dataRows
        .map((row) => row.values[varName])
        .filter((v): v is string => v != null && v !== "")
        .map(String);
    },
    [dataRows],
  );

  // ── 分析実行 ──
  const executeAnalysis = useCallback(async () => {
    if (!method || !selectedDataset || !canExecute) return;
    setIsRunning(true);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let result: any = null;
      let analysisType = method as string;

      // ─── 記述統計 ───
      if (method === "descriptive") {
        const descriptives: unknown[] = [];
        const frequencies: unknown[] = [];

        for (const v of selectedVariables) {
          if (v.variableType === "scale") {
            const { clean, all } = getNumericValues(v.name);
            descriptives.push(computeDescriptive(clean, v.id, v.name, all));
          } else if (
            v.variableType === "nominal" ||
            v.variableType === "ordinal"
          ) {
            const vals = getStringValues(v.name);
            frequencies.push(computeFrequencyTable(vals, v.id, v.name));
          }
        }

        // 相関行列（複数スケール変数の場合）
        const scaleSelected = selectedVariables.filter(
          (v) => v.variableType === "scale",
        );
        let correlations: unknown[] = [];
        if (scaleSelected.length >= 2) {
          const data: Record<string, number[]> = {};
          // ペアワイズに欠損処理
          const minLen = Math.min(
            ...scaleSelected.map((v) => getNumericValues(v.name).clean.length),
          );
          for (const v of scaleSelected) {
            data[v.name] = getNumericValues(v.name).clean.slice(0, minLen);
          }
          correlations = buildCorrelationMatrix(data, corrMethod);
        }

        result = { descriptives, frequencies, correlations };
      }

      // ─── t検定 / Mann-Whitney ───
      if (method === "t-test") {
        analysisType = useNonParametric ? "mann-whitney" : "t-test";
        const gv = variables.find((v) => v.id === groupVarId);
        if (!gv) throw new Error(t.quantitative.k_z376z3);

        const groupValues = dataRows.map((r) => r.values[gv.name]);
        const categories = [...new Set(groupValues.filter((v) => v != null))];
        if (categories.length !== 2) throw new Error(t.quantitative.k_45sx7w);

        const results: unknown[] = [];
        for (const tv of selectedVariables) {
          const g1: number[] = [];
          const g2: number[] = [];
          for (const row of dataRows) {
            const gVal = row.values[gv.name];
            const tVal = row.values[tv.name];
            if (gVal == null || tVal == null || tVal === "") continue;
            const num = Number(tVal);
            if (!Number.isFinite(num)) continue;
            if (String(gVal) === String(categories[0])) g1.push(num);
            else if (String(gVal) === String(categories[1])) g2.push(num);
          }

          if (useNonParametric) {
            results.push(
              mannWhitneyU(
                g1, g2,
                String(categories[0]), String(categories[1]),
                tv.name,
              ),
            );
          } else {
            results.push(
              independentTTest(
                g1, g2,
                String(categories[0]), String(categories[1]),
                tv.name,
              ),
            );
          }
        }
        result = { results, groupVar: gv.name, categories };
      }

      // ─── 相関 / カイ二乗 ───
      if (method === "correlation") {
        const scaleSelected = selectedVariables.filter(
          (v) => v.variableType === "scale",
        );
        const nomSelected = selectedVariables.filter(
          (v) => v.variableType === "nominal" || v.variableType === "ordinal",
        );

        let correlations: unknown[] = [];
        const chiSquareResults: unknown[] = [];

        // スケール変数同士 → 相関
        if (scaleSelected.length >= 2) {
          const data: Record<string, number[]> = {};
          const minLen = Math.min(
            ...scaleSelected.map((v) => getNumericValues(v.name).clean.length),
          );
          for (const v of scaleSelected) {
            data[v.name] = getNumericValues(v.name).clean.slice(0, minLen);
          }
          correlations = buildCorrelationMatrix(data, corrMethod);
        }

        // 名義変数同士 → カイ二乗
        if (nomSelected.length >= 2) {
          for (let i = 0; i < nomSelected.length; i++) {
            for (let j = i + 1; j < nomSelected.length; j++) {
              const v1 = nomSelected[i]!;
              const v2 = nomSelected[j]!;
              const vals1 = getStringValues(v1.name);
              const vals2 = getStringValues(v2.name);
              const cats1 = [...new Set(vals1)];
              const cats2 = [...new Set(vals2)];

              // クロス集計表を構築
              const table: number[][] = cats1.map(() =>
                new Array(cats2.length).fill(0),
              );
              for (let k = 0; k < dataRows.length; k++) {
                const r1 = dataRows[k]!.values[v1.name];
                const r2 = dataRows[k]!.values[v2.name];
                if (r1 == null || r2 == null) continue;
                const ri = cats1.indexOf(String(r1));
                const ci = cats2.indexOf(String(r2));
                if (ri >= 0 && ci >= 0) table[ri]![ci]!++;
              }

              chiSquareResults.push(
                chiSquareTest(table, cats1, cats2, v1.name, v2.name),
              );
            }
          }
        }

        analysisType = chiSquareResults.length > 0 && correlations.length === 0
          ? "chi-square"
          : "correlation";
        result = { correlations, chiSquareResults };
      }

      // ─── 回帰分析 ───
      if (method === "regression") {
        const depVar = variables.find((v) => v.id === dependentVarId);
        if (!depVar) throw new Error(t.quantitative.k_zah2ak);

        const indepVars = selectedVariables.filter(
          (v) => v.id !== dependentVarId,
        );

        // 完全ケースのみ抽出
        const validRows: { y: number; x: number[] }[] = [];
        for (const row of dataRows) {
          const yVal = Number(row.values[depVar.name]);
          if (!Number.isFinite(yVal)) continue;

          const xVals: number[] = [];
          let valid = true;
          for (const iv of indepVars) {
            const xVal = Number(row.values[iv.name]);
            if (!Number.isFinite(xVal)) { valid = false; break; }
            xVals.push(xVal);
          }
          if (valid) validRows.push({ y: yVal, x: xVals });
        }

        const y = validRows.map((r) => r.y);
        const x = validRows.map((r) => r.x);

        result = linearRegression(
          x,
          y,
          indepVars.map((v) => v.name),
          depVar.name,
        );
        analysisType = "regression";
      }

      // ─── テキスト分析 ───
      if (method === "text") {
        const { analyzeTextVariable } = await import("../../lib/stats/textAnalysis");
        const textResults: unknown[] = [];
        for (const v of selectedVariables) {
          const vals = getStringValues(v.name);
          textResults.push(await analyzeTextVariable(vals, v.id));
        }
        result = { textResults };
        analysisType = "text";
      }

      // ─── ネットワーク分析 ───
      if (method === "network") {
        const { analyzeTextCooccurrenceNetwork, buildCooccurrenceNetwork } = await import("../../lib/stats/textAnalysis");
        const networkResults: unknown[] = [];
        for (const v of selectedVariables) {
          if (v.variableType === "text") {
            const vals = getStringValues(v.name);
            networkResults.push(await analyzeTextCooccurrenceNetwork(vals));
          } else {
            const vals = getStringValues(v.name);
            networkResults.push(buildCooccurrenceNetwork(vals.map(s => s.split(/\s+/)), 2));
          }
        }
        result = { networkResults };
        analysisType = "network";
      }

      // ─── 調査データ分析 ───
      if (method === "survey") {
        // リッカート尺度の集計 + クロス集計用データをそのまま保存
        // SurveyResult コンポーネント側で集計・表示を行う
        result = { surveyVarIds: selectedVarIds };
        analysisType = "survey";
      }

      if (!result) {
        const addon = quantitativeAddons.find((item) => item.id === method);
        if (addon) {
          result = await addon.run({
            datasetId: selectedDataset.id,
            variables,
            dataRows,
            selectedVariables,
            selectedVarIds,
            alpha,
            config: { method, corrMethod, useNonParametric, includeIntercept },
          });
          analysisType = addon.id;
        }
      }

      if (!result) throw new Error(t.quantitative.k_tnsgkq);

      // ─── 結果保存 ───
      const input: SaveAnalysisInput = {
        datasetId: selectedDataset.id,
        name: analysisName.trim(),
        analysisType,
        config: {
          method,
          selectedVarIds,
          groupVarId,
          dependentVarId,
          alpha,
          corrMethod,
          useNonParametric,
          includeIntercept,
        },
        result,
      };

      const saved = await saveAnalysis(input);
      toast.success(t.quantitative.k_g99hw5);
      onComplete(saved.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.quantitative.k_rpdz75;
      toast.error(msg);
      console.error("Analysis execution failed:", err);
    } finally {
      setIsRunning(false);
    }
  }, [
    method, selectedDataset, canExecute, selectedVarIds, variables, dataRows,
    groupVarId, dependentVarId, analysisName, alpha, corrMethod,
    useNonParametric, includeIntercept, getNumericValues, getStringValues,
    selectedVariables, quantitativeAddons, saveAnalysis, onComplete,
    t,
  ]);

  // ── 変数タイプバッジ ──
  const VarBadge: React.FC<{ v: Variable }> = ({ v }) => {
    const typeMap: Record<string, { label: string; color: string }> = {
      scale: { label: t.quantitative.k_6clnyf, color: "var(--color-accent-primary)" },
      nominal: { label: t.quantitative.k_ezwc, color: "var(--color-accent-warning)" },
      ordinal: { label: t.quantitative.k_qdl5, color: "#a78bfa" },
      text: { label: t.quantitative.k_6ctu6u, color: "#f472b6" },
      date: { label: t.quantitative.k_hrir, color: "var(--color-accent-info)" },
    };
    const info = typeMap[v.variableType] ?? { label: v.variableType, color: "gray" };
    return (
      <span
        className="text-xs px-1.5 py-0.5 shrink-0"
        style={{
          color: info.color,
          backgroundColor: `color-mix(in srgb, ${info.color} 12%, transparent)`,
          borderRadius: "var(--radius-sm)",
          fontSize: "10px",
          fontWeight: 500,
        }}
      >
        {info.label}
      </span>
    );
  };

  // ── VariableCheckbox ──
  const VarCheckbox: React.FC<{
    v: Variable;
    checked: boolean;
    onChange: () => void;
    disabled?: boolean;
  }> = ({ v, checked, onChange, disabled }) => (
    <label
      className="flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer select-none"
      style={{
        backgroundColor: checked
          ? "color-mix(in srgb, var(--color-accent-primary) 8%, transparent)"
          : "transparent",
        borderRadius: "var(--radius-md)",
        border: `1px solid ${checked ? "var(--color-accent-primary)" : "var(--color-border-primary)"}`,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all var(--transition-fast)",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="accent-blue-500"
        style={{ width: "14px", height: "14px" }}
      />
      <span
        className="flex-1 truncate"
        style={{ color: "var(--color-text-primary)" }}
      >
        {v.name}
      </span>
      <VarBadge v={v} />
      {v.missingCount > 0 && (
        <span
          className="text-xs"
          style={{ color: "var(--color-accent-warning)", fontSize: "10px" }}
        >
          欠損{v.missingCount}
        </span>
      )}
    </label>
  );

  // ── ステップ表示 ──
  const renderStep1 = () => (
    <div className="flex-1 overflow-y-auto p-6 scrollable-area">
      <h3
        className="text-sm font-semibold mb-1"
        style={{ color: "var(--color-text-primary)" }}
      >
        分析手法を選択
      </h3>
      <p
        className="text-xs mb-5"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        研究課題に応じた統計分析手法を選んでください
      </p>

      <div className="grid grid-cols-2 gap-3">
        {methods.map((m) => {
          const isSelected = method === m.key;
          return (
            <button
              key={m.key}
              onClick={() => setMethod(m.key)}
              className="flex flex-col items-start gap-2.5 p-4 text-left"
              style={{
                backgroundColor: isSelected
                  ? `color-mix(in srgb, ${m.color} 10%, var(--color-bg-secondary))`
                  : "var(--color-bg-secondary)",
                border: `2px solid ${isSelected ? m.color : "var(--color-border-primary)"}`,
                borderRadius: "var(--radius-lg)",
                transition: "all var(--transition-fast)",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = `color-mix(in srgb, ${m.color} 50%, var(--color-border-primary))`;
                  e.currentTarget.style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = "var(--color-border-primary)";
                  e.currentTarget.style.transform = "none";
                }
              }}
            >
              <div className="flex items-center gap-2.5">
                <span style={{ color: m.color }}>{m.icon}</span>
                <span
                  className="text-sm font-semibold"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {m.label}
                </span>
              </div>
              <span
                className="text-xs leading-relaxed"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {m.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderStep2 = () => {
    if (!method) return null;

    // 各メソッドに応じた変数選択UI
    const renderVarSelector = () => {
      // ─── 記述統計: すべての変数 ───
      if (method === "descriptive") {
        return (
          <div>
            <p className="text-xs mb-3" style={{ color: "var(--color-text-secondary)" }}>
              記述統計を算出する変数を選択してください（複数可）
            </p>
            <div className="flex flex-col gap-1.5">
              {variables.map((v) => (
                <VarCheckbox
                  key={v.id}
                  v={v}
                  checked={selectedVarIds.includes(v.id)}
                  onChange={() => toggleVar(v.id)}
                />
              ))}
            </div>
          </div>
        );
      }

      // ─── t検定 ───
      if (method === "t-test") {
        return (
          <div className="flex flex-col gap-5">
            {/* グループ変数 */}
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: "var(--color-text-primary)" }}>
                グループ変数（2カテゴリの名義変数）
              </p>
              <div className="flex flex-col gap-1.5">
                {nominalVars.map((v) => (
                  <label
                    key={v.id}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer"
                    style={{
                      backgroundColor:
                        groupVarId === v.id
                          ? "color-mix(in srgb, var(--color-accent-primary) 8%, transparent)"
                          : "transparent",
                      borderRadius: "var(--radius-md)",
                      border: `1px solid ${groupVarId === v.id ? "var(--color-accent-primary)" : "var(--color-border-primary)"}`,
                    }}
                  >
                    <input
                      type="radio"
                      name="groupVar"
                      checked={groupVarId === v.id}
                      onChange={() => setGroupVarId(v.id)}
                      className="accent-blue-500"
                    />
                    <span style={{ color: "var(--color-text-primary)" }}>{v.name}</span>
                    <VarBadge v={v} />
                  </label>
                ))}
                {nominalVars.length === 0 && (
                  <p className="text-xs py-2 px-3" style={{ color: "var(--color-accent-warning)" }}>
                    名義変数がありません。変数定義でグループ変数を設定してください。
                  </p>
                )}
              </div>
            </div>

            {/* 検定対象変数 */}
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: "var(--color-text-primary)" }}>
                検定対象変数（スケール変数）
              </p>
              <div className="flex flex-col gap-1.5">
                {scaleVars.map((v) => (
                  <VarCheckbox
                    key={v.id}
                    v={v}
                    checked={selectedVarIds.includes(v.id)}
                    onChange={() => toggleVar(v.id)}
                  />
                ))}
                {scaleVars.length === 0 && (
                  <p className="text-xs py-2 px-3" style={{ color: "var(--color-accent-warning)" }}>
                    スケール変数がありません。
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      }

      // ─── 相関 / カイ二乗 ───
      if (method === "correlation") {
        return (
          <div>
            <p className="text-xs mb-3" style={{ color: "var(--color-text-secondary)" }}>
              関連を検定する変数を選択してください（2つ以上）。
              スケール変数同士は相関係数、名義変数同士はカイ二乗検定で分析します。
            </p>
            <div className="flex flex-col gap-1.5">
              {variables
                .filter((v) => v.variableType !== "text" && v.variableType !== "date")
                .map((v) => (
                  <VarCheckbox
                    key={v.id}
                    v={v}
                    checked={selectedVarIds.includes(v.id)}
                    onChange={() => toggleVar(v.id)}
                  />
                ))}
            </div>
          </div>
        );
      }

      // ─── 回帰 ───
      if (method === "regression") {
        return (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: "var(--color-text-primary)" }}>
                従属変数（スケール変数）
              </p>
              <div className="flex flex-col gap-1.5">
                {scaleVars.map((v) => (
                  <label
                    key={v.id}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer"
                    style={{
                      backgroundColor:
                        dependentVarId === v.id
                          ? "color-mix(in srgb, var(--color-accent-primary) 8%, transparent)"
                          : "transparent",
                      borderRadius: "var(--radius-md)",
                      border: `1px solid ${dependentVarId === v.id ? "var(--color-accent-primary)" : "var(--color-border-primary)"}`,
                    }}
                  >
                    <input
                      type="radio"
                      name="depVar"
                      checked={dependentVarId === v.id}
                      onChange={() => setDependentVarId(v.id)}
                      className="accent-blue-500"
                    />
                    <span style={{ color: "var(--color-text-primary)" }}>{v.name}</span>
                    <VarBadge v={v} />
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium mb-2" style={{ color: "var(--color-text-primary)" }}>
                独立変数（スケール変数）
              </p>
              <div className="flex flex-col gap-1.5">
                {scaleVars
                  .filter((v) => v.id !== dependentVarId)
                  .map((v) => (
                    <VarCheckbox
                      key={v.id}
                      v={v}
                      checked={selectedVarIds.includes(v.id)}
                      onChange={() => toggleVar(v.id)}
                    />
                  ))}
              </div>
            </div>
          </div>
        );
      }

      // ─── テキスト / ネットワーク ───
      if (method === "text") {
        return (
          <div>
            <p className="text-xs mb-3" style={{ color: "var(--color-text-secondary)" }}>
              テキスト分析の対象変数を選択してください
            </p>
            <div className="flex flex-col gap-1.5">
              {textVars.map((v) => (
                <VarCheckbox
                  key={v.id}
                  v={v}
                  checked={selectedVarIds.includes(v.id)}
                  onChange={() => toggleVar(v.id)}
                />
              ))}
              {textVars.length === 0 && (
                <p className="text-xs py-2 px-3" style={{ color: "var(--color-accent-warning)" }}>
                  テキスト変数がありません。
                </p>
              )}
            </div>
          </div>
        );
      }

      if (method === "network") {
        return (
          <div>
            <p className="text-xs mb-3" style={{ color: "var(--color-text-secondary)" }}>
              ネットワーク分析の対象変数を選択してください（テキストまたは名義変数）
            </p>
            <div className="flex flex-col gap-1.5">
              {variables
                .filter((v) => v.variableType === "text" || v.variableType === "nominal")
                .map((v) => (
                  <VarCheckbox
                    key={v.id}
                    v={v}
                    checked={selectedVarIds.includes(v.id)}
                    onChange={() => toggleVar(v.id)}
                  />
                ))}
            </div>
          </div>
        );
      }

      // ─── 調査データ ───
      if (method === "survey") {
        return (
          <div>
            <p className="text-xs mb-3" style={{ color: "var(--color-text-secondary)" }}>
              調査データ分析の対象変数を選択してください。順序変数（リッカート尺度）はダイバージング棒グラフで、名義変数はクロス集計表で分析されます。
            </p>
            <div className="flex flex-col gap-1.5">
              {variables
                .filter((v) => v.variableType === "ordinal" || v.variableType === "nominal" || v.variableType === "scale")
                .map((v) => (
                  <VarCheckbox
                    key={v.id}
                    v={v}
                    checked={selectedVarIds.includes(v.id)}
                    onChange={() => toggleVar(v.id)}
                  />
                ))}
              {ordinalVars.length === 0 && nominalVars.length === 0 && (
                <p className="text-xs py-2 px-3" style={{ color: "var(--color-accent-warning)" }}>
                  順序変数または名義変数がありません。変数定義を確認してください。
                </p>
              )}
            </div>
          </div>
        );
      }

      if (selectedAddon) {
        const addonVariables = variables.filter((v) =>
          selectedAddon.supportsVariable ? selectedAddon.supportsVariable(v) : true,
        );
        return (
          <div>
            <p className="text-xs mb-3" style={{ color: "var(--color-text-secondary)" }}>
              {selectedAddon.description}
            </p>
            <div className="flex flex-col gap-1.5">
              {addonVariables.map((v) => (
                <VarCheckbox
                  key={v.id}
                  v={v}
                  checked={selectedVarIds.includes(v.id)}
                  onChange={() => toggleVar(v.id)}
                  disabled={
                    !selectedVarIds.includes(v.id) &&
                    selectedAddon.maxVariables != null &&
                    selectedVarIds.length >= selectedAddon.maxVariables
                  }
                />
              ))}
              {addonVariables.length === 0 && (
                <p className="text-xs py-2 px-3" style={{ color: "var(--color-accent-warning)" }}>
                  このアドオンで使用できる変数がありません。
                </p>
              )}
            </div>
          </div>
        );
      }

      return null;
    };

    return (
      <div className="flex-1 overflow-y-auto p-6 scrollable-area">
        <h3
          className="text-sm font-semibold mb-1"
          style={{ color: "var(--color-text-primary)" }}
        >
          変数を選択
        </h3>
        <p className="text-xs mb-4" style={{ color: "var(--color-text-tertiary)" }}>
          {methods.find((m) => m.key === method)?.label} に使用する変数を選択してください
        </p>

        {renderVarSelector()}

        {/* 警告表示 */}
        {warnings.length > 0 && (
          <div
            className="mt-4 p-3 flex flex-col gap-1"
            style={{
              backgroundColor: "color-mix(in srgb, var(--color-accent-warning) 8%, transparent)",
              border: "1px solid color-mix(in srgb, var(--color-accent-warning) 30%, transparent)",
              borderRadius: "var(--radius-md)",
            }}
          >
            {warnings.map((w, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-xs"
                style={{ color: "var(--color-accent-warning)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderStep3 = () => (
    <div className="flex-1 overflow-y-auto p-6 scrollable-area">
      <h3
        className="text-sm font-semibold mb-1"
        style={{ color: "var(--color-text-primary)" }}
      >
        オプション設定
      </h3>
      <p className="text-xs mb-5" style={{ color: "var(--color-text-tertiary)" }}>
        分析のパラメータを設定し、名前を入力して実行してください
      </p>

      <div className="flex flex-col gap-4">
        {/* 分析名 */}
        <div>
          <label
            className="text-xs font-medium mb-1.5 block"
            style={{ color: "var(--color-text-primary)" }}
          >
            分析名
          </label>
          <input
            type="text"
            value={analysisName}
            onChange={(e) => setAnalysisName(e.target.value)}
            placeholder={suggestedName || t.quantitative.k_q21yxw}
            className="w-full px-3 py-2 text-xs"
            style={{
              backgroundColor: "var(--color-bg-primary)",
              color: "var(--color-text-primary)",
              border: "1px solid var(--color-border-primary)",
              borderRadius: "var(--radius-md)",
              outline: "none",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--color-accent-primary)";
              if (!analysisName && suggestedName) {
                setAnalysisName(suggestedName);
              }
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--color-border-primary)";
            }}
          />
        </div>

        {/* 有意水準 */}
        <div>
          <label
            className="text-xs font-medium mb-1.5 block"
            style={{ color: "var(--color-text-primary)" }}
          >
            有意水準 (α)
          </label>
          <div className="flex gap-2">
            {[0.01, 0.05, 0.1].map((a) => (
              <button
                key={a}
                onClick={() => setAlpha(a)}
                className="px-3 py-1.5 text-xs font-medium"
                style={{
                  color: alpha === a ? "#fff" : "var(--color-text-secondary)",
                  backgroundColor: alpha === a
                    ? "var(--color-accent-primary)"
                    : "var(--color-bg-secondary)",
                  border: `1px solid ${alpha === a ? "var(--color-accent-primary)" : "var(--color-border-primary)"}`,
                  borderRadius: "var(--radius-md)",
                  cursor: "pointer",
                  transition: "all var(--transition-fast)",
                }}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* 手法固有オプション */}
        {method === "t-test" && (
          <div>
            <label className="flex items-center gap-2.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={useNonParametric}
                onChange={(e) => setUseNonParametric(e.target.checked)}
                className="accent-blue-500"
                style={{ width: "14px", height: "14px" }}
              />
              <span style={{ color: "var(--color-text-primary)" }}>
                ノンパラメトリック検定を使用（Mann-Whitney U検定）
              </span>
            </label>
            <p className="text-xs mt-1 ml-6" style={{ color: "var(--color-text-tertiary)" }}>
              正規分布を仮定しない検定。サンプルサイズが小さい場合や、分布が歪んでいる場合に推奨
            </p>
          </div>
        )}

        {(method === "correlation" || method === "descriptive") && (
          <div>
            <label
              className="text-xs font-medium mb-1.5 block"
              style={{ color: "var(--color-text-primary)" }}
            >
              相関係数の種類
            </label>
            <div className="flex gap-2">
              {(["pearson", "spearman"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setCorrMethod(m)}
                  className="px-3 py-1.5 text-xs font-medium"
                  style={{
                    color: corrMethod === m ? "#fff" : "var(--color-text-secondary)",
                    backgroundColor: corrMethod === m
                      ? "var(--color-accent-primary)"
                      : "var(--color-bg-secondary)",
                    border: `1px solid ${corrMethod === m ? "var(--color-accent-primary)" : "var(--color-border-primary)"}`,
                    borderRadius: "var(--radius-md)",
                    cursor: "pointer",
                    transition: "all var(--transition-fast)",
                  }}
                >
                  {m === "pearson" ? "Pearson" : "Spearman"}
                </button>
              ))}
            </div>
          </div>
        )}

        {method === "regression" && (
          <div>
            <label className="flex items-center gap-2.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={includeIntercept}
                onChange={(e) => setIncludeIntercept(e.target.checked)}
                className="accent-blue-500"
                style={{ width: "14px", height: "14px" }}
              />
              <span style={{ color: "var(--color-text-primary)" }}>
                切片を含める
              </span>
            </label>
          </div>
        )}

        {/* サマリー */}
        <div
          className="p-3 mt-2"
          style={{
            backgroundColor: "var(--color-bg-secondary)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border-primary)",
          }}
        >
          <p
            className="text-xs font-medium mb-2"
            style={{ color: "var(--color-text-primary)" }}
          >
            分析サマリー
          </p>
          <div className="flex flex-col gap-1 text-xs" style={{ color: "var(--color-text-secondary)" }}>
            <span>{t.quantitative.k_method_label} {methods.find((m) => m.key === method)?.label}</span>
            <span>{t.quantitative.k_vars_label} {selectedVarIds.length}</span>
            <span>{t.quantitative.k_data_rows_label} {dataRows.length} {t.common.items}</span>
            <span>{t.quantitative.k_sig_level} {alpha}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: "var(--z-modal)", backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isRunning) onClose();
      }}
    >
      <div
        className="flex flex-col"
        style={{
          width: "640px",
          maxWidth: "92vw",
          height: "560px",
          maxHeight: "85vh",
          backgroundColor: "var(--color-bg-primary)",
          borderRadius: "var(--radius-xl)",
          border: "1px solid var(--color-border-primary)",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
          animation: "scaleIn var(--transition-normal) ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── ヘッダー ── */}
        <div
          className="shrink-0 flex items-center justify-between px-6"
          style={{
            height: "52px",
            borderBottom: "1px solid var(--color-border-primary)",
          }}
        >
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
              分析ウィザード
            </span>

            {/* ステップインジケーター */}
            <div className="flex items-center gap-1.5">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-1.5">
                  <div
                    className="flex items-center justify-center text-xs font-medium"
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "50%",
                      backgroundColor:
                        step >= s
                          ? "var(--color-accent-primary)"
                          : "var(--color-bg-hover)",
                      color: step >= s ? "#fff" : "var(--color-text-tertiary)",
                      fontSize: "10px",
                      transition: "all var(--transition-fast)",
                    }}
                  >
                    {step > s ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      s
                    )}
                  </div>
                  {s < 3 && (
                    <div
                      style={{
                        width: "20px",
                        height: "2px",
                        backgroundColor:
                          step > s
                            ? "var(--color-accent-primary)"
                            : "var(--color-border-primary)",
                        borderRadius: "1px",
                        transition: "background var(--transition-fast)",
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isRunning}
            style={{
              color: "var(--color-text-tertiary)",
              padding: "4px",
              borderRadius: "var(--radius-sm)",
              cursor: isRunning ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── コンテンツ ── */}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}

        {/* ── フッター ── */}
        <div
          className="shrink-0 flex items-center justify-between px-6"
          style={{
            height: "56px",
            borderTop: "1px solid var(--color-border-primary)",
            backgroundColor: "var(--color-bg-secondary)",
          }}
        >
          <button
            onClick={() => {
              if (step > 1) setStep(step - 1);
              else onClose();
            }}
            disabled={isRunning}
            className="px-4 py-2 text-xs font-medium"
            style={{
              color: "var(--color-text-secondary)",
              backgroundColor: "var(--color-bg-primary)",
              border: "1px solid var(--color-border-primary)",
              borderRadius: "var(--radius-md)",
              cursor: isRunning ? "not-allowed" : "pointer",
            }}
          >
            {step === 1 ? t.common.cancel : t.common.back}
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 ? !canProceedStep2 : !canProceedStep3}
              className="px-4 py-2 text-xs font-medium"
              style={{
                color: "#fff",
                backgroundColor: "var(--color-accent-primary)",
                borderRadius: "var(--radius-md)",
                opacity:
                  (step === 1 ? canProceedStep2 : canProceedStep3) ? 1 : 0.4,
                cursor:
                  (step === 1 ? canProceedStep2 : canProceedStep3)
                    ? "pointer"
                    : "not-allowed",
                transition: "all var(--transition-fast)",
              }}
            >
              {t.common.next}
            </button>
          ) : (
            <button
              onClick={() => void executeAnalysis()}
              disabled={!canExecute || isRunning}
              className="flex items-center gap-2 px-5 py-2 text-xs font-medium"
              style={{
                color: "#fff",
                backgroundColor: canExecute
                  ? "var(--color-accent-secondary)"
                  : "var(--color-bg-hover)",
                borderRadius: "var(--radius-md)",
                opacity: canExecute && !isRunning ? 1 : 0.5,
                cursor: canExecute && !isRunning ? "pointer" : "not-allowed",
                transition: "all var(--transition-fast)",
              }}
            >
              {isRunning ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                    <circle cx="12" cy="12" r="10" strokeDasharray="40" strokeDashoffset="10" />
                  </svg>
                  実行中...
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  分析を実行
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
