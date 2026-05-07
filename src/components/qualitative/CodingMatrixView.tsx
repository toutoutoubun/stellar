// src/components/qualitative/CodingMatrixView.tsx
// コーディングマトリクス — コード×論文のクロス集計表
// ミニマルUI / カスタムアイコン / ヘルプ付き

import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "../../lib/tauriShim";
import type { CodingMatrix } from "../../types";
import { HelpTooltip } from "./HelpTooltip";
import { IconRefresh, IconMatrix } from "./icons/QualIcons";
import { useT } from "../../stores/useI18nStore";

interface CodingMatrixViewProps {
  projectId: string;
}

export const CodingMatrixView: React.FC<CodingMatrixViewProps> = ({
  projectId,
}) => {
  const t = useT();
  const [matrix, setMatrix] = useState<CodingMatrix | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMatrix = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke<CodingMatrix>("get_coding_matrix", {
        projectId,
      });
      setMatrix(result);
    } catch (err) {
      console.error(t.qualitative.k_1375ii, err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadMatrix();
  }, [loadMatrix]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        <span className="text-sm">読み込み中...</span>
      </div>
    );
  }

  if (!matrix || (matrix.rows.length === 0 && matrix.cols.length === 0)) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full gap-3"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        <IconMatrix size={28} />
        <span className="text-sm">
          マトリクスデータなし。コードとハイライトを追加してください。
        </span>
      </div>
    );
  }

  const getCount = (codeId: string, paperId: string): number => {
    const key = `${codeId}:${paperId}`;
    return matrix.cells[key] ?? 0;
  };

  const maxCount = Math.max(
    1,
    ...Object.values(matrix.cells).map((v) => (typeof v === "number" ? v : 0))
  );

  return (
    <div className="p-4 overflow-auto h-full">
      <HelpTooltip
        storageKey="qual_matrix"
        title={t.qualitative.k_kzkkwk}
        paragraphs={[
          t.qualitative.k_4hffby,
          t.qualitative.k_ljwbuo,
        ]}
        steps={[
          t.qualitative.k_izwtz2,
          t.qualitative.k_z53boi,
          t.qualitative.k_bm792r,
        ]}
      />

      <div className="flex items-center justify-between mb-4">
        <h3
          className="text-sm font-semibold"
          style={{ color: "var(--color-text-primary)" }}
        >
          コーディングマトリクス
        </h3>
        <button
          type="button"
          onClick={() => void loadMatrix()}
          className="text-xs px-2 py-1 inline-flex items-center gap-1"
          style={{
            backgroundColor: "var(--color-bg-tertiary)",
            color: "var(--color-text-secondary)",
            border: "1px solid var(--color-border-secondary)",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          <IconRefresh size={11} />
          更新
        </button>
      </div>

      <div className="overflow-auto">
        <table
          style={{
            borderCollapse: "collapse",
            fontSize: "12px",
            minWidth: "100%",
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  padding: "8px 12px",
                  textAlign: "left",
                  borderBottom: "2px solid var(--color-border-primary)",
                  color: "var(--color-text-tertiary)",
                  fontWeight: 600,
                  position: "sticky",
                  left: 0,
                  backgroundColor: "var(--color-bg-primary)",
                  zIndex: 1,
                }}
              >
                コード
              </th>
              {matrix.cols.map((col) => (
                <th
                  key={col.paperId}
                  style={{
                    padding: "8px 12px",
                    textAlign: "center",
                    borderBottom: "2px solid var(--color-border-primary)",
                    color: "var(--color-text-tertiary)",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    maxWidth: "120px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={col.paperTitle}
                >
                  {col.paperTitle.length > 15
                    ? col.paperTitle.slice(0, 15) + "..."
                    : col.paperTitle}
                </th>
              ))}
              <th
                style={{
                  padding: "8px 12px",
                  textAlign: "center",
                  borderBottom: "2px solid var(--color-border-primary)",
                  color: "var(--color-text-tertiary)",
                  fontWeight: 600,
                }}
              >
                合計
              </th>
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => {
              const rowTotal = matrix.cols.reduce(
                (sum, col) => sum + getCount(row.codeId, col.paperId),
                0
              );
              return (
                <tr key={row.codeId}>
                  <td
                    style={{
                      padding: "6px 12px",
                      borderBottom: "1px solid var(--color-border-secondary)",
                      color: "var(--color-text-primary)",
                      position: "sticky",
                      left: 0,
                      backgroundColor: "var(--color-bg-primary)",
                      zIndex: 1,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          backgroundColor: row.codeColor,
                          display: "inline-block",
                          flexShrink: 0,
                        }}
                      />
                      <span className="truncate" style={{ maxWidth: "120px" }}>
                        {row.codeName}
                      </span>
                    </div>
                  </td>
                  {matrix.cols.map((col) => {
                    const count = getCount(row.codeId, col.paperId);
                    const intensity = count > 0 ? 0.15 + (count / maxCount) * 0.55 : 0;
                    return (
                      <td
                        key={col.paperId}
                        style={{
                          padding: "6px 12px",
                          textAlign: "center",
                          borderBottom: "1px solid var(--color-border-secondary)",
                          color: count > 0 ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                          backgroundColor: count > 0 ? `${row.codeColor}${Math.round(intensity * 255).toString(16).padStart(2, "0")}` : "transparent",
                          fontWeight: count > 0 ? 600 : 400,
                        }}
                      >
                        {count || "-"}
                      </td>
                    );
                  })}
                  <td
                    style={{
                      padding: "6px 12px",
                      textAlign: "center",
                      borderBottom: "1px solid var(--color-border-secondary)",
                      color: "var(--color-text-primary)",
                      fontWeight: 600,
                    }}
                  >
                    {rowTotal}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
