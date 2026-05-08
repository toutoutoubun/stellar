// src/components/reader/PdfViewer.tsx
// Stellar — PDFビューア
// react-pdf-highlighter v8 を使用した PDF 表示・ハイライト管理コンポーネント
// Tauri の convertFileSrc() でローカル file:// パスを変換して読み込む

import type React from "react";
import type { ReactElement } from "react";
import { useCallback, useRef, useMemo, useState } from "react";
import { isTauri } from "../../lib/tauriShim";
import {
  PdfLoader,
  PdfHighlighter,
  Highlight as PdfHighlightComponent,
  Popup,
} from "react-pdf-highlighter";
import "react-pdf-highlighter/dist/style.css";
import type {
  IHighlight,
  ScaledPosition,
} from "react-pdf-highlighter";

import type { Highlight, HighlightColor, HighlightRect } from "../../types";
import { HIGHLIGHT_COLORS } from "../../utils/highlightColors";
import { useI18nStore } from "../../stores/useI18nStore";

// pdfjs-dist のワーカーパス（react-pdf-highlighter v8 同梱の pdfjs-dist 4.4.168）
const PDF_WORKER_URL = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

/** アプリ内 Highlight → react-pdf-highlighter の IHighlight 形式に変換 */
export interface PdfHighlight extends IHighlight {
  /** アプリ内の色情報を保持 */
  appColor: HighlightColor;
  /** アプリ内のページ番号を保持 */
  appPage: number;
}

/** Stellar の Highlight → PdfHighlight に変換 */
function toPdfHighlight(h: Highlight): PdfHighlight {

  return {
    id: h.id,
    content: { text: h.text },
    comment: { text: h.comment ?? "", emoji: "" },
    position: {
      boundingRect: {
        x1: h.rect.x1,
        y1: h.rect.y1,
        x2: h.rect.x2,
        y2: h.rect.y2,
        width: h.rect.x2 - h.rect.x1,
        height: h.rect.y2 - h.rect.y1,
        pageNumber: h.page,
      },
      rects: [
        {
          x1: h.rect.x1,
          y1: h.rect.y1,
          x2: h.rect.x2,
          y2: h.rect.y2,
          width: h.rect.x2 - h.rect.x1,
          height: h.rect.y2 - h.rect.y1,
          pageNumber: h.page,
        },
      ],
      pageNumber: h.page,
    },
    appColor: h.color,
    appPage: h.page,
  };
}

interface PdfViewerProps {
  /** PDF の URL（convertFileSrc 変換済み or https） */
  pdfUrl: string;
  /** アプリ内のハイライト一覧 */
  highlights: Highlight[];
  /** ハイライト追加コールバック */
  onAddHighlight: (
    text: string,
    color: HighlightColor,
    page: number,
    rect: HighlightRect,
  ) => void;
  /** 現在選択中のハイライト色 */
  selectedColor: HighlightColor;
  /** PDF のスケール値 */
  pdfScaleValue: string;
  /** ハイライトクリック → 右パネルカードにスクロール */
  onHighlightClick: (highlightId: string) => void;
  /** scrollRef を親に渡すコールバック */
  onScrollRefReady: (scrollTo: (highlight: PdfHighlight) => void) => void;
}

/** ポップアップコンテンツ（ハイライトホバー時の表示） */
const HighlightPopup: React.FC<{
  comment: { text: string; emoji: string };
  color: HighlightColor;
}> = ({ comment, color }) => {
  const colorConfig = HIGHLIGHT_COLORS[color];
  if (!comment.text) return null;
  return (
    <div
      style={{
        backgroundColor: "#333",
        color: "#fff",
        padding: "6px 10px",
        borderRadius: "6px",
        fontSize: "12px",
        maxWidth: "240px",
        lineHeight: "1.5",
        borderLeft: `3px solid ${colorConfig.borderColor}`,
        boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
      }}
    >
      {comment.text}
    </div>
  );
};

export const PdfViewer: React.FC<PdfViewerProps> = ({
  pdfUrl,
  highlights,
  onAddHighlight,
  selectedColor,
  pdfScaleValue,
  onHighlightClick,
  onScrollRefReady,
}) => {
  const scrollViewerToRef = useRef<((highlight: PdfHighlight) => void) | null>(
    null,
  );
  const [retryKey, setRetryKey] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  /** アプリ内 Highlight → PdfHighlight 変換（メモ化） */
  const pdfHighlights = useMemo(
    () => highlights.map(toPdfHighlight),
    [highlights],
  );

  /** テキスト選択完了 → ハイライト追加 */
  const handleSelectionFinished = useCallback(
    (
      position: ScaledPosition,
      content: { text?: string; image?: string },
      hideTipAndSelection: () => void,
      _transformSelection: () => void, // eslint-disable-line @typescript-eslint/no-unused-vars
    ): ReactElement | null => {
      const text = content.text ?? "";
      if (!text.trim()) return null;

      const rect: HighlightRect = {
        x1: position.boundingRect.x1,
        y1: position.boundingRect.y1,
        x2: position.boundingRect.x2,
        y2: position.boundingRect.y2,
      };

      // 即時追加（Tip UI は表示せず直接ハイライト化）
      onAddHighlight(text, selectedColor, position.pageNumber, rect);
      hideTipAndSelection();
      return null;
    },
    [onAddHighlight, selectedColor],
  );

  /** scrollRef コールバック — 親コンポーネントに scrollTo 関数を渡す */
  const handleScrollRef = useCallback(
    (scrollTo: (highlight: PdfHighlight) => void) => {
      scrollViewerToRef.current = scrollTo;
      onScrollRefReady(scrollTo);
    },
    [onScrollRefReady],
  );

  /** スクロール変更時のハンドラ */
  const handleScrollChange = useCallback(() => {
    // ページ変更検知は PdfHighlighter 内部で行われる
    // 追加的なスクロール処理があればここに実装
  }, []);

  return (
    <div
      className="relative w-full h-full"
      style={{ backgroundColor: "var(--color-bg-tertiary)" }}
    >
      <PdfLoader
        key={retryKey}
        url={pdfUrl}
        workerSrc={PDF_WORKER_URL}
        beforeLoad={
          <div
            className="flex items-center justify-center h-full"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            <div className="flex flex-col items-center gap-3">
              {/* ローディングスピナー */}
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
              <span className="text-sm">{useI18nStore.getState().t.reader.PDF}</span>
            </div>
          </div>
        }
        onError={(error) => {
          const errMsg = error instanceof Error ? error.message : String(error);
          console.error("[PdfViewer] PDF読み込みエラー:", {
            url: pdfUrl,
            error: errMsg,
            isTauri,
            stack: error instanceof Error ? error.stack : undefined,
          });
          setLastError(errMsg);
        }}
        errorMessage={
          <div
            className="flex items-center justify-center h-full"
            style={{ color: "var(--color-accent-danger)" }}
          >
            <div className="flex flex-col items-center gap-3" style={{ maxWidth: "400px" }}>
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
              <span className="text-sm">{useI18nStore.getState().t.reader.PDF_3}</span>
              {lastError && (
                <span
                  className="text-xs text-center"
                  style={{
                    color: "var(--color-text-tertiary)",
                    wordBreak: "break-all",
                    maxWidth: "360px",
                  }}
                >
                  {lastError}
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setLastError(null);
                  setRetryKey((k) => k + 1);
                }}
                className="text-xs px-3 py-1.5 mt-1"
                style={{
                  backgroundColor: "var(--color-bg-tertiary)",
                  color: "var(--color-text-secondary)",
                  border: "1px solid var(--color-border-primary)",
                  borderRadius: "6px",
                  cursor: "pointer",
                  transition: "all var(--transition-fast)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
                  e.currentTarget.style.borderColor = "var(--color-accent-primary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--color-bg-tertiary)";
                  e.currentTarget.style.borderColor = "var(--color-border-primary)";
                }}
              >
                再読み込み
              </button>
            </div>
          </div>
        }
      >
        {(pdfDocument) => (
          <PdfHighlighter<PdfHighlight>
            pdfDocument={pdfDocument}
            enableAreaSelection={(event) => event.altKey}
            onScrollChange={handleScrollChange}
            pdfScaleValue={pdfScaleValue}
            scrollRef={handleScrollRef}
            onSelectionFinished={handleSelectionFinished}
            highlights={pdfHighlights}
            highlightTransform={(
              highlight,
              index,
              setTip,
              hideTip,
              _viewportToScaled,
              _screenshot,
              isScrolledTo,
            ) => {
              return (
                <Popup
                  popupContent={
                    <HighlightPopup
                      comment={highlight.comment}
                      color={highlight.appColor}
                    />
                  }
                  onMouseOver={(popupContent) =>
                    setTip(highlight, () => popupContent)
                  }
                  onMouseOut={hideTip}
                  key={index}
                >
                  <PdfHighlightComponent
                    isScrolledTo={isScrolledTo}
                    position={highlight.position}
                    comment={highlight.comment}
                    onClick={() => {
                      onHighlightClick(highlight.id);
                    }}
                  />
                </Popup>
              );
            }}
          />
        )}
      </PdfLoader>

      {/* ハイライト色のカスタムスタイル注入 */}
      <style>{`
        .Highlight__part {
          background-color: ${HIGHLIGHT_COLORS[selectedColor].bg} !important;
        }
        .Highlight--scrolledTo .Highlight__part {
          background-color: ${HIGHLIGHT_COLORS[selectedColor].bgSolid} !important;
        }
      `}</style>
    </div>
  );
};
