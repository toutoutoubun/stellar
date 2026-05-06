// src/components/qualitative/IcrCalculator.tsx
// インターコーダー信頼性（ICR）計算 — JSONインポート + Cohen's κ バッジ

import React, { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ImportedCoding, IcrResult } from '../../types';

interface IcrCalculatorProps {
  projectId: string;
}

const IcrCalculator: React.FC<IcrCalculatorProps> = ({ projectId }) => {
  const [jsonInput, setJsonInput] = useState('');
  const [result, setResult] = useState<IcrResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setJsonInput(text);
    };
    reader.readAsText(file);
  }, []);

  const handleCalculate = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      let imported: ImportedCoding[];
      try {
        imported = JSON.parse(jsonInput);
        if (!Array.isArray(imported)) throw new Error('配列ではありません');
      } catch {
        setError('JSONの形式が不正です。[{ "highlightId": "...", "codeIds": ["..."] }] の配列を入力してください。');
        setLoading(false);
        return;
      }

      const data = await invoke<IcrResult>('calculate_icr', {
        projectId,
        importedCodings: imported,
      });
      setResult(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [projectId, jsonInput]);

  // κ値のバッジカラー
  const getKappaBadge = (kappa: number): { label: string; color: string; bg: string } => {
    if (kappa >= 0.81) return { label: '非常に良い', color: '#065F46', bg: '#D1FAE5' };
    if (kappa >= 0.61) return { label: '良い', color: '#1E40AF', bg: '#DBEAFE' };
    if (kappa >= 0.41) return { label: '中程度', color: '#92400E', bg: '#FEF3C7' };
    if (kappa >= 0.21) return { label: 'やや低い', color: '#9A3412', bg: '#FED7AA' };
    return { label: '低い', color: '#991B1B', bg: '#FEE2E2' };
  };

  return (
    <div className="icr-calculator">
      <h3 className="text-sm font-semibold mb-3">インターコーダー信頼性 (ICR)</h3>

      <div className="icr-description">
        <p className="text-xs text-secondary mb-2">
          第2コーダーのコーディング結果をJSON形式でインポートし、Cohen's κ（カッパ）を計算します。
        </p>
        <p className="text-xs text-secondary mb-3">
          形式: <code>[{`{"highlightId": "...", "codeIds": ["id1", "id2"]}`}]</code>
        </p>
      </div>

      {/* ファイルインポート */}
      <div className="icr-import">
        <label className="btn-ghost text-xs cursor-pointer inline-flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v8M3 5l4-4 4 4M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          JSONファイルを選択
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileImport}
          />
        </label>
      </div>

      {/* JSON入力 */}
      <textarea
        className="input-field text-xs font-mono mt-2"
        rows={8}
        placeholder='[{"highlightId": "...", "codeIds": ["..."]}]'
        value={jsonInput}
        onChange={(e) => setJsonInput(e.target.value)}
      />

      <button
        className="btn-primary text-xs mt-2"
        onClick={handleCalculate}
        disabled={loading || !jsonInput.trim()}
      >
        {loading ? '計算中...' : 'κ を計算'}
      </button>

      {error && (
        <div className="icr-error mt-2">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {/* 結果表示 */}
      {result && (
        <div className="icr-result mt-4">
          <div className="icr-result-header">
            <div className="icr-kappa-display">
              <span className="text-2xl font-bold">
                κ = {result.cohenKappa.toFixed(3)}
              </span>
              {(() => {
                const badge = getKappaBadge(result.cohenKappa);
                return (
                  <span
                    className="icr-kappa-badge"
                    style={{ color: badge.color, backgroundColor: badge.bg }}
                  >
                    {badge.label}
                  </span>
                );
              })()}
            </div>
          </div>

          <div className="icr-stats mt-3">
            <div className="icr-stat-item">
              <span className="text-xs text-secondary">観測一致率 (Po)</span>
              <span className="text-sm font-semibold">
                {(result.percentAgreement * 100).toFixed(1)}%
              </span>
            </div>
            <div className="icr-stat-item">
              <span className="text-xs text-secondary">総セグメント数</span>
              <span className="text-sm font-semibold">{result.totalSegments}</span>
            </div>
            <div className="icr-stat-item">
              <span className="text-xs text-secondary">一致数</span>
              <span className="text-sm font-semibold">{result.agreements}</span>
            </div>
            <div className="icr-stat-item">
              <span className="text-xs text-secondary">不一致数</span>
              <span className="text-sm font-semibold">{result.disagreements.length}</span>
            </div>
          </div>

          {/* 不一致の詳細 */}
          {result.disagreements.length > 0 && (
            <div className="icr-disagreements mt-4">
              <h4 className="text-xs font-semibold mb-2">不一致の詳細</h4>
              <div className="icr-disagreement-list">
                {result.disagreements.slice(0, 20).map((d, i) => (
                  <div key={i} className="icr-disagreement-item">
                    <span className="text-xs font-mono text-secondary">
                      {d.highlightId.slice(0, 8)}...
                    </span>
                    <div className="flex gap-2 text-xs">
                      <span>メイン: [{d.mainCodes.length}]</span>
                      <span>インポート: [{d.importedCodes.length}]</span>
                    </div>
                  </div>
                ))}
                {result.disagreements.length > 20 && (
                  <p className="text-xs text-secondary mt-1">
                    他 {result.disagreements.length - 20} 件...
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 計算式の説明 */}
          <div className="icr-formula mt-4 p-3 rounded bg-surface-secondary">
            <h4 className="text-xs font-semibold mb-1">計算式</h4>
            <p className="text-xs text-secondary font-mono">
              Po = 一致数 / 総セグメント数 = {result.agreements} / {result.totalSegments} = {result.percentAgreement.toFixed(4)}
            </p>
            <p className="text-xs text-secondary font-mono mt-1">
              κ = (Po - Pe) / (1 - Pe) = {result.cohenKappa.toFixed(4)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default IcrCalculator;
