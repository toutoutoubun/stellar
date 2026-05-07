// src/components/qualitative/FramingAnalysisView.tsx
// フレーミング分析 — Entman のフレーム定義 + フレーム×論文マトリクス
// 折りたたみパネル / ミニマルUI / カスタムアイコン / ヘルプ付き

import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "../../lib/tauriShim";
import { swalConfirm } from "../../lib/swal";
import type { Frame, FramingMatrix, CreateFrameInput } from "../../types";
import { HelpTooltip } from "./HelpTooltip";
import {
  IconPlus,
  IconDelete,
  IconClose,
  IconPanelLeft,
  IconFraming,
} from "./icons/QualIcons";
import { useT, useI18nStore } from "../../stores/useI18nStore";

interface FramingAnalysisViewProps {
  projectId: string;
}

export const FramingAnalysisView: React.FC<FramingAnalysisViewProps> = ({
  projectId,
}) => {
  const t = useT();
  const [frames, setFrames] = useState<Frame[]>([]);
  const [matrix, setMatrix] = useState<FramingMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedFrame, setSelectedFrame] = useState<Frame | null>(null);
  const [listCollapsed, setListCollapsed] = useState(false);

  // フォーム状態
  const [name, setName] = useState("");
  const [color, setColor] = useState("#8B5CF6");
  const [problemDefinition, setProblemDefinition] = useState("");
  const [causalInterpretation, setCausalInterpretation] = useState("");
  const [moralEvaluation, setMoralEvaluation] = useState("");
  const [treatmentRecommendation, setTreatmentRecommendation] = useState("");

  const loadData = useCallback(async () => {
    const t = useT();
    setLoading(true);
    try {
      const [frameList, matrixData] = await Promise.all([
        invoke<Frame[]>("get_frames", { projectId }),
        invoke<FramingMatrix>("get_framing_matrix", { projectId }),
      ]);
      setFrames(frameList);
      setMatrix(matrixData);
    } catch (err) {
      console.error(t.qualitative.k_ak5uvd, err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreateFrame = useCallback(async () => {
    if (!name.trim()) return;
    try {
      const input: CreateFrameInput = {
        projectId,
        name: name.trim(),
        color,
        problemDefinition: problemDefinition.trim() || undefined,
        causalInterpretation: causalInterpretation.trim() || undefined,
        moralEvaluation: moralEvaluation.trim() || undefined,
        treatmentRecommendation: treatmentRecommendation.trim() || undefined,
      };
      await invoke("create_frame", { input });
      setName("");
      setProblemDefinition("");
      setCausalInterpretation("");
      setMoralEvaluation("");
      setTreatmentRecommendation("");
      setShowForm(false);
      void loadData();
    } catch (err) {
      console.error(t.qualitative.k_r15nny, err);
    }
  }, [
    name,
    color,
    problemDefinition,
    causalInterpretation,
    moralEvaluation,
    treatmentRecommendation,
    projectId,
    loadData,
  ]);

  const handleDeleteFrame = useCallback(
    async (id: string) => {
      const ok = await swalConfirm(t.qualitative.k_7wrncl, t.qualitative.k_szt8i8);
      if (!ok) return;
      try {
        await invoke("delete_frame", { id });
        if (selectedFrame?.id === id) setSelectedFrame(null);
        void loadData();
      } catch (err) {
        console.error(t.qualitative.k_ihpoac, err);
      }
    },
    [selectedFrame, loadData]
  );

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        <span className="text-sm">{t.common.loading}</span>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* 左: フレーム一覧（折りたたみ対応） */}
      <div
        className="flex flex-col shrink-0 h-full"
        style={{
          width: listCollapsed ? "40px" : "300px",
          borderRight: "1px solid var(--color-border-primary)",
          transition: "width 150ms ease-out",
          overflow: "hidden",
        }}
      >
        <header
          className="flex items-center justify-between px-2 shrink-0"
          style={{
            height: "40px",
            borderBottom: "1px solid var(--color-border-primary)",
          }}
        >
          {!listCollapsed && (
            <>
              <span
                className="text-xs font-semibold"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                フレーム ({frames.length})
              </span>
              <button
                type="button"
                onClick={() => setShowForm(!showForm)}
                className="text-xs inline-flex items-center gap-0.5"
                style={{
                  color: "var(--color-accent-primary)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <IconPlus size={10} />
                追加
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setListCollapsed(!listCollapsed)}
            title={listCollapsed ? t.qualitative.k_gixi : t.qualitative.k_yczceq}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--color-text-tertiary)",
              padding: "4px",
              display: "flex",
            }}
          >
            <IconPanelLeft size={13} />
          </button>
        </header>

        {!listCollapsed && (
          <div className="flex-1 overflow-y-auto p-2">
            {showForm && (
              <div
                className="mb-3 p-3"
                style={{
                  backgroundColor: "var(--color-bg-tertiary)",
                  borderRadius: "8px",
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    style={{
                      width: "24px",
                      height: "24px",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                    }}
                  />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t.qualitative.k_fs863y}
                    className="flex-1 text-xs px-2 py-1"
                    style={{
                      backgroundColor: "var(--color-bg-primary)",
                      color: "var(--color-text-primary)",
                      border: "1px solid var(--color-border-primary)",
                      borderRadius: "4px",
                      outline: "none",
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleCreateFrame();
                    }}
                    autoFocus
                  />
                </div>

                <div className="flex flex-col gap-1.5 mb-2">
                  <textarea
                    value={problemDefinition}
                    onChange={(e) => setProblemDefinition(e.target.value)}
                    placeholder={t.qualitative.k_be42r0}
                    rows={2}
                    className="w-full text-xs px-2 py-1"
                    style={{
                      backgroundColor: "var(--color-bg-primary)",
                      color: "var(--color-text-primary)",
                      border: "1px solid var(--color-border-primary)",
                      borderRadius: "4px",
                      outline: "none",
                      resize: "vertical",
                    }}
                  />
                  <textarea
                    value={causalInterpretation}
                    onChange={(e) => setCausalInterpretation(e.target.value)}
                    placeholder={t.qualitative.k_bebda9}
                    rows={2}
                    className="w-full text-xs px-2 py-1"
                    style={{
                      backgroundColor: "var(--color-bg-primary)",
                      color: "var(--color-text-primary)",
                      border: "1px solid var(--color-border-primary)",
                      borderRadius: "4px",
                      outline: "none",
                      resize: "vertical",
                    }}
                  />
                  <textarea
                    value={moralEvaluation}
                    onChange={(e) => setMoralEvaluation(e.target.value)}
                    placeholder={t.qualitative.k_8mm75c}
                    rows={2}
                    className="w-full text-xs px-2 py-1"
                    style={{
                      backgroundColor: "var(--color-bg-primary)",
                      color: "var(--color-text-primary)",
                      border: "1px solid var(--color-border-primary)",
                      borderRadius: "4px",
                      outline: "none",
                      resize: "vertical",
                    }}
                  />
                  <textarea
                    value={treatmentRecommendation}
                    onChange={(e) => setTreatmentRecommendation(e.target.value)}
                    placeholder={t.qualitative.k_ar98i3}
                    rows={2}
                    className="w-full text-xs px-2 py-1"
                    style={{
                      backgroundColor: "var(--color-bg-primary)",
                      color: "var(--color-text-primary)",
                      border: "1px solid var(--color-border-primary)",
                      borderRadius: "4px",
                      outline: "none",
                      resize: "vertical",
                    }}
                  />
                </div>

                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => void handleCreateFrame()}
                    className="flex-1 text-xs py-1"
                    style={{
                      backgroundColor: "var(--color-accent-primary)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    作成
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    title={t.common.cancel}
                    style={{
                      background: "transparent",
                      color: "var(--color-text-tertiary)",
                      border: "1px solid var(--color-border-secondary)",
                      borderRadius: "4px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      padding: "4px 8px",
                    }}
                  >
                    <IconClose size={10} />
                  </button>
                </div>
              </div>
            )}

            {frames.map((frame) => (
              <div
                key={frame.id}
                onClick={() => setSelectedFrame(frame)}
                className="p-2 mb-1 group"
                style={{
                  backgroundColor:
                    selectedFrame?.id === frame.id
                      ? "var(--color-bg-hover)"
                      : "var(--color-bg-secondary)",
                  borderRadius: "6px",
                  border: `1px solid ${
                    selectedFrame?.id === frame.id
                      ? frame.color
                      : "var(--color-border-secondary)"
                  }`,
                  cursor: "pointer",
                  borderLeft: `3px solid ${frame.color}`,
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-xs font-medium"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {frame.name}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDeleteFrame(frame.id);
                    }}
                    className="opacity-0 group-hover:opacity-100"
                    title={t.common.delete}
                    style={{
                      color: "var(--color-text-tertiary)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      padding: "2px",
                    }}
                  >
                    <IconDelete size={11} />
                  </button>
                </div>
              </div>
            ))}

            {frames.length === 0 && !showForm && (
              <div
                className="flex flex-col items-center justify-center py-8 gap-2"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                <IconFraming size={24} />
                <span className="text-xs">フレームなし</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 右: フレーム詳細 + マトリクス */}
      <div className="flex-1 overflow-y-auto p-4">
        <HelpTooltip
          storageKey="qual_framing"
          title={t.qualitative.k_e3yflz}
          paragraphs={[
            t.qualitative.k_gxvbch,
            t.qualitative.k_ul553w,
          ]}
          steps={[
            t.qualitative.k_ng8zoa,
            t.qualitative.k_gbjiq0,
            t.qualitative.k_tu63fb,
          ]}
        />

        {selectedFrame ? (
          <div>
            <h3
              className="text-sm font-semibold mb-4"
              style={{ color: "var(--color-text-primary)" }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  backgroundColor: selectedFrame.color,
                  marginRight: "8px",
                }}
              />
              {selectedFrame.name}
            </h3>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <DetailCard
                label={t.qualitative.k_be42r0}
                value={selectedFrame.problemDefinition}
              />
              <DetailCard
                label={t.qualitative.k_bebda9}
                value={selectedFrame.causalInterpretation}
              />
              <DetailCard
                label={t.qualitative.k_8mm75c}
                value={selectedFrame.moralEvaluation}
              />
              <DetailCard
                label={t.qualitative.k_ar98i3}
                value={selectedFrame.treatmentRecommendation}
              />
            </div>
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center py-12 gap-3"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            <IconFraming size={28} />
            <span className="text-sm">
              左からフレームを選択してください
            </span>
          </div>
        )}

        {/* フレーミングマトリクス */}
        {matrix &&
          matrix.frames.length > 0 &&
          matrix.papers.length > 0 && (
            <div className="mt-6">
              <h4
                className="text-sm font-semibold mb-3"
                style={{ color: "var(--color-text-primary)" }}
              >
                フレーミングマトリクス
              </h4>
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
                          borderBottom:
                            "2px solid var(--color-border-primary)",
                          color: "var(--color-text-tertiary)",
                          fontWeight: 600,
                        }}
                      >
                        フレーム
                      </th>
                      {matrix.papers.map((p) => (
                        <th
                          key={p.paperId}
                          style={{
                            padding: "8px 12px",
                            textAlign: "center",
                            borderBottom:
                              "2px solid var(--color-border-primary)",
                            color: "var(--color-text-tertiary)",
                            fontWeight: 600,
                            maxWidth: "120px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={p.paperTitle}
                        >
                          {p.paperTitle.length > 15
                            ? p.paperTitle.slice(0, 15) + "..."
                            : p.paperTitle}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.frames.map((frame) => (
                      <tr key={frame.id}>
                        <td
                          style={{
                            padding: "6px 12px",
                            borderBottom:
                              "1px solid var(--color-border-secondary)",
                            color: "var(--color-text-primary)",
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              style={{
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                backgroundColor: frame.color,
                                display: "inline-block",
                                flexShrink: 0,
                              }}
                            />
                            {frame.name}
                          </div>
                        </td>
                        {matrix.papers.map((p) => {
                          const key = `${frame.id}:${p.paperId}`;
                          const count = matrix.counts[key] ?? 0;
                          return (
                            <td
                              key={p.paperId}
                              style={{
                                padding: "6px 12px",
                                textAlign: "center",
                                borderBottom:
                                  "1px solid var(--color-border-secondary)",
                                color:
                                  count > 0
                                    ? "var(--color-text-primary)"
                                    : "var(--color-text-tertiary)",
                                backgroundColor:
                                  count > 0
                                    ? `${frame.color}20`
                                    : "transparent",
                                fontWeight: count > 0 ? 600 : 400,
                              }}
                            >
                              {count || "--"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
      </div>
    </div>
  );
};

/** フレーム詳細カード */
const DetailCard: React.FC<{ label: string; value: string | null }> = ({
  label,
  value,
}) => (
  <div
    className="p-3"
    style={{
      backgroundColor: "var(--color-bg-secondary)",
      borderRadius: "8px",
      border: "1px solid var(--color-border-secondary)",
    }}
  >
    <div
      className="text-xs font-semibold mb-1"
      style={{ color: "var(--color-text-tertiary)" }}
    >
      {label}
    </div>
    <p
      className="text-xs"
      style={{
        color: value
          ? "var(--color-text-primary)"
          : "var(--color-text-tertiary)",
        lineHeight: "1.5",
      }}
    >
      {value || useI18nStore.getState().t.qualitative.k_frzjr}
    </p>
  </div>
);
