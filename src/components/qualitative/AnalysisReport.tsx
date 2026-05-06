// src/components/qualitative/AnalysisReport.tsx
// 分析レポート生成 — セクション選択 + マークダウンプレビュー + ダウンロード
// Rust backend: generate_analysis_report(project_id, sections: Vec<String>) → String (markdown)

import React, { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface AnalysisReportProps {
  projectId: string;
}

const REPORT_SECTIONS: { key: string; label: string; icon: string; description: string }[] = [
  { key: "codebook", label: "コードブック", icon: "🏷", description: "コード一覧とその定義・割当数" },
  { key: "matrix", label: "コーディングマトリクス", icon: "▦", description: "コード×論文の頻度マトリクス" },
  { key: "timeline", label: "タイムライン", icon: "⏤", description: "時系列イベント一覧" },
  { key: "actors", label: "アクターマップ", icon: "⊛", description: "アクター一覧と関係" },
  { key: "process_tracing", label: "プロセス・トレーシング", icon: "→", description: "仮説・証拠・総合評価" },
  { key: "comparative", label: "比較ケース設計", icon: "⊞", description: "比較デザインのマトリックス" },
  { key: "framing", label: "フレーミング分析", icon: "☐", description: "フレーム定義一覧" },
];

export const AnalysisReport: React.FC<AnalysisReportProps> = ({ projectId }) => {
  const [selectedSections, setSelectedSections] = useState<Set<string>>(
    new Set(REPORT_SECTIONS.map((s) => s.key))
  );
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSection = (key: string) => {
    setSelectedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedSections.size === REPORT_SECTIONS.length) {
      setSelectedSections(new Set());
    } else {
      setSelectedSections(new Set(REPORT_SECTIONS.map((s) => s.key)));
    }
  };

  const handleGenerate = useCallback(async () => {
    if (selectedSections.size === 0) return;
    setLoading(true);
    setError(null);
    try {
      const sections = Array.from(selectedSections);
      const report = await invoke<string>("generate_analysis_report", {
        projectId,
        sections,
      });
      setMarkdown(report);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedSections]);

  const handleDownload = useCallback(() => {
    if (!markdown) return;
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analysis_report_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [markdown]);

  const handleCopyToClipboard = useCallback(async () => {
    if (!markdown) return;
    try {
      await navigator.clipboard.writeText(markdown);
    } catch {
      // fallback
      const textarea = document.createElement("textarea");
      textarea.value = markdown;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  }, [markdown]);

  /** 簡易マークダウン → HTML 変換（プレビュー用） */
  const renderMarkdownPreview = (md: string) => {
    const lines = md.split("\n");
    const html: string[] = [];
    let inTable = false;

    for (const line of lines) {
      if (line.startsWith("# ")) {
        html.push(`<h1 style="font-size:1.3em;font-weight:700;margin:1em 0 0.5em;border-bottom:1px solid var(--color-border-secondary);padding-bottom:0.3em">${esc(line.slice(2))}</h1>`);
      } else if (line.startsWith("## ")) {
        html.push(`<h2 style="font-size:1.1em;font-weight:600;margin:1em 0 0.4em;color:var(--color-accent-primary)">${esc(line.slice(3))}</h2>`);
      } else if (line.startsWith("### ")) {
        html.push(`<h3 style="font-size:1em;font-weight:600;margin:0.8em 0 0.3em">${esc(line.slice(4))}</h3>`);
      } else if (line.startsWith("- **")) {
        // Bold list item
        const formatted = esc(line.slice(2)).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        html.push(`<div style="padding-left:1em;margin:0.2em 0">${formatted}</div>`);
      } else if (line.startsWith("- ")) {
        const formatted = esc(line.slice(2)).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        html.push(`<div style="padding-left:1em;margin:0.2em 0">• ${formatted}</div>`);
      } else if (line.startsWith("|")) {
        if (!inTable) {
          html.push('<table style="border-collapse:collapse;width:100%;margin:0.5em 0;font-size:0.85em">');
          inTable = true;
        }
        if (line.match(/^\|[-| ]+\|$/)) {
          // separator row — skip
          continue;
        }
        const cells = line.split("|").filter((c) => c.trim() !== "");
        const tag = !html.some((h) => h.includes("<tbody>")) ? "th" : "td";
        if (tag === "th") {
          html.push("<thead><tr>");
          for (const cell of cells) {
            html.push(`<th style="border:1px solid var(--color-border-secondary);padding:4px 8px;background:var(--color-bg-secondary);font-weight:600;text-align:left">${esc(cell.trim())}</th>`);
          }
          html.push("</tr></thead><tbody>");
        } else {
          html.push("<tr>");
          for (const cell of cells) {
            html.push(`<td style="border:1px solid var(--color-border-secondary);padding:4px 8px">${esc(cell.trim())}</td>`);
          }
          html.push("</tr>");
        }
      } else {
        if (inTable) {
          html.push("</tbody></table>");
          inTable = false;
        }
        if (line.startsWith("**") && line.endsWith("**")) {
          html.push(`<p style="margin:0.3em 0"><strong>${esc(line.slice(2, -2))}</strong></p>`);
        } else if (line.startsWith("---")) {
          html.push('<hr style="border:none;border-top:1px solid var(--color-border-secondary);margin:1em 0">');
        } else if (line.trim()) {
          const formatted = esc(line).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
          html.push(`<p style="margin:0.2em 0">${formatted}</p>`);
        }
      }
    }
    if (inTable) {
      html.push("</tbody></table>");
    }
    return html.join("\n");
  };

  function esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
              分析レポート
            </h3>
            <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
              セクションを選択してMarkdownレポートを生成
            </p>
          </div>
          <div className="flex gap-2">
            {markdown && (
              <>
                <button
                  onClick={handleCopyToClipboard}
                  className="text-xs px-3 py-1.5"
                  style={{
                    backgroundColor: "var(--color-bg-hover)",
                    color: "var(--color-text-secondary)",
                    borderRadius: "6px",
                    border: "1px solid var(--color-border-secondary)",
                    cursor: "pointer",
                  }}
                >
                  コピー
                </button>
                <button
                  onClick={handleDownload}
                  className="text-xs px-3 py-1.5 flex items-center gap-1"
                  style={{
                    backgroundColor: "var(--color-bg-hover)",
                    color: "var(--color-text-secondary)",
                    borderRadius: "6px",
                    border: "1px solid var(--color-border-secondary)",
                    cursor: "pointer",
                  }}
                >
                  ダウンロード (.md)
                </button>
              </>
            )}
            <button
              onClick={handleGenerate}
              disabled={loading || selectedSections.size === 0}
              className="text-xs px-4 py-1.5"
              style={{
                backgroundColor: "var(--color-accent-primary)",
                color: "white",
                borderRadius: "6px",
                border: "none",
                cursor: loading || selectedSections.size === 0 ? "not-allowed" : "pointer",
                opacity: loading || selectedSections.size === 0 ? 0.5 : 1,
              }}
            >
              {loading ? "生成中..." : "レポート生成"}
            </button>
          </div>
        </div>

        {/* セクション選択 */}
        <div
          className="mb-6 p-4"
          style={{
            backgroundColor: "var(--color-bg-secondary)",
            border: "1px solid var(--color-border-secondary)",
            borderRadius: "10px",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
              含めるセクション ({selectedSections.size}/{REPORT_SECTIONS.length})
            </span>
            <button
              onClick={toggleAll}
              className="text-xs"
              style={{ color: "var(--color-accent-primary)", background: "none", border: "none", cursor: "pointer" }}
            >
              {selectedSections.size === REPORT_SECTIONS.length ? "すべて解除" : "すべて選択"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {REPORT_SECTIONS.map((section) => {
              const checked = selectedSections.has(section.key);
              return (
                <label
                  key={section.key}
                  className="flex items-start gap-2 p-2 cursor-pointer"
                  style={{
                    borderRadius: "6px",
                    backgroundColor: checked ? "rgba(99,102,241,0.08)" : "transparent",
                    border: `1px solid ${checked ? "var(--color-accent-primary)" : "var(--color-border-secondary)"}`,
                    transition: "all 0.15s",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSection(section.key)}
                    style={{ marginTop: "2px" }}
                  />
                  <div>
                    <div className="flex items-center gap-1">
                      <span>{section.icon}</span>
                      <span className="text-xs font-medium" style={{ color: "var(--color-text-primary)" }}>
                        {section.label}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: "var(--color-text-tertiary)", marginTop: "2px" }}>
                      {section.description}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* エラー */}
        {error && (
          <div
            className="mb-4 p-3"
            style={{
              backgroundColor: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "8px",
              color: "#ef4444",
            }}
          >
            <p className="text-xs">{error}</p>
          </div>
        )}

        {/* レポートプレビュー */}
        {markdown && (
          <div>
            {/* プレビュータブ */}
            <div className="flex gap-2 mb-3">
              <span className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
                プレビュー
              </span>
            </div>

            {/* レンダリング済みプレビュー */}
            <div
              className="p-6 mb-4"
              style={{
                backgroundColor: "var(--color-bg-primary)",
                border: "1px solid var(--color-border-secondary)",
                borderRadius: "10px",
                color: "var(--color-text-primary)",
                fontSize: "13px",
                lineHeight: "1.6",
              }}
              // biome-ignore lint/security/noDangerouslySetInnerHtml: intentional markdown preview
              dangerouslySetInnerHTML={{ __html: renderMarkdownPreview(markdown) }}
            />

            {/* 生のMarkdown */}
            <details className="mb-4">
              <summary
                className="text-xs cursor-pointer"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                Markdownソースを表示
              </summary>
              <pre
                className="mt-2 p-4 overflow-x-auto text-xs"
                style={{
                  backgroundColor: "var(--color-bg-tertiary)",
                  color: "var(--color-text-secondary)",
                  borderRadius: "8px",
                  border: "1px solid var(--color-border-secondary)",
                  fontFamily: "monospace",
                  lineHeight: "1.5",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {markdown}
              </pre>
            </details>
          </div>
        )}

        {/* 未生成時のプレースホルダー */}
        {!markdown && !loading && (
          <div className="flex flex-col items-center justify-center py-12" style={{ color: "var(--color-text-tertiary)" }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ opacity: 0.4 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <p className="text-sm mt-2">セクションを選択して「レポート生成」をクリック</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisReport;
