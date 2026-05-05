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

// 重いコンポーネントは React.lazy で遅延読み込み
// GraphView: react-force-graph-2d + d3-force 依存
// ReaderView: pdfjs-dist 依存
const GraphView = lazy(() =>
  import("../graph/GraphView").then((m) => ({ default: m.GraphView }))
);
const ReaderView = lazy(() =>
  import("../reader/ReaderView").then((m) => ({ default: m.ReaderView }))
);

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
      <span className="text-sm">読み込み中…</span>
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
        Stellar へようこそ
      </h2>
      <p className="text-sm" style={{ lineHeight: "var(--line-height-relaxed)" }}>
        サイドバーから文献やノートを選択するか、
        <br />
        新しい文献を追加して研究を始めましょう。
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
        <span>全文検索</span>
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
        <span>新しいノートを作成</span>
      </div>
    </div>
  </div>
);

export const MainPane: React.FC = () => {
  const mainPaneContent = useUIStore((s) => s.mainPaneContent);
  const sidebarView = useUIStore((s) => s.sidebarView);

  // サイドバーが「文献」または「ノート」の場合、空状態でも対応ビューを表示
  const renderContent = () => {
    // サイドバーが「文献」ビューの場合、常にライブラリビューを表示
    if (sidebarView === "library" && mainPaneContent.type === "empty") {
      return <LibraryView />;
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
          {/* 右: ノートエディタ or 空状態 */}
          <div className="flex-1 overflow-hidden">
            {mainPaneContent.type === "note" ? (
              <NoteEditor noteId={mainPaneContent.noteId} />
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
                <p className="text-sm">ノートを選択するか、新しいノートを作成してください</p>
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
      case "graph":
        return (
          <Suspense fallback={<LazyFallback />}>
            <GraphView />
          </Suspense>
        );
      case "search":
        return (
          <div
            className="flex items-center justify-center h-full"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            <p className="text-sm">検索結果 — 実装予定</p>
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
