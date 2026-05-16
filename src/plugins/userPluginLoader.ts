// src/plugins/userPluginLoader.ts
// Runtime loader for downloaded Stellar add-ons/plugins.

import React from "react";
import { convertFileSrc, invoke } from "../lib/tauriShim";
import {
  registerQualitativeAnalysisAddon,
  registerQuantitativeAnalysisAddon,
} from "./analysisAddons";
import {
  registerWorkspaceView,
  registerPanel,
  registerTheme,
  unregisterTheme,
  registerCitationStyle,
} from "./addonRegistry";
import type {
  WorkspaceViewAddon,
  PanelAddon,
  ThemeAddon,
  CitationStyleAddon,
} from "./addonRegistry";

export interface InstalledUserPlugin {
  id: string;
  name: string;
  version: string | null;
  description: string | null;
  author: string | null;
  entry: string;
  homepage: string | null;
  capabilities: string[];
  minStellarVersion: string | null;
  enabled: boolean;
  installedAt: string;
  path: string;
  entryPath: string;
  packageSizeBytes: number;
}

export interface StellarPluginApi {
  version: "0.2";
  React: typeof React;
  // ── 分析アドオン（v0.1 互換） ──
  registerQualitativeAnalysisAddon: typeof registerQualitativeAnalysisAddon;
  registerQuantitativeAnalysisAddon: typeof registerQuantitativeAnalysisAddon;
  // ── v0.2: ワークスペース・パネル・テーマ・引用スタイル ──
  registerWorkspaceView: (addon: WorkspaceViewAddon) => void;
  registerPanel: (addon: PanelAddon) => void;
  registerTheme: (addon: ThemeAddon) => void;
  registerCitationStyle: (addon: CitationStyleAddon) => void;
}

export interface UserPluginLoadResult {
  plugin: InstalledUserPlugin;
  ok: boolean;
  error?: string;
}

type PluginRegister = (api: StellarPluginApi) => void | Promise<void>;

interface UserPluginModule {
  register?: PluginRegister;
  default?: PluginRegister | { register?: PluginRegister };
}

const pluginThemeIds = new Map<string, Set<string>>();

declare global {
  interface Window {
    StellarPluginApi?: StellarPluginApi;
  }
}

export function getStellarPluginApi(pluginId?: string): StellarPluginApi {
  const api: StellarPluginApi = {
    version: "0.2",
    React,
    // ── 分析アドオン（v0.1 互換） ──
    registerQualitativeAnalysisAddon,
    registerQuantitativeAnalysisAddon,
    // ── v0.2: ワークスペース・パネル・テーマ・引用スタイル ──
    registerWorkspaceView,
    registerPanel,
    registerTheme: (addon) => {
      registerTheme(addon);
      if (pluginId) {
        const ids = pluginThemeIds.get(pluginId) ?? new Set<string>();
        ids.add(addon.id);
        pluginThemeIds.set(pluginId, ids);
      }
    },
    registerCitationStyle,
  };
  window.StellarPluginApi = api;
  return api;
}

export function unloadInstalledUserPluginThemes(pluginId: string): void {
  const ids = pluginThemeIds.get(pluginId);
  if (!ids) return;
  for (const themeId of ids) {
    unregisterTheme(themeId);
  }
  pluginThemeIds.delete(pluginId);
}

export async function listInstalledUserPlugins(): Promise<InstalledUserPlugin[]> {
  return invoke<InstalledUserPlugin[]>("list_installed_plugins");
}

export async function loadInstalledUserPlugin(
  plugin: InstalledUserPlugin,
): Promise<UserPluginLoadResult> {
  if (!plugin.enabled) {
    return { plugin, ok: true };
  }

  try {
    unloadInstalledUserPluginThemes(plugin.id);
    const moduleUrl = `${convertFileSrc(plugin.entryPath)}?stellarPlugin=${encodeURIComponent(
      `${plugin.id}-${plugin.installedAt}`,
    )}`;
    const mod = (await import(/* @vite-ignore */ moduleUrl)) as UserPluginModule;
    const defaultExport = mod.default;
    const register =
      typeof mod.register === "function"
        ? mod.register
        : typeof defaultExport === "function"
          ? defaultExport
          : defaultExport &&
              typeof defaultExport === "object" &&
              typeof defaultExport.register === "function"
            ? defaultExport.register
            : null;

    if (!register) {
      throw new Error("Plugin module must export register(api) or default register(api).");
    }

    await register(getStellarPluginApi(plugin.id));
    return { plugin, ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[userPluginLoader] Failed to load ${plugin.id}:`, error);
    return { plugin, ok: false, error: message };
  }
}

export async function loadEnabledUserPlugins(): Promise<UserPluginLoadResult[]> {
  try {
    const plugins = await listInstalledUserPlugins();
    const enabledPlugins = plugins.filter((plugin) => plugin.enabled);
    const results: UserPluginLoadResult[] = [];
    for (const plugin of enabledPlugins) {
      results.push(await loadInstalledUserPlugin(plugin));
    }
    return results;
  } catch (error) {
    console.warn("[userPluginLoader] Installed plugin list is unavailable:", error);
    return [];
  }
}
