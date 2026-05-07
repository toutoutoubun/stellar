// src/components/reader/HighlightToolbar.tsx
// Stellar — PDFリーダーツールバー
// ページナビ、ズームコントロール、ハイライト色選択、テキスト検索ボタン

import type React from "react";
import { useCallback } from "react";
import type { HighlightColor } from "../../types";
import {
  HIGHLIGHT_COLOR_LIST,
  HIGHLIGHT_COLORS,
} from "../../utils/highlightColors";
import { useT } from "../../stores/useI18nStore";

/** ズームプリセット値（%） */
const ZOOM_PRESETS = [50, 75, 100, 125, 150] as const;

interface HighlightToolbarProps {
  /** 現在のページ番号 */
  currentPage: number;
  /** 総ページ数 */
  totalPages: number;
  /** 現在のズーム値（"auto" | "page-width" | 数値文字列） */
  zoomValue: string;
  /** 選択中のハイライト色 */
  selectedColor: HighlightColor;
  /** ページ変更コールバック */
  onPageChange: (page: number) => void;
  /** ズーム変更コールバック */
  onZoomChange: (value: string) => void;
  /** ハイライト色変更コールバック */
  onColorChange: (color: HighlightColor) => void;
  /** テキスト検索トグルコールバック */
  onToggleSearch: () => void;
  /** 論文タイトル（表示用） */
  paperTitle?: string;
}

export const HighlightToolbar: React.FC<HighlightToolbarProps> = ({
  currentPage,
  totalPages,
  zoomValue,
  selectedColor,
  onPageChange,
  onZoomChange,
  onColorChange,
  onToggleSearch,
  paperTitle,
}) => {
  const t = useT();
  /** 前のページへ移動 */
  const goToPrevPage = useCallback(() => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  }, [currentPage, onPageChange]);

  /** 次のページへ移動 */
  const goToNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  }, [currentPage, totalPages, onPageChange]);

  /** ズームイン */
  const zoomIn = useCallback(() => {
    const current = zoomValue === "page-width" ? 100 : Number(zoomValue) || 100;
    const nextPreset = ZOOM_PRESETS.find((p) => p > current);
    if (nextPreset) {
      onZoomChange(String(nextPreset));
    }
  }, [zoomValue, onZoomChange]);

  /** ズームアウト */
  const zoomOut = useCallback(() => {
    const current = zoomValue === "page-width" ? 100 : Number(zoomValue) || 100;
    const prevPreset = [...ZOOM_PRESETS].reverse().find((p) => p < current);
    if (prevPreset) {
      onZoomChange(String(prevPreset));
    }
  }, [zoomValue, onZoomChange]);

  /** 現在のズーム表示テキスト */
  const zoomDisplayText =
    zoomValue === "page-width" ? t.reader.str_jw4qi6 : `${zoomValue}%`;

  return (
    <header
      className="flex items-center gap-2 px-3 shrink-0 select-none"
      style={{
        height: "44px",
        backgroundColor: "var(--color-bg-secondary)",
        borderBottom: "1px solid var(--color-border-primary)",
      }}
    >
      {/* 論文タイトル（省略表示） */}
      {paperTitle && (
        <span
          className="text-xs truncate mr-2"
          style={{
            color: "var(--color-text-secondary)",
            maxWidth: "200px",
          }}
          title={paperTitle}
        >
          {paperTitle}
        </span>
      )}

      {/* セパレータ */}
      {paperTitle && (
        <div
          style={{
            width: "1px",
            height: "20px",
            backgroundColor: "var(--color-border-secondary)",
          }}
        />
      )}

      {/* ページナビゲーション */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={goToPrevPage}
          disabled={currentPage <= 1}
          className="flex items-center justify-center"
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "6px",
            color: "var(--color-text-secondary)",
            opacity: currentPage <= 1 ? 0.3 : 1,
            cursor: currentPage <= 1 ? "not-allowed" : "pointer",
          }}
          title={t.reader.str_ui6cdo}
          aria-label={t.reader.str_r1odzf}
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
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <span
          className="text-xs tabular-nums"
          style={{ color: "var(--color-text-secondary)", minWidth: "60px", textAlign: "center" }}
        >
          {currentPage} / {totalPages || "—"}
        </span>

        <button
          type="button"
          onClick={goToNextPage}
          disabled={currentPage >= totalPages}
          className="flex items-center justify-center"
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "6px",
            color: "var(--color-text-secondary)",
            opacity: currentPage >= totalPages ? 0.3 : 1,
            cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
          }}
          title={t.reader.str_uwj0fe}
          aria-label={t.reader.str_1004jb}
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
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* セパレータ */}
      <div
        style={{
          width: "1px",
          height: "20px",
          backgroundColor: "var(--color-border-secondary)",
        }}
      />

      {/* ズームコントロール */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={zoomOut}
          className="flex items-center justify-center"
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "6px",
            color: "var(--color-text-secondary)",
          }}
          title={t.settings.shortcuts.items.zoomOut}
          aria-label={t.settings.shortcuts.items.zoomOut}
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
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() =>
            onZoomChange(zoomValue === "page-width" ? "100" : "page-width")
          }
          className="text-xs"
          style={{
            color: "var(--color-text-secondary)",
            minWidth: "72px",
            textAlign: "center",
            padding: "2px 6px",
            borderRadius: "6px",
            border: "1px solid var(--color-border-secondary)",
            backgroundColor: "var(--color-bg-primary)",
          }}
          title={t.reader.str_hkiz09}
        >
          {zoomDisplayText}
        </button>

        <button
          type="button"
          onClick={zoomIn}
          className="flex items-center justify-center"
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "6px",
            color: "var(--color-text-secondary)",
          }}
          title={t.settings.shortcuts.items.zoomIn}
          aria-label={t.settings.shortcuts.items.zoomIn}
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
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* セパレータ */}
      <div
        style={{
          width: "1px",
          height: "20px",
          backgroundColor: "var(--color-border-secondary)",
        }}
      />

      {/* ハイライト色選択 */}
      <div className="flex items-center gap-1">
        {HIGHLIGHT_COLOR_LIST.map((colorConfig) => {
          const isSelected = selectedColor === colorConfig.key;
          return (
            <button
              key={colorConfig.key}
              type="button"
              onClick={() => onColorChange(colorConfig.key)}
              className="flex items-center justify-center"
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                border: isSelected
                  ? `2px solid ${colorConfig.borderColor}`
                  : "2px solid transparent",
                backgroundColor: isSelected
                  ? colorConfig.bg
                  : "transparent",
                transition: "border-color 150ms ease-out, background-color 150ms ease-out",
              }}
              title={`${colorConfig.label}（キー${colorConfig.shortcutKey}）`}
              aria-label={`ハイライト色: ${colorConfig.label}`}
              aria-pressed={isSelected}
            >
              <div
                style={{
                  width: "14px",
                  height: "14px",
                  borderRadius: "50%",
                  backgroundColor: HIGHLIGHT_COLORS[colorConfig.key].bgSolid,
                  border: `1px solid ${colorConfig.borderColor}`,
                }}
              />
            </button>
          );
        })}
      </div>

      {/* スペーサー */}
      <div className="flex-1" />

      {/* テキスト検索ボタン */}
      <button
        type="button"
        onClick={onToggleSearch}
        className="flex items-center justify-center"
        style={{
          width: "28px",
          height: "28px",
          borderRadius: "6px",
          color: "var(--color-text-secondary)",
        }}
        title={t.reader.Ctrl_F}
        aria-label={t.reader.str_6n944}
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
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </button>
    </header>
  );
};
