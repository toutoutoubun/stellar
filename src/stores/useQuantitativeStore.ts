// src/stores/useQuantitativeStore.ts
// Stellar — 量的分析（Data Studio）ストア
// データセット管理・CSV インポート・変数定義・データプレビュー
// Tauri invoke() で Rust バックエンドと通信

import { create } from "zustand";
import { invoke } from "../lib/tauriShim";
import type {
  Dataset,
  Variable,
  DataRow,
  Analysis,
  SaveAnalysisInput,
  DataStudioTab,
  TokenFrequency,
  CreateVariableInput,
} from "../types";
import { useI18nStore } from "./useI18nStore";

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
      const datasets = await invoke<Dataset[]>("get_datasets");
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
      const [variables, dataRows, analyses] = await Promise.all([
        invoke<Variable[]>("get_variables", { datasetId: id }),
        invoke<DataRow[]>("get_data_rows", {
          datasetId: id,
          offset: 0,
          limit: get().previewPageSize,
        }),
        invoke<Analysis[]>("get_analyses", { datasetId: id }).catch(() => [] as Analysis[]),
      ]);
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
        datasetId,
        csvText,
        hasHeader,
        delimiter,
      });

      // インポート後にデータセット情報を再読み込み
      const [datasets, variables, dataRows] = await Promise.all([
        invoke<Dataset[]>("get_datasets"),
        invoke<Variable[]>("get_variables", { datasetId }),
        invoke<DataRow[]>("get_data_rows", {
          datasetId,
          offset: 0,
          limit: get().previewPageSize,
        }),
      ]);

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
      const dataset = await invoke<Dataset>("create_dataset", {
        name,
        description,
        sourceType: "manual",
      });
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
      const dataset = await invoke<Dataset>("create_dataset_from_codes", {
        projectId,
        name,
      });
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
      const dataset = await invoke<Dataset>(
        "create_dataset_from_highlights",
        {
          paperId: paperId ?? null,
        },
      );
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

    // 楽観的更新: ローカル状態を即座に反映
    set({
      variables: variables.map((v) =>
        v.id === id ? { ...v, ...updates } : v,
      ),
    });

    try {
      await invoke("update_variable", { id, updates });
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
      set({
        dataRows,
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
      const analysis = await invoke<Analysis>("save_analysis", { input });
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
      const analyses = await invoke<Analysis[]>("get_analyses", {
        datasetId,
      });
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
      const variable = await invoke<Variable>("create_variable", { input });
      set((s) => ({ variables: [...s.variables, variable] }));
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
      const variables = await invoke<Variable[]>("auto_detect_variable_types", { datasetId });
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
      const [datasets, dataRows] = await Promise.all([
        invoke<Dataset[]>("get_datasets"),
        invoke<DataRow[]>("get_data_rows", {
          datasetId,
          offset: 0,
          limit: get().previewPageSize,
        }),
      ]);
      const updatedDataset = datasets.find((d) => d.id === datasetId) ?? null;
      set({ datasets, selectedDataset: updatedDataset, dataRows, previewPage: 0 });
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
      const datasets = await invoke<Dataset[]>("get_datasets");
      const updatedDataset = datasets.find((d) => d.id === datasetId) ?? null;
      set({ datasets, selectedDataset: updatedDataset, dataRows: [], previewPage: 0 });
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
        input: { datasetId, variableId, frequencies },
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
      return await invoke<Analysis | null>("get_analysis", { id });
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
      await invoke("update_dataset", { id, updates });
    } catch (e) {
      set({ datasets: prevDatasets });
      const msg = typeof e === "string" ? e : "データセットの更新に失敗しました";
      set({ error: msg });
      console.error("Failed to update dataset:", e);
      throw e;
    }
  },
}));
