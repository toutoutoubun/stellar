// src/components/qualitative/CodePanel.tsx
// PDFリーダーのタブとして統合されるコーディングパネル
// 既存のハイライトパネルを壊さず、タブ切り替えで表示

import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type {
  CodeNode,
  CreateQualCodeInput,
  UpdateQualCodeInput,
  QualProject,
  Highlight,
} from '../../types';
import CodeTreeNode from './CodeTreeNode';

interface CodePanelProps {
  paperId: string;
  highlights: Highlight[];
  selectedHighlightIds: string[];
  currentProjectId: string | null;
}

const CodePanel: React.FC<CodePanelProps> = ({
  paperId,
  highlights,
  selectedHighlightIds,
  currentProjectId,
}) => {
  const [projects, setProjects] = useState<QualProject[]>([]);
  const [projectId, setProjectId] = useState<string | null>(currentProjectId);
  const [codeTree, setCodeTree] = useState<CodeNode[]>([]);
  const [selectedCode, setSelectedCode] = useState<CodeNode | null>(null);
  const [newCodeName, setNewCodeName] = useState('');
  const [newCodeColor, setNewCodeColor] = useState('#6366F1');
  const [loading, setLoading] = useState(false);
  const [highlightCodes, setHighlightCodes] = useState<Record<string, string[]>>({});

  // プロジェクト一覧取得
  useEffect(() => {
    invoke<QualProject[]>('get_projects').then(setProjects).catch(console.error);
  }, []);

  useEffect(() => {
    if (currentProjectId) setProjectId(currentProjectId);
  }, [currentProjectId]);

  // コードツリー取得
  const loadCodeTree = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const tree = await invoke<CodeNode[]>('get_code_tree', { projectId });
      setCodeTree(tree);
    } catch (e) {
      console.error('コードツリー取得に失敗:', e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadCodeTree();
  }, [loadCodeTree]);

  // ハイライト毎のコードを取得（簡易: コードツリーのassignmentCountで把握）
  // 選択されたハイライトへのコード割り当て状態を管理
  const loadHighlightCodes = useCallback(async () => {
    if (!projectId || selectedHighlightIds.length === 0) return;
    // 各コードについてハイライト一覧を取得し、マッピング
    const flatCodes = flattenTree(codeTree);
    const mapping: Record<string, string[]> = {};
    for (const hId of selectedHighlightIds) {
      mapping[hId] = [];
    }
    for (const code of flatCodes) {
      try {
        const hls = await invoke<{ id: string }[]>('get_highlights_by_code', { codeId: code.id });
        for (const hl of hls) {
          if (mapping[hl.id]) {
            mapping[hl.id].push(code.id);
          }
        }
      } catch {
        // ignore
      }
    }
    setHighlightCodes(mapping);
  }, [projectId, selectedHighlightIds, codeTree]);

  useEffect(() => {
    if (selectedHighlightIds.length > 0 && codeTree.length > 0) {
      loadHighlightCodes();
    }
  }, [selectedHighlightIds, codeTree, loadHighlightCodes]);

  // コード作成
  const handleCreateCode = async () => {
    if (!projectId || !newCodeName.trim()) return;
    const input: CreateQualCodeInput = {
      projectId,
      name: newCodeName.trim(),
      color: newCodeColor,
      parentId: selectedCode?.id ?? null,
    };
    try {
      await invoke('create_code', { input });
      setNewCodeName('');
      loadCodeTree();
    } catch (e) {
      console.error('コード作成に失敗:', e);
    }
  };

  // コード更新
  const handleUpdateCode = async (id: string, input: UpdateQualCodeInput) => {
    try {
      await invoke('update_code', { id, input });
      loadCodeTree();
    } catch (e) {
      console.error('コード更新に失敗:', e);
    }
  };

  // コード削除
  const handleDeleteCode = async (id: string) => {
    try {
      await invoke('delete_code', { id });
      if (selectedCode?.id === id) setSelectedCode(null);
      loadCodeTree();
    } catch (e) {
      console.error('コード削除に失敗:', e);
    }
  };

  // ドラッグ&ドロップでコード移動
  const handleDrop = async (draggedId: string, newParentId: string | null) => {
    try {
      await invoke('update_code', {
        id: draggedId,
        input: { parentId: newParentId } as UpdateQualCodeInput,
      });
      loadCodeTree();
    } catch (e) {
      console.error('コード移動に失敗:', e);
    }
  };

  // ハイライトにコードを割り当て
  const handleAssignCode = async (codeId: string) => {
    for (const hId of selectedHighlightIds) {
      try {
        await invoke('assign_code_to_highlight', {
          highlightId: hId,
          codeId,
        });
      } catch (e) {
        console.error('コード割り当てに失敗:', e);
      }
    }
    loadCodeTree();
    loadHighlightCodes();
  };

  // ハイライトからコードを解除
  const handleRemoveCode = async (codeId: string) => {
    for (const hId of selectedHighlightIds) {
      try {
        await invoke('remove_code_from_highlight', {
          highlightId: hId,
          codeId,
        });
      } catch (e) {
        console.error('コード解除に失敗:', e);
      }
    }
    loadCodeTree();
    loadHighlightCodes();
  };

  // ルートへのドロップ
  const handleRootDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId) {
      handleDrop(draggedId, null);
    }
  };

  if (!projectId) {
    return (
      <div className="code-panel">
        <div className="code-panel-empty">
          <p className="text-secondary text-sm">
            プロジェクトを選択してコーディングを開始してください
          </p>
          <select
            className="input-field mt-2"
            value=""
            onChange={(e) => setProjectId(e.target.value || null)}
          >
            <option value="">プロジェクトを選択...</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  return (
    <div className="code-panel">
      {/* プロジェクト選択 */}
      <div className="code-panel-header">
        <select
          className="input-field text-xs"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value || null)}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* 選択中ハイライト情報 */}
      {selectedHighlightIds.length > 0 && (
        <div className="code-panel-selection">
          <span className="text-xs text-secondary">
            {selectedHighlightIds.length}件のハイライトを選択中
          </span>
          <div className="code-assign-buttons">
            {flattenTree(codeTree).map((code) => {
              const isAssigned = selectedHighlightIds.some(
                (hId) => highlightCodes[hId]?.includes(code.id)
              );
              return (
                <button
                  key={code.id}
                  className={`code-assign-btn ${isAssigned ? 'assigned' : ''}`}
                  style={{ borderColor: code.color }}
                  onClick={() =>
                    isAssigned
                      ? handleRemoveCode(code.id)
                      : handleAssignCode(code.id)
                  }
                  title={isAssigned ? 'コード解除' : 'コード割り当て'}
                >
                  <span
                    className="code-color-dot-sm"
                    style={{ backgroundColor: code.color }}
                  />
                  <span className="text-xs">{code.name}</span>
                  {isAssigned && <span className="text-xs ml-1">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 新規コード作成 */}
      <div className="code-panel-create">
        <div className="flex gap-1 items-center">
          <input
            type="color"
            value={newCodeColor}
            onChange={(e) => setNewCodeColor(e.target.value)}
            className="code-color-picker"
            title="コードカラー"
          />
          <input
            className="input-field text-xs flex-1"
            placeholder="新規コード名..."
            value={newCodeName}
            onChange={(e) => setNewCodeName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateCode()}
          />
          <button
            className="btn-primary text-xs px-2 py-1"
            onClick={handleCreateCode}
            disabled={!newCodeName.trim()}
          >
            追加
          </button>
        </div>
        {selectedCode && (
          <span className="text-xs text-secondary mt-1 block">
            親コード: {selectedCode.name}
          </span>
        )}
      </div>

      {/* コードツリー */}
      <div
        className="code-tree-container"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleRootDrop}
      >
        {loading ? (
          <div className="code-panel-loading">
            <span className="text-xs text-secondary">読み込み中...</span>
          </div>
        ) : codeTree.length === 0 ? (
          <div className="code-panel-empty">
            <span className="text-xs text-secondary">
              コードがありません。上のフォームから追加してください。
            </span>
          </div>
        ) : (
          codeTree.map((node) => (
            <CodeTreeNode
              key={node.id}
              node={node}
              depth={0}
              selectedCodeId={selectedCode?.id ?? null}
              onSelect={setSelectedCode}
              onUpdate={handleUpdateCode}
              onDelete={handleDeleteCode}
              onDrop={handleDrop}
            />
          ))
        )}
      </div>
    </div>
  );
};

// ユーティリティ: ツリーをフラットに展開
function flattenTree(nodes: CodeNode[]): CodeNode[] {
  const result: CodeNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children) {
      result.push(...flattenTree(node.children));
    }
  }
  return result;
}

export default CodePanel;
