// src/components/reader/HighlightPanel.tsx
// Stellar — ハイライトノートパネル（右側 360px）
// タブ切り替え: ハイライト一覧 / コーディングパネル
// ハイライトカード一覧、複数選択、ノート変換ボタン

import type React from "react";
import { useState, useCallback, lazy, Suspense } from "react";
import type { Highlight } from "../../types";
import { HighlightCard } from "./HighlightCard";

// CodePanel は遅延読み込み（質的分析モジュール依存）
const CodePanel = lazy(() => import("../qualitative/CodePanel"));

type PanelTab = "highlights" | "coding";

interface HighlightPanelProps {
  /** ハイライト一覧（createdAt 昇順ソート済み） */
  highlights: Highlight[];
  /** 読み込み中フラグ */
  isLoading: boolean;
  /** 選択中のハイライトID */
  selectedHighlightIds: Set<string>;
  /** コメント保存中のハイライトID */
  savingCommentIds: Set<string>;
  /** PDF上でスクロール先に指定されているハイライトID */
  scrolledToHighlightId: string | null;
  /** カードクリック → PDF該当位置へスクロール */
  onScrollToPdf: (highlight: Highlight) => void;
  /** コメント更新コールバック */
  onUpdateComment: (highlightId: string, comment: string) => void;
  /** 削除コールバック */
  onDelete: (highlightId: string) => void;
  /** 選択トグル */
  onToggleSelect: (highlightId: string) => void;
  /** 全選択解除 */
  onClearSelection: () => void;
  /** 選択ハイライトからノート作成 */
  onCreateNoteFromSelected: () => Promise<string | null>;
  /** 現在表示中の論文ID（コーディングパネル用） */
  paperId?: string;
}

export const HighlightPanel: React.FC<HighlightPanelProps> = ({
  highlights,
  isLoading,
  selectedHighlightIds,
  savingCommentIds,
  scrolledToHighlightId,
  onScrollToPdf,
  onUpdateComment,
  onDelete,
  onToggleSelect,
  onClearSelection,
  onCreateNoteFromSelected,
  paperId,
}) => {
  const [activeTab, setActiveTab] = useState<PanelTab>("highlights");

  /** ノート変換ハンドラ */
  const handleCreateNote = useCallback(async () => {
    await onCreateNoteFromSelected();
  }, [onCreateNoteFromSelected]);

  const selectedCount = selectedHighlightIds.size;

  return (
    <aside
      className="flex flex-col h-full"
      style={{
        width: "360px",
        minWidth: "360px",
        maxWidth: "360px",
        borderLeft: "1px solid var(--color-border-primary)",
        backgroundColor: "var(--color-bg-secondary)",
      }}
    >
      {/* タブヘッダー */}
      <header
        className="flex items-center shrink-0"
        style={{
          height: "44px",
          borderBottom: "1px solid var(--color-border-primary)",
        }}
      >
        {/* ハイライトタブ */}
        <button
          type="button"
          onClick={() => setActiveTab("highlights")}
          className="flex items-center gap-1.5 px-4 h-full text-sm font-medium"
          style={{
            color:
              activeTab === "highlights"
                ? "var(--color-accent-primary)"
                : "var(--color-text-tertiary)",
            borderBottom:
              activeTab === "highlights"
                ? "2px solid var(--color-accent-primary)"
                : "2px solid transparent",
            transition: "all 150ms ease-out",
            background: "none",
            border: "none",
            borderBottomStyle: "solid",
            borderBottomWidth: "2px",
            borderBottomColor:
              activeTab === "highlights"
                ? "var(--color-accent-primary)"
                : "transparent",
            cursor: "pointer",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          ハイライト
          <span
            className="text-xs px-1.5 py-0.5"
            style={{
              backgroundColor: "var(--color-bg-tertiary)",
              color: "var(--color-text-tertiary)",
              borderRadius: "999px",
              fontSize: "10px",
            }}
          >
            {highlights.length}
          </span>
        </button>

        {/* コーディングタブ */}
        <button
          type="button"
          onClick={() => setActiveTab("coding")}
          className="flex items-center gap-1.5 px-4 h-full text-sm font-medium"
          style={{
            color:
              activeTab === "coding"
                ? "var(--color-accent-primary)"
                : "var(--color-text-tertiary)",
            background: "none",
            border: "none",
            borderBottomStyle: "solid",
            borderBottomWidth: "2px",
            borderBottomColor:
              activeTab === "coding"
                ? "var(--color-accent-primary)"
                : "transparent",
            cursor: "pointer",
            transition: "all 150ms ease-out",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" />
          </svg>
          コーディング
        </button>

        {/* 選択解除ボタン（ハイライトタブで選択中のみ表示） */}
        {activeTab === "highlights" && selectedCount > 0 && (
          <button
            type="button"
            onClick={onClearSelection}
            className="text-xs ml-auto mr-3"
            style={{
              color: "var(--color-text-tertiary)",
              padding: "2px 8px",
              borderRadius: "6px",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            選択解除
          </button>
        )}
      </header>

      {/* タブコンテンツ */}
      {activeTab === "highlights" ? (
        <>
          {/* ハイライトカード一覧 */}
          <div className="flex-1 overflow-y-auto" style={{ padding: "12px" }}>
            {isLoading ? (
              // ローディングスケルトン
              <div className="flex flex-col gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={`skeleton-${String(i)}`}
                    style={{
                      height: "120px",
                      borderRadius: "10px",
                      backgroundColor: "var(--color-bg-tertiary)",
                      animation: "pulse 1.5s ease-in-out infinite",
                    }}
                  />
                ))}
              </div>
            ) : highlights.length === 0 ? (
              // 空状態
              <div
                className="flex flex-col items-center justify-center h-full gap-3"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ opacity: 0.4 }}
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                <p className="text-sm text-center">
                  テキストを選択して
                  <br />
                  ハイライトを追加しましょう
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {highlights.map((highlight) => (
                  <HighlightCard
                    key={highlight.id}
                    highlight={highlight}
                    isSelected={selectedHighlightIds.has(highlight.id)}
                    isSavingComment={savingCommentIds.has(highlight.id)}
                    isScrolledTo={scrolledToHighlightId === highlight.id}
                    onScrollToPdf={onScrollToPdf}
                    onUpdateComment={onUpdateComment}
                    onDelete={onDelete}
                    onToggleSelect={onToggleSelect}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 下部: ノート変換ボタン */}
          {selectedCount > 0 && (
            <footer
              className="shrink-0 px-4 py-3"
              style={{
                borderTop: "1px solid var(--color-border-primary)",
                backgroundColor: "var(--color-bg-secondary)",
              }}
            >
              <button
                type="button"
                onClick={() => void handleCreateNote()}
                className="flex items-center justify-center gap-2 w-full text-sm font-medium"
                style={{
                  height: "36px",
                  borderRadius: "10px",
                  backgroundColor: "var(--color-accent-primary)",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  transition: "opacity 150ms ease-out",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = "0.85";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = "1";
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
                選択ハイライトをノートに変換（{selectedCount}件）
              </button>
            </footer>
          )}
        </>
      ) : (
        /* コーディングパネル */
        <div className="flex-1 overflow-y-auto">
          <Suspense
            fallback={
              <div
                className="flex items-center justify-center h-32"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                <span className="text-sm">読み込み中…</span>
              </div>
            }
          >
            <CodePanel
              highlights={highlights}
              selectedHighlightIds={selectedHighlightIds}
              paperId={paperId}
            />
          </Suspense>
        </div>
      )}
    </aside>
  );
};
