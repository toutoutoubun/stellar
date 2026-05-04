// src/components/ui/Modal.tsx
// Stellar — モーダルコンポーネント
// オーバーレイ付きのモーダルダイアログ
// ESC キーで閉じる・オーバーレイクリックで閉じる対応

import type React from "react";
import { useEffect, useCallback, useRef } from "react";
import { clsx } from "clsx";

interface ModalProps {
  /** モーダルの表示状態 */
  open: boolean;
  /** モーダルを閉じるコールバック */
  onClose: () => void;
  /** モーダルのタイトル */
  title?: string;
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
  width = "480px",
  children,
  footer,
  closeOnOverlayClick = true,
}) => {
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
          backgroundColor: "rgba(0, 0, 0, 0.4)",
          backdropFilter: "blur(4px)",
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
            maxHeight: "80vh",
            backgroundColor: "var(--color-bg-modal)",
            borderRadius: "var(--radius-modal)",
            boxShadow: "var(--shadow-modal)",
            border: "1px solid var(--color-border-secondary)",
            pointerEvents: "auto",
            outline: "none",
          }}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
        >
          {/* ヘッダー */}
          {title && (
            <div
              className="flex items-center justify-between px-6 py-4 shrink-0"
              style={{
                borderBottom: "1px solid var(--color-border-secondary)",
              }}
            >
              <h2
                className="text-base font-semibold"
                style={{ color: "var(--color-text-primary)" }}
              >
                {title}
              </h2>
              <button
                onClick={onClose}
                className="flex items-center justify-center w-7 h-7"
                style={{
                  borderRadius: "var(--radius-button)",
                  color: "var(--color-text-tertiary)",
                  transition: "all var(--transition-fast)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    "var(--color-bg-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
                aria-label="閉じる"
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
            className="flex-1 overflow-y-auto px-6 py-4 selectable"
            data-selectable="true"
          >
            {children}
          </div>

          {/* フッター */}
          {footer && (
            <div
              className="flex items-center justify-end gap-2 px-6 py-4 shrink-0"
              style={{
                borderTop: "1px solid var(--color-border-secondary)",
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
