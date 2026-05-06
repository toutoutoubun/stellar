// src/components/qualitative/CodingMatrixView.tsx
// 動的HTMLテーブルによるコーディングマトリクス + CSVエクスポート

import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { CodingMatrix } from '../../types';

interface CodingMatrixViewProps {
  projectId: string;
}

const CodingMatrixView: React.FC<CodingMatrixViewProps> = ({ projectId }) => {
  const [matrix, setMatrix] = useState<CodingMatrix | null>(null);
  const [loading, setLoading] = useState(false);

  const loadMatrix = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoke<CodingMatrix>('get_coding_matrix', { projectId });
      setMatrix(data);
    } catch (e) {
      console.error('マトリクス取得に失敗:', e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadMatrix();
  }, [loadMatrix]);

  const handleExportCsv = () => {
    if (!matrix) return;
    const headers = ['コード', ...matrix.cols.map((c) => c.paperTitle)];
    const rows = matrix.rows.map((row) => {
      const vals = matrix.cols.map((col) => {
        const key = `${row.codeId}:${col.paperId}`;
        return matrix.cells[key]?.toString() ?? '0';
      });
      return [row.codeName, ...vals];
    });

    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'coding_matrix.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="qual-loading">マトリクスを読み込み中...</div>;
  }

  if (!matrix || matrix.rows.length === 0 || matrix.cols.length === 0) {
    return (
      <div className="qual-empty-state">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mx-auto mb-3 opacity-30">
          <rect x="4" y="4" width="40" height="40" rx="4" stroke="currentColor" strokeWidth="2" />
          <line x1="4" y1="16" x2="44" y2="16" stroke="currentColor" strokeWidth="1.5" />
          <line x1="16" y1="4" x2="16" y2="44" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <p className="text-sm text-secondary">
          コーディングマトリクスを表示するには、<br />
          ハイライトにコードを割り当ててください。
        </p>
      </div>
    );
  }

  // 最大値（ヒートマップ用）
  const maxCount = Math.max(
    ...Object.values(matrix.cells).map(Number),
    1
  );

  return (
    <div className="coding-matrix-view">
      <div className="coding-matrix-header">
        <h3 className="text-sm font-semibold">コーディングマトリクス</h3>
        <div className="flex gap-2">
          <button className="btn-ghost text-xs" onClick={loadMatrix}>
            更新
          </button>
          <button className="btn-ghost text-xs" onClick={handleExportCsv}>
            CSV出力
          </button>
        </div>
      </div>

      <div className="coding-matrix-scroll">
        <table className="coding-matrix-table">
          <thead>
            <tr>
              <th className="coding-matrix-corner">コード ＼ 文献</th>
              {matrix.cols.map((col) => (
                <th key={col.paperId} className="coding-matrix-col-header" title={col.paperTitle}>
                  <span className="coding-matrix-col-text">{col.paperTitle}</span>
                </th>
              ))}
              <th className="coding-matrix-total-header">合計</th>
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => {
              const rowTotal = matrix.cols.reduce((sum, col) => {
                const key = `${row.codeId}:${col.paperId}`;
                return sum + (matrix.cells[key] ?? 0);
              }, 0);

              return (
                <tr key={row.codeId}>
                  <td className="coding-matrix-row-header">
                    <span
                      className="code-color-dot-sm"
                      style={{ backgroundColor: row.codeColor }}
                    />
                    <span>{row.codeName}</span>
                  </td>
                  {matrix.cols.map((col) => {
                    const key = `${row.codeId}:${col.paperId}`;
                    const count = matrix.cells[key] ?? 0;
                    const intensity = count > 0 ? Math.min(count / maxCount, 1) : 0;

                    return (
                      <td
                        key={col.paperId}
                        className="coding-matrix-cell"
                        style={{
                          backgroundColor:
                            count > 0
                              ? `rgba(99, 102, 241, ${0.1 + intensity * 0.5})`
                              : undefined,
                        }}
                      >
                        {count > 0 ? count : ''}
                      </td>
                    );
                  })}
                  <td className="coding-matrix-total">{rowTotal}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="coding-matrix-footer-label">合計</td>
              {matrix.cols.map((col) => {
                const colTotal = matrix.rows.reduce((sum, row) => {
                  const key = `${row.codeId}:${col.paperId}`;
                  return sum + (matrix.cells[key] ?? 0);
                }, 0);
                return (
                  <td key={col.paperId} className="coding-matrix-total">
                    {colTotal}
                  </td>
                );
              })}
              <td className="coding-matrix-grand-total">
                {Object.values(matrix.cells).reduce((a, b) => a + b, 0)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default CodingMatrixView;
