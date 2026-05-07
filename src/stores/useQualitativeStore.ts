// src/stores/useQualitativeStore.ts
// Stellar — 質的分析ストア
// プロジェクト選択・タブ管理・コードツリーなどの状態管理

import { create } from "zustand";
import { invoke } from "../lib/tauriShim";
import type {
  QualProject,
  QualCode,
  QualitativeTab,
} from "../types";
import { useI18nStore } from "./useI18nStore";

interface QualitativeState {
  /** 全プロジェクト一覧 */
  projects: QualProject[];
  /** 現在選択中のプロジェクトID */
  activeProjectId: string | null;
  /** 現在のタブ */
  activeTab: QualitativeTab;
  /** コードツリー（フラットリスト、フロントでツリー構築） */
  codes: QualCode[];
  /** ローディング */
  loading: boolean;

  // ─── アクション ───
  loadProjects: () => Promise<void>;
  createProject: (name: string, description?: string) => Promise<QualProject>;
  deleteProject: (id: string) => Promise<void>;
  setActiveProject: (id: string | null) => void;
  setActiveTab: (tab: QualitativeTab) => void;
  loadCodes: () => Promise<void>;
  createCode: (
    label: string,
    parentId?: string | null,
    color?: string,
    description?: string,
  ) => Promise<QualCode>;
  updateCode: (
    id: string,
    updates: {
      label?: string;
      color?: string;
      description?: string;
      parentId?: string | null;
      sortOrder?: number;
    },
  ) => Promise<void>;
  deleteCode: (id: string) => Promise<void>;
}

export const useQualitativeStore = create<QualitativeState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  activeTab: "codebook",
  codes: [],
  loading: false,

  loadProjects: async () => {
    set({ loading: true });
    try {
      const projects = await invoke<QualProject[]>("get_qual_projects");
      set({ projects });
    } catch (e) {
      console.error("Failed to load projects:", e);
    } finally {
      set({ loading: false });
    }
  },

  createProject: async (name, description) => {
    const project = await invoke<QualProject>("create_qual_project", {
      name,
      description: description ?? null,
    });
    if (!project || !project.id) {
      throw new Error(useI18nStore.getState().t.stores.str_x02tnx);
    }
    set((s) => ({ projects: [project, ...s.projects] }));
    return project;
  },

  deleteProject: async (id) => {
    await invoke("delete_qual_project", { id });
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      activeProjectId: s.activeProjectId === id ? null : s.activeProjectId,
    }));
  },

  setActiveProject: (id) => {
    set({ activeProjectId: id, codes: [] });
    if (id) {
      get().loadCodes();
    }
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  loadCodes: async () => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;
    try {
      const codes = await invoke<QualCode[]>("get_codes", {
        projectId: activeProjectId,
      });
      set({ codes });
    } catch (e) {
      console.error("Failed to load codes:", e);
    }
  },

  createCode: async (label, parentId, color, description) => {
    const { activeProjectId } = get();
    if (!activeProjectId) throw new Error("No active project");

    const code = await invoke<QualCode>("create_code", {
      projectId: activeProjectId,
      parentId: parentId ?? null,
      label,
      color: color ?? "#6366f1",
      description: description ?? null,
    });
    if (!code || !code.id) {
      throw new Error(useI18nStore.getState().t.stores.str_h0s8vl);
    }
    set((s) => ({ codes: [...s.codes, code] }));
    return code;
  },

  updateCode: async (id, updates) => {
    await invoke("update_code", {
      id,
      label: updates.label ?? null,
      color: updates.color ?? null,
      description: updates.description ?? null,
      parentId: updates.parentId !== undefined ? (updates.parentId ?? "") : null,
      sortOrder: updates.sortOrder ?? null,
    });
    await get().loadCodes();
  },

  deleteCode: async (id) => {
    await invoke("delete_code", { id });
    set((s) => ({ codes: s.codes.filter((c) => c.id !== id) }));
  },
}));
