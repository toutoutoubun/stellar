// src/components/qualitative/ProcessTracingView.tsx
// プロセストレーシング — 仮説と証拠の管理
// Rust backend: get_pt_data → PtData { hypotheses: HypothesisWithEvidences[] }
// create_pt_hypothesis(input), add_pt_evidence(input), update_pt_evidence_result(id, result)
// delete_pt_hypothesis(id), delete_pt_evidence(id), get_pt_summary

import type React from "react";
import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  PtData,
  HypothesisWithEvidences,
  PtEvidence,
  PtSummary,
  CreatePtHypothesisInput,
  CreatePtEvidenceInput,
} from "../../types";
import { toast } from "../ui/Toast";

interface ProcessTracingViewProps {
  projectId: string;
}

const EVIDENCE_TYPE_LABELS: Record<string, { label: string; desc: string }> = {
  straw_in_the_wind: { label: "Straw-in-the-wind", desc: "弱い確認 / 弱い否定" },
  hoop: { label: "Hoop", desc: "必要条件テスト（通過しなければ棄却）" },
  smoking_gun: { label: "Smoking gun", desc: "十分条件テスト（見つかれば確認）" },
  doubly_decisive: { label: "Doubly decisive", desc: "必要十分条件テスト" },
};

const RESULT_LABELS: Record<string, { label: string; color: string }> = {
  pass: { label: "通過", color: "#10b981" },
  fail: { label: "不通過", color: "#ef4444" },
  partial: { label: "部分的", color: "#f59e0b" },
  pending: { label: "保留", color: "#94a3b8" },
};

export const ProcessTracingView: React.FC<ProcessTracingViewProps> = ({ projectId }) => {
  const [ptData, setPtData] = useState<PtData | null>(null);
  const [summary, setSummary] = useState<PtSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedHyp, setExpandedHyp] = useState<string | null>(null);
  const [showHypForm, setShowHypForm] = useState(false);
  const [showEvForm, setShowEvForm] = useState<string | null>(null);

  // フォーム
  const [hypForm, setHypForm] = useState({ title: "", description: "", isMain: true });
  const [evForm, setEvForm] = useState({
    description: "",
    testType: "hoop" as string,
    result: "pending" as string,
  });

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [data, sum] = await Promise.all([
        invoke<PtData>("get_pt_data", { projectId }),
        invoke<PtSummary>("get_pt_summary", { projectId }),
      ]);
      setPtData(data);
      setSummary(sum);
    } catch (e) {
      console.error("Failed to load PT data:", e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreateHypothesis = useCallback(async () => {
    if (!projectId || !hypForm.title.trim()) {
      toast.error("仮説名を入力してください");
      return;
    }
    try {
      const input: CreatePtHypothesisInput = {
        projectId,
        title: hypForm.title.trim(),
        description: hypForm.description || null,
        isMain: hypForm.isMain,
      };
      await invoke("create_pt_hypothesis", { input });
      setHypForm({ title: "", description: "", isMain: true });
      setShowHypForm(false);
      toast.success("仮説を追加しました");
      await loadData();
    } catch (e) {
      toast.error("追加に失敗しました");
    }
  }, [projectId, hypForm, loadData]);

  const handleDeleteHypothesis = async (id: string) => {
    if (!confirm("この仮説と関連する証拠をすべて削除しますか？")) return;
    try {
      await invoke("delete_pt_hypothesis", { id });
      toast.success("削除しました");
      await loadData();
    } catch (e) {
      toast.error("削除に失敗しました");
    }
  };

  const handleCreateEvidence = useCallback(async (hypothesisId: string) => {
    if (!evForm.description.trim()) {
      toast.error("証拠の説明を入力してください");
      return;
    }
    try {
      const input: CreatePtEvidenceInput = {
        hypothesisId,
        description: evForm.description.trim(),
        testType: evForm.testType,
        result: evForm.result,
      };
      await invoke("add_pt_evidence", { input });
      setEvForm({ description: "", testType: "hoop", result: "pending" });
      setShowEvForm(null);
      toast.success("証拠を追加しました");
      await loadData();
    } catch (e) {
      toast.error("追加に失敗しました");
    }
  }, [evForm, loadData]);

  const handleUpdateEvidenceResult = async (id: string, result: string) => {
    try {
      await invoke("update_pt_evidence_result", { id, result });
      await loadData();
    } catch (e) {
      toast.error("結果更新に失敗しました");
    }
  };

  const handleDeleteEvidence = async (id: string) => {
    try {
      await invoke("delete_pt_evidence", { id });
      toast.success("証拠を削除しました");
      await loadData();
    } catch (e) {
      toast.error("削除に失敗しました");
    }
  };

  const inputStyle: React.CSSProperties = {
    backgroundColor: "var(--color-bg-tertiary)",
    color: "var(--color-text-primary)",
    border: "1px solid var(--color-border-secondary)",
    borderRadius: "6px",
    padding: "6px 10px",
    outline: "none",
    width: "100%",
    fontSize: "13px",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: "var(--color-text-tertiary)" }}>
        <p className="text-sm">読み込み中…</p>
      </div>
    );
  }

  const hypotheses = ptData?.hypotheses ?? [];

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="max-w-3xl mx-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
              プロセストレーシング
            </h3>
            <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
              仮説を立て、証拠の種類と評価を記録して因果メカニズムを検証
            </p>
          </div>
          <button
            onClick={() => setShowHypForm(!showHypForm)}
            className="text-xs px-3 py-1.5 flex items-center gap-1"
            style={{ backgroundColor: "var(--color-accent-primary)", color: "white", borderRadius: "6px", border: "none", cursor: "pointer" }}
          >
            + 仮説を追加
          </button>
        </div>

        {/* サマリー */}
        {summary && hypotheses.length > 0 && (
          <div
            className="mb-4 p-3 flex items-center gap-4"
            style={{
              backgroundColor: "var(--color-bg-secondary)",
              border: "1px solid var(--color-border-secondary)",
              borderRadius: "8px",
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>総合評価:</span>
              <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                {summary.overallVerdict}
              </span>
            </div>
            <div className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
              Hoop通過率: {(summary.hoopPassRate * 100).toFixed(0)}%
            </div>
            <div className="text-xs" style={{ color: summary.hasSmokingGun ? "#10b981" : "var(--color-text-tertiary)" }}>
              Smoking gun: {summary.hasSmokingGun ? "✓ あり" : "なし"}
            </div>
          </div>
        )}

        {/* 仮説追加フォーム */}
        {showHypForm && (
          <div className="p-4 mb-4" style={{ backgroundColor: "var(--color-bg-secondary)", border: "1px solid var(--color-border-secondary)", borderRadius: "10px" }}>
            <div className="flex flex-col gap-2">
              <input type="text" value={hypForm.title} onChange={(e) => setHypForm({ ...hypForm, title: e.target.value })} style={inputStyle} placeholder="仮説名 *" onKeyDown={(e) => e.key === "Enter" && handleCreateHypothesis()} />
              <textarea value={hypForm.description} onChange={(e) => setHypForm({ ...hypForm, description: e.target.value })} style={{ ...inputStyle, minHeight: "50px", resize: "vertical" }} placeholder="説明（任意）" />
              <label className="flex items-center gap-2 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                <input type="checkbox" checked={hypForm.isMain} onChange={(e) => setHypForm({ ...hypForm, isMain: e.target.checked })} />
                主仮説
              </label>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowHypForm(false)} className="text-xs px-3 py-1.5" style={{ color: "var(--color-text-secondary)", border: "1px solid var(--color-border-secondary)", borderRadius: "6px", background: "none", cursor: "pointer" }}>キャンセル</button>
                <button onClick={handleCreateHypothesis} className="text-xs px-4 py-1.5" style={{ backgroundColor: "var(--color-accent-primary)", color: "white", borderRadius: "6px", border: "none", cursor: "pointer" }}>追加</button>
              </div>
            </div>
          </div>
        )}

        {/* 仮説一覧 */}
        {hypotheses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12" style={{ color: "var(--color-text-tertiary)" }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ opacity: 0.4 }}>
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
            <p className="text-sm mt-2">仮説を追加してプロセストレーシングを始めましょう</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {hypotheses.map((hw: HypothesisWithEvidences) => {
              const evidences = hw.evidences ?? [];
              const isExpanded = expandedHyp === hw.id;
              const hypType = hw.isMain ? "主仮説" : "対抗仮説";

              return (
                <div
                  key={hw.id}
                  style={{
                    backgroundColor: "var(--color-bg-secondary)",
                    border: "1px solid var(--color-border-secondary)",
                    borderRadius: "10px",
                    overflow: "hidden",
                  }}
                >
                  {/* 仮説ヘッダー */}
                  <div
                    className="p-3 flex items-center gap-3 cursor-pointer"
                    onClick={() => setExpandedHyp(isExpanded ? null : hw.id)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      style={{ transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.15s", color: "var(--color-text-tertiary)", flexShrink: 0 }}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                          {hw.title}
                        </span>
                        <span className="text-xs px-2 py-0.5" style={{
                          backgroundColor: hw.isMain ? "rgba(99,102,241,0.15)" : "rgba(245,158,11,0.15)",
                          color: hw.isMain ? "#6366f1" : "#f59e0b",
                          borderRadius: "10px",
                        }}>
                          {hypType}
                        </span>
                        <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                          証拠: {evidences.length}件
                        </span>
                      </div>
                      {hw.description && (
                        <p className="text-xs mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                          {hw.description}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteHypothesis(hw.id); }}
                      className="text-xs"
                      style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}
                    >
                      削除
                    </button>
                  </div>

                  {/* 証拠一覧（展開時） */}
                  {isExpanded && (
                    <div style={{ borderTop: "1px solid var(--color-border-secondary)" }}>
                      {evidences.map((ev: PtEvidence) => {
                        const etInfo = EVIDENCE_TYPE_LABELS[ev.testType] ?? { label: ev.testType, desc: "" };
                        const resInfo = RESULT_LABELS[ev.result] ?? RESULT_LABELS.pending;
                        return (
                          <div
                            key={ev.id}
                            className="px-4 py-2 flex items-start gap-3 group"
                            style={{ borderBottom: "1px solid var(--color-border-secondary)" }}
                          >
                            <div
                              style={{
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                backgroundColor: resInfo.color,
                                marginTop: "4px",
                                flexShrink: 0,
                              }}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium" style={{ color: "var(--color-text-primary)" }}>
                                  {ev.description}
                                </span>
                                <span className="text-xs px-1.5 py-0.5" style={{
                                  backgroundColor: "var(--color-bg-tertiary)",
                                  color: "var(--color-text-secondary)",
                                  borderRadius: "4px",
                                  fontSize: "10px",
                                }}>
                                  {etInfo.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>結果:</span>
                                <select
                                  value={ev.result}
                                  onChange={(e) => handleUpdateEvidenceResult(ev.id, e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs"
                                  style={{
                                    backgroundColor: "var(--color-bg-tertiary)",
                                    color: resInfo.color,
                                    border: "1px solid var(--color-border-secondary)",
                                    borderRadius: "4px",
                                    padding: "1px 4px",
                                    outline: "none",
                                    fontWeight: 600,
                                  }}
                                >
                                  <option value="pending">保留</option>
                                  <option value="pass">通過</option>
                                  <option value="fail">不通過</option>
                                  <option value="partial">部分的</option>
                                </select>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteEvidence(ev.id)}
                              className="opacity-0 group-hover:opacity-100 text-xs"
                              style={{ color: "#ef4444", transition: "opacity 0.15s", background: "none", border: "none", cursor: "pointer" }}
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}

                      {/* 証拠追加 */}
                      {showEvForm === hw.id ? (
                        <div className="p-3 flex flex-col gap-2">
                          <input type="text" value={evForm.description} onChange={(e) => setEvForm({ ...evForm, description: e.target.value })} style={inputStyle} placeholder="証拠の説明 *" />
                          <div className="flex gap-2">
                            <select value={evForm.testType} onChange={(e) => setEvForm({ ...evForm, testType: e.target.value })} style={{ ...inputStyle, flex: 1 }}>
                              {Object.entries(EVIDENCE_TYPE_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v.label} — {v.desc}</option>
                              ))}
                            </select>
                            <select value={evForm.result} onChange={(e) => setEvForm({ ...evForm, result: e.target.value })} style={{ ...inputStyle, width: "100px" }}>
                              {Object.entries(RESULT_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => setShowEvForm(null)} className="text-xs px-3 py-1" style={{ color: "var(--color-text-secondary)", border: "1px solid var(--color-border-secondary)", borderRadius: "4px", background: "none", cursor: "pointer" }}>キャンセル</button>
                            <button onClick={() => handleCreateEvidence(hw.id)} className="text-xs px-3 py-1" style={{ backgroundColor: "var(--color-accent-primary)", color: "white", borderRadius: "4px", border: "none", cursor: "pointer" }}>追加</button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowEvForm(hw.id)}
                          className="w-full text-xs py-2 flex items-center justify-center gap-1"
                          style={{ color: "var(--color-accent-primary)", background: "none", border: "none", cursor: "pointer" }}
                        >
                          + 証拠を追加
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProcessTracingView;
