// src/components/library/LibraryView.tsx
// Stellar — 文献ライブラリ画面本体
// ヘッダー（タイトル + フィルタバー + 追加ボタン）+ 論文グリッド/リスト + 右詳細パネル
// 3ペインレイアウト内のメインコンテンツ領域として機能する

import type React from "react";
import { useEffect, useCallback, useState, useRef } from "react";
import { useLibraryStore } from "../../stores/useLibraryStore";
import { useUIStore } from "../../stores/useUIStore";
import { PaperCard } from "./PaperCard";
import { PaperListRow } from "./PaperListRow";
import { PaperDetailPanel } from "./PaperDetailPanel";
import { AddPaperModal } from "./AddPaperModal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Badge } from "../ui/Badge";
import { toast } from "../ui/Toast";
import type { CreatePaperInput } from "../../types";
import { swalConfirm } from "../../lib/swal";
import { useT } from "../../stores/useI18nStore";
import { invoke } from "../../lib/tauriShim";
import { StaticSiteExportModal } from "../export/StaticSiteExportModal";
import { StellarPackageModal } from "../export/StellarPackageModal";
import { DataMigrationModal } from "../export/DataMigrationModal";
import { EditPaperModal } from "./EditPaperModal";
import type { UpdatePaperInput } from "../../types";

/** フィルタードロップダウンの共通スタイル */
const dropdownStyle: React.CSSProperties = {
  position: "absolute",
  top: "100%",
  left: 0,
  marginTop: "4px",
  minWidth: "160px",
  maxHeight: "240px",
  overflowY: "auto",
  backgroundColor: "var(--color-bg-card)",
  borderRadius: "var(--radius-input)",
  boxShadow: "var(--shadow-dropdown)",
  border: "1px solid var(--color-border-secondary)",
  padding: "var(--space-1) 0",
  zIndex: "var(--z-dropdown)",
  animation: "scale-in 150ms ease-out both",
};

/** ドロップダウン項目スタイル */
const dropdownItemBase: React.CSSProperties = {
  color: "var(--color-text-primary)",
  transition: "background-color var(--transition-fast)",
};

export const LibraryView: React.FC = () => {
  const t = useT();
  // ── ストアから状態とアクションを取得 ──
  const papers = useLibraryStore((s) => s.papers);
  const loading = useLibraryStore((s) => s.loading);
  const error = useLibraryStore((s) => s.error);
  const selectedPaperId = useLibraryStore((s) => s.selectedPaperId);
  const checkedPaperIds = useLibraryStore((s) => s.checkedPaperIds);
  const filterTag = useLibraryStore((s) => s.filterTag);
  const filterYear = useLibraryStore((s) => s.filterYear);
  const filterHasPdf = useLibraryStore((s) => s.filterHasPdf);
  const filterQuery = useLibraryStore((s) => s.filterQuery);
  const viewMode = useLibraryStore((s) => s.viewMode);
  const addModalOpen = useLibraryStore((s) => s.addModalOpen);

  const fetchPapers = useLibraryStore((s) => s.fetchPapers);
  const fetchMorePapers = useLibraryStore((s) => s.fetchMorePapers);
  const loadingMore = useLibraryStore((s) => s.loadingMore);
  const hasMore = useLibraryStore((s) => s.hasMore);
  const totalItems = useLibraryStore((s) => s.totalItems);
  const selectPaper = useLibraryStore((s) => s.selectPaper);
  const toggleCheckedPaper = useLibraryStore((s) => s.toggleCheckedPaper);
  const deletePaper = useLibraryStore((s) => s.deletePaper);
  const createPaper = useLibraryStore((s) => s.createPaper);
  const attachPdf = useLibraryStore((s) => s.attachPdf);
  const updatePaper = useLibraryStore((s) => s.updatePaper);
  const setFilterTag = useLibraryStore((s) => s.setFilterTag);
  const setFilterYear = useLibraryStore((s) => s.setFilterYear);
  const setFilterHasPdf = useLibraryStore((s) => s.setFilterHasPdf);
  const setFilterQuery = useLibraryStore((s) => s.setFilterQuery);
  const setViewMode = useLibraryStore((s) => s.setViewMode);
  const openAddModal = useLibraryStore((s) => s.openAddModal);
  const closeAddModal = useLibraryStore((s) => s.closeAddModal);
  const getFilteredPapers = useLibraryStore((s) => s.getFilteredPapers);
  const getAllTags = useLibraryStore((s) => s.getAllTags);
  const getAllYears = useLibraryStore((s) => s.getAllYears);

  const openPaper = useUIStore((s) => s.openPaper);

  // ── ドロップダウン表示状態 ──
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showPdfDropdown, setShowPdfDropdown] = useState(false);
  const [showShareDropdown, setShowShareDropdown] = useState(false);
  const [staticSiteModalOpen, setStaticSiteModalOpen] = useState(false);
  const [stellarPackageModalOpen, setStellarPackageModalOpen] = useState(false);
  const [dataMigrationModalOpen, setDataMigrationModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPaper, setEditingPaper] = useState<import("../../types").Paper | null>(null);

  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const yearDropdownRef = useRef<HTMLDivElement>(null);
  const pdfDropdownRef = useRef<HTMLDivElement>(null);
  const shareDropdownRef = useRef<HTMLDivElement>(null);
  const scrollSentinelRef = useRef<HTMLDivElement>(null);

  // ── Intersection Observer でスクロール末端を検知 ──
  useEffect(() => {
    const sentinel = scrollSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore && !loading) {
          void fetchMorePapers();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, fetchMorePapers]);

  // ── 初回マウント時に論文一覧を取得 ──
  useEffect(() => {
    void fetchPapers();
  }, [fetchPapers]);

  // ── ドロップダウンの外クリックで閉じる ──
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        tagDropdownRef.current &&
        !tagDropdownRef.current.contains(e.target as Node)
      ) {
        setShowTagDropdown(false);
      }
      if (
        yearDropdownRef.current &&
        !yearDropdownRef.current.contains(e.target as Node)
      ) {
        setShowYearDropdown(false);
      }
      if (
        pdfDropdownRef.current &&
        !pdfDropdownRef.current.contains(e.target as Node)
      ) {
        setShowPdfDropdown(false);
      }
      if (
        shareDropdownRef.current &&
        !shareDropdownRef.current.contains(e.target as Node)
      ) {
        setShowShareDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── 派生データ ──
  // フィルターがアクティブならフロントエンド側でフィルタ、なければバックエンドのページネーションをそのまま使う
  const filteredPapers = getFilteredPapers();
  const allTags = getAllTags();
  const allYears = getAllYears();
  const selectedPaper = papers.find((p) => p.id === selectedPaperId) ?? null;

  // ── 論文削除（確認ダイアログ付き） ──
  const handleDeletePaper = useCallback(
    async (id: string) => {
      const paper = papers.find((p) => p.id === id);
      const title = paper?.title ?? t.library.k_6b6q7g;
      const confirmed = await swalConfirm(t.library.k_cdyrih, t.library.k_wf1by1.replace("${title}", title));
      if (!confirmed) return;
      try {
        await deletePaper(id);
        toast.success(t.library.k_u38ovq);
      } catch {
        toast.error(t.library.k_dtz2fv);
      }
    },
    [papers, deletePaper]
  );

  // ── PDFリーダーへ遷移 ──
  const handleOpenPdfReader = useCallback(
    (paperId: string) => {
      openPaper(paperId);
    },
    [openPaper]
  );

  // ── 論文追加（モーダルから） ──
  const handleSavePaper = useCallback(
    async (input: CreatePaperInput) => {
      await createPaper(input);
    },
    [createPaper]
  );

  // ── 編集モーダルを開く ──
  const handleEditPaper = useCallback((id: string) => {
    const paper = papers.find((p) => p.id === id) ?? null;
    if (paper) {
      setEditingPaper(paper);
      setEditModalOpen(true);
    }
  }, [papers]);

  // ── 論文更新を保存 ──
  const handleSaveEditPaper = useCallback(async (id: string, input: UpdatePaperInput) => {
    try {
      await updatePaper(id, input);
      toast.success(t.common.save);
    } catch (e: unknown) {
      toast.error(String(e));
    }
  }, [updatePaper, t]);

  // ── PDF添付（ファイルダイアログ→バックエンド保存） ──
  const handleAttachPdf = useCallback(
    async (paperId: string) => {
      try {
        const { openFileDialog, invoke } = await import("../../lib/tauriShim");
        const selected = await openFileDialog({
          multiple: false,
          filters: [{ name: "PDF", extensions: ["pdf"] }],
        });
        if (selected && typeof selected === "string") {
          // Rust側でPDFをアプリデータにコピーしてパスを保存
          try {
            const savedPath = await invoke<string>("import_pdf", {
              paperId,
              sourcePath: selected,
            });
            await attachPdf(paperId, savedPath);
          } catch {
            // import_pdfが未実装の場合は元パスで保存
            await attachPdf(paperId, selected);
          }
          toast.success(t.library.k_uojkt0);
        }
      } catch {
        toast.error(t.library.k_e12e0q);
      }
    },
    [attachPdf]
  );

  // ── アクティブフィルターのバッジ表示 ──
  const hasActiveFilters =
    filterTag !== null ||
    filterYear !== null ||
    filterHasPdf !== null ||
    filterQuery.trim() !== "";

  return (
    <div className="flex h-full overflow-hidden">
      {/* ==============================
          メインコンテンツ領域
          ============================== */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ── ヘッダー ── */}
        <header
          className="shrink-0 flex flex-col gap-3"
          style={{
            padding: "var(--space-4) var(--space-6)",
            borderBottom: "1px solid var(--color-border-secondary)",
          }}
        >
          {/* 上段: タイトル + カウント + 追加ボタン */}
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-3">
              <h1
                className="text-lg font-bold"
                style={{ color: "var(--color-text-primary)" }}
              >
                {t.library.k_library_title}
              </h1>
              {papers.length > 0 && (
                <span
                  className="text-xs"
                  style={{
                    color: "var(--color-text-tertiary)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {hasActiveFilters
                    ? t.library.k_7fsnpg
                    : t.library.k_9p8m7j}
                </span>
              )}
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              }
              onClick={openAddModal}
            >
              {t.library.k_add_label}
            </Button>
          </div>

          {/* 下段: フィルタバー */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* 検索入力 */}
            <div style={{ width: "240px", minWidth: "180px" }}>
              <Input
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder={t.layout.str_kn3fs}
                icon={
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                }
                fullWidth
              />
            </div>

            {/* タグフィルタ */}
            <div className="relative" ref={tagDropdownRef}>
              <Button
                variant={filterTag !== null ? "primary" : "secondary"}
                size="sm"
                onClick={() => {
                  setShowTagDropdown((v) => !v);
                  setShowYearDropdown(false);
                  setShowPdfDropdown(false);
                }}
              >
                {t.library.k_tag_filter} {filterTag !== null ? `(${filterTag})` : "▼"}
              </Button>
              {showTagDropdown && (
                <div style={dropdownStyle}>
                  {/* フィルタ解除 */}
                  <button
                    className="flex items-center w-full px-3 py-2 text-xs text-left"
                    style={{
                      ...dropdownItemBase,
                      color: "var(--color-text-tertiary)",
                      fontStyle: "italic",
                    }}
                    onClick={() => {
                      setFilterTag(null);
                      setShowTagDropdown(false);
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "var(--color-bg-hover)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    {t.library.k_all_tags}
                  </button>
                  {allTags.length === 0 ? (
                    <div
                      className="px-3 py-2 text-xs"
                      style={{ color: "var(--color-text-disabled)" }}
                    >
                      {t.library.k_no_tags}
                    </div>
                  ) : (
                    allTags.map((tag) => (
                      <button
                        key={tag}
                        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left"
                        style={{
                          ...dropdownItemBase,
                          fontWeight: filterTag === tag ? 600 : 400,
                        }}
                        onClick={() => {
                          setFilterTag(tag);
                          setShowTagDropdown(false);
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor =
                            "var(--color-bg-hover)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor =
                            "transparent";
                        }}
                      >
                        <Badge>{tag}</Badge>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* 年フィルタ */}
            <div className="relative" ref={yearDropdownRef}>
              <Button
                variant={filterYear !== null ? "primary" : "secondary"}
                size="sm"
                onClick={() => {
                  setShowYearDropdown((v) => !v);
                  setShowTagDropdown(false);
                  setShowPdfDropdown(false);
                }}
              >
                {t.library.k_year_filter} {filterYear !== null ? `(${filterYear})` : "▼"}
              </Button>
              {showYearDropdown && (
                <div style={dropdownStyle}>
                  <button
                    className="flex items-center w-full px-3 py-2 text-xs text-left"
                    style={{
                      ...dropdownItemBase,
                      color: "var(--color-text-tertiary)",
                      fontStyle: "italic",
                    }}
                    onClick={() => {
                      setFilterYear(null);
                      setShowYearDropdown(false);
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "var(--color-bg-hover)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    {t.library.k_all_years}
                  </button>
                  {allYears.length === 0 ? (
                    <div
                      className="px-3 py-2 text-xs"
                      style={{ color: "var(--color-text-disabled)" }}
                    >
                      {t.library.k_no_year_data}
                    </div>
                  ) : (
                    allYears.map((year) => (
                      <button
                        key={year}
                        className="flex items-center w-full px-3 py-2 text-xs text-left"
                        style={{
                          ...dropdownItemBase,
                          fontWeight: filterYear === year ? 600 : 400,
                        }}
                        onClick={() => {
                          setFilterYear(year);
                          setShowYearDropdown(false);
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor =
                            "var(--color-bg-hover)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor =
                            "transparent";
                        }}
                      >
                        {year}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* PDFありフィルタ */}
            <div className="relative" ref={pdfDropdownRef}>
              <Button
                variant={filterHasPdf !== null ? "primary" : "secondary"}
                size="sm"
                onClick={() => {
                  setShowPdfDropdown((v) => !v);
                  setShowTagDropdown(false);
                  setShowYearDropdown(false);
                }}
              >
                {filterHasPdf !== null
                  ? filterHasPdf
                    ? t.library.k_pdf_yes
                    : t.library.k_pdf_no
                  : <>PDF ▼</>}
              </Button>
              {showPdfDropdown && (
                <div style={dropdownStyle}>
                  <button
                    className="flex items-center w-full px-3 py-2 text-xs text-left"
                    style={{
                      ...dropdownItemBase,
                      color: "var(--color-text-tertiary)",
                      fontStyle: "italic",
                    }}
                    onClick={() => {
                      setFilterHasPdf(null);
                      setShowPdfDropdown(false);
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "var(--color-bg-hover)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    {t.quantResults.str_7bg2u}
                  </button>
                  <button
                    className="flex items-center w-full px-3 py-2 text-xs text-left"
                    style={{
                      ...dropdownItemBase,
                      fontWeight: filterHasPdf === true ? 600 : 400,
                    }}
                    onClick={() => {
                      setFilterHasPdf(true);
                      setShowPdfDropdown(false);
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "var(--color-bg-hover)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    {t.library.k_pdf_yes}
                  </button>
                  <button
                    className="flex items-center w-full px-3 py-2 text-xs text-left"
                    style={{
                      ...dropdownItemBase,
                      fontWeight: filterHasPdf === false ? 600 : 400,
                    }}
                    onClick={() => {
                      setFilterHasPdf(false);
                      setShowPdfDropdown(false);
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "var(--color-bg-hover)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    {t.library.k_pdf_no}
                  </button>
                </div>
              )}
            </div>

            {/* 共有・エクスポートドロップダウン */}
            <div className="relative" ref={shareDropdownRef}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowShareDropdown((v) => !v);
                  setShowTagDropdown(false);
                  setShowYearDropdown(false);
                  setShowPdfDropdown(false);
                }}
              >
                {t.exportImport.k_shareExport} &#9662;
              </Button>
              {showShareDropdown && (
                <div style={{
                  ...dropdownStyle,
                  right: 0,
                  left: "auto",
                  minWidth: "220px",
                }}>
                  {/* BibTeX */}
                  <button
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left"
                    style={dropdownItemBase}
                    onClick={() => {
                      setShowShareDropdown(false);
                      void invoke<string>("export_bibtex", {}).then(() => {
                        toast.success(t.exportImport.exportSuccess);
                      }).catch(() => {
                        toast.error(t.exportImport.exportFailed);
                      });
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-bg-hover)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    {t.exportImport.k_exportBibtex}
                  </button>
                  {/* RIS */}
                  <button
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left"
                    style={dropdownItemBase}
                    onClick={() => {
                      setShowShareDropdown(false);
                      void invoke<string>("export_ris", {}).then(() => {
                        toast.success(t.exportImport.exportSuccess);
                      }).catch(() => {
                        toast.error(t.exportImport.exportFailed);
                      });
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-bg-hover)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                    {t.exportImport.k_exportRis}
                  </button>
                  {/* Separator */}
                  <div style={{ height: "1px", backgroundColor: "var(--color-border-secondary)", margin: "4px 0" }} />
                  {/* Stellar Package */}
                  <button
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left"
                    style={dropdownItemBase}
                    onClick={() => {
                      setShowShareDropdown(false);
                      setStellarPackageModalOpen(true);
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-bg-hover)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                      <line x1="12" y1="22.08" x2="12" y2="12" />
                    </svg>
                    {t.exportImport.k_createStellarPackage}
                  </button>
                  {/* Static Site */}
                  <button
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left"
                    style={dropdownItemBase}
                    onClick={() => {
                      setShowShareDropdown(false);
                      setStaticSiteModalOpen(true);
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-bg-hover)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                    {t.exportImport.k_generateStaticSite}
                  </button>
                  {/* Separator */}
                  <div style={{ height: "1px", backgroundColor: "var(--color-border-secondary)", margin: "4px 0" }} />
                  {/* Data Migration (Zotero/Obsidian) */}
                  <button
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left"
                    style={dropdownItemBase}
                    onClick={() => {
                      setShowShareDropdown(false);
                      setDataMigrationModalOpen(true);
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-bg-hover)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3v12" />
                      <path d="m8 11 4 4 4-4" />
                      <path d="M8 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4" />
                    </svg>
                    {((t as Record<string, Record<string, unknown>>).migration as Record<string, string> | undefined)?.menuLabel ?? "Import from Zotero / Obsidian..."}
                  </button>
                </div>
              )}
            </div>

            {/* スペーサー */}
            <div className="flex-1" />

            {/* フィルタクリア */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  useLibraryStore.getState().clearFilters();
                }}
                style={{ color: "var(--color-text-tertiary)" }}
              >
                {t.library.k_clear_filters}
              </Button>
            )}

            {/* 表示モード切替 */}
            <div
              className="flex items-center"
              style={{
                borderRadius: "var(--radius-button)",
                border: "1px solid var(--color-border-primary)",
                overflow: "hidden",
              }}
            >
              {/* グリッドボタン */}
              <button
                className="flex items-center justify-center px-2 py-1.5"
                style={{
                  backgroundColor:
                    viewMode === "grid"
                      ? "var(--color-bg-hover)"
                      : "transparent",
                  color:
                    viewMode === "grid"
                      ? "var(--color-accent-primary)"
                      : "var(--color-text-tertiary)",
                  transition: "all var(--transition-fast)",
                }}
                onClick={() => setViewMode("grid")}
                title={t.library.k_9nrs3y}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                </svg>
              </button>
              {/* セパレータ */}
              <div
                className="h-4"
                style={{
                  width: "1px",
                  backgroundColor: "var(--color-border-primary)",
                }}
              />
              {/* リストボタン */}
              <button
                className="flex items-center justify-center px-2 py-1.5"
                style={{
                  backgroundColor:
                    viewMode === "list"
                      ? "var(--color-bg-hover)"
                      : "transparent",
                  color:
                    viewMode === "list"
                      ? "var(--color-accent-primary)"
                      : "var(--color-text-tertiary)",
                  transition: "all var(--transition-fast)",
                }}
                onClick={() => setViewMode("list")}
                title={t.library.k_fh7179}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {/* ── コンテンツ領域 ── */}
        <div className="flex-1 overflow-y-auto scrollable">
          {/* ローディング */}
          {loading && papers.length === 0 && (
            <div
              className="flex items-center justify-center h-full"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              <div className="flex flex-col items-center gap-3">
                <svg
                  className="animate-spin"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                <span className="text-sm">{t.common.loading}</span>
              </div>
            </div>
          )}

          {/* エラー */}
          {error && (
            <div
              className="flex items-center justify-center h-full"
              style={{ color: "var(--color-accent-danger)" }}
            >
              <div className="flex flex-col items-center gap-3">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                <p className="text-sm">{error}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void fetchPapers()}
                >
                  {t.library.k_reload}
                </Button>
              </div>
            </div>
          )}

          {/* 空状態 */}
          {!loading && !error && filteredPapers.length === 0 && (
            <div
              className="flex items-center justify-center h-full"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              <div className="flex flex-col items-center gap-4">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ opacity: 0.4 }}
                >
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
                {hasActiveFilters ? (
                  <>
                    <p className="text-sm">
                      {t.library.k_no_filter_match}
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        useLibraryStore.getState().clearFilters()
                      }
                    >
                      {t.library.k_clear_filters}
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm">
                      {t.library.k_no_papers_yet}
                    </p>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      }
                      onClick={openAddModal}
                    >
                      {t.library.k_add_first_paper}
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── グリッド表示 ── */}
          {!loading && !error && filteredPapers.length > 0 && viewMode === "grid" && (
            <div
              className="grid gap-4"
              style={{
                padding: "var(--space-4) var(--space-6)",
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(240px, 1fr))",
              }}
            >
              {filteredPapers.map((paper, index) => (
                <PaperCard
                  key={paper.id}
                  paper={paper}
                  selected={selectedPaperId === paper.id}
                  animationDelay={Math.min(index * 50, 500)}
                  onSelect={selectPaper}
                  onDoubleClick={handleOpenPdfReader}
                  onDelete={(id) => void handleDeletePaper(id)}
                  onEdit={handleEditPaper}
                  onAttachPdf={(id) => void handleAttachPdf(id)}
                />
              ))}
            </div>
          )}

          {/* ── リスト表示 ── */}
          {!loading && !error && filteredPapers.length > 0 && viewMode === "list" && (
            <div>
              {/* リストヘッダー */}
              <div
                className="flex items-center gap-3 px-4 py-2 text-xs font-medium sticky top-0"
                style={{
                  color: "var(--color-text-tertiary)",
                  backgroundColor: "var(--color-bg-secondary)",
                  borderBottom: "1px solid var(--color-border-secondary)",
                  zIndex: 1,
                }}
              >
                <div style={{ width: "16px" }} />
                <div className="flex-1">{t.notes.sortTitle}</div>
                <div style={{ width: "160px", textAlign: "left" }}>{t.library.k_col_authors}</div>
                <div style={{ width: "48px", textAlign: "center" }}>{t.library.k_year_filter}</div>
                <div style={{ width: "140px", textAlign: "left" }}>
                  {t.library.k_col_journal}
                </div>
                <div style={{ width: "140px" }}>{t.library.k_tag_filter}</div>
                <div style={{ width: "70px", textAlign: "left" }}>
                  {t.citationNetwork.readingStatus}
                </div>
                <div style={{ width: "28px", textAlign: "center" }}>PDF</div>
              </div>
              {/* リスト行 */}
              {filteredPapers.map((paper, index) => (
                <PaperListRow
                  key={paper.id}
                  paper={paper}
                  selected={selectedPaperId === paper.id}
                  checked={checkedPaperIds.has(paper.id)}
                  animationDelay={Math.min(index * 30, 300)}
                  onSelect={selectPaper}
                  onDoubleClick={handleOpenPdfReader}
                  onToggleCheck={toggleCheckedPaper}
                />
              ))}
            </div>
          )}

          {/* ── スクロール末端検知・追加読み込みUI ── */}
          {!loading && !error && filteredPapers.length > 0 && (
            <>
              {/* Intersection Observer のセンチネル */}
              <div ref={scrollSentinelRef} style={{ height: "1px" }} />

              {/* 追加読み込み中スピナー */}
              {loadingMore && (
                <div
                  className="flex items-center justify-center py-4"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  <svg
                    className="animate-spin mr-2"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  <span className="text-xs">{t.library.k_loading_more}</span>
                </div>
              )}

              {/* 件数表示 */}
              {!hasMore && papers.length > 0 && (
                <div
                  className="flex items-center justify-center py-3"
                  style={{ color: "var(--color-text-disabled)" }}
                >
                  <span className="text-xs">
                    {t.library.k_showing_total.replace("${count}", String(totalItems))}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ==============================
          右 詳細パネル
          ============================== */}
      {selectedPaper && (
        <PaperDetailPanel
          paper={selectedPaper}
          onClose={() => selectPaper(null)}
          onOpenPdf={handleOpenPdfReader}
          onDelete={(id) => void handleDeletePaper(id)}
          onAttachPdf={(id) => void handleAttachPdf(id)}
          onEdit={handleEditPaper}
        />
      )}

      {/* ==============================
          論文追加モーダル
          ============================== */}
      <AddPaperModal
        open={addModalOpen}
        onClose={closeAddModal}
        onSave={handleSavePaper}
      />

      {/* 静的サイトエクスポートモーダル */}
      <StaticSiteExportModal
        open={staticSiteModalOpen}
        onClose={() => setStaticSiteModalOpen(false)}
      />

      {/* Stellar パッケージモーダル */}
      <StellarPackageModal
        open={stellarPackageModalOpen}
        onClose={() => setStellarPackageModalOpen(false)}
      />

      {/* データ移行モーダル (Zotero / Obsidian) */}
      <DataMigrationModal
        open={dataMigrationModalOpen}
        onClose={() => setDataMigrationModalOpen(false)}
      />

      {/* 論文編集モーダル */}
      <EditPaperModal
        open={editModalOpen}
        onClose={() => { setEditModalOpen(false); setEditingPaper(null); }}
        paper={editingPaper}
        onSave={handleSaveEditPaper}
      />
    </div>
  );
};
