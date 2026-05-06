// src/components/qualitative/CodebookView.tsx
// コードブック管理 — コードツリー表示 + コード別ハイライト一覧

import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { CodeNode, HighlightWithContext } from "../../types";
import { CodeTreeNode } from "./CodeTreeNode";

interface CodebookViewProps {
  projectId: string;
}

export const CodebookView: React.FC<CodebookViewProps> = ({ projectId }) => {
  const [codeTree, setCodeTree] = useState<CodeNode[]>([]);
  const [selectedCodeId, setSelectedCodeId] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<HighlightWithContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCodeName, setNewCodeName] = useState("");
  const [newCodeColor, setNewCodeColor] = useState("#6366F1");

  const loadCodeTree = useCallback(async () => {
    try {
      const tree = await invoke<CodeNode[]>("get_code_tree", {
        projectId,
      });
      setCodeTree(tree);
    } catch (err) {
      console.error("コードツリー取得エラー:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadCodeTree();
  }, [loadCodeTree]);

  const loadHighlights = useCallback(async (codeId: string) => {
    try {
      const result = await invoke<HighlightWithContext[]>(
        "get_highlights_by_code",
        { codeId }
      );
      setHighlights(result);
    } catch (err) {
      console.error("ハイライト取得エラー:", err);
    }
  }, []);

  useEffect(() => {
    if (selectedCodeId) {
      void loadHighlights(selectedCodeId);
    } else {
      setHighlights([]);
    }
  }, [selectedCodeId, loadHighlights]);

  const handleCreateCode = useCallback(async () => {
    if (!newCodeName.trim()) return;
    try {
      await invoke("create_code", {
        input: {
          projectId,
          name: newCodeName.trim(),
          color: newCodeColor,
        },
      });
      setNewCodeName("");
      void loadCodeTree();
    } catch (err) {
      console.error("コード作成エラー:", err);
    }
  }, [newCodeName, newCodeColor, projectId, loadCodeTree]);

  const handleUpdateCode = useCallback(
    async (id: string, name: string, color: string) => {
      try {
        await invoke("update_code", { id, input: { name, color } });
        void loadCodeTree();
      } catch (err) {
        console.error("コード更新エラー:", err);
      }
    },
    [loadCodeTree]
  );

  const handleDeleteCode = useCallback(
    async (id: string) => {
      if (!confirm("このコードを削除しますか？")) return;
      try {
        await invoke("delete_code", { id });
        if (selectedCodeId === id) setSelectedCodeId(null);
        void loadCodeTree();
      } catch (err) {
        console.error("コード削除エラー:", err);
      }
    },
    [selectedCodeId, loadCodeTree]
  );

  const handleDrop = useCallback(
    async (draggedId: string, newParentId: string | null) => {
      try {
        await invoke("update_code", {
          id: draggedId,
          input: { parentId: newParentId },
        });
        void loadCodeTree();
      } catch (err) {
        console.error("コード移動エラー:", err);
      }
    },
    [loadCodeTree]
  );

  const handleRootDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const draggedId = e.dataTransfer.getData("text/plain");
      if (draggedId) {
        void handleDrop(draggedId, null);
      }
    },
    [handleDrop]
  );

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
      {/* 左: コードツリー */}
      <div
        className="flex flex-col shrink-0 h-full"
        style={{
          width: "280px",
          borderRight: "1px solid var(--color-border-primary)",
        }}
      >
        <header
          className="flex items-center justify-between px-3 shrink-0"
          style={{
            height: "40px",
            borderBottom: "1px solid var(--color-border-primary)",
          }}
        >
          <span
            className="text-xs font-semibold"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            コードツリー
          </span>
          <span
            className="text-xs"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {flattenTree(codeTree).length}件
          </span>
        </header>

        {/* 新規コード作成 */}
        <div
          className="flex items-center gap-1 px-2 py-2 shrink-0"
          style={{ borderBottom: "1px solid var(--color-border-secondary)" }}
        >
          <input
            type="color"
            value={newCodeColor}
            onChange={(e) => setNewCodeColor(e.target.value)}
            style={{
              width: "24px",
              height: "24px",
              border: "none",
              padding: 0,
              cursor: "pointer",
              borderRadius: "4px",
            }}
          />
          <input
            type="text"
            value={newCodeName}
            onChange={(e) => setNewCodeName(e.target.value)}
            placeholder="新しいコード名"
            className="flex-1 text-xs px-2 py-1"
            style={{
              backgroundColor: "var(--color-bg-primary)",
              color: "var(--color-text-primary)",
              border: "1px solid var(--color-border-primary)",
              borderRadius: "4px",
              outline: "none",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreateCode();
            }}
          />
          <button
            type="button"
            onClick={() => void handleCreateCode()}
            className="text-xs px-2 py-1"
            style={{
              backgroundColor: "var(--color-accent-primary)",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            追加
          </button>
        </div>

        {/* ツリー */}
        <div
          className="flex-1 overflow-y-auto p-1"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleRootDrop}
        >
          {codeTree.length === 0 ? (
            <div
              className="text-center py-8 text-xs"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              コードなし。上のフォームで追加してください。
            </div>
          ) : (
            codeTree.map((node) => (
              <CodeTreeNode
                key={node.id}
                node={node}
                depth={0}
                selectedCodeId={selectedCodeId}
                onSelect={setSelectedCodeId}
                onUpdate={handleUpdateCode}
                onDelete={handleDeleteCode}
                onDrop={handleDrop}
              />
            ))
          )}
        </div>
      </div>

      {/* 右: コード別ハイライト一覧 */}
      <div className="flex-1 overflow-y-auto p-4">
        {selectedCodeId ? (
          <>
            <h3
              className="text-sm font-semibold mb-3"
              style={{ color: "var(--color-text-primary)" }}
            >
              コードに割り当てられたハイライト ({highlights.length}件)
            </h3>
            {highlights.length === 0 ? (
              <p
                className="text-xs"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                このコードにはまだハイライトが割り当てられていません。
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {highlights.map((h) => (
                  <div
                    key={h.id}
                    className="p-3"
                    style={{
                      backgroundColor: "var(--color-bg-secondary)",
                      borderRadius: "8px",
                      border: "1px solid var(--color-border-primary)",
                      borderLeft: `3px solid ${h.color}`,
                    }}
                  >
                    <div
                      className="text-xs mb-1"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      {h.paperTitle} — p.{h.page}
                    </div>
                    <p
                      className="text-sm"
                      style={{
                        color: "var(--color-text-primary)",
                        lineHeight: "1.5",
                      }}
                    >
                      {h.text}
                    </p>
                    {h.comment && (
                      <p
                        className="text-xs mt-1"
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        💬 {h.comment}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div
            className="flex flex-col items-center justify-center h-full gap-3"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            <span className="text-sm">
              左のツリーからコードを選択してください
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

/** ツリーをフラット化するユーティリティ */
function flattenTree(nodes: CodeNode[]): CodeNode[] {
  const result: CodeNode[] = [];
  for (const node of nodes) {
    result.push(node);
    result.push(...flattenTree(node.children));
  }
  return result;
}
