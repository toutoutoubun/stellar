// src/components/ui/Toast.tsx
// Stellar — トースト通知コンポーネント
// 操作結果のフィードバック（成功・エラー・情報）を画面右下に表示する
// 自動消去タイマー付き

import type React from "react";
import { useState, useEffect, useCallback } from "react";
import { clsx } from "clsx";
import { useT } from "../../stores/useI18nStore";

/** トーストの種別 */
type ToastType = "success" | "error" | "info" | "warning";

/** トーストアイテム */
interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

/** トーストの種別ごとのスタイル */
const typeStyles: Record<ToastType, { bg: string; border: string; icon: React.ReactNode }> = {
  success: {
    bg: "var(--color-accent-secondary)",
    border: "var(--color-accent-secondary)",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  error: {
    bg: "var(--color-accent-danger)",
    border: "var(--color-accent-danger)",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
  },
  info: {
    bg: "var(--color-accent-info)",
    border: "var(--color-accent-info)",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  },
  warning: {
    bg: "var(--color-accent-warning)",
    border: "var(--color-accent-warning)",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
};

// ============================================================
// トースト管理のシングルトン（Zustand 外でシンプルに管理）
// ============================================================

type ToastListener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
let listeners: ToastListener[] = [];
let counter = 0;

const emitChange = () => {

  listeners.forEach((listener) => listener([...toasts]));
};

/** トーストを表示する（アプリ内どこからでも呼び出し可能） */
export const toast = {
  show: (type: ToastType, message: string, duration = 4000) => {
    const id = `toast-${++counter}`;
    toasts = [...toasts, { id, type, message, duration }];
    emitChange();

    // 自動消去
    if (duration > 0) {
      setTimeout(() => {
        toast.dismiss(id);
      }, duration);
    }
  },
  success: (message: string, duration?: number) =>
    toast.show("success", message, duration),
  error: (message: string, duration?: number) =>
    toast.show("error", message, duration),
  info: (message: string, duration?: number) =>
    toast.show("info", message, duration),
  warning: (message: string, duration?: number) =>
    toast.show("warning", message, duration),
  dismiss: (id: string) => {
    toasts = toasts.filter((t) => t.id !== id);
    emitChange();
  },
  /** リスナーを登録する（コンポーネント内から呼び出す） */
  subscribe: (listener: ToastListener) => {
    listeners = [...listeners, listener];
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },
};

// ============================================================
// トーストコンテナコンポーネント（App.tsx に配置する）
// ============================================================

export const ToastContainer: React.FC = () => {
  const t = useT();
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    return toast.subscribe(setItems);
  }, []);

  const handleDismiss = useCallback((id: string) => {
    toast.dismiss(id);
  }, []);

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 right-4 flex flex-col gap-2"
      style={{ zIndex: "var(--z-toast)", maxWidth: "380px" }}
    >
      {items.map((item) => {
        const styles = typeStyles[item.type];
        return (
          <div
            key={item.id}
            className={clsx(
              "flex items-start gap-3 px-4 py-3 text-sm animate-slide-in-right"
            )}
            style={{
              backgroundColor: "var(--color-bg-card)",
              borderRadius: "var(--radius-card)",
              boxShadow: "var(--shadow-dropdown)",
              borderLeft: `3px solid ${styles.border}`,
              color: "var(--color-text-primary)",
            }}
            role="alert"
          >
            {/* アイコン */}
            <span
              className="shrink-0 mt-0.5"
              style={{ color: styles.bg }}
            >
              {styles.icon}
            </span>

            {/* メッセージ */}
            <span
              className="flex-1"
              style={{ lineHeight: "var(--line-height-normal)" }}
            >
              {item.message}
            </span>

            {/* 閉じるボタン */}
            <button
              onClick={() => handleDismiss(item.id)}
              className="shrink-0 mt-0.5"
              style={{
                color: "var(--color-text-tertiary)",
                transition: "color var(--transition-fast)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--color-text-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--color-text-tertiary)";
              }}
              aria-label={t.common.close}
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
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
};
