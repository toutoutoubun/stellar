// src/components/qualitative/AnalysisReport.tsx
// 分析レポート生成 — Markdown形式のレポートをバックエンドで生成・表示
// ミニマルUI / カスタムアイコン / ヘルプ付き

import React, { useState, useCallback } from "react";
import { invoke } from "../../lib/tauriShim";
import { HelpTooltip } from "./HelpTooltip";
import { IconReport, IconCopy } from "./icons/QualIcons";
import { useNoteStore } from "../../stores/useNoteStore";
import { toast } from "../ui/Toast";
import { useT } from "../../stores/useI18nStore";

interface AnalysisReportProps {
  projectId: string;
}

/** レポートセクション選択
 *  キー名はバックエンド generate_analysis_report の sections: Vec<String> と一致させる。
 *  backend: "codebook" | "matrix" | "timeline" | "actors" | "process_tracing" | "comparative" | "framing"
 */
interface ReportSections {
  codebook: boolean;
  matrix: boolean;
  timeline: boolean;
  actors: boolean;
  process_tracing: boolean;
  comparative: boolean;
  framing: boolean;
}

export const AnalysisReport: React.FC<AnalysisReportProps> = ({
  projectId,
}) => {
  const t = useT();
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exportingNote, setExportingNote] = useState(false);
  const createNote = useNoteStore((s) => s.createNote);
  const [sections, setSections] = useState<ReportSections>({
    codebook: true,
    matrix: true,
    timeline: true,
    actors: true,
    process_tracing: true,
    comparative: true,
    framing: true,
  });

  const handleGenerate = useCallback(async () => {
    const t = useT();
    setLoading(true);
    try {
      const sectionList = (Object.keys(sections) as (keyof ReportSections)[])
        .filter((k) => sections[k]);
      const result = await invoke<string>("generate_analysis_report", {
        projectId,
        sections: sectionList,
      });
      setReport(result);
    } catch (err) {
      console.error(t.qualitative.k_8gkv65, err);
      setReport(`${t.common.error ?? "Error"}: ${typeof err === "string" ? err : t.qualitative.k_xbkqi6}`);
    } finally {
      setLoading(false);
    }
  }, [projectId, sections]);

  const handleCopy = useCallback(() => {
    if (report) {
      void navigator.clipboard.writeText(report);
      toast.success(t.qualitative.k_rexm4q);
    }
  }, [report]);

  /** レポートをノートに出力 */
  const handleExportToNote = useCallback(async () => {
    if (!report) return;
    setExportingNote(true);
    try {
      const selectedNames = (Object.keys(sections) as (keyof ReportSections)[])
        .filter((k) => sections[k])
        .map((k) => SECTION_LABELS_MAP[k] ?? k);
      const title = t.qualitative.k_report_title_fmt.replace("${names}", `${selectedNames.slice(0, 3).join(t.stats.k_9ob)}${selectedNames.length > 3 ? "…" : ""}`);
      const tags = [t.qualitative.k_it0yjj, t.qualitative.k_pbsye];
      await createNote({ title, content: report, tags });
      toast.success(t.qualitative.k_fpwqww);
    } catch (err) {
      console.error(t.qualitative.k_pszidi, err);
      toast.error(t.notes.createFailed);
    } finally {
      setExportingNote(false);
    }
  }, [report, sections, createNote]);

  const toggleSection = (key: keyof ReportSections) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const allSelected = Object.values(sections).every(Boolean);
  const toggleAll = () => {
    const newVal = !allSelected;
    setSections({
      codebook: newVal,
      matrix: newVal,
      timeline: newVal,
      actors: newVal,
      process_tracing: newVal,
      comparative: newVal,
      framing: newVal,
    });
  };

  const SECTION_LABELS: { key: keyof ReportSections; label: string }[] = [
    { key: "codebook", label: t.qualitative.k_7z1tpa },
    { key: "matrix", label: t.qualitative.k_5l342g },
    { key: "timeline", label: t.qualitative.k_3mh737 },
    { key: "actors", label: t.qualitative.k_yybalk },
    { key: "process_tracing", label: t.qualitative.k_vz7qeo },
    { key: "comparative", label: t.qualitative.k_2mss8j },
    { key: "framing", label: t.qualitative.k_37exdr },
  ];

  const SECTION_LABELS_MAP: Record<string, string> = Object.fromEntries(
    SECTION_LABELS.map(({ key, label }) => [key, label]),
  );

  return (
    <div className="p-6 h-full overflow-y-auto">
      <HelpTooltip
        storageKey="qual_report"
        title={t.qualitative.k_q58qfh}
        paragraphs={[
          t.qualitative.k_bjnjkr,
          t.qualitative.k_t3hwr2,
        ]}
        steps={[
          t.qualitative.k_pi9sj2,
          t.qualitative.k_3zwdi0,
          t.qualitative.k_izm5ys,
        ]}
      />

      <h3
        className="text-sm font-semibold mb-4 flex items-center gap-2"
        style={{ color: "var(--color-text-primary)" }}
      >
        <IconReport size={16} />
        分析レポート生成
      </h3>

      <p
        className="text-xs mb-4"
        style={{ color: "var(--color-text-secondary)", lineHeight: "1.6" }}
      >
        プロジェクトのデータからMarkdown形式の分析レポートを生成します。
        含めるセクションを選択してください。
      </p>

      {/* セクション選択 */}
      <div
        className="mb-6 p-4"
        style={{
          backgroundColor: "var(--color-bg-secondary)",
          borderRadius: "10px",
          border: "1px solid var(--color-border-primary)",
          maxWidth: "500px",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-xs font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            セクション選択
          </span>
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs"
            style={{
              color: "var(--color-accent-primary)",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            {allSelected ? t.qualitative.k_clj61 : t.qualitative.k_cmd8u}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {SECTION_LABELS.map(({ key, label }) => (
            <label
              key={key}
              className="flex items-center gap-2 text-xs cursor-pointer py-1"
              style={{ color: "var(--color-text-secondary)" }}
            >
              <input
                type="checkbox"
                checked={sections[key]}
                onChange={() => toggleSection(key)}
                style={{ accentColor: "var(--color-accent-primary)" }}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* 生成ボタン */}
      <button
        type="button"
        onClick={() => void handleGenerate()}
        disabled={loading || !Object.values(sections).some(Boolean)}
        className="text-sm px-6 py-2.5 mb-6 inline-flex items-center gap-1.5"
        style={{
          backgroundColor: "var(--color-accent-primary)",
          color: "#fff",
          border: "none",
          borderRadius: "10px",
          cursor:
            loading || !Object.values(sections).some(Boolean)
              ? "not-allowed"
              : "pointer",
          opacity:
            loading || !Object.values(sections).some(Boolean) ? 0.5 : 1,
          transition: "opacity 150ms ease-out",
        }}
      >
        <IconReport size={14} color="#fff" />
        {loading ? t.qualitative.k_s41ylu : t.qualitative.k_7aumh2}
      </button>

      {/* レポート表示 */}
      {report && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4
              className="text-sm font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              生成されたレポート
            </h4>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleExportToNote()}
                disabled={exportingNote}
                className="text-xs px-3 py-1.5 inline-flex items-center gap-1.5"
                style={{
                  backgroundColor: "var(--color-accent-primary)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: exportingNote ? "not-allowed" : "pointer",
                  opacity: exportingNote ? 0.6 : 1,
                  transition: "opacity 150ms",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                {exportingNote ? t.qualitative.k_2zb0kr : t.qualitative.k_4t8ype}
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs px-3 py-1.5 inline-flex items-center gap-1"
                style={{
                  backgroundColor: "var(--color-bg-tertiary)",
                  color: "var(--color-text-secondary)",
                  border: "1px solid var(--color-border-secondary)",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                <IconCopy size={11} />
                コピー
              </button>
            </div>
          </div>

          {/* Markdown プレビュー（プレーンテキスト表示） */}
          <div
            className="p-6"
            style={{
              backgroundColor: "var(--color-bg-secondary)",
              borderRadius: "10px",
              border: "1px solid var(--color-border-primary)",
              maxHeight: "600px",
              overflowY: "auto",
            }}
          >
            <pre
              className="text-xs"
              style={{
                color: "var(--color-text-primary)",
                fontFamily:
                  '"Noto Sans JP", "Hiragino Kaku Gothic ProN", system-ui, sans-serif',
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                lineHeight: "1.8",
              }}
            >
              {report}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
