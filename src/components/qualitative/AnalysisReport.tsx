// src/components/qualitative/AnalysisReport.tsx
// 分析レポート生成 — Markdown形式のレポートをバックエンドで生成・表示
// ミニマルUI / カスタムアイコン / ヘルプ付き

import React, { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { HelpTooltip } from "./HelpTooltip";
import { IconReport, IconCopy } from "./icons/QualIcons";

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
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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
      console.error("レポート生成エラー:", err);
      setReport(`エラー: ${typeof err === "string" ? err : "レポート生成に失敗しました"}`);
    } finally {
      setLoading(false);
    }
  }, [projectId, sections]);

  const handleCopy = useCallback(() => {
    if (report) {
      void navigator.clipboard.writeText(report);
    }
  }, [report]);

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
    { key: "codebook", label: "コードブック" },
    { key: "matrix", label: "コーディングマトリクス" },
    { key: "timeline", label: "タイムライン" },
    { key: "actors", label: "アクターマップ" },
    { key: "process_tracing", label: "プロセストレーシング" },
    { key: "comparative", label: "比較デザイン" },
    { key: "framing", label: "フレーミング分析" },
  ];

  return (
    <div className="p-6 h-full overflow-y-auto">
      <HelpTooltip
        storageKey="qual_report"
        title="分析レポートの使い方"
        paragraphs={[
          "プロジェクトに蓄積された分析データからMarkdown形式のレポートを自動生成します。",
          "含めるセクションを選択して生成ボタンを押してください。生成されたMarkdownはコピーして外部ツールで利用できます。",
        ]}
        steps={[
          "レポートに含めるセクションをチェックボックスで選択します",
          "生成ボタンを押すとバックエンドでレポートが作成されます",
          "生成後、コピーボタンでMarkdownをクリップボードにコピーできます",
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
            {allSelected ? "全解除" : "全選択"}
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
        {loading ? "生成中..." : "レポートを生成"}
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
            <button
              type="button"
              onClick={handleCopy}
              className="text-xs px-3 py-1 inline-flex items-center gap-1"
              style={{
                backgroundColor: "var(--color-bg-tertiary)",
                color: "var(--color-text-secondary)",
                border: "1px solid var(--color-border-secondary)",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              <IconCopy size={11} />
              Markdownをコピー
            </button>
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
