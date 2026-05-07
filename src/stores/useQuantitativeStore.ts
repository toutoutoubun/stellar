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
}));
