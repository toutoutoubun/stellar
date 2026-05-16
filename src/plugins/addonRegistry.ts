// src/plugins/addonRegistry.ts
// Stellar — 汎用アドオンレジストリ
// プラグインからワークスペース項目・タブ/パネル・テーマCSS・引用スタイルを登録できる。
// 既存の analysisAddons.tsx の upsertById パターンを踏襲。

import type React from "react";

// ============================================================
// 共通ユーティリティ
// ============================================================

function upsertById<T extends { id: string }>(items: T[], addon: T): void {
  const id = addon.id.trim();
  if (!id) {
    throw new Error("Addon id is required.");
  }
  const existingIndex = items.findIndex((item) => item.id === id);
  const normalized = { ...addon, id };
  if (existingIndex >= 0) {
    items[existingIndex] = normalized;
    return;
  }
  items.push(normalized);
}

function removeById<T extends { id: string }>(items: T[], id: string): boolean {
  const idx = items.findIndex((item) => item.id === id);
  if (idx >= 0) {
    items.splice(idx, 1);
    return true;
  }
  return false;
}

// ============================================================
// 1. ワークスペースビュー（Workspace View）
// ============================================================

/** ワークスペースビューアドオン — サイドバーに新しいナビゲーション項目を追加する */
export interface WorkspaceViewAddon {
  /** 一意の識別子（例: "my-plugin.dashboard"） */
  id: string;
  /** サイドバーに表示するラベル */
  label: string;
  /** サイドバーアイコン（SVG 要素など） */
  icon: React.ReactNode;
  /** サイドバーセクション（既定: "addons"） */
  section?: "main" | "analysis" | "addons";
  /** 表示順（小さいほど上に表示） */
  order?: number;
  /** ビューのメインコンテンツを描画する React コンポーネント */
  render: () => React.ReactNode;
}

const workspaceViewAddons: WorkspaceViewAddon[] = [];

export function registerWorkspaceView(addon: WorkspaceViewAddon): void {
  upsertById(workspaceViewAddons, addon);
  _notifySubscribers();
}

export function unregisterWorkspaceView(id: string): void {
  removeById(workspaceViewAddons, id);
  _notifySubscribers();
}

export function getWorkspaceViewAddons(): WorkspaceViewAddon[] {
  return [...workspaceViewAddons].sort(
    (a, b) => (a.order ?? 1000) - (b.order ?? 1000) || a.label.localeCompare(b.label),
  );
}

export function getWorkspaceViewAddon(id: string): WorkspaceViewAddon | undefined {
  return workspaceViewAddons.find((a) => a.id === id);
}

// ============================================================
// 2. タブ / パネル（Panel）
// ============================================================

/** パネルアドオン — 既存ビュー内にカスタムタブを追加する */
export interface PanelAddon {
  /** 一意の識別子 */
  id: string;
  /** タブに表示するラベル */
  label: string;
  /** 説明文 */
  description?: string;
  /** タブアイコン */
  icon?: React.ReactNode;
  /** 対象ビュー（例: "qualitative", "quantitative", "library", "reader"） */
  targetView: string;
  /** 表示順 */
  order?: number;
  /** パネルのコンテンツを描画 */
  render: (context: PanelAddonContext) => React.ReactNode;
}

/** パネルアドオンに渡されるコンテキスト */
export interface PanelAddonContext {
  /** 現在のビュー */
  currentView: string;
  /** 追加データ（ビューごとに異なる） */
  data?: Record<string, unknown>;
}

const panelAddons: PanelAddon[] = [];

export function registerPanel(addon: PanelAddon): void {
  upsertById(panelAddons, addon);
  _notifySubscribers();
}

export function unregisterPanel(id: string): void {
  removeById(panelAddons, id);
  _notifySubscribers();
}

export function getPanelAddons(targetView?: string): PanelAddon[] {
  const all = [...panelAddons].sort(
    (a, b) => (a.order ?? 1000) - (b.order ?? 1000) || a.label.localeCompare(b.label),
  );
  if (targetView) {
    return all.filter((p) => p.targetView === targetView);
  }
  return all;
}

// ============================================================
// 3. テーマ CSS（Theme）
// ============================================================

/** テーマアドオン — カスタムテーマを登録する */
export interface ThemeAddon {
  /** テーマ識別子（例: "my-plugin.solarized"） */
  id: string;
  /** テーマ表示名 */
  label: string;
  /** テーマの説明 */
  description?: string;
  /** プレビュー色情報 */
  preview?: {
    bg: string;
    text: string;
    accent: string;
    sidebar: string;
  };
  /**
   * CSS 変数マップ — data-theme 属性で適用される CSS カスタムプロパティ。
   * 例: { "--color-bg-primary": "#fdf6e3", "--color-text-primary": "#657b83" }
   */
  cssVariables: Record<string, string>;
  /**
   * 任意の追加 CSS テキスト（@keyframes、フォント指定等）
   */
  extraCss?: string;
}

const themeAddons: ThemeAddon[] = [];
/** 注入済みの <style> 要素を ID でトラッキング */
const injectedStyleElements = new Map<string, HTMLStyleElement>();

export function registerTheme(addon: ThemeAddon): void {
  upsertById(themeAddons, addon);
  _injectThemeCss(addon);
  _notifySubscribers();
}

export function unregisterTheme(id: string): void {
  removeById(themeAddons, id);
  _removeThemeCss(id);
  _notifySubscribers();
}

export function getThemeAddons(): ThemeAddon[] {
  return [...themeAddons];
}

export function getThemeAddon(id: string): ThemeAddon | undefined {
  return themeAddons.find((t) => t.id === id);
}

/** テーマ CSS を <head> に注入する */
function _injectThemeCss(addon: ThemeAddon): void {
  // 既存があれば除去
  _removeThemeCss(addon.id);

  const cssVarBlock = Object.entries(addon.cssVariables)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join("\n");

  let css = `/* Stellar Plugin Theme: ${addon.id} */\n`;
  css += `[data-theme="${addon.id}"] {\n${cssVarBlock}\n}\n`;
  if (addon.extraCss) {
    css += `\n/* Extra CSS for ${addon.id} */\n${addon.extraCss}\n`;
  }

  const style = document.createElement("style");
  style.setAttribute("data-stellar-theme", addon.id);
  style.textContent = css;
  document.head.appendChild(style);
  injectedStyleElements.set(addon.id, style);
}

/** テーマ CSS を <head> から除去する */
function _removeThemeCss(id: string): void {
  const existing = injectedStyleElements.get(id);
  if (existing) {
    existing.remove();
    injectedStyleElements.delete(id);
  }
}

// ============================================================
// 4. 引用スタイル（Citation Style）
// ============================================================

/** 引用スタイルアドオン — カスタム引用フォーマットを登録する */
export interface CitationStyleAddon {
  /** 引用スタイル識別子（例: "my-plugin.vancouver"） */
  id: string;
  /** 表示名（例: "Vancouver Style"） */
  label: string;
  /** 説明文 */
  description?: string;
  /**
   * インライン引用テキストを生成する関数。
   * 例: "(Smith, 2024)" or "[1]"
   */
  formatInline: (paper: CitationPaperInfo, options?: CitationFormatOptions) => string;
  /**
   * 参考文献リストの1エントリを生成する関数。
   * 例: "Smith, J. (2024). Title. Journal, 1(2), 3-4."
   */
  formatBibliography: (paper: CitationPaperInfo, options?: CitationFormatOptions) => string;
}

/** 引用フォーマットに渡される論文情報 */
export interface CitationPaperInfo {
  title: string;
  authors: string[];
  year: number | null;
  journal: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  doi: string | null;
  url: string | null;
}

/** 引用フォーマットのオプション */
export interface CitationFormatOptions {
  /** ページ参照（例: "p. 42"） */
  pageRef?: string;
  /** 引用番号（番号式引用スタイル用） */
  citationNumber?: number;
}

const citationStyleAddons: CitationStyleAddon[] = [];

export function registerCitationStyle(addon: CitationStyleAddon): void {
  upsertById(citationStyleAddons, addon);
  _notifySubscribers();
}

export function unregisterCitationStyle(id: string): void {
  removeById(citationStyleAddons, id);
  _notifySubscribers();
}

export function getCitationStyleAddons(): CitationStyleAddon[] {
  return [...citationStyleAddons];
}

export function getCitationStyleAddon(id: string): CitationStyleAddon | undefined {
  return citationStyleAddons.find((s) => s.id === id);
}

/**
 * 全ての引用スタイル（ビルトイン + アドオン）のラベルマップを返す。
 * ビルトインの CitationStyle 識別子と、アドオンの id の両方を含む。
 */
export function getAllCitationStyleLabels(): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const addon of citationStyleAddons) {
    labels[addon.id] = addon.label;
  }
  return labels;
}

// ============================================================
// 変更通知（Subscription）
// ============================================================

type AddonChangeListener = () => void;
const listeners = new Set<AddonChangeListener>();

/** アドオンの変更を購読する（コンポーネントの再レンダリング用） */
export function subscribeAddonChanges(listener: AddonChangeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 全リスナーに通知 */
function _notifySubscribers(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (e) {
      console.error("[addonRegistry] Subscriber error:", e);
    }
  }
}

// ============================================================
// React Hook — アドオン変更時に再レンダリング
// ============================================================

import { useSyncExternalStore } from "react";

/** 現在のアドオンスナップショット */
interface AddonSnapshot {
  workspaceViews: WorkspaceViewAddon[];
  panels: PanelAddon[];
  themes: ThemeAddon[];
  citationStyles: CitationStyleAddon[];
}

let _snapshotCache: AddonSnapshot | null = null;

function _getSnapshot(): AddonSnapshot {
  // 変更通知時にキャッシュをクリアして新しいスナップショットを作る
  if (!_snapshotCache) {
    _snapshotCache = {
      workspaceViews: getWorkspaceViewAddons(),
      panels: getPanelAddons(),
      themes: getThemeAddons(),
      citationStyles: getCitationStyleAddons(),
    };
  }
  return _snapshotCache;
}

// 注: キャッシュクリアは subscribe のコールバックで行う

function _subscribe(onStoreChange: () => void): () => void {
  return subscribeAddonChanges(() => {
    _snapshotCache = null; // キャッシュ無効化
    onStoreChange();
  });
}

/** アドオンレジストリの現在の状態を取得する React Hook */
export function useAddonRegistry(): AddonSnapshot {
  return useSyncExternalStore(_subscribe, _getSnapshot, _getSnapshot);
}
