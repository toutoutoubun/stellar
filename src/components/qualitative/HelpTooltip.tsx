// src/components/qualitative/HelpTooltip.tsx
// インフォメーション＆チュートリアル — 各タブのヘルプをインラインで表示
// 閉じた状態を localStorage で記憶する

import React, { useState, useCallback } from "react";
import { IconInfo, IconClose } from "./icons/QualIcons";
import { useT } from "../../stores/useI18nStore";

interface HelpTooltipProps {
  /** localStorage に保存するキー */
  storageKey: string;
  /** 見出し */
  title: string;
  /** 説明文（複数段落可） */
  paragraphs: string[];
  /** ステップ一覧（チュートリアル用） */
  steps?: string[];
}

export const HelpTooltip: React.FC<HelpTooltipProps> = ({
  storageKey,
  title,
  paragraphs,
  steps,
}) => {
  const t = useT();
  const lsKey = `stellar_help_dismissed_${storageKey}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(lsKey) === "1";
    } catch {
      return false;
    }
  });
  const [collapsed, setCollapsed] = useState(false);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(lsKey, "1");
    } catch { /* noop */ }
  }, [lsKey]);

  const handleReset = useCallback(() => {
    setDismissed(false);
    try {
      localStorage.removeItem(lsKey);
    } catch { /* noop */ }
  }, [lsKey]);

  if (dismissed) {
    return (
      <button
        type="button"
        onClick={handleReset}
        title={t.qualitative.k_9awj7k}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--color-text-tertiary)",
          padding: "2px",
          display: "inline-flex",
          alignItems: "center",
          opacity: 0.5,
          transition: "opacity 120ms",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.5"; }}
      >
        <IconInfo size={14} />
      </button>
    );
  }

  return (
    <div
      style={{
        backgroundColor: "var(--color-bg-tertiary)",
        borderRadius: "8px",
        border: "1px solid var(--color-border-secondary)",
        padding: collapsed ? "8px 12px" : "12px 16px",
        marginBottom: "12px",
        transition: "all 150ms ease-out",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
        }}
      >
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--color-accent-primary)",
            fontSize: "11px",
            fontWeight: 600,
            padding: 0,
          }}
        >
          <IconInfo size={14} />
          {title}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          title={t.qualitative.k_erv6ml}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--color-text-tertiary)",
            padding: "2px",
            display: "flex",
          }}
        >
          <IconClose size={12} />
        </button>
      </div>

      {!collapsed && (
        <div style={{ marginTop: "8px" }}>
          {paragraphs.map((p, i) => (
            <p
              key={i}
              style={{
                fontSize: "11px",
                color: "var(--color-text-secondary)",
                lineHeight: "1.6",
                margin: i > 0 ? "4px 0 0" : 0,
              }}
            >
              {p}
            </p>
          ))}
          {steps && steps.length > 0 && (
            <ol
              style={{
                margin: "8px 0 0",
                padding: "0 0 0 18px",
                fontSize: "11px",
                color: "var(--color-text-secondary)",
                lineHeight: "1.8",
              }}
            >
              {steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
};
