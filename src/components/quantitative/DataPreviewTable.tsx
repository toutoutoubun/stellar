// src/components/quantitative/DataPreviewTable.tsx
// Stellar — データプレビューテーブル
// @tanstack/react-virtual による仮想化スクロール
// ソート・検索・ページネーション・CSV エクスポート

import type React from "react";
import { useState, useCallback, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useQuantitativeStore } from "../../stores/useQuantitativeStore";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { toast } from "../ui/Toast";
import type { Variable, SortDirection } from "../../types";
import { useT } from "../../stores/useI18nStore";

// ── 変数タイプ別スタイル ──
const NOMINAL_COLORS = [
  { bg: "rgba(66, 133, 244, 0.12)", text: "#4285f4" },
  { bg: "rgba(52, 168, 83, 0.12)", text: "#34a853" },
  { bg: "rgba(160, 140, 255, 0.12)", text: "#a08cff" },
  { bg: "rgba(251, 140, 0, 0.12)", text: "#fb8c00" },
  { bg: "rgba(234, 67, 149, 0.12)", text: "#ea4395" },
  { bg: "rgba(86, 201, 138, 0.12)", text: "#56c98a" },
  { bg: "rgba(100, 160, 255, 0.12)", text: "#64a0ff" },
  { bg: "rgba(240, 192, 64, 0.12)", text: "#d4a843" },
];

/** カテゴリ値ごとのカラーインデックスを取得 */
function getNominalColorIndex(value: string): number {

  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % NOMINAL_COLORS.length;
}

// ── 定数 ──
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 40;
const COL_MIN_WIDTH = 120;
const ROW_NUM_WIDTH = 56;

export const DataPreviewTable: React.FC = () => {
  const t = useT();
  const variables = useQuantitativeStore((s) => s.variables);
  const dataRows = useQuantitativeStore((s) => s.dataRows);
  const selectedDataset = useQuantitativeStore((s) => s.selectedDataset);
  const previewPage = useQuantitativeStore((s) => s.previewPage);
  const previewPageSize = useQuantitativeStore((s) => s.previewPageSize);
  const loadDataRows = useQuantitativeStore((s) => s.loadDataRows);
  const isLoading = useQuantitativeStore((s) => s.isLoading);

  // ソート状態
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

  // 検索
  const [searchQuery, setSearchQuery] = useState("");

  // 仮想化コンテナ
  const parentRef = useRef<HTMLDivElement>(null);

  // ── 変数マップ（name → Variable） ──
  const variableMap = useMemo(() => {
    const map = new Map<string, Variable>();
    for (const v of variables) {
      map.set(v.name, v);
    }
    return map;
  }, [variables]);

  // ── フィルタリング ──
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return dataRows;
    const q = searchQuery.toLowerCase();
    return dataRows.filter((row) =>
      Object.values(row.values).some((val) => {
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(q);
      }),
    );
  }, [dataRows, searchQuery]);

  // ── ソート ──
  const sortedRows = useMemo(() => {
    if (!sortKey) return filteredRows;
    const sorted = [...filteredRows];
    sorted.sort((a, b) => {
      const aVal = a.values[sortKey];
      const bVal = b.values[sortKey];

      // null は最後
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const variable = variableMap.get(sortKey);
      if (
        variable?.variableType === "scale" ||
        variable?.variableType === "ordinal"
      ) {
        const aNum = Number(aVal);
        const bNum = Number(bVal);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortDir === "asc" ? aNum - bNum : bNum - aNum;
        }
      }

      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDir === "asc"
        ? aStr.localeCompare(bStr, "ja")
        : bStr.localeCompare(aStr, "ja");
    });
    return sorted;
  }, [filteredRows, sortKey, sortDir, variableMap]);

  // ── 仮想化 ──
  const virtualizer = useVirtualizer({
    count: sortedRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  // ── ページネーション ──
  const totalRows = selectedDataset?.rowCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / previewPageSize));

  const handlePrevPage = useCallback(() => {
    if (previewPage > 0) {
      void loadDataRows((previewPage - 1) * previewPageSize);
    }
  }, [previewPage, previewPageSize, loadDataRows]);

  const handleNextPage = useCallback(() => {
    if (previewPage < totalPages - 1) {
      void loadDataRows((previewPage + 1) * previewPageSize);
    }
  }, [previewPage, previewPageSize, totalPages, loadDataRows]);

  // ── ソートハンドラー ──
  const handleSort = useCallback(
    (colName: string) => {
      if (sortKey === colName) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(colName);
        setSortDir("asc");
      }
    },
    [sortKey],
  );

  // ── CSV エクスポート ──
  const handleExport = useCallback(() => {
    if (variables.length === 0 || dataRows.length === 0) return;

    const headers = variables.map((v) => v.name);
    const csvLines = [
      headers.join(","),
      ...dataRows.map((row) =>
        headers
          .map((h) => {
            const val = row.values[h];
            if (val === null || val === undefined) return "";
            const str = String(val);
            // カンマや改行を含む場合はクオート
            if (str.includes(",") || str.includes("\n") || str.includes('"')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(","),
      ),
    ];

    const blob = new Blob([csvLines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedDataset?.name ?? "data"}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(t.quantitative.k_iw2q5n);
  }, [variables, dataRows, selectedDataset]);

  // ── 空状態 ──
  if (!selectedDataset) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        <p className="text-sm">データセットを選択してください</p>
      </div>
    );
  }

  if (variables.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full gap-4"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.35 }}
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
        <p className="text-sm">
          データをインポートするとプレビューが表示されます
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── ツールバー ── */}
      <div
        className="shrink-0 flex items-center justify-between gap-3 px-4 py-2"
        style={{
          borderBottom: "1px solid var(--color-border-secondary)",
        }}
      >
        {/* 検索 */}
        <div style={{ width: "260px" }}>
          <Input
            placeholder={t.quantitative.k_src012}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            fullWidth
            icon={
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
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            }
          />
        </div>

        <div className="flex items-center gap-3">
          {/* 行数表示 */}
          <span
            className="text-xs"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {searchQuery
              ? t.quantitative.k_rgcwb4
              : t.quantitative.k_dc6a3h}
          </span>

          {/* エクスポートボタン */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExport}
            icon={
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
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            }
          >
            CSV出力
          </Button>
        </div>
      </div>

      {/* ── テーブル本体（仮想化スクロール） ── */}
      <div className="flex-1 overflow-hidden">
        {/* ヘッダー（固定） */}
        <div
          className="flex"
          style={{
            height: `${HEADER_HEIGHT}px`,
            backgroundColor: "var(--color-bg-tertiary)",
            borderBottom: "1px solid var(--color-border-primary)",
          }}
        >
          {/* 行番号ヘッダー */}
          <div
            className="shrink-0 flex items-center justify-center text-[11px] font-medium"
            style={{
              width: `${ROW_NUM_WIDTH}px`,
              color: "var(--color-text-tertiary)",
              borderRight: "1px solid var(--color-border-secondary)",
            }}
          >
            #
          </div>

          {/* カラムヘッダー */}
          <div className="flex-1 flex overflow-x-auto">
            {variables.map((v) => {
              const isSorted = sortKey === v.name;
              return (
                <button
                  key={v.id}
                  onClick={() => handleSort(v.name)}
                  className="shrink-0 flex items-center gap-1.5 px-3 text-[11px] font-semibold text-left select-none"
                  style={{
                    minWidth: `${COL_MIN_WIDTH}px`,
                    flex: "1 0 auto",
                    color: isSorted
                      ? "var(--color-accent-primary)"
                      : "var(--color-text-primary)",
                    transition: "color var(--transition-fast)",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSorted) {
                      e.currentTarget.style.color =
                        "var(--color-text-primary)";
                      e.currentTarget.style.backgroundColor =
                        "var(--color-bg-hover)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSorted) {
                      e.currentTarget.style.color =
                        "var(--color-text-primary)";
                      e.currentTarget.style.backgroundColor = "transparent";
                    }
                  }}
                >
                  <span className="truncate">
                    {v.label ?? v.name}
                  </span>
                  {/* ソートインジケーター */}
                  {isSorted && (
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      style={{
                        transform:
                          sortDir === "desc" ? "rotate(180deg)" : "none",
                        transition: "transform var(--transition-fast)",
                      }}
                    >
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 仮想化データ行 */}
        <div
          ref={parentRef}
          className="overflow-auto"
          style={{
            height: `calc(100% - ${HEADER_HEIGHT}px)`,
          }}
        >
          {isLoading ? (
            <div
              className="flex items-center justify-center py-16"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              <div className="flex items-center gap-2">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ animation: "spin 1s linear infinite" }}
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                <span className="text-sm">{t.layout.loading}</span>
              </div>
            </div>
          ) : sortedRows.length === 0 ? (
            <div
              className="flex items-center justify-center py-16"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              <p className="text-sm">
                {searchQuery
                  ? t.quantitative.k_xmvrey
                  : t.quantitative.k_pk1rf0}
              </p>
            </div>
          ) : (
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const row = sortedRows[virtualRow.index];
                if (!row) return null;
                return (
                  <div
                    key={row.id}
                    className="absolute flex w-full"
                    style={{
                      height: `${ROW_HEIGHT}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                      borderBottom:
                        "1px solid var(--color-border-secondary)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "var(--color-bg-hover)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    {/* 行番号 */}
                    <div
                      className="shrink-0 flex items-center justify-center text-[10px] font-mono"
                      style={{
                        width: `${ROW_NUM_WIDTH}px`,
                        color: "var(--color-text-disabled)",
                        borderRight:
                          "1px solid var(--color-border-secondary)",
                      }}
                    >
                      {row.rowIndex + 1}
                    </div>

                    {/* セル */}
                    <div className="flex-1 flex overflow-x-auto">
                      {variables.map((v) => {
                        const val = row.values[v.name];
                        return (
                          <DataCell
                            key={v.id}
                            value={val}
                            variable={v}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── ページネーション ── */}
      {totalPages > 1 && (
        <div
          className="shrink-0 flex items-center justify-center gap-3 py-2"
          style={{
            borderTop: "1px solid var(--color-border-secondary)",
            backgroundColor: "var(--color-bg-secondary)",
          }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrevPage}
            disabled={previewPage <= 0 || isLoading}
          >
            ← 前へ
          </Button>
          <span
            className="text-xs font-medium"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {previewPage + 1} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNextPage}
            disabled={previewPage >= totalPages - 1 || isLoading}
          >
            次へ →
          </Button>
        </div>
      )}
    </div>
  );
};

// ============================================================
// DataCell コンポーネント
// ============================================================

const DataCell: React.FC<{
  value: string | number | null | undefined;
  variable: Variable;
}> = ({ value, variable }) => {
  const isNull = value === null || value === undefined;
  const isScale =
    variable.variableType === "scale" ||
    variable.variableType === "ordinal";
  const isNominal = variable.variableType === "nominal";

  if (isNull) {
    return (
      <div
        className="shrink-0 flex items-center px-3 text-xs"
        style={{
          minWidth: `${COL_MIN_WIDTH}px`,
          flex: "1 0 auto",
          color: "var(--color-text-disabled)",
        }}
      >
        —
      </div>
    );
  }

  const strValue = String(value);

  // カテゴリ変数: カラーバッジ
  if (isNominal && strValue) {
    const colorIdx = getNominalColorIndex(strValue);
    const color = NOMINAL_COLORS[colorIdx]!;
    return (
      <div
        className="shrink-0 flex items-center px-3"
        style={{
          minWidth: `${COL_MIN_WIDTH}px`,
          flex: "1 0 auto",
        }}
      >
        <span
          className="inline-block px-2 py-0.5 text-[11px] font-medium truncate"
          style={{
            backgroundColor: color.bg,
            color: color.text,
            borderRadius: "var(--radius-tag)",
            maxWidth: "100%",
          }}
        >
          {strValue}
        </span>
      </div>
    );
  }

  // スケール変数: 右寄せ・モノスペース
  return (
    <div
      className="shrink-0 flex items-center px-3 text-xs selectable"
      data-selectable="true"
      style={{
        minWidth: `${COL_MIN_WIDTH}px`,
        flex: "1 0 auto",
        color: "var(--color-text-primary)",
        textAlign: isScale ? "right" : "left",
        justifyContent: isScale ? "flex-end" : "flex-start",
        fontFamily: isScale ? "var(--font-family-mono)" : "inherit",
      }}
    >
      <span className="truncate">{strValue}</span>
    </div>
  );
};
