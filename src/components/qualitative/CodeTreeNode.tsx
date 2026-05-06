// src/components/qualitative/CodeTreeNode.tsx
// 再帰的コードツリーノード — ドラッグ&ドロップ対応

import React, { useState, useCallback } from 'react';
import type { CodeNode, UpdateQualCodeInput } from '../../types';

interface CodeTreeNodeProps {
  node: CodeNode;
  depth: number;
  selectedCodeId: string | null;
  onSelect: (code: CodeNode) => void;
  onUpdate: (id: string, input: UpdateQualCodeInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDrop: (draggedId: string, newParentId: string | null) => Promise<void>;
}

const CodeTreeNode: React.FC<CodeTreeNodeProps> = ({
  node,
  depth,
  selectedCodeId,
  onSelect,
  onUpdate,
  onDelete,
  onDrop,
}) => {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(node.name);
  const [dragOver, setDragOver] = useState(false);

  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedCodeId === node.id;

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData('text/plain', node.id);
      e.dataTransfer.effectAllowed = 'move';
    },
    [node.id]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDropOnNode = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      const draggedId = e.dataTransfer.getData('text/plain');
      if (draggedId && draggedId !== node.id) {
        onDrop(draggedId, node.id);
      }
    },
    [node.id, onDrop]
  );

  const handleSaveEdit = useCallback(async () => {
    if (editName.trim() && editName !== node.name) {
      await onUpdate(node.id, { name: editName.trim() });
    }
    setEditing(false);
  }, [editName, node.id, node.name, onUpdate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSaveEdit();
      if (e.key === 'Escape') {
        setEditName(node.name);
        setEditing(false);
      }
    },
    [handleSaveEdit, node.name]
  );

  return (
    <div className="code-tree-node">
      <div
        className={`code-tree-item ${isSelected ? 'selected' : ''} ${dragOver ? 'drag-over' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDropOnNode}
        onClick={() => onSelect(node)}
      >
        {/* 展開/折りたたみ */}
        <button
          className="code-tree-toggle"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            style={{
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s',
            }}
          >
            <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>

        {/* カラードット */}
        <span
          className="code-color-dot"
          style={{ backgroundColor: node.color }}
        />

        {/* 名前（編集可能） */}
        {editing ? (
          <input
            className="code-tree-edit-input"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSaveEdit}
            onKeyDown={handleKeyDown}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="code-tree-label"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditing(true);
              setEditName(node.name);
            }}
          >
            {node.name}
          </span>
        )}

        {/* 割り当て数バッジ */}
        {node.assignmentCount > 0 && (
          <span className="code-tree-badge">{node.assignmentCount}</span>
        )}

        {/* 削除ボタン */}
        <button
          className="code-tree-delete"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`コード「${node.name}」を削除しますか？`)) {
              onDelete(node.id);
            }
          }}
          title="削除"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>

      {/* 子ノード */}
      {expanded && hasChildren && (
        <div className="code-tree-children">
          {node.children.map((child) => (
            <CodeTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedCodeId={selectedCodeId}
              onSelect={onSelect}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onDrop={onDrop}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CodeTreeNode;
