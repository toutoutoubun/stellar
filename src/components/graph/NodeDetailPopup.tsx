// src/components/graph/NodeDetailPopup.tsx
// Stellar — ノードホバー時のポップアップ
// マウス位置付近に表示、300ms遅延、キャンバス端での自動反転

import type React from "react";
import { useState, useEffect, useRef } from "react";
import type { GraphNodeExtended } from "../../types";

/**
 * ローカル Badge コンポーネント。
 * ── ../ui/Badge からの import を避けるためにここでインライン定義。
 * 理由: Badge は index チャンクに配置され、GraphView チャンクからの
 * 静的 import が循環依存（index →(lazy) GraphView →(static) index）を
 * 形成し、Safari WKWebView でクラッシュを引き起こすため。
 */
const LocalBadge: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <span
    className="inline-flex items-center text-xs font-medium select-none"
    style={{
      backgroundColor: "var(--color-tag-bg)",
      color: "var(--color-tag-text)",
      border: "1px solid var(--color-tag-border)",
      borderRadius: "var(--radius-tag)",
      padding: "2px 8px",
      lineHeight: "1.4",
      whiteSpace: "nowrap",
      ...style,
    }}
  >
    <span>{children}</span>
  </span>
);

interface NodeDetailPopupProps {
  /** 表示対象ノード（nullで非表示） */
  node: GraphNodeExtended | null;
  /** マウスのX座標 */
  mouseX: number;
  /** マウスのY座標 */
  mouseY: number;
  /** コンテナ幅（自動反転用） */
  containerWidth: number;
  /** コンテナ高さ */
  containerHeight: number;
}

/** 日付フォーマット */
function formatDate(isoStr: string): string {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export const NodeDetailPopup: React.FC<NodeDetailPopupProps> = ({
  node,
  mouseX,
  mouseY,
  containerWidth,
  containerHeight,
}) => {
  const [visibleNode, setVisibleNode] = useState<GraphNodeExtended | null>(
    null,
  );
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 300ms 遅延で表示
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (node) {
      timerRef.current = setTimeout(() => {
        setVisibleNode(node);
        setIsVisible(true);
      }, 300);
    } else {
      setIsVisible(false);
      // フェードアウト後にノードをクリア
      const hideTimer = setTimeout(() => {
        setVisibleNode(null);
      }, 150);
      return () => clearTimeout(hideTimer);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [node]);

  if (!visibleNode) return null;

  // ポップアップサイズの推定値
  const popupWidth = 240;
  const popupHeight = 120;
  const offset = 16;

  // キャンバス端に近い場合は反対側に表示
  let left = mouseX + offset;
  let top = mouseY + offset;

  if (left + popupWidth > containerWidth - 20) {
    left = mouseX - popupWidth - offset;
  }
  if (top + popupHeight > containerHeight - 20) {
    top = mouseY - popupHeight - offset;
  }
  if (left < 20) left = 20;
  if (top < 20) top = 20;

  return (
    <div
      style={{
        position: "absolute",
        left: `${left}px`,
        top: `${top}px`,
        zIndex: 100,
        pointerEvents: "none",
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(4px)",
        transition: "opacity 150ms ease-out, transform 150ms ease-out",
      }}
    >
      <div
        style={{
          backgroundColor: "var(--color-bg-card)",
          border: "1px solid var(--color-border-primary)",
          borderRadius: "12px",
          boxShadow: "var(--shadow-dropdown)",
          padding: "12px 16px",
          minWidth: "200px",
          maxWidth: "280px",
        }}
      >
        {/* アイコン + タイトル */}
        <div className="flex items-start gap-2 mb-2">
          <span style={{ lineHeight: 1, flexShrink: 0, color: "var(--color-text-secondary)" }}>
            {visibleNode.type === "note" ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            )}
          </span>
          <span
            className="text-sm font-medium"
            style={{
              color: "var(--color-text-primary)",
              lineHeight: "1.3",
              wordBreak: "break-all",
            }}
          >
            {visibleNode.name || "無題"}
          </span>
        </div>

        {/* タグ */}
        {visibleNode.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {visibleNode.tags.slice(0, 4).map((tag) => (
              <LocalBadge
                key={tag}
                style={{ fontSize: "9px", padding: "0 5px", lineHeight: "16px" }}
              >
                {tag}
              </LocalBadge>
            ))}
            {visibleNode.tags.length > 4 && (
              <span
                className="text-xs"
                style={{ color: "var(--color-text-tertiary)", fontSize: "9px" }}
              >
                +{visibleNode.tags.length - 4}
              </span>
            )}
          </div>
        )}

        {/* メタ情報 */}
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span
              className="text-xs"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              リンク数:
            </span>
            <span
              className="text-xs font-medium"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {visibleNode.linkCount}
            </span>
          </div>
          {visibleNode.updatedAt && (
            <div className="flex items-center gap-2">
              <span
                className="text-xs"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                最終更新:
              </span>
              <span
                className="text-xs"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {formatDate(visibleNode.updatedAt)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
