// src/components/notes/FocusMode.tsx
// Stellar — フォーカスモード
// Cmd+Shift+F で起動、他のUIを非表示にしてエディタを中央配置
// マウスを上端に移動するとツールバーがフェードイン、ESC で通常モードに戻る

import type React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useT } from "../../stores/useI18nStore";

interface FocusModeProps {
  /** フォーカスモードのON/OFF */
  active: boolean;
  /** フォーカスモード終了コールバック */
  onExit: () => void;
  /** ノートタイトル（ツールバー表示用） */
  noteTitle: string;
  /** 文字数 */
  charCount: number;
  /** 最終保存時刻 */
  lastSavedAt: string | null;
  /** エディタ要素（children） */
  children: React.ReactNode;
}

export const FocusMode: React.FC<FocusModeProps> = ({
  active,
  onExit,
  noteTitle,
  charCount,
  lastSavedAt,
  children,
}) => {
  const t = useT();
  const [toolbarVisible, setToolbarVisible] = useState(false);
  const toolbarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** マウス位置に応じてツールバーを表示/非表示 */
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!active) return;
      // 上端40px以内でツールバー表示
      if (e.clientY <= 40) {
        setToolbarVisible(true);
        if (toolbarTimerRef.current) {
          clearTimeout(toolbarTimerRef.current);
          toolbarTimerRef.current = null;
        }
      } else if (toolbarVisible) {
        // 上端を離れたら2秒後に非表示
        if (!toolbarTimerRef.current) {
          toolbarTimerRef.current = setTimeout(() => {
            setToolbarVisible(false);
            toolbarTimerRef.current = null;
          }, 2000);
        }
      }
    },
    [active, toolbarVisible],
  );

  /** ESC キーで通常モードに戻る */
  useEffect(() => {
    if (!active) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onExit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, onExit]);

  /** マウスイベントの登録 */
  useEffect(() => {
    if (!active) return;
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [active, handleMouseMove]);

  /** フォーカスモード終了時にクリーンアップ */
  useEffect(() => {
    if (!active) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- legitimate data sync/fetch pattern
      setToolbarVisible(false);
      if (toolbarTimerRef.current) {
        clearTimeout(toolbarTimerRef.current);
        toolbarTimerRef.current = null;
      }
    }
  }, [active]);

  if (!active) return null;

  return (
    <div
      className="fixed inset-0 flex flex-col items-center"
      style={{
        backgroundColor: "var(--color-bg-primary)",
        zIndex: 9999,
      }}
    >
      {/* フェードインツールバー — ドラッグ可能 */}
      <header
        data-tauri-drag-region
        className="fixed top-0 left-0 right-0 flex items-center justify-between px-6"
        style={{
          height: "44px",
          backgroundColor: "var(--color-bg-secondary)",
          borderBottom: "1px solid var(--color-border-primary)",
          opacity: toolbarVisible ? 1 : 0,
          transform: toolbarVisible ? "translateY(0)" : "translateY(-100%)",
          transition: "opacity 250ms ease-out, transform 250ms ease-out",
          zIndex: 10000,
          pointerEvents: toolbarVisible ? "auto" : "none",
        }}
      >
        <div className="flex items-center gap-3" style={{ minWidth: 0, flex: 1 }} data-tauri-drag-region>
          <span
            className="text-sm font-medium"
            style={{
              color: "var(--color-text-primary)",
              maxWidth: "300px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            data-tauri-drag-region
          >
            {noteTitle || t.notes.untitled}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* 文字数 */}
          <span
            className="text-xs"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {charCount.toLocaleString()}文字
          </span>

          {/* 最終保存時刻 */}
          {lastSavedAt && (
            <span
              className="text-xs"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              保存: {lastSavedAt}
            </span>
          )}

          {/* 終了ボタン */}
          <button
            type="button"
            onClick={onExit}
            className="flex items-center gap-1.5 text-xs"
            style={{
              color: "var(--color-text-secondary)",
              padding: "4px 10px",
              borderRadius: "6px",
              border: "1px solid var(--color-border-secondary)",
              backgroundColor: "var(--color-bg-primary)",
            }}
          >
            <kbd
              style={{
                fontSize: "10px",
                padding: "1px 4px",
                borderRadius: "3px",
                backgroundColor: "var(--color-bg-tertiary)",
                border: "1px solid var(--color-border-secondary)",
              }}
            >
              ESC
            </kbd>
            終了
          </button>

          {/* セパレーター */}
          <div
            className="w-px h-4"
            style={{ backgroundColor: "var(--color-border-secondary)" }}
          />

          {/* ウィンドウ操作: 最小化 */}
          <button
            type="button"
            onClick={async () => {
              const { getCurrentWindow } = await import("../../lib/tauriShim");
              void (await getCurrentWindow()).minimize();
            }}
            className="flex items-center justify-center"
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              color: "var(--color-text-secondary)",
              transition: "all 150ms ease-out",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
            title={t.layout.str_fj8br}
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect x="2" y="5.5" width="8" height="1" fill="currentColor" rx="0.5" />
            </svg>
          </button>

          {/* ウィンドウ操作: 最大化 */}
          <button
            type="button"
            onClick={async () => {
              const { getCurrentWindow } = await import("../../lib/tauriShim");
              void (await getCurrentWindow()).toggleMaximize();
            }}
            className="flex items-center justify-center"
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              color: "var(--color-text-secondary)",
              transition: "all 150ms ease-out",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
            title={t.layout.str_fiqj3}
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect x="2" y="2" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1" rx="1" />
            </svg>
          </button>

          {/* ウィンドウ操作: 閉じる */}
          <button
            type="button"
            onClick={async () => {
              const { getCurrentWindow } = await import("../../lib/tauriShim");
              void (await getCurrentWindow()).close();
            }}
            className="flex items-center justify-center"
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              color: "var(--color-text-secondary)",
              transition: "all 150ms ease-out",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-accent-danger)";
              e.currentTarget.style.color = "var(--color-text-inverse)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--color-text-secondary)";
            }}
            title={t.common.close}
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <line x1="3" y1="3" x2="9" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="9" y1="3" x2="3" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      {/* エディタ中央配置 */}
      <div
        className="flex-1 w-full overflow-auto"
        style={{
          maxWidth: "720px",
          paddingTop: "64px",
          paddingBottom: "64px",
        }}
      >
        {children}
      </div>
    </div>
  );
};
