// src/plugins/userPluginLoader.ts
// Runtime loader for downloaded Stellar add-ons/plugins.

import React from "react";
import { convertFileSrc, invoke } from "../lib/tauriShim";
import {
  registerQualitativeAnalysisAddon,
  registerQuantitativeAnalysisAddon,
} from "./analysisAddons";

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
  version: "0.1";
  React: typeof React;
  registerQualitativeAnalysisAddon: typeof registerQualitativeAnalysisAddon;
  registerQuantitativeAnalysisAddon: typeof registerQuantitativeAnalysisAddon;
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

declare global {
  interface Window {
    StellarPluginApi?: StellarPluginApi;
  }
}

export function getStellarPluginApi(): StellarPluginApi {
  const api: StellarPluginApi = {
    version: "0.1",
    React,
    registerQualitativeAnalysisAddon,
    registerQuantitativeAnalysisAddon,
  };
  window.StellarPluginApi = api;
  return api;
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

    await register(getStellarPluginApi());
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
