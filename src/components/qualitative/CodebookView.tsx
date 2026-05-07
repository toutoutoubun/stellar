// src/components/qualitative/CodebookView.tsx
// コードブック管理 — コードツリー表示 + コード別ハイライト一覧
// 左パネル折りたたみ対応 / ミニマルUI / カスタムアイコン

import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "../../lib/tauriShim";
import { swalConfirm } from "../../lib/swal";
import type { CodeNode, HighlightWithContext } from "../../types";
import { CodeTreeNode } from "./CodeTreeNode";
import { HelpTooltip } from "./HelpTooltip";
import { IconPlus, IconComment, IconPanelLeft } from "./icons/QualIcons";
import { useT } from "../../stores/useI18nStore";

interface CodebookViewProps {
  projectId: string;
}

export const CodebookView: React.FC<CodebookViewProps> = ({ projectId }) => {
  const t = useT();
  const [codeTree, setCodeTree] = useState<CodeNode[]>([]);
  const [selectedCodeId, setSelectedCodeId] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<HighlightWithContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCodeName, setNewCodeName] = useState("");
  const [newCodeColor, setNewCodeColor] = useState("#6366F1");
  const [treeCollapsed, setTreeCollapsed] = useState(false);

  const loadCodeTree = useCallback(async () => {
    try {
      const tree = await invoke<CodeNode[]>("get_code_tree", { projectId });
      setCodeTree(tree);
    } catch (err) {
      console.error(t.qualitative.k_89eley, err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- legitimate data sync/fetch pattern
  useEffect(() => { void loadCodeTree(); }, [loadCodeTree]);

  const loadHighlights = useCallback(async (codeId: string) => {
    try {
      const result = await invoke<HighlightWithContext[]>("get_highlights_by_code", { codeId });
      setHighlights(result);
    } catch (err) {
      console.error(t.qualitative.k_cjt8o, err);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- legitimate data sync/fetch pattern
    if (selectedCodeId) { void loadHighlights(selectedCodeId); } else { setHighlights([]); }
  }, [selectedCodeId, loadHighlights]);

  const handleCreateCode = useCallback(async () => {
    if (!newCodeName.trim()) return;
    try {
      await invoke("create_code", { input: { projectId, name: newCodeName.trim(), color: newCodeColor } });
      setNewCodeName("");
      void loadCodeTree();
    } catch (err) { console.error(t.qualitative.k_t2xyvh, err); }
  }, [newCodeName, newCodeColor, projectId, loadCodeTree]);

  const handleUpdateCode = useCallback(async (id: string, name: string, color: string) => {
    try { await invoke("update_code", { id, input: { name, color } }); void loadCodeTree(); } catch (err) { console.error(t.qualitative.k_3my69n, err); }
  }, [loadCodeTree]);

  const handleDeleteCode = useCallback(async (id: string) => {
    const ok = await swalConfirm(t.qualitative.k_gahyli, t.qualitative.k_9bdo2p);
    if (!ok) return;
    try { await invoke("delete_code", { id }); if (selectedCodeId === id) setSelectedCodeId(null); void loadCodeTree(); } catch (err) { console.error(t.qualitative.k_xeq3q1, err); }
  }, [selectedCodeId, loadCodeTree]);

  const handleDrop = useCallback(async (draggedId: string, newParentId: string | null) => {
    try { await invoke("update_code", { id: draggedId, input: { parentId: newParentId } }); void loadCodeTree(); } catch (err) { console.error(t.qualitative.k_y8ung9, err); }
  }, [loadCodeTree]);

  const handleRootDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData("text/plain");
    if (draggedId) void handleDrop(draggedId, null);
  }, [handleDrop]);

  if (loading) {
    return <div className="flex items-center justify-center h-full" style={{ color: "var(--color-text-tertiary)" }}><span className="text-sm">{t.common.loading}</span></div>;
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* 左: コードツリー */}
      <div
        className="flex flex-col shrink-0 h-full"
        style={{ width: treeCollapsed ? "40px" : "260px", borderRight: "1px solid var(--color-border-primary)", transition: "width 150ms ease-out", overflow: "hidden" }}
      >
        <header className="flex items-center justify-between px-2 shrink-0" style={{ height: "36px", borderBottom: "1px solid var(--color-border-primary)" }}>
          {!treeCollapsed && (
            <span className="text-xs font-semibold" style={{ color: "var(--color-text-tertiary)" }}>
              コードツリー <span style={{ fontWeight: 400 }}>({flattenTree(codeTree).length})</span>
            </span>
          )}
          <button type="button" onClick={() => setTreeCollapsed(!treeCollapsed)} title={treeCollapsed ? t.qualitative.k_gixi : t.qualitative.k_yczceq} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)", padding: "4px", display: "flex" }}>
            <IconPanelLeft size={13} />
          </button>
        </header>

        {!treeCollapsed && (
          <>
            {/* 新規コード作成 */}
            <div className="flex items-center gap-1 px-2 py-1.5 shrink-0" style={{ borderBottom: "1px solid var(--color-border-secondary)" }}>
              <input type="color" value={newCodeColor} onChange={(e) => setNewCodeColor(e.target.value)} style={{ width: "22px", height: "22px", border: "none", padding: 0, cursor: "pointer", borderRadius: "4px" }} />
              <input
                type="text" value={newCodeName} onChange={(e) => setNewCodeName(e.target.value)} placeholder={t.qualitative.k_v0f07e}
                className="flex-1 text-xs px-2 py-1"
                style={{ backgroundColor: "var(--color-bg-primary)", color: "var(--color-text-primary)", border: "1px solid var(--color-border-primary)", borderRadius: "4px", outline: "none" }}
                onKeyDown={(e) => { if (e.key === "Enter") void handleCreateCode(); }}
              />
              <button type="button" onClick={() => void handleCreateCode()} className="text-xs px-2 py-1 inline-flex items-center gap-0.5" style={{ backgroundColor: "var(--color-accent-primary)", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}>
                <IconPlus size={10} />
              </button>
            </div>

            {/* ツリー */}
            <div className="flex-1 overflow-y-auto p-1" onDragOver={(e) => e.preventDefault()} onDrop={handleRootDrop}>
              {codeTree.length === 0 ? (
                <div className="text-center py-6 text-xs" style={{ color: "var(--color-text-tertiary)" }}>コードなし</div>
              ) : (
                codeTree.map((node) => (
                  <CodeTreeNode key={node.id} node={node} depth={0} selectedCodeId={selectedCodeId} onSelect={setSelectedCodeId} onUpdate={handleUpdateCode} onDelete={handleDeleteCode} onDrop={handleDrop} />
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* 右: コード別ハイライト一覧 */}
      <div className="flex-1 overflow-y-auto p-4">
        <HelpTooltip
          storageKey="qual_codebook"
          title={t.qualitative.k_yn8j6g}
          paragraphs={[t.qualitative.k_xssqzv]}
          steps={[t.qualitative.k_9dl84i, t.qualitative.k_4yb8q3, t.qualitative.k_f727j8]}
        />
        {selectedCodeId ? (
          <>
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
              割り当て済みハイライト ({highlights.length})
            </h3>
            {highlights.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>このコードにはまだハイライトが割り当てられていません。</p>
            ) : (
              <div className="flex flex-col gap-2">
                {highlights.map((h) => (
                  <div key={h.id} className="p-3" style={{ backgroundColor: "var(--color-bg-secondary)", borderRadius: "8px", border: "1px solid var(--color-border-primary)", borderLeft: `3px solid ${h.color}` }}>
                    <div className="text-xs mb-1" style={{ color: "var(--color-text-tertiary)" }}>{h.paperTitle} - p.{h.page}</div>
                    <p className="text-sm" style={{ color: "var(--color-text-primary)", lineHeight: "1.5" }}>{h.text}</p>
                    {h.comment && (
                      <p className="text-xs mt-1 inline-flex items-center gap-1" style={{ color: "var(--color-text-secondary)" }}>
                        <IconComment size={11} /> {h.comment}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 gap-2" style={{ color: "var(--color-text-tertiary)" }}>
            <span className="text-sm">左のツリーからコードを選択</span>
          </div>
        )}
      </div>
    </div>
  );
};

function flattenTree(nodes: CodeNode[]): CodeNode[] {
  const result: CodeNode[] = [];
  for (const node of nodes) { result.push(node); result.push(...flattenTree(node.children)); }
  return result;
}
