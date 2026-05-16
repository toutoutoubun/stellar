// src/components/reader/ReaderView.tsx
// Stellar — PDFリーダー画面
// paperId を受け取り、paper と highlights を取得
// 左右2カラムレイアウト（PDF + ハイライトパネル）
// キーボードショートカット: ←/→ ページ、Cmd/Ctrl+F 検索、1-4 色選択

import type React from "react";
import { useState, useCallback, useEffect, useRef } from "react";

import { invoke, convertFileSrc, isTauri } from "../../lib/tauriShim";

import type { Paper, QualitativeSource, Highlight, HighlightColor, HighlightRect } from "../../types";
import { useHighlights } from "../../hooks/useHighlights";
import { useUIStore } from "../../stores/useUIStore";
import { getColorByShortcut } from "../../utils/highlightColors";
import { toast } from "../ui/Toast";
import { HighlightToolbar } from "./HighlightToolbar";
import { HighlightPanel } from "./HighlightPanel";
import { PdfViewer } from "./PdfViewer";
import type { PdfHighlight } from "./PdfViewer";
import { useT } from "../../stores/useI18nStore";

interface ReaderViewProps {
  /** 表示する論文のID */
  paperId?: string;
  /** 表示する質的分析ソースのID */
  sourceId?: string;
  /** 質的分析ソースの所属プロジェクトID（コーディングパネル用） */
  sourceProjectId?: string;
  /** 初期表示する右パネルタブ */
  initialPanelTab?: "highlights" | "coding";
}

interface ReaderDocument {
  id: string;
  title: string;
  pdfPath: string | null;
  kind: "paper" | "qualitativeSource";
}

export const ReaderView: React.FC<ReaderViewProps> = ({
  paperId,
  sourceId,
  sourceProjectId,
  initialPanelTab,
}) => {
  const t = useT();
  const targetKind = sourceId ? "qualitativeSource" : "paper";
  const targetId = sourceId ?? paperId ?? "";
  // 論文データ
  const [documentItem, setDocumentItem] = useState<ReaderDocument | null>(null);
  const [documentLoading, setDocumentLoading] = useState(true);

  // PDFビューア状態
  const [currentPage, setCurrentPage] = useState(1);
  // totalPages は PdfViewer の onDocumentLoaded コールバックで設定される
  const [totalPages, setTotalPages] = useState(0);
  const [zoomValue, setZoomValue] = useState("page-width");
  const [selectedColor, setSelectedColor] = useState<HighlightColor>("yellow");
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolledToHighlightId, setScrolledToHighlightId] = useState<
    string | null
  >(null);

  // ハイライト管理フック
  const {
    highlights,
    isLoading: highlightsLoading,
    selectedHighlightIds,
    savingCommentIds,
    addHighlight,
    updateComment,
    deleteHighlight,
    toggleSelect,
    clearSelection,
    createNoteFromSelected,
  } = useHighlights(targetId, targetKind);

  // UIストア（ノートエディタへの遷移用）
  const openNote = useUIStore((s) => s.openNote);

  // PdfHighlighter の scrollTo 関数への参照
  const scrollToHighlightRef = useRef<((highlight: PdfHighlight) => void) | null>(
    null,
  );

  /** 論文データの取得 */
  useEffect(() => {
    let cancelled = false;
    const fetchDocument = async () => {
      if (!targetId) {
        setDocumentItem(null);
        setDocumentLoading(false);
        return;
      }
      setDocumentLoading(true);
      try {
        const result =
          targetKind === "qualitativeSource"
            ? await invoke<QualitativeSource>("get_qualitative_source", { id: targetId })
            : await invoke<Paper>("get_paper", { id: targetId });
        if (!cancelled) {
          setDocumentItem(
            targetKind === "qualitativeSource"
              ? {
                  id: result.id,
                  title: result.title,
                  pdfPath:
                    "fileType" in result && result.fileType.toLowerCase() === "pdf"
                      ? result.filePath
                      : null,
                  kind: "qualitativeSource",
                }
              : {
                  id: result.id,
                  title: result.title,
                  pdfPath: "pdfPath" in result ? result.pdfPath : null,
                  kind: "paper",
                },
          );
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            typeof err === "string" ? err : t.reader.str_f6z3i6;
          toast.error(message);
        }
      } finally {
        if (!cancelled) {
          setDocumentLoading(false);
        }
      }
    };
    void fetchDocument();
    return () => {
      cancelled = true;
    };
  }, [targetId, targetKind]);

  // ── PDF Blob URL 管理 ──
  // pdfjs-dist は fetch() で PDF を取得するが、Tauri の asset protocol
  // (https://asset.localhost) はステータスコード・Range ヘッダー等の
  // 互換性問題があり、直接 URL を渡すと読み込み失敗する。
  // そのため asset URL から先に fetch → Blob URL に変換して PdfLoader に渡す。
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);
  const [pdfLoadingBlob, setPdfLoadingBlob] = useState(false);

  /** PDF Blob URL の生成 */
  useEffect(() => {
    if (!documentItem?.pdfPath) {
      queueMicrotask(() => {
        setPdfBlobUrl(null);
        setPdfLoadError(null);
      });
      return;
    }

    const pdfPath = documentItem.pdfPath;
    let cancelled = false;
    let objectUrl: string | null = null;

    /**
     * Tauri fs プラグインでファイルを直接読み取るフォールバック。
     * asset protocol が動作しない環境（スコープ未設定・WKWebView制限等）で使用。
     */
    const readViaFsPlugin = async (filePath: string): Promise<Blob> => {
      const { readFile } = await import("@tauri-apps/plugin-fs");
      const bytes = await readFile(filePath);
      return new Blob([bytes], { type: "application/pdf" });
    };

    const loadPdf = async () => {
      setPdfLoadingBlob(true);
      setPdfLoadError(null);

      try {
        if (isTauri) {
          let blob: Blob | null = null;

          // 方法1: convertFileSrc で asset URL を取得し、fetch → Blob URL
          try {
            const assetUrl = convertFileSrc(pdfPath);
            console.info("[ReaderView] PDF asset URL:", assetUrl);

            const response = await fetch(assetUrl);
            if (!response.ok && response.status !== 0) {
              throw new Error(`HTTP ${response.status} ${response.statusText}`);
            }

            blob = await response.blob();
            if (blob.size === 0) {
              throw new Error("PDF file is empty (0 bytes) via asset protocol");
            }

            // PDF の先頭バイトを検証
            const header = await blob.slice(0, 5).text();
            if (header !== "%PDF-") {
              throw new Error(`Invalid PDF header via asset protocol: ${JSON.stringify(header)}`);
            }
          } catch (assetErr) {
            // 方法2: Tauri fs プラグインで直接読み取り
            console.warn(
              "[ReaderView] Asset protocol failed, falling back to fs plugin:",
              assetErr instanceof Error ? assetErr.message : String(assetErr),
            );

            try {
              blob = await readViaFsPlugin(pdfPath);
              if (blob.size === 0) {
                throw new Error("PDF file is empty (0 bytes) via fs plugin", {
                  cause: assetErr,
                });
              }
              const header = await blob.slice(0, 5).text();
              if (header !== "%PDF-") {
                throw new Error(`Invalid PDF header via fs plugin: ${JSON.stringify(header)}`, {
                  cause: assetErr,
                });
              }
              console.info("[ReaderView] PDF loaded successfully via fs plugin fallback");
            } catch (fsErr) {
              // 両方失敗 — 元の asset protocol エラーと合わせて報告
              const assetMsg = assetErr instanceof Error ? assetErr.message : String(assetErr);
              const fsMsg = fsErr instanceof Error ? fsErr.message : String(fsErr);
              throw new Error(
                `Asset protocol: ${assetMsg} | FS plugin: ${fsMsg}`,
                { cause: fsErr },
              );
            }
          }

          if (blob) {
            objectUrl = URL.createObjectURL(
              new Blob([blob], { type: "application/pdf" }),
            );
          }
        } else {
          // 非 Tauri 環境（ブラウザプレビュー）: パスが https:// の場合はそのまま使用
          const path = pdfPath;
          if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("blob:")) {
            objectUrl = path;
          } else {
            // ローカルパス（モック環境）: Blob URL は作れないのでエラー
            throw new Error("Cannot load local PDF in browser preview");
          }
        }

        if (!cancelled && objectUrl) {
          setPdfBlobUrl(objectUrl);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[ReaderView] PDF Blob URL 生成失敗:", msg, {
            pdfPath: documentItem.pdfPath,
            isTauri,
          });
          setPdfLoadError(msg);
        }
      } finally {
        if (!cancelled) {
          setPdfLoadingBlob(false);
        }
      }
    };

    void loadPdf();

    return () => {
      cancelled = true;
      // Blob URL のクリーンアップ（非 Tauri のパススルー URL は revoke しない）
      if (objectUrl && objectUrl.startsWith("blob:")) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [documentItem?.pdfPath]);

  /** ハイライト追加ハンドラ */
  const handleAddHighlight = useCallback(
    (text: string, color: HighlightColor, page: number, rect: HighlightRect) => {
      void addHighlight(text, color, page, rect);
    },
    [addHighlight],
  );

  /** ページ変更ハンドラ */
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  /** ズーム変更ハンドラ */
  const handleZoomChange = useCallback((value: string) => {
    setZoomValue(value);
  }, []);

  /** ハイライト色変更ハンドラ */
  const handleColorChange = useCallback((color: HighlightColor) => {
    setSelectedColor(color);
  }, []);

  /** テキスト検索トグル */
  const handleToggleSearch = useCallback(() => {
    setSearchOpen((prev) => !prev);
  }, []);

  /** 右パネルカードクリック → PDF該当位置へスクロール */
  const handleScrollToPdf = useCallback(
    (highlight: Highlight) => {
      if (scrollToHighlightRef.current) {
        // PdfHighlight 形式に変換してスクロール
        const pdfHighlight: PdfHighlight = {
          id: highlight.id,
          content: { text: highlight.text },
          comment: { text: highlight.comment ?? "", emoji: "" },
          position: {
            boundingRect: {
              x1: highlight.rect.x1,
              y1: highlight.rect.y1,
              x2: highlight.rect.x2,
              y2: highlight.rect.y2,
              width: highlight.rect.x2 - highlight.rect.x1,
              height: highlight.rect.y2 - highlight.rect.y1,
              pageNumber: highlight.page,
            },
            rects: [
              {
                x1: highlight.rect.x1,
                y1: highlight.rect.y1,
                x2: highlight.rect.x2,
                y2: highlight.rect.y2,
                width: highlight.rect.x2 - highlight.rect.x1,
                height: highlight.rect.y2 - highlight.rect.y1,
                pageNumber: highlight.page,
              },
            ],
            pageNumber: highlight.page,
          },
          appColor: highlight.color,
          appPage: highlight.page,
        };
        scrollToHighlightRef.current(pdfHighlight);
        setScrolledToHighlightId(highlight.id);
        // 2秒後にハイライト表示を解除
        setTimeout(() => {
          setScrolledToHighlightId(null);
        }, 2000);
      }
    },
    [],
  );

  /** PDF上のハイライトクリック → 右パネルカードにスクロール */
  const handleHighlightClick = useCallback((highlightId: string) => {
    setScrolledToHighlightId(highlightId);
    // 2秒後にハイライト表示を解除
    setTimeout(() => {
      setScrolledToHighlightId(null);
    }, 2000);
  }, []);

  /** scrollRef がPdfViewerから準備された時のコールバック */
  const handleScrollRefReady = useCallback(
    (scrollTo: (highlight: PdfHighlight) => void) => {
      scrollToHighlightRef.current = scrollTo;
    },
    [],
  );

  /** ノート変換 → ノートエディタに遷移 */
  const handleCreateNoteFromSelected = useCallback(async (): Promise<
    string | null
  > => {
    const noteId = await createNoteFromSelected();
    if (noteId) {
      openNote(noteId);
    }
    return noteId;
  }, [createNoteFromSelected, openNote]);

  /** キーボードショートカット登録 */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // テキスト入力中は無視
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const isMod = e.metaKey || e.ctrlKey;

      // ← 前ページ
      if (e.key === "ArrowLeft" && !isMod) {
        e.preventDefault();
        if (currentPage > 1) {
          setCurrentPage((p) => p - 1);
        }
        return;
      }

      // → 次ページ
      if (e.key === "ArrowRight" && !isMod) {
        e.preventDefault();
        if (currentPage < totalPages) {
          setCurrentPage((p) => p + 1);
        }
        return;
      }

      // Cmd/Ctrl + F → テキスト検索
      if (isMod && e.key === "f") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
        return;
      }

      // 1〜4 → ハイライト色選択
      if (!isMod && !e.shiftKey && !e.altKey) {
        const color = getColorByShortcut(e.key);
        if (color) {
          e.preventDefault();
          setSelectedColor(color);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPage, totalPages]);

  // ローディング中
  if (documentLoading) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ animation: "spin 1s linear infinite" }}
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <span className="text-sm">{t.reader.str_2daabg}</span>
        </div>
      </div>
    );
  }

  // 論文が見つからない
  if (!documentItem) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="text-sm">{t.reader.str_lbfixv}</span>
        </div>
      </div>
    );
  }

  // PDF Blob ロード中
  if (documentItem?.pdfPath && pdfLoadingBlob) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ animation: "spin 1s linear infinite" }}
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <span className="text-sm">{t.reader.PDF}</span>
        </div>
      </div>
    );
  }

  // PDF Blob 生成エラー
  if (documentItem?.pdfPath && pdfLoadError) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ color: "var(--color-accent-danger)" }}
      >
        <div className="flex flex-col items-center gap-3" style={{ maxWidth: "440px" }}>
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <span className="text-sm">{t.reader.PDF_3}</span>
          <span
            className="text-xs text-center"
            style={{
              color: "var(--color-text-tertiary)",
              wordBreak: "break-all",
              maxWidth: "400px",
            }}
          >
            {pdfLoadError}
          </span>
          <span
            className="text-xs"
            style={{ color: "var(--color-text-disabled)" }}
          >
            Path: {documentItem.pdfPath}
          </span>
        </div>
      </div>
    );
  }

  // PDFパスが設定されていない
  if (!pdfBlobUrl) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        <div className="flex flex-col items-center gap-3">
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
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <p className="text-sm text-center">
            {t.reader.k_no_pdf_attached}
            <br />
            {t.reader.k_add_pdf_from_library}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ツールバー */}
      <HighlightToolbar
        currentPage={currentPage}
        totalPages={totalPages}
        zoomValue={zoomValue}
        selectedColor={selectedColor}
        onPageChange={handlePageChange}
        onZoomChange={handleZoomChange}
        onColorChange={handleColorChange}
        onToggleSearch={handleToggleSearch}
        paperTitle={documentItem.title}
      />

      {/* メインコンテンツ: PDFビューア（左） + ハイライトパネル（右） */}
      <div className="flex flex-1 overflow-hidden">
        {/* PDFビューア */}
        <div className="flex-1 overflow-hidden relative">
          <PdfViewer
            pdfUrl={pdfBlobUrl}
            highlights={highlights}
            onAddHighlight={handleAddHighlight}
            selectedColor={selectedColor}
            pdfScaleValue={zoomValue}
            onHighlightClick={handleHighlightClick}
            onScrollRefReady={handleScrollRefReady}
            onDocumentLoaded={setTotalPages}
          />

          {/* テキスト検索バー（検索オープン時のみ表示） */}
          {searchOpen && (
            <div
              className="absolute top-3 right-3 flex items-center gap-2"
              style={{
                backgroundColor: "var(--color-bg-secondary)",
                border: "1px solid var(--color-border-primary)",
                borderRadius: "10px",
                padding: "6px 10px",
                boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
                zIndex: 10,
              }}
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
                style={{ color: "var(--color-text-tertiary)" }}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder={t.reader.PDF_4}
                autoFocus
                className="text-sm"
                style={{
                  backgroundColor: "transparent",
                  color: "var(--color-text-primary)",
                  border: "none",
                  outline: "none",
                  width: "200px",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSearchOpen(false);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                style={{ color: "var(--color-text-tertiary)" }}
                aria-label={t.reader.str_ohq0c0}
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
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* ハイライトパネル（右 360px） */}
        <HighlightPanel
          highlights={highlights}
          isLoading={highlightsLoading}
          selectedHighlightIds={selectedHighlightIds}
          savingCommentIds={savingCommentIds}
          scrolledToHighlightId={scrolledToHighlightId}
          onScrollToPdf={handleScrollToPdf}
          onUpdateComment={updateComment}
          onDelete={deleteHighlight}
          onToggleSelect={toggleSelect}
          onClearSelection={clearSelection}
          onCreateNoteFromSelected={handleCreateNoteFromSelected}
          paperId={targetId}
          targetKind={targetKind}
          currentProjectId={sourceProjectId}
          defaultTab={initialPanelTab}
        />
      </div>
    </div>
  );
};
