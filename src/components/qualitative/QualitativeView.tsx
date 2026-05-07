// src/components/qualitative/QualitativeView.tsx
// 質的分析メインビュー — プロジェクトナビゲーション + タブ切り替え
// サイドバー・タブバー折りたたみ対応 / ミニマルUI / カスタムSVGアイコン

import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "../../lib/tauriShim";
import { swalConfirm } from "../../lib/swal";
import type {
  QualProject,
  CreateQualProjectInput,
  QualitativeTab,
} from "../../types";

// アイコン
import {
  IconDashboard,
  IconCodebook,
  IconMatrix,
  IconIcr,
  IconScroll,
  IconTimeline,
  IconActorMap,
  IconProcessTracing,
  IconComparative,
  IconFraming,
  IconReport,
  IconPlus,
  IconClose,
  IconDelete,
  IconChevronLeft,
  IconChevronRight,
  IconPanelLeft,
  IconBook,
} from "./icons/QualIcons";
import { HelpTooltip } from "./HelpTooltip";

// 子コンポーネント（Tauri WKWebView 安全策で静的 import）
import { CodebookView } from "./CodebookView";
import { CodingMatrixView } from "./CodingMatrixView";
import { IcrCalculator } from "./IcrCalculator";
import { SourceCritiqueForm } from "./SourceCritiqueForm";
import { TimelineView } from "./TimelineView";
import { ActorMapView } from "./ActorMapView";
import { ProcessTracingView } from "./ProcessTracingView";
import { ComparativeDesignView } from "./ComparativeDesignView";
import { FramingAnalysisView } from "./FramingAnalysisView";
import { AnalysisReport } from "./AnalysisReport";
import { useT, useI18nStore } from "../../stores/useI18nStore";

/** タブ定義 — アイコンは React コンポーネント */
const TABS: { key: QualitativeTab; label: string; Icon: React.FC<{ size?: number; color?: string }> }[] = [
  { key: "dashboard", label: useI18nStore.getState().t.qualitative.k_ip8f, Icon: IconDashboard },
  { key: "codebook", label: useI18nStore.getState().t.qualitative.k_7z1tpa, Icon: IconCodebook },
  { key: "matrix", label: useI18nStore.getState().t.qualitative.k_fnxlsm, Icon: IconMatrix },
  { key: "icr", label: "ICR", Icon: IconIcr },
  { key: "source-critique", label: useI18nStore.getState().t.qualitative.k_b0itbm, Icon: IconScroll },
  { key: "timeline", label: useI18nStore.getState().t.qualitative.k_3mh737, Icon: IconTimeline },
  { key: "actor-map", label: useI18nStore.getState().t.qualitative.k_yybalk, Icon: IconActorMap },
  { key: "process-tracing", label: useI18nStore.getState().t.qualitative.k_vz7qeo, Icon: IconProcessTracing },
  { key: "comparative", label: useI18nStore.getState().t.qualitative.k_2mss8j, Icon: IconComparative },
  { key: "framing", label: useI18nStore.getState().t.qualitative.k_7wled3, Icon: IconFraming },
  { key: "report", label: useI18nStore.getState().t.qualitative.k_6dj4vx, Icon: IconReport },
];

const QualitativeView: React.FC = () => {
  const t = useT();

  const [projects, setProjects] = useState<QualProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<QualitativeTab>("dashboard");
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectMethod, setNewProjectMethod] = useState("thematic");

  // 折りたたみ状態
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tabBarCollapsed, setTabBarCollapsed] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const result = await invoke<QualProject[]>("get_projects");
      setProjects(result);
      if (result.length > 0 && !selectedProjectId && result[0]) {
        setSelectedProjectId(result[0].id);
      }
    } catch (err) {
      console.error(t.qualitative.k_wvi2ea, err);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const handleCreateProject = useCallback(async () => {
    if (!newProjectName.trim()) return;
    try {
      const input: CreateQualProjectInput = {
        name: newProjectName.trim(),
        methodType: newProjectMethod,
      };
      const created = await invoke<QualProject | null>("create_project", { input });
      if (!created) {
        console.warn("create_project returned null (mock mode)");
        return;
      }
      setProjects((prev) => [created, ...prev]);
      setSelectedProjectId(created.id);
      setNewProjectName("");
      setShowNewProject(false);
    } catch (err) {
      console.error(t.qualitative.k_2ft95d, err);
    }
  }, [newProjectName, newProjectMethod]);

  const handleDeleteProject = useCallback(
    async (id: string) => {
      const ok = await swalConfirm(t.qualitative.k_yzx5hk, t.qualitative.k_3ip7wz);
      if (!ok) return;
      try {
        await invoke("delete_project", { id });
        setProjects((prev) => prev.filter((p) => p.id !== id));
        if (selectedProjectId === id) {
          setSelectedProjectId(projects.find((p) => p.id !== id)?.id ?? null);
        }
      } catch (err) {
        console.error(t.qualitative.k_63mq89, err);
      }
    },
    [selectedProjectId, projects],
  );

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  const renderTabContent = () => {
    if (!selectedProjectId) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4" style={{ color: "var(--color-text-tertiary)" }}>
          <IconBook size={32} />
          <span className="text-base">プロジェクトを選択または作成してください</span>
        </div>
      );
    }

    switch (activeTab) {
      case "codebook":
        return <CodebookView projectId={selectedProjectId} />;
      case "matrix":
        return <CodingMatrixView projectId={selectedProjectId} />;
      case "icr":
        return <IcrCalculator projectId={selectedProjectId} />;
      case "source-critique":
        return <SourceCritiqueForm projectId={selectedProjectId} />;
      case "timeline":
        return <TimelineView projectId={selectedProjectId} />;
      case "actor-map":
        return <ActorMapView projectId={selectedProjectId} />;
      case "process-tracing":
        return <ProcessTracingView projectId={selectedProjectId} />;
      case "comparative":
        return <ComparativeDesignView projectId={selectedProjectId} />;
      case "framing":
        return <FramingAnalysisView projectId={selectedProjectId} />;
      case "report":
        return <AnalysisReport projectId={selectedProjectId} />;
      case "dashboard":
      default:
        return renderDashboard();
    }
  };

  const renderDashboard = () => (
    <div style={{ padding: "24px", maxWidth: "680px" }}>
      <HelpTooltip
        storageKey="qual_dashboard"
        title={t.qualitative.k_truqme}
        paragraphs={[
          t.qualitative.k_ctdu1r,
          t.qualitative.k_c5qwzu,
        ]}
        steps={[
          t.qualitative.k_rmou8w,
          t.qualitative.k_ru3ooh,
          t.qualitative.k_49qp7e,
          t.qualitative.k_1j8emn,
        ]}
      />

      <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
        {selectedProject?.name ?? t.qualitative.k_8tzti6}
      </h2>
      <div className="grid grid-cols-2 gap-3" style={{ maxWidth: "500px" }}>
        <InfoCard label={t.qualitative.k_hbe2} value={selectedProject?.methodType ?? "-"} />
        <InfoCard
          label={t.notes.sortCreated}
          value={selectedProject ? new Date(selectedProject.createdAt).toLocaleDateString("ja-JP") : "-"}
        />
      </div>
      <p className="mt-3 text-xs" style={{ color: "var(--color-text-secondary)", lineHeight: "1.6" }}>
        {selectedProject?.description ?? t.qualitative.k_hwu93j}
      </p>

      <div className="mt-6">
        <h3 className="text-xs font-semibold mb-3" style={{ color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          クイックアクション
        </h3>
        <div className="flex flex-wrap gap-2">
          {TABS.filter((t) => t.key !== "dashboard").map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5"
              style={{
                backgroundColor: "var(--color-bg-secondary)",
                color: "var(--color-text-secondary)",
                borderRadius: "6px",
                border: "1px solid var(--color-border-secondary)",
                cursor: "pointer",
                transition: "all 100ms",
              }}
            >
              <t.Icon size={14} />
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: "var(--color-text-tertiary)" }}>
        <span className="text-sm">読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── サイドバー（プロジェクト一覧） ── */}
      <aside
        className="flex flex-col h-full shrink-0"
        style={{
          width: sidebarCollapsed ? "44px" : "220px",
          borderRight: "1px solid var(--color-border-primary)",
          backgroundColor: "var(--color-bg-secondary)",
          transition: "width 150ms ease-out",
          overflow: "hidden",
        }}
      >
        {/* ヘッダー */}
        <header
          className="flex items-center justify-between px-3 shrink-0"
          style={{ height: "44px", borderBottom: "1px solid var(--color-border-primary)" }}
        >
          {!sidebarCollapsed && (
            <span className="text-sm font-semibold" style={{ color: "var(--color-text-tertiary)" }}>
              プロジェクト
            </span>
          )}
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? t.sidebar.expandSidebar : t.sidebar.collapseSidebar}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)", padding: "4px", display: "flex" }}
          >
            <IconPanelLeft size={14} />
          </button>
        </header>

        {!sidebarCollapsed && (
          <>
            {/* 新規プロジェクトボタン */}
            <div className="px-2 py-1.5 shrink-0" style={{ borderBottom: "1px solid var(--color-border-secondary)" }}>
              <button
                type="button"
                onClick={() => setShowNewProject(true)}
                className="w-full inline-flex items-center justify-center gap-1 text-xs py-1.5"
                style={{
                  backgroundColor: "var(--color-accent-primary)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                <IconPlus size={12} />
                新規プロジェクト
              </button>
            </div>

            {/* 新規フォーム */}
            {showNewProject && (
              <div className="p-2 shrink-0" style={{ borderBottom: "1px solid var(--color-border-secondary)" }}>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder={t.qualitative.k_aalcnl}
                  className="w-full text-xs mb-1.5 px-2 py-1"
                  style={{
                    backgroundColor: "var(--color-bg-primary)",
                    color: "var(--color-text-primary)",
                    border: "1px solid var(--color-border-primary)",
                    borderRadius: "4px",
                    outline: "none",
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleCreateProject();
                    if (e.key === "Escape") setShowNewProject(false);
                  }}
                  autoFocus
                />
                <select
                  value={newProjectMethod}
                  onChange={(e) => setNewProjectMethod(e.target.value)}
                  className="w-full text-xs mb-1.5 px-2 py-1"
                  style={{
                    backgroundColor: "var(--color-bg-primary)",
                    color: "var(--color-text-primary)",
                    border: "1px solid var(--color-border-primary)",
                    borderRadius: "4px",
                  }}
                >
                  <option value="thematic">テーマ分析</option>
                  <option value="grounded">グラウンデッド・セオリー</option>
                  <option value="content">内容分析</option>
                  <option value="historical">歴史的分析</option>
                  <option value="comparative">比較政治分析</option>
                </select>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => void handleCreateProject()}
                    className="flex-1 text-xs py-1"
                    style={{ backgroundColor: "var(--color-accent-primary)", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}
                  >
                    作成
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewProject(false)}
                    className="text-xs px-2 py-1"
                    style={{ backgroundColor: "transparent", color: "var(--color-text-tertiary)", border: "1px solid var(--color-border-secondary)", borderRadius: "4px", cursor: "pointer" }}
                  >
                    <IconClose size={10} />
                  </button>
                </div>
              </div>
            )}

            {/* プロジェクト一覧 */}
            <div className="flex-1 overflow-y-auto py-1 px-1.5">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between group"
                  style={{
                    padding: "5px 6px",
                    borderRadius: "5px",
                    cursor: "pointer",
                    backgroundColor: selectedProjectId === p.id ? "var(--color-bg-hover)" : "transparent",
                    color: selectedProjectId === p.id ? "var(--color-accent-primary)" : "var(--color-text-secondary)",
                    transition: "all 80ms",
                    marginBottom: "1px",
                  }}
                  onClick={() => { setSelectedProjectId(p.id); setActiveTab("dashboard"); }}
                >
                  <span className="text-sm truncate flex-1">{p.name}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); void handleDeleteProject(p.id); }}
                    className="opacity-0 group-hover:opacity-100"
                    style={{ color: "var(--color-text-tertiary)", background: "none", border: "none", cursor: "pointer", padding: "0 2px", display: "flex" }}
                  >
                    <IconDelete size={11} />
                  </button>
                </div>
              ))}
              {projects.length === 0 && !showNewProject && (
                <div className="text-center py-6 text-sm" style={{ color: "var(--color-text-tertiary)" }}>
                  プロジェクトなし
                </div>
              )}
            </div>
          </>
        )}
      </aside>

      {/* ── メインエリア ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* タブバー */}
        <nav
          className="flex items-center shrink-0"
          style={{
            height: tabBarCollapsed ? "0px" : "44px",
            borderBottom: tabBarCollapsed ? "none" : "1px solid var(--color-border-primary)",
            backgroundColor: "var(--color-bg-secondary)",
            overflow: "hidden",
            overflowX: "auto",
            transition: "height 150ms ease-out",
          }}
        >
          {TABS.map((t) => {
            const isActive = activeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className="inline-flex items-center gap-1.5 text-sm px-3 h-full whitespace-nowrap"
                style={{
                  color: isActive ? "var(--color-accent-primary)" : "var(--color-text-tertiary)",
                  background: "none",
                  border: "none",
                  borderBottomStyle: "solid",
                  borderBottomWidth: "2px",
                  borderBottomColor: isActive ? "var(--color-accent-primary)" : "transparent",
                  cursor: "pointer",
                  transition: "all 80ms",
                  fontWeight: isActive ? 600 : 400,
                  flexShrink: 0,
                }}
              >
                <t.Icon size={15} color={isActive ? "var(--color-accent-primary)" : "var(--color-text-tertiary)"} />
                {t.label}
              </button>
            );
          })}

          {/* タブバー折りたたみトグル */}
          <div className="ml-auto pr-1 shrink-0">
            <button
              type="button"
              onClick={() => setTabBarCollapsed(true)}
              title={t.qualitative.k_4qcjen}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)", padding: "4px", display: "flex" }}
            >
              <IconChevronLeft size={12} />
            </button>
          </div>
        </nav>

        {/* タブバー折りたたみ時の展開ボタン */}
        {tabBarCollapsed && (
          <div
            className="shrink-0 flex items-center px-2"
            style={{
              height: "28px",
              borderBottom: "1px solid var(--color-border-secondary)",
              backgroundColor: "var(--color-bg-secondary)",
            }}
          >
            <button
              type="button"
              onClick={() => setTabBarCollapsed(false)}
              className="inline-flex items-center gap-1 text-xs"
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)" }}
            >
              <IconChevronRight size={12} />
              {TABS.find((t) => t.key === activeTab)?.label ?? t.qualitative.k_8k53}
            </button>
          </div>
        )}

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto">{renderTabContent()}</div>
      </div>
    </div>
  );
};

/** ダッシュボード用情報カード */
const InfoCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div
    className="p-3"
    style={{
      backgroundColor: "var(--color-bg-secondary)",
      borderRadius: "8px",
      border: "1px solid var(--color-border-primary)",
    }}
  >
    <div className="text-xs mb-0.5" style={{ color: "var(--color-text-tertiary)" }}>{label}</div>
    <div className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>{value}</div>
  </div>
);

export default QualitativeView;
