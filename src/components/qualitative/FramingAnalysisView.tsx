// src/components/qualitative/FramingAnalysisView.tsx
// フレーミング分析 — Entman のフレーム定義とハイライトへの割り当て
// Rust backend: get_frames(project_id), create_frame(input: CreateFrameDto),
// assign_frame_to_highlight, remove_frame_from_highlight, delete_frame,
// get_highlight_frames(project_id)

import type React from "react";
import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Frame, Highlight, Paper, CreateFrameInput } from "../../types";
import { toast } from "../ui/Toast";

interface HighlightFrameRow {
  id: string;
  highlightId: string;
  frameId: string;
  assignedAt: string;
}

interface FrameWithCount extends Frame {
  highlightCount: number;
}

interface FramingAnalysisViewProps {
  projectId: string;
}

export const FramingAnalysisView: React.FC<FramingAnalysisViewProps> = ({ projectId }) => {
  const [frames, setFrames] = useState<FrameWithCount[]>([]);
  const [highlightFrames, setHighlightFrames] = useState<HighlightFrameRow[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedFrame, setSelectedFrame] = useState<string | null>(null);

  // フォーム — Entman フレーム要素
  const [form, setForm] = useState({
    name: "",
    problemDefinition: "",
    causalInterpretation: "",
    moralEvaluation: "",
    treatmentRecommendation: "",
    color: "#8B5CF6",
  });

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [fr, hf, p] = await Promise.all([
        invoke<Frame[]>("get_frames", { projectId }),
        invoke<HighlightFrameRow[]>("get_highlight_frames", { projectId }),
        invoke<Paper[]>("get_papers"),
      ]);

      // 各フレームのハイライト数をカウント
      const framesWithCount: FrameWithCount[] = fr.map((f) => ({
        ...f,
        highlightCount: hf.filter((h) => h.frameId === f.id).length,
      }));
      setFrames(framesWithCount);
      setHighlightFrames(hf);
      setPapers(p);

      // 全ハイライトを読み込み
      const allHighlights: Highlight[] = [];
      for (const paper of p) {
        try {
          const hl = await invoke<Highlight[]>("get_highlights", { paperId: paper.id });
          allHighlights.push(...hl);
        } catch {
          // skip
        }
      }
      setHighlights(allHighlights);
    } catch (e) {
      console.error("Failed to load framing data:", e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateFrame = useCallback(async () => {
    if (!projectId || !form.name.trim()) {
      toast.error("フレーム名を入力してください");
      return;
    }
    try {
      const input: CreateFrameInput = {
        projectId,
        name: form.name.trim(),
        problemDefinition: form.problemDefinition || null,
        causalInterpretation: form.causalInterpretation || null,
        moralEvaluation: form.moralEvaluation || null,
        treatmentRecommendation: form.treatmentRecommendation || null,
        color: form.color,
      };
      await invoke("create_frame", { input });
      setForm({ name: "", problemDefinition: "", causalInterpretation: "", moralEvaluation: "", treatmentRecommendation: "", color: "#8B5CF6" });
      setShowForm(false);
      toast.success("フレームを作成しました");
      await loadData();
    } catch (e) {
      toast.error("作成に失敗しました");
    }
  }, [projectId, form, loadData]);

  const handleDeleteFrame = async (id: string) => {
    if (!confirm("このフレームを削除しますか？")) return;
    try {
      await invoke("delete_frame", { id });
      if (selectedFrame === id) setSelectedFrame(null);
      toast.success("削除しました");
      await loadData();
    } catch (e) {
      toast.error("削除に失敗しました");
    }
  };

  const handleAssignFrame = useCallback(
    async (highlightId: string, frameId: string) => {
      try {
        await invoke("assign_frame_to_highlight", { highlightId, frameId });
        toast.success("フレームを割り当てました");
        await loadData();
      } catch (e) {
        toast.error("割り当てに失敗しました");
      }
    },
    [loadData],
  );

  const handleRemoveFrame = useCallback(
    async (highlightId: string, frameId: string) => {
      try {
        await invoke("remove_frame_from_highlight", { highlightId, frameId });
        await loadData();
      } catch (e) {
        toast.error("解除に失敗しました");
      }
    },
    [loadData],
  );

  const isAssigned = (highlightId: string, frameId: string) =>
    highlightFrames.some((hf) => hf.highlightId === highlightId && hf.frameId === frameId);

  const getFrameHighlights = (frameId: string) => {
    const assignedIds = highlightFrames
      .filter((hf) => hf.frameId === frameId)
      .map((hf) => hf.highlightId);
    return highlights.filter((h) => assignedIds.includes(h.id));
  };

  const getPaperTitle = (paperId: string) =>
    papers.find((p) => p.id === paperId)?.title ?? paperId;

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

  return (
    <div className="flex h-full overflow-hidden">
      {/* 左: フレーム一覧 */}
      <div
        className="flex flex-col h-full overflow-hidden"
        style={{
          width: "300px",
          borderRight: "1px solid var(--color-border-primary)",
        }}
      >
        <div
          className="p-3 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--color-border-secondary)" }}
        >
          <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            フレーム
          </span>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-xs"
            style={{ color: "var(--color-accent-primary)", background: "none", border: "none", cursor: "pointer" }}
          >
            {showForm ? "閉じる" : "+ 追加"}
          </button>
        </div>

        {showForm && (
          <div className="p-3 flex flex-col gap-2" style={{ borderBottom: "1px solid var(--color-border-secondary)" }}>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={inputStyle}
              placeholder="フレーム名 *"
              onKeyDown={(e) => e.key === "Enter" && handleCreateFrame()}
            />
            <textarea
              value={form.problemDefinition}
              onChange={(e) => setForm({ ...form, problemDefinition: e.target.value })}
              style={{ ...inputStyle, minHeight: "40px", resize: "vertical" }}
              placeholder="問題定義"
            />
            <textarea
              value={form.causalInterpretation}
              onChange={(e) => setForm({ ...form, causalInterpretation: e.target.value })}
              style={{ ...inputStyle, minHeight: "40px", resize: "vertical" }}
              placeholder="因果解釈"
            />
            <textarea
              value={form.moralEvaluation}
              onChange={(e) => setForm({ ...form, moralEvaluation: e.target.value })}
              style={{ ...inputStyle, minHeight: "40px", resize: "vertical" }}
              placeholder="道徳評価"
            />
            <textarea
              value={form.treatmentRecommendation}
              onChange={(e) => setForm({ ...form, treatmentRecommendation: e.target.value })}
              style={{ ...inputStyle, minHeight: "40px", resize: "vertical" }}
              placeholder="処方"
            />
            <div className="flex gap-2 items-center">
              <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} style={{ width: "30px", height: "30px", border: "none", cursor: "pointer" }} />
              <button onClick={handleCreateFrame} className="text-xs py-1 flex-1" style={{ backgroundColor: "var(--color-accent-primary)", color: "white", borderRadius: "6px", border: "none", cursor: "pointer" }}>
                作成
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2">
          {frames.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center" style={{ color: "var(--color-text-tertiary)" }}>
              <p className="text-xs">フレームを作成して分析を始めましょう</p>
            </div>
          ) : (
            frames.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedFrame(f.id === selectedFrame ? null : f.id)}
                className="w-full text-left px-3 py-2 mb-1 group"
                style={{
                  borderRadius: "6px",
                  backgroundColor:
                    selectedFrame === f.id
                      ? "rgba(99,102,241,0.1)"
                      : "transparent",
                  transition: "background-color 0.15s",
                  border: "none",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  if (selectedFrame !== f.id) e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
                }}
                onMouseLeave={(e) => {
                  if (selectedFrame !== f.id) e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: f.color, display: "inline-block" }} />
                    <span className="text-xs font-medium" style={{ color: "var(--color-text-primary)" }}>
                      {f.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                      {f.highlightCount}
                    </span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFrame(f.id);
                      }}
                      className="opacity-0 group-hover:opacity-100"
                      style={{ color: "#ef4444", fontSize: "11px", transition: "opacity 0.15s", cursor: "pointer" }}
                    >
                      ×
                    </span>
                  </div>
                </div>
                {f.problemDefinition && (
                  <p className="text-xs mt-0.5 truncate" style={{ color: "var(--color-text-tertiary)" }}>
                    {f.problemDefinition}
                  </p>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* 右: 選択フレームの詳細 + ハイライト割り当て */}
      <div className="flex-1 overflow-y-auto p-4">
        {selectedFrame ? (
          <div>
            {(() => {
              const frame = frames.find((f) => f.id === selectedFrame);
              if (!frame) return null;

              const assignedHighlights = getFrameHighlights(selectedFrame);
              const unassignedHighlights = highlights.filter(
                (h) => !isAssigned(h.id, selectedFrame),
              );

              return (
                <>
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: frame.color, display: "inline-block" }} />
                      <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
                        {frame.name}
                      </h3>
                    </div>
                    <div className="flex flex-col gap-1 mt-2">
                      {frame.problemDefinition && (
                        <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                          <strong>問題定義:</strong> {frame.problemDefinition}
                        </p>
                      )}
                      {frame.causalInterpretation && (
                        <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                          <strong>因果解釈:</strong> {frame.causalInterpretation}
                        </p>
                      )}
                      {frame.moralEvaluation && (
                        <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                          <strong>道徳評価:</strong> {frame.moralEvaluation}
                        </p>
                      )}
                      {frame.treatmentRecommendation && (
                        <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                          <strong>処方:</strong> {frame.treatmentRecommendation}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 割り当て済みハイライト */}
                  <div className="mb-6">
                    <h4 className="text-xs font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
                      割り当て済み ({assignedHighlights.length})
                    </h4>
                    {assignedHighlights.length === 0 ? (
                      <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                        まだハイライトが割り当てられていません
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {assignedHighlights.map((h) => (
                          <div
                            key={h.id}
                            className="p-2 flex items-start gap-2"
                            style={{
                              backgroundColor: "var(--color-bg-secondary)",
                              border: "1px solid var(--color-border-secondary)",
                              borderRadius: "6px",
                            }}
                          >
                            <div className="flex-1">
                              <p className="text-xs" style={{ color: "var(--color-text-primary)", lineHeight: "1.4" }}>
                                &ldquo;{h.text.length > 200 ? h.text.slice(0, 200) + "…" : h.text}&rdquo;
                              </p>
                              <p className="text-xs mt-1" style={{ color: "var(--color-text-tertiary)" }}>
                                {getPaperTitle(h.paperId)} — p.{h.page}
                              </p>
                            </div>
                            <button
                              onClick={() => handleRemoveFrame(h.id, selectedFrame)}
                              className="text-xs shrink-0"
                              style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}
                            >
                              解除
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 未割り当てハイライト */}
                  {unassignedHighlights.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
                        未割り当てハイライト ({unassignedHighlights.length})
                      </h4>
                      <div className="flex flex-col gap-1">
                        {unassignedHighlights.slice(0, 50).map((h) => (
                          <div
                            key={h.id}
                            className="p-2 flex items-start gap-2 cursor-pointer"
                            style={{
                              borderRadius: "4px",
                              transition: "background-color 0.15s",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "transparent";
                            }}
                            onClick={() => handleAssignFrame(h.id, selectedFrame)}
                          >
                            <span style={{ color: "var(--color-accent-primary)", marginTop: "2px", flexShrink: 0, fontSize: "12px" }}>+</span>
                            <div className="flex-1">
                              <p className="text-xs" style={{ color: "var(--color-text-primary)", lineHeight: "1.4" }}>
                                &ldquo;{h.text.length > 120 ? h.text.slice(0, 120) + "…" : h.text}&rdquo;
                              </p>
                              <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                                {getPaperTitle(h.paperId)} — p.{h.page}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full" style={{ color: "var(--color-text-tertiary)" }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ opacity: 0.4 }}>
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
            <p className="text-sm mt-2">フレームを選択すると詳細が表示されます</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FramingAnalysisView;
