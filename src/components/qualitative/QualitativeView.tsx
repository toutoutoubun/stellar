// src/components/qualitative/QualitativeView.tsx
// 質的分析メインビュー — プロジェクトナビゲーション + タブ切り替え

import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type {
  QualProject,
  CreateQualProjectInput,
  UpdateQualProjectInput,
  QualitativeTab,
} from '../../types';
import CodebookView from './CodebookView';
import CodingMatrixView from './CodingMatrixView';
import IcrCalculator from './IcrCalculator';
import SourceCritiqueForm from './SourceCritiqueForm';
import TimelineView from './TimelineView';
import ActorMapView from './ActorMapView';
import ProcessTracingView from './ProcessTracingView';
import ComparativeDesignView from './ComparativeDesignView';
import FramingAnalysisView from './FramingAnalysisView';
import AnalysisReport from './AnalysisReport';

const TABS: { key: QualitativeTab; label: string; icon: string }[] = [
  { key: 'dashboard', label: 'ダッシュボード', icon: '📊' },
  { key: 'codebook', label: 'コードブック', icon: '📋' },
  { key: 'matrix', label: 'マトリクス', icon: '📈' },
  { key: 'icr', label: 'ICR', icon: '🤝' },
  { key: 'source-critique', label: '史料批判', icon: '🔍' },
  { key: 'timeline', label: 'タイムライン', icon: '📅' },
  { key: 'actor-map', label: 'アクターマップ', icon: '🌐' },
  { key: 'process-tracing', label: 'PT', icon: '🔬' },
  { key: 'comparative', label: '比較', icon: '⚖️' },
  { key: 'framing', label: 'フレーミング', icon: '🖼️' },
  { key: 'report', label: 'レポート', icon: '📄' },
];

const METHOD_TYPES = [
  { value: 'thematic', label: 'テーマ分析' },
  { value: 'grounded', label: 'グラウンデッド・セオリー' },
  { value: 'content', label: '内容分析' },
  { value: 'discourse', label: 'ディスコース分析' },
  { value: 'narrative', label: 'ナラティブ分析' },
  { value: 'historical', label: '歴史分析' },
  { value: 'comparative', label: '比較政治分析' },
  { value: 'mixed', label: '混合手法' },
];

const QualitativeView: React.FC = () => {
  const [projects, setProjects] = useState<QualProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<QualProject | null>(null);
  const [activeTab, setActiveTab] = useState<QualitativeTab>('dashboard');
  const [loading, setLoading] = useState(true);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingProject, setEditingProject] = useState(false);

  const [newProject, setNewProject] = useState<CreateQualProjectInput>({
    name: '',
    description: '',
    methodType: 'thematic',
  });

  // プロジェクト一覧取得
  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoke<QualProject[]>('get_projects');
      setProjects(data);
      // 前回選択されたプロジェクトを復元
      if (selectedProject) {
        const updated = data.find((p) => p.id === selectedProject.id);
        if (updated) setSelectedProject(updated);
      } else if (data.length > 0) {
        setSelectedProject(data[0]);
      }
    } catch (e) {
      console.error('プロジェクト一覧取得に失敗:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // プロジェクト作成
  const handleCreateProject = async () => {
    if (!newProject.name.trim()) return;
    try {
      const created = await invoke<QualProject>('create_project', { input: newProject });
      setNewProject({ name: '', description: '', methodType: 'thematic' });
      setShowProjectForm(false);
      setSelectedProject(created);
      loadProjects();
    } catch (e) {
      console.error('プロジェクト作成に失敗:', e);
    }
  };

  // プロジェクト更新
  const handleUpdateProject = async (input: UpdateQualProjectInput) => {
    if (!selectedProject) return;
    try {
      const updated = await invoke<QualProject>('update_project', {
        id: selectedProject.id,
        input,
      });
      setSelectedProject(updated);
      setEditingProject(false);
      loadProjects();
    } catch (e) {
      console.error('プロジェクト更新に失敗:', e);
    }
  };

  // プロジェクト削除
  const handleDeleteProject = async () => {
    if (!selectedProject) return;
    if (!confirm(`プロジェクト「${selectedProject.name}」を削除しますか？\nすべての分析データが失われます。`))
      return;
    try {
      await invoke('delete_project', { id: selectedProject.id });
      setSelectedProject(null);
      loadProjects();
    } catch (e) {
      console.error('プロジェクト削除に失敗:', e);
    }
  };

  // タブコンテンツのレンダリング
  const renderTabContent = () => {
    if (!selectedProject) {
      return (
        <div className="qual-empty-state">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="mx-auto mb-4 opacity-20">
            <rect x="8" y="8" width="48" height="48" rx="8" stroke="currentColor" strokeWidth="2" />
            <path d="M24 28h16M24 36h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <h3 className="text-base font-semibold mb-2">質的分析</h3>
          <p className="text-sm text-secondary">
            プロジェクトを選択または作成して分析を開始してください。
          </p>
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return renderDashboard();
      case 'codebook':
        return <CodebookView projectId={selectedProject.id} />;
      case 'matrix':
        return <CodingMatrixView projectId={selectedProject.id} />;
      case 'icr':
        return <IcrCalculator projectId={selectedProject.id} />;
      case 'source-critique':
        return <SourceCritiqueForm projectId={selectedProject.id} />;
      case 'timeline':
        return <TimelineView projectId={selectedProject.id} />;
      case 'actor-map':
        return <ActorMapView projectId={selectedProject.id} />;
      case 'process-tracing':
        return <ProcessTracingView projectId={selectedProject.id} />;
      case 'comparative':
        return <ComparativeDesignView projectId={selectedProject.id} />;
      case 'framing':
        return <FramingAnalysisView projectId={selectedProject.id} />;
      case 'report':
        return <AnalysisReport projectId={selectedProject.id} />;
      default:
        return null;
    }
  };

  // ダッシュボード
  const renderDashboard = () => {
    if (!selectedProject) return null;
    return (
      <div className="qual-dashboard">
        <div className="qual-dashboard-header">
          {editingProject ? (
            <div className="qual-edit-form">
              <input
                className="input-field text-lg font-bold"
                value={selectedProject.name}
                onChange={(e) =>
                  setSelectedProject({ ...selectedProject, name: e.target.value })
                }
              />
              <textarea
                className="input-field text-sm mt-2"
                rows={2}
                value={selectedProject.description ?? ''}
                onChange={(e) =>
                  setSelectedProject({
                    ...selectedProject,
                    description: e.target.value || null,
                  })
                }
                placeholder="プロジェクト説明..."
              />
              <select
                className="input-field text-sm mt-2"
                value={selectedProject.methodType}
                onChange={(e) =>
                  setSelectedProject({
                    ...selectedProject,
                    methodType: e.target.value,
                  })
                }
              >
                {METHOD_TYPES.map((mt) => (
                  <option key={mt.value} value={mt.value}>
                    {mt.label}
                  </option>
                ))}
              </select>
              <div className="flex gap-2 mt-2">
                <button
                  className="btn-primary text-xs"
                  onClick={() =>
                    handleUpdateProject({
                      name: selectedProject.name,
                      description: selectedProject.description,
                      methodType: selectedProject.methodType,
                    })
                  }
                >
                  保存
                </button>
                <button
                  className="btn-ghost text-xs"
                  onClick={() => {
                    setEditingProject(false);
                    loadProjects();
                  }}
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-lg font-bold">{selectedProject.name}</h2>
                {selectedProject.description && (
                  <p className="text-sm text-secondary mt-1">
                    {selectedProject.description}
                  </p>
                )}
                <div className="flex gap-3 mt-2 text-xs text-secondary">
                  <span>
                    手法:{' '}
                    {METHOD_TYPES.find((m) => m.value === selectedProject.methodType)?.label ??
                      selectedProject.methodType}
                  </span>
                  <span>作成: {selectedProject.createdAt?.slice(0, 10)}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="btn-ghost text-xs"
                  onClick={() => setEditingProject(true)}
                >
                  編集
                </button>
                <button
                  className="btn-ghost text-xs text-red-500"
                  onClick={handleDeleteProject}
                >
                  削除
                </button>
              </div>
            </>
          )}
        </div>

        {/* クイックナビゲーション */}
        <div className="qual-quick-nav">
          <h3 className="text-sm font-semibold mb-3">分析ツール</h3>
          <div className="qual-nav-grid">
            {TABS.filter((t) => t.key !== 'dashboard').map((tab) => (
              <button
                key={tab.key}
                className="qual-nav-card"
                onClick={() => setActiveTab(tab.key)}
              >
                <span className="qual-nav-icon">{tab.icon}</span>
                <span className="qual-nav-label">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="qualitative-view">
        <div className="qual-loading">質的分析モジュールを読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="qualitative-view">
      {/* サイドバー: プロジェクト一覧 */}
      <aside className="qual-sidebar">
        <div className="qual-sidebar-header">
          <h2 className="text-sm font-bold">プロジェクト</h2>
          <button
            className="btn-ghost text-xs"
            onClick={() => setShowProjectForm(!showProjectForm)}
            title="新規プロジェクト"
          >
            <svg width="14" height="14" viewBox="0 0 14 14">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* 新規プロジェクトフォーム */}
        {showProjectForm && (
          <div className="qual-project-form">
            <input
              className="input-field text-xs"
              placeholder="プロジェクト名..."
              value={newProject.name}
              onChange={(e) =>
                setNewProject({ ...newProject, name: e.target.value })
              }
              onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
              autoFocus
            />
            <select
              className="input-field text-xs mt-1"
              value={newProject.methodType}
              onChange={(e) =>
                setNewProject({ ...newProject, methodType: e.target.value })
              }
            >
              {METHOD_TYPES.map((mt) => (
                <option key={mt.value} value={mt.value}>
                  {mt.label}
                </option>
              ))}
            </select>
            <div className="flex gap-1 mt-1">
              <button
                className="btn-primary text-xs flex-1"
                onClick={handleCreateProject}
                disabled={!newProject.name.trim()}
              >
                作成
              </button>
              <button
                className="btn-ghost text-xs"
                onClick={() => setShowProjectForm(false)}
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* プロジェクトリスト */}
        <div className="qual-project-list">
          {projects.length === 0 ? (
            <p className="text-xs text-secondary p-3">
              プロジェクトがありません
            </p>
          ) : (
            projects.map((project) => (
              <button
                key={project.id}
                className={`qual-project-item ${
                  selectedProject?.id === project.id ? 'selected' : ''
                }`}
                onClick={() => {
                  setSelectedProject(project);
                  setActiveTab('dashboard');
                }}
              >
                <span className="qual-project-name">{project.name}</span>
                <span className="qual-project-method">
                  {METHOD_TYPES.find((m) => m.value === project.methodType)?.label ??
                    project.methodType}
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* メインコンテンツ */}
      <main className="qual-main">
        {/* タブバー */}
        {selectedProject && (
          <nav className="qual-tab-bar">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                className={`qual-tab ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
                title={tab.label}
              >
                <span className="qual-tab-icon">{tab.icon}</span>
                <span className="qual-tab-label">{tab.label}</span>
              </button>
            ))}
          </nav>
        )}

        {/* タブコンテンツ */}
        <div className="qual-content">{renderTabContent()}</div>
      </main>
    </div>
  );
};

export default QualitativeView;
