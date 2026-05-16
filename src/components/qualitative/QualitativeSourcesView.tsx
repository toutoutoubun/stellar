// src/components/qualitative/QualitativeSourcesView.tsx
// 質的分析専用の分析ソース管理と、資料本文へのコード付与

import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke, openFileDialog } from "../../lib/tauriShim";
import { swalConfirm } from "../../lib/swal";
import { toast } from "../ui/Toast";
import type {
  CodeNode,
  QualitativeSource,
  SourceSegmentCode,
} from "../../types";
import {
  IconActorMap,
  IconAssignCode,
  IconDelete,
  IconPanelLeft,
  IconRefresh,
  IconSources,
} from "./icons/QualIcons";
import { useT } from "../../stores/useI18nStore";
import { CooccurrencePanel } from "./CooccurrencePanel";

interface QualitativeSourcesViewProps {
  projectId: string;
}

const ReaderView = lazy(() =>
  import("../reader/ReaderView").then((m) => ({ default: m.ReaderView })),
);

interface FlatCode {
  id: string;
  name: string;
  color: string;
  depth: number;
}

export const QualitativeSourcesView: React.FC<QualitativeSourcesViewProps> = ({
  projectId,
}) => {
  const t = useT();
  const contentRef = useRef<HTMLPreElement | null>(null);
  const [sources, setSources] = useState<QualitativeSource[]>([]);
  const [codeTree, setCodeTree] = useState<CodeNode[]>([]);
  const [segments, setSegments] = useState<SourceSegmentCode[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedCodeId, setSelectedCodeId] = useState<string>("");
  const [selectedText, setSelectedText] = useState("");
  const [offsetStart, setOffsetStart] = useState<number | null>(null);
  const [offsetEnd, setOffsetEnd] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [cooccurrenceSegmentId, setCooccurrenceSegmentId] = useState<string | null>(null);

  const selectedSource = sources.find((source) => source.id === selectedSourceId) ?? null;
  const selectedSourceIsPdf =
    selectedSource?.fileType.toLowerCase() === "pdf" && Boolean(selectedSource.filePath);
  const flatCodes = useMemo(() => flattenCodeTree(codeTree), [codeTree]);
  const codeById = useMemo(
    () => new Map(flatCodes.map((code) => [code.id, code])),
    [flatCodes],
  );

  const loadSources = useCallback(async () => {
    const result = await invoke<QualitativeSource[]>("get_qualitative_sources", {
      projectId,
    });
    const list = Array.isArray(result) ? result : [];
    setSources(list);
    setSelectedSourceId((current) => {
      if (current && list.some((source) => source.id === current)) return current;
      return list[0]?.id ?? null;
    });
  }, [projectId]);

  const loadCodes = useCallback(async () => {
    const tree = await invoke<CodeNode[]>("get_code_tree", { projectId });
    setCodeTree(Array.isArray(tree) ? tree : []);
  }, [projectId]);

  const loadSegments = useCallback(async (sourceId: string) => {
    const result = await invoke<SourceSegmentCode[]>("get_source_segments", {
      sourceId,
    });
    setSegments(Array.isArray(result) ? result : []);
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        await Promise.all([loadSources(), loadCodes()]);
      } catch (err) {
        console.error("Failed to load qualitative sources:", err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [loadSources, loadCodes]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedSourceId || selectedSourceIsPdf) {
      queueMicrotask(() => {
        if (!cancelled) setSegments([]);
      });
      return () => {
        cancelled = true;
      };
    }
    const loadSelectedSegments = async () => {
      const result = await invoke<SourceSegmentCode[]>("get_source_segments", {
        sourceId: selectedSourceId,
      });
      if (!cancelled) {
        setSegments(Array.isArray(result) ? result : []);
      }
    };
    void loadSelectedSegments();
    return () => {
      cancelled = true;
    };
  }, [selectedSourceId, selectedSourceIsPdf]);

  useEffect(() => {
    if (selectedCodeId || !flatCodes[0]) return;
    const nextCodeId = flatCodes[0].id;
    queueMicrotask(() => {
      setSelectedCodeId((current) => current || nextCodeId);
    });
  }, [flatCodes, selectedCodeId]);

  useEffect(() => {
    if (!cooccurrenceSegmentId) return;
    if (segments.some((segment) => segment.id === cooccurrenceSegmentId)) return;
    setCooccurrenceSegmentId(null);
  }, [cooccurrenceSegmentId, segments]);

  const handleImport = useCallback(async () => {
    setImporting(true);
    try {
      const selected = await openFileDialog({
        multiple: true,
        filters: [
          { name: "Qualitative sources", extensions: ["docx", "pdf", "md", "markdown"] },
        ],
        title: "分析ソースを取り込む",
      });
      const paths = Array.isArray(selected) ? selected : selected ? [selected] : [];
      if (paths.length === 0) return;

      let lastImported: QualitativeSource | null = null;
      for (const filePath of paths) {
        lastImported = await invoke<QualitativeSource>("import_qualitative_source", {
          input: { projectId, filePath },
        });
      }
      await loadSources();
      if (lastImported?.id) {
        setSelectedSourceId(lastImported.id);
      }
      toast.success(`${paths.length}件の分析ソースを取り込みました`);
    } catch (err) {
      console.error("Failed to import qualitative source:", err);
      toast.error(String(err).replace(/^Error:\s*/i, ""));
    } finally {
      setImporting(false);
    }
  }, [projectId, loadSources]);

  const captureSelection = useCallback(() => {
    const root = contentRef.current;
    const selection = window.getSelection();
    if (!root || !selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) return;

    const text = selection.toString();
    if (!text.trim()) {
      setSelectedText("");
      setOffsetStart(null);
      setOffsetEnd(null);
      return;
    }

    const before = range.cloneRange();
    before.selectNodeContents(root);
    before.setEnd(range.startContainer, range.startOffset);
    const start = before.toString().length;
    setSelectedText(text.trim());
    setOffsetStart(start);
    setOffsetEnd(start + text.length);
  }, []);

  const handleAssignCode = useCallback(async () => {
    if (!selectedSource || !selectedCodeId || !selectedText.trim()) return;
    try {
      await invoke<SourceSegmentCode>("assign_code_to_source_segment", {
        input: {
          sourceId: selectedSource.id,
          codeId: selectedCodeId,
          segmentText: selectedText,
          offsetStart,
          offsetEnd,
        },
      });
      setSelectedText("");
      setOffsetStart(null);
      setOffsetEnd(null);
      window.getSelection()?.removeAllRanges();
      await Promise.all([loadSegments(selectedSource.id), loadCodes()]);
    } catch (err) {
      console.error("Failed to assign code to source segment:", err);
      toast.error(String(err).replace(/^Error:\s*/i, ""));
    }
  }, [
    selectedSource,
    selectedCodeId,
    selectedText,
    offsetStart,
    offsetEnd,
    loadSegments,
    loadCodes,
  ]);

  const handleDeleteSource = useCallback(
    async (source: QualitativeSource) => {
      const ok = await swalConfirm("分析ソースを削除しますか", source.title);
      if (!ok) return;
      try {
        await invoke("delete_qualitative_source", { id: source.id });
        setSources((prev) => prev.filter((item) => item.id !== source.id));
        setSelectedSourceId((current) => (current === source.id ? null : current));
      } catch (err) {
        console.error("Failed to delete qualitative source:", err);
      }
    },
    [],
  );

  const handleDeleteSegment = useCallback(
    async (segmentId: string) => {
      try {
        await invoke("delete_source_segment_code", { id: segmentId });
        setSegments((prev) => prev.filter((segment) => segment.id !== segmentId));
        setCooccurrenceSegmentId((current) => (current === segmentId ? null : current));
        await loadCodes();
      } catch (err) {
        console.error("Failed to delete source segment code:", err);
      }
    },
    [loadCodes],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: "var(--color-text-tertiary)" }}>
        <span className="text-sm">{t.common.loading}</span>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      <aside
        className="flex flex-col shrink-0 h-full"
        style={{
          width: listCollapsed ? "40px" : "280px",
          borderRight: "1px solid var(--color-border-primary)",
          transition: "width 150ms ease-out",
          overflow: "hidden",
        }}
      >
        <header
          className="flex items-center justify-between px-2 shrink-0"
          style={{ height: "40px", borderBottom: "1px solid var(--color-border-primary)" }}
        >
          {!listCollapsed && (
            <span className="text-xs font-semibold" style={{ color: "var(--color-text-tertiary)" }}>
              分析ソース <span style={{ fontWeight: 400 }}>({sources.length})</span>
            </span>
          )}
          <button
            type="button"
            onClick={() => setListCollapsed(!listCollapsed)}
            title={listCollapsed ? t.qualitative.k_gixi : t.qualitative.k_yczceq}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)", padding: "4px", display: "flex" }}
          >
            <IconPanelLeft size={13} />
          </button>
        </header>

        {!listCollapsed && (
          <>
            <div className="p-2 shrink-0" style={{ borderBottom: "1px solid var(--color-border-secondary)" }}>
              <button
                type="button"
                onClick={() => void handleImport()}
                disabled={importing}
                className="w-full inline-flex items-center justify-center gap-1 text-xs py-1.5"
                style={{
                  backgroundColor: "var(--color-accent-primary)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: importing ? "not-allowed" : "pointer",
                  opacity: importing ? 0.65 : 1,
                }}
              >
                <IconSources size={13} />
                {importing ? "取り込み中" : "DOCX / PDF / MD"}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {sources.length === 0 ? (
                <div className="text-center py-8 text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                  分析ソースなし
                </div>
              ) : (
                sources.map((source) => (
                  <div
                    key={source.id}
                    className="group"
                    onClick={() => setSelectedSourceId(source.id)}
                    style={{
                      padding: "8px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      backgroundColor: selectedSourceId === source.id ? "var(--color-bg-hover)" : "transparent",
                      border: "1px solid transparent",
                      marginBottom: "4px",
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <IconSources size={14} color={selectedSourceId === source.id ? "var(--color-accent-primary)" : "var(--color-text-tertiary)"} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          className="text-xs font-medium truncate"
                          style={{ color: selectedSourceId === source.id ? "var(--color-accent-primary)" : "var(--color-text-primary)" }}
                          title={source.title}
                        >
                          {source.title}
                        </div>
                        <div className="text-[11px] mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>
                          {source.fileType.toUpperCase()} · {source.wordCount.toLocaleString()} words
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDeleteSource(source);
                        }}
                        className="opacity-0 group-hover:opacity-100"
                        title={t.common.delete}
                        style={{ background: "none", border: "none", color: "var(--color-text-tertiary)", cursor: "pointer", padding: "2px", display: "flex" }}
                      >
                        <IconDelete size={12} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </aside>

      <main className="flex-1 flex overflow-hidden">
        {selectedSource ? (
          selectedSourceIsPdf ? (
            <section className="flex-1 min-w-0 h-full">
              <Suspense
                fallback={
                  <div
                    className="flex items-center justify-center h-full"
                    style={{ color: "var(--color-text-tertiary)" }}
                  >
                    <span className="text-sm">{t.common.loading}</span>
                  </div>
                }
              >
                <ReaderView
                  sourceId={selectedSource.id}
                  sourceProjectId={projectId}
                  initialPanelTab="coding"
                />
              </Suspense>
            </section>
          ) : (
          <>
            <section className="flex-1 flex flex-col min-w-0">
              <header
                className="shrink-0 px-4 py-3"
                style={{ borderBottom: "1px solid var(--color-border-primary)" }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div style={{ minWidth: 0 }}>
                    <h3 className="text-sm font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>
                      {selectedSource.title}
                    </h3>
                    <div className="text-xs mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>
                      {selectedSource.filePath ?? selectedSource.sourceType}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadSources()}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1"
                    style={{
                      backgroundColor: "var(--color-bg-tertiary)",
                      color: "var(--color-text-secondary)",
                      border: "1px solid var(--color-border-secondary)",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    <IconRefresh size={12} />
                    更新
                  </button>
                </div>
              </header>

              <div className="shrink-0 flex items-center gap-2 px-4 py-2" style={{ borderBottom: "1px solid var(--color-border-secondary)" }}>
                <select
                  value={selectedCodeId}
                  onChange={(event) => setSelectedCodeId(event.target.value)}
                  className="text-xs px-2 py-1"
                  style={{
                    minWidth: "180px",
                    backgroundColor: "var(--color-bg-primary)",
                    color: "var(--color-text-primary)",
                    border: "1px solid var(--color-border-primary)",
                    borderRadius: "4px",
                  }}
                >
                  {flatCodes.length === 0 ? (
                    <option value="">コードなし</option>
                  ) : (
                    flatCodes.map((code) => (
                      <option key={code.id} value={code.id}>
                        {"  ".repeat(code.depth)}{code.name}
                      </option>
                    ))
                  )}
                </select>
                <button
                  type="button"
                  onClick={() => void handleAssignCode()}
                  disabled={!selectedCodeId || !selectedText.trim()}
                  className="inline-flex items-center gap-1 text-xs px-3 py-1"
                  style={{
                    backgroundColor: "var(--color-accent-primary)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    cursor: selectedCodeId && selectedText.trim() ? "pointer" : "not-allowed",
                    opacity: selectedCodeId && selectedText.trim() ? 1 : 0.55,
                  }}
                >
                  <IconAssignCode size={12} />
                  コード付与
                </button>
                {selectedText && (
                  <span className="text-xs truncate" style={{ color: "var(--color-text-tertiary)", maxWidth: "38ch" }}>
                    {selectedText}
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-auto p-5">
                <pre
                  ref={contentRef}
                  onMouseUp={captureSelection}
                  className="text-sm"
                  style={{
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    lineHeight: 1.75,
                    color: "var(--color-text-primary)",
                    fontFamily: "var(--font-family, system-ui, sans-serif)",
                    margin: 0,
                  }}
                >
                  {selectedSource.content || "本文を抽出できませんでした。"}
                </pre>
              </div>
            </section>

            <aside
              className="shrink-0 h-full flex flex-col"
              style={{ width: "300px", borderLeft: "1px solid var(--color-border-primary)" }}
            >
              <header className="px-3 py-2" style={{ borderBottom: "1px solid var(--color-border-primary)" }}>
                <h4 className="text-xs font-semibold" style={{ color: "var(--color-text-tertiary)" }}>
                  コード化済み ({segments.length})
                </h4>
              </header>
              <CooccurrencePanel
                segmentId={cooccurrenceSegmentId ?? ""}
                isOpen={Boolean(cooccurrenceSegmentId)}
                onClose={() => setCooccurrenceSegmentId(null)}
              />
              <div className="p-3 flex-1 overflow-y-auto flex flex-col gap-2">
                {segments.length === 0 ? (
                  <div className="text-xs text-center py-8" style={{ color: "var(--color-text-tertiary)" }}>
                    セグメントなし
                  </div>
                ) : (
                  segments.map((segment) => {
                    const code = codeById.get(segment.codeId);
                    return (
                      <div
                        key={segment.id}
                        className="group p-3"
                        onClick={() => setCooccurrenceSegmentId(segment.id)}
                        style={{
                          border: "1px solid var(--color-border-primary)",
                          borderLeft: `3px solid ${code?.color ?? "var(--color-accent-primary)"}`,
                          borderRadius: "6px",
                          backgroundColor: "var(--color-bg-secondary)",
                          cursor: "pointer",
                        }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="text-xs font-semibold" style={{ color: "var(--color-text-primary)" }}>
                            {code?.name ?? "コード"}
                          </span>
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setCooccurrenceSegmentId(segment.id);
                              }}
                              className="opacity-0 group-hover:opacity-100"
                              title="共起語を分析"
                              style={{ background: "none", border: "none", color: "var(--color-text-tertiary)", cursor: "pointer", padding: "0", display: "flex" }}
                            >
                              <IconActorMap size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleDeleteSegment(segment.id);
                              }}
                              className="opacity-0 group-hover:opacity-100"
                              title={t.common.delete}
                              style={{ background: "none", border: "none", color: "var(--color-text-tertiary)", cursor: "pointer", padding: "0", display: "flex" }}
                            >
                              <IconDelete size={12} />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs" style={{ color: "var(--color-text-secondary)", lineHeight: 1.55 }}>
                          {segment.segmentText}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </aside>
          </>
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-full w-full gap-3" style={{ color: "var(--color-text-tertiary)" }}>
            <IconSources size={30} />
            <span className="text-sm">分析ソースを取り込んでください</span>
          </div>
        )}
      </main>
    </div>
  );
};

function flattenCodeTree(nodes: CodeNode[], depth = 0): FlatCode[] {
  const result: FlatCode[] = [];
  for (const node of nodes) {
    result.push({
      id: node.id,
      name: node.name,
      color: node.color,
      depth,
    });
    result.push(...flattenCodeTree(node.children ?? [], depth + 1));
  }
  return result;
}
