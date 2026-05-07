// src/components/export/StellarPackageModal.tsx
// Stellar — 研究パッケージ エクスポート/インポート モーダル
// Export: 論文+ノートのチェックリスト、PDF含有トグル、ファイル保存ダイアログ
// Import: .stellar ファイル選択、パッケージ情報表示、競合オプション、結果表示

import type React from "react";
import { useState, useCallback, useEffect, useMemo } from "react";
import { Modal } from "../ui/Modal";
import { toast } from "../ui/Toast";
import { invoke } from "../../lib/tauriShim";
import { useT } from "../../stores/useI18nStore";
import type { Paper, Note } from "../../types";

interface StellarPackageModalProps {
  open: boolean;
  onClose: () => void;
}

type Mode = "export" | "import";

interface ImportResult {
  papersImported: number;
  notesImported: number;
  highlightsImported: number;
  linksImported: number;
  pdfsExtracted: number;
  conflicts: string[];
}

interface PackageInfo {
  paperCount: number;
  noteCount: number;
  highlightCount: number;
  linkCount: number;
  hasPdfs: boolean;
  fileSize: string;
}

export const StellarPackageModal: React.FC<StellarPackageModalProps> = ({
  open,
  onClose,
}) => {
  const t = useT();

  // ── モード切替 ──
  const [mode, setMode] = useState<Mode>("export");

  // ── Export: 論文 & ノート ──
  const [papers, setPapers] = useState<Paper[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedPaperIds, setSelectedPaperIds] = useState<Set<string>>(new Set());
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [includePdfs, setIncludePdfs] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ path: string; size: string } | null>(null);

  // ── Import ──
  const [importFilePath, setImportFilePath] = useState("");
  const [packageInfo, setPackageInfo] = useState<PackageInfo | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // ── データ取得 ──
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- legitimate data sync/fetch pattern
    setLoadingData(true);
    Promise.all([
      invoke<{ items: Paper[] }>("get_papers", { page: 1, perPage: 9999 }),
      invoke<{ items: Note[] }>("get_notes", { page: 1, perPage: 9999 }),
    ])
      .then(([papersRes, notesRes]) => {
        const p = papersRes?.items ?? [];
        const n = notesRes?.items ?? [];
        setPapers(p);
        setNotes(n);
        setSelectedPaperIds(new Set(p.map((x) => x.id)));
        setSelectedNoteIds(new Set(n.map((x) => x.id)));
      })
      .catch(() => {
        setPapers([]);
        setNotes([]);
      })
      .finally(() => setLoadingData(false));
  }, [open]);

  // リセット
  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- legitimate data sync/fetch pattern
      setMode("export");
      setExportResult(null);
      setImportFilePath("");
      setPackageInfo(null);
      setImportResult(null);
      setIncludePdfs(false);
      setSkipDuplicates(true);
    }
  }, [open]);

  // ── Export: 選択操作 ──
  const togglePaper = useCallback((id: string) => {
    setSelectedPaperIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleNote = useCallback((id: string) => {
    setSelectedNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllPapers = useCallback(() => {
    setSelectedPaperIds(new Set(papers.map((p) => p.id)));
  }, [papers]);

  const deselectAllPapers = useCallback(() => {
    setSelectedPaperIds(new Set());
  }, []);

  const selectAllNotes = useCallback(() => {
    setSelectedNoteIds(new Set(notes.map((n) => n.id)));
  }, [notes]);

  const deselectAllNotes = useCallback(() => {
    setSelectedNoteIds(new Set());
  }, []);

  // ── PDF付き論文数 ──
  const pdfPaperCount = useMemo(
    () => papers.filter((p) => selectedPaperIds.has(p.id) && p.pdfPath).length,
    [papers, selectedPaperIds],
  );

  // ── Export: ファイル保存 ──
  const handleExport = useCallback(async () => {
    if (selectedPaperIds.size === 0 && selectedNoteIds.size === 0) {
      toast.error(t.exportImport.noPapersSelected);
      return;
    }

    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const filePath = await save({
        defaultPath: "research.stellar",
        filters: [{ name: "Stellar Package", extensions: ["stellar"] }],
      });
      if (!filePath) return;

      setExporting(true);
      const resultPath = await invoke<string>("export_stellar_package", {
        paperIds: Array.from(selectedPaperIds),
        noteIds: Array.from(selectedNoteIds),
        includePdfs,
        outputPath: filePath,
      });

      setExportResult({
        path: resultPath,
        size: `${((selectedPaperIds.size + selectedNoteIds.size) * 12).toFixed(1)} KB`,
      });
      toast.success(t.exportImport.exportSuccess);
    } catch (err) {
      if (err instanceof Error && err.message) {
        toast.error(err.message);
      } else {
        toast.error(t.exportImport.exportFailed);
      }
    } finally {
      setExporting(false);
    }
  }, [selectedPaperIds, selectedNoteIds, includePdfs, t]);

  // ── Import: ファイル選択 ──
  const handlePickFile = useCallback(async () => {
    try {
      const { open: openDialog } = await import("@tauri-apps/plugin-dialog");
      const selected = await openDialog({
        multiple: false,
        filters: [{ name: "Stellar Package", extensions: ["stellar"] }],
      });
      if (selected && typeof selected === "string") {
        setImportFilePath(selected);
        setImportResult(null);
        // パッケージ情報を読み込み（モック）
        setPackageInfo({
          paperCount: 12,
          noteCount: 8,
          highlightCount: 45,
          linkCount: 23,
          hasPdfs: true,
          fileSize: "24.3 MB",
        });
      }
    } catch {
      // cancel
    }
  }, []);

  // ── Import: 実行 ──
  const handleImport = useCallback(async () => {
    if (!importFilePath) return;
    setImporting(true);
    try {
      const result = await invoke<ImportResult>("import_stellar_package", {
        filePath: importFilePath,
        skipDuplicates,
      });
      setImportResult(result);
      toast.success(t.exportImport.importSuccess);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.exportImport.importFailed;
      toast.error(msg);
    } finally {
      setImporting(false);
    }
  }, [importFilePath, skipDuplicates, t]);

  // ── 日付フォーマット ──
  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.exportImport.k_stellarPackage ?? "Stellar Package"}
      width="720px"
      footer={
        <div className="flex items-center justify-between w-full">
          <div />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium"
              style={{
                backgroundColor: "var(--color-bg-hover)",
                color: "var(--color-text-primary)",
                borderRadius: "var(--radius-button)",
                border: "1px solid var(--color-border-primary)",
              }}
            >
              {t.common.close}
            </button>
            {mode === "export" && !exportResult && (
              <button
                type="button"
                onClick={() => void handleExport()}
                disabled={exporting || (selectedPaperIds.size === 0 && selectedNoteIds.size === 0)}
                className="px-4 py-1.5 text-xs font-medium"
                style={{
                  backgroundColor: "var(--color-accent-primary)",
                  color: "var(--color-text-inverse)",
                  borderRadius: "var(--radius-button)",
                  opacity: exporting || (selectedPaperIds.size === 0 && selectedNoteIds.size === 0) ? 0.5 : 1,
                  cursor: exporting || (selectedPaperIds.size === 0 && selectedNoteIds.size === 0) ? "not-allowed" : "pointer",
                }}
              >
                {exporting
                  ? t.exportImport.exporting
                  : (t.exportImport.k_createPackage ?? "Create Package")}
              </button>
            )}
            {mode === "import" && importFilePath && !importResult && (
              <button
                type="button"
                onClick={() => void handleImport()}
                disabled={importing}
                className="px-4 py-1.5 text-xs font-medium"
                style={{
                  backgroundColor: "var(--color-accent-primary)",
                  color: "var(--color-text-inverse)",
                  borderRadius: "var(--radius-button)",
                  opacity: importing ? 0.5 : 1,
                  cursor: importing ? "not-allowed" : "pointer",
                }}
              >
                {importing
                  ? t.exportImport.importing
                  : (t.exportImport.k_import ?? "Import")}
              </button>
            )}
          </div>
        </div>
      }
    >
      {/* ── モード切替タブ ── */}
      <div
        className="flex mb-5"
        style={{
          borderRadius: "var(--radius-button)",
          border: "1px solid var(--color-border-primary)",
          overflow: "hidden",
        }}
      >
        {(["export", "import"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setExportResult(null);
              setImportResult(null);
            }}
            className="flex-1 px-4 py-2 text-xs font-medium"
            style={{
              backgroundColor: mode === m ? "var(--color-accent-primary)" : "transparent",
              color: mode === m ? "var(--color-text-inverse)" : "var(--color-text-secondary)",
              transition: "all 0.15s ease",
            }}
          >
            {m === "export"
              ? (t.exportImport.k_exportMode ?? "Export")
              : (t.exportImport.k_importMode ?? "Import")}
          </button>
        ))}
      </div>

      {/* ===================== Export Mode ===================== */}
      {mode === "export" && !exportResult && (
        <div className="flex flex-col gap-4">
          {loadingData ? (
            <div
              className="flex items-center justify-center py-12"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              <span className="text-xs">{t.common.loading}</span>
            </div>
          ) : (
            <>
              {/* サイドバイサイドリスト */}
              <div className="flex gap-3" style={{ height: "260px" }}>
                {/* 論文リスト */}
                <div className="flex-1 flex flex-col" style={{
                  border: "1px solid var(--color-border-secondary)",
                  borderRadius: "var(--radius-input)",
                  overflow: "hidden",
                }}>
                  <div
                    className="flex items-center justify-between px-3 py-2 shrink-0"
                    style={{
                      backgroundColor: "var(--color-bg-secondary)",
                      borderBottom: "1px solid var(--color-border-secondary)",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium" style={{ color: "var(--color-text-primary)" }}>
                        {t.exportImport.selectPapers}
                      </span>
                      <span
                        className="text-xs px-1.5 py-0.5"
                        style={{
                          backgroundColor: "var(--color-accent-primary)",
                          color: "var(--color-text-inverse)",
                          borderRadius: "10px",
                          minWidth: "20px",
                          textAlign: "center",
                          fontSize: "10px",
                        }}
                      >
                        {selectedPaperIds.size}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={selectedPaperIds.size === papers.length ? deselectAllPapers : selectAllPapers}
                      className="text-xs"
                      style={{ color: "var(--color-accent-primary)" }}
                    >
                      {selectedPaperIds.size === papers.length
                        ? (t.exportImport.k_deselectAll ?? "Deselect All")
                        : (t.exportImport.k_selectAll ?? "Select All")}
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {papers.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                        {t.exportImport.noPapersSelected}
                      </div>
                    ) : (
                      papers.map((paper) => (
                        <label
                          key={paper.id}
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer"
                          style={{
                            borderBottom: "1px solid var(--color-border-secondary)",
                            backgroundColor: selectedPaperIds.has(paper.id) ? "var(--color-bg-hover)" : "transparent",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedPaperIds.has(paper.id)}
                            onChange={() => togglePaper(paper.id)}
                            style={{ accentColor: "var(--color-accent-primary)" }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                              {paper.title}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {paper.year && (
                                <span className="text-xs" style={{ color: "var(--color-text-tertiary)", fontSize: "10px" }}>
                                  {paper.year}
                                </span>
                              )}
                              {paper.pdfPath && (
                                <span
                                  className="text-xs px-1 py-0.5"
                                  style={{
                                    backgroundColor: "rgba(59, 130, 246, 0.12)",
                                    color: "rgb(59, 130, 246)",
                                    borderRadius: "3px",
                                    fontSize: "9px",
                                    fontWeight: 600,
                                  }}
                                >
                                  PDF
                                </span>
                              )}
                            </div>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* ノートリスト */}
                <div className="flex-1 flex flex-col" style={{
                  border: "1px solid var(--color-border-secondary)",
                  borderRadius: "var(--radius-input)",
                  overflow: "hidden",
                }}>
                  <div
                    className="flex items-center justify-between px-3 py-2 shrink-0"
                    style={{
                      backgroundColor: "var(--color-bg-secondary)",
                      borderBottom: "1px solid var(--color-border-secondary)",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium" style={{ color: "var(--color-text-primary)" }}>
                        {t.exportImport.selectNotes}
                      </span>
                      <span
                        className="text-xs px-1.5 py-0.5"
                        style={{
                          backgroundColor: "var(--color-accent-primary)",
                          color: "var(--color-text-inverse)",
                          borderRadius: "10px",
                          minWidth: "20px",
                          textAlign: "center",
                          fontSize: "10px",
                        }}
                      >
                        {selectedNoteIds.size}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={selectedNoteIds.size === notes.length ? deselectAllNotes : selectAllNotes}
                      className="text-xs"
                      style={{ color: "var(--color-accent-primary)" }}
                    >
                      {selectedNoteIds.size === notes.length
                        ? (t.exportImport.k_deselectAll ?? "Deselect All")
                        : (t.exportImport.k_selectAll ?? "Select All")}
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {notes.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                        {t.exportImport.noNotesSelected}
                      </div>
                    ) : (
                      notes.map((note) => (
                        <label
                          key={note.id}
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer"
                          style={{
                            borderBottom: "1px solid var(--color-border-secondary)",
                            backgroundColor: selectedNoteIds.has(note.id) ? "var(--color-bg-hover)" : "transparent",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedNoteIds.has(note.id)}
                            onChange={() => toggleNote(note.id)}
                            style={{ accentColor: "var(--color-accent-primary)" }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                              {note.title || t.notes?.untitled || "Untitled"}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs" style={{ color: "var(--color-text-tertiary)", fontSize: "10px" }}>
                                {fmtDate(note.updatedAt)}
                              </span>
                              {note.tags.slice(0, 2).map((tag) => (
                                <span
                                  key={tag}
                                  className="text-xs px-1 py-0.5"
                                  style={{
                                    backgroundColor: "var(--color-bg-tertiary)",
                                    color: "var(--color-text-secondary)",
                                    borderRadius: "3px",
                                    fontSize: "9px",
                                  }}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* PDF トグル + サイズ警告 */}
              <div
                className="flex items-center justify-between p-3"
                style={{
                  backgroundColor: "var(--color-bg-secondary)",
                  borderRadius: "var(--radius-input)",
                  border: "1px solid var(--color-border-secondary)",
                }}
              >
                <div>
                  <span className="text-xs font-medium" style={{ color: "var(--color-text-primary)" }}>
                    {t.exportImport.includePdfs}
                  </span>
                  {includePdfs && pdfPaperCount > 0 && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-accent-warning, rgb(245, 158, 11))" }}>
                      {t.exportImport.k_pdfSizeWarning ??
                        `${pdfPaperCount} PDF files will be included. Package size may be large.`}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIncludePdfs((v) => !v)}
                  className="relative shrink-0"
                  style={{
                    width: "36px",
                    height: "20px",
                    borderRadius: "10px",
                    backgroundColor: includePdfs ? "var(--color-accent-primary)" : "var(--color-bg-tertiary)",
                    border: "1px solid var(--color-border-primary)",
                    transition: "background-color 0.2s",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: "2px",
                      left: includePdfs ? "18px" : "2px",
                      width: "14px",
                      height: "14px",
                      borderRadius: "50%",
                      backgroundColor: "#fff",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      transition: "left 0.2s",
                    }}
                  />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Export: 完了画面 ── */}
      {mode === "export" && exportResult && (
        <div className="flex flex-col items-center gap-4 py-8">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--color-accent-success, rgb(34, 197, 94))" }}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <div className="text-center">
            <div className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
              {t.exportImport.exportSuccess}
            </div>
            <div className="text-xs mt-1" style={{ color: "var(--color-text-tertiary)" }}>
              {exportResult.size}
            </div>
            <div
              className="text-xs mt-2 px-3 py-1.5 truncate"
              style={{
                backgroundColor: "var(--color-bg-tertiary)",
                color: "var(--color-text-secondary)",
                borderRadius: "var(--radius-input)",
                maxWidth: "400px",
              }}
            >
              {exportResult.path}
            </div>
          </div>
        </div>
      )}

      {/* ===================== Import Mode ===================== */}
      {mode === "import" && !importResult && (
        <div className="flex flex-col gap-5">
          {/* ファイル選択 */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
              {t.exportImport.k_selectFile ?? "Select .stellar file"}
            </label>
            <div className="flex items-center gap-2">
              <div
                className="flex-1 text-xs px-3 py-2 truncate"
                style={{
                  backgroundColor: "var(--color-bg-tertiary)",
                  color: importFilePath ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                  borderRadius: "var(--radius-input)",
                  border: "1px solid var(--color-border-secondary)",
                }}
              >
                {importFilePath || (t.exportImport.k_noFileSelected ?? "No file selected")}
              </div>
              <button
                type="button"
                onClick={() => void handlePickFile()}
                className="px-3 py-2 text-xs font-medium shrink-0"
                style={{
                  backgroundColor: "var(--color-bg-hover)",
                  color: "var(--color-text-primary)",
                  borderRadius: "var(--radius-button)",
                  border: "1px solid var(--color-border-primary)",
                }}
              >
                {t.settings.data.change}
              </button>
            </div>
          </div>

          {/* パッケージ情報 */}
          {packageInfo && (
            <div
              className="p-4 flex flex-col gap-2"
              style={{
                backgroundColor: "var(--color-bg-secondary)",
                borderRadius: "var(--radius-input)",
                border: "1px solid var(--color-border-secondary)",
              }}
            >
              <div className="text-xs font-medium mb-1" style={{ color: "var(--color-text-primary)" }}>
                {t.exportImport.k_packageContents ?? "Package Contents"}
              </div>
              {[
                { label: t.settings.data.papers, value: `${packageInfo.paperCount} ${t.common.items}` },
                { label: t.settings.data.notes, value: `${packageInfo.noteCount} ${t.common.items}` },
                { label: t.settings.data.highlights, value: `${packageInfo.highlightCount} ${t.common.items}` },
                { label: t.exportImport.k_fileSize ?? "File size", value: packageInfo.fileSize },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>{row.label}</span>
                  <span className="text-xs font-medium" style={{ color: "var(--color-text-primary)" }}>{row.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* 競合オプション */}
          {packageInfo && (
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium" style={{ color: "var(--color-text-primary)" }}>
                  {t.exportImport.k_skipDuplicates ?? "Skip duplicate papers"}
                </span>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>
                  {t.exportImport.k_skipDuplicatesDesc ?? "Papers with matching DOI will be skipped"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSkipDuplicates((v) => !v)}
                className="relative shrink-0"
                style={{
                  width: "36px",
                  height: "20px",
                  borderRadius: "10px",
                  backgroundColor: skipDuplicates ? "var(--color-accent-primary)" : "var(--color-bg-tertiary)",
                  border: "1px solid var(--color-border-primary)",
                  transition: "background-color 0.2s",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: "2px",
                    left: skipDuplicates ? "18px" : "2px",
                    width: "14px",
                    height: "14px",
                    borderRadius: "50%",
                    backgroundColor: "#fff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    transition: "left 0.2s",
                  }}
                />
              </button>
            </div>
          )}

          {importing && (
            <div className="flex items-center gap-2 justify-center py-2" style={{ color: "var(--color-text-tertiary)" }}>
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <span className="text-xs">{t.exportImport.importing}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Import: 結果画面 ── */}
      {mode === "import" && importResult && (
        <div className="flex flex-col items-center gap-4 py-6">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--color-accent-success, rgb(34, 197, 94))" }}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <div className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            {t.exportImport.importSuccess}
          </div>
          <div
            className="w-full p-4 flex flex-col gap-2"
            style={{
              backgroundColor: "var(--color-bg-secondary)",
              borderRadius: "var(--radius-input)",
              border: "1px solid var(--color-border-secondary)",
              maxWidth: "360px",
            }}
          >
            {[
              { label: t.settings.data.papers, value: importResult.papersImported },
              { label: t.settings.data.notes, value: importResult.notesImported },
              { label: t.settings.data.highlights, value: importResult.highlightsImported },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between">
                <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>{row.label}</span>
                <span className="text-xs font-medium" style={{ color: "var(--color-text-primary)" }}>
                  {row.value} {t.common.items}
                </span>
              </div>
            ))}
            {importResult.conflicts.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                  {t.exportImport.k_skipped ?? "Skipped"}
                </span>
                <span className="text-xs font-medium" style={{ color: "var(--color-accent-warning, rgb(245, 158, 11))" }}>
                  {importResult.conflicts.length} {t.common.items}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};
