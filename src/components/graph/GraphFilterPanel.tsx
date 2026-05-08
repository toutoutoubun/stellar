// src/components/graph/GraphFilterPanel.tsx
// Stellar — グラフフィルタパネル（右上浮遊カード）
// ノート/論文表示トグル、タグフィルタ、最小リンク数スライダー、リセット

import type React from "react";
import { useCallback } from "react";
import type { GraphFilters } from "../../types";
import { useI18nStore } from "../../stores/useI18nStore";

interface GraphFilterPanelProps {
  /** 現在のフィルタ設定 */
  filters: GraphFilters;
  /** フィルタ更新 */
  onFiltersChange: (filters: GraphFilters) => void;
  /** フィルタリセット */
  onReset: () => void;
  /** 全タグリスト */
  allTags: string[];
  /** 総ノード数（フィルタ前） */
  totalNodes: number;
  /** フィルタ後ノード数 */
  filteredNodes: number;
  /** パネル開閉状態 */
  isOpen: boolean;
  /** パネルトグル */
  onToggle: () => void;
}

export const GraphFilterPanel: React.FC<GraphFilterPanelProps> = ({
  filters,
  onFiltersChange,
  onReset,
  allTags,
  totalNodes,
  filteredNodes,
  isOpen,
  onToggle,
}) => {
  /** チェックボックス切り替え */
  const toggleShowNotes = useCallback(() => {
    onFiltersChange({ ...filters, showNotes: !filters.showNotes });
  }, [filters, onFiltersChange]);

  const toggleShowPapers = useCallback(() => {
    onFiltersChange({ ...filters, showPapers: !filters.showPapers });
  }, [filters, onFiltersChange]);

  /** タグ選択トグル */
  const toggleTag = useCallback(
    (tag: string) => {
      const current = new Set(filters.selectedTags);
      if (current.has(tag)) {
        current.delete(tag);
      } else {
        current.add(tag);
      }
      onFiltersChange({ ...filters, selectedTags: Array.from(current) });
    },
    [filters, onFiltersChange],
  );

  /** 最小リンク数変更 */
  const handleMinLinkChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFiltersChange({
        ...filters,
        minLinkCount: Number.parseInt(e.target.value, 10),
      });
    },
    [filters, onFiltersChange],
  );

  /** フィルタが初期状態かどうか */
  const isDefault =
    filters.showNotes &&
    filters.showPapers &&
    filters.selectedTags.length === 0 &&
    filters.minLinkCount === 0;

  return (
    <div
      style={{
        position: "absolute",
        top: "12px",
        right: "12px",
        zIndex: 20,
      }}
    >
      {/* トグルボタン */}
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5"
        style={{
          padding: "6px 12px",
          borderRadius: "10px",
          backgroundColor: "var(--color-bg-card)",
          border: "1px solid var(--color-border-primary)",
          boxShadow: "var(--shadow-card)",
          color: isOpen
            ? "var(--color-accent-primary)"
            : "var(--color-text-secondary)",
          fontSize: "12px",
          fontWeight: 500,
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
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        フィルタ
        {!isDefault && (
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "var(--color-accent-primary)",
            }}
          />
        )}
      </button>

      {/* パネル本体 */}
      {isOpen && (
        <div
          className="mt-2"
          style={{
            width: "260px",
            backgroundColor: "var(--color-bg-card)",
            border: "1px solid var(--color-border-primary)",
            borderRadius: "14px",
            boxShadow: "var(--shadow-dropdown)",
            padding: "16px",
            animation: "scale-in 150ms ease-out both",
          }}
        >
          {/* ノード数表示 */}
          <div
            className="text-xs mb-3"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            表示中: {filteredNodes} / {totalNodes} {useI18nStore.getState().t.quantResults.str_7dy1n}
          </div>

          {/* ── 表示タイプ ── */}
          <div className="mb-4">
            <div
              className="text-xs font-semibold mb-2 uppercase tracking-wider"
              style={{ color: "var(--color-text-secondary)" }}
            >
              表示
            </div>
            <label className="flex items-center gap-2 cursor-pointer mb-1.5">
              <input
                type="checkbox"
                checked={filters.showNotes}
                onChange={toggleShowNotes}
                style={{ accentColor: "var(--color-graph-node-note)" }}
              />
              <span
                className="flex items-center gap-1.5 text-xs"
                style={{ color: "var(--color-text-primary)" }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: "var(--color-graph-node-note)",
                    display: "inline-block",
                  }}
                />
                {useI18nStore.getState().t.notes.title}
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.showPapers}
                onChange={toggleShowPapers}
                style={{ accentColor: "var(--color-graph-node-paper)" }}
              />
              <span
                className="flex items-center gap-1.5 text-xs"
                style={{ color: "var(--color-text-primary)" }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "0",
                    backgroundColor: "var(--color-graph-node-paper)",
                    display: "inline-block",
                    clipPath:
                      "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                  }}
                />
                {useI18nStore.getState().t.settings.data.papers}
              </span>
            </label>
          </div>

          {/* ── タグフィルタ ── */}
          {allTags.length > 0 && (
            <div className="mb-4">
              <div
                className="text-xs font-semibold mb-2 uppercase tracking-wider"
                style={{ color: "var(--color-text-secondary)" }}
              >
                タグ
              </div>
              <div
                className="flex flex-wrap gap-1"
                style={{
                  maxHeight: "100px",
                  overflowY: "auto",
                }}
              >
                {allTags.map((tag) => {
                  const isSelected = filters.selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      style={{
                        fontSize: "10px",
                        padding: "2px 8px",
                        borderRadius: "999px",
                        border: isSelected
                          ? "1px solid var(--color-accent-primary)"
                          : "1px solid var(--color-border-secondary)",
                        backgroundColor: isSelected
                          ? "var(--color-accent-primary)"
                          : "var(--color-bg-tertiary)",
                        color: isSelected
                          ? "#fff"
                          : "var(--color-text-secondary)",
                        cursor: "pointer",
                        transition: "all 150ms ease-out",
                      }}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 最小リンク数 ── */}
          <div className="mb-4">
            <div
              className="text-xs font-semibold mb-2 uppercase tracking-wider flex items-center justify-between"
              style={{ color: "var(--color-text-secondary)" }}
            >
              <span>{useI18nStore.getState().t.graph.k_min_links}</span>
              <span
                className="font-mono"
                style={{
                  color: "var(--color-accent-primary)",
                  fontWeight: 600,
                }}
              >
                {filters.minLinkCount}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              value={filters.minLinkCount}
              onChange={handleMinLinkChange}
              className="w-full"
              style={{
                accentColor: "var(--color-accent-primary)",
                height: "4px",
              }}
            />
            <div
              className="flex justify-between text-xs mt-0.5"
              style={{ color: "var(--color-text-tertiary)", fontSize: "9px" }}
            >
              <span>0</span>
              <span>10</span>
            </div>
          </div>

          {/* ── リセットボタン ── */}
          <button
            type="button"
            onClick={onReset}
            disabled={isDefault}
            className="w-full text-xs py-1.5"
            style={{
              borderRadius: "8px",
              border: "1px solid var(--color-border-secondary)",
              color: isDefault
                ? "var(--color-text-disabled)"
                : "var(--color-text-secondary)",
              backgroundColor: "transparent",
              cursor: isDefault ? "default" : "pointer",
              transition: "all 150ms ease-out",
            }}
          >
            {useI18nStore.getState().t.graph.k_reset_filters}
          </button>
        </div>
      )}
    </div>
  );
};
