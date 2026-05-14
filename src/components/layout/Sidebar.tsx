// src/components/layout/Sidebar.tsx
// Stellar — サイドバー
// ナビゲーション（文献・ノート・グラフ・質的・量的）とビューの切り替え
// セクション分け: メイン / 分析 / システム
// 折りたたみ対応: collapsed 状態ではアイコン + ツールチップ表示

import type React from "react";
import { useCallback, useMemo } from "react";
import { clsx } from "clsx";
import { useUIStore } from "../../stores/useUIStore";
import { useT } from "../../stores/useI18nStore";
import type { SidebarView } from "../../types";
import { useAddonRegistry } from "../../plugins/addonRegistry";

/** サイドバーのナビゲーションアイテム定義 */
interface NavItem {
  view: SidebarView;
  labelKey: string;
  icon: React.ReactNode;
  /** セクション区分 */
  section: "main" | "analysis" | "addons" | "system";
  /** キーボードショートカットヒント */
  shortcut?: string;
}

/** ナビゲーションアイコン群（Lucide 風の SVG） */
const NAV_ITEMS: NavItem[] = [
  {
    view: "library",
    labelKey: "library",
    section: "main",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    view: "notes",
    labelKey: "notes",
    section: "main",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    view: "graph",
    labelKey: "graph",
    section: "main",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <circle cx="19" cy="5" r="2" />
        <circle cx="5" cy="5" r="2" />
        <circle cx="5" cy="19" r="2" />
        <circle cx="19" cy="19" r="2" />
        <line x1="14.5" y1="9.5" x2="17.5" y2="6.5" />
        <line x1="9.5" y1="9.5" x2="6.5" y2="6.5" />
        <line x1="9.5" y1="14.5" x2="6.5" y2="17.5" />
        <line x1="14.5" y1="14.5" x2="17.5" y2="17.5" />
      </svg>
    ),
  },
  {
    view: "qualitative",
    labelKey: "qualitative",
    section: "analysis",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
  {
    view: "quantitative",
    labelKey: "quantitative",
    section: "analysis",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    view: "settings",
    labelKey: "settings",
    section: "system",
    shortcut: "Ctrl+,",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

/** セクションラベルのマッピング */
const SECTION_LABELS: Record<string, string> = {
  main: "WORKSPACE",
  analysis: "ANALYSIS",
  addons: "ADD-ONS",
};

/** ナビゲーションボタン */
const NavButton: React.FC<{
  item: NavItem;
  isActive: boolean;
  isCollapsed: boolean;
  label: string;
  onClick: () => void;
}> = ({ item, isActive, isCollapsed, label, onClick }) => {
  const tooltipLabel = item.shortcut ? `${label}  (${item.shortcut})` : label;

  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex items-center gap-3 text-sm font-medium",
        "transition-all relative group"
      )}
      style={{
        borderRadius: "var(--radius-button)",
        padding: isCollapsed ? "10px" : "9px 12px",
        color: isActive
          ? "var(--color-accent-primary)"
          : "var(--color-text-secondary)",
        backgroundColor: isActive
          ? "var(--color-bg-hover)"
          : "transparent",
        justifyContent: isCollapsed ? "center" : "flex-start",
        transition: "all var(--transition-fast)",
        width: "100%",
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
          e.currentTarget.style.color = "var(--color-text-primary)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.color = "var(--color-text-secondary)";
        }
      }}
      {...(isCollapsed ? { "data-tooltip": tooltipLabel } : {})}
      title={isCollapsed ? undefined : tooltipLabel}
    >
      {/* アクティブインジケーター — 太い左ボーダー */}
      <span
        style={{
          position: "absolute",
          left: "0",
          top: "50%",
          transform: "translateY(-50%)",
          width: "3px",
          height: isActive ? "20px" : "0px",
          borderRadius: "0 3px 3px 0",
          backgroundColor: "var(--color-accent-primary)",
          transition: "height var(--transition-normal)",
        }}
      />

      {/* アイコン */}
      <span
        className="shrink-0 flex items-center justify-center"
        style={{
          opacity: isActive ? 1 : 0.65,
          transition: "opacity var(--transition-fast), transform var(--transition-fast)",
          transform: isActive ? "scale(1.05)" : "scale(1)",
          width: "20px",
          height: "20px",
        }}
      >
        {item.icon}
      </span>

      {/* ラベル */}
      {!isCollapsed && (
        <span
          style={{
            opacity: isActive ? 1 : 0.85,
            fontWeight: isActive ? 600 : 500,
            transition: "opacity var(--transition-fast)",
          }}
        >
          {label}
        </span>
      )}

      {/* アクティブ時の右側ドット */}
      {isActive && !isCollapsed && (
        <span
          style={{
            marginLeft: "auto",
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: "var(--color-accent-primary)",
            opacity: 0.6,
          }}
        />
      )}
    </button>
  );
};

export const Sidebar: React.FC = () => {
  const t = useT();
  const { workspaceViews } = useAddonRegistry();

  /** ビュー → 翻訳済みラベルのマッピング（プラグインビューも含む） */
  const labelMap: Record<string, string> = useMemo(() => {
    const base: Record<string, string> = {
      library: t.sidebar.library,
      notes: t.sidebar.notes,
      graph: t.sidebar.graph,
      qualitative: t.sidebar.qualitative,
      quantitative: t.sidebar.quantitative,
      settings: t.sidebar.settings,
      search: t.common.search,
    };
    // プラグインワークスペースビューのラベルを追加
    for (const addon of workspaceViews) {
      base[`plugin:${addon.id}`] = addon.label;
    }
    return base;
  }, [t, workspaceViews]);

  /** プラグインから登録されたナビアイテム */
  const pluginNavItems: NavItem[] = useMemo(() => {
    return workspaceViews.map((addon) => ({
      view: `plugin:${addon.id}` as SidebarView,
      labelKey: addon.id,
      icon: addon.icon,
      section: addon.section ?? "addons",
    }));
  }, [workspaceViews]);

  const sidebarView = useUIStore((s) => s.sidebarView);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const setSidebarView = useUIStore((s) => s.setSidebarView);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const openGraph = useUIStore((s) => s.openGraph);
  const openSettings = useUIStore((s) => s.openSettings);
  const openQualitative = useUIStore((s) => s.openQualitative);
  const openQuantitative = useUIStore((s) => s.openQuantitative);
  const setMainPaneContent = useUIStore((s) => s.setMainPaneContent);

  const handleNavClick = useCallback(
    (view: SidebarView) => {
      // プラグインビューの処理
      if (typeof view === "string" && view.startsWith("plugin:")) {
        const pluginId = view.slice("plugin:".length);
        setSidebarView(view);
        setMainPaneContent({ type: "plugin-view", pluginId });
        return;
      }

      if (view === "graph") { openGraph(); return; }
      if (view === "settings") { openSettings(); return; }
      if (view === "qualitative") { openQualitative(); return; }
      if (view === "quantitative") { openQuantitative(); return; }

      setSidebarView(view);
      if (view === "library") {
        const current = useUIStore.getState().mainPaneContent;
        if (current.type !== "paper" && current.type !== "empty") {
          setMainPaneContent({ type: "empty" });
        }
      } else if (view === "notes") {
        const current = useUIStore.getState().mainPaneContent;
        if (current.type !== "note" && current.type !== "empty") {
          setMainPaneContent({ type: "empty" });
        }
      }
    },
    [setSidebarView, openGraph, openSettings, openQualitative, openQuantitative, setMainPaneContent]
  );

  /** セクション別にアイテムをグループ化（ビルトイン + プラグイン） */
  const allNavItems = useMemo(() => [...NAV_ITEMS, ...pluginNavItems], [pluginNavItems]);
  const mainItems = allNavItems.filter((i) => i.section === "main");
  const analysisItems = allNavItems.filter((i) => i.section === "analysis");
  const addonItems = allNavItems.filter((i) => i.section === "addons");
  const systemItems = allNavItems.filter((i) => i.section === "system");

  return (
    <aside
      className="fixed left-0 flex flex-col h-full shrink-0 overflow-hidden"
      style={{
        width: sidebarCollapsed
          ? "var(--sidebar-width-collapsed)"
          : "var(--sidebar-width)",
        top: "var(--titlebar-height)",
        bottom: 0,
        backgroundColor: "var(--color-bg-sidebar)",
        borderRight: "1px solid var(--color-border-secondary)",
        transition: "width var(--transition-normal)",
        zIndex: "var(--z-sticky)",
      }}
    >
      <nav className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden"
        style={{ padding: "var(--space-2)" }}
      >
        {/* ── メインセクション ── */}
        {!sidebarCollapsed && (
          <div className="section-label">{SECTION_LABELS.main}</div>
        )}
        {sidebarCollapsed && <div style={{ height: "var(--space-1)" }} />}
        <div className="flex flex-col gap-0.5">
          {mainItems.map((item) => (
            <NavButton
              key={item.view}
              item={item}
              isActive={sidebarView === item.view}
              isCollapsed={sidebarCollapsed}
              label={labelMap[item.view] ?? item.labelKey}
              onClick={() => handleNavClick(item.view)}
            />
          ))}
        </div>

        {/* ── 区切り線 ── */}
        <div className="section-divider" />

        {/* ── 分析セクション ── */}
        {!sidebarCollapsed && (
          <div className="section-label">{SECTION_LABELS.analysis}</div>
        )}
        <div className="flex flex-col gap-0.5">
          {analysisItems.map((item) => (
            <NavButton
              key={item.view}
              item={item}
              isActive={sidebarView === item.view}
              isCollapsed={sidebarCollapsed}
              label={labelMap[item.view] ?? item.labelKey}
              onClick={() => handleNavClick(item.view)}
            />
          ))}
        </div>

        {/* ── アドオンセクション（プラグインが登録されている場合のみ表示） ── */}
        {addonItems.length > 0 && (
          <>
            <div className="section-divider" />
            {!sidebarCollapsed && (
              <div className="section-label">{SECTION_LABELS.addons}</div>
            )}
            <div className="flex flex-col gap-0.5">
              {addonItems.map((item) => (
                <NavButton
                  key={item.view}
                  item={item}
                  isActive={sidebarView === item.view}
                  isCollapsed={sidebarCollapsed}
                  label={labelMap[item.view] ?? item.labelKey}
                  onClick={() => handleNavClick(item.view)}
                />
              ))}
            </div>
          </>
        )}

        {/* ── スペーサー ── */}
        <div className="flex-1" />

        {/* ── 区切り線 ── */}
        <div className="section-divider" />

        {/* ── システムセクション（設定） ── */}
        <div className="flex flex-col gap-0.5">
          {systemItems.map((item) => (
            <NavButton
              key={item.view}
              item={item}
              isActive={sidebarView === item.view}
              isCollapsed={sidebarCollapsed}
              label={labelMap[item.view] ?? item.labelKey}
              onClick={() => handleNavClick(item.view)}
            />
          ))}
        </div>
      </nav>

      {/* 下部: 折りたたみトグル */}
      <div
        style={{
          padding: "var(--space-2)",
          borderTop: "1px solid var(--color-border-secondary)",
        }}
      >
        <button
          onClick={toggleSidebar}
          className="flex items-center justify-center w-full"
          style={{
            borderRadius: "var(--radius-button)",
            color: "var(--color-text-tertiary)",
            transition: "all var(--transition-fast)",
            padding: "8px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
            e.currentTarget.style.color = "var(--color-text-secondary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "var(--color-text-tertiary)";
          }}
          title={sidebarCollapsed ? `${t.sidebar.expandSidebar}  (Ctrl+\\)` : `${t.sidebar.collapseSidebar}  (Ctrl+\\)`}
          {...(sidebarCollapsed ? { "data-tooltip": `${t.sidebar.expandSidebar}  (Ctrl+\\)` } : {})}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: sidebarCollapsed ? "rotate(180deg)" : "none",
              transition: "transform var(--transition-normal)",
            }}
          >
            <polyline points="11 17 6 12 11 7" />
            <polyline points="18 17 13 12 18 7" />
          </svg>
          {!sidebarCollapsed && (
            <span
              className="ml-2 text-xs"
              style={{ opacity: 0.7 }}
            >
              {t.sidebar.collapseSidebar}
            </span>
          )}
        </button>
      </div>
    </aside>
  );
};
