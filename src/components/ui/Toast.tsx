/* eslint-disable react-refresh/only-export-components */
// src/components/ui/Toast.tsx
// Stellar — トースト通知コンポーネント
// 改善: 自動消去プログレスバー、スライドイン/アウトアニメーション、ホバー時一時停止

import type React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
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
const typeStyles: Record<ToastType, { color: string; icon: React.ReactNode }> = {
  success: {
    color: "var(--color-accent-secondary)",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  error: {
    color: "var(--color-accent-danger)",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
  },
  info: {
    color: "var(--color-accent-info)",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  },
  warning: {
    color: "var(--color-accent-warning)",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
};

// ============================================================
// トースト管理のシングルトン
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
  subscribe: (listener: ToastListener) => {
    listeners = [...listeners, listener];
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },
};

// ============================================================
// 個別トーストアイテムコンポーネント
// ============================================================

const ToastItemComponent: React.FC<{
  item: ToastItem;
  onDismiss: (id: string) => void;
}> = ({ item, onDismiss }) => {
  const t = useT();
  const styles = typeStyles[item.type];
  const [paused, setPaused] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  // ホバー時にプログレスバーを一時停止
  useEffect(() => {
    if (progressRef.current) {
      progressRef.current.style.animationPlayState = paused ? "paused" : "running";
    }
  }, [paused]);

  return (
    <div
      className={clsx("flex flex-col overflow-hidden animate-slide-in-right")}
      style={{
        backgroundColor: "var(--color-bg-card)",
        borderRadius: "12px",
        boxShadow: "var(--shadow-dropdown)",
        border: "1px solid var(--color-border-secondary)",
        color: "var(--color-text-primary)",
        minWidth: "280px",
      }}
      role="alert"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* コンテンツ行 */}
      <div className="flex items-start gap-3 px-4 py-3">
        {/* アイコン */}
        <span
          className="shrink-0 mt-0.5 flex items-center justify-center"
          style={{
            color: styles.color,
            width: "20px",
            height: "20px",
          }}
        >
          {styles.icon}
        </span>

        {/* メッセージ */}
        <span
          className="flex-1 text-sm"
          style={{ lineHeight: "var(--line-height-normal)" }}
        >
          {item.message}
        </span>

        {/* 閉じるボタン */}
        <button
          onClick={() => onDismiss(item.id)}
          className="shrink-0 mt-0.5 flex items-center justify-center"
          style={{
            width: "20px",
            height: "20px",
            borderRadius: "4px",
            color: "var(--color-text-tertiary)",
            transition: "all var(--transition-fast)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--color-text-primary)";
            e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--color-text-tertiary)";
            e.currentTarget.style.backgroundColor = "transparent";
          }}
          aria-label={t.common.close}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* プログレスバー（自動消去タイマー） */}
      {item.duration && item.duration > 0 && (
        <div
          style={{
            height: "2px",
            backgroundColor: "var(--color-bg-tertiary)",
            overflow: "hidden",
          }}
        >
          <div
            ref={progressRef}
            className="toast-progress-bar"
            style={{
              height: "100%",
              backgroundColor: styles.color,
              opacity: 0.6,
              ["--toast-duration" as string]: `${item.duration}ms`,
            }}
          />
        </div>
      )}
    </div>
  );
};

// ============================================================
// トーストコンテナ
// ============================================================

export const ToastContainer: React.FC = () => {
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
      style={{ zIndex: "var(--z-toast)", maxWidth: "400px" }}
    >
      {items.map((item) => (
        <ToastItemComponent
          key={item.id}
          item={item}
          onDismiss={handleDismiss}
        />
      ))}
    </div>
  );
};
