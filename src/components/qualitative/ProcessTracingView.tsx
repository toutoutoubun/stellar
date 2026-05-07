// src/components/qualitative/ProcessTracingView.tsx
// プロセストレーシング — 仮説管理 + 証拠テスト + サマリー
// ミニマルUI / カスタムアイコン / ヘルプ付き

import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "../../lib/tauriShim";
import { swalConfirm } from "../../lib/swal";
import type {
  PtData,
  PtSummary,
  HypothesisWithEvidences,
  CreatePtHypothesisInput,
  CreatePtEvidenceInput,
} from "../../types";
import { HelpTooltip } from "./HelpTooltip";
import { IconPlus, IconDelete, IconClose, IconProcessTracing } from "./icons/QualIcons";
import { useT, useI18nStore } from "../../stores/useI18nStore";

interface ProcessTracingViewProps {
  projectId: string;
}

const TEST_TYPES = [
  { value: "hoop", label: useI18nStore.getState().t.qualitative.k_84pxfp, desc: useI18nStore.getState().t.qualitative.k_qy2o4n },
  { value: "smoking_gun", label: useI18nStore.getState().t.qualitative.k_ye20bm, desc: useI18nStore.getState().t.qualitative.k_hxu62r },
  { value: "straw", label: useI18nStore.getState().t.qualitative.k_1vm6u4, desc: useI18nStore.getState().t.qualitative.k_je7x0m },
  { value: "doubly_decisive", label: useI18nStore.getState().t.qualitative.k_pt491t, desc: useI18nStore.getState().t.qualitative.k_nsauh6 },
];

const RESULT_OPTIONS = [
  { value: "pending", label: useI18nStore.getState().t.qualitative.k_fk4h4, color: "#94a3b8" },
  { value: "pass", label: useI18nStore.getState().t.qualitative.k_pawk, color: "#22c55e" },
  { value: "fail", label: useI18nStore.getState().t.qualitative.k_c4v29, color: "#ef4444" },
  { value: "partial", label: useI18nStore.getState().t.qualitative.k_lmoti, color: "#f59e0b" },
];

export const ProcessTracingView: React.FC<ProcessTracingViewProps> = ({
  projectId,
}) => {
  const t = useT();
  const [ptData, setPtData] = useState<PtData | null>(null);
  const [summary, setSummary] = useState<PtSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHypForm, setShowHypForm] = useState(false);
  const [addEvidenceFor, setAddEvidenceFor] = useState<string | null>(null);

  const [hypTitle, setHypTitle] = useState("");
  const [hypDesc, setHypDesc] = useState("");
  const [hypIsMain, setHypIsMain] = useState(true);

  const [evDesc, setEvDesc] = useState("");
  const [evTestType, setEvTestType] = useState("hoop");

  const loadData = useCallback(async () => {
    const t = useT();
    setLoading(true);
    try {
      const [data, sum] = await Promise.all([
        invoke<PtData>("get_pt_data", { projectId }),
        invoke<PtSummary>("get_pt_summary", { projectId }),
      ]);
      setPtData(data);
      setSummary(sum);
    } catch (err) {
      console.error(t.qualitative.k_gfgo1w, err);
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
      console.error(t.qualitative.k_i92jnz, err);
    }
  }, [hypTitle, hypDesc, hypIsMain, projectId, loadData]);

  const handleDeleteHypothesis = useCallback(
    async (id: string) => {
      const ok = await swalConfirm(t.qualitative.k_aj428o, t.qualitative.k_fd8s26);
      if (!ok) return;
      try {
        await invoke("delete_pt_hypothesis", { id });
        void loadData();
      } catch (err) {
        console.error(t.qualitative.k_qsij1l, err);
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
        console.error(t.qualitative.k_z8szae, err);
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
        console.error(t.qualitative.k_ozup4p, err);
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
        console.error(t.qualitative.k_46v5c3, err);
      }
    },
    [loadData]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: "var(--color-text-tertiary)" }}>
        <span className="text-sm">{t.common.loading}</span>
      </div>
    );
  }

  return (
    <div className="p-4 h-full overflow-y-auto">
      <HelpTooltip
        storageKey="qual_process_tracing"
        title={t.qualitative.k_3247oq}
        paragraphs={[
          t.qualitative.k_kaoh2k,
          t.qualitative.k_ew6l2u,
        ]}
        steps={[
          t.qualitative.k_13u2zy,
          t.qualitative.k_53m2o9,
          t.qualitative.k_qbn6uz,
        ]}
      />

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
            サマリー
          </h4>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>フープテスト通過率</div>
              <div className="text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>
                {(summary.hoopPassRate * 100).toFixed(0)}%
              </div>
            </div>
            <div>
              <div className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>{t.qualitative.k_ye20bm}</div>
              <div className="text-lg font-bold" style={{ color: summary.hasSmokingGun ? "#22c55e" : "#94a3b8" }}>
                {summary.hasSmokingGun ? t.qualitative.k_kwnl : t.qualitative.k_fovzv}
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
          className="text-xs px-3 py-1 inline-flex items-center gap-1"
          style={{ backgroundColor: "var(--color-accent-primary)", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}
        >
          <IconPlus size={10} />
          仮説追加
        </button>
      </div>

      {/* 仮説フォーム */}
      {showHypForm && (
        <div className="mb-4 p-4" style={{ backgroundColor: "var(--color-bg-secondary)", borderRadius: "10px", border: "1px solid var(--color-border-primary)" }}>
          <input
            type="text"
            value={hypTitle}
            onChange={(e) => setHypTitle(e.target.value)}
            placeholder={t.qualitative.k_t6h1ye}
            className="w-full text-xs px-2 py-1.5 mb-2"
            style={{ backgroundColor: "var(--color-bg-primary)", color: "var(--color-text-primary)", border: "1px solid var(--color-border-primary)", borderRadius: "6px", outline: "none" }}
            onKeyDown={(e) => { if (e.key === "Enter") void handleCreateHypothesis(); }}
            autoFocus
          />
          <textarea
            value={hypDesc}
            onChange={(e) => setHypDesc(e.target.value)}
            placeholder={t.qualitative.k_knmvip}
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
            <button type="button" onClick={() => setShowHypForm(false)} className="text-xs px-3 py-1 inline-flex items-center gap-1" style={{ background: "transparent", color: "var(--color-text-secondary)", border: "1px solid var(--color-border-secondary)", borderRadius: "6px", cursor: "pointer" }}>
              <IconClose size={10} />
              {t.common.cancel}
            </button>
          </div>
        </div>
      )}

      {/* 仮説一覧 */}
      {(!ptData || ptData.hypotheses.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3" style={{ color: "var(--color-text-tertiary)" }}>
          <IconProcessTracing size={28} />
          <span className="text-xs">仮説なし。上のボタンで追加してください。</span>
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
                    className="text-xs px-2 py-0.5 inline-flex items-center gap-0.5"
                    style={{ color: "var(--color-accent-primary)", background: "none", border: "1px solid var(--color-accent-primary)", borderRadius: "4px", cursor: "pointer" }}
                  >
                    <IconPlus size={9} />
                    証拠
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteHypothesis(hyp.id)}
                    title={t.common.delete}
                    style={{ color: "var(--color-text-tertiary)", background: "none", border: "none", cursor: "pointer", display: "flex", padding: "2px" }}
                  >
                    <IconDelete size={12} />
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
                    placeholder={t.qualitative.k_f2fb9w}
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
                      <option key={t.value} value={t.value}>{t.label} -- {t.desc}</option>
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
                        <button
                          type="button"
                          onClick={() => void handleDeleteEvidence(ev.id)}
                          className="opacity-0 group-hover:opacity-100"
                          title={t.common.delete}
                          style={{ color: "var(--color-text-tertiary)", background: "none", border: "none", cursor: "pointer", display: "flex", padding: "2px" }}
                        >
                          <IconDelete size={11} />
                        </button>
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
