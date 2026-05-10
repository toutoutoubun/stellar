// src/plugins/analysisAddons.tsx
// Stellar — analysis add-on registry
// Third-party code can register qualitative tabs and quantitative methods here.

import type React from "react";
import type { Analysis, DataRow, QualProject, Variable } from "../types";

export interface QualitativeAnalysisAddonContext {
  projectId: string;
  project: QualProject | null;
}

export interface QualitativeAnalysisAddon {
  id: string;
  label: string;
  description?: string;
  icon?: React.ComponentType<{ size?: number; color?: string }>;
  order?: number;
  render: (context: QualitativeAnalysisAddonContext) => React.ReactNode;
}

export interface QuantitativeAnalysisRunContext {
  datasetId: string;
  variables: Variable[];
  dataRows: DataRow[];
  selectedVariables: Variable[];
  selectedVarIds: string[];
  alpha: number;
  config: Record<string, unknown>;
}

export interface QuantitativeAnalysisRenderContext {
  analysis: Analysis;
  variables: Variable[];
  dataRows: DataRow[];
}

export interface QuantitativeAnalysisAddon {
  id: string;
  label: string;
  description: string;
  icon?: React.ReactNode;
  color?: string;
  groupKey?: string;
  groupLabel?: string;
  minVariables?: number;
  maxVariables?: number;
  supportsVariable?: (variable: Variable) => boolean;
  validate?: (context: QuantitativeAnalysisRunContext) => string[];
  run: (context: QuantitativeAnalysisRunContext) =>
    | Record<string, unknown>
    | Promise<Record<string, unknown>>;
  renderResult?: (context: QuantitativeAnalysisRenderContext) => React.ReactNode;
}

const qualitativeAnalysisAddons: QualitativeAnalysisAddon[] = [];
const quantitativeAnalysisAddons: QuantitativeAnalysisAddon[] = [];

function upsertById<T extends { id: string }>(items: T[], addon: T): void {
  const id = addon.id.trim();
  if (!id) {
    throw new Error("Analysis add-on id is required.");
  }

  const existingIndex = items.findIndex((item) => item.id === id);
  const normalized = { ...addon, id };
  if (existingIndex >= 0) {
    items[existingIndex] = normalized;
    return;
  }
  items.push(normalized);
}

export function registerQualitativeAnalysisAddon(addon: QualitativeAnalysisAddon): void {
  upsertById(qualitativeAnalysisAddons, addon);
}

export function registerQuantitativeAnalysisAddon(addon: QuantitativeAnalysisAddon): void {
  upsertById(quantitativeAnalysisAddons, addon);
}

export function getQualitativeAnalysisAddons(): QualitativeAnalysisAddon[] {
  return [...qualitativeAnalysisAddons].sort(
    (a, b) => (a.order ?? 1000) - (b.order ?? 1000) || a.label.localeCompare(b.label),
  );
}

export function getQuantitativeAnalysisAddons(): QuantitativeAnalysisAddon[] {
  return [...quantitativeAnalysisAddons];
}
