// src/components/qualitative/ProcessTracingView.tsx
// プロセストレーシング — 仮説管理 + 証拠テスト + サマリー

import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  PtData,
  PtSummary,
  HypothesisWithEvidences,
  CreatePtHypothesisInput,
  CreatePtEvidenceInput,
} from "../../types";

interface ProcessTracingViewProps {
  projectId: string;
}

const TEST_TYPES = [
  { value: "hoop", label: "フープテスト", desc: "必要条件。通過しなければ仮説を棄却" },
  { value: "smoking_gun", label: "スモーキングガン", desc: "十分条件。通過すれば仮説を強く支持" },
  { value: "straw", label: "ストローインザウィンド", desc: "弱い証拠。方向性を示唆" },
  { value: "doubly_decisive", label: "決定的テスト", desc: "必要十分条件。仮説を確定または棄却" },
];

const RESULT_OPTIONS = [
  { value: "pending", label: "未実施", color: "#94a3b8" },
  { value: "pass", label: "通過", color: "#22c55e" },
  { value: "fail", label: "不通過", color: "#ef4444" },
  { value: "partial", label: "部分的", color: "#f59e0b" },
];

export const ProcessTracingView: React.FC<ProcessTracingViewProps> = ({
  projectId,
}) => {
  const [ptData, setPtData] = useState<PtData | null>(null);
  const [summary, setSummary] = useState<PtSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHypForm, setShowHypForm] = useState(false);
  const [addEvidenceFor, setAddEvidenceFor] = useState<string | null>(null);

  // 仮説フォーム
  const [hypTitle, setHypTitle] = useState("");
  const [hypDesc, setHypDesc] = useState("");
  const [hypIsMain, setHypIsMain] = useState(true);

  // 証拠フォーム
  const [evDesc, setEvDesc] = useState("");
  const [evTestType, setEvTestType] = useState("hoop");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [data, sum] = await Promise.all([
        invoke<PtData>("get_pt_data", { projectId }),
        invoke<PtSummary>("get_pt_summary", { projectId }),
      ]);
      setPtData(data);
      setSummary(sum);
    } catch (err) {
      console.error("PT取得エラー:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreateHypothesis = useCallback(async () => {
    if (!hypTitle.trim()) return;
    try {
      const input: CreatePtHypothesisInput = {
        projectId,
        title: hypTitle.trim(),
        description: hypDesc.trim() || undefined,
        isMain: hypIsMain,
      };
      await invoke("create_pt_hypothesis", { input });
      setHypTitle("");
      setHypDesc("");
      setShowHypForm(false);
      void loadData();
    } catch (err) {
      console.error("仮説作成エラー:", err);
    }
  }, [hypTitle, hypDesc, hypIsMain, projectId, loadData]);

  const handleDeleteHypothesis = useCallback(
    async (id: string) => {
      if (!confirm("この仮説と関連する証拠をすべて削除しますか？")) return;
      try {
        await invoke("delete_pt_hypothesis", { id });
        void loadData();
      } catch (err) {
        console.error("仮説削除エラー:", err);
      }
    },
    [loadData]
  );

  const handleAddEvidence = useCallback(
    async (hypothesisId: string) => {
      if (!evDesc.trim()) return;
      try {
        const input: CreatePtEvidenceInput = {
          hypothesisId,
          description: evDesc.trim(),
          testType: evTestType,
        };
        await invoke("add_pt_evidence", { input });
        setEvDesc("");
        setAddEvidenceFor(null);
        void loadData();
      } catch (err) {
        console.error("証拠追加エラー:", err);
      }
    },
    [evDesc, evTestType, loadData]
  );

  const handleUpdateResult = useCallback(
    async (evidenceId: string, result: string) => {
      try {
        await invoke("update_pt_evidence_result", { id: evidenceId, result });
        void loadData();
      } catch (err) {
        console.error("結果更新エラー:", err);
      }
    },
    [loadData]
  );

  const handleDeleteEvidence = useCallback(
    async (id: string) => {
      try {
        await invoke("delete_pt_evidence", { id });
        void loadData();
      } catch (err) {
        console.error("証拠削除エラー:", err);
      }
    },
    [loadData]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: "var(--color-text-tertiary)" }}>
        <span className="text-sm">読み込み中…</span>
      </div>
    );
  }

  return (
    <div className="p-4 h-full overflow-y-auto">
      {/* サマリー */}
      {summary && ptData && ptData.hypotheses.length > 0 && (
        <div
          className="mb-6 p-4"
          style={{
            backgroundColor: "var(--color-bg-secondary)",
            borderRadius: "10px",
            border: "1px solid var(--color-border-primary)",
          }}
        >
          <h4 className="text-sm font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>
            プロセストレーシング・サマリー
          </h4>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>フープテスト通過率</div>
              <div className="text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>
                {(summary.hoopPassRate * 100).toFixed(0)}%
              </div>
            </div>
            <div>
              <div className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>スモーキングガン</div>
              <div className="text-lg font-bold" style={{ color: summary.hasSmokingGun ? "#22c55e" : "#94a3b8" }}>
                {summary.hasSmokingGun ? "発見" : "未発見"}
              </div>
            </div>
            <div>
              <div className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>総合判定</div>
              <div className="text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>
                {summary.overallVerdict}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
          仮説 ({ptData?.hypotheses.length ?? 0})
        </h3>
        <button
          type="button"
          onClick={() => setShowHypForm(!showHypForm)}
          className="text-xs px-3 py-1"
          style={{ backgroundColor: "var(--color-accent-primary)", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}
        >
          + 仮説追加
        </button>
      </div>

      {/* 仮説フォーム */}
      {showHypForm && (
        <div className="mb-4 p-4" style={{ backgroundColor: "var(--color-bg-secondary)", borderRadius: "10px", border: "1px solid var(--color-border-primary)" }}>
          <input
            type="text"
            value={hypTitle}
            onChange={(e) => setHypTitle(e.target.value)}
            placeholder="仮説タイトル"
            className="w-full text-xs px-2 py-1.5 mb-2"
            style={{ backgroundColor: "var(--color-bg-primary)", color: "var(--color-text-primary)", border: "1px solid var(--color-border-primary)", borderRadius: "6px", outline: "none" }}
            onKeyDown={(e) => { if (e.key === "Enter") void handleCreateHypothesis(); }}
            autoFocus
          />
          <textarea
            value={hypDesc}
            onChange={(e) => setHypDesc(e.target.value)}
            placeholder="説明（任意）"
            rows={2}
            className="w-full text-xs px-2 py-1.5 mb-2"
            style={{ backgroundColor: "var(--color-bg-primary)", color: "var(--color-text-primary)", border: "1px solid var(--color-border-primary)", borderRadius: "6px", outline: "none", resize: "vertical" }}
          />
          <div className="flex items-center gap-3 mb-2">
            <label className="flex items-center gap-1 text-xs" style={{ color: "var(--color-text-secondary)" }}>
              <input type="checkbox" checked={hypIsMain} onChange={(e) => setHypIsMain(e.target.checked)} />
              主仮説
            </label>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void handleCreateHypothesis()} className="text-xs px-3 py-1" style={{ backgroundColor: "var(--color-accent-primary)", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>追加</button>
            <button type="button" onClick={() => setShowHypForm(false)} className="text-xs px-3 py-1" style={{ background: "transparent", color: "var(--color-text-secondary)", border: "1px solid var(--color-border-secondary)", borderRadius: "6px", cursor: "pointer" }}>キャンセル</button>
          </div>
        </div>
      )}

      {/* 仮説一覧 */}
      {(!ptData || ptData.hypotheses.length === 0) ? (
        <div className="text-center py-12 text-xs" style={{ color: "var(--color-text-tertiary)" }}>
          仮説なし。上のボタンで追加してください。
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {ptData.hypotheses.map((hyp: HypothesisWithEvidences) => (
            <div
              key={hyp.id}
              className="p-4"
              style={{
                backgroundColor: "var(--color-bg-secondary)",
                borderRadius: "10px",
                border: `1px solid ${hyp.isMain ? "var(--color-accent-primary)" : "var(--color-border-primary)"}`,
                borderLeft: hyp.isMain ? "3px solid var(--color-accent-primary)" : undefined,
              }}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                      {hyp.title}
                    </span>
                    {hyp.isMain && (
                      <span className="text-xs px-1.5 py-0.5" style={{ backgroundColor: "var(--color-accent-primary)20", color: "var(--color-accent-primary)", borderRadius: "999px", fontSize: "10px" }}>
                        主仮説
                      </span>
                    )}
                  </div>
                  {hyp.description && (
                    <p className="text-xs mt-1" style={{ color: "var(--color-text-secondary)" }}>{hyp.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setAddEvidenceFor(addEvidenceFor === hyp.id ? null : hyp.id)}
                    className="text-xs px-2 py-0.5"
                    style={{ color: "var(--color-accent-primary)", background: "none", border: "1px solid var(--color-accent-primary)", borderRadius: "4px", cursor: "pointer" }}
                  >
                    + 証拠
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteHypothesis(hyp.id)}
                    className="text-xs"
                    style={{ color: "var(--color-text-tertiary)", background: "none", border: "none", cursor: "pointer" }}
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* 証拠追加フォーム */}
              {addEvidenceFor === hyp.id && (
                <div className="mb-3 p-2" style={{ backgroundColor: "var(--color-bg-tertiary)", borderRadius: "6px" }}>
                  <input
                    type="text"
                    value={evDesc}
                    onChange={(e) => setEvDesc(e.target.value)}
                    placeholder="証拠の説明"
                    className="w-full text-xs px-2 py-1 mb-1"
                    style={{ backgroundColor: "var(--color-bg-primary)", color: "var(--color-text-primary)", border: "1px solid var(--color-border-primary)", borderRadius: "4px", outline: "none" }}
                    autoFocus
                  />
                  <select
                    value={evTestType}
                    onChange={(e) => setEvTestType(e.target.value)}
                    className="w-full text-xs px-2 py-1 mb-1"
                    style={{ backgroundColor: "var(--color-bg-primary)", color: "var(--color-text-primary)", border: "1px solid var(--color-border-primary)", borderRadius: "4px" }}
                  >
                    {TEST_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label} — {t.desc}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => void handleAddEvidence(hyp.id)} className="text-xs px-2 py-1" style={{ backgroundColor: "var(--color-accent-primary)", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}>
                    追加
                  </button>
                </div>
              )}

              {/* 証拠一覧 */}
              {hyp.evidences.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {hyp.evidences.map((ev) => {
                    const testInfo = TEST_TYPES.find((t) => t.value === ev.testType);
                    const resultInfo = RESULT_OPTIONS.find((r) => r.value === ev.result);
                    return (
                      <div
                        key={ev.id}
                        className="flex items-center gap-2 p-2 group"
                        style={{ backgroundColor: "var(--color-bg-tertiary)", borderRadius: "6px" }}
                      >
                        <span className="text-xs px-1.5 py-0.5" style={{ backgroundColor: "var(--color-bg-primary)", borderRadius: "4px", color: "var(--color-text-tertiary)", fontSize: "10px", whiteSpace: "nowrap" }}>
                          {testInfo?.label ?? ev.testType}
                        </span>
                        <span className="text-xs flex-1" style={{ color: "var(--color-text-primary)" }}>
                          {ev.description}
                        </span>
                        <select
                          value={ev.result}
                          onChange={(e) => void handleUpdateResult(ev.id, e.target.value)}
                          className="text-xs px-1 py-0.5 shrink-0"
                          style={{
                            backgroundColor: (resultInfo?.color ?? "#94a3b8") + "15",
                            color: resultInfo?.color ?? "#94a3b8",
                            border: `1px solid ${resultInfo?.color ?? "#94a3b8"}40`,
                            borderRadius: "4px",
                            fontSize: "10px",
                          }}
                        >
                          {RESULT_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                        <button type="button" onClick={() => void handleDeleteEvidence(ev.id)} className="text-xs opacity-0 group-hover:opacity-100" style={{ color: "var(--color-text-tertiary)", background: "none", border: "none", cursor: "pointer" }}>×</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
