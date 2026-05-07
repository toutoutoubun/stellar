// src/components/qualitative/SourceCritiqueForm.tsx
// 史料批判シート — 論文単位の史料評価フォーム
// 折りたたみパネル / ミニマルUI / カスタムアイコン / ヘルプ付き

import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "../../lib/tauriShim";
import { swalConfirm } from "../../lib/swal";
import type { SourceCritique, SourceCritiqueInput, Paper } from "../../types";
import { HelpTooltip } from "./HelpTooltip";
import { IconDelete, IconPanelLeft, IconScroll } from "./icons/QualIcons";
import { useT } from "../../stores/useI18nStore";

interface SourceCritiqueFormProps {
  projectId: string;
}

export const SourceCritiqueForm: React.FC<SourceCritiqueFormProps> = ({
  projectId,
}) => {
  const t = useT();
  const [critiques, setCritiques] = useState<SourceCritique[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [listCollapsed, setListCollapsed] = useState(false);

  // フォーム状態
  const [form, setForm] = useState<SourceCritiqueInput>({
    paperId: "",
    authorInfo: "",
    creationDate: "",
    isDateEstimated: false,
    location: "",
    sourceType: "",
    authenticity: "",
    archiveInfo: "",
    intent: "",
    audience: "",
    biasLevel: "",
    biasReason: "",
    consistency: "",
    reliabilityScore: 3,
    researcherNotes: "",
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [paperResult, critiqueList] = await Promise.all([
          invoke<{ items: Paper[] } | Paper[]>("get_papers", { page: 1, perPage: 500, sortBy: "title", sortDir: "asc", search: "" }),
          invoke<SourceCritique[]>("get_source_critiques_by_project", { projectId }),
        ]);
        // get_papers は { items: Paper[] } を返す場合と Paper[] を返す場合の両方に対応
        const paperList = Array.isArray(paperResult) ? paperResult : (paperResult?.items ?? []);
        setPapers(paperList);
        setCritiques(critiqueList);
      } catch (err) {
        console.error(t.qualitative.k_ro7ypi, err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [projectId]);

  const handleSelectPaper = useCallback(
    async (paperId: string) => {
      setSelectedPaperId(paperId);
      try {
        const existing = await invoke<SourceCritique | null>("get_source_critique", { paperId });
        if (existing) {
          setForm({
            paperId,
            authorInfo: existing.authorInfo ?? "",
            creationDate: existing.creationDate ?? "",
            isDateEstimated: existing.isDateEstimated,
            location: existing.location ?? "",
            sourceType: existing.sourceType ?? "",
            authenticity: existing.authenticity ?? "",
            archiveInfo: existing.archiveInfo ?? "",
            intent: existing.intent ?? "",
            audience: existing.audience ?? "",
            biasLevel: existing.biasLevel ?? "",
            biasReason: existing.biasReason ?? "",
            consistency: existing.consistency ?? "",
            reliabilityScore: existing.reliabilityScore,
            researcherNotes: existing.researcherNotes ?? "",
          });
        } else {
          setForm({
            paperId,
            authorInfo: "",
            creationDate: "",
            isDateEstimated: false,
            location: "",
            sourceType: "",
            authenticity: "",
            archiveInfo: "",
            intent: "",
            audience: "",
            biasLevel: "",
            biasReason: "",
            consistency: "",
            reliabilityScore: 3,
            researcherNotes: "",
          });
        }
      } catch (err) {
        console.error(t.qualitative.k_hhw8qa, err);
      }
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (!selectedPaperId) return;
    setSaving(true);
    try {
      await invoke("upsert_source_critique", {
        dto: { ...form, paperId: selectedPaperId },
      });
      const updated = await invoke<SourceCritique[]>(
        "get_source_critiques_by_project",
        { projectId }
      );
      setCritiques(updated);
    } catch (err) {
      console.error(t.qualitative.k_gl6mks, err);
    } finally {
      setSaving(false);
    }
  }, [selectedPaperId, form, projectId]);

  const handleDelete = useCallback(
    async (id: string) => {
      const ok = await swalConfirm(t.qualitative.k_t3c3je, t.qualitative.k_d2dlnr);
      if (!ok) return;
      try {
        await invoke("delete_source_critique", { id });
        setCritiques((prev) => prev.filter((c) => c.id !== id));
        if (critiques.find((c) => c.id === id)?.paperId === selectedPaperId) {
          setSelectedPaperId(null);
        }
      } catch (err) {
        console.error(t.qualitative.k_qrch2t, err);
      }
    },
    [critiques, selectedPaperId]
  );

  const updateField = (field: keyof SourceCritiqueInput, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: "var(--color-text-tertiary)" }}>
        <span className="text-sm">{t.common.loading}</span>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* 左: 論文一覧 + 既存批判 */}
      <div
        className="flex flex-col shrink-0 h-full"
        style={{
          width: listCollapsed ? "40px" : "260px",
          borderRight: "1px solid var(--color-border-primary)",
          transition: "width 150ms ease-out",
          overflow: "hidden",
        }}
      >
        <header
          className="px-2 shrink-0 flex items-center justify-between"
          style={{
            height: "40px",
            borderBottom: "1px solid var(--color-border-primary)",
          }}
        >
          {!listCollapsed && (
            <span className="text-xs font-semibold" style={{ color: "var(--color-text-tertiary)" }}>
              論文一覧
            </span>
          )}
          <button
            type="button"
            onClick={() => setListCollapsed(!listCollapsed)}
            title={listCollapsed ? t.qualitative.k_gixi : t.qualitative.k_yczceq}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)", padding: "4px", display: "flex" }}
          >
            <IconPanelLeft size={13} />
          </button>
        </header>

        {!listCollapsed && (
          <>
            <div className="flex-1 overflow-y-auto p-2">
              {papers.map((p) => {
                const hasCritique = critiques.some((c) => c.paperId === p.id);
                return (
                  <div
                    key={p.id}
                    onClick={() => void handleSelectPaper(p.id)}
                    className="flex items-center gap-2 py-1.5 px-2 group"
                    style={{
                      borderRadius: "6px",
                      cursor: "pointer",
                      backgroundColor: selectedPaperId === p.id ? "var(--color-bg-hover)" : "transparent",
                    }}
                  >
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        backgroundColor: hasCritique ? "#22c55e" : "var(--color-border-secondary)",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      className="text-xs truncate flex-1"
                      style={{
                        color: selectedPaperId === p.id
                          ? "var(--color-accent-primary)"
                          : "var(--color-text-secondary)",
                      }}
                    >
                      {p.title}
                    </span>
                  </div>
                );
              })}
              {papers.length === 0 && (
                <div className="text-center py-8 text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                  論文なし
                </div>
              )}
            </div>

            {critiques.length > 0 && (
              <div
                className="shrink-0 p-2"
                style={{ borderTop: "1px solid var(--color-border-primary)" }}
              >
                <div className="text-xs font-semibold mb-1" style={{ color: "var(--color-text-tertiary)" }}>
                  批判済み ({critiques.length})
                </div>
                {critiques.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between py-1 text-xs group"
                  >
                    <span
                      className="truncate flex-1 cursor-pointer"
                      style={{ color: "var(--color-text-secondary)" }}
                      onClick={() => void handleSelectPaper(c.paperId)}
                    >
                      信頼度: {c.reliabilityScore}/5
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleDelete(c.id)}
                      className="opacity-0 group-hover:opacity-100"
                      title={t.common.delete}
                      style={{ color: "var(--color-text-tertiary)", background: "none", border: "none", cursor: "pointer", display: "flex", padding: "2px" }}
                    >
                      <IconDelete size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* 右: フォーム */}
      <div className="flex-1 overflow-y-auto p-6" style={{ maxWidth: "700px" }}>
        <HelpTooltip
          storageKey="qual_source_critique"
          title={t.qualitative.k_gi9vkn}
          paragraphs={[
            t.qualitative.k_x1ainh,
            t.qualitative.k_2w45w2,
          ]}
          steps={[
            t.qualitative.k_xhv9sn,
            t.qualitative.k_rin3zk,
            t.qualitative.k_gdavtt,
          ]}
        />

        {selectedPaperId ? (
          <>
            <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
              史料批判シート
            </h3>

            <div className="flex flex-col gap-4">
              <FormField label={t.qualitative.k_h84k62} value={form.authorInfo ?? ""} onChange={(v) => updateField("authorInfo", v)} />
              <div className="flex gap-3">
                <div className="flex-1">
                  <FormField label={t.qualitative.k_af5ueb} value={form.creationDate ?? ""} onChange={(v) => updateField("creationDate", v)} />
                </div>
                <label className="flex items-center gap-1 text-xs self-end pb-1" style={{ color: "var(--color-text-secondary)" }}>
                  <input
                    type="checkbox"
                    checked={form.isDateEstimated ?? false}
                    onChange={(e) => updateField("isDateEstimated", e.target.checked)}
                  />
                  推定日付
                </label>
              </div>
              <FormField label={t.qualitative.k_af4vy8} value={form.location ?? ""} onChange={(v) => updateField("location", v)} />
              <FormField label={t.qualitative.k_b0muhq} value={form.sourceType ?? ""} onChange={(v) => updateField("sourceType", v)} placeholder={t.qualitative.k_frszp6} />
              <FormField label={t.qualitative.k_hywzn} value={form.authenticity ?? ""} onChange={(v) => updateField("authenticity", v)} multiline />
              <FormField label={t.qualitative.k_z0avyv} value={form.archiveInfo ?? ""} onChange={(v) => updateField("archiveInfo", v)} />
              <FormField label={t.qualitative.k_af6by0} value={form.intent ?? ""} onChange={(v) => updateField("intent", v)} multiline />
              <FormField label={t.qualitative.k_cmaudb} value={form.audience ?? ""} onChange={(v) => updateField("audience", v)} />

              <div className="flex gap-3">
                <div className="flex-1">
                  <FormField label={t.qualitative.k_5v6jn1} value={form.biasLevel ?? ""} onChange={(v) => updateField("biasLevel", v)} placeholder={t.qualitative.k_qapyk5} />
                </div>
                <div className="flex-1">
                  <FormField label={t.qualitative.k_4ehmxi} value={form.biasReason ?? ""} onChange={(v) => updateField("biasReason", v)} />
                </div>
              </div>

              <FormField label={t.qualitative.k_ft5e40} value={form.consistency ?? ""} onChange={(v) => updateField("consistency", v)} multiline />

              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--color-text-tertiary)" }}>
                  信頼度スコア: {form.reliabilityScore}/5
                </label>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={form.reliabilityScore ?? 3}
                  onChange={(e) => updateField("reliabilityScore", Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>

              <FormField label={t.qualitative.k_bqngho} value={form.researcherNotes ?? ""} onChange={(v) => updateField("researcherNotes", v)} multiline />

              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="text-sm px-4 py-2"
                style={{
                  backgroundColor: "var(--color-accent-primary)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.6 : 1,
                  alignSelf: "flex-start",
                }}
              >
                {saving ? t.qualitative.k_vts3p8 : t.settings.shortcuts.items.save}
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: "var(--color-text-tertiary)" }}>
            <IconScroll size={28} />
            <span className="text-sm">{t.qualitative.k_xhv9sn}</span>
          </div>
        )}
      </div>
    </div>
  );
};

/** 共通のフォームフィールド */
const FormField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}> = ({ label, value, onChange, placeholder, multiline }) => (
  <div>
    <label className="text-xs mb-1 block" style={{ color: "var(--color-text-tertiary)" }}>
      {label}
    </label>
    {multiline ? (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full text-xs px-2 py-1.5"
        style={{
          backgroundColor: "var(--color-bg-primary)",
          color: "var(--color-text-primary)",
          border: "1px solid var(--color-border-primary)",
          borderRadius: "6px",
          outline: "none",
          resize: "vertical",
        }}
      />
    ) : (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-xs px-2 py-1.5"
        style={{
          backgroundColor: "var(--color-bg-primary)",
          color: "var(--color-text-primary)",
          border: "1px solid var(--color-border-primary)",
          borderRadius: "6px",
          outline: "none",
        }}
      />
    )}
  </div>
);
