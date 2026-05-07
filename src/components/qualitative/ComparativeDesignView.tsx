// src/components/qualitative/ComparativeDesignView.tsx
// 比較ケースデザイン — MSSD/MDSD + 変数×ケースマトリクス + QCA CSV エクスポート
// ミニマルUI / カスタムアイコン / ヘルプ付き

import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "../../lib/tauriShim";
import { swalConfirm } from "../../lib/swal";
import type {
  ComparativeDesignFull,
  CreateComparativeDesignInput,
} from "../../types";
import { HelpTooltip } from "./HelpTooltip";
import { IconPlus, IconDelete, IconClose, IconCopy, IconExport, IconComparative } from "./icons/QualIcons";
import { useT, useI18nStore } from "../../stores/useI18nStore";

interface ComparativeDesignViewProps {
  projectId: string;
}

const DESIGN_TYPES = [
  { value: "MSSD", label: useI18nStore.getState().t.qualitative.k_a347nj },
  { value: "MDSD", label: useI18nStore.getState().t.qualitative.k_jj3dfz },
  { value: "QCA", label: useI18nStore.getState().t.qualitative.k_55t8w3 },
  { value: "other", label: useI18nStore.getState().t.notes.k_7bosl },
];

export const ComparativeDesignView: React.FC<ComparativeDesignViewProps> = ({
  projectId,
}) => {
  const t = useT();
  const [design, setDesign] = useState<ComparativeDesignFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesignType, setNewDesignType] = useState("MSSD");
  const [newCaseName, setNewCaseName] = useState("");
  const [newVarName, setNewVarName] = useState("");
  const [newVarType, setNewVarType] = useState("independent");
  const [csvOutput, setCsvOutput] = useState<string | null>(null);

  const loadDesign = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke<ComparativeDesignFull | null>(
        "get_comparative_design",
        { projectId }
      );
      setDesign(result);
    } catch (err) {
      console.error(t.qualitative.k_tnbwfn, err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadDesign();
  }, [loadDesign]);

  const handleCreateDesign = useCallback(async () => {
    if (!newTitle.trim()) return;
    try {
      const input: CreateComparativeDesignInput = {
        projectId,
        title: newTitle.trim(),
        designType: newDesignType,
      };
      await invoke("create_comparative_design", { input });
      setNewTitle("");
      setShowCreateForm(false);
      void loadDesign();
    } catch (err) {
      console.error(t.qualitative.k_2lbhyn, err);
    }
  }, [newTitle, newDesignType, projectId, loadDesign]);

  const handleAddCase = useCallback(async () => {
    if (!design || !newCaseName.trim()) return;
    try {
      await invoke("add_comparative_case", {
        designId: design.id,
        name: newCaseName.trim(),
      });
      setNewCaseName("");
      void loadDesign();
    } catch (err) {
      console.error(t.qualitative.k_v6m7o0, err);
    }
  }, [design, newCaseName, loadDesign]);

  const handleAddVariable = useCallback(async () => {
    if (!design || !newVarName.trim()) return;
    try {
      await invoke("add_comparative_variable", {
        designId: design.id,
        name: newVarName.trim(),
        varType: newVarType,
      });
      setNewVarName("");
      void loadDesign();
    } catch (err) {
      console.error(t.qualitative.k_i6p9zd, err);
    }
  }, [design, newVarName, newVarType, loadDesign]);

  const handleDeleteCase = useCallback(
    async (id: string) => {
      const ok = await swalConfirm(t.qualitative.k_gblvnc, t.qualitative.k_v6c3t9);
      if (!ok) return;
      try {
        await invoke("delete_comparative_case", { id });
        void loadDesign();
      } catch (err) {
        console.error(t.qualitative.k_etpon, err);
      }
    },
    [loadDesign]
  );

  const handleDeleteVariable = useCallback(
    async (id: string) => {
      const ok2 = await swalConfirm(t.qualitative.k_bnjl7l, t.qualitative.k_xb8ix0);
      if (!ok2) return;
      try {
        await invoke("delete_comparative_variable", { id });
        void loadDesign();
      } catch (err) {
        console.error(t.qualitative.k_l8yun4, err);
      }
    },
    [loadDesign]
  );

  const handleCellChange = useCallback(
    async (caseId: string, variableId: string, value: string) => {
      try {
        await invoke("upsert_comparative_cell", {
          caseId,
          variableId,
          value: value || null,
          paperId: null,
        });
        void loadDesign();
      } catch (err) {
        console.error(t.qualitative.k_e3xksr, err);
      }
    },
    [loadDesign]
  );

  const handleExportCsv = useCallback(async () => {
    if (!design) return;
    try {
      const csv = await invoke<string>("export_qca_csv", {
        designId: design.id,
      });
      setCsvOutput(csv);
    } catch (err) {
      console.error(t.qualitative.k_lqt8hw, err);
    }
  }, [design]);

  const handleCopyCsv = useCallback(() => {
    if (csvOutput) {
      void navigator.clipboard.writeText(csvOutput);
    }
  }, [csvOutput]);

  const getCellValue = (caseId: string, variableId: string): string => {
    if (!design) return "";
    const cell = design.cells.find(
      (c) => c.caseId === caseId && c.variableId === variableId
    );
    return cell?.value ?? "";
  };

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

  // デザイン未作成
  if (!design) {
    return (
      <div className="p-6">
        <HelpTooltip
          storageKey="qual_comparative"
          title={t.qualitative.k_z4o1zn}
          paragraphs={[
            t.qualitative.k_t9gc7s,
            t.qualitative.k_sqni8i,
          ]}
          steps={[
            t.qualitative.k_zawdmq,
            t.qualitative.k_bg69ys,
            t.qualitative.k_qs4arb,
            t.qualitative.k_oolk2k,
          ]}
        />

        {showCreateForm ? (
          <div
            className="p-4"
            style={{
              backgroundColor: "var(--color-bg-secondary)",
              borderRadius: "10px",
              border: "1px solid var(--color-border-primary)",
              maxWidth: "400px",
            }}
          >
            <h3
              className="text-sm font-semibold mb-3"
              style={{ color: "var(--color-text-primary)" }}
            >
              新しい比較デザイン
            </h3>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={t.qualitative.k_x6q83e}
              className="w-full text-xs px-2 py-1.5 mb-2"
              style={{
                backgroundColor: "var(--color-bg-primary)",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-border-primary)",
                borderRadius: "6px",
                outline: "none",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreateDesign();
              }}
              autoFocus
            />
            <select
              value={newDesignType}
              onChange={(e) => setNewDesignType(e.target.value)}
              className="w-full text-xs px-2 py-1.5 mb-3"
              style={{
                backgroundColor: "var(--color-bg-primary)",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-border-primary)",
                borderRadius: "6px",
              }}
            >
              {DESIGN_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleCreateDesign()}
                className="text-xs px-3 py-1.5"
                style={{
                  backgroundColor: "var(--color-accent-primary)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                作成
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="text-xs px-3 py-1.5 inline-flex items-center gap-1"
                style={{
                  background: "transparent",
                  color: "var(--color-text-secondary)",
                  border: "1px solid var(--color-border-secondary)",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                <IconClose size={10} />
                キャンセル
              </button>
            </div>
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center gap-4 py-12"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            <IconComparative size={28} />
            <span className="text-sm">比較デザインがありません</span>
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="text-sm px-4 py-2 inline-flex items-center gap-1"
              style={{
                backgroundColor: "var(--color-accent-primary)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              <IconPlus size={12} />
              比較デザインを作成
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 h-full overflow-y-auto">
      <HelpTooltip
        storageKey="qual_comparative"
        title={t.qualitative.k_z4o1zn}
        paragraphs={[
          t.qualitative.k_ajycwo,
        ]}
        steps={[
          t.qualitative.k_uvu9ih,
          t.qualitative.k_nm5vlw,
          t.qualitative.k_lrs9hd,
        ]}
      />

      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3
            className="text-sm font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            {design.title}
          </h3>
          <span
            className="text-xs"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {DESIGN_TYPES.find((t) => t.value === design.designType)?.label ??
              design.designType}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void handleExportCsv()}
          className="text-xs px-3 py-1 inline-flex items-center gap-1"
          style={{
            backgroundColor: "var(--color-bg-tertiary)",
            color: "var(--color-text-secondary)",
            border: "1px solid var(--color-border-secondary)",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          <IconExport size={11} />
          QCA CSV エクスポート
        </button>
      </div>

      {/* ケース追加 + 変数追加 */}
      <div className="flex gap-4 mb-4">
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={newCaseName}
            onChange={(e) => setNewCaseName(e.target.value)}
            placeholder={t.qualitative.k_6ci90f}
            className="text-xs px-2 py-1"
            style={{
              backgroundColor: "var(--color-bg-primary)",
              color: "var(--color-text-primary)",
              border: "1px solid var(--color-border-primary)",
              borderRadius: "4px",
              outline: "none",
              width: "120px",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleAddCase();
            }}
          />
          <button
            type="button"
            onClick={() => void handleAddCase()}
            className="text-xs px-2 py-1 inline-flex items-center gap-0.5"
            style={{
              backgroundColor: "var(--color-accent-primary)",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            <IconPlus size={10} />
            ケース
          </button>
        </div>
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={newVarName}
            onChange={(e) => setNewVarName(e.target.value)}
            placeholder={t.qualitative.k_dj71i}
            className="text-xs px-2 py-1"
            style={{
              backgroundColor: "var(--color-bg-primary)",
              color: "var(--color-text-primary)",
              border: "1px solid var(--color-border-primary)",
              borderRadius: "4px",
              outline: "none",
              width: "120px",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleAddVariable();
            }}
          />
          <select
            value={newVarType}
            onChange={(e) => setNewVarType(e.target.value)}
            className="text-xs px-1 py-1"
            style={{
              backgroundColor: "var(--color-bg-primary)",
              color: "var(--color-text-primary)",
              border: "1px solid var(--color-border-primary)",
              borderRadius: "4px",
            }}
          >
            <option value="independent">独立変数</option>
            <option value="dependent">従属変数</option>
            <option value="control">統制変数</option>
            <option value="outcome">結果</option>
          </select>
          <button
            type="button"
            onClick={() => void handleAddVariable()}
            className="text-xs px-2 py-1 inline-flex items-center gap-0.5"
            style={{
              backgroundColor: "var(--color-accent-primary)",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            <IconPlus size={10} />
            変数
          </button>
        </div>
      </div>

      {/* マトリクス */}
      {design.cases.length > 0 && design.variables.length > 0 ? (
        <div className="overflow-auto mb-6">
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
                  }}
                >
                  ケース
                </th>
                {design.variables.map((v) => (
                  <th
                    key={v.id}
                    style={{
                      padding: "8px 12px",
                      textAlign: "center",
                      borderBottom: "2px solid var(--color-border-primary)",
                      color: "var(--color-text-tertiary)",
                      fontWeight: 600,
                    }}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{v.name}</span>
                      <span style={{ fontSize: "9px", opacity: 0.6 }}>
                        ({v.varType === "dependent"
                          ? t.qualitative.k_grhn
                          : v.varType === "outcome"
                          ? t.qualitative.k_lvt8
                          : v.varType === "control"
                          ? t.qualitative.k_lsdh
                          : t.qualitative.k_k7z3})
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleDeleteVariable(v.id)}
                        title={t.common.delete}
                        style={{
                          color: "var(--color-text-tertiary)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          display: "flex",
                          padding: "1px",
                        }}
                      >
                        <IconDelete size={10} />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {design.cases.map((c) => (
                <tr key={c.id}>
                  <td
                    style={{
                      padding: "6px 12px",
                      borderBottom: "1px solid var(--color-border-secondary)",
                      color: "var(--color-text-primary)",
                      fontWeight: 500,
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span>{c.name}</span>
                      <button
                        type="button"
                        onClick={() => void handleDeleteCase(c.id)}
                        title={t.common.delete}
                        style={{
                          color: "var(--color-text-tertiary)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          display: "flex",
                          padding: "1px",
                        }}
                      >
                        <IconDelete size={10} />
                      </button>
                    </div>
                  </td>
                  {design.variables.map((v) => (
                    <td
                      key={v.id}
                      style={{
                        padding: "4px 8px",
                        borderBottom: "1px solid var(--color-border-secondary)",
                        textAlign: "center",
                      }}
                    >
                      <input
                        type="text"
                        defaultValue={getCellValue(c.id, v.id)}
                        onBlur={(e) =>
                          void handleCellChange(c.id, v.id, e.target.value)
                        }
                        className="text-xs text-center w-full px-1 py-0.5"
                        style={{
                          backgroundColor: "var(--color-bg-primary)",
                          color: "var(--color-text-primary)",
                          border: "1px solid var(--color-border-secondary)",
                          borderRadius: "4px",
                          outline: "none",
                          maxWidth: "100px",
                        }}
                        placeholder="--"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          className="text-center py-8 text-xs"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          {design.cases.length === 0 && design.variables.length === 0
            ? t.qualitative.k_so9vwy
            : design.cases.length === 0
            ? t.qualitative.k_itvviu
            : t.qualitative.k_xv5pr1}
        </div>
      )}

      {/* CSV出力 */}
      {csvOutput && (
        <div
          className="p-4"
          style={{
            backgroundColor: "var(--color-bg-secondary)",
            borderRadius: "10px",
            border: "1px solid var(--color-border-primary)",
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <h4
              className="text-xs font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              QCA CSV 出力
            </h4>
            <button
              type="button"
              onClick={handleCopyCsv}
              className="text-xs px-2 py-0.5 inline-flex items-center gap-1"
              style={{
                backgroundColor: "var(--color-accent-primary)",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              <IconCopy size={10} />
              コピー
            </button>
          </div>
          <pre
            className="text-xs p-3 overflow-auto"
            style={{
              backgroundColor: "var(--color-bg-primary)",
              color: "var(--color-text-primary)",
              borderRadius: "6px",
              fontFamily: "monospace",
              whiteSpace: "pre-wrap",
              maxHeight: "200px",
            }}
          >
            {csvOutput}
          </pre>
        </div>
      )}
    </div>
  );
};
