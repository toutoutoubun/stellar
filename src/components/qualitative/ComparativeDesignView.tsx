// src/components/qualitative/ComparativeDesignView.tsx
// 比較デザイン — ケース×変数マトリックス + QCA CSV エクスポート
// CSV format: "case,変数A,変数B,変数C,結果Y" → "日本,1,0,1,1"
// Rust backend: get_comparative_design(project_id) → Vec<ComparativeDesignFull>
// add_comparative_case(design_id, name, sort_order)
// add_comparative_variable(design_id, name, var_type, sort_order)
// upsert_comparative_cell(case_id, variable_id, value, paper_id)
// export_qca_csv(design_id) → String

import type React from "react";
import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  ComparativeDesignFull,
  ComparativeCase,
  ComparativeVariable,
  ComparativeCell,
  CreateComparativeDesignInput,
} from "../../types";
import { toast } from "../ui/Toast";

interface ComparativeDesignViewProps {
  projectId: string;
}

export const ComparativeDesignView: React.FC<ComparativeDesignViewProps> = ({ projectId }) => {
  const [designs, setDesigns] = useState<ComparativeDesignFull[]>([]);
  const [activeDesignId, setActiveDesignId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDesignForm, setShowDesignForm] = useState(false);

  // フォーム
  const [designForm, setDesignForm] = useState({
    title: "",
    designType: "MSSD" as string,
  });

  // ローカル cell 状態（楽観的更新用）
  const [localCells, setLocalCells] = useState<ComparativeCell[]>([]);

  const loadDesigns = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const d = await invoke<ComparativeDesignFull[]>("get_comparative_design", {
        projectId,
      });
      setDesigns(d);
      if (d.length > 0 && !activeDesignId) {
        setActiveDesignId(d[0].id);
      }
    } catch (e) {
      console.error("Failed to load designs:", e);
    } finally {
      setLoading(false);
    }
  }, [projectId, activeDesignId]);

  useEffect(() => {
    loadDesigns();
  }, [loadDesigns]);

  // アクティブデザインが変わったらローカルセルを更新
  const activeDesign = designs.find((d) => d.id === activeDesignId);
  useEffect(() => {
    setLocalCells(activeDesign?.cells ?? []);
  }, [activeDesign]);

  const getCellValue = (caseId: string, varId: string): string => {
    return localCells.find((c) => c.caseId === caseId && c.variableId === varId)?.value ?? "";
  };

  const handleCellChange = useCallback(async (caseId: string, varId: string, value: string) => {
    // 楽観的にローカル更新
    setLocalCells((prev) => {
      const existing = prev.find((c) => c.caseId === caseId && c.variableId === varId);
      if (existing) {
        return prev.map((c) =>
          c.caseId === caseId && c.variableId === varId ? { ...c, value } : c,
        );
      }
      return [...prev, { id: "", caseId, variableId: varId, value, paperId: null }];
    });
    try {
      await invoke("upsert_comparative_cell", {
        caseId,
        variableId: varId,
        value,
        paperId: null as string | null,
      });
    } catch (e) {
      toast.error("セルの更新に失敗しました");
    }
  }, []);

  const handleCreateDesign = useCallback(async () => {
    if (!projectId || !designForm.title.trim()) {
      toast.error("デザイン名を入力してください");
      return;
    }
    try {
      const input: CreateComparativeDesignInput = {
        projectId,
        title: designForm.title.trim(),
        designType: designForm.designType,
      };
      await invoke("create_comparative_design", { input });
      setDesignForm({ title: "", designType: "MSSD" });
      setShowDesignForm(false);
      toast.success("デザインを作成しました");
      await loadDesigns();
    } catch (e) {
      toast.error("作成に失敗しました");
    }
  }, [projectId, designForm, loadDesigns]);

  const handleAddCase = useCallback(async () => {
    if (!activeDesignId) return;
    const name = prompt("ケース名を入力:");
    if (!name?.trim()) return;
    try {
      await invoke("add_comparative_case", {
        designId: activeDesignId,
        name: name.trim(),
        sortOrder: activeDesign?.cases.length ?? 0,
      });
      toast.success("ケースを追加しました");
      await loadDesigns();
    } catch (e) {
      toast.error("追加に失敗しました");
    }
  }, [activeDesignId, activeDesign, loadDesigns]);

  const handleAddVariable = useCallback(async () => {
    if (!activeDesignId) return;
    const name = prompt("変数名を入力:");
    if (!name?.trim()) return;
    const isOutcome = confirm("この変数は結果変数ですか？");
    try {
      await invoke("add_comparative_variable", {
        designId: activeDesignId,
        name: name.trim(),
        varType: isOutcome ? "dependent" : "independent",
        sortOrder: activeDesign?.variables.length ?? 0,
      });
      toast.success("変数を追加しました");
      await loadDesigns();
    } catch (e) {
      toast.error("追加に失敗しました");
    }
  }, [activeDesignId, activeDesign, loadDesigns]);

  const handleDeleteCase = async (id: string) => {
    if (!confirm("このケースを削除しますか？")) return;
    try {
      await invoke("delete_comparative_case", { id });
      await loadDesigns();
    } catch (e) {
      toast.error("削除に失敗しました");
    }
  };

  const handleDeleteVariable = async (id: string) => {
    if (!confirm("この変数を削除しますか？")) return;
    try {
      await invoke("delete_comparative_variable", { id });
      await loadDesigns();
    } catch (e) {
      toast.error("削除に失敗しました");
    }
  };

  /** QCA CSV エクスポート — Rust backend から CSV 文字列を取得してダウンロード */
  const handleExportCsv = useCallback(async () => {
    if (!activeDesignId) return;
    try {
      const csv = await invoke<string>("export_qca_csv", { designId: activeDesignId });
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "qca_export.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSVをエクスポートしました");
    } catch (e) {
      toast.error("エクスポートに失敗しました: " + String(e));
    }
  }, [activeDesignId]);

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

  const designTypeLabels: Record<string, string> = {
    MSSD: "最類似事例デザイン",
    MDSD: "最相違事例デザイン",
    custom: "カスタム",
  };

  const cases = activeDesign?.cases ?? [];
  const variables = activeDesign?.variables ?? [];

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
              比較分析デザイン
            </h3>
            <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
              ケース×変数マトリックスで比較分析。QCA用CSVエクスポート対応
            </p>
          </div>
          <div className="flex gap-2">
            {activeDesignId && cases.length > 0 && variables.length > 0 && (
              <button
                onClick={handleExportCsv}
                className="text-xs px-3 py-1.5 flex items-center gap-1"
                style={{
                  backgroundColor: "var(--color-bg-hover)",
                  color: "var(--color-text-secondary)",
                  borderRadius: "6px",
                  border: "1px solid var(--color-border-secondary)",
                  cursor: "pointer",
                }}
              >
                CSV エクスポート
              </button>
            )}
            <button
              onClick={() => setShowDesignForm(!showDesignForm)}
              className="text-xs px-3 py-1.5 flex items-center gap-1"
              style={{ backgroundColor: "var(--color-accent-primary)", color: "white", borderRadius: "6px", border: "none", cursor: "pointer" }}
            >
              + デザイン作成
            </button>
          </div>
        </div>

        {/* デザイン作成フォーム */}
        {showDesignForm && (
          <div className="p-4 mb-4" style={{ backgroundColor: "var(--color-bg-secondary)", border: "1px solid var(--color-border-secondary)", borderRadius: "10px" }}>
            <div className="flex flex-col gap-2">
              <input type="text" value={designForm.title} onChange={(e) => setDesignForm({ ...designForm, title: e.target.value })} style={inputStyle} placeholder="デザイン名 *" />
              <select value={designForm.designType} onChange={(e) => setDesignForm({ ...designForm, designType: e.target.value })} style={inputStyle}>
                <option value="MSSD">最類似事例デザイン (MSSD)</option>
                <option value="MDSD">最相違事例デザイン (MDSD)</option>
                <option value="custom">カスタム</option>
              </select>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowDesignForm(false)} className="text-xs px-3 py-1.5" style={{ color: "var(--color-text-secondary)", border: "1px solid var(--color-border-secondary)", borderRadius: "6px", background: "none", cursor: "pointer" }}>キャンセル</button>
                <button onClick={handleCreateDesign} className="text-xs px-4 py-1.5" style={{ backgroundColor: "var(--color-accent-primary)", color: "white", borderRadius: "6px", border: "none", cursor: "pointer" }}>作成</button>
              </div>
            </div>
          </div>
        )}

        {/* デザインタブ */}
        {designs.length > 0 && (
          <div className="flex gap-1 mb-4 flex-wrap">
            {designs.map((d) => (
              <button
                key={d.id}
                onClick={() => setActiveDesignId(d.id)}
                className="text-xs px-3 py-1.5"
                style={{
                  backgroundColor: activeDesignId === d.id ? "var(--color-accent-primary)" : "var(--color-bg-secondary)",
                  color: activeDesignId === d.id ? "white" : "var(--color-text-secondary)",
                  borderRadius: "6px",
                  border: "1px solid var(--color-border-secondary)",
                  cursor: "pointer",
                }}
              >
                {d.title}
                <span className="ml-1 opacity-60">({designTypeLabels[d.designType] ?? d.designType})</span>
              </button>
            ))}
          </div>
        )}

        {/* マトリックス */}
        {activeDesignId && (
          <>
            <div className="flex gap-2 mb-3">
              <button onClick={handleAddCase} className="text-xs px-3 py-1 flex items-center gap-1" style={{ backgroundColor: "var(--color-bg-hover)", color: "var(--color-text-secondary)", borderRadius: "6px", border: "1px solid var(--color-border-secondary)", cursor: "pointer" }}>
                + ケース
              </button>
              <button onClick={handleAddVariable} className="text-xs px-3 py-1 flex items-center gap-1" style={{ backgroundColor: "var(--color-bg-hover)", color: "var(--color-text-secondary)", borderRadius: "6px", border: "1px solid var(--color-border-secondary)", cursor: "pointer" }}>
                + 変数
              </button>
            </div>

            {cases.length > 0 && variables.length > 0 ? (
              <div className="overflow-auto" style={{ border: "1px solid var(--color-border-secondary)", borderRadius: "8px" }}>
                <table style={{ borderCollapse: "collapse", minWidth: "100%" }}>
                  <thead>
                    <tr>
                      <th className="text-xs font-medium text-left" style={{ padding: "8px 12px", backgroundColor: "var(--color-bg-secondary)", color: "var(--color-text-secondary)", borderBottom: "1px solid var(--color-border-secondary)", borderRight: "1px solid var(--color-border-secondary)", minWidth: "120px" }}>
                        case
                      </th>
                      {variables.map((v) => (
                        <th
                          key={v.id}
                          className="text-xs font-medium text-center group"
                          style={{
                            padding: "8px 12px",
                            backgroundColor: v.varType === "dependent" ? "rgba(99,102,241,0.08)" : "var(--color-bg-secondary)",
                            color: "var(--color-text-secondary)",
                            borderBottom: "1px solid var(--color-border-secondary)",
                            borderRight: "1px solid var(--color-border-secondary)",
                            minWidth: "80px",
                          }}
                        >
                          <div className="flex items-center justify-center gap-1">
                            <span>{v.name}</span>
                            {v.varType === "dependent" && <span className="text-xs opacity-60">(Y)</span>}
                            <button onClick={() => handleDeleteVariable(v.id)} className="opacity-0 group-hover:opacity-100" style={{ color: "#ef4444", fontSize: "10px", background: "none", border: "none", cursor: "pointer" }}>×</button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cases.map((c) => (
                      <tr key={c.id} className="group">
                        <td className="text-xs font-medium" style={{ padding: "4px 12px", backgroundColor: "var(--color-bg-primary)", color: "var(--color-text-primary)", borderBottom: "1px solid var(--color-border-secondary)", borderRight: "1px solid var(--color-border-secondary)" }}>
                          <div className="flex items-center justify-between">
                            <span>{c.name}</span>
                            <button onClick={() => handleDeleteCase(c.id)} className="opacity-0 group-hover:opacity-100" style={{ color: "#ef4444", fontSize: "10px", background: "none", border: "none", cursor: "pointer" }}>×</button>
                          </div>
                        </td>
                        {variables.map((v) => (
                          <td key={v.id} style={{ padding: "2px 4px", borderBottom: "1px solid var(--color-border-secondary)", borderRight: "1px solid var(--color-border-secondary)", backgroundColor: v.varType === "dependent" ? "rgba(99,102,241,0.04)" : "transparent" }}>
                            <input
                              type="text"
                              value={getCellValue(c.id, v.id)}
                              onChange={(e) => handleCellChange(c.id, v.id, e.target.value)}
                              className="w-full text-xs text-center"
                              style={{
                                backgroundColor: "transparent",
                                color: "var(--color-text-primary)",
                                border: "none",
                                outline: "none",
                                padding: "4px",
                              }}
                              placeholder="—"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12" style={{ color: "var(--color-text-tertiary)" }}>
                <p className="text-sm">ケースと変数を追加してマトリックスを構築しましょう</p>
              </div>
            )}

            {/* CSV プレビュー */}
            {cases.length > 0 && variables.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>
                  QCA CSV プレビュー
                </p>
                <pre
                  className="text-xs p-3 overflow-x-auto"
                  style={{
                    backgroundColor: "var(--color-bg-tertiary)",
                    color: "var(--color-text-secondary)",
                    borderRadius: "6px",
                    border: "1px solid var(--color-border-secondary)",
                    fontFamily: "monospace",
                    lineHeight: "1.5",
                  }}
                >
                  {["case," + variables.map((v) => v.name).join(","),
                    ...cases.map((c) =>
                      c.name + "," + variables.map((v) => getCellValue(c.id, v.id) || "0").join(","),
                    ),
                  ].join("\n")}
                </pre>
              </div>
            )}
          </>
        )}

        {designs.length === 0 && !showDesignForm && (
          <div className="flex flex-col items-center justify-center py-12" style={{ color: "var(--color-text-tertiary)" }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ opacity: 0.4 }}>
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
            </svg>
            <p className="text-sm mt-2">比較デザインを作成して事例比較を始めましょう</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComparativeDesignView;
