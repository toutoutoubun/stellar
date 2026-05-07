// src/components/quantitative/DataStudioView.tsx
// Stellar — Data Studio メインビュー
// 2カラムレイアウト: 左=DatasetList / 右=タブ（インポート | 変数定義 | データプレビュー）

import type React from "react";
import { useEffect, useCallback } from "react";
import { useQuantitativeStore } from "../../stores/useQuantitativeStore";
import { DatasetList } from "./DatasetList";
import { CsvImporter } from "./CsvImporter";
import { VariableManager } from "./VariableManager";
import { DataPreviewTable } from "./DataPreviewTable";
import { AnalysisHubView } from "./AnalysisHubView";
import type { DataStudioTab } from "../../types";

// ── タブ定義 ──
const TABS: { key: DataStudioTab; label: string; icon: React.ReactNode }[] = [
  {
    key: "import",
    label: "インポート",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
  },
  {
    key: "variables",
    label: "変数定義",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    key: "preview",
    label: "データプレビュー",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="3" y1="15" x2="21" y2="15" />
        <line x1="9" y1="3" x2="9" y2="21" />
        <line x1="15" y1="3" x2="15" y2="21" />
      </svg>
    ),
  },
  {
    key: "analysis",
    label: "分析",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
        <line x1="2" y1="20" x2="22" y2="20" />
      </svg>
    ),
  },
];

const DataStudioView: React.FC = () => {
  const dataStudioTab = useQuantitativeStore((s) => s.dataStudioTab);
  const setTab = useQuantitativeStore((s) => s.setTab);
  const selectedDataset = useQuantitativeStore((s) => s.selectedDataset);
  const loadDatasets = useQuantitativeStore((s) => s.loadDatasets);

  // 初期読み込み
  useEffect(() => {
    void loadDatasets();
  }, [loadDatasets]);

  const handleTabChange = useCallback(
    (tab: DataStudioTab) => {
      setTab(tab);
    },
    [setTab],
  );

  // ── タブコンテンツ描画 ──
  const renderTabContent = () => {
    if (!selectedDataset) {
      return (
        <div
          className="flex flex-col items-center justify-center h-full gap-5 select-none"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          <svg
            width="56"
            height="56"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: 0.35 }}
          >
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          </svg>
          <div className="text-center">
            <p className="text-base font-medium" style={{ color: "var(--color-text-secondary)" }}>
              データセットを選択してください
            </p>
            <p className="text-sm mt-1">
              左パネルからデータセットを選択するか、新しいデータセットを作成してください
            </p>
          </div>
        </div>
      );
    }

    switch (dataStudioTab) {
      case "import":
        return <CsvImporter />;
      case "variables":
        return <VariableManager />;
      case "preview":
        return <DataPreviewTable />;
      case "analysis":
        return <AnalysisHubView />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── 左カラム: データセット一覧 ── */}
      <div
        className="shrink-0 h-full overflow-hidden flex flex-col"
        style={{
          width: "280px",
          borderRight: "1px solid var(--color-border-primary)",
          backgroundColor: "var(--color-bg-secondary)",
        }}
      >
        <DatasetList />
      </div>

      {/* ── 右カラム: タブ + コンテンツ ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* タブバー */}
        <div
          className="shrink-0 flex items-center gap-2 px-4"
          style={{
            height: "48px",
            borderBottom: "1px solid var(--color-border-primary)",
            backgroundColor: "var(--color-bg-secondary)",
          }}
        >
          {TABS.map((tab) => {
            const isActive = dataStudioTab === tab.key;
            const isDisabled = !selectedDataset && tab.key !== "import";
            return (
              <button
                key={tab.key}
                onClick={() => !isDisabled && handleTabChange(tab.key)}
                className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium relative select-none"
                style={{
                  color: isActive
                    ? "var(--color-accent-primary)"
                    : isDisabled
                      ? "var(--color-text-disabled)"
                      : "var(--color-text-secondary)",
                  borderRadius: "var(--radius-button)",
                  transition: "all var(--transition-fast)",
                  cursor: isDisabled ? "not-allowed" : "pointer",
                  opacity: isDisabled ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isDisabled && !isActive) {
                    e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
                disabled={isDisabled}
              >
                <span className="shrink-0">{tab.icon}</span>
                <span>{tab.label}</span>
                {/* アクティブインジケーター */}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-2 right-2"
                    style={{
                      height: "2px",
                      backgroundColor: "var(--color-accent-primary)",
                      borderRadius: "1px",
                    }}
                  />
                )}
              </button>
            );
          })}

          {/* 選択中データセット名 */}
          {selectedDataset && (
            <span
              className="ml-auto text-sm truncate max-w-48"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {selectedDataset.name}
            </span>
          )}
        </div>

        {/* タブコンテンツ */}
        <div className="flex-1 overflow-hidden">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default DataStudioView;
