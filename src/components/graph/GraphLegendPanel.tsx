// src/components/graph/GraphLegendPanel.tsx
// Stellar — グラフ凡例パネル（左下浮遊カード）
// ノート（円）・論文（六角形）・リンク（線）の凡例 + 全体表示ボタン

import type React from "react";
import { useI18nStore } from "../../stores/useI18nStore";

interface GraphLegendPanelProps {
  /** 全体表示（zoomToFit）を実行 */
  onZoomToFit: () => void;
  /** ノード数 */
  nodeCount: number;
  /** リンク数 */
  linkCount: number;
}

export const GraphLegendPanel: React.FC<GraphLegendPanelProps> = ({
  onZoomToFit,
  nodeCount,
  linkCount,
}) => {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "12px",
        left: "12px",
        zIndex: 20,
      }}
    >
      <div
        style={{
          backgroundColor: "var(--color-bg-card)",
          border: "1px solid var(--color-border-primary)",
          borderRadius: "12px",
          boxShadow: "var(--shadow-card)",
          padding: "12px 16px",
          minWidth: "160px",
        }}
      >
        {/* 凡例アイテム */}
        <div className="flex flex-col gap-2 mb-3">
          {/* ノート */}
          <div className="flex items-center gap-2.5">
            <span
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: "var(--color-graph-node-note)",
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            <span
              className="text-xs"
              style={{ color: "var(--color-text-primary)" }}
            >
              {useI18nStore.getState().t.notes.title}
            </span>
          </div>

          {/* 論文 */}
          <div className="flex items-center gap-2.5">
            <span
              style={{
                width: "10px",
                height: "10px",
                backgroundColor: "var(--color-graph-node-paper)",
                display: "inline-block",
                flexShrink: 0,
                clipPath:
                  "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
              }}
            />
            <span
              className="text-xs"
              style={{ color: "var(--color-text-primary)" }}
            >
              {useI18nStore.getState().t.settings.data.papers}
            </span>
          </div>

          {/* リンク */}
          <div className="flex items-center gap-2.5">
            <span
              style={{
                width: "10px",
                height: "0",
                borderTop: "1.5px solid var(--color-graph-edge)",
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            <span
              className="text-xs"
              style={{ color: "var(--color-text-primary)" }}
            >
              リンク
            </span>
          </div>
        </div>

        {/* 説明 */}
        <div
          className="text-xs mb-3"
          style={{
            color: "var(--color-text-tertiary)",
            fontSize: "10px",
            lineHeight: "1.5",
          }}
        >
          ノードサイズはリンク数に比例
        </div>

        {/* 統計 */}
        <div
          className="flex items-center gap-3 mb-3 text-xs"
          style={{ color: "var(--color-text-tertiary)", fontSize: "10px" }}
        >
          <span>{nodeCount} {useI18nStore.getState().t.quantResults.str_7dy1n}</span>
          <span>·</span>
          <span>{useI18nStore.getState().t.graph.k_links_count.replace("${count}", String(linkCount))}</span>
        </div>

        {/* 全体表示ボタン */}
        <button
          type="button"
          onClick={onZoomToFit}
          className="flex items-center gap-1.5 w-full justify-center text-xs"
          style={{
            padding: "5px 10px",
            borderRadius: "8px",
            border: "1px solid var(--color-border-secondary)",
            color: "var(--color-text-secondary)",
            backgroundColor: "transparent",
            cursor: "pointer",
            transition: "all 150ms ease-out",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
            e.currentTarget.style.color = "var(--color-accent-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "var(--color-text-secondary)";
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
          全体表示
        </button>
      </div>
    </div>
  );
};
