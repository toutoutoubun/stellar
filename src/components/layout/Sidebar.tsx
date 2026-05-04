// src/components/layout/Sidebar.tsx
// Stellar — サイドバー
// ナビゲーション（文献・ノート・グラフ）とビューの切り替えを行う
// 折りたたみ対応: collapsed 状態ではアイコンのみ表示

import type React from "react";
import { useCallback } from "react";
import { clsx } from "clsx";
import { useUIStore } from "../../stores/useUIStore";
import type { SidebarView } from "../../types";

/** サイドバーのナビゲーションアイテム定義 */
interface NavItem {
  view: SidebarView;
  label: string;
  icon: React.ReactNode;
}

/** ナビゲーションアイコン群（Lucide 風の SVG） */
const NAV_ITEMS: NavItem[] = [
  {
    view: "library",
    label: "文献",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    view: "notes",
    label: "ノート",
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
    label: "グラフ",
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
];

export const Sidebar: React.FC = () => {
  const sidebarView = useUIStore((s) => s.sidebarView);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const setSidebarView = useUIStore((s) => s.setSidebarView);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const openGraph = useUIStore((s) => s.openGraph);

  const handleNavClick = useCallback(
    (view: SidebarView) => {
      setSidebarView(view);
      // グラフビューの場合はメインペインも切り替え
      if (view === "graph") {
        openGraph();
      }
    },
    [setSidebarView, openGraph]
  );

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
      {/* ナビゲーションアイテム */}
      <nav className="flex flex-col gap-1 p-2 flex-1">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.view}
            onClick={() => handleNavClick(item.view)}
            className={clsx(
              "flex items-center gap-3 px-3 py-2 text-sm font-medium",
              "transition-all"
            )}
            style={{
              borderRadius: "var(--radius-button)",
              color:
                sidebarView === item.view
                  ? "var(--color-accent-primary)"
                  : "var(--color-text-secondary)",
              backgroundColor:
                sidebarView === item.view
                  ? "var(--color-bg-hover)"
                  : "transparent",
              justifyContent: sidebarCollapsed ? "center" : "flex-start",
              transition: "all var(--transition-fast)",
            }}
            onMouseEnter={(e) => {
              if (sidebarView !== item.view) {
                e.currentTarget.style.backgroundColor =
                  "var(--color-bg-hover)";
              }
            }}
            onMouseLeave={(e) => {
              if (sidebarView !== item.view) {
                e.currentTarget.style.backgroundColor = "transparent";
              }
            }}
            title={sidebarCollapsed ? item.label : undefined}
          >
            <span className="shrink-0">{item.icon}</span>
            {!sidebarCollapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* 下部: 折りたたみトグル */}
      <div
        className="p-2"
        style={{ borderTop: "1px solid var(--color-border-secondary)" }}
      >
        <button
          onClick={toggleSidebar}
          className="flex items-center justify-center w-full py-2 text-sm"
          style={{
            borderRadius: "var(--radius-button)",
            color: "var(--color-text-tertiary)",
            transition: "all var(--transition-fast)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
          title={sidebarCollapsed ? "サイドバーを展開" : "サイドバーを折りたたむ"}
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
        </button>
      </div>
    </aside>
  );
};
