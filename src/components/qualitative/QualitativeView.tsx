// src/components/qualitative/QualitativeView.tsx
// 質的分析メインビュー — プロジェクトナビゲーション + タブ切り替え

import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  QualProject,
  CreateQualProjectInput,
  QualitativeTab,
} from "../../types";

// 子コンポーネント（遅延読み込みなし — Tauri WKWebView 安全策）
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

/** タブ定義 */
const TABS: { key: QualitativeTab; label: string; icon: string }[] = [
  { key: "dashboard", label: "概要", icon: "📊" },
  { key: "codebook", label: "コードブック", icon: "🏷️" },
  { key: "matrix", label: "マトリクス", icon: "📋" },
  { key: "icr", label: "ICR", icon: "🤝" },
  { key: "source-critique", label: "史料批判", icon: "📜" },
  { key: "timeline", label: "タイムライン", icon: "📅" },
  { key: "actor-map", label: "アクターマップ", icon: "🗺️" },
  { key: "process-tracing", label: "プロセストレーシング", icon: "🔍" },
  { key: "comparative", label: "比較デザイン", icon: "⚖️" },
  { key: "framing", label: "フレーミング", icon: "🖼️" },
  { key: "report", label: "レポート", icon: "📝" },
];

const QualitativeView: React.FC = () => {
  const [projects, setProjects] = useState<QualProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<QualitativeTab>("dashboard");
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectMethod, setNewProjectMethod] = useState("thematic");

  const loadProjects = useCallback(async () => {
    try {
      const result = await invoke<QualProject[]>("get_projects");
      setProjects(result);
      if (result.length > 0 && !selectedProjectId) {
        setSelectedProjectId(result[0].id);
      }
    } catch (err) {
      console.error("プロジェクト取得エラー:", err);
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
      const created = await invoke<QualProject>("create_project", { input });
      setProjects((prev) => [created, ...prev]);
      setSelectedProjectId(created.id);
      setNewProjectName("");
      setShowNewProject(false);
    } catch (err) {
      console.error("プロジェクト作成エラー:", err);
    }
  }, [newProjectName, newProjectMethod]);

  const handleDeleteProject = useCallback(
    async (id: string) => {
      if (!confirm("このプロジェクトを削除しますか？")) return;
      try {
        await invoke("delete_project", { id });
        setProjects((prev) => prev.filter((p) => p.id !== id));
        if (selectedProjectId === id) {
          setSelectedProjectId(projects.find((p) => p.id !== id)?.id ?? null);
        }
      } catch (err) {
        console.error("プロジェクト削除エラー:", err);
      }
    },
    [selectedProjectId, projects]
  );

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  const renderTabContent = () => {
    if (!selectedProjectId) {
      return (
        <div
          className="flex flex-col items-center justify-center h-full gap-4"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          <span className="text-lg">プロジェクトを選択または作成してください</span>
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
        return (
          <div style={{ padding: "24px" }}>
            <h2
              className="text-xl font-bold mb-4"
              style={{ color: "var(--color-text-primary)" }}
            >
              {selectedProject?.name ?? "プロジェクト"}
            </h2>
            <div
              className="grid grid-cols-2 gap-4"
              style={{ maxWidth: "600px" }}
            >
              <div
                className="p-4"
                style={{
                  backgroundColor: "var(--color-bg-secondary)",
                  borderRadius: "var(--radius-card, 12px)",
                  border: "1px solid var(--color-border-primary)",
                }}
              >
                <div
                  className="text-xs mb-1"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  手法
                </div>
                <div
                  className="text-sm font-medium"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {selectedProject?.methodType ?? "-"}
                </div>
              </div>
              <div
                className="p-4"
                style={{
                  backgroundColor: "var(--color-bg-secondary)",
                  borderRadius: "var(--radius-card, 12px)",
                  border: "1px solid var(--color-border-primary)",
                }}
              >
                <div
                  className="text-xs mb-1"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  作成日
                </div>
                <div
                  className="text-sm font-medium"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {selectedProject
                    ? new Date(selectedProject.createdAt).toLocaleDateString("ja-JP")
                    : "-"}
                </div>
              </div>
            </div>
            <p
              className="mt-4 text-sm"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {selectedProject?.description ?? "説明なし"}
            </p>
            <div className="mt-6">
              <h3
                className="text-sm font-semibold mb-3"
                style={{ color: "var(--color-text-primary)" }}
              >
                クイックアクション
              </h3>
              <div className="flex flex-wrap gap-2">
                {TABS.filter((t) => t.key !== "dashboard").map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setActiveTab(t.key)}
                    className="text-xs px-3 py-1.5"
                    style={{
                      backgroundColor: "var(--color-bg-tertiary)",
                      color: "var(--color-text-secondary)",
                      borderRadius: "999px",
                      border: "1px solid var(--color-border-secondary)",
                      cursor: "pointer",
                    }}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        <span className="text-sm">読み込み中…</span>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* 左: プロジェクト一覧 */}
      <aside
        className="flex flex-col h-full shrink-0"
        style={{
          width: "220px",
          borderRight: "1px solid var(--color-border-primary)",
          backgroundColor: "var(--color-bg-secondary)",
        }}
      >
        <header
          className="flex items-center justify-between px-3 shrink-0"
          style={{
            height: "44px",
            borderBottom: "1px solid var(--color-border-primary)",
          }}
        >
          <span
            className="text-xs font-semibold"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            プロジェクト
          </span>
          <button
            type="button"
            onClick={() => setShowNewProject(true)}
            className="text-xs"
            style={{
              color: "var(--color-accent-primary)",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            + 新規
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-2">
          {showNewProject && (
            <div
              className="mb-2 p-2"
              style={{
                backgroundColor: "var(--color-bg-tertiary)",
                borderRadius: "8px",
              }}
            >
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="プロジェクト名"
                className="w-full text-xs mb-1 px-2 py-1"
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
                className="w-full text-xs mb-1 px-2 py-1"
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
                  onClick={() => setShowNewProject(false)}
                  className="text-xs px-2 py-1"
                  style={{
                    backgroundColor: "transparent",
                    color: "var(--color-text-tertiary)",
                    border: "1px solid var(--color-border-secondary)",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {projects.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between group"
              style={{
                padding: "6px 8px",
                borderRadius: "6px",
                cursor: "pointer",
                backgroundColor:
                  selectedProjectId === p.id
                    ? "var(--color-bg-hover)"
                    : "transparent",
                color:
                  selectedProjectId === p.id
                    ? "var(--color-accent-primary)"
                    : "var(--color-text-secondary)",
                transition: "all 100ms ease-out",
              }}
              onClick={() => {
                setSelectedProjectId(p.id);
                setActiveTab("dashboard");
              }}
            >
              <span className="text-xs truncate flex-1">{p.name}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDeleteProject(p.id);
                }}
                className="text-xs opacity-0 group-hover:opacity-100"
                style={{
                  color: "var(--color-text-tertiary)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "0 4px",
                }}
              >
                ×
              </button>
            </div>
          ))}

          {projects.length === 0 && !showNewProject && (
            <div
              className="text-center py-8 text-xs"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              プロジェクトなし
            </div>
          )}
        </div>
      </aside>

      {/* 中央: タブバー + コンテンツ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* タブバー */}
        <nav
          className="flex items-center gap-0 shrink-0 overflow-x-auto"
          style={{
            height: "40px",
            borderBottom: "1px solid var(--color-border-primary)",
            backgroundColor: "var(--color-bg-secondary)",
          }}
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className="text-xs px-3 h-full whitespace-nowrap"
              style={{
                color:
                  activeTab === t.key
                    ? "var(--color-accent-primary)"
                    : "var(--color-text-tertiary)",
                borderBottom:
                  activeTab === t.key
                    ? "2px solid var(--color-accent-primary)"
                    : "2px solid transparent",
                background: "none",
                border: "none",
                borderBottomStyle: "solid",
                borderBottomWidth: "2px",
                borderBottomColor:
                  activeTab === t.key
                    ? "var(--color-accent-primary)"
                    : "transparent",
                cursor: "pointer",
                transition: "all 100ms ease-out",
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </nav>

        {/* タブコンテンツ */}
        <div className="flex-1 overflow-y-auto">{renderTabContent()}</div>
      </div>
    </div>
  );
};

export default QualitativeView;
