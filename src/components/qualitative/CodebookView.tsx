// src/components/qualitative/CodebookView.tsx
// 2カラムエディタ — コードツリー + 詳細編集 + エクスポート

import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type {
  CodeNode,
  CreateQualCodeInput,
  UpdateQualCodeInput,
  HighlightWithContext,
} from '../../types';
import CodeTreeNode from './CodeTreeNode';

interface CodebookViewProps {
  projectId: string;
}

const CodebookView: React.FC<CodebookViewProps> = ({ projectId }) => {
  const [codeTree, setCodeTree] = useState<CodeNode[]>([]);
  const [selectedCode, setSelectedCode] = useState<CodeNode | null>(null);
  const [highlights, setHighlights] = useState<HighlightWithContext[]>([]);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    color: '#6366F1',
    codeType: 'thematic',
  });
  const [newCodeName, setNewCodeName] = useState('');
  const [loading, setLoading] = useState(false);

  const loadCodeTree = useCallback(async () => {
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

  // コード選択時に詳細を読み込む
  useEffect(() => {
    if (selectedCode) {
      setEditForm({
        name: selectedCode.name,
        description: selectedCode.description ?? '',
        color: selectedCode.color,
        codeType: selectedCode.codeType,
      });
      invoke<HighlightWithContext[]>('get_highlights_by_code', {
        codeId: selectedCode.id,
      })
        .then(setHighlights)
        .catch(console.error);
    } else {
      setHighlights([]);
    }
  }, [selectedCode]);

  const handleCreateCode = async () => {
    if (!newCodeName.trim()) return;
    const input: CreateQualCodeInput = {
      projectId,
      name: newCodeName.trim(),
      parentId: selectedCode?.id ?? null,
    };
    await invoke('create_code', { input });
    setNewCodeName('');
    loadCodeTree();
  };

  const handleUpdateCode = async (id: string, input: UpdateQualCodeInput) => {
    await invoke('update_code', { id, input });
    loadCodeTree();
  };

  const handleDeleteCode = async (id: string) => {
    await invoke('delete_code', { id });
    if (selectedCode?.id === id) setSelectedCode(null);
    loadCodeTree();
  };

  const handleDrop = async (draggedId: string, newParentId: string | null) => {
    await invoke('update_code', {
      id: draggedId,
      input: { parentId: newParentId } as UpdateQualCodeInput,
    });
    loadCodeTree();
  };

  const handleSaveDetail = async () => {
    if (!selectedCode) return;
    await handleUpdateCode(selectedCode.id, {
      name: editForm.name,
      description: editForm.description || null,
      color: editForm.color,
      codeType: editForm.codeType,
    });
  };

  // コードブックをMarkdownでエクスポート
  const handleExport = () => {
    const lines: string[] = ['# コードブック\n'];
    const exportNode = (node: CodeNode, depth: number) => {
      const indent = '  '.repeat(depth);
      lines.push(
        `${indent}- **${node.name}** (${node.codeType}, ${node.assignmentCount}件)`
      );
      if (node.description) {
        lines.push(`${indent}  ${node.description}`);
      }
      for (const child of node.children ?? []) {
        exportNode(child, depth + 1);
      }
    };
    for (const node of codeTree) {
      exportNode(node, 0);
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'codebook.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="codebook-view">
      {/* 左カラム: コードツリー */}
      <div className="codebook-left">
        <div className="codebook-left-header">
          <h3 className="text-sm font-semibold">コードブック</h3>
          <button className="btn-ghost text-xs" onClick={handleExport} title="エクスポート">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v8M3 5l4 4 4-4M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* 新規コード入力 */}
        <div className="codebook-create">
          <input
            className="input-field text-xs"
            placeholder="新規コード..."
            value={newCodeName}
            onChange={(e) => setNewCodeName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateCode()}
          />
          <button
            className="btn-primary text-xs px-2 py-1"
            onClick={handleCreateCode}
            disabled={!newCodeName.trim()}
          >
            +
          </button>
        </div>

        {/* ツリー */}
        <div
          className="codebook-tree"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const draggedId = e.dataTransfer.getData('text/plain');
            if (draggedId) handleDrop(draggedId, null);
          }}
        >
          {loading ? (
            <p className="text-xs text-secondary p-2">読み込み中...</p>
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

      {/* 右カラム: 詳細エディタ */}
      <div className="codebook-right">
        {selectedCode ? (
          <>
            <h3 className="text-sm font-semibold mb-3">コード詳細</h3>
            <div className="codebook-detail-form">
              <label className="label-sm">コード名</label>
              <input
                className="input-field text-sm"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />

              <label className="label-sm mt-2">説明</label>
              <textarea
                className="input-field text-sm"
                rows={3}
                value={editForm.description}
                onChange={(e) =>
                  setEditForm({ ...editForm, description: e.target.value })
                }
                placeholder="コードの定義・適用基準..."
              />

              <div className="flex gap-2 mt-2">
                <div className="flex-1">
                  <label className="label-sm">種別</label>
                  <select
                    className="input-field text-xs"
                    value={editForm.codeType}
                    onChange={(e) =>
                      setEditForm({ ...editForm, codeType: e.target.value })
                    }
                  >
                    <option value="thematic">テーマ</option>
                    <option value="descriptive">記述</option>
                    <option value="in_vivo">In Vivo</option>
                    <option value="process">プロセス</option>
                    <option value="structural">構造</option>
                  </select>
                </div>
                <div>
                  <label className="label-sm">カラー</label>
                  <input
                    type="color"
                    value={editForm.color}
                    onChange={(e) =>
                      setEditForm({ ...editForm, color: e.target.value })
                    }
                    className="code-color-picker-lg"
                  />
                </div>
              </div>

              <button
                className="btn-primary text-xs mt-3"
                onClick={handleSaveDetail}
              >
                保存
              </button>
            </div>

            {/* コードに紐づくハイライト */}
            <div className="codebook-excerpts mt-4">
              <h4 className="text-xs font-semibold text-secondary mb-2">
                割り当て済みハイライト ({highlights.length}件)
              </h4>
              {highlights.length === 0 ? (
                <p className="text-xs text-secondary">まだハイライトが割り当てられていません</p>
              ) : (
                <div className="codebook-excerpt-list">
                  {highlights.map((hl) => (
                    <div key={hl.id} className="codebook-excerpt-item">
                      <span className="text-xs text-secondary">{hl.paperTitle} (p.{hl.page})</span>
                      <p className="text-xs mt-1">{hl.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="codebook-empty-detail">
            <p className="text-sm text-secondary">
              左のコードを選択すると詳細が表示されます
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CodebookView;
