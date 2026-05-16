// src/components/export/DataMigrationModal.tsx
// Stellar — データ移行モーダル
// Zotero CSV / BibTeX / RIS ファイルインポート、Obsidian Vault インポートを提供する

import type React from "react";
import { useState, useCallback, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { toast } from "../ui/Toast";
import { invoke } from "../../lib/tauriShim";
import { useT } from "../../stores/useI18nStore";

interface DataMigrationModalProps {
  open: boolean;
  onClose: () => void;
}

type TabMode = "references" | "obsidian";

interface ParsedEntry {
  title: string;
  authors: string[];
  year: number | null;
  journal: string | null;
  doi: string | null;
  entryType: string;
}

interface ParsedNote {
  title: string;
  tags: string[];
  sourcePath: string;
}

interface PreviewResult {
  entries: ParsedEntry[];
  notes: ParsedNote[];
  formatDetected: string;
  totalCount: number;
}

interface MigrationResult {
  papersImported: number;
  notesImported: number;
  papersSkipped: number;
  notesSkipped: number;
  errors: string[];
}

const FORMAT_LABELS: Record<string, string> = {
  bibtex: "BibTeX",
  ris: "RIS",
  csv: "Zotero CSV",
  obsidian: "Obsidian Vault",
  unknown: "Unknown",
};

export const DataMigrationModal: React.FC<DataMigrationModalProps> = ({
  open,
  onClose,
}) => {
  const t = useT();
  const mig = (t as Record<string, Record<string, unknown>>).migration as
    | Record<string, string>
    | undefined;

  // Helper to get migration strings with fallback
  const m = (key: string, fallback: string): string =>
    (mig && typeof mig[key] === "string" ? mig[key] : fallback) as string;

  // ── Tab ──
  const [tab, setTab] = useState<TabMode>("references");

  // ── References (BibTeX/RIS/CSV) ──
  const [refFilePath, setRefFilePath] = useState("");
  const [refPreview, setRefPreview] = useState<PreviewResult | null>(null);
  const [loadingRefPreview, setLoadingRefPreview] = useState(false);
  const [refSkipDuplicates, setRefSkipDuplicates] = useState(true);
  const [refTagPrefix, setRefTagPrefix] = useState("");
  const [importingRef, setImportingRef] = useState(false);
  const [refResult, setRefResult] = useState<MigrationResult | null>(null);

  // ── Obsidian Vault ──
  const [vaultPath, setVaultPath] = useState("");
  const [vaultPreview, setVaultPreview] = useState<PreviewResult | null>(null);
  const [loadingVaultPreview, setLoadingVaultPreview] = useState(false);
  const [vaultSkipDuplicates, setVaultSkipDuplicates] = useState(true);
  const [vaultTagPrefix, setVaultTagPrefix] = useState("");
  const [importingVault, setImportingVault] = useState(false);
  const [vaultResult, setVaultResult] = useState<MigrationResult | null>(null);

  // ── Reset on close ──
  useEffect(() => {
    if (!open) {
      setTab("references");
      setRefFilePath("");
      setRefPreview(null);
      setRefResult(null);
      setRefTagPrefix("");
      setRefSkipDuplicates(true);
      setVaultPath("");
      setVaultPreview(null);
      setVaultResult(null);
      setVaultTagPrefix("");
      setVaultSkipDuplicates(true);
    }
  }, [open]);

  // ── References: File pick & preview ──
  const handlePickRefFile = useCallback(async () => {
    try {
      const { openFileDialog } = await import("../../lib/tauriShim");
      const selected = await openFileDialog({
        multiple: false,
        filters: [
          {
            name: "Reference Files",
            extensions: ["bib", "ris", "csv", "txt"],
          },
        ],
      });
      if (selected && typeof selected === "string") {
        setRefFilePath(selected);
        setRefResult(null);
        setRefPreview(null);
        setLoadingRefPreview(true);
        try {
          const preview = await invoke<PreviewResult>("preview_import_file", {
            filePath: selected,
          });
          setRefPreview(preview);
        } catch (err) {
          setRefFilePath("");
          const msg =
            err instanceof Error ? err.message : m("previewFailed", "Preview failed");
          toast.error(msg);
        } finally {
          setLoadingRefPreview(false);
        }
      }
    } catch {
      // cancel
    }
  }, [m]);

  // ── References: Import ──
  const handleImportRef = useCallback(async () => {
    if (!refFilePath) return;
    setImportingRef(true);
    try {
      const result = await invoke<MigrationResult>("import_references_file", {
        filePath: refFilePath,
        skipDuplicates: refSkipDuplicates,
        tagPrefix: refTagPrefix || null,
      });
      setRefResult(result);
      toast.success(
        m("importComplete", "Import completed") +
          ` (${result.papersImported} ${t.common?.items ?? "items"})`
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : m("importFailed", "Import failed");
      toast.error(msg);
    } finally {
      setImportingRef(false);
    }
  }, [refFilePath, refSkipDuplicates, refTagPrefix, t, m]);

  // ── Obsidian: Folder pick & preview ──
  const handlePickVault = useCallback(async () => {
    try {
      const { openDirectoryDialog } = await import("../../lib/tauriShim");
      const selected = await openDirectoryDialog();
      if (selected && typeof selected === "string") {
        setVaultPath(selected);
        setVaultResult(null);
        setVaultPreview(null);
        setLoadingVaultPreview(true);
        try {
          const preview = await invoke<PreviewResult>("preview_obsidian_vault", {
            vaultPath: selected,
          });
          setVaultPreview(preview);
        } catch (err) {
          setVaultPath("");
          const msg =
            err instanceof Error ? err.message : m("previewFailed", "Preview failed");
          toast.error(msg);
        } finally {
          setLoadingVaultPreview(false);
        }
      }
    } catch {
      // cancel
    }
  }, [m]);

  // ── Obsidian: Import ──
  const handleImportVault = useCallback(async () => {
    if (!vaultPath) return;
    setImportingVault(true);
    try {
      const result = await invoke<MigrationResult>("import_obsidian_vault", {
        vaultPath,
        skipDuplicates: vaultSkipDuplicates,
        tagPrefix: vaultTagPrefix || null,
      });
      setVaultResult(result);
      toast.success(
        m("importComplete", "Import completed") +
          ` (${result.notesImported} ${t.common?.items ?? "items"})`
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : m("importFailed", "Import failed");
      toast.error(msg);
    } finally {
      setImportingVault(false);
    }
  }, [vaultPath, vaultSkipDuplicates, vaultTagPrefix, t, m]);

  // ── Toggle switch helper ──
  const ToggleSwitch: React.FC<{ on: boolean; onToggle: () => void }> = ({
    on,
    onToggle,
  }) => (
    <button
      type="button"
      onClick={onToggle}
      className="relative shrink-0"
      style={{
        width: "36px",
        height: "20px",
        borderRadius: "10px",
        backgroundColor: on
          ? "var(--color-accent-primary)"
          : "var(--color-bg-tertiary)",
        border: "1px solid var(--color-border-primary)",
        transition: "background-color 0.2s",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "2px",
          left: on ? "18px" : "2px",
          width: "14px",
          height: "14px",
          borderRadius: "50%",
          backgroundColor: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          transition: "left 0.2s",
        }}
      />
    </button>
  );

  // ── Success icon ──
  const SuccessIcon = () => (
    <svg
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: "var(--color-accent-success, rgb(34, 197, 94))" }}
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );

  // ── Determine footer actions ──
  const canImportRef = refFilePath && refPreview && !refResult && !importingRef;
  const canImportVault =
    vaultPath && vaultPreview && !vaultResult && !importingVault;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={m("title", "Data Migration")}
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
              {t.common?.close ?? "Close"}
            </button>
            {tab === "references" && canImportRef && (
              <button
                type="button"
                onClick={() => void handleImportRef()}
                disabled={importingRef}
                className="px-4 py-1.5 text-xs font-medium"
                style={{
                  backgroundColor: "var(--color-accent-primary)",
                  color: "var(--color-text-inverse)",
                  borderRadius: "var(--radius-button)",
                  opacity: importingRef ? 0.5 : 1,
                  cursor: importingRef ? "not-allowed" : "pointer",
                }}
              >
                {importingRef
                  ? m("importing", "Importing...")
                  : m("startImport", "Import")}
              </button>
            )}
            {tab === "obsidian" && canImportVault && (
              <button
                type="button"
                onClick={() => void handleImportVault()}
                disabled={importingVault}
                className="px-4 py-1.5 text-xs font-medium"
                style={{
                  backgroundColor: "var(--color-accent-primary)",
                  color: "var(--color-text-inverse)",
                  borderRadius: "var(--radius-button)",
                  opacity: importingVault ? 0.5 : 1,
                  cursor: importingVault ? "not-allowed" : "pointer",
                }}
              >
                {importingVault
                  ? m("importing", "Importing...")
                  : m("startImport", "Import")}
              </button>
            )}
          </div>
        </div>
      }
    >
      {/* ── Tab switcher ── */}
      <div
        className="flex mb-5"
        style={{
          borderRadius: "var(--radius-button)",
          border: "1px solid var(--color-border-primary)",
          overflow: "hidden",
        }}
      >
        {(
          [
            { key: "references" as const, label: m("tabReferences", "Zotero / BibTeX / RIS") },
            { key: "obsidian" as const, label: m("tabObsidian", "Obsidian Vault") },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className="flex-1 px-4 py-2 text-xs font-medium"
            style={{
              backgroundColor:
                tab === key ? "var(--color-accent-primary)" : "transparent",
              color:
                tab === key
                  ? "var(--color-text-inverse)"
                  : "var(--color-text-secondary)",
              transition: "all 0.15s ease",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ===================== References Tab ===================== */}
      {tab === "references" && !refResult && (
        <div className="flex flex-col gap-4">
          {/* Description */}
          <p
            className="text-xs"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {m(
              "refDesc",
              "Import papers from BibTeX (.bib), RIS (.ris), or Zotero CSV (.csv) files. Papers will be added to your library."
            )}
          </p>

          {/* File picker */}
          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {m("selectRefFile", "Select reference file")}
            </label>
            <div className="flex items-center gap-2">
              <div
                className="flex-1 text-xs px-3 py-2 truncate"
                style={{
                  backgroundColor: "var(--color-bg-tertiary)",
                  color: refFilePath
                    ? "var(--color-text-primary)"
                    : "var(--color-text-tertiary)",
                  borderRadius: "var(--radius-input)",
                  border: "1px solid var(--color-border-secondary)",
                }}
              >
                {refFilePath || m("noFileSelected", "No file selected")}
              </div>
              <button
                type="button"
                onClick={() => void handlePickRefFile()}
                className="px-3 py-2 text-xs font-medium shrink-0"
                style={{
                  backgroundColor: "var(--color-bg-hover)",
                  color: "var(--color-text-primary)",
                  borderRadius: "var(--radius-button)",
                  border: "1px solid var(--color-border-primary)",
                }}
              >
                {m("browse", "Browse...")}
              </button>
            </div>
          </div>

          {/* Loading preview */}
          {loadingRefPreview && (
            <div
              className="flex items-center gap-2 justify-center py-6"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              <svg
                className="animate-spin"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <span className="text-xs">{t.common?.loading ?? "Loading..."}</span>
            </div>
          )}

          {/* Preview info */}
          {refPreview && (
            <>
              <div
                className="p-4 flex flex-col gap-2"
                style={{
                  backgroundColor: "var(--color-bg-secondary)",
                  borderRadius: "var(--radius-input)",
                  border: "1px solid var(--color-border-secondary)",
                }}
              >
                <div
                  className="text-xs font-medium mb-1"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {m("previewTitle", "File Contents")}
                </div>
                {[
                  {
                    label: m("format", "Format"),
                    value: FORMAT_LABELS[refPreview.formatDetected] ?? refPreview.formatDetected,
                  },
                  {
                    label: m("totalEntries", "Total entries"),
                    value: `${refPreview.totalCount} ${t.common?.items ?? "items"}`,
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between"
                  >
                    <span
                      className="text-xs"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      {row.label}
                    </span>
                    <span
                      className="text-xs font-medium"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Preview entries list (max 10) */}
              {refPreview.entries.length > 0 && (
                <div
                  style={{
                    border: "1px solid var(--color-border-secondary)",
                    borderRadius: "var(--radius-input)",
                    maxHeight: "180px",
                    overflowY: "auto",
                  }}
                >
                  {refPreview.entries.slice(0, 10).map((entry, idx) => (
                    <div
                      key={`${entry.title}-${idx}`}
                      className="px-3 py-2"
                      style={{
                        borderBottom:
                          idx < Math.min(refPreview.entries.length, 10) - 1
                            ? "1px solid var(--color-border-secondary)"
                            : undefined,
                      }}
                    >
                      <div
                        className="text-xs font-medium truncate"
                        style={{ color: "var(--color-text-primary)" }}
                      >
                        {entry.title}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {entry.authors.length > 0 && (
                          <span
                            className="text-xs truncate"
                            style={{
                              color: "var(--color-text-tertiary)",
                              fontSize: "10px",
                              maxWidth: "200px",
                            }}
                          >
                            {entry.authors.slice(0, 2).join(", ")}
                            {entry.authors.length > 2 && " et al."}
                          </span>
                        )}
                        {entry.year && (
                          <span
                            className="text-xs"
                            style={{
                              color: "var(--color-text-tertiary)",
                              fontSize: "10px",
                            }}
                          >
                            ({entry.year})
                          </span>
                        )}
                        {entry.doi && (
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
                            DOI
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {refPreview.entries.length > 10 && (
                    <div
                      className="px-3 py-2 text-xs text-center"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      ...{m("andMore", "and")} {refPreview.entries.length - 10}{" "}
                      {m("moreEntries", "more entries")}
                    </div>
                  )}
                </div>
              )}

              {/* Options */}
              <div className="flex flex-col gap-3">
                {/* Skip duplicates toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <span
                      className="text-xs font-medium"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {m("skipDuplicates", "Skip duplicate papers")}
                    </span>
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      {m(
                        "skipDuplicatesDesc",
                        "Papers with matching DOI or title will be skipped"
                      )}
                    </p>
                  </div>
                  <ToggleSwitch
                    on={refSkipDuplicates}
                    onToggle={() => setRefSkipDuplicates((v) => !v)}
                  />
                </div>

                {/* Tag prefix */}
                <div>
                  <label
                    className="block text-xs font-medium mb-1"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    {m("tagPrefix", "Add tag to imported papers (optional)")}
                  </label>
                  <input
                    type="text"
                    value={refTagPrefix}
                    onChange={(e) => setRefTagPrefix(e.target.value)}
                    placeholder={m("tagPlaceholder", "e.g. zotero-import")}
                    className="w-full text-xs px-3 py-2"
                    style={{
                      backgroundColor: "var(--color-bg-tertiary)",
                      color: "var(--color-text-primary)",
                      borderRadius: "var(--radius-input)",
                      border: "1px solid var(--color-border-secondary)",
                      outline: "none",
                    }}
                  />
                </div>
              </div>
            </>
          )}

          {/* Importing spinner */}
          {importingRef && (
            <div
              className="flex items-center gap-2 justify-center py-2"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              <svg
                className="animate-spin"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <span className="text-xs">{m("importing", "Importing...")}</span>
            </div>
          )}
        </div>
      )}

      {/* ── References: Result ── */}
      {tab === "references" && refResult && (
        <div className="flex flex-col items-center gap-4 py-6">
          <SuccessIcon />
          <div
            className="text-sm font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            {m("importComplete", "Import completed")}
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
              {
                label: m("papersImported", "Papers imported"),
                value: refResult.papersImported,
                color: "var(--color-text-primary)",
              },
              {
                label: m("papersSkipped", "Papers skipped"),
                value: refResult.papersSkipped,
                color: "var(--color-accent-warning, rgb(245, 158, 11))",
              },
            ]
              .filter((row) => row.value > 0 || row.label === m("papersImported", "Papers imported"))
              .map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between"
                >
                  <span
                    className="text-xs"
                    style={{ color: "var(--color-text-tertiary)" }}
                  >
                    {row.label}
                  </span>
                  <span
                    className="text-xs font-medium"
                    style={{ color: row.color }}
                  >
                    {row.value} {t.common?.items ?? "items"}
                  </span>
                </div>
              ))}
            {refResult.errors.length > 0 && (
              <div className="mt-2">
                <span
                  className="text-xs font-medium"
                  style={{ color: "var(--color-accent-danger, rgb(239, 68, 68))" }}
                >
                  {m("errors", "Errors")}: {refResult.errors.length}
                </span>
                <div
                  className="mt-1 text-xs max-h-20 overflow-y-auto"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  {refResult.errors.slice(0, 5).map((err, i) => (
                    <div key={i}>{err}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== Obsidian Tab ===================== */}
      {tab === "obsidian" && !vaultResult && (
        <div className="flex flex-col gap-4">
          {/* Description */}
          <p
            className="text-xs"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {m(
              "obsidianDesc",
              "Import notes from an Obsidian vault folder. Markdown files with YAML frontmatter and [[WikiLinks]] are supported."
            )}
          </p>

          {/* Folder picker */}
          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {m("selectVault", "Select Obsidian vault folder")}
            </label>
            <div className="flex items-center gap-2">
              <div
                className="flex-1 text-xs px-3 py-2 truncate"
                style={{
                  backgroundColor: "var(--color-bg-tertiary)",
                  color: vaultPath
                    ? "var(--color-text-primary)"
                    : "var(--color-text-tertiary)",
                  borderRadius: "var(--radius-input)",
                  border: "1px solid var(--color-border-secondary)",
                }}
              >
                {vaultPath || m("noFolderSelected", "No folder selected")}
              </div>
              <button
                type="button"
                onClick={() => void handlePickVault()}
                className="px-3 py-2 text-xs font-medium shrink-0"
                style={{
                  backgroundColor: "var(--color-bg-hover)",
                  color: "var(--color-text-primary)",
                  borderRadius: "var(--radius-button)",
                  border: "1px solid var(--color-border-primary)",
                }}
              >
                {m("browse", "Browse...")}
              </button>
            </div>
          </div>

          {/* Loading preview */}
          {loadingVaultPreview && (
            <div
              className="flex items-center gap-2 justify-center py-6"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              <svg
                className="animate-spin"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <span className="text-xs">{t.common?.loading ?? "Loading..."}</span>
            </div>
          )}

          {/* Preview info */}
          {vaultPreview && (
            <>
              <div
                className="p-4 flex flex-col gap-2"
                style={{
                  backgroundColor: "var(--color-bg-secondary)",
                  borderRadius: "var(--radius-input)",
                  border: "1px solid var(--color-border-secondary)",
                }}
              >
                <div
                  className="text-xs font-medium mb-1"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {m("previewTitle", "Vault Contents")}
                </div>
                <div className="flex items-center justify-between">
                  <span
                    className="text-xs"
                    style={{ color: "var(--color-text-tertiary)" }}
                  >
                    {m("markdownFiles", "Markdown files")}
                  </span>
                  <span
                    className="text-xs font-medium"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {vaultPreview.totalCount} {t.common?.items ?? "items"}
                  </span>
                </div>
              </div>

              {/* Preview notes list (max 10) */}
              {vaultPreview.notes.length > 0 && (
                <div
                  style={{
                    border: "1px solid var(--color-border-secondary)",
                    borderRadius: "var(--radius-input)",
                    maxHeight: "180px",
                    overflowY: "auto",
                  }}
                >
                  {vaultPreview.notes.slice(0, 10).map((note, idx) => (
                    <div
                      key={`${note.title}-${idx}`}
                      className="px-3 py-2"
                      style={{
                        borderBottom:
                          idx < Math.min(vaultPreview.notes.length, 10) - 1
                            ? "1px solid var(--color-border-secondary)"
                            : undefined,
                      }}
                    >
                      <div
                        className="text-xs font-medium truncate"
                        style={{ color: "var(--color-text-primary)" }}
                      >
                        {note.title}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className="text-xs truncate"
                          style={{
                            color: "var(--color-text-tertiary)",
                            fontSize: "10px",
                            maxWidth: "300px",
                          }}
                        >
                          {note.sourcePath}
                        </span>
                        {note.tags.slice(0, 3).map((tag) => (
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
                  ))}
                  {vaultPreview.notes.length > 10 && (
                    <div
                      className="px-3 py-2 text-xs text-center"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      ...{m("andMore", "and")} {vaultPreview.notes.length - 10}{" "}
                      {m("moreNotes", "more notes")}
                    </div>
                  )}
                </div>
              )}

              {/* Options */}
              <div className="flex flex-col gap-3">
                {/* Skip duplicates toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <span
                      className="text-xs font-medium"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {m("skipDuplicateNotes", "Skip duplicate notes")}
                    </span>
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      {m(
                        "skipDuplicateNotesDesc",
                        "Notes with matching title will be skipped"
                      )}
                    </p>
                  </div>
                  <ToggleSwitch
                    on={vaultSkipDuplicates}
                    onToggle={() => setVaultSkipDuplicates((v) => !v)}
                  />
                </div>

                {/* Tag prefix */}
                <div>
                  <label
                    className="block text-xs font-medium mb-1"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    {m("tagPrefix", "Add tag to imported notes (optional)")}
                  </label>
                  <input
                    type="text"
                    value={vaultTagPrefix}
                    onChange={(e) => setVaultTagPrefix(e.target.value)}
                    placeholder={m("tagPlaceholder", "e.g. obsidian-import")}
                    className="w-full text-xs px-3 py-2"
                    style={{
                      backgroundColor: "var(--color-bg-tertiary)",
                      color: "var(--color-text-primary)",
                      borderRadius: "var(--radius-input)",
                      border: "1px solid var(--color-border-secondary)",
                      outline: "none",
                    }}
                  />
                </div>
              </div>
            </>
          )}

          {/* Importing spinner */}
          {importingVault && (
            <div
              className="flex items-center gap-2 justify-center py-2"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              <svg
                className="animate-spin"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <span className="text-xs">{m("importing", "Importing...")}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Obsidian: Result ── */}
      {tab === "obsidian" && vaultResult && (
        <div className="flex flex-col items-center gap-4 py-6">
          <SuccessIcon />
          <div
            className="text-sm font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            {m("importComplete", "Import completed")}
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
              {
                label: m("notesImported", "Notes imported"),
                value: vaultResult.notesImported,
                color: "var(--color-text-primary)",
              },
              {
                label: m("notesSkipped", "Notes skipped"),
                value: vaultResult.notesSkipped,
                color: "var(--color-accent-warning, rgb(245, 158, 11))",
              },
            ]
              .filter((row) => row.value > 0 || row.label === m("notesImported", "Notes imported"))
              .map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between"
                >
                  <span
                    className="text-xs"
                    style={{ color: "var(--color-text-tertiary)" }}
                  >
                    {row.label}
                  </span>
                  <span
                    className="text-xs font-medium"
                    style={{ color: row.color }}
                  >
                    {row.value} {t.common?.items ?? "items"}
                  </span>
                </div>
              ))}
            {vaultResult.errors.length > 0 && (
              <div className="mt-2">
                <span
                  className="text-xs font-medium"
                  style={{ color: "var(--color-accent-danger, rgb(239, 68, 68))" }}
                >
                  {m("errors", "Errors")}: {vaultResult.errors.length}
                </span>
                <div
                  className="mt-1 text-xs max-h-20 overflow-y-auto"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  {vaultResult.errors.slice(0, 5).map((err, i) => (
                    <div key={i}>{err}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};
