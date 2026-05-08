// src/components/layout/Titlebar.tsx
// Stellar — カスタムタイトルバー
// Tauri の decorations: false に対応したドラッグ可能なタイトルバー
// 改善: 検索バーをより目立たせ、ウィンドウ操作ボタンを洗練

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
      <div className="flex items-center gap-2.5" data-tauri-drag-region>
        <StellarIcon size={20} />
        <span
          className="text-sm font-semibold tracking-tight"
          style={{
            color: "var(--color-text-primary)",
            letterSpacing: "-0.01em",
          }}
          data-tauri-drag-region
        >
          Stellar
        </span>
      </div>

      {/* 中央: 検索バー — クリックで検索モーダルを開く */}
      <button
        onClick={toggleSearchModal}
        className="flex items-center gap-2.5 px-3"
        style={{
          backgroundColor: "var(--color-bg-tertiary)",
          color: "var(--color-text-tertiary)",
          borderRadius: "var(--radius-input)",
          border: "1px solid var(--color-border-secondary)",
          minWidth: "260px",
          height: "28px",
          transition: "all var(--transition-fast)",
          fontSize: "var(--font-size-xs)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--color-border-focus)";
          e.currentTarget.style.backgroundColor = "var(--color-bg-input)";
          e.currentTarget.style.boxShadow = "0 0 0 3px var(--color-bg-selection)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--color-border-secondary)";
          e.currentTarget.style.backgroundColor = "var(--color-bg-tertiary)";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        {/* 検索アイコン */}
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.6 }}
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span style={{ opacity: 0.8 }}>{t.layout.str_kn3fs}</span>
        <span className="kbd-hint ml-auto">
          <span style={{ fontSize: "9px" }}>&#8984;</span>K
        </span>
      </button>

      {/* 右側: ヘルプ / テーマ / ウィンドウ操作ボタン */}
      <div className="flex items-center gap-0.5">
        {/* ヘルプボタン */}
        {onOpenTutorial && <HelpButton onClick={onOpenTutorial} />}

        {/* テーマ切替ボタン */}
        <ThemeToggleButton />

        {/* セパレーター */}
        <div
          className="w-px mx-1.5"
          style={{
            height: "14px",
            backgroundColor: "var(--color-border-secondary)",
          }}
        />

        {/* ウィンドウ操作ボタン — macOS 風の丸ボタン */}
        <div className="flex items-center gap-1.5 px-1">
          {/* 最小化 */}
          <button
            onClick={handleMinimize}
            className="flex items-center justify-center"
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "var(--radius-button)",
              color: "var(--color-text-tertiary)",
              transition: "all var(--transition-fast)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
              e.currentTarget.style.color = "var(--color-text-secondary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--color-text-tertiary)";
            }}
            title={t.layout.str_fj8br}
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect x="2" y="5.5" width="8" height="1" fill="currentColor" rx="0.5" />
            </svg>
          </button>

          {/* 最大化 */}
          <button
            onClick={handleMaximize}
            className="flex items-center justify-center"
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "var(--radius-button)",
              color: "var(--color-text-tertiary)",
              transition: "all var(--transition-fast)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
              e.currentTarget.style.color = "var(--color-text-secondary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--color-text-tertiary)";
            }}
            title={t.layout.str_fiqj3}
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect x="2" y="2" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1" rx="1.5" />
            </svg>
          </button>

          {/* 閉じる */}
          <button
            onClick={handleClose}
            className="flex items-center justify-center"
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "var(--radius-button)",
              color: "var(--color-text-tertiary)",
              transition: "all var(--transition-fast)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-accent-danger)";
              e.currentTarget.style.color = "var(--color-text-inverse)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--color-text-tertiary)";
            }}
            title={t.common.close}
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <line x1="3" y1="3" x2="9" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="9" y1="3" x2="3" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
};
