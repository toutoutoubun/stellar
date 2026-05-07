// src/components/qualitative/CodeTreeNode.tsx
// コードツリーの再帰ノードコンポーネント — ミニマルUI / カスタムアイコン

import React, { useState, useCallback } from "react";
import type { CodeNode } from "../../types";
import { IconChevronRight, IconEdit, IconDelete, IconCheck, IconClose } from "./icons/QualIcons";
import { useT } from "../../stores/useI18nStore";

interface CodeTreeNodeProps {
  node: CodeNode;
  depth: number;
  selectedCodeId: string | null;
  onSelect: (codeId: string) => void;
  onUpdate: (id: string, name: string, color: string) => void;
  onDelete: (id: string) => void;
  onDrop: (draggedId: string, newParentId: string | null) => void;
}

export const CodeTreeNode: React.FC<CodeTreeNodeProps> = ({
  node,
  depth,
  selectedCodeId,
  onSelect,
  onUpdate,
  onDelete,
  onDrop,
}) => {
  const t = useT();
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(node.name);
  const [editColor, setEditColor] = useState(node.color);

  const isSelected = selectedCodeId === node.id;
  const hasChildren = node.children.length > 0;

  const handleSaveEdit = useCallback(() => {
    if (editName.trim()) {
      onUpdate(node.id, editName.trim(), editColor);
    }
    setEditing(false);
  }, [editName, editColor, node.id, onUpdate]);

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData("text/plain", node.id);
      e.stopPropagation();
    },
    [node.id],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDropOnNode = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const draggedId = e.dataTransfer.getData("text/plain");
      if (draggedId && draggedId !== node.id) {
        onDrop(draggedId, node.id);
      }
    },
    [node.id, onDrop],
  );

  return (
    <div>
      <div
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDropOnNode}
        className="flex items-center gap-1 group"
        style={{
          paddingLeft: `${depth * 16 + 4}px`,
          paddingRight: "4px",
          paddingTop: "3px",
          paddingBottom: "3px",
          borderRadius: "4px",
          cursor: "pointer",
          backgroundColor: isSelected ? "var(--color-bg-hover)" : "transparent",
          transition: "background-color 80ms",
        }}
        onClick={() => onSelect(node.id)}
      >
        {/* 展開/折りたたみ */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className="shrink-0"
          style={{
            width: "16px",
            height: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-text-tertiary)",
            background: "none",
            border: "none",
            cursor: "pointer",
            visibility: hasChildren ? "visible" : "hidden",
          }}
        >
          <IconChevronRight
            size={10}
            color="var(--color-text-tertiary)"
            className={expanded ? "rotate-90" : ""}
          />
        </button>

        {/* カラードット */}
        <span
          className="shrink-0"
          style={{
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            backgroundColor: node.color,
          }}
        />

        {/* 名前 or 編集フォーム */}
        {editing ? (
          <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
            <input
              type="color"
              value={editColor}
              onChange={(e) => setEditColor(e.target.value)}
              style={{ width: "20px", height: "20px", border: "none", padding: 0, cursor: "pointer", borderRadius: "4px" }}
            />
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveEdit();
                if (e.key === "Escape") setEditing(false);
              }}
              className="flex-1 text-xs px-1 py-0.5"
              style={{
                backgroundColor: "var(--color-bg-primary)",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-border-primary)",
                borderRadius: "3px",
                outline: "none",
              }}
              autoFocus
            />
            <button
              type="button"
              onClick={handleSaveEdit}
              style={{ color: "var(--color-accent-primary)", background: "none", border: "none", cursor: "pointer", display: "flex", padding: "2px" }}
            >
              <IconCheck size={12} />
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              style={{ color: "var(--color-text-tertiary)", background: "none", border: "none", cursor: "pointer", display: "flex", padding: "2px" }}
            >
              <IconClose size={12} />
            </button>
          </div>
        ) : (
          <>
            <span
              className="flex-1 text-xs truncate"
              style={{
                color: isSelected ? "var(--color-accent-primary)" : "var(--color-text-primary)",
              }}
            >
              {node.name}
            </span>
            <span className="text-xs shrink-0" style={{ color: "var(--color-text-tertiary)", fontSize: "10px" }}>
              {node.assignmentCount > 0 ? node.assignmentCount : ""}
            </span>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100" style={{ transition: "opacity 80ms" }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditName(node.name);
                  setEditColor(node.color);
                  setEditing(true);
                }}
                title={t.common.edit}
                style={{ color: "var(--color-text-tertiary)", background: "none", border: "none", cursor: "pointer", padding: "2px", display: "flex" }}
              >
                <IconEdit size={11} />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
                title={t.common.delete}
                style={{ color: "var(--color-text-tertiary)", background: "none", border: "none", cursor: "pointer", padding: "2px", display: "flex" }}
              >
                <IconDelete size={11} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* 子ノード */}
      {expanded && hasChildren && node.children.map((child) => (
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
  );
};
