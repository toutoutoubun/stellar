// src/stores/useQuantitativeStore.ts
// Stellar — 量的分析（Data Studio）ストア
// データセット管理・CSV インポート・変数定義・データプレビュー
// Tauri invoke() で Rust バックエンドと通信

import { create } from "zustand";
import { invoke } from "../lib/tauriShim";
import type {
  Dataset,
  DatasetSourceType,
  Variable,
  VariableType,
  DataRow,
  Analysis,
  SaveAnalysisInput,
  DataStudioTab,
  TokenFrequency,
  CreateVariableInput,
} from "../types";
import { useI18nStore } from "./useI18nStore";

type JsonRecord = Record<string, unknown>;

const SOURCE_TYPE_MAP: Record<string, DatasetSourceType> = {
  csv: "csv",
  manual: "manual",
  codes: "codes",
  from_codes: "codes",
  highlights: "highlights",
  from_highlights: "highlights",
};

const VARIABLE_TYPES = new Set<VariableType>([
  "scale",
  "nominal",
  "ordinal",
  "text",
  "date",
]);

const asRecord = (value: unknown): JsonRecord => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonRecord;
  }
  return {};
};

const parseJsonRecord = (value: unknown): JsonRecord => {
  if (typeof value === "string") {
    try {
      return asRecord(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return asRecord(value);
};

const parseJsonArray = <T>(value: unknown): T[] | null => {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : null;
    } catch {
      return null;
    }
  }
  return null;
};

const asString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const asNullableString = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const asNumber = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const normalizeSourceType = (value: unknown): DatasetSourceType => {
  const key = typeof value === "string" ? value : "manual";
  return SOURCE_TYPE_MAP[key] ?? "manual";
};

const normalizeDataset = (raw: unknown): Dataset => {
  const r = asRecord(raw);
  return {
    id: asString(r.id),
    name: asString(r.name),
    description: asNullableString(r.description),
    sourceType: normalizeSourceType(r.sourceType ?? r.source_type),
    rowCount: asNumber(r.rowCount ?? r.row_count),
    createdAt: asString(r.createdAt ?? r.created_at),
    updatedAt: asNullableString(r.updatedAt ?? r.updated_at),
  };
};

const normalizeDatasets = (raw: unknown[]): Dataset[] => raw.map(normalizeDataset);

const normalizeVariableType = (value: unknown): VariableType => {
  const type = typeof value === "string" ? value : "text";
  return VARIABLE_TYPES.has(type as VariableType) ? (type as VariableType) : "text";
};

const normalizeVariable = (raw: unknown): Variable => {
  const r = asRecord(raw);
  return {
    id: asString(r.id),
    datasetId: asString(r.datasetId ?? r.dataset_id),
    columnIndex: asNumber(r.columnIndex ?? r.column_index),
    name: asString(r.name),
    label: asNullableString(r.label),
    variableType: normalizeVariableType(r.variableType ?? r.varType ?? r.var_type),
    missingCount: asNumber(r.missingCount ?? r.missing_count),
    min: typeof r.min === "number" ? r.min : null,
    max: typeof r.max === "number" ? r.max : null,
    mean: typeof r.mean === "number" ? r.mean : null,
    dateFormat: asNullableString(r.dateFormat ?? r.date_format),
    likertLabels: parseJsonArray(r.likertLabels ?? r.likert_labels),
    createdAt: asString(r.createdAt ?? r.created_at),
    updatedAt: asNullableString(r.updatedAt ?? r.updated_at),
  };
};

const normalizeCellValue = (value: unknown): string | number | null => {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  return JSON.stringify(value);
};

const normalizeDataRow = (raw: unknown, variables: Variable[]): DataRow => {
  const r = asRecord(raw);
  const variableNameById = new Map(variables.map((v) => [v.id, v.name]));
  const rawValues = parseJsonRecord(r.values);
  const values: DataRow["values"] = {};

  for (const [key, value] of Object.entries(rawValues)) {
    values[variableNameById.get(key) ?? key] = normalizeCellValue(value);
  }

  return {
    id: asString(r.id),
    datasetId: asString(r.datasetId ?? r.dataset_id),
    rowIndex: asNumber(r.rowIndex ?? r.row_index),
    values,
  };
};

const normalizeDataRows = (raw: unknown[], variables: Variable[]): DataRow[] =>
  raw.map((row) => normalizeDataRow(row, variables));

const withVariableStats = (variables: Variable[], dataRows: DataRow[]): Variable[] =>
  variables.map((variable) => {
    const values = dataRows.map((row) => row.values[variable.name]);
    const missingCount = values.filter((value) => value == null || value === "").length;

    if (variable.variableType !== "scale" && variable.variableType !== "ordinal") {
      return { ...variable, missingCount, min: null, max: null, mean: null };
    }

    const numericValues = values
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));

    if (numericValues.length === 0) {
      return { ...variable, missingCount, min: null, max: null, mean: null };
    }

    const sum = numericValues.reduce((acc, value) => acc + value, 0);
    return {
      ...variable,
      missingCount,
      min: Math.min(...numericValues),
      max: Math.max(...numericValues),
      mean: sum / numericValues.length,
    };
  });

const parseMaybeJson = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const normalizeAnalysis = (raw: unknown): Analysis => {
  const r = asRecord(raw);
  const config = parseMaybeJson(r.config ?? r.parameters);
  const result = parseMaybeJson(r.result);
  return {
    id: asString(r.id),
    datasetId: asString(r.datasetId ?? r.dataset_id),
    name: asString(r.name),
    analysisType: asString(r.analysisType ?? r.analysis_type),
    config: asRecord(config),
    result: result && typeof result === "object" && !Array.isArray(result)
      ? (result as Record<string, unknown>)
      : null,
    createdAt: asString(r.createdAt ?? r.created_at),
    updatedAt: asNullableString(r.updatedAt ?? r.updated_at),
  };
};

const normalizeAnalyses = (raw: unknown[]): Analysis[] => raw.map(normalizeAnalysis);

// ============================================================
// ストア型定義
// ============================================================

interface QuantitativeState {
  /** 全データセット一覧 */
  datasets: Dataset[];
  /** 現在選択中のデータセット */
  selectedDataset: Dataset | null;
  /** 選択中データセットの変数定義 */
  variables: Variable[];
  /** 選択中データセットのデータ行（現在ページ分） */
  dataRows: DataRow[];
  /** 選択中データセットの分析結果一覧 */
  analyses: Analysis[];
  /** ローディング状態 */
  isLoading: boolean;
  /** エラーメッセージ */
  error: string | null;
  /** Data Studio の現在タブ */
  dataStudioTab: DataStudioTab;
  /** データプレビューの現在ページ（0-indexed） */
  previewPage: number;
  /** データプレビューの1ページあたり行数 */
  previewPageSize: number;

  // ─── アクション ───
  loadDatasets: () => Promise<void>;
  selectDataset: (id: string) => Promise<void>;
  importCsv: (
    datasetId: string,
    csvText: string,
    hasHeader: boolean,
    delimiter: string,
  ) => Promise<void>;
  createDatasetManually: (
    name: string,
    description: string,
  ) => Promise<Dataset>;
  createDatasetFromCodes: (
    projectId: string,
    name: string,
  ) => Promise<Dataset>;
  createDatasetFromHighlights: (paperId?: string) => Promise<Dataset>;
  updateVariable: (
    id: string,
    updates: Partial<Variable>,
  ) => Promise<void>;
  loadDataRows: (offset: number) => Promise<void>;
  saveAnalysis: (input: SaveAnalysisInput) => Promise<Analysis>;
  loadAnalyses: (datasetId: string) => Promise<void>;
  deleteDataset: (id: string) => Promise<void>;
  setTab: (tab: DataStudioTab) => void;
  // ── 新規追加アクション ──
  createVariable: (input: CreateVariableInput) => Promise<Variable>;
  deleteVariable: (id: string) => Promise<void>;
  autoDetectVariableTypes: (datasetId: string) => Promise<void>;
  insertDataRows: (datasetId: string, rows: Record<string, unknown>[]) => Promise<number>;
  deleteDataRows: (datasetId: string) => Promise<void>;
  getTokenFrequencies: (datasetId: string, variableId: string, limit?: number) => Promise<TokenFrequency[]>;
  saveTokenFrequencies: (datasetId: string, variableId: string, frequencies: TokenFrequency[]) => Promise<void>;
  getAnalysis: (id: string) => Promise<Analysis | null>;
  updateDataset: (id: string, updates: Partial<Dataset>) => Promise<void>;
}

// ============================================================
// ストア実装
// ============================================================

export const useQuantitativeStore = create<QuantitativeState>((set, get) => ({
  datasets: [],
  selectedDataset: null,
  variables: [],
  dataRows: [],
  analyses: [],
  isLoading: false,
  error: null,
  dataStudioTab: "import",
  previewPage: 0,
  previewPageSize: 50,

  // ── データセット一覧の読み込み ──
  loadDatasets: async () => {
    set({ isLoading: true, error: null });
    try {
      const datasets = normalizeDatasets(await invoke<unknown[]>("get_datasets"));
      set({ datasets });
    } catch (e) {
      const msg = typeof e === "string" ? e : useI18nStore.getState().t.stores.str_aaisnh;
      set({ error: msg });
      console.error("Failed to load datasets:", e);
    } finally {
      set({ isLoading: false });
    }
  },

  // ── データセット選択 → 変数 + データ行を読み込み ──
  selectDataset: async (id: string) => {
    const { datasets } = get();
    const dataset = datasets.find((d) => d.id === id) ?? null;
    set({
      selectedDataset: dataset,
      variables: [],
      dataRows: [],
      analyses: [],
      previewPage: 0,
      error: null,
    });

    if (!dataset) return;

    set({ isLoading: true });
    try {
      const [rawVariables, rawDataRows, rawAnalyses] = await Promise.all([
        invoke<unknown[]>("get_variables", { datasetId: id }),
        invoke<unknown[]>("get_data_rows", {
          datasetId: id,
          offset: 0,
          limit: get().previewPageSize,
        }),
        invoke<unknown[]>("get_analyses", { datasetId: id }).catch(() => [] as unknown[]),
      ]);
      const dataRows = normalizeDataRows(rawDataRows, rawVariables.map(normalizeVariable));
      const variables = withVariableStats(rawVariables.map(normalizeVariable), dataRows);
      const analyses = normalizeAnalyses(rawAnalyses);
      set({ variables, dataRows, analyses });
    } catch (e) {
      const msg =
        typeof e === "string" ? e : useI18nStore.getState().t.stores.str_5us4d5;
      set({ error: msg });
      console.error("Failed to load dataset data:", e);
    } finally {
      set({ isLoading: false });
    }
  },

  // ── CSV インポート ──
  importCsv: async (
    datasetId: string,
    csvText: string,
    hasHeader: boolean,
    delimiter: string,
  ) => {
    set({ isLoading: true, error: null });
    try {
      await invoke("import_csv", {
        input: {
          datasetId,
          csvText,
          hasHeader,
          delimiter,
        },
      });

      // インポート後にデータセット情報を再読み込み
      const [rawDatasets, rawVariables, rawDataRows] = await Promise.all([
        invoke<unknown[]>("get_datasets"),
        invoke<unknown[]>("get_variables", { datasetId }),
        invoke<unknown[]>("get_data_rows", {
          datasetId,
          offset: 0,
          limit: get().previewPageSize,
        }),
      ]);

      const datasets = normalizeDatasets(rawDatasets);
      const dataRows = normalizeDataRows(rawDataRows, rawVariables.map(normalizeVariable));
      const variables = withVariableStats(rawVariables.map(normalizeVariable), dataRows);
      const updatedDataset = datasets.find((d) => d.id === datasetId) ?? null;
      set({
        datasets,
        selectedDataset: updatedDataset,
        variables,
        dataRows,
        previewPage: 0,
      });
    } catch (e) {
      const msg =
        typeof e === "string" ? e : useI18nStore.getState().t.stores.CSV;
      set({ error: msg });
      console.error("Failed to import CSV:", e);
      throw e;
    } finally {
      set({ isLoading: false });
    }
  },

  // ── 手動データセット作成 ──
  createDatasetManually: async (name: string, description: string) => {
    set({ isLoading: true, error: null });
    try {
      const dataset = normalizeDataset(await invoke<unknown>("create_dataset", {
        input: {
          name,
          description,
          sourceType: "manual",
          sourceRef: null,
        },
      }));
      if (!dataset || !dataset.id) {
        throw new Error(useI18nStore.getState().t.stores.str_v3w5t1);
      }
      // 楽観的更新
      set((s) => ({
        datasets: [dataset, ...s.datasets],
        selectedDataset: dataset,
        variables: [],
        dataRows: [],
      }));
      return dataset;
    } catch (e) {
      const msg =
        typeof e === "string" ? e : useI18nStore.getState().t.stores.str_x5gx9o;
      set({ error: msg });
      console.error("Failed to create dataset:", e);
      throw e;
    } finally {
      set({ isLoading: false });
    }
  },

  // ── QDAコードからデータセット生成 ──
  createDatasetFromCodes: async (projectId: string, name: string) => {
    set({ isLoading: true, error: null });
    try {
      const dataset = normalizeDataset(await invoke<unknown>("create_dataset_from_codes", {
        projectId,
        datasetName: name,
      }));
      if (!dataset || !dataset.id) {
        throw new Error(useI18nStore.getState().t.stores.str_6cia2i);
      }
      set((s) => ({
        datasets: [dataset, ...s.datasets],
        selectedDataset: dataset,
      }));
      // 変数・データ行を読み込み
      await get().selectDataset(dataset.id);
      return dataset;
    } catch (e) {
      const msg =
        typeof e === "string"
          ? e
          : useI18nStore.getState().t.stores.str_aohbxz;
      set({ error: msg });
      console.error("Failed to create dataset from codes:", e);
      throw e;
    } finally {
      set({ isLoading: false });
    }
  },

  // ── ハイライトからデータセット生成 ──
  createDatasetFromHighlights: async (paperId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const dataset = normalizeDataset(await invoke<unknown>(
        "create_dataset_from_highlights",
        {
          paperId: paperId ?? null,
        },
      ));
      if (!dataset || !dataset.id) {
        throw new Error(useI18nStore.getState().t.stores.str_8kycem);
      }
      set((s) => ({
        datasets: [dataset, ...s.datasets],
        selectedDataset: dataset,
      }));
      await get().selectDataset(dataset.id);
      return dataset;
    } catch (e) {
      const msg =
        typeof e === "string"
          ? e
          : useI18nStore.getState().t.stores.str_qn4ygv;
      set({ error: msg });
      console.error("Failed to create dataset from highlights:", e);
      throw e;
    } finally {
      set({ isLoading: false });
    }
  },

  // ── 変数定義の更新（楽観的更新） ──
  updateVariable: async (id: string, updates: Partial<Variable>) => {
    const { variables } = get();
    const prevVariables = [...variables];
    const current = variables.find((v) => v.id === id);

    // 楽観的更新: ローカル状態を即座に反映
    set({
      variables: variables.map((v) =>
        v.id === id ? { ...v, ...updates } : v,
      ),
    });

    try {
      const updated = normalizeVariable(await invoke<unknown>("update_variable", {
        id,
        name: updates.name ?? current?.name ?? "",
        label: updates.label ?? current?.label ?? null,
        varType: updates.variableType ?? current?.variableType ?? "text",
        unit: null,
        likertLabels: updates.likertLabels !== undefined
          ? JSON.stringify(updates.likertLabels)
          : current?.likertLabels
          ? JSON.stringify(current.likertLabels)
          : null,
      }));
      const dataRows = get().dataRows;
      set((s) => ({
        variables: withVariableStats(
          s.variables.map((v) => (v.id === id ? { ...updated, ...v } : v)),
          dataRows,
        ),
      }));
    } catch (e) {
      // 失敗時はロールバック
      set({ variables: prevVariables });
      const msg =
        typeof e === "string" ? e : useI18nStore.getState().t.stores.str_8mhtrx;
      set({ error: msg });
      console.error("Failed to update variable:", e);
      throw e;
    }
  },

  // ── データ行の読み込み（ページング） ──
  loadDataRows: async (offset: number) => {
    const { selectedDataset, previewPageSize } = get();
    if (!selectedDataset) return;

    set({ isLoading: true, error: null });
    try {
      const dataRows = await invoke<DataRow[]>("get_data_rows", {
        datasetId: selectedDataset.id,
        offset,
        limit: previewPageSize,
      });
      const normalizedRows = normalizeDataRows(dataRows, get().variables);
      const variables = withVariableStats(get().variables, normalizedRows);
      set({
        dataRows: normalizedRows,
        variables,
        previewPage: Math.floor(offset / previewPageSize),
      });
    } catch (e) {
      const msg =
        typeof e === "string" ? e : useI18nStore.getState().t.stores.str_5us4d5;
      set({ error: msg });
      console.error("Failed to load data rows:", e);
    } finally {
      set({ isLoading: false });
    }
  },

  // ── 分析結果の保存 ──
  saveAnalysis: async (input: SaveAnalysisInput) => {
    set({ isLoading: true, error: null });
    try {
      const analysis = normalizeAnalysis(await invoke<unknown>("save_analysis", {
        input: {
          datasetId: input.datasetId,
          analysisType: input.analysisType,
          name: input.name,
          parameters: JSON.stringify(input.config ?? {}),
          result: JSON.stringify(input.result ?? {}),
          interpretation: null,
        },
      }));
      if (!analysis || !analysis.id) {
        throw new Error(useI18nStore.getState().t.stores.str_s3r04y);
      }
      set((s) => ({
        analyses: [analysis, ...s.analyses],
      }));
      return analysis;
    } catch (e) {
      const msg =
        typeof e === "string" ? e : useI18nStore.getState().t.stores.str_siz2rj;
      set({ error: msg });
      console.error("Failed to save analysis:", e);
      throw e;
    } finally {
      set({ isLoading: false });
    }
  },

  // ── 分析結果一覧の読み込み ──
  loadAnalyses: async (datasetId: string) => {
    set({ isLoading: true, error: null });
    try {
      const analyses = normalizeAnalyses(await invoke<unknown[]>("get_analyses", {
        datasetId,
      }));
      set({ analyses });
    } catch (e) {
      const msg =
        typeof e === "string" ? e : useI18nStore.getState().t.stores.str_l917vd;
      set({ error: msg });
      console.error("Failed to load analyses:", e);
    } finally {
      set({ isLoading: false });
    }
  },

  // ── データセットの削除（楽観的更新） ──
  deleteDataset: async (id: string) => {
    const { datasets, selectedDataset } = get();
    const prevDatasets = [...datasets];

    // 楽観的更新
    set({
      datasets: datasets.filter((d) => d.id !== id),
      selectedDataset:
        selectedDataset?.id === id ? null : selectedDataset,
      variables: selectedDataset?.id === id ? [] : get().variables,
      dataRows: selectedDataset?.id === id ? [] : get().dataRows,
    });

    try {
      await invoke("delete_dataset", { id });
    } catch (e) {
      // 失敗時はロールバック
      set({ datasets: prevDatasets });
      const msg =
        typeof e === "string" ? e : useI18nStore.getState().t.stores.str_iv5qaa;
      set({ error: msg });
      console.error("Failed to delete dataset:", e);
      throw e;
    }
  },

  // ── タブ切り替え ──
  setTab: (tab: DataStudioTab) => {
    set({ dataStudioTab: tab });
  },

  // ── 変数の作成 ──
  createVariable: async (input: CreateVariableInput) => {
    set({ isLoading: true, error: null });
    try {
      const variable = normalizeVariable(await invoke<unknown>("create_variable", {
        input: {
          ...input,
          varType: input.varType ?? "text",
        },
      }));
      if (!variable.id) {
        throw new Error("変数の作成に失敗しました");
      }
      set((s) => ({ variables: withVariableStats([...s.variables, variable], s.dataRows) }));
      return variable;
    } catch (e) {
      const msg = typeof e === "string" ? e : "変数の作成に失敗しました";
      set({ error: msg });
      console.error("Failed to create variable:", e);
      throw e;
    } finally {
      set({ isLoading: false });
    }
  },

  // ── 変数の削除 ──
  deleteVariable: async (id: string) => {
    const { variables } = get();
    const prevVariables = [...variables];
    set({ variables: variables.filter((v) => v.id !== id) });
    try {
      await invoke("delete_variable", { id });
    } catch (e) {
      set({ variables: prevVariables });
      const msg = typeof e === "string" ? e : "変数の削除に失敗しました";
      set({ error: msg });
      console.error("Failed to delete variable:", e);
      throw e;
    }
  },

  // ── 変数タイプの自動検出 ──
  autoDetectVariableTypes: async (datasetId: string) => {
    set({ isLoading: true, error: null });
    try {
      const rawVariables = await invoke<unknown[]>("auto_detect_variable_types", { datasetId });
      if (!Array.isArray(rawVariables)) {
        throw new Error("変数タイプの自動検出に失敗しました");
      }
      const variables = withVariableStats(rawVariables.map(normalizeVariable), get().dataRows);
      set({ variables });
    } catch (e) {
      const msg = typeof e === "string" ? e : "変数タイプの自動検出に失敗しました";
      set({ error: msg });
      console.error("Failed to auto detect variable types:", e);
      throw e;
    } finally {
      set({ isLoading: false });
    }
  },

  // ── データ行の挿入 ──
  insertDataRows: async (datasetId: string, rows: Record<string, unknown>[]) => {
    set({ isLoading: true, error: null });
    try {
      const count = await invoke<number>("insert_data_rows", { datasetId, rows });
      // データを再読み込み
      const [rawDatasets, rawDataRows] = await Promise.all([
        invoke<unknown[]>("get_datasets"),
        invoke<unknown[]>("get_data_rows", {
          datasetId,
          offset: 0,
          limit: get().previewPageSize,
        }),
      ]);
      const datasets = normalizeDatasets(rawDatasets);
      const dataRows = normalizeDataRows(rawDataRows, get().variables);
      const variables = withVariableStats(get().variables, dataRows);
      const updatedDataset = datasets.find((d) => d.id === datasetId) ?? null;
      set({ datasets, selectedDataset: updatedDataset, variables, dataRows, previewPage: 0 });
      return count;
    } catch (e) {
      const msg = typeof e === "string" ? e : "データ行の挿入に失敗しました";
      set({ error: msg });
      console.error("Failed to insert data rows:", e);
      throw e;
    } finally {
      set({ isLoading: false });
    }
  },

  // ── データ行の全削除 ──
  deleteDataRows: async (datasetId: string) => {
    set({ isLoading: true, error: null });
    try {
      await invoke("delete_data_rows", { datasetId });
      // データセット一覧を再取得
      const datasets = normalizeDatasets(await invoke<unknown[]>("get_datasets"));
      const updatedDataset = datasets.find((d) => d.id === datasetId) ?? null;
      set({
        datasets,
        selectedDataset: updatedDataset,
        variables: withVariableStats(get().variables, []),
        dataRows: [],
        previewPage: 0,
      });
    } catch (e) {
      const msg = typeof e === "string" ? e : "データ行の削除に失敗しました";
      set({ error: msg });
      console.error("Failed to delete data rows:", e);
      throw e;
    } finally {
      set({ isLoading: false });
    }
  },

  // ── トークン頻度の取得 ──
  getTokenFrequencies: async (datasetId: string, variableId: string, limit = 100) => {
    try {
      return await invoke<TokenFrequency[]>("get_token_frequencies", { datasetId, variableId, limit });
    } catch (e) {
      console.error("Failed to get token frequencies:", e);
      return [];
    }
  },

  // ── トークン頻度の保存 ──
  saveTokenFrequencies: async (datasetId: string, variableId: string, frequencies: TokenFrequency[]) => {
    try {
      await invoke("save_token_frequencies", {
        input: {
          datasetId,
          variableId,
          tokens: frequencies.map((f) => ({
            token: f.token,
            frequency: f.frequency,
            tfIdf: f.tfIdf,
            pos: f.pos,
            documentCount: f.documentCount ?? 1,
          })),
        },
      });
    } catch (e) {
      const msg = typeof e === "string" ? e : "トークン頻度の保存に失敗しました";
      set({ error: msg });
      console.error("Failed to save token frequencies:", e);
      throw e;
    }
  },

  // ── 分析結果の個別取得 ──
  getAnalysis: async (id: string) => {
    try {
      const analysis = await invoke<unknown>("get_analysis", { id });
      return analysis ? normalizeAnalysis(analysis) : null;
    } catch (e) {
      console.error("Failed to get analysis:", e);
      return null;
    }
  },

  // ── データセットの更新 ──
  updateDataset: async (id: string, updates: Partial<Dataset>) => {
    const { datasets, selectedDataset } = get();
    const prevDatasets = [...datasets];
    // 楽観的更新
    set({
      datasets: datasets.map((d) => (d.id === id ? { ...d, ...updates } : d)),
      selectedDataset: selectedDataset?.id === id ? { ...selectedDataset, ...updates } : selectedDataset,
    });
    try {
      const updated = normalizeDataset(await invoke<unknown>("update_dataset", {
        id,
        name: updates.name ?? selectedDataset?.name ?? datasets.find((d) => d.id === id)?.name ?? "",
        description: updates.description ?? selectedDataset?.description ?? datasets.find((d) => d.id === id)?.description ?? null,
      }));
      set((s) => ({
        datasets: s.datasets.map((d) => (d.id === id ? updated : d)),
        selectedDataset: s.selectedDataset?.id === id ? updated : s.selectedDataset,
      }));
    } catch (e) {
      set({ datasets: prevDatasets });
      const msg = typeof e === "string" ? e : "データセットの更新に失敗しました";
      set({ error: msg });
      console.error("Failed to update dataset:", e);
      throw e;
    }
  },
}));
