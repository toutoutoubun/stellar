// src/components/layout/MainPane.tsx
// Stellar — メインペイン
// サイドバーの選択に応じてコンテンツ領域を切り替える
// 改善: より直感的な空状態、洗練されたローディング表示、アクション誘導

import type React from "react";
import { Component, Suspense, lazy, useState } from "react";
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

// ── ビュー単位の ErrorBoundary ──────────────────────────
// 質的/量的分析ビュー等のクラッシュがライブラリ・ノートに波及しないようにする
interface ViewErrorBoundaryProps { label: string; children: React.ReactNode; }
interface ViewErrorBoundaryState { hasError: boolean; error: Error | null; }
class ViewErrorBoundary extends Component<ViewErrorBoundaryProps, ViewErrorBoundaryState> {
  constructor(props: ViewErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ViewErrorBoundary:${this.props.label}]`, error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4" style={{ color: "var(--color-text-tertiary)" }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-sm" style={{ maxWidth: 360, textAlign: "center" }}>
            {this.props.label} でエラーが発生しました。
          </p>
          <p className="text-xs" style={{ color: "var(--color-text-tertiary)", opacity: 0.7 }}>
            {this.state.error?.message}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="text-xs px-3 py-1.5"
            style={{
              backgroundColor: "var(--color-bg-tertiary)",
              border: "1px solid var(--color-border-secondary)",
              borderRadius: "6px",
              cursor: "pointer",
              color: "var(--color-text-secondary)",
            }}
          >
            再試行
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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

/** ノートビュー — NoteList + NoteEditor 分割レイアウト（折りたたみ対応） */
import type { MainPaneContent } from "../../types";

const NotesView: React.FC<{ mainPaneContent: MainPaneContent }> = ({ mainPaneContent }) => {
  const [noteListCollapsed, setNoteListCollapsed] = useState(false);

  return (
    <div className="flex h-full overflow-hidden">
      {/* 左: ノート一覧パネル（折りたたみ対応） */}
      <div
        className="shrink-0 h-full overflow-hidden"
        style={{
          width: noteListCollapsed ? "0px" : "280px",
          borderRight: noteListCollapsed ? "none" : "1px solid var(--color-border-primary)",
          backgroundColor: "var(--color-bg-secondary)",
          transition: "width 150ms ease-out",
        }}
      >
        <NoteList />
      </div>
      {/* 右: ノートエディタ / 草稿エディタ / 空状態 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ノート一覧トグルバー */}
        <div
          className="shrink-0 flex items-center px-2"
          style={{
            height: "36px",
            borderBottom: "1px solid var(--color-border-secondary)",
            backgroundColor: "var(--color-bg-secondary)",
          }}
        >
          <button
            type="button"
            onClick={() => setNoteListCollapsed((prev) => !prev)}
            className="flex items-center justify-center"
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--color-text-tertiary)",
              transition: "all 120ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
              e.currentTarget.style.color = "var(--color-text-secondary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--color-text-tertiary)";
            }}
            title={noteListCollapsed ? "ノート一覧を表示" : "ノート一覧を非表示"}
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
                transform: noteListCollapsed ? "rotate(180deg)" : "none",
                transition: "transform 150ms ease-out",
              }}
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
          {noteListCollapsed && (
            <span
              className="ml-1 text-xs"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {useI18nStore.getState().t.notes.title}
            </span>
          )}
        </div>
        {/* エディタ本体 */}
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
        <ViewErrorBoundary label="質的分析">
          <Suspense fallback={<LazyFallback />}>
            <QualitativeView />
          </Suspense>
        </ViewErrorBoundary>
      );
    }

    // サイドバーが「量的分析」ビューの場合
    if (sidebarView === "quantitative") {
      return (
        <ViewErrorBoundary label="量的分析">
          <Suspense fallback={<LazyFallback />}>
            <DataStudioView />
          </Suspense>
        </ViewErrorBoundary>
      );
    }

    // サイドバーが「グラフ」ビューの場合
    if (sidebarView === "graph") {
      return (
        <GraphErrorBoundary>
          <GraphView />
        </GraphErrorBoundary>
      );
    }

    // サイドバーが「ノート」ビューの場合：NoteList + NoteEditor 分割レイアウト
    if (sidebarView === "notes") {
      return <NotesView mainPaneContent={mainPaneContent} />;
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
          <ViewErrorBoundary label="質的分析">
            <Suspense fallback={<LazyFallback />}>
              <QualitativeView />
            </Suspense>
          </ViewErrorBoundary>
        );
      case "quantitative":
        return (
          <ViewErrorBoundary label="量的分析">
            <Suspense fallback={<LazyFallback />}>
              <DataStudioView />
            </Suspense>
          </ViewErrorBoundary>
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
