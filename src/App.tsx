// src/App.tsx
// Stellar — メインアプリケーションコンポーネント
// レイアウト構成: Titlebar + Sidebar + MainPane + ToastContainer + SearchModal
// グローバルショートカット: Cmd+K → 全文検索モーダル

import type React from "react";
import { useEffect } from "react";
import { Titlebar } from "./components/layout/Titlebar";
import { Sidebar } from "./components/layout/Sidebar";
import { MainPane } from "./components/layout/MainPane";
import { SearchModal } from "./components/search/SearchModal";
import { ToastContainer } from "./components/ui/Toast";
import { useThemeStore } from "./stores/useThemeStore";
import { useUIStore } from "./stores/useUIStore";

const App: React.FC = () => {
  const theme = useThemeStore((s) => s.theme);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSearchModal = useUIStore((s) => s.toggleSearchModal);
  const openSettings = useUIStore((s) => s.openSettings);

  // テーマ変更時に data-theme 属性を更新
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // グローバルキーボードショートカット
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd+K / Ctrl+K → 全文検索モーダルを開閉
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggleSearchModal();
      }
      // Cmd+, / Ctrl+, → 設定を開く
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        openSettings();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [toggleSearchModal, openSettings]);

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden"
      style={{ backgroundColor: "var(--color-bg-primary)" }}
    >
      {/* カスタムタイトルバー */}
      <Titlebar />

      {/* メインコンテンツ領域 */}
      <div className="flex flex-1 overflow-hidden">
        {/* サイドバー */}
        <Sidebar />

        {/* メインペイン */}
        <main
          className="flex-1 overflow-hidden"
          style={{
            marginLeft: sidebarCollapsed
              ? "var(--sidebar-width-collapsed)"
              : "var(--sidebar-width)",
            transition: "margin-left var(--transition-normal)",
          }}
        >
          <MainPane />
        </main>
      </div>

      {/* 全文検索モーダル（Portal で body 直下にレンダリング） */}
      <SearchModal />

      {/* トースト通知コンテナ */}
      <ToastContainer />
    </div>
  );
};

export default App;
