// src/components/reader/ReaderView.tsx
// Stellar — PDFリーダー画面
// paperId を受け取り、paper と highlights を取得
// 左右2カラムレイアウト（PDF + ハイライトパネル）
// キーボードショートカット: ←/→ ページ、Cmd/Ctrl+F 検索、1-4 色選択

import type React from "react";
import { useState, useCallback, useEffect, useRef } from "react";

import { invoke, convertFileSrc } from "../../lib/tauriShim";

import type { Paper, Highlight, HighlightColor, HighlightRect } from "../../types";
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
  paperId: string;
}

export const ReaderView: React.FC<ReaderViewProps> = ({ paperId }) => {
  const t = useT();
  // 論文データ
  const [paper, setPaper] = useState<Paper | null>(null);
  const [paperLoading, setPaperLoading] = useState(true);

  // PDFビューア状態
  const [currentPage, setCurrentPage] = useState(1);
  // totalPages は HighlightToolbar に渡すが、現時点では PdfHighlighter から
  // 直接ページ数を取得する API がないため、0 のまま保持する
  const [totalPages] = useState(0);
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
  } = useHighlights(paperId);

  // UIストア（ノートエディタへの遷移用）
  const openNote = useUIStore((s) => s.openNote);

  // PdfHighlighter の scrollTo 関数への参照
  const scrollToHighlightRef = useRef<((highlight: PdfHighlight) => void) | null>(
    null,
  );

  /** 論文データの取得 */
  useEffect(() => {
    let cancelled = false;
    const fetchPaper = async () => {
      setPaperLoading(true);
      try {
        const result = await invoke<Paper>("get_paper", { id: paperId });
        if (!cancelled) {
          setPaper(result);
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            typeof err === "string" ? err : t.reader.str_f6z3i6;
          toast.error(message);
        }
      } finally {
        if (!cancelled) {
          setPaperLoading(false);
        }
      }
    };
    void fetchPaper();
    return () => {
      cancelled = true;
    };
  }, [paperId]);

  /** PDF URL の生成（Tauri の convertFileSrc でローカルファイルを変換） */
  const pdfUrl = paper?.pdfPath ? convertFileSrc(paper.pdfPath) : null;

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
  if (paperLoading) {
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
  if (!paper) {
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

  // PDFパスが設定されていない
  if (!pdfUrl) {
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
            この論文にはPDFが添付されていません。
            <br />
            ライブラリからPDFを追加してください。
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
        paperTitle={paper.title}
      />

      {/* メインコンテンツ: PDFビューア（左） + ハイライトパネル（右） */}
      <div className="flex flex-1 overflow-hidden">
        {/* PDFビューア */}
        <div className="flex-1 overflow-hidden relative">
          <PdfViewer
            pdfUrl={pdfUrl}
            highlights={highlights}
            onAddHighlight={handleAddHighlight}
            selectedColor={selectedColor}
            pdfScaleValue={zoomValue}
            onHighlightClick={handleHighlightClick}
            onScrollRefReady={handleScrollRefReady}
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
          paperId={paperId}
        />
      </div>
    </div>
  );
};
