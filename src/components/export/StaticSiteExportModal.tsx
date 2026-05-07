// src/components/export/StaticSiteExportModal.tsx
// Stellar — 静的サイトエクスポート ウィザードモーダル
// 3ステップ: ノート選択 → サイト設定 → 出力先＆生成

import type React from "react";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Modal } from "../ui/Modal";
import { toast } from "../ui/Toast";
import { invoke } from "../../lib/tauriShim";
import { useT } from "../../stores/useI18nStore";
import type { Note } from "../../types";

interface StaticSiteExportModalProps {
  open: boolean;
  onClose: () => void;
  initialNoteIds?: string[];
}

type Step = 1 | 2 | 3;
type ThemeOption = "light" | "dark";

export const StaticSiteExportModal: React.FC<StaticSiteExportModalProps> = ({
  open,
  onClose,
  initialNoteIds = [],
}) => {
  const t = useT();

  // ── ステップ管理 ──
  const [step, setStep] = useState<Step>(1);

  // ── ステップ1: ノート選択 ──
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialNoteIds));
  const [noteSearch, setNoteSearch] = useState("");
  const [loadingNotes, setLoadingNotes] = useState(false);

  // ── ステップ2: サイト設定 ──
  const [siteTitle, setSiteTitle] = useState(t.exportImport.k_defaultSiteTitle);
  const [themeChoice, setThemeChoice] = useState<ThemeOption>("light");
  const [includeBacklinks, setIncludeBacklinks] = useState(true);

  // ── ステップ3: 出力先 ──
  const [outputDir, setOutputDir] = useState("");
  const [generating, setGenerating] = useState(false);

  // 仮想スクロール用
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const ITEM_HEIGHT = 52;
  const VISIBLE_HEIGHT = 340;

  // ── ノート取得 ──
  useEffect(() => {
    if (!open) return;
    setLoadingNotes(true);
    invoke<{ items: Note[] }>("get_notes", { page: 1, perPage: 9999 })
      .then((res) => {
        const items = res?.items ?? [];
        setNotes(items);
        if (initialNoteIds.length > 0) {
          setSelectedIds(new Set(initialNoteIds));
        }
      })
      .catch(() => setNotes([]))
      .finally(() => setLoadingNotes(false));
  }, [open]);

  // リセット
  useEffect(() => {
    if (!open) {
      setStep(1);
      setSelectedIds(new Set(initialNoteIds));
      setNoteSearch("");
      setOutputDir("");
      setGenerating(false);
    }
  }, [open]);

  // ── フィルタ済みノート ──
  const filteredNotes = useMemo(() => {
    if (!noteSearch.trim()) return notes;
    const q = noteSearch.toLowerCase();
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.tags.some((tag) => tag.toLowerCase().includes(q)),
    );
  }, [notes, noteSearch]);

  // 仮想スクロール計算
  const totalHeight = filteredNotes.length * ITEM_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - 2);
  const endIndex = Math.min(
    filteredNotes.length,
    Math.ceil((scrollTop + VISIBLE_HEIGHT) / ITEM_HEIGHT) + 2,
  );
  const visibleNotes = filteredNotes.slice(startIndex, endIndex);

  // ── 選択操作 ──
  const toggleNote = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredNotes.map((n) => n.id)));
  }, [filteredNotes]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // ── フォルダ選択 ──
  const pickFolder = useCallback(async () => {
    try {
      const { open: openDialog } = await import("@tauri-apps/plugin-dialog");
      const selected = await openDialog({ directory: true, multiple: false });
      if (selected && typeof selected === "string") {
        setOutputDir(selected);
      }
    } catch {
      // cancel or error
    }
  }, []);

  // ── 生成実行 ──
  const handleGenerate = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.error(t.exportImport.noNotesSelected);
      return;
    }
    if (!outputDir) {
      toast.error(t.exportImport.k_selectOutputDir);
      return;
    }

    setGenerating(true);
    try {
      const resultPath = await invoke<string>("export_static_site", {
        noteIds: Array.from(selectedIds),
        outputDir,
        siteTitle,
        includeBacklinks,
        theme: themeChoice,
      });
      toast.success(t.exportImport.k_siteGenerated);
      // フォルダを開く
      try {
        const { open: shellOpen } = await import("@tauri-apps/plugin-shell");
        await shellOpen(resultPath);
      } catch {
        // fallback — shell open not available
      }
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.exportImport.exportFailed;
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  }, [selectedIds, outputDir, siteTitle, includeBacklinks, themeChoice, onClose, t]);

  // ── 日付フォーマット ──
  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}/${m}/${day}`;
  };

  // ── ステップインジケータ ──
  const stepLabels = [
    t.exportImport.selectNotes,
    t.exportImport.k_siteSettings,
    t.exportImport.k_outputAndGenerate,
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.exportImport.exportStaticSite}
      width="640px"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as Step)}
                className="px-3 py-1.5 text-xs font-medium"
                style={{
                  backgroundColor: "var(--color-bg-hover)",
                  color: "var(--color-text-primary)",
                  borderRadius: "var(--radius-button)",
                  border: "1px solid var(--color-border-primary)",
                }}
              >
                {t.common.back}
              </button>
            )}
          </div>
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
              {t.common.cancel}
            </button>
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s + 1) as Step)}
                disabled={step === 1 && selectedIds.size === 0}
                className="px-4 py-1.5 text-xs font-medium"
                style={{
                  backgroundColor: "var(--color-accent-primary)",
                  color: "var(--color-text-inverse)",
                  borderRadius: "var(--radius-button)",
                  opacity: step === 1 && selectedIds.size === 0 ? 0.5 : 1,
                  cursor: step === 1 && selectedIds.size === 0 ? "not-allowed" : "pointer",
                }}
              >
                {t.common.next}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={generating || !outputDir}
                className="px-4 py-1.5 text-xs font-medium"
                style={{
                  backgroundColor: "var(--color-accent-primary)",
                  color: "var(--color-text-inverse)",
                  borderRadius: "var(--radius-button)",
                  opacity: generating || !outputDir ? 0.5 : 1,
                  cursor: generating || !outputDir ? "not-allowed" : "pointer",
                }}
              >
                {generating
                  ? t.exportImport.exporting
                  : (t.exportImport.k_generate)}
              </button>
            )}
          </div>
        </div>
      }
    >
      {/* ステップインジケータ */}
      <div className="flex items-center gap-2 mb-5">
        {stepLabels.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className="h-px flex-1"
                style={{
                  width: "24px",
                  backgroundColor:
                    i < step ? "var(--color-accent-primary)" : "var(--color-border-secondary)",
                }}
              />
            )}
            <div className="flex items-center gap-1.5">
              <div
                className="flex items-center justify-center text-xs font-bold"
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  backgroundColor:
                    i + 1 <= step ? "var(--color-accent-primary)" : "var(--color-bg-tertiary)",
                  color:
                    i + 1 <= step ? "var(--color-text-inverse)" : "var(--color-text-tertiary)",
                  fontSize: "10px",
                }}
              >
                {i + 1}
              </div>
              <span
                className="text-xs"
                style={{
                  color:
                    i + 1 === step ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                  fontWeight: i + 1 === step ? 600 : 400,
                }}
              >
                {label}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ===================== ステップ1: ノート選択 ===================== */}
      {step === 1 && (
        <div className="flex flex-col gap-3">
          {/* 検索 + 全選択 */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={noteSearch}
              onChange={(e) => setNoteSearch(e.target.value)}
              placeholder={t.notes.searchPlaceholder}
              className="flex-1 text-xs px-3 py-2"
              style={{
                backgroundColor: "var(--color-bg-input)",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-border-primary)",
                borderRadius: "var(--radius-input)",
                outline: "none",
              }}
            />
            <button
              type="button"
              onClick={selectedIds.size === filteredNotes.length ? deselectAll : selectAll}
              className="px-2 py-1.5 text-xs shrink-0"
              style={{
                color: "var(--color-accent-primary)",
                borderRadius: "var(--radius-button)",
              }}
            >
              {selectedIds.size === filteredNotes.length
                ? (t.exportImport.k_deselectAll)
                : (t.exportImport.k_selectAll)}
            </button>
            <span
              className="text-xs font-medium px-2 py-0.5 shrink-0"
              style={{
                backgroundColor: "var(--color-accent-primary)",
                color: "var(--color-text-inverse)",
                borderRadius: "10px",
                minWidth: "28px",
                textAlign: "center",
              }}
            >
              {selectedIds.size}
            </span>
          </div>

          {/* ノートリスト (仮想スクロール) */}
          {loadingNotes ? (
            <div
              className="flex items-center justify-center"
              style={{ height: `${VISIBLE_HEIGHT}px`, color: "var(--color-text-tertiary)" }}
            >
              <span className="text-xs">{t.common.loading}</span>
            </div>
          ) : (
            <div
              ref={listRef}
              className="overflow-y-auto"
              style={{
                height: `${VISIBLE_HEIGHT}px`,
                border: "1px solid var(--color-border-secondary)",
                borderRadius: "var(--radius-input)",
              }}
              onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
            >
              <div style={{ height: `${totalHeight}px`, position: "relative" }}>
                {visibleNotes.map((note, vi) => {
                  const idx = startIndex + vi;
                  return (
                    <label
                      key={note.id}
                      className="flex items-center gap-3 px-3 cursor-pointer"
                      style={{
                        position: "absolute",
                        top: `${idx * ITEM_HEIGHT}px`,
                        left: 0,
                        right: 0,
                        height: `${ITEM_HEIGHT}px`,
                        borderBottom: "1px solid var(--color-border-secondary)",
                        backgroundColor: selectedIds.has(note.id)
                          ? "var(--color-bg-hover)"
                          : "transparent",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(note.id)}
                        onChange={() => toggleNote(note.id)}
                        style={{ accentColor: "var(--color-accent-primary)" }}
                      />
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-xs font-medium truncate"
                          style={{ color: "var(--color-text-primary)" }}
                        >
                          {note.title || t.notes.untitled}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className="text-xs"
                            style={{ color: "var(--color-text-tertiary)", fontSize: "10px" }}
                          >
                            {fmtDate(note.updatedAt)}
                          </span>
                          {note.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="text-xs px-1.5 py-0.5"
                              style={{
                                backgroundColor: "var(--color-bg-tertiary)",
                                color: "var(--color-text-secondary)",
                                borderRadius: "4px",
                                fontSize: "10px",
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================== ステップ2: サイト設定 ===================== */}
      {step === 2 && (
        <div className="flex flex-col gap-5">
          {/* サイトタイトル */}
          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {t.exportImport.siteTitle}
            </label>
            <input
              type="text"
              value={siteTitle}
              onChange={(e) => setSiteTitle(e.target.value)}
              className="w-full text-sm px-3 py-2"
              style={{
                backgroundColor: "var(--color-bg-input)",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-border-primary)",
                borderRadius: "var(--radius-input)",
                outline: "none",
              }}
            />
          </div>

          {/* テーマ選択 */}
          <div>
            <label
              className="block text-xs font-medium mb-2"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {t.exportImport.theme}
            </label>
            <div className="flex gap-3">
              {(["light", "dark"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setThemeChoice(opt)}
                  className="flex flex-col items-center gap-2 p-3 flex-1"
                  style={{
                    borderRadius: "var(--radius-input)",
                    border:
                      themeChoice === opt
                        ? "2px solid var(--color-accent-primary)"
                        : "2px solid var(--color-border-secondary)",
                    backgroundColor: "var(--color-bg-card)",
                    cursor: "pointer",
                  }}
                >
                  {/* プレビュー */}
                  <div
                    className="w-full rounded"
                    style={{
                      height: "48px",
                      backgroundColor: opt === "light" ? "#ffffff" : "#1a1a2e",
                      border: "1px solid var(--color-border-secondary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      className="text-xs font-medium"
                      style={{ color: opt === "light" ? "#333" : "#e0e0e0" }}
                    >
                      Aa
                    </div>
                  </div>
                  <span
                    className="text-xs font-medium"
                    style={{
                      color:
                        themeChoice === opt
                          ? "var(--color-accent-primary)"
                          : "var(--color-text-secondary)",
                    }}
                  >
                    {opt === "light" ? t.exportImport.themeLight : t.exportImport.themeDark}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* バックリンクトグル */}
          <div className="flex items-center justify-between">
            <div>
              <span
                className="text-xs font-medium"
                style={{ color: "var(--color-text-primary)" }}
              >
                {t.exportImport.includeBacklinks}
              </span>
              <p
                className="text-xs mt-0.5"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                {t.exportImport.k_backlinksDesc}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIncludeBacklinks((v) => !v)}
              className="relative shrink-0"
              style={{
                width: "36px",
                height: "20px",
                borderRadius: "10px",
                backgroundColor: includeBacklinks
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
                  left: includeBacklinks ? "18px" : "2px",
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
        </div>
      )}

      {/* ===================== ステップ3: 出力先＆生成 ===================== */}
      {step === 3 && (
        <div className="flex flex-col gap-5">
          {/* 出力先選択 */}
          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {t.exportImport.outputDir}
            </label>
            <div className="flex items-center gap-2">
              <div
                className="flex-1 text-xs px-3 py-2 truncate"
                style={{
                  backgroundColor: "var(--color-bg-tertiary)",
                  color: outputDir
                    ? "var(--color-text-primary)"
                    : "var(--color-text-tertiary)",
                  borderRadius: "var(--radius-input)",
                  border: "1px solid var(--color-border-secondary)",
                }}
              >
                {outputDir || (t.exportImport.k_selectOutputDir)}
              </div>
              <button
                type="button"
                onClick={() => void pickFolder()}
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

          {/* サマリー */}
          <div
            className="p-4 flex flex-col gap-2"
            style={{
              backgroundColor: "var(--color-bg-secondary)",
              borderRadius: "var(--radius-input)",
              border: "1px solid var(--color-border-secondary)",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                {t.exportImport.selectNotes}
              </span>
              <span className="text-xs font-medium" style={{ color: "var(--color-text-primary)" }}>
                {selectedIds.size} {t.common.items}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                {t.exportImport.siteTitle}
              </span>
              <span className="text-xs font-medium" style={{ color: "var(--color-text-primary)" }}>
                {siteTitle}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                {t.exportImport.theme}
              </span>
              <span className="text-xs font-medium" style={{ color: "var(--color-text-primary)" }}>
                {themeChoice === "light" ? t.exportImport.themeLight : t.exportImport.themeDark}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                {t.exportImport.includeBacklinks}
              </span>
              <span className="text-xs font-medium" style={{ color: "var(--color-text-primary)" }}>
                {includeBacklinks ? "ON" : "OFF"}
              </span>
            </div>
          </div>

          {generating && (
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
              <span className="text-xs">{t.exportImport.exporting}</span>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
