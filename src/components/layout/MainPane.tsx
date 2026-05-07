// src/components/layout/MainPane.tsx
// Stellar — メインペイン
// サイドバーの選択に応じてコンテンツ領域を切り替える
// ライブラリ / 論文（PDFリーダー） / ノート / グラフ / 検索 のルーティング

import type React from "react";
import { Suspense, lazy } from "react";
import { useUIStore } from "../../stores/useUIStore";
import { LibraryView } from "../library/LibraryView";
import { NoteEditor } from "../notes/NoteEditor";
import { NoteList } from "../notes/NoteList";
import { SettingsView } from "../settings/SettingsView";
import { GraphErrorBoundary } from "../graph/GraphErrorBoundary";
import { DraftNoteEditor } from "../notes/DraftNoteEditor";
import { SplitView } from "./SplitView";
// GraphView は静的インポート:
// React.lazy で別チャンクにすると、Safari WKWebView (Tauri) で
// そのチャンクのモジュール評価が失敗する（"undefined is not an object"）。
// Tauri アプリではネットワーク経由のチャンクロードがないため、
// 静的インポートによる初期バンドルサイズ増加は許容範囲。
import { GraphView } from "../graph/GraphView";
import { useI18nStore } from "../../stores/useI18nStore";

// ReaderView は引き続き React.lazy で遅延読み込み（pdfjs-dist 依存）
const ReaderView = lazy(() =>
  import("../reader/ReaderView").then((m) => ({ default: m.ReaderView }))
);

// QualitativeView も React.lazy で遅延読み込み（default export）
const QualitativeView = lazy(() => import("../qualitative/QualitativeView"));

// DataStudioView (量的分析) も React.lazy で遅延読み込み
const DataStudioView = lazy(() => import("../quantitative/DataStudioView"));

/** 遅延コンポーネント用ローディング表示 */
const LazyFallback: React.FC = () => (
  <div
    className="flex items-center justify-center h-full"
    style={{ color: "var(--color-text-tertiary)" }}
  >
    <div className="flex flex-col items-center gap-3">
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        style={{ animation: "spin 1s linear infinite" }}
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      <span className="text-sm">{useI18nStore.getState().t.layout.loading}</span>
    </div>
  </div>
);

/** 空状態のウェルカム画面 */
const EmptyState: React.FC = () => (
  <div
    className="flex flex-col items-center justify-center h-full gap-6 select-none"
    style={{ color: "var(--color-text-tertiary)" }}
  >
    {/* Stellar ロゴ（大） */}
    <svg
      width="64"
      height="64"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: "var(--color-accent-primary)", opacity: 0.4 }}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
    <div className="text-center">
      <h2
        className="text-lg font-semibold mb-2"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {useI18nStore.getState().t.onboarding.welcome.title}
      </h2>
      <p className="text-sm" style={{ lineHeight: "var(--line-height-relaxed)" }}>
        {useI18nStore.getState().t.library.k_welcome_desc.split("\n").map((line: string, i: number) => (
          <span key={i}>{line}{i === 0 && <br />}</span>
        ))}
      </p>
    </div>
    <div
      className="flex flex-col gap-2 text-xs"
      style={{ color: "var(--color-text-tertiary)" }}
    >
      <div className="flex items-center gap-2">
        <kbd
          className="px-1.5 py-0.5"
          style={{
            backgroundColor: "var(--color-bg-tertiary)",
            borderRadius: "4px",
            border: "1px solid var(--color-border-secondary)",
            fontSize: "10px",
          }}
        >
          Ctrl+K
        </kbd>
        <span>{useI18nStore.getState().t.layout.str_ap0rmt}</span>
      </div>
      <div className="flex items-center gap-2">
        <kbd
          className="px-1.5 py-0.5"
          style={{
            backgroundColor: "var(--color-bg-tertiary)",
            borderRadius: "4px",
            border: "1px solid var(--color-border-secondary)",
            fontSize: "10px",
          }}
        >
          Ctrl+N
        </kbd>
        <span>{useI18nStore.getState().t.onboarding.completion.shortcutNote}</span>
      </div>
    </div>
  </div>
);

export const MainPane: React.FC = () => {
  const mainPaneContent = useUIStore((s) => s.mainPaneContent);
  const sidebarView = useUIStore((s) => s.sidebarView);

  // サイドバーが「文献」または「ノート」の場合、空状態でも対応ビューを表示
  const renderContent = () => {
    // サイドバーが「文献」ビューの場合:
    // - paper を開いている場合はそのまま ReaderView
    // - それ以外（empty / graph / settings 等）は LibraryView を表示
    if (sidebarView === "library") {
      if (mainPaneContent.type === "paper") {
        return (
          <Suspense fallback={<LazyFallback />}>
            <ReaderView paperId={mainPaneContent.paperId} />
          </Suspense>
        );
      }
      return <LibraryView />;
    }

    // サイドバーが「質的分析」ビューの場合
    if (sidebarView === "qualitative") {
      return (
        <Suspense fallback={<LazyFallback />}>
          <QualitativeView />
        </Suspense>
      );
    }

    // サイドバーが「量的分析」ビューの場合
    if (sidebarView === "quantitative") {
      return (
        <Suspense fallback={<LazyFallback />}>
          <DataStudioView />
        </Suspense>
      );
    }

    // サイドバーが「ノート」ビューの場合：NoteList + NoteEditor 分割レイアウト
    if (sidebarView === "notes") {
      return (
        <div className="flex h-full overflow-hidden">
          {/* 左: ノート一覧パネル */}
          <div
            className="shrink-0 h-full overflow-hidden"
            style={{
              width: "280px",
              borderRight: "1px solid var(--color-border-primary)",
              backgroundColor: "var(--color-bg-secondary)",
            }}
          >
            <NoteList />
          </div>
          {/* 右: ノートエディタ / 草稿エディタ / 空状態 */}
          <div className="flex-1 overflow-hidden">
            {mainPaneContent.type === "note" ? (
              <NoteEditor noteId={mainPaneContent.noteId} />
            ) : mainPaneContent.type === "draft" ? (
              <DraftNoteEditor noteId={mainPaneContent.noteId} />
            ) : mainPaneContent.type === "split-view" ? (
              <SplitView
                paperId={mainPaneContent.paperId}
                noteId={mainPaneContent.noteId}
              />
            ) : (
              <div
                className="flex flex-col items-center justify-center h-full gap-4"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ opacity: 0.35 }}
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                <p className="text-sm">{useI18nStore.getState().t.layout.str_18oqaa}</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    switch (mainPaneContent.type) {
      case "paper":
        return (
          <Suspense fallback={<LazyFallback />}>
            <ReaderView paperId={mainPaneContent.paperId} />
          </Suspense>
        );
      case "note":
        return <NoteEditor noteId={mainPaneContent.noteId} />;
      case "draft":
        return <DraftNoteEditor noteId={mainPaneContent.noteId} />;
      case "split-view":
        return (
          <SplitView
            paperId={mainPaneContent.paperId}
            noteId={mainPaneContent.noteId}
          />
        );
      case "graph":
        return (
          <GraphErrorBoundary>
            <GraphView />
          </GraphErrorBoundary>
        );
      case "qualitative":
        return (
          <Suspense fallback={<LazyFallback />}>
            <QualitativeView />
          </Suspense>
        );
      case "quantitative":
        return (
          <Suspense fallback={<LazyFallback />}>
            <DataStudioView />
          </Suspense>
        );
      case "search":
        return (
          <div
            className="flex items-center justify-center h-full"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            <p className="text-sm">{useI18nStore.getState().t.layout.str_umlkcu}</p>
          </div>
        );
      case "settings":
        return <SettingsView />;
      case "empty":
      default:
        return <EmptyState />;
    }
  };

  return (
    <div
      className="h-full overflow-hidden"
      style={{ backgroundColor: "var(--color-bg-primary)" }}
    >
      {renderContent()}
    </div>
  );
};
