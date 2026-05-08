// src/components/ui/Modal.tsx
// Stellar — モーダルコンポーネント
// 改善: backdrop-blur 強化、スムーズなスケールイン、ヘッダーの視覚階層

import type React from "react";
import { useEffect, useCallback, useRef } from "react";
import { clsx } from "clsx";
import { useT } from "../../stores/useI18nStore";

interface ModalProps {
  /** モーダルの表示状態 */
  open: boolean;
  /** モーダルを閉じるコールバック */
  onClose: () => void;
  /** モーダルのタイトル */
  title?: string;
  /** タイトル左のアイコン */
  titleIcon?: React.ReactNode;
  /** モーダルの幅 */
  width?: string;
  /** 子要素 */
  children: React.ReactNode;
  /** フッター要素 */
  footer?: React.ReactNode;
  /** オーバーレイクリックで閉じるか */
  closeOnOverlayClick?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  titleIcon,
  width = "480px",
  children,
  footer,
  closeOnOverlayClick = true,
}) => {
  const t = useT();
  const modalRef = useRef<HTMLDivElement>(null);

  // ESC キーで閉じる
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      // モーダル表示時にフォーカスをモーダル内に移動
      modalRef.current?.focus();
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, handleKeyDown]);

  if (!open) {
    return null;
  }

  return (
    <>
      {/* オーバーレイ */}
      <div
        className="fixed inset-0 animate-fade-in"
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.45)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          zIndex: "var(--z-modal-overlay)",
        }}
        onClick={closeOnOverlayClick ? onClose : undefined}
        aria-hidden="true"
      />

      {/* モーダル本体 */}
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ zIndex: "var(--z-modal)", pointerEvents: "none" }}
      >
        <div
          ref={modalRef}
          className={clsx("flex flex-col animate-scale-in")}
          style={{
            width,
            maxWidth: "90vw",
            maxHeight: "85vh",
            backgroundColor: "var(--color-bg-modal)",
            borderRadius: "var(--radius-modal)",
            boxShadow: "var(--shadow-modal)",
            border: "1px solid var(--color-border-secondary)",
            pointerEvents: "auto",
            outline: "none",
            overflow: "hidden",
          }}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
        >
          {/* ヘッダー */}
          {title && (
            <div
              className="flex items-center justify-between shrink-0"
              style={{
                padding: "var(--space-4) var(--space-6)",
                borderBottom: "1px solid var(--color-border-secondary)",
                backgroundColor: "var(--color-bg-secondary)",
              }}
            >
              <div className="flex items-center gap-2.5">
                {titleIcon && (
                  <span
                    className="flex items-center justify-center shrink-0"
                    style={{ color: "var(--color-accent-primary)" }}
                  >
                    {titleIcon}
                  </span>
                )}
                <h2
                  className="font-semibold"
                  style={{
                    color: "var(--color-text-primary)",
                    fontSize: "var(--font-size-md)",
                  }}
                >
                  {title}
                </h2>
              </div>
              <button
                onClick={onClose}
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
                aria-label={t.common.close}
              >
                <svg
                  width="16"
                  height="16"
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

          {/* コンテンツ */}
          <div
            className="flex-1 overflow-y-auto selectable"
            style={{
              padding: "var(--space-5) var(--space-6)",
            }}
            data-selectable="true"
          >
            {children}
          </div>

          {/* フッター */}
          {footer && (
            <div
              className="flex items-center justify-end gap-2 shrink-0"
              style={{
                padding: "var(--space-3) var(--space-6)",
                borderTop: "1px solid var(--color-border-secondary)",
                backgroundColor: "var(--color-bg-secondary)",
              }}
            >
              {footer}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
