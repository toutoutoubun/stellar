// src/components/layout/ContextPanel.tsx
// Stellar — コンテキストパネル
// 論文のメタデータ・ハイライト一覧・関連ノート等を表示するサイドパネル
// メインペイン右側にスライドインで表示される

import type React from "react";
import { useUIStore } from "../../stores/useUIStore";
import { useT } from "../../stores/useI18nStore";

export const ContextPanel: React.FC = () => {
  const t = useT();
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
          {t.layout.k_detail_info}
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
          title={t.layout.str_tq8rjt}
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
          {t.layout.k_context_placeholder}
        </p>
        <p
          className="text-xs mt-2"
          style={{
            color: "var(--color-text-tertiary)",
            lineHeight: "var(--line-height-relaxed)",
          }}
        >
          {t.layout.k_context_paper}
          <br />
          {t.layout.k_context_note}
        </p>
      </div>
    </aside>
  );
};
