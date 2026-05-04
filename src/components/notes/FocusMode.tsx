// src/components/notes/FocusMode.tsx
// Stellar — フォーカスモード
// Cmd+Shift+F で起動、他のUIを非表示にしてエディタを中央配置
// マウスを上端に移動するとツールバーがフェードイン、ESC で通常モードに戻る

import type React from "react";
import { useState, useEffect, useCallback, useRef } from "react";

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
      {/* フェードインツールバー */}
      <header
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
        <div className="flex items-center gap-3">
          <span
            className="text-sm font-medium truncate"
            style={{
              color: "var(--color-text-primary)",
              maxWidth: "300px",
            }}
          >
            {noteTitle || "無題のノート"}
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
