// src/components/layout/MainPane.tsx
// Stellar — メインペイン
// サイドバーの選択に応じてコンテンツ領域を切り替える
// 改善: より直感的な空状態、洗練されたローディング表示、アクション誘導

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
import { GraphView } from "../graph/GraphView";
import { useI18nStore } from "../../stores/useI18nStore";
import { SearchResultsView } from "../search/SearchResultsView";

const ReaderView = lazy(() =>
  import("../reader/ReaderView").then((m) => ({ default: m.ReaderView }))
);

const QualitativeView = lazy(() => import("../qualitative/QualitativeView"));
const DataStudioView = lazy(() => import("../quantitative/DataStudioView"));

/** 遅延コンポーネント用ローディング表示 — スケルトン風 */
const LazyFallback: React.FC = () => (
  <div
    className="flex items-center justify-center h-full"
    style={{ color: "var(--color-text-tertiary)" }}
  >
    <div className="flex flex-col items-center gap-4">
      {/* アニメーションドット */}
      <div className="flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "var(--color-accent-primary)",
              opacity: 0.3,
              animation: `pulse 1.2s ease-in-out ${i * 0.15}s infinite`,
            }}
          />
        ))}
      </div>
      <span
        className="text-sm"
        style={{ color: "var(--color-text-tertiary)", opacity: 0.8 }}
      >
        {useI18nStore.getState().t.layout.loading}
      </span>
    </div>
  </div>
);

/** 空状態のウェルカム画面 — より魅力的で分かりやすい */
const EmptyState: React.FC = () => {
  const tStore = useI18nStore.getState().t;

  return (
    <div className="empty-state">
      {/* ロゴアイコン（グラデーション背景） */}
      <div className="empty-state-icon">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </div>

      {/* テキスト */}
      <div style={{ textAlign: "center" }}>
        <h2 className="empty-state-title" style={{ marginBottom: "var(--space-2)" }}>
          {tStore.onboarding.welcome.title}
        </h2>
        <p className="empty-state-desc">
          {tStore.library.k_welcome_desc.split("\n").map((line: string, i: number) => (
            <span key={i}>{line}{i === 0 && <br />}</span>
          ))}
        </p>
      </div>

      {/* キーボードショートカットヒント */}
      <div
        className="flex flex-col gap-3"
        style={{
          padding: "var(--space-4) var(--space-6)",
          backgroundColor: "var(--color-bg-secondary)",
          borderRadius: "var(--radius-card)",
          border: "1px solid var(--color-border-secondary)",
        }}
      >
        <ShortcutHint
          keys="Ctrl+K"
          description={tStore.layout.str_ap0rmt}
        />
        <ShortcutHint
          keys="Ctrl+N"
          description={tStore.onboarding.completion.shortcutNote}
        />
      </div>
    </div>
  );
};

/** ショートカットヒント行 */
const ShortcutHint: React.FC<{ keys: string; description: string }> = ({ keys, description }) => (
  <div className="flex items-center gap-3" style={{ fontSize: "var(--font-size-xs)" }}>
    <span className="kbd-hint" style={{ minWidth: "52px", justifyContent: "center" }}>
      {keys}
    </span>
    <span style={{ color: "var(--color-text-secondary)" }}>{description}</span>
  </div>
);

/** ノートビュー空状態 — ノート選択を促す */
const NotesEmptyState: React.FC = () => {
  const tStore = useI18nStore.getState().t;

  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      </div>
      <p className="empty-state-desc">{tStore.layout.str_18oqaa}</p>
    </div>
  );
};

export const MainPane: React.FC = () => {
  const mainPaneContent = useUIStore((s) => s.mainPaneContent);
  const sidebarView = useUIStore((s) => s.sidebarView);

  const renderContent = () => {
    // サイドバーが「文献」ビューの場合
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
              <NotesEmptyState />
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
        return <SearchResultsView />;
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
