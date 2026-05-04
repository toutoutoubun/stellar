// src/components/layout/ContextPanel.tsx
// Stellar — コンテキストパネル
// 論文のメタデータ・ハイライト一覧・関連ノート等を表示するサイドパネル
// メインペイン右側にスライドインで表示される

import type React from "react";
import { useUIStore } from "../../stores/useUIStore";

export const ContextPanel: React.FC = () => {
  const contextPanelOpen = useUIStore((s) => s.contextPanelOpen);
  const toggleContextPanel = useUIStore((s) => s.toggleContextPanel);

  if (!contextPanelOpen) {
    return null;
  }

  return (
    <aside
      className="shrink-0 overflow-y-auto animate-slide-in-right"
      style={{
        width: "var(--context-panel-width)",
        backgroundColor: "var(--color-bg-secondary)",
        borderLeft: "1px solid var(--color-border-secondary)",
      }}
    >
      {/* パネルヘッダー */}
      <div
        className="flex items-center justify-between px-4 py-3 sticky top-0"
        style={{
          backgroundColor: "var(--color-bg-secondary)",
          borderBottom: "1px solid var(--color-border-secondary)",
          zIndex: 1,
        }}
      >
        <h3
          className="text-sm font-semibold"
          style={{ color: "var(--color-text-primary)" }}
        >
          詳細情報
        </h3>
        <button
          onClick={toggleContextPanel}
          className="flex items-center justify-center w-6 h-6"
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
          title="パネルを閉じる"
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
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* パネルコンテンツ（プレースホルダー） */}
      <div className="p-4">
        <p
          className="text-sm"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          コンテキストパネル — 実装予定
        </p>
        <p
          className="text-xs mt-2"
          style={{
            color: "var(--color-text-tertiary)",
            lineHeight: "var(--line-height-relaxed)",
          }}
        >
          論文選択時: メタデータ・ハイライト・関連ノート
          <br />
          ノート選択時: リンク先一覧・タグ
        </p>
      </div>
    </aside>
  );
};
