// src/components/layout/Titlebar.tsx
// Stellar — カスタムタイトルバー
// Tauri の decorations: false に対応したドラッグ可能なタイトルバー
// ウィンドウ操作ボタン（最小化・最大化・閉じる）を含む

import type React from "react";
import { useCallback } from "react";
import { useUIStore } from "../../stores/useUIStore";
import { ThemeToggleButton } from "./ThemeToggleButton";
import { HelpButton } from "../ui/TutorialOverlay";
import { StellarIcon } from "../ui/StellarIcon";
import { getCurrentWindow } from "../../lib/tauriShim";
import { useT } from "../../stores/useI18nStore";

interface TitlebarProps {
  onOpenTutorial?: () => void;
}

export const Titlebar: React.FC<TitlebarProps> = ({ onOpenTutorial }) => {
  const t = useT();
  const toggleSearchModal = useUIStore((s) => s.toggleSearchModal);

  // getCurrentWindow() は tauriShim 経由で安全に呼び出す
  // 非 Tauri 環境では noop
  const handleMinimize = useCallback(async () => {
    const win = await getCurrentWindow();
    void win.minimize();
  }, []);

  const handleMaximize = useCallback(async () => {
    const win = await getCurrentWindow();
    void win.toggleMaximize();
  }, []);

  const handleClose = useCallback(async () => {
    const win = await getCurrentWindow();
    void win.close();
  }, []);

  return (
    <header
      data-tauri-drag-region
      className="flex items-center justify-between shrink-0 select-none"
      style={{
        height: "var(--titlebar-height)",
        backgroundColor: "var(--color-bg-titlebar)",
        borderBottom: "1px solid var(--color-border-secondary)",
        boxShadow: "var(--shadow-titlebar)",
        zIndex: "var(--z-titlebar)",
        paddingLeft: "var(--space-4)",
        paddingRight: "var(--space-2)",
      }}
    >
      {/* 左側: アプリロゴ & タイトル */}
      <div className="flex items-center gap-2" data-tauri-drag-region>
        <StellarIcon size={20} />
        <span
          className="text-sm font-semibold"
          style={{ color: "var(--color-text-primary)" }}
          data-tauri-drag-region
        >
          Stellar
        </span>
      </div>

      {/* 中央: 検索バー（クリックで検索モーダルを開く） */}
      <button
        onClick={toggleSearchModal}
        className="flex items-center gap-2 px-3 py-1 text-xs"
        style={{
          backgroundColor: "var(--color-bg-tertiary)",
          color: "var(--color-text-tertiary)",
          borderRadius: "var(--radius-input)",
          border: "1px solid var(--color-border-secondary)",
          minWidth: "240px",
          transition: "all var(--transition-fast)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--color-border-focus)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--color-border-secondary)";
        }}
      >
        {/* 検索アイコン */}
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
        <span>{t.layout.str_kn3fs}</span>
        <kbd
          className="ml-auto text-xs px-1 py-0.5"
          style={{
            backgroundColor: "var(--color-bg-hover)",
            borderRadius: "4px",
            color: "var(--color-text-tertiary)",
            fontSize: "10px",
          }}
        >
          Ctrl+K
        </kbd>
      </button>

      {/* 右側: テーマ切替 & ウィンドウ操作ボタン */}
      <div className="flex items-center">
        {/* ヘルプボタン */}
        {onOpenTutorial && <HelpButton onClick={onOpenTutorial} />}

        {/* テーマ切替ボタン */}
        <ThemeToggleButton />

        {/* セパレーター */}
        <div
          className="w-px h-4 mx-1"
          style={{ backgroundColor: "var(--color-border-secondary)" }}
        />

        {/* 最小化ボタン */}
        <button
          onClick={handleMinimize}
          className="flex items-center justify-center w-8 h-8"
          style={{
            borderRadius: "var(--radius-button)",
            color: "var(--color-text-secondary)",
            transition: "all var(--transition-fast)",
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
            <rect
              x="2"
              y="5.5"
              width="8"
              height="1"
              fill="currentColor"
              rx="0.5"
            />
          </svg>
        </button>

        {/* 最大化ボタン */}
        <button
          onClick={handleMaximize}
          className="flex items-center justify-center w-8 h-8"
          style={{
            borderRadius: "var(--radius-button)",
            color: "var(--color-text-secondary)",
            transition: "all var(--transition-fast)",
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
            <rect
              x="2"
              y="2"
              width="8"
              height="8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              rx="1"
            />
          </svg>
        </button>

        {/* 閉じるボタン */}
        <button
          onClick={handleClose}
          className="flex items-center justify-center w-8 h-8"
          style={{
            borderRadius: "var(--radius-button)",
            color: "var(--color-text-secondary)",
            transition: "all var(--transition-fast)",
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
            <line
              x1="3"
              y1="3"
              x2="9"
              y2="9"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <line
              x1="9"
              y1="3"
              x2="3"
              y2="9"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </header>
  );
};
