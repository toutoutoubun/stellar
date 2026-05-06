// src/components/qualitative/CodePanel.tsx
// PDFリーダー内コーディングパネル — ハイライトにコードを割り当て/解除
// ミニマルUI / カスタムアイコン

import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Highlight, QualProject, CodeNode } from "../../types";
import { CodeTreeNode } from "./CodeTreeNode";
import { IconPlus, IconAssignCode, IconRemoveCode, IconCodebook } from "./icons/QualIcons";

interface CodePanelProps {
  highlights: Highlight[];
  selectedHighlightIds: Set<string>;
  paperId?: string;
  currentProjectId?: string;
}

/** ツリーをフラットに展開 */
function flattenTree(nodes: CodeNode[]): CodeNode[] {
  const result: CodeNode[] = [];
  for (const n of nodes) {
    result.push(n);
    result.push(...flattenTree(n.children));
  }
  return result;
}

const CodePanel: React.FC<CodePanelProps> = ({
  highlights,
  selectedHighlightIds,
  paperId: _paperId,
  currentProjectId,
}) => {
  const [projects, setProjects] = useState<QualProject[]>([]);
  const [projectId, setProjectId] = useState<string>(currentProjectId ?? "");
  const [codeTree, setCodeTree] = useState<CodeNode[]>([]);
  const [selectedCodeId, setSelectedCodeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [newCodeName, setNewCodeName] = useState("");
  const [newCodeColor, setNewCodeColor] = useState("#6366F1");
  /** highlight_id → Set<code_id> のマッピング */
  const [highlightCodeMap, setHighlightCodeMap] = useState<
    Record<string, Set<string>>
  >({});

  // プロジェクト一覧取得
  useEffect(() => {
    const load = async () => {
      try {
        const result = await invoke<QualProject[]>("get_projects");
        setProjects(result);
        if (!projectId && result.length > 0 && result[0]) {
          setProjectId(result[0].id);
        }
      } catch (err) {
        console.error("プロジェクト取得エラー:", err);
      }
    };
    void load();
  }, [projectId]);

  // コードツリー取得
  const loadCodeTree = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const tree = await invoke<CodeNode[]>("get_code_tree", { projectId });
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

  // ハイライト-コードマッピング取得
  const loadHighlightCodes = useCallback(async () => {
    if (!projectId || codeTree.length === 0) return;
    const flat = flattenTree(codeTree);
    const map: Record<string, Set<string>> = {};
    for (const code of flat) {
      try {
        const hls = await invoke<Array<{ id: string }>>(
          "get_highlights_by_code",
          { codeId: code.id }
        );
        for (const h of hls) {
          map[h.id] ??= new Set();
          map[h.id]!.add(code.id);
        }
      } catch {
        // ignore
      }
    }
    setHighlightCodeMap(map);
  }, [projectId, codeTree]);

  useEffect(() => {
    void loadHighlightCodes();
  }, [loadHighlightCodes]);

  const handleCreateCode = useCallback(async () => {
    if (!newCodeName.trim() || !projectId) return;
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

  const handleAssignCode = useCallback(
    async (highlightId: string, codeId: string) => {
      try {
        await invoke("assign_code_to_highlight", { highlightId, codeId });
        setHighlightCodeMap((prev) => {
          const next = { ...prev };
          if (!next[highlightId]) next[highlightId] = new Set();
          else next[highlightId] = new Set(next[highlightId]);
          next[highlightId].add(codeId);
          return next;
        });
      } catch (err) {
        console.error("コード割り当てエラー:", err);
      }
    },
    []
  );

  const handleRemoveCode = useCallback(
    async (highlightId: string, codeId: string) => {
      try {
        await invoke("remove_code_from_highlight", { highlightId, codeId });
        setHighlightCodeMap((prev) => {
          const next = { ...prev };
          if (next[highlightId]) {
            next[highlightId] = new Set(next[highlightId]);
            next[highlightId].delete(codeId);
          }
          return next;
        });
      } catch (err) {
        console.error("コード割り当て解除エラー:", err);
      }
    },
    []
  );

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
      try {
        await invoke("delete_code", { id });
        void loadCodeTree();
      } catch (err) {
        console.error("コード削除エラー:", err);
      }
    },
    [loadCodeTree]
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

  const flat = flattenTree(codeTree);
  const selectedHighlights = highlights.filter((h) =>
    selectedHighlightIds.has(h.id)
  );

  return (
    <div className="flex flex-col h-full" style={{ padding: "8px" }}>
      {/* プロジェクト選択 */}
      <div className="mb-2">
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="w-full text-xs px-2 py-1"
          style={{
            backgroundColor: "var(--color-bg-primary)",
            color: "var(--color-text-primary)",
            border: "1px solid var(--color-border-primary)",
            borderRadius: "4px",
          }}
        >
          <option value="">プロジェクトを選択</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* 選択中ハイライトへのコード割り当て */}
      {selectedHighlights.length > 0 && selectedCodeId && (
        <div
          className="mb-2 p-2"
          style={{
            backgroundColor: "var(--color-bg-tertiary)",
            borderRadius: "6px",
          }}
        >
          <div
            className="text-xs mb-1"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            選択中: {selectedHighlights.length}件のハイライト
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => {
                for (const h of selectedHighlights) {
                  void handleAssignCode(h.id, selectedCodeId);
                }
              }}
              className="flex-1 text-xs py-1 inline-flex items-center justify-center gap-1"
              style={{
                backgroundColor: "var(--color-accent-primary)",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              <IconAssignCode size={11} color="#fff" />
              コード付与
            </button>
            <button
              type="button"
              onClick={() => {
                for (const h of selectedHighlights) {
                  void handleRemoveCode(h.id, selectedCodeId);
                }
              }}
              className="flex-1 text-xs py-1 inline-flex items-center justify-center gap-1"
              style={{
                backgroundColor: "transparent",
                color: "var(--color-text-secondary)",
                border: "1px solid var(--color-border-secondary)",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              <IconRemoveCode size={11} />
              コード解除
            </button>
          </div>
        </div>
      )}

      {/* ハイライト一覧とコード表示 */}
      {highlights.length > 0 && (
        <div
          className="mb-2"
          style={{
            maxHeight: "120px",
            overflowY: "auto",
          }}
        >
          <div
            className="text-xs mb-1"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            ハイライト ({highlights.length}件)
          </div>
          {highlights.slice(0, 20).map((h) => {
            const codes = highlightCodeMap[h.id];
            return (
              <div
                key={h.id}
                className="flex items-start gap-1 py-1"
                style={{
                  borderBottom: "1px solid var(--color-border-secondary)",
                }}
              >
                <span
                  className="text-xs truncate flex-1"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {h.text.slice(0, 40)}...
                </span>
                {codes && codes.size > 0 && (
                  <div className="flex gap-0.5 shrink-0">
                    {Array.from(codes).map((cid) => {
                      const code = flat.find((c) => c.id === cid);
                      return code ? (
                        <span
                          key={cid}
                          className="text-xs px-1"
                          style={{
                            backgroundColor: code.color + "20",
                            color: code.color,
                            borderRadius: "3px",
                            fontSize: "9px",
                          }}
                        >
                          {code.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 新規コード作成 */}
      <div
        className="flex items-center gap-1 mb-2"
        style={{ borderBottom: "1px solid var(--color-border-secondary)", paddingBottom: "8px" }}
      >
        <input
          type="color"
          value={newCodeColor}
          onChange={(e) => setNewCodeColor(e.target.value)}
          style={{ width: "20px", height: "20px", border: "none", padding: 0, cursor: "pointer" }}
        />
        <input
          type="text"
          value={newCodeName}
          onChange={(e) => setNewCodeName(e.target.value)}
          placeholder="新しいコード"
          className="flex-1 text-xs px-1 py-0.5"
          style={{
            backgroundColor: "var(--color-bg-primary)",
            color: "var(--color-text-primary)",
            border: "1px solid var(--color-border-primary)",
            borderRadius: "3px",
            outline: "none",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleCreateCode();
          }}
        />
        <button
          type="button"
          onClick={() => void handleCreateCode()}
          title="コードを追加"
          style={{
            backgroundColor: "var(--color-accent-primary)",
            color: "#fff",
            border: "none",
            borderRadius: "3px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            padding: "3px 6px",
          }}
        >
          <IconPlus size={11} color="#fff" />
        </button>
      </div>

      {/* コードツリー */}
      <div
        className="flex-1 overflow-y-auto"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const draggedId = e.dataTransfer.getData("text/plain");
          if (draggedId) void handleDrop(draggedId, null);
        }}
      >
        {loading ? (
          <div
            className="text-center py-4 text-xs"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            読み込み中...
          </div>
        ) : codeTree.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-4 gap-2 text-xs"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            <IconCodebook size={20} />
            <span>コードなし</span>
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
  );
};

export default CodePanel;
