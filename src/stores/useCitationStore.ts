// src/stores/useCitationStore.ts
// Stellar — 引用ネットワーク・読書ステータス・レコメンデーション・エクスポート ストア

import { create } from "zustand";
import type {
  ReadingStatus,
  CitationNetworkData,
  PaperRecommendation,
  ReadingStatusCounts,
  CitationGraphData,
} from "../types";
import { invoke } from "../lib/tauriShim";
import { useI18nStore } from "./useI18nStore";

/** 引用ネットワークストアの状態型 */
interface CitationState {
  // ── 読書ステータス ──
  /** 論文ID → 読書ステータスのキャッシュ */
  readingStatuses: Record<string, ReadingStatus>;
  /** ステータス件数 */
  statusCounts: ReadingStatusCounts | null;
  /** ステータス更新中の論文IDセット */
  updatingStatusIds: Set<string>;

  // ── 引用ネットワーク ──
  /** 論文ID → 引用ネットワークデータのキャッシュ */
  citationData: Record<string, CitationNetworkData>;
  /** 引用データ取得中の論文IDセット */
  fetchingCitationIds: Set<string>;

  // ── レコメンデーション ──
  /** 論文ID → レコメンデーションリストのキャッシュ */
  recommendations: Record<string, PaperRecommendation[]>;
  /** レコメンデーション取得中の論文IDセット */
  fetchingRecommendationIds: Set<string>;

  // ── 引用グラフ ──
  citationGraph: CitationGraphData | null;
  fetchingGraph: boolean;

  // ── エクスポート ──
  exporting: boolean;

  // ── アクション ──
  /** 読書ステータスを更新する */
  updateReadingStatus: (paperId: string, status: ReadingStatus) => Promise<void>;
  /** 全ステータス件数を取得する */
  fetchStatusCounts: () => Promise<void>;
  /** 引用ネットワークデータを取得する */
  fetchCitationNetwork: (paperId: string) => Promise<void>;
  /** レコメンデーションを取得する */
  fetchRecommendations: (paperId: string) => Promise<void>;
  /** キャッシュ済みレコメンデーションを取得する */
  getRecommendations: (paperId: string) => Promise<void>;
  /** レコメンデーションをライブラリにインポートする */
  importRecommendation: (recommendationId: string, paperId: string) => Promise<void>;
  /** 引用グラフを取得する */
  fetchCitationGraph: () => Promise<void>;
  /** BibTeX エクスポート */
  exportBibtex: (paperIds: string[]) => Promise<string>;
  /** RIS エクスポート */
  exportRis: (paperIds: string[]) => Promise<string>;
  /** キャッシュをクリアする */
  clearCache: (paperId?: string) => void;
}

export const useCitationStore = create<CitationState>((set, get) => ({
  readingStatuses: {},
  statusCounts: null,
  updatingStatusIds: new Set(),
  citationData: {},
  fetchingCitationIds: new Set(),
  recommendations: {},
  fetchingRecommendationIds: new Set(),
  citationGraph: null,
  fetchingGraph: false,
  exporting: false,

  // ────────────────────────────────────────────
  // 読書ステータス
  // ────────────────────────────────────────────

  updateReadingStatus: async (paperId, status) => {
    set((s) => ({
      updatingStatusIds: new Set([...s.updatingStatusIds, paperId]),
    }));
    try {
      await invoke("update_reading_status", { paperId, status });
      set((s) => ({
        readingStatuses: { ...s.readingStatuses, [paperId]: status },
        updatingStatusIds: new Set(
          [...s.updatingStatusIds].filter((id) => id !== paperId)
        ),
      }));
      // ステータス件数も更新
      void get().fetchStatusCounts();
    } catch (e) {
      set((s) => ({
        updatingStatusIds: new Set(
          [...s.updatingStatusIds].filter((id) => id !== paperId)
        ),
      }));
      throw e;
    }
  },

  fetchStatusCounts: async () => {
    try {
      const counts = await invoke<ReadingStatusCounts>(
        "get_reading_status_counts"
      );
      set({ statusCounts: counts });
    } catch {
      // 静かに失敗
    }
  },

  // ────────────────────────────────────────────
  // 引用ネットワーク
  // ────────────────────────────────────────────

  fetchCitationNetwork: async (paperId) => {
    set((s) => ({
      fetchingCitationIds: new Set([...s.fetchingCitationIds, paperId]),
    }));
    try {
      const data = await invoke<CitationNetworkData>(
        "fetch_citation_network",
        { paperId }
      );
      set((s) => ({
        citationData: { ...s.citationData, [paperId]: data },
        fetchingCitationIds: new Set(
          [...s.fetchingCitationIds].filter((id) => id !== paperId)
        ),
      }));
    } catch (e) {
      set((s) => ({
        fetchingCitationIds: new Set(
          [...s.fetchingCitationIds].filter((id) => id !== paperId)
        ),
      }));
      throw e;
    }
  },

  // ────────────────────────────────────────────
  // レコメンデーション
  // ────────────────────────────────────────────

  fetchRecommendations: async (paperId) => {
    set((s) => ({
      fetchingRecommendationIds: new Set([
        ...s.fetchingRecommendationIds,
        paperId,
      ]),
    }));
    try {
      const recs = await invoke<PaperRecommendation[]>(
        "fetch_recommendations",
        { paperId }
      );
      set((s) => ({
        recommendations: { ...s.recommendations, [paperId]: recs },
        fetchingRecommendationIds: new Set(
          [...s.fetchingRecommendationIds].filter((id) => id !== paperId)
        ),
      }));
    } catch (e) {
      set((s) => ({
        fetchingRecommendationIds: new Set(
          [...s.fetchingRecommendationIds].filter((id) => id !== paperId)
        ),
      }));
      throw e;
    }
  },

  getRecommendations: async (paperId) => {
    try {
      const recs = await invoke<PaperRecommendation[]>(
        "get_recommendations",
        { paperId }
      );
      set((s) => ({
        recommendations: { ...s.recommendations, [paperId]: recs },
      }));
    } catch {
      // 静かに失敗
    }
  },

  importRecommendation: async (recommendationId, paperId) => {
    try {
      await invoke("import_recommendation", { recommendationId });
      // レコメンデーションリストを更新（is_imported フラグが変わる）
      void get().getRecommendations(paperId);
    } catch (e) {
      throw e;
    }
  },

  // ────────────────────────────────────────────
  // 引用グラフ
  // ────────────────────────────────────────────

  fetchCitationGraph: async () => {
    set({ fetchingGraph: true });
    try {
      const graph = await invoke<CitationGraphData>(
        "get_citation_graph_data"
      );
      set({ citationGraph: graph, fetchingGraph: false });
    } catch {
      set({ fetchingGraph: false });
    }
  },

  // ────────────────────────────────────────────
  // エクスポート
  // ────────────────────────────────────────────

  exportBibtex: async (paperIds) => {
    set({ exporting: true });
    try {
      const result = await invoke<string>("export_bibtex", { paperIds });
      set({ exporting: false });
      return result;
    } catch (e) {
      set({ exporting: false });
      throw e;
    }
  },

  exportRis: async (paperIds) => {
    set({ exporting: true });
    try {
      const result = await invoke<string>("export_ris", { paperIds });
      set({ exporting: false });
      return result;
    } catch (e) {
      set({ exporting: false });
      throw e;
    }
  },

  // ────────────────────────────────────────────
  // キャッシュ管理
  // ────────────────────────────────────────────

  clearCache: (paperId) => {
    if (paperId) {
      set((s) => {
        const { [paperId]: _c, ...restCitation } = s.citationData;
        const { [paperId]: _r, ...restRecs } = s.recommendations;
        const { [paperId]: _s, ...restStatuses } = s.readingStatuses;
        return {
          citationData: restCitation,
          recommendations: restRecs,
          readingStatuses: restStatuses,
        };
      });
    } else {
      set({
        citationData: {},
        recommendations: {},
        readingStatuses: {},
        statusCounts: null,
        citationGraph: null,
      });
    }
  },
}));
