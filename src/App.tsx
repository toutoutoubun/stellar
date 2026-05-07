// src/App.tsx
// Stellar — メインアプリケーションコンポーネント
// Zustand UIStore で画面管理 (library, reader, note, graph, search, settings)
// navigationHistory による戻る/進む対応
// CSS トランジション: data-entering / data-leaving による slideIn/slideOut アニメーション
// ErrorBoundary でキャッチされないエラーを捕捉
// OnboardingFlow で初回起動時のセットアップ

import type React from "react";
import { useEffect, useRef, useState, useCallback } from "react";
import { Titlebar } from "./components/layout/Titlebar";
import { Sidebar } from "./components/layout/Sidebar";
import { MainPane } from "./components/layout/MainPane";
import { ContextPanel } from "./components/layout/ContextPanel";
import { SearchModal } from "./components/search/SearchModal";
import { ToastContainer } from "./components/ui/Toast";
import { ErrorBoundary } from "./components/ErrorBoundary";
import {
  OnboardingFlow,
  isOnboarded,
} from "./components/onboarding/OnboardingFlow";
import { TutorialOverlay, isTutorialSeen } from "./components/ui/TutorialOverlay";
import { useThemeStore } from "./stores/useThemeStore";
import { useUIStore } from "./stores/useUIStore";
import type { TransitionDirection } from "./stores/useUIStore";
import { useTauriEvents } from "./hooks/useTauriEvents";

// ============================================================
// 画面遷移アニメーション用ラッパー
// ============================================================

interface ScreenTransitionProps {
  children: React.ReactNode;
  direction: TransitionDirection;
  /** アニメーション完了コールバック */
  onTransitionEnd: () => void;
}

const ScreenTransition: React.FC<ScreenTransitionProps> = ({
  children,
  direction,
  onTransitionEnd,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [entering, setEntering] = useState(false);

  useEffect(() => {
    if (direction === "none") return;

    // entering 状態を設定してアニメーション開始
    setEntering(true);
    const el = containerRef.current;
    if (el) {
      el.setAttribute("data-entering", "true");
      el.setAttribute("data-direction", direction);
    }

    const timer = setTimeout(() => {
      if (el) {
        el.removeAttribute("data-entering");
        el.removeAttribute("data-direction");
      }
      setEntering(false);
      onTransitionEnd();
    }, 200);

    return () => clearTimeout(timer);
  }, [direction, onTransitionEnd]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden"
      style={{
        animation:
          entering && direction === "forward"
            ? "slideInFromRight 200ms ease-out"
            : entering && direction === "backward"
              ? "slideInFromLeft 200ms ease-out"
              : "none",
      }}
    >
      {children}
    </div>
  );
};

// ============================================================
// メインアプリ
// ============================================================

const AppContent: React.FC = () => {
  const theme = useThemeStore((s) => s.theme);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSearchModal = useUIStore((s) => s.toggleSearchModal);
  const openSettings = useUIStore((s) => s.openSettings);
  const goBack = useUIStore((s) => s.goBack);
  const goForward = useUIStore((s) => s.goForward);
  const transitionDirection = useUIStore((s) => s.transitionDirection);
  const clearTransition = useUIStore((s) => s.clearTransition);
  const mainPaneContent = useUIStore((s) => s.mainPaneContent);

  // チュートリアルオーバーレイの状態
  // 初回オンボーディング完了後、まだチュートリアルを見ていなければ自動表示
  const [tutorialOpen, setTutorialOpen] = useState(() => !isTutorialSeen());

  const handleOpenTutorial = useCallback(() => {
    setTutorialOpen(true);
  }, []);

  const handleCloseTutorial = useCallback(() => {
    setTutorialOpen(false);
  }, []);

  // Tauri イベントリスナー
  useTauriEvents();

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
      // Cmd+[ / Ctrl+[ → 戻る
      if ((e.metaKey || e.ctrlKey) && e.key === "[") {
        e.preventDefault();
        goBack();
      }
      // Cmd+] / Ctrl+] → 進む
      if ((e.metaKey || e.ctrlKey) && e.key === "]") {
        e.preventDefault();
        goForward();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [toggleSearchModal, openSettings, goBack, goForward]);

  // 遷移完了コールバック
  const handleTransitionEnd = useCallback(() => {
    clearTransition();
  }, [clearTransition]);

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden"
      style={{ backgroundColor: "var(--color-bg-primary)" }}
    >
      {/* カスタムタイトルバー */}
      <Titlebar onOpenTutorial={handleOpenTutorial} />

      {/* メインコンテンツ領域 */}
      <div className="flex flex-1 overflow-hidden">
        {/* サイドバー */}
        <Sidebar />

        {/* メインペイン（画面遷移アニメーション付き） */}
        <main
          className="flex-1 overflow-hidden flex"
          style={{
            marginLeft: sidebarCollapsed
              ? "var(--sidebar-width-collapsed)"
              : "var(--sidebar-width)",
            transition: "margin-left var(--transition-normal)",
          }}
        >
          <div className="flex-1 overflow-hidden">
            <ScreenTransition
              key={JSON.stringify(mainPaneContent)}
              direction={transitionDirection}
              onTransitionEnd={handleTransitionEnd}
            >
              <MainPane />
            </ScreenTransition>
          </div>

          {/* コンテキストパネル（右側スライドイン） */}
          <ContextPanel />
        </main>
      </div>

      {/* 全文検索モーダル（常時マウント、visibility:hidden で非表示） */}
      <SearchModal />

      {/* トースト通知コンテナ */}
      <ToastContainer />

      {/* チュートリアルオーバーレイ */}
      <TutorialOverlay open={tutorialOpen} onClose={handleCloseTutorial} />
    </div>
  );
};

// ============================================================
// App ルート（ErrorBoundary + Onboarding ラッパー）
// ============================================================

const App: React.FC = () => {
  const [showOnboarding, setShowOnboarding] = useState(!isOnboarded());

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
  }, []);

  return (
    <ErrorBoundary>
      {showOnboarding ? (
        <OnboardingFlow onComplete={handleOnboardingComplete} />
      ) : (
        <AppContent />
      )}
    </ErrorBoundary>
  );
};

export default App;
