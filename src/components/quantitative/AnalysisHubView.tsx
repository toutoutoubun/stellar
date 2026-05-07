// src/components/quantitative/AnalysisHubView.tsx
// Stellar — 分析ハブ: 左サイドバー（保存済み分析一覧）＋ 右パネル（分析結果表示）
// 2パネルレイアウト: 左300px固定、右flex-1

import type React from "react";
import { useState, useCallback, useMemo } from "react";
import { useQuantitativeStore } from "../../stores/useQuantitativeStore";
import { useNoteStore } from "../../stores/useNoteStore";
import { toast } from "../ui/Toast";
import { AnalysisWizard } from "./AnalysisWizard";
import { DescriptiveResult } from "./results/DescriptiveResult";
import { InferentialResult } from "./results/InferentialResult";
import { SurveyResult } from "./results/SurveyResult";
import { TextAnalysisView } from "./results/TextAnalysisView";
import { NetworkAnalysisView } from "./results/NetworkAnalysisView";
import { ReportBuilder } from "./ReportBuilder";
import type { Analysis } from "../../types";

// ── 分析カテゴリ定義 ──
const ANALYSIS_GROUPS: {
  key: string;
  label: string;
  icon: React.ReactNode;
  types: string[];
}[] = [
  {
    key: "descriptive",
    label: "記述統計",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    types: ["descriptive", "correlation"],
  },
  {
    key: "inferential",
    label: "推測統計",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
    types: ["t-test", "mann-whitney", "chi-square"],
  },
  {
    key: "regression",
    label: "回帰分析",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="2" y1="20" x2="22" y2="4" />
        <circle cx="6" cy="16" r="1.5" />
        <circle cx="10" cy="12" r="1.5" />
        <circle cx="14" cy="10" r="1.5" />
        <circle cx="18" cy="6" r="1.5" />
      </svg>
    ),
    types: ["regression"],
  },
  {
    key: "network",
    label: "ネットワーク",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="5" r="3" />
        <circle cx="5" cy="19" r="3" />
        <circle cx="19" cy="19" r="3" />
        <line x1="12" y1="8" x2="5" y2="16" />
        <line x1="12" y1="8" x2="19" y2="16" />
      </svg>
    ),
    types: ["network"],
  },
  {
    key: "text",
    label: "テキスト",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    types: ["text"],
  },
];

// ── カテゴリ色 ──
const GROUP_COLORS: Record<string, string> = {
  descriptive: "var(--color-accent-primary)",
  inferential: "var(--color-accent-warning)",
  regression: "var(--color-accent-secondary)",
  network: "var(--color-accent-info)",
  text: "#a78bfa",
};

/** 分析タイプからカテゴリキーを引く */
function getGroupKey(analysisType: string): string {
  for (const g of ANALYSIS_GROUPS) {
    if (g.types.includes(analysisType)) return g.key;
  }
  return "descriptive";
}

/** 分析タイプの日本語ラベル */
function analysisTypeLabel(t: string): string {
  const map: Record<string, string> = {
    descriptive: "記述統計",
    correlation: "相関分析",
    "t-test": "t検定",
    "mann-whitney": "Mann-Whitney U検定",
    "chi-square": "カイ二乗検定",
    regression: "回帰分析",
    network: "ネットワーク分析",
    text: "テキスト分析",
    survey: "調査集計",
  };
  return map[t] ?? t;
}

// ── メインコンポーネント ──
/** 分析結果を簡易Markdownに変換（AI不使用） */
function analysisToMarkdown(a: Analysis): string {
  const lines: string[] = [];
  lines.push(`## ${a.name}`);
  lines.push(``);
  lines.push(`- **分析タイプ:** ${analysisTypeLabel(a.analysisType)}`);
  lines.push(`- **実行日時:** ${new Date(a.createdAt).toLocaleString("ja-JP")}`);
  lines.push(``);

  const r = a.result as Record<string, unknown> | null;
  if (!r) {
    lines.push(`*結果データなし*`);
    return lines.join("\n");
  }

  // 記述統計
  const descs = (r.descriptives as Array<Record<string, unknown>>) ?? [];
  if (descs.length > 0) {
    lines.push(`### 記述統計`);
    lines.push(`| 変数 | N | 平均 | 標準偏差 | 最小 | 最大 |`);
    lines.push(`|---|---|---|---|---|---|`);
    for (const d of descs) {
      lines.push(`| ${d.variableName ?? d.variable} | ${d.n ?? d.count ?? "-"} | ${typeof d.mean === "number" ? d.mean.toFixed(3) : "-"} | ${typeof d.sd === "number" ? d.sd.toFixed(3) : "-"} | ${d.min ?? "-"} | ${d.max ?? "-"} |`);
    }
    lines.push(``);
  }

  // 推測統計 results 配列
  const results = (r.results as Array<Record<string, unknown>>) ?? [];
  if (results.length > 0) {
    lines.push(`### 検定結果`);
    for (const res of results) {
      const entries = Object.entries(res).filter(([k]) => k !== "interpretation");
      for (const [k, v] of entries) {
        lines.push(`- **${k}:** ${typeof v === "number" ? v.toFixed(4) : v}`);
      }
      if (typeof res.interpretation === "string") {
        lines.push(``);
        lines.push(`> ${res.interpretation}`);
      }
      lines.push(``);
    }
  }

  // 相関
  const correlations = (r.correlations as Array<Record<string, unknown>>) ?? [];
  if (correlations.length > 0) {
    lines.push(`### 相関`);
    lines.push(`| 変数1 | 変数2 | r | p |`);
    lines.push(`|---|---|---|---|`);
    for (const c of correlations) {
      lines.push(`| ${c.var1Name} | ${c.var2Name} | ${typeof c.r === "number" ? c.r.toFixed(3) : c.r} | ${typeof c.pValue === "number" ? c.pValue.toFixed(4) : c.pValue} |`);
    }
    lines.push(``);
  }

  // 回帰
  if (r.r2 != null) {
    lines.push(`### 回帰分析`);
    lines.push(`- **R²:** ${(r.r2 as number).toFixed(4)}`);
    if (r.fStatistic) lines.push(`- **F:** ${(r.fStatistic as number).toFixed(3)}`);
    if (r.fPValue != null) lines.push(`- **p(F):** ${(r.fPValue as number).toFixed(4)}`);
    const coefficients = (r.coefficients as Array<Record<string, unknown>>) ?? [];
    if (coefficients.length > 0) {
      lines.push(``);
      lines.push(`| 変数 | B | SE | t | p |`);
      lines.push(`|---|---|---|---|---|`);
      for (const c of coefficients) {
        lines.push(`| ${c.varName} | ${(c.b as number).toFixed(3)} | ${(c.stdError as number).toFixed(3)} | ${(c.t as number).toFixed(3)} | ${(c.pValue as number).toFixed(4)} |`);
      }
    }
    lines.push(``);
  }

  // interpretation
  if (typeof r.interpretation === "string") {
    lines.push(`### 解釈`);
    lines.push(r.interpretation as string);
    lines.push(``);
  }

  return lines.join("\n");
}

export const AnalysisHubView: React.FC = () => {
  const analyses = useQuantitativeStore((s) => s.analyses);
  const selectedDataset = useQuantitativeStore((s) => s.selectedDataset);
  const variables = useQuantitativeStore((s) => s.variables);
  const dataRows = useQuantitativeStore((s) => s.dataRows);
  const createNote = useNoteStore((s) => s.createNote);

  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [exportingNote, setExportingNote] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // グループ化された分析一覧
  const groupedAnalyses = useMemo(() => {
    const map = new Map<string, Analysis[]>();
    for (const g of ANALYSIS_GROUPS) {
      map.set(g.key, []);
    }
    for (const a of analyses) {
      const gk = getGroupKey(a.analysisType);
      const arr = map.get(gk);
      if (arr) arr.push(a);
      else map.set(gk, [a]);
    }
    return map;
  }, [analyses]);

  const selectedAnalysis = useMemo(
    () => analyses.find((a) => a.id === selectedAnalysisId) ?? null,
    [analyses, selectedAnalysisId],
  );

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!selectedDataset) return;
      try {
        // 楽観的に分析一覧から削除
        const store = useQuantitativeStore.getState();
        const prevAnalyses = store.analyses;
        useQuantitativeStore.setState({
          analyses: prevAnalyses.filter((a) => a.id !== id),
        });
        if (selectedAnalysisId === id) setSelectedAnalysisId(null);

        const { invoke } = await import("../../lib/tauriShim");
        await invoke("delete_analysis", { id });
      } catch {
        // ロールバック
        await useQuantitativeStore.getState().loadAnalyses(selectedDataset.id);
      }
    },
    [selectedDataset, selectedAnalysisId],
  );

  /** 全分析結果をノートに出力（AI不使用） */
  const handleExportAllToNote = useCallback(async () => {
    if (!selectedDataset || analyses.length === 0) return;
    setExportingNote(true);
    try {
      const now = new Date().toLocaleString("ja-JP");
      const mdParts: string[] = [
        `# 量的分析結果`,
        ``,
        `- **データセット:** ${selectedDataset.name}`,
        `- **分析数:** ${analyses.length}`,
        `- **出力日時:** ${now}`,
        ``,
        `---`,
        ``,
      ];
      for (const a of analyses) {
        mdParts.push(analysisToMarkdown(a));
        mdParts.push(`---`);
        mdParts.push(``);
      }
      const md = mdParts.join("\n");
      const tags = ["#量的研究", "#分析レポート"];
      const usedTypes = new Set(analyses.map((a) => a.analysisType));
      for (const t of usedTypes) tags.push(`#${analysisTypeLabel(t)}`);

      const note = await createNote({
        title: `量的分析: ${selectedDataset.name}（${analyses.length}件）`,
        content: md,
        tags,
      });
      toast.success(`ノート「${note.title}」を作成しました`);
    } catch (err) {
      console.error("ノート出力エラー:", err);
      toast.error("ノートの作成に失敗しました");
    } finally {
      setExportingNote(false);
    }
  }, [selectedDataset, analyses, createNote]);

  // ── 分析結果レンダリング ──
  const renderResult = () => {
    if (!selectedAnalysis || !selectedAnalysis.result) {
      return (
        <div
          className="flex flex-col items-center justify-center h-full gap-5 select-none"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          <svg
            width="56"
            height="56"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: 0.35 }}
          >
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
            <line x1="2" y1="20" x2="22" y2="20" />
          </svg>
          <div className="text-center">
            <p className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
              分析を選択するか、新しい分析を実行してください
            </p>
            <p className="text-xs mt-1">
              左パネルの「＋ 新しい分析」ボタンから分析ウィザードを開けます
            </p>
          </div>
        </div>
      );
    }

    const result = selectedAnalysis.result;
    const type = selectedAnalysis.analysisType;

    if (type === "descriptive" || type === "correlation") {
      return <DescriptiveResult analysis={selectedAnalysis} variables={variables} dataRows={dataRows} />;
    }
    if (type === "t-test" || type === "mann-whitney" || type === "chi-square" || type === "regression") {
      return <InferentialResult analysis={selectedAnalysis} variables={variables} dataRows={dataRows} />;
    }
    if (type === "survey") {
      return <SurveyResult analysis={selectedAnalysis} variables={variables} dataRows={dataRows} />;
    }
    if (type === "text") {
      return <TextAnalysisView analysis={selectedAnalysis} variables={variables} dataRows={dataRows} />;
    }
    if (type === "network") {
      return <NetworkAnalysisView analysis={selectedAnalysis} variables={variables} dataRows={dataRows} />;
    }

    // その他はJSON表示にフォールバック
    return (
      <div className="p-6 overflow-auto h-full">
        <div
          className="p-4"
          style={{
            backgroundColor: "var(--color-bg-secondary)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border-primary)",
          }}
        >
          <h3
            className="text-sm font-semibold mb-3"
            style={{ color: "var(--color-text-primary)" }}
          >
            {selectedAnalysis.name}
          </h3>
          <pre
            className="text-xs overflow-auto"
            style={{
              color: "var(--color-text-secondary)",
              maxHeight: "600px",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── 左サイドバー ── */}
      <div
        className="shrink-0 h-full flex flex-col overflow-hidden"
        style={{
          width: "300px",
          borderRight: "1px solid var(--color-border-primary)",
          backgroundColor: "var(--color-bg-secondary)",
        }}
      >
        {/* ヘッダー */}
        <div
          className="shrink-0 flex items-center justify-between px-4"
          style={{
            height: "48px",
            borderBottom: "1px solid var(--color-border-primary)",
          }}
        >
          <span
            className="text-xs font-semibold tracking-wide uppercase"
            style={{ color: "var(--color-text-tertiary)", letterSpacing: "0.08em" }}
          >
            分析一覧
          </span>
          <span
            className="text-xs px-1.5 py-0.5"
            style={{
              color: "var(--color-text-tertiary)",
              backgroundColor: "var(--color-bg-hover)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            {analyses.length}
          </span>
        </div>

        {/* 新規分析 & レポート作成ボタン */}
        <div className="shrink-0 px-3 py-2 flex flex-col gap-1.5">
          <button
            onClick={() => setWizardOpen(true)}
            disabled={!selectedDataset}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium"
            style={{
              color: selectedDataset ? "#fff" : "var(--color-text-disabled)",
              backgroundColor: selectedDataset
                ? "var(--color-accent-primary)"
                : "var(--color-bg-hover)",
              borderRadius: "var(--radius-md)",
              cursor: selectedDataset ? "pointer" : "not-allowed",
              transition: "all var(--transition-fast)",
              opacity: selectedDataset ? 1 : 0.5,
            }}
            onMouseEnter={(e) => {
              if (selectedDataset) {
                e.currentTarget.style.filter = "brightness(1.1)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = "none";
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            新しい分析
          </button>
          <button
            onClick={() => void handleExportAllToNote()}
            disabled={!selectedDataset || analyses.length === 0 || exportingNote}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium"
            style={{
              color: selectedDataset && analyses.length > 0 ? "#fff" : "var(--color-text-disabled)",
              backgroundColor: selectedDataset && analyses.length > 0
                ? "var(--color-accent-secondary)"
                : "var(--color-bg-hover)",
              border: "none",
              borderRadius: "var(--radius-md)",
              cursor: selectedDataset && analyses.length > 0 && !exportingNote ? "pointer" : "not-allowed",
              transition: "all var(--transition-fast)",
              opacity: selectedDataset && analyses.length > 0 && !exportingNote ? 1 : 0.5,
            }}
            onMouseEnter={(e) => {
              if (selectedDataset && analyses.length > 0 && !exportingNote) {
                e.currentTarget.style.filter = "brightness(1.1)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = "none";
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            {exportingNote ? "出力中..." : "分析結果をノートに出力"}
          </button>
          <button
            onClick={() => setReportOpen(true)}
            disabled={!selectedDataset || analyses.length === 0}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium"
            style={{
              color: selectedDataset && analyses.length > 0 ? "var(--color-accent-secondary)" : "var(--color-text-disabled)",
              backgroundColor: selectedDataset && analyses.length > 0
                ? "color-mix(in srgb, var(--color-accent-secondary) 10%, transparent)"
                : "var(--color-bg-hover)",
              border: `1px solid ${selectedDataset && analyses.length > 0 ? "var(--color-accent-secondary)" : "var(--color-border-primary)"}`,
              borderRadius: "var(--radius-md)",
              cursor: selectedDataset && analyses.length > 0 ? "pointer" : "not-allowed",
              transition: "all var(--transition-fast)",
              opacity: selectedDataset && analyses.length > 0 ? 1 : 0.5,
            }}
            onMouseEnter={(e) => {
              if (selectedDataset && analyses.length > 0) {
                e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--color-accent-secondary) 18%, transparent)";
              }
            }}
            onMouseLeave={(e) => {
              if (selectedDataset && analyses.length > 0) {
                e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--color-accent-secondary) 10%, transparent)";
              }
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            レポート作成
          </button>
        </div>

        {/* 分析グループ一覧 */}
        <div className="flex-1 overflow-y-auto px-2 pb-4 scrollable-area">
          {ANALYSIS_GROUPS.map((group) => {
            const items = groupedAnalyses.get(group.key) ?? [];
            const collapsed = collapsedGroups.has(group.key);
            const color = GROUP_COLORS[group.key] ?? "var(--color-text-secondary)";

            return (
              <div key={group.key} className="mt-1">
                {/* グループヘッダー */}
                <button
                  onClick={() => toggleGroup(group.key)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium"
                  style={{
                    color: "var(--color-text-secondary)",
                    borderRadius: "var(--radius-sm)",
                    transition: "background var(--transition-fast)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  {/* 折りたたみ矢印 */}
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      transition: "transform var(--transition-fast)",
                      transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                  <span style={{ color }}>{group.icon}</span>
                  <span>{group.label}</span>
                  {items.length > 0 && (
                    <span
                      className="ml-auto text-xs px-1.5"
                      style={{
                        color: "var(--color-text-tertiary)",
                        backgroundColor: "var(--color-bg-hover)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "10px",
                      }}
                    >
                      {items.length}
                    </span>
                  )}
                </button>

                {/* 分析アイテム */}
                {!collapsed && items.length > 0 && (
                  <div className="ml-3 mt-0.5 flex flex-col gap-0.5">
                    {items.map((item) => {
                      const isSelected = selectedAnalysisId === item.id;
                      return (
                        <div
                          key={item.id}
                          className="group flex items-center gap-2 px-2 py-1.5 text-xs"
                          style={{
                            color: isSelected
                              ? "var(--color-accent-primary)"
                              : "var(--color-text-primary)",
                            backgroundColor: isSelected
                              ? "color-mix(in srgb, var(--color-accent-primary) 10%, transparent)"
                              : "transparent",
                            borderRadius: "var(--radius-sm)",
                            cursor: "pointer",
                            transition: "all var(--transition-fast)",
                          }}
                          onClick={() => setSelectedAnalysisId(item.id)}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.backgroundColor = "transparent";
                            }
                          }}
                        >
                          {/* カラーバー */}
                          <span
                            className="shrink-0"
                            style={{
                              width: "3px",
                              height: "16px",
                              borderRadius: "2px",
                              backgroundColor: color,
                              opacity: isSelected ? 1 : 0.5,
                            }}
                          />

                          {/* 名前 */}
                          <span className="flex-1 truncate">{item.name}</span>

                          {/* タイプバッジ */}
                          <span
                            className="shrink-0 text-xs px-1"
                            style={{
                              color: "var(--color-text-tertiary)",
                              fontSize: "9px",
                            }}
                          >
                            {analysisTypeLabel(item.analysisType)}
                          </span>

                          {/* 削除ボタン */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDelete(item.id);
                            }}
                            className="shrink-0 opacity-0 group-hover:opacity-100"
                            style={{
                              color: "var(--color-accent-danger)",
                              transition: "opacity var(--transition-fast)",
                              padding: "2px",
                              borderRadius: "var(--radius-sm)",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--color-accent-danger) 12%, transparent)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "transparent";
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 空のグループ */}
                {!collapsed && items.length === 0 && (
                  <div
                    className="ml-7 py-1 text-xs"
                    style={{ color: "var(--color-text-disabled)", fontSize: "10px" }}
                  >
                    分析なし
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 右パネル: 結果表示 ── */}
      <div
        className="flex-1 overflow-hidden"
        style={{ backgroundColor: "var(--color-bg-primary)" }}
      >
        {renderResult()}
      </div>

      {/* ── 分析ウィザードモーダル ── */}
      {wizardOpen && (
        <AnalysisWizard
          onClose={() => setWizardOpen(false)}
          onComplete={(analysisId) => {
            setWizardOpen(false);
            setSelectedAnalysisId(analysisId);
          }}
        />
      )}

      {/* ── レポートビルダーモーダル ── */}
      {reportOpen && (
        <ReportBuilder onClose={() => setReportOpen(false)} />
      )}
    </div>
  );
};
