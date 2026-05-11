// src/components/settings/SettingsView.tsx
// Stellar — 設定画面
// 5タブ: 外観 / データ / ショートカット / 引用スタイル / 言語

import type React from "react";
import { useState, useCallback, useEffect, useRef } from "react";
import { useThemeStore, THEMES } from "../../stores/useThemeStore";
import { useI18nStore, useT } from "../../stores/useI18nStore";
import { SUPPORTED_LOCALES, LOCALE_NATIVE_NAMES } from "../../i18n";
import { ThemePreviewCard } from "./ThemePreviewCard";
import { StellarPackageModal } from "../export/StellarPackageModal";
import { invoke, openDirectoryDialog, openFileDialog, relaunch, shellOpen } from "../../lib/tauriShim";
import { dataApi, cloudBackupApi } from "../../utils/ipc";
import { toast } from "../ui/Toast";
import {
  listInstalledUserPlugins,
  loadInstalledUserPlugin,
  type InstalledUserPlugin,
} from "../../plugins/userPluginLoader";
import type { Paper } from "../../types";
import type {
  Theme,
  SettingsTab,
  AppearanceSettings,
  DataSummary,
  ShortcutEntry,
  CitationStyle,
  AuthorNameOrder,
  Locale,
  CloudBackupStatus,
  BackupEntry,
} from "../../types";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatPluginSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
import {
  DEFAULT_APPEARANCE_SETTINGS,
  EDITOR_FONTS,
  CITATION_STYLE_LABELS,
} from "../../types";

// ============================================================
// SettingsView コンポーネント
// ============================================================

export const SettingsView: React.FC = () => {
  const t = useT();
  const locale = useI18nStore((s) => s.locale);
  const setLocale = useI18nStore((s) => s.setLocale);

  const [activeTab, setActiveTab] = useState<SettingsTab>("appearance");

  // 外観設定
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const [appearance, setAppearance] = useState<AppearanceSettings>(
    DEFAULT_APPEARANCE_SETTINGS
  );

  // データ設定
  const [dataSummary, setDataSummary] = useState<DataSummary | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [stellarPackageModalOpen, setStellarPackageModalOpen] = useState(false);

  // クラウドバックアップ
  const [cloudStatus, setCloudStatus] = useState<CloudBackupStatus | null>(null);
  const [isCloudSettingUp, setIsCloudSettingUp] = useState(false);
  const [isCloudBackingUp, setIsCloudBackingUp] = useState(false);
  const [cloudBackups, setCloudBackups] = useState<BackupEntry[]>([]);
  const [showRecoveryCode, setShowRecoveryCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [showRecoverInput, setShowRecoverInput] = useState(false);
  const [recoverCodeInput, setRecoverCodeInput] = useState("");
  const [isRecovering, setIsRecovering] = useState(false);

  // ブラウザ連携
  const [extensionStatus, setExtensionStatus] = useState<"running" | "waiting" | "checking">("checking");
  const [recentImports, setRecentImports] = useState<{ title: string; importedAt: string }[]>([]);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const installGuideRef = useRef<HTMLDivElement>(null);

  // アドオン / プラグイン
  const [plugins, setPlugins] = useState<InstalledUserPlugin[]>([]);
  const [isLoadingPlugins, setIsLoadingPlugins] = useState(false);
  const [isInstallingPlugin, setIsInstallingPlugin] = useState(false);
  const [updatingPluginId, setUpdatingPluginId] = useState<string | null>(null);

  // 引用スタイル設定
  const [citationStyle, setCitationStyle] = useState<CitationStyle>("apa7");
  const [authorNameOrder, setAuthorNameOrder] =
    useState<AuthorNameOrder>("surname-first");

  // ショートカット一覧（翻訳キーベース）
  const SHORTCUTS: ShortcutEntry[] = [
    { keys: "Ctrl+K", description: t.settings.shortcuts.items.openSearch, category: t.settings.shortcuts.categories.navigation },
    { keys: "Ctrl+N", description: t.settings.shortcuts.items.newNote, category: t.settings.shortcuts.categories.navigation },
    { keys: "Ctrl+,", description: t.settings.shortcuts.items.openSettings, category: t.settings.shortcuts.categories.navigation },
    { keys: "Ctrl+1", description: t.settings.shortcuts.items.switchLibrary, category: t.settings.shortcuts.categories.navigation },
    { keys: "Ctrl+2", description: t.settings.shortcuts.items.switchNotes, category: t.settings.shortcuts.categories.navigation },
    { keys: "Ctrl+3", description: t.settings.shortcuts.items.switchGraph, category: t.settings.shortcuts.categories.navigation },
    { keys: "Ctrl+S", description: t.settings.shortcuts.items.save, category: t.settings.shortcuts.categories.editor },
    { keys: "Ctrl+B", description: t.settings.shortcuts.items.bold, category: t.settings.shortcuts.categories.editor },
    { keys: "Ctrl+I", description: t.settings.shortcuts.items.italic, category: t.settings.shortcuts.categories.editor },
    { keys: "Ctrl+Z", description: t.settings.shortcuts.items.undo, category: t.settings.shortcuts.categories.editor },
    { keys: "Ctrl+Shift+Z", description: t.settings.shortcuts.items.redo, category: t.settings.shortcuts.categories.editor },
    { keys: "[[", description: t.settings.shortcuts.items.insertWikiLink, category: t.settings.shortcuts.categories.editor },
    { keys: "Cmd+A", description: t.settings.shortcuts.items.selectAll, category: t.settings.shortcuts.categories.graph },
    { keys: t.settings.shortcuts.keys.scroll, description: t.settings.shortcuts.items.scroll, category: t.settings.shortcuts.categories.graph },
    { keys: t.settings.shortcuts.keys.drag, description: t.settings.shortcuts.items.drag, category: t.settings.shortcuts.categories.graph },
    { keys: t.settings.shortcuts.keys.doubleClick, description: t.settings.shortcuts.items.doubleClick, category: t.settings.shortcuts.categories.graph },
    { keys: "Ctrl++", description: t.settings.shortcuts.items.zoomIn, category: t.settings.shortcuts.categories.pdfReader },
    { keys: "Ctrl+-", description: t.settings.shortcuts.items.zoomOut, category: t.settings.shortcuts.categories.pdfReader },
    { keys: "Ctrl+0", description: t.settings.shortcuts.items.zoomReset, category: t.settings.shortcuts.categories.pdfReader },
  ];

  // タブ定義
  const TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    {
      id: "appearance",
      label: t.settings.tabs.appearance,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ),
    },
    {
      id: "data",
      label: t.settings.tabs.data,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
      ),
    },
    {
      id: "addons",
      label: t.settings.tabs.addons,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v5" />
          <path d="M9 7h6" />
          <path d="M6 10h12" />
          <path d="M8 10v10a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V10" />
          <path d="M5 14h3" />
          <path d="M16 14h3" />
        </svg>
      ),
    },
    {
      id: "shortcuts",
      label: t.settings.tabs.shortcuts,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
          <path d="M6 8h.001" /><path d="M10 8h.001" /><path d="M14 8h.001" /><path d="M18 8h.001" />
          <path d="M8 12h.001" /><path d="M12 12h.001" /><path d="M16 12h.001" />
          <path d="M7 16h10" />
        </svg>
      ),
    },
    {
      id: "citation",
      label: t.settings.tabs.citation,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 17c2-2 4-6 4-10" /><path d="M6 17H3" />
          <path d="M14 17c2-2 4-6 4-10" /><path d="M14 17h-3" />
        </svg>
      ),
    },
    {
      id: "language",
      label: t.settings.tabs.language,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      ),
    },
  ];

  const refreshPlugins = useCallback(async () => {
    setIsLoadingPlugins(true);
    try {
      const installed = await listInstalledUserPlugins();
      setPlugins(installed);
    } catch (error) {
      toast.error(`${t.settings.addons.loadFailed}: ${errorMessage(error)}`);
    } finally {
      setIsLoadingPlugins(false);
    }
  }, [t]);

  // データサマリーの読み込み（実データ取得）
  useEffect(() => {
    if (activeTab === "data") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- legitimate data sync/fetch pattern
      setIsLoadingData(true);
      dataApi.getSummary()
        .then((summary) => {
          setDataSummary(summary);
        })
        .catch(() => {
          setDataSummary({
            paperCount: 0,
            noteCount: 0,
            highlightCount: 0,
            diskUsage: "—",
            dataPath: "~/Stellar",
          });
        })
        .finally(() => setIsLoadingData(false));
    }
  }, [activeTab]);

  // クラウドバックアップステータスの読み込み
  useEffect(() => {
    if (activeTab === "data") {
      cloudBackupApi.getStatus()
        .then((status) => {
          setCloudStatus(status);
          if (status.isConfigured) {
            cloudBackupApi.list()
              .then((res) => setCloudBackups(res.backups))
              .catch(() => setCloudBackups([]));
          }
        })
        .catch(() => setCloudStatus(null));
    }
  }, [activeTab]);

  // ブラウザ拡張ステータスチェック
  useEffect(() => {
    if (activeTab !== "data") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- legitimate data sync/fetch pattern
    setExtensionStatus("checking");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1000);
    fetch("http://localhost:57321/api/status", { signal: controller.signal })
      .then((res) => {
        clearTimeout(timer);
        setExtensionStatus(res.ok ? "running" : "waiting");
      })
      .catch(() => {
        clearTimeout(timer);
        setExtensionStatus("waiting");
      });

    // 最近のインポートを取得
    invoke<Paper[]>("get_papers", { page: 1, perPage: 100 })
      .then((res: unknown) => {
        const items: Paper[] = ((res as Record<string, unknown>)?.items ?? res ?? []) as Paper[];
        const recent = items
          .filter((p: Paper) => p.url && p.url.length > 0)
          .slice(0, 5)
          .map((p: Paper) => ({ title: p.title, importedAt: p.createdAt }));
        setRecentImports(recent);
      })
      .catch(() => setRecentImports([]));

    return () => { clearTimeout(timer); controller.abort(); };
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "addons") return;
    const timer = window.setTimeout(() => {
      void refreshPlugins();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeTab, refreshPlugins]);

  // テーマ切替ハンドラ
  const handleThemeChange = useCallback(
    (newTheme: Theme) => {
      document.body.setAttribute("data-theme-transition", "");
      setTheme(newTheme);
      setTimeout(() => {
        document.body.removeAttribute("data-theme-transition");
      }, 300);
    },
    [setTheme]
  );

  // データパス変更
  const handleChangeDataPath = useCallback(async () => {
    try {
      const { openDirectoryDialog } = await import("../../lib/tauriShim");
      const selected = await openDirectoryDialog();
      if (selected) {
        await dataApi.changePath(selected);
        // サマリーを再取得して表示を更新
        const summary = await dataApi.getSummary();
        setDataSummary(summary);
        toast.success(t.settings.data.storagePath + ": " + selected);
      }
    } catch {
      // キャンセルまたはエラー
    }
  }, [t]);

  // エクスポート
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const result = await dataApi.export();
      toast.success(`${t.settings.data.exportData}: ${result}`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setIsExporting(false);
    }
  }, [t]);

  // バックアップ
  const handleBackup = useCallback(async () => {
    setIsBackingUp(true);
    try {
      const result = await dataApi.createBackup();
      toast.success(`${t.settings.data.createBackup}: ${result}`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setIsBackingUp(false);
    }
  }, [t]);

  // クラウドバックアップ: セットアップ
  const handleCloudSetup = useCallback(async () => {
    setIsCloudSettingUp(true);
    try {
      const status = await cloudBackupApi.setup();
      setCloudStatus(status);
      toast.success(t.settings.data.backupSuccess);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setIsCloudSettingUp(false);
    }
  }, [t]);

  // クラウドバックアップ: 実行
  const handleCloudBackup = useCallback(async () => {
    setIsCloudBackingUp(true);
    try {
      const result = await cloudBackupApi.create();
      if (result.success) {
        toast.success(t.settings.data.backupSuccess);
        // ステータスを更新
        const status = await cloudBackupApi.getStatus();
        setCloudStatus(status);
        // 一覧を更新
        const list = await cloudBackupApi.list();
        setCloudBackups(list.backups);
      }
    } catch (e) {
      toast.error(`${t.settings.data.backupFailed}: ${String(e)}`);
    } finally {
      setIsCloudBackingUp(false);
    }
  }, [t]);

  // クラウドバックアップ: リストア
  const handleCloudRestore = useCallback(async (backupId: string) => {
    if (!cloudStatus?.recoveryCode) return;
    if (!window.confirm(t.settings.data.restoreConfirm)) return;

    setIsRestoring(backupId);
    try {
      const result = await cloudBackupApi.restore(backupId, cloudStatus.recoveryCode);
      if (result.success) {
        toast.success(`${t.settings.data.restoreSuccess}: ${result.papersRestored} ${t.settings.data.papers}, ${result.notesRestored} ${t.settings.data.notes}`);
      }
    } catch (e) {
      toast.error(`${t.settings.data.restoreFailed}: ${String(e)}`);
    } finally {
      setIsRestoring(null);
    }
  }, [cloudStatus, t]);

  // クラウドバックアップ: 自動バックアップ切替
  const handleToggleAutoBackup = useCallback(async (enabled: boolean) => {
    try {
      const status = await cloudBackupApi.toggleAuto(enabled);
      setCloudStatus(status);
    } catch (e) {
      toast.error(String(e));
    }
  }, []);

  // クラウドバックアップ: リカバリーコードで復元
  const handleRecover = useCallback(async () => {
    if (!recoverCodeInput.trim()) return;
    setIsRecovering(true);
    try {
      const status = await cloudBackupApi.recover(recoverCodeInput.trim());
      setCloudStatus(status);
      setShowRecoverInput(false);
      setRecoverCodeInput("");
      toast.success(t.settings.data.restoreSuccess);
      // 一覧を更新
      const list = await cloudBackupApi.list();
      setCloudBackups(list.backups);
    } catch (e) {
      toast.error(`${t.settings.data.restoreFailed}: ${String(e)}`);
    } finally {
      setIsRecovering(false);
    }
  }, [recoverCodeInput, t]);

  // リカバリーコードをクリップボードにコピー
  const handleCopyRecoveryCode = useCallback(() => {
    if (cloudStatus?.recoveryCode) {
      navigator.clipboard.writeText(cloudStatus.recoveryCode).then(() => {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      });
    }
  }, [cloudStatus]);

  const upsertPlugin = useCallback((plugin: InstalledUserPlugin) => {
    setPlugins((prev) => {
      const existing = prev.findIndex((item) => item.id === plugin.id);
      if (existing < 0) {
        return [...prev, plugin].sort((a, b) => a.name.localeCompare(b.name));
      }
      const next = [...prev];
      next[existing] = plugin;
      return next.sort((a, b) => a.name.localeCompare(b.name));
    });
  }, []);

  const handleInstallPluginPath = useCallback(
    async (sourcePath: string) => {
      setIsInstallingPlugin(true);
      try {
        const installed = await invoke<InstalledUserPlugin | null>("install_plugin_package", { sourcePath });
        if (!installed) {
          toast.error(t.settings.addons.installFailed);
          return;
        }
        upsertPlugin(installed);
        const loadResult = await loadInstalledUserPlugin(installed);
        if (loadResult.ok) {
          toast.success(t.settings.addons.installSuccess.replace("${name}", installed.name));
        } else {
          toast.error(`${t.settings.addons.loadFailed}: ${loadResult.error ?? installed.name}`);
        }
      } catch (error) {
        toast.error(`${t.settings.addons.installFailed}: ${errorMessage(error)}`);
      } finally {
        setIsInstallingPlugin(false);
      }
    },
    [t, upsertPlugin],
  );

  const handleInstallPluginFromFile = useCallback(async () => {
    const selected = await openFileDialog({
      title: t.settings.addons.addFromFile,
      filters: [
        { name: "Stellar Plugin", extensions: ["zip", "stellar-plugin"] },
      ],
    });
    if (!selected || Array.isArray(selected)) return;
    await handleInstallPluginPath(selected);
  }, [handleInstallPluginPath, t]);

  const handleInstallPluginFromFolder = useCallback(async () => {
    const selected = await openDirectoryDialog({ title: t.settings.addons.addFromFolder });
    if (!selected) return;
    await handleInstallPluginPath(selected);
  }, [handleInstallPluginPath, t]);

  const handleTogglePlugin = useCallback(
    async (plugin: InstalledUserPlugin, enabled: boolean) => {
      setUpdatingPluginId(plugin.id);
      try {
        const updated = await invoke<InstalledUserPlugin>("set_installed_plugin_enabled", {
          pluginId: plugin.id,
          enabled,
        });
        upsertPlugin(updated);
        if (enabled) {
          const loadResult = await loadInstalledUserPlugin(updated);
          if (loadResult.ok) {
            toast.success(t.settings.addons.enableSuccess.replace("${name}", updated.name));
          } else {
            toast.error(`${t.settings.addons.loadFailed}: ${loadResult.error ?? updated.name}`);
          }
        } else {
          toast.success(t.settings.addons.disableSuccess.replace("${name}", updated.name));
        }
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        setUpdatingPluginId(null);
      }
    },
    [t, upsertPlugin],
  );

  const handleRemovePlugin = useCallback(
    async (plugin: InstalledUserPlugin) => {
      if (!window.confirm(t.settings.addons.removeConfirm.replace("${name}", plugin.name))) return;
      setUpdatingPluginId(plugin.id);
      try {
        await invoke<void>("remove_installed_plugin", { pluginId: plugin.id });
        setPlugins((prev) => prev.filter((item) => item.id !== plugin.id));
        toast.success(t.settings.addons.removeSuccess.replace("${name}", plugin.name));
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        setUpdatingPluginId(null);
      }
    },
    [t],
  );

  // ============================================================
  // 外観タブ
  // ============================================================
  const renderAppearanceTab = () => (
    <div className="flex flex-col gap-8">
      <section>
        <h3 className="text-base font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
          {t.settings.appearance.theme}
        </h3>
        <p className="text-sm mb-4" style={{ color: "var(--color-text-tertiary)" }}>
          {t.settings.appearance.themeDesc}
        </p>
        <div className="flex flex-wrap gap-3">
          {THEMES.map((meta) => (
            <ThemePreviewCard key={meta.id} meta={meta} isSelected={theme === meta.id} onSelect={handleThemeChange} />
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-base font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
          {t.settings.appearance.fontSize}
        </h3>
        <p className="text-sm mb-3" style={{ color: "var(--color-text-tertiary)" }}>
          {t.settings.appearance.fontSizeDesc}
        </p>
        <div className="flex items-center gap-4">
          <input type="range" min={13} max={16} step={1} value={appearance.fontSize}
            onChange={(e) => setAppearance((s) => ({ ...s, fontSize: Number(e.target.value) }))}
            style={{ accentColor: "var(--color-accent-primary)", width: "200px" }}
          />
          <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)", minWidth: "40px" }}>
            {appearance.fontSize}px
          </span>
        </div>
      </section>

      <section>
        <h3 className="text-base font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
          {t.settings.appearance.lineHeight}
        </h3>
        <p className="text-sm mb-3" style={{ color: "var(--color-text-tertiary)" }}>
          {t.settings.appearance.lineHeightDesc}
        </p>
        <div className="flex items-center gap-4">
          <input type="range" min={1.5} max={2.0} step={0.1} value={appearance.lineHeight}
            onChange={(e) => setAppearance((s) => ({ ...s, lineHeight: Number(e.target.value) }))}
            style={{ accentColor: "var(--color-accent-primary)", width: "200px" }}
          />
          <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)", minWidth: "40px" }}>
            {appearance.lineHeight.toFixed(1)}
          </span>
        </div>
      </section>

      <section>
        <h3 className="text-base font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
          {t.settings.appearance.editorFont}
        </h3>
        <p className="text-sm mb-3" style={{ color: "var(--color-text-tertiary)" }}>
          {t.settings.appearance.editorFontDesc}
        </p>
        <select
          value={appearance.editorFont}
          onChange={(e) => setAppearance((s) => ({ ...s, editorFont: e.target.value }))}
          className="text-sm px-3 py-2"
          style={{
            backgroundColor: "var(--color-bg-input)", color: "var(--color-text-primary)",
            border: "1px solid var(--color-border-primary)", borderRadius: "var(--radius-input)",
            outline: "none", minWidth: "240px", fontFamily: appearance.editorFont,
          }}
        >
          {EDITOR_FONTS.map((font) => (
            <option key={font.value} value={font.value}>{font.label}</option>
          ))}
        </select>
        <div className="mt-3 p-3 text-sm" style={{
          backgroundColor: "var(--color-bg-secondary)", borderRadius: "var(--radius-input)",
          border: "1px solid var(--color-border-secondary)", fontFamily: appearance.editorFont,
          fontSize: `${appearance.fontSize}px`, lineHeight: appearance.lineHeight,
          color: "var(--color-text-primary)",
        }}>
          {t.settings.appearance.previewText}
        </div>
      </section>
    </div>
  );

  // ============================================================
  // データタブ
  // ============================================================
  const renderDataTab = () => (
    <div className="flex flex-col gap-8">
      <section>
        <h3 className="text-base font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
          {t.settings.data.summary}
        </h3>
        <p className="text-sm mb-4" style={{ color: "var(--color-text-tertiary)" }}>
          {t.settings.data.summaryDesc}
        </p>
        {isLoadingData ? (
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--color-text-tertiary)" }}>
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {t.common.loading}
          </div>
        ) : dataSummary ? (
          <div className="grid grid-cols-2 gap-3" style={{ maxWidth: "400px" }}>
            {[
              { label: t.settings.data.papers, value: `${dataSummary.paperCount} ${t.common.items}`, iconType: "paper" as const },
              { label: t.settings.data.notes, value: `${dataSummary.noteCount} ${t.common.items}`, iconType: "note" as const },
              { label: t.settings.data.highlights, value: `${dataSummary.highlightCount} ${t.common.items}`, iconType: "highlight" as const },
              { label: t.settings.data.diskUsage, value: dataSummary.diskUsage, iconType: "disk" as const },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 p-3" style={{
                backgroundColor: "var(--color-bg-secondary)", borderRadius: "var(--radius-input)",
                border: "1px solid var(--color-border-secondary)",
              }}>
                <span style={{ color: "var(--color-text-secondary)" }}>
                  {item.iconType === "paper" ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  ) : item.iconType === "note" ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  ) : item.iconType === "highlight" ? (
                    <svg width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="#EAB308" opacity="0.85"/><circle cx="12" cy="12" r="8" fill="none" stroke="#EAB308" strokeWidth="2" opacity="0.5"/></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  )}
                </span>
                <div>
                  <div className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>{item.label}</div>
                  <div className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>{item.value}</div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section>
        <h3 className="text-base font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
          {t.settings.data.storagePath}
        </h3>
        <p className="text-sm mb-3" style={{ color: "var(--color-text-tertiary)" }}>
          {t.settings.data.storagePathDesc}
        </p>
        <div className="flex items-center gap-3">
          <div className="flex-1 px-3 py-2 text-sm truncate" style={{
            backgroundColor: "var(--color-bg-tertiary)", color: "var(--color-text-secondary)",
            borderRadius: "var(--radius-input)", border: "1px solid var(--color-border-secondary)", maxWidth: "360px",
          }}>
            {dataSummary?.dataPath ?? "~/Stellar"}
          </div>
          <button type="button" onClick={handleChangeDataPath} className="px-3 py-2 text-xs font-medium" style={{
            backgroundColor: "var(--color-bg-hover)", color: "var(--color-text-primary)",
            borderRadius: "var(--radius-button)", border: "1px solid var(--color-border-primary)",
            transition: "all var(--transition-fast)",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-bg-active)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--color-bg-hover)"; }}
          >
            {t.settings.data.change}
          </button>
        </div>
        <p className="text-xs mt-2" style={{ color: "var(--color-text-tertiary)" }}>
          {t.settings.data.storageNote}
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
          {t.settings.data.exportBackup}
        </h3>
        <p className="text-sm mb-4" style={{ color: "var(--color-text-tertiary)" }}>
          {t.settings.data.exportBackupDesc}
        </p>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleExport} disabled={isExporting} className="flex items-center gap-2 px-4 py-2 text-xs font-medium" style={{
            backgroundColor: "var(--color-accent-primary)", color: "var(--color-text-inverse)",
            borderRadius: "var(--radius-button)", opacity: isExporting ? 0.6 : 1,
            cursor: isExporting ? "not-allowed" : "pointer", transition: "all var(--transition-fast)",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {isExporting ? t.settings.data.exporting : t.settings.data.exportData}
          </button>
          <button onClick={handleBackup} disabled={isBackingUp} className="flex items-center gap-2 px-4 py-2 text-xs font-medium" style={{
            backgroundColor: "var(--color-bg-hover)", color: "var(--color-text-primary)",
            borderRadius: "var(--radius-button)", border: "1px solid var(--color-border-primary)",
            opacity: isBackingUp ? 0.6 : 1, cursor: isBackingUp ? "not-allowed" : "pointer",
            transition: "all var(--transition-fast)",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
            </svg>
            {isBackingUp ? t.settings.data.backingUp : t.settings.data.createBackup}
          </button>
        </div>
        <p className="text-xs mt-2" style={{ color: "var(--color-text-tertiary)" }}>
          {t.settings.data.exportNote}
        </p>
      </section>

      {/* 研究パッケージ */}
      <section>
        <h3 className="text-base font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
          {t.exportImport.k_stellarPackage}
        </h3>
        <p className="text-sm mb-4" style={{ color: "var(--color-text-tertiary)" }}>
          {t.exportImport.exportStellarPackage}
        </p>
        <button
          onClick={() => setStellarPackageModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-medium"
          style={{
            backgroundColor: "var(--color-bg-hover)",
            color: "var(--color-text-primary)",
            borderRadius: "var(--radius-button)",
            border: "1px solid var(--color-border-primary)",
            transition: "all var(--transition-fast)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-bg-active)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--color-bg-hover)"; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
          {t.exportImport.k_stellarPackage}
        </button>
      </section>

      {/* ブラウザ連携 */}
      <section>
        <h3 className="text-base font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
          {t.exportImport.k_browserIntegration}
        </h3>
        <p className="text-sm mb-4" style={{ color: "var(--color-text-tertiary)" }}>
          {t.exportImport.clipperDescription}
        </p>

        {/* ステータスバッジ */}
        <div className="flex items-center gap-3 mb-4">
          {extensionStatus === "running" ? (
            <span
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium"
              style={{
                backgroundColor: "rgba(34, 197, 94, 0.12)",
                color: "rgb(34, 197, 94)",
                borderRadius: "var(--radius-tag)",
              }}
            >
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "rgb(34, 197, 94)" }} />
              {t.exportImport.k_localServerRunning}
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium"
              style={{
                backgroundColor: "var(--color-bg-tertiary)",
                color: "var(--color-text-tertiary)",
                borderRadius: "var(--radius-tag)",
              }}
            >
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "var(--color-text-disabled)" }} />
              {extensionStatus === "checking" ? t.common.loading : t.exportImport.k_localServerWaiting}
            </span>
          )}
        </div>

        {/* インストール手順 */}
        <div className="relative mb-4" ref={installGuideRef}>
          <button
            onClick={() => setInstallGuideOpen((v) => !v)}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium"
            style={{
              backgroundColor: "var(--color-bg-hover)",
              color: "var(--color-text-primary)",
              borderRadius: "var(--radius-button)",
              border: "1px solid var(--color-border-primary)",
              transition: "all var(--transition-fast)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-bg-active)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--color-bg-hover)"; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            {t.exportImport.k_installGuide}
          </button>
          {installGuideOpen && (
            <div
              className="mt-3 p-4 flex flex-col gap-3"
              style={{
                backgroundColor: "var(--color-bg-secondary)",
                borderRadius: "var(--radius-input)",
                border: "1px solid var(--color-border-secondary)",
              }}
            >
              {[
                ...(t.exportImport.k_extension_steps ?? [
                  "1. Search Stellar Clipper on Chrome Web Store / Firefox Add-ons",
                  "2. Install and pin the extension",
                  "3. Launch Stellar desktop app",
                  "4. Click the extension icon on a paper page to import",
                ]),
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span
                    className="shrink-0 flex items-center justify-center text-xs font-bold"
                    style={{
                      width: "18px", height: "18px", borderRadius: "50%",
                      backgroundColor: "var(--color-accent-primary)",
                      color: "var(--color-text-inverse)",
                      fontSize: "10px", marginTop: "1px",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                    {step.replace(/^\d+\.\s*/, "")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 最近のインポート */}
        <div>
          <h4 className="text-xs font-semibold mb-2" style={{ color: "var(--color-text-secondary)" }}>
            {t.exportImport.k_recentImports}
          </h4>
          {recentImports.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
              {t.exportImport.k_noRecentImports}
            </p>
          ) : (
            <div
              className="flex flex-col"
              style={{
                borderRadius: "var(--radius-input)",
                border: "1px solid var(--color-border-secondary)",
                overflow: "hidden",
              }}
            >
              {recentImports.map((item, idx) => {
                const diffMs = Date.now() - new Date(item.importedAt).getTime();
                const diffMin = Math.floor(diffMs / 60000);
                const diffHr = Math.floor(diffMin / 60);
                const relTime = diffMin < 1
                  ? (t.exportImport.k_justNow)
                  : diffMin < 60
                    ? (t.exportImport.k_minutesAgo).replace("${n}", String(diffMin))
                    : (t.exportImport.k_hoursAgo).replace("${n}", String(diffHr));
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-3 py-2"
                    style={{
                      backgroundColor: "var(--color-bg-card)",
                      borderBottom: idx < recentImports.length - 1 ? "1px solid var(--color-border-secondary)" : "none",
                    }}
                  >
                    <span className="text-xs truncate flex-1" style={{ color: "var(--color-text-primary)" }}>
                      {item.title}
                    </span>
                    <span className="text-xs shrink-0 ml-3" style={{ color: "var(--color-text-tertiary)" }}>
                      {relTime}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* クラウドバックアップ */}
      <section>
        <h3 className="text-base font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
          <span className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
            </svg>
            {t.settings.data.cloudBackup}
          </span>
        </h3>
        <p className="text-sm mb-4" style={{ color: "var(--color-text-tertiary)" }}>
          {t.settings.data.cloudBackupDesc}
        </p>

        {!cloudStatus?.isConfigured ? (
          /* ── 未セットアップ ── */
          <div className="flex flex-col gap-3">
            <button
              onClick={handleCloudSetup}
              disabled={isCloudSettingUp}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium"
              style={{
                backgroundColor: "var(--color-accent-primary)",
                color: "var(--color-text-inverse)",
                borderRadius: "var(--radius-button)",
                opacity: isCloudSettingUp ? 0.6 : 1,
                cursor: isCloudSettingUp ? "not-allowed" : "pointer",
                transition: "all var(--transition-fast)",
                maxWidth: "280px",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
                <polyline points="16 16 12 12 8 16" />
                <line x1="12" y1="12" x2="12" y2="21" />
              </svg>
              {isCloudSettingUp ? t.settings.data.settingUp : t.settings.data.setupCloudBackup}
            </button>

            {/* リカバリーコードで復元 */}
            <div className="mt-2">
              <button
                onClick={() => setShowRecoverInput(!showRecoverInput)}
                className="text-xs underline"
                style={{ color: "var(--color-accent-primary)", cursor: "pointer", background: "none", border: "none" }}
              >
                {t.settings.data.recoverFromCode}
              </button>
              {showRecoverInput && (
                <div className="mt-2 flex flex-col gap-2" style={{ maxWidth: "360px" }}>
                  <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                    {t.settings.data.recoverDesc}
                  </p>
                  <input
                    type="text"
                    value={recoverCodeInput}
                    onChange={(e) => setRecoverCodeInput(e.target.value.toUpperCase())}
                    placeholder={t.settings.data.enterRecoveryCode}
                    className="px-3 py-2 text-sm"
                    style={{
                      backgroundColor: "var(--color-bg-input)",
                      color: "var(--color-text-primary)",
                      border: "1px solid var(--color-border-primary)",
                      borderRadius: "var(--radius-input)",
                      outline: "none",
                      fontFamily: "monospace",
                      letterSpacing: "0.1em",
                    }}
                  />
                  <button
                    onClick={handleRecover}
                    disabled={isRecovering || !recoverCodeInput.trim()}
                    className="px-3 py-2 text-xs font-medium"
                    style={{
                      backgroundColor: "var(--color-accent-primary)",
                      color: "var(--color-text-inverse)",
                      borderRadius: "var(--radius-button)",
                      opacity: isRecovering || !recoverCodeInput.trim() ? 0.6 : 1,
                      cursor: isRecovering || !recoverCodeInput.trim() ? "not-allowed" : "pointer",
                      maxWidth: "140px",
                    }}
                  >
                    {isRecovering ? t.settings.data.recovering : t.settings.data.recoverButton}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── セットアップ済み ── */
          <div className="flex flex-col gap-5">
            {/* バックアップ実行ボタン + 最終バックアップ日時 */}
            <div className="flex items-center gap-4 flex-wrap">
              <button
                onClick={handleCloudBackup}
                disabled={isCloudBackingUp}
                className="flex items-center gap-2 px-4 py-2 text-xs font-medium"
                style={{
                  backgroundColor: "var(--color-accent-primary)",
                  color: "var(--color-text-inverse)",
                  borderRadius: "var(--radius-button)",
                  opacity: isCloudBackingUp ? 0.6 : 1,
                  cursor: isCloudBackingUp ? "not-allowed" : "pointer",
                  transition: "all var(--transition-fast)",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
                  <polyline points="16 16 12 12 8 16" />
                  <line x1="12" y1="12" x2="12" y2="21" />
                </svg>
                {isCloudBackingUp ? t.settings.data.backingUpCloud : t.settings.data.backupNow}
              </button>
              <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                {t.settings.data.lastBackup}:{" "}
                {cloudStatus.lastBackupAt
                  ? new Date(cloudStatus.lastBackupAt).toLocaleString()
                  : t.settings.data.never}
              </span>
            </div>

            {/* リカバリーコード表示 */}
            <div
              className="p-4"
              style={{
                backgroundColor: "var(--color-bg-secondary)",
                borderRadius: "var(--radius-input)",
                border: "1px solid var(--color-border-secondary)",
                maxWidth: "440px",
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-xs font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                  {t.settings.data.recoveryCode}
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowRecoveryCode(!showRecoveryCode)}
                    className="text-xs px-2 py-0.5"
                    style={{
                      color: "var(--color-accent-primary)",
                      background: "none",
                      border: "1px solid var(--color-border-primary)",
                      borderRadius: "var(--radius-button)",
                      cursor: "pointer",
                    }}
                  >
                    {showRecoveryCode ? t.settings.data.hideCode : t.settings.data.showCode}
                  </button>
                  <button
                    onClick={handleCopyRecoveryCode}
                    className="text-xs px-2 py-0.5"
                    style={{
                      color: copiedCode ? "rgb(34, 197, 94)" : "var(--color-accent-primary)",
                      background: "none",
                      border: "1px solid var(--color-border-primary)",
                      borderRadius: "var(--radius-button)",
                      cursor: "pointer",
                    }}
                  >
                    {copiedCode ? t.settings.data.copied : t.settings.data.copyCode}
                  </button>
                </div>
              </div>
              <div
                className="font-mono text-lg font-bold tracking-widest mt-2 mb-2 select-all"
                style={{
                  color: "var(--color-text-primary)",
                  filter: showRecoveryCode ? "none" : "blur(6px)",
                  transition: "filter 0.2s",
                  userSelect: showRecoveryCode ? "all" : "none",
                }}
              >
                {cloudStatus.recoveryCode ?? "XXXX-XXXX-XXXX"}
              </div>
              <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                {t.settings.data.recoveryCodeDesc}
              </p>
            </div>

            {/* 自動バックアップ */}
            <label className="flex items-center gap-3 cursor-pointer" style={{ maxWidth: "400px" }}>
              <div
                onClick={() => handleToggleAutoBackup(!cloudStatus.autoBackupEnabled)}
                className="relative shrink-0"
                style={{
                  width: "36px",
                  height: "20px",
                  borderRadius: "10px",
                  backgroundColor: cloudStatus.autoBackupEnabled
                    ? "var(--color-accent-primary)"
                    : "var(--color-bg-tertiary)",
                  border: "1px solid var(--color-border-primary)",
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: "2px",
                    left: cloudStatus.autoBackupEnabled ? "18px" : "2px",
                    width: "14px",
                    height: "14px",
                    borderRadius: "50%",
                    backgroundColor: cloudStatus.autoBackupEnabled
                      ? "var(--color-text-inverse)"
                      : "var(--color-text-tertiary)",
                    transition: "left 0.2s, background-color 0.2s",
                  }}
                />
              </div>
              <div>
                <div className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                  {t.settings.data.autoBackup}
                </div>
                <div className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                  {t.settings.data.autoBackupDesc}
                </div>
              </div>
            </label>

            {/* バックアップ履歴 */}
            <div>
              <h4 className="text-xs font-semibold mb-2" style={{ color: "var(--color-text-secondary)" }}>
                {t.settings.data.backupHistory}
              </h4>
              {cloudBackups.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                  {t.settings.data.noBackups}
                </p>
              ) : (
                <div
                  className="flex flex-col"
                  style={{
                    borderRadius: "var(--radius-input)",
                    border: "1px solid var(--color-border-secondary)",
                    overflow: "hidden",
                    maxWidth: "480px",
                  }}
                >
                  {cloudBackups.slice(0, 5).map((backup, idx) => (
                    <div
                      key={backup.backupId}
                      className="flex items-center justify-between px-3 py-2.5"
                      style={{
                        backgroundColor: "var(--color-bg-card)",
                        borderBottom: idx < Math.min(cloudBackups.length, 5) - 1
                          ? "1px solid var(--color-border-secondary)"
                          : "none",
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                          {new Date(backup.createdAt).toLocaleString()}
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>
                          {backup.summary.paperCount} {t.settings.data.papers} · {backup.summary.noteCount} {t.settings.data.notes} · {backup.summary.highlightCount} {t.settings.data.highlights}
                          {backup.sizeBytes > 0 && ` · ${(backup.sizeBytes / 1024).toFixed(0)} KB`}
                        </div>
                      </div>
                      <button
                        onClick={() => handleCloudRestore(backup.backupId)}
                        disabled={isRestoring === backup.backupId}
                        className="shrink-0 ml-3 px-2.5 py-1 text-xs font-medium"
                        style={{
                          backgroundColor: "var(--color-bg-hover)",
                          color: "var(--color-text-primary)",
                          borderRadius: "var(--radius-button)",
                          border: "1px solid var(--color-border-primary)",
                          opacity: isRestoring === backup.backupId ? 0.6 : 1,
                          cursor: isRestoring === backup.backupId ? "not-allowed" : "pointer",
                        }}
                      >
                        {isRestoring === backup.backupId ? t.settings.data.restoring : t.settings.data.restore}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 暗号化の説明 */}
            <div
              className="flex items-start gap-2 p-3"
              style={{
                backgroundColor: "rgba(59, 130, 246, 0.06)",
                borderRadius: "var(--radius-input)",
                border: "1px solid rgba(59, 130, 246, 0.15)",
                maxWidth: "480px",
              }}
            >
              <svg className="shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgb(59, 130, 246)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                {t.settings.data.encryptionNote}
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );

  // ============================================================
  // アドオン / プラグインタブ
  // ============================================================
  const renderAddonsTab = () => (
    <div className="flex flex-col gap-8">
      <section>
        <h3 className="text-base font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
          {t.settings.addons.title}
        </h3>
        <p className="text-sm mb-4" style={{ color: "var(--color-text-tertiary)" }}>
          {t.settings.addons.desc}
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleInstallPluginFromFile}
            disabled={isInstallingPlugin}
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium"
            style={{
              backgroundColor: "var(--color-accent-primary)",
              color: "var(--color-text-inverse)",
              borderRadius: "var(--radius-button)",
              opacity: isInstallingPlugin ? 0.6 : 1,
              cursor: isInstallingPlugin ? "not-allowed" : "pointer",
              transition: "all var(--transition-fast)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {isInstallingPlugin ? t.settings.addons.installing : t.settings.addons.addFromFile}
          </button>
          <button
            type="button"
            onClick={handleInstallPluginFromFolder}
            disabled={isInstallingPlugin}
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium"
            style={{
              backgroundColor: "var(--color-bg-hover)",
              color: "var(--color-text-primary)",
              borderRadius: "var(--radius-button)",
              border: "1px solid var(--color-border-primary)",
              opacity: isInstallingPlugin ? 0.6 : 1,
              cursor: isInstallingPlugin ? "not-allowed" : "pointer",
              transition: "all var(--transition-fast)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <path d="M12 11v6" />
              <path d="M9 14h6" />
            </svg>
            {t.settings.addons.addFromFolder}
          </button>
        </div>
        <p className="text-xs mt-3" style={{ color: "var(--color-text-tertiary)" }}>
          {t.settings.addons.packageHint}
        </p>
      </section>

      <section>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-base font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
              {t.settings.addons.installed}
            </h3>
            <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>
              {t.settings.addons.installedDesc}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshPlugins()}
            disabled={isLoadingPlugins}
            className="shrink-0 flex items-center gap-2 px-3 py-2 text-xs font-medium"
            style={{
              backgroundColor: "var(--color-bg-hover)",
              color: "var(--color-text-primary)",
              borderRadius: "var(--radius-button)",
              border: "1px solid var(--color-border-primary)",
              opacity: isLoadingPlugins ? 0.6 : 1,
              cursor: isLoadingPlugins ? "not-allowed" : "pointer",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
            {t.settings.addons.reloadList}
          </button>
        </div>

        {isLoadingPlugins ? (
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--color-text-tertiary)" }}>
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {t.settings.addons.loading}
          </div>
        ) : plugins.length === 0 ? (
          <div
            className="px-4 py-5 text-sm"
            style={{
              backgroundColor: "var(--color-bg-secondary)",
              border: "1px solid var(--color-border-secondary)",
              borderRadius: "var(--radius-input)",
              color: "var(--color-text-tertiary)",
            }}
          >
            {t.settings.addons.empty}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {plugins.map((plugin) => {
              const isBusy = updatingPluginId === plugin.id;
              return (
                <div
                  key={plugin.id}
                  className="p-4"
                  style={{
                    backgroundColor: "var(--color-bg-card)",
                    border: "1px solid var(--color-border-secondary)",
                    borderRadius: "var(--radius-input)",
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="shrink-0 flex items-center justify-center"
                      style={{
                        width: "34px",
                        height: "34px",
                        borderRadius: "var(--radius-input)",
                        backgroundColor: plugin.enabled ? "rgba(59, 130, 246, 0.1)" : "var(--color-bg-tertiary)",
                        color: plugin.enabled ? "var(--color-accent-primary)" : "var(--color-text-tertiary)",
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2v5" />
                        <path d="M9 7h6" />
                        <path d="M6 10h12" />
                        <path d="M8 10v10a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V10" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>
                          {plugin.name}
                        </h4>
                        <span
                          className="px-2 py-0.5 text-[11px] font-medium"
                          style={{
                            borderRadius: "var(--radius-tag)",
                            backgroundColor: plugin.enabled ? "rgba(34, 197, 94, 0.12)" : "var(--color-bg-tertiary)",
                            color: plugin.enabled ? "rgb(34, 197, 94)" : "var(--color-text-tertiary)",
                          }}
                        >
                          {plugin.enabled ? t.settings.addons.enabled : t.settings.addons.disabled}
                        </span>
                      </div>
                      <p className="text-xs mt-1" style={{ color: "var(--color-text-tertiary)" }}>
                        {plugin.description || t.settings.addons.noDescription}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                    <div>
                      <span style={{ color: "var(--color-text-tertiary)" }}>{t.settings.addons.version}: </span>
                      {plugin.version || t.settings.addons.unknownVersion}
                    </div>
                    <div>
                      <span style={{ color: "var(--color-text-tertiary)" }}>{t.settings.addons.author}: </span>
                      {plugin.author || "—"}
                    </div>
                    <div>
                      <span style={{ color: "var(--color-text-tertiary)" }}>{t.settings.addons.size}: </span>
                      {formatPluginSize(plugin.packageSizeBytes)}
                    </div>
                    <div className="truncate">
                      <span style={{ color: "var(--color-text-tertiary)" }}>{t.settings.addons.entry}: </span>
                      {plugin.entry}
                    </div>
                  </div>

                  {plugin.capabilities.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {plugin.capabilities.map((capability) => (
                        <span
                          key={capability}
                          className="px-2 py-0.5 text-[11px]"
                          style={{
                            backgroundColor: "var(--color-bg-secondary)",
                            color: "var(--color-text-secondary)",
                            borderRadius: "var(--radius-tag)",
                            border: "1px solid var(--color-border-secondary)",
                          }}
                        >
                          {capability}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    <label
                      className="flex items-center gap-2 px-3 py-2 text-xs font-medium"
                      style={{
                        backgroundColor: "var(--color-bg-secondary)",
                        color: "var(--color-text-primary)",
                        border: "1px solid var(--color-border-secondary)",
                        borderRadius: "var(--radius-button)",
                        opacity: isBusy ? 0.6 : 1,
                        cursor: isBusy ? "not-allowed" : "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={plugin.enabled}
                        disabled={isBusy}
                        onChange={(event) => void handleTogglePlugin(plugin, event.currentTarget.checked)}
                        style={{ accentColor: "var(--color-accent-primary)" }}
                      />
                      {plugin.enabled ? t.settings.addons.enabled : t.settings.addons.disabled}
                    </label>
                    <button
                      type="button"
                      onClick={() => void shellOpen(plugin.path)}
                      className="px-3 py-2 text-xs font-medium"
                      style={{
                        backgroundColor: "var(--color-bg-hover)",
                        color: "var(--color-text-primary)",
                        border: "1px solid var(--color-border-primary)",
                        borderRadius: "var(--radius-button)",
                      }}
                    >
                      {t.settings.addons.openFolder}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRemovePlugin(plugin)}
                      disabled={isBusy}
                      className="px-3 py-2 text-xs font-medium"
                      style={{
                        backgroundColor: "transparent",
                        color: "var(--color-accent-danger)",
                        border: "1px solid var(--color-border-primary)",
                        borderRadius: "var(--radius-button)",
                        opacity: isBusy ? 0.6 : 1,
                        cursor: isBusy ? "not-allowed" : "pointer",
                      }}
                    >
                      {t.settings.addons.remove}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section
        className="p-4"
        style={{
          backgroundColor: "rgba(59, 130, 246, 0.06)",
          border: "1px solid rgba(59, 130, 246, 0.15)",
          borderRadius: "var(--radius-input)",
        }}
      >
        <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
          {t.settings.addons.restartTitle}
        </h3>
        <p className="text-xs mb-3" style={{ color: "var(--color-text-tertiary)" }}>
          {t.settings.addons.restartNote}
        </p>
        <button
          type="button"
          onClick={() => void relaunch()}
          className="flex items-center gap-2 px-3 py-2 text-xs font-medium"
          style={{
            backgroundColor: "var(--color-bg-hover)",
            color: "var(--color-text-primary)",
            border: "1px solid var(--color-border-primary)",
            borderRadius: "var(--radius-button)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
          {t.settings.addons.restartApp}
        </button>
      </section>
    </div>
  );

  // ============================================================
  // ショートカットタブ
  // ============================================================
  const renderShortcutsTab = () => {
    const categories = Array.from(new Set(SHORTCUTS.map((s) => s.category)));
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h3 className="text-base font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
            {t.settings.shortcuts.title}
          </h3>
          <p className="text-sm mb-4" style={{ color: "var(--color-text-tertiary)" }}>
            {t.settings.shortcuts.desc}
          </p>
        </div>
        {categories.map((category) => (
          <section key={category}>
            <h4 className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>
              {category}
            </h4>
            <div style={{ borderRadius: "var(--radius-input)", border: "1px solid var(--color-border-secondary)", overflow: "hidden" }}>
              {SHORTCUTS.filter((s) => s.category === category).map((shortcut, index, arr) => (
                <div key={shortcut.keys} className="flex items-center justify-between px-4 py-2.5" style={{
                  backgroundColor: "var(--color-bg-card)",
                  borderBottom: index < arr.length - 1 ? "1px solid var(--color-border-secondary)" : "none",
                }}>
                  <span className="text-sm" style={{ color: "var(--color-text-primary)" }}>{shortcut.description}</span>
                  <div className="flex items-center gap-1">
                    {shortcut.keys.split("+").map((key, ki) => (
                      <span key={`${shortcut.keys}-${key.trim()}`}>
                        {ki > 0 && (
                          <span className="mx-0.5 text-xs" style={{ color: "var(--color-text-tertiary)" }}>+</span>
                        )}
                        <kbd className="px-1.5 py-0.5 text-xs" style={{
                          backgroundColor: "var(--color-bg-tertiary)", color: "var(--color-text-secondary)",
                          borderRadius: "4px", border: "1px solid var(--color-border-secondary)",
                          fontSize: "11px", fontFamily: "system-ui",
                        }}>
                          {key.trim()}
                        </kbd>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
        <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
          {t.settings.shortcuts.customizeNote}
        </p>
      </div>
    );
  };

  // ============================================================
  // 引用スタイルタブ
  // ============================================================
  const renderCitationTab = () => {
    const citationHints: Record<CitationStyle, string> = {
      apa7: t.settings.citation.apa7Hint,
      mla9: t.settings.citation.mla9Hint,
      chicago17: t.settings.citation.chicago17Hint,
      hitotsubashi: t.settings.citation.hitotsubashiHint,
    };

    return (
      <div className="flex flex-col gap-8">
        <section>
          <h3 className="text-base font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
            {t.settings.citation.defaultStyle}
          </h3>
          <p className="text-sm mb-4" style={{ color: "var(--color-text-tertiary)" }}>
            {t.settings.citation.defaultStyleDesc}
          </p>
          <div className="flex flex-col gap-2" style={{ maxWidth: "400px" }}>
            {(Object.entries(CITATION_STYLE_LABELS) as [CitationStyle, string][]).map(([style, label]) => (
              <label key={style} className="flex items-center gap-3 px-4 py-3 cursor-pointer" style={{
                backgroundColor: citationStyle === style ? "var(--color-bg-hover)" : "var(--color-bg-card)",
                borderRadius: "var(--radius-input)",
                border: citationStyle === style ? "2px solid var(--color-accent-primary)" : "2px solid var(--color-border-secondary)",
                transition: "all var(--transition-fast)",
              }}>
                <input type="radio" name="citation-style" value={style} checked={citationStyle === style}
                  onChange={() => setCitationStyle(style)} style={{ accentColor: "var(--color-accent-primary)" }} />
                <div>
                  <div className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>{label}</div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>
                    {citationHints[style]}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-base font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
            {t.settings.citation.authorOrder}
          </h3>
          <p className="text-sm mb-4" style={{ color: "var(--color-text-tertiary)" }}>
            {t.settings.citation.authorOrderDesc}
          </p>
          <div className="flex flex-col gap-2" style={{ maxWidth: "400px" }}>
            {([
              { value: "surname-first" as const, label: t.settings.citation.surnameFirst, example: t.settings.citation.surnameFirstExample },
              { value: "given-first" as const, label: t.settings.citation.givenFirst, example: t.settings.citation.givenFirstExample },
            ]).map((opt) => (
              <label key={opt.value} className="flex items-center gap-3 px-4 py-3 cursor-pointer" style={{
                backgroundColor: authorNameOrder === opt.value ? "var(--color-bg-hover)" : "var(--color-bg-card)",
                borderRadius: "var(--radius-input)",
                border: authorNameOrder === opt.value ? "2px solid var(--color-accent-primary)" : "2px solid var(--color-border-secondary)",
                transition: "all var(--transition-fast)",
              }}>
                <input type="radio" name="author-order" value={opt.value} checked={authorNameOrder === opt.value}
                  onChange={() => setAuthorNameOrder(opt.value)} style={{ accentColor: "var(--color-accent-primary)" }} />
                <div>
                  <div className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>{opt.label}</div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>{opt.example}</div>
                </div>
              </label>
            ))}
          </div>
        </section>
      </div>
    );
  };

  // ============================================================
  // 言語タブ
  // ============================================================
  const renderLanguageTab = () => (
    <div className="flex flex-col gap-8">
      <section>
        <h3 className="text-base font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
          {t.settings.language.title}
        </h3>
        <p className="text-sm mb-4" style={{ color: "var(--color-text-tertiary)" }}>
          {t.settings.language.desc}
        </p>
        <div className="flex flex-col gap-2" style={{ maxWidth: "400px" }}>
          {SUPPORTED_LOCALES.map((loc: Locale) => (
            <label
              key={loc}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer"
              style={{
                backgroundColor: locale === loc ? "var(--color-bg-hover)" : "var(--color-bg-card)",
                borderRadius: "var(--radius-input)",
                border: locale === loc ? "2px solid var(--color-accent-primary)" : "2px solid var(--color-border-secondary)",
                transition: "all var(--transition-fast)",
              }}
            >
              <input
                type="radio"
                name="locale"
                value={loc}
                checked={locale === loc}
                onChange={() => setLocale(loc)}
                style={{ accentColor: "var(--color-accent-primary)" }}
              />
              <div className="flex-1">
                <div className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                  {LOCALE_NATIVE_NAMES[loc]}
                </div>
                {locale === loc && (
                  <div className="text-xs mt-0.5" style={{ color: "var(--color-accent-primary)" }}>
                    {t.settings.language.current}
                  </div>
                )}
              </div>
              {locale === loc && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--color-accent-primary)" }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </label>
          ))}
        </div>
        <p className="text-xs mt-3" style={{ color: "var(--color-text-tertiary)" }}>
          {t.settings.language.restart}
        </p>
      </section>
    </div>
  );

  // ============================================================
  // メインレンダリング
  // ============================================================
  return (
    <div className="flex h-full overflow-hidden" style={{ backgroundColor: "var(--color-bg-primary)" }}>
      {/* 左: タブナビゲーション */}
      <nav className="shrink-0 flex flex-col gap-1 p-3 overflow-y-auto" style={{
        width: "200px", borderRight: "1px solid var(--color-border-secondary)",
        backgroundColor: "var(--color-bg-secondary)",
      }}>
        <h2 className="text-xs font-semibold uppercase tracking-wider px-3 py-2" style={{ color: "var(--color-text-tertiary)" }}>
          {t.settings.title}
        </h2>
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-left w-full" style={{
              borderRadius: "var(--radius-button)",
              color: activeTab === tab.id ? "var(--color-accent-primary)" : "var(--color-text-secondary)",
              backgroundColor: activeTab === tab.id ? "var(--color-bg-hover)" : "transparent",
              fontWeight: activeTab === tab.id ? 600 : 400,
              transition: "all var(--transition-fast)",
            }}
            onMouseEnter={(e) => { if (activeTab !== tab.id) e.currentTarget.style.backgroundColor = "var(--color-bg-hover)"; }}
            onMouseLeave={(e) => { if (activeTab !== tab.id) e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <span className="shrink-0" style={{ opacity: 0.8 }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* 右: タブコンテンツ */}
      <div className="flex-1 overflow-y-auto p-8" style={{ maxWidth: "720px" }}>
        {activeTab === "appearance" && renderAppearanceTab()}
        {activeTab === "data" && renderDataTab()}
        {activeTab === "addons" && renderAddonsTab()}
        {activeTab === "shortcuts" && renderShortcutsTab()}
        {activeTab === "citation" && renderCitationTab()}
        {activeTab === "language" && renderLanguageTab()}
      </div>

      {/* Stellar パッケージモーダル */}
      <StellarPackageModal
        open={stellarPackageModalOpen}
        onClose={() => setStellarPackageModalOpen(false)}
      />
    </div>
  );
};
