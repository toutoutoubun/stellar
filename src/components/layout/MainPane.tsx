// src/components/layout/MainPane.tsx
// Stellar — メインペイン
// サイドバーの選択に応じてコンテンツ領域を切り替える
// 空状態 / 論文 / ノート / グラフ / 検索 のルーティング

import type React from "react";
import { useUIStore } from "../../stores/useUIStore";

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

  // コンテンツタイプに応じた描画
  const renderContent = () => {
    switch (mainPaneContent.type) {
      case "paper":
        return (
          <div
            className="flex items-center justify-center h-full"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            <p className="text-sm">
              論文ビューア（ID: {mainPaneContent.paperId}）— 実装予定
            </p>
          </div>
        );
      case "note":
        return (
          <div
            className="flex items-center justify-center h-full"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            <p className="text-sm">
              ノートエディタ（ID: {mainPaneContent.noteId}）— 実装予定
            </p>
          </div>
        );
      case "graph":
        return (
          <div
            className="flex items-center justify-center h-full"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            <p className="text-sm">グラフビュー — 実装予定</p>
          </div>
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
