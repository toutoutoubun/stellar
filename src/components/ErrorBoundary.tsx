// src/components/ErrorBoundary.tsx
// Stellar — エラーバウンダリ（クラスコンポーネント）
// キャッチされなかった React レンダリングエラーを捕捉し、
// 全画面エラー UI を表示。「再起動」ボタンで Tauri relaunch() を呼ぶ。

import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });
    // コンソールにもログ出力
    console.error("[ErrorBoundary] Uncaught error:", error, errorInfo);
  }

  handleRestart = (): void => {
    import("@tauri-apps/plugin-process")
      .then(({ relaunch }) => relaunch())
      .catch(() => window.location.reload());
  };

  handleDismiss = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error, errorInfo } = this.state;

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--color-bg-primary, #ffffff)",
          color: "var(--color-text-primary, #1a1a2e)",
          fontFamily:
            '"Inter", "Hiragino Kaku Gothic ProN", "Noto Sans JP", system-ui, sans-serif',
          zIndex: 9999,
          padding: "32px",
        }}
      >
        <div
          style={{
            maxWidth: "560px",
            width: "100%",
            textAlign: "center",
          }}
        >
          {/* エラーアイコン */}
          <div style={{ marginBottom: "24px" }}>
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                color: "var(--color-accent-danger, #e03131)",
                margin: "0 auto",
                display: "block",
              }}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          {/* タイトル */}
          <h1
            style={{
              fontSize: "20px",
              fontWeight: 600,
              marginBottom: "8px",
              color: "var(--color-text-primary, #1a1a2e)",
            }}
          >
            {(window as any).__STELLAR_T__?.layout?.k_error_title ?? "An unexpected error occurred"}
          </h1>

          {/* 説明文 */}
          <p
            style={{
              fontSize: "14px",
              color: "var(--color-text-secondary, #495057)",
              lineHeight: 1.6,
              marginBottom: "24px",
            }}
          >
            {((window as any).__STELLAR_T__?.layout?.k_error_desc ?? "Something went wrong.\nYou can restart the app or dismiss this error.").split("\n").map((line: string, i: number) => (
              <span key={i}>{line}{i === 0 && <br />}</span>
            ))}
          </p>

          {/* エラー詳細（展開可能） */}
          {error && (
            <details
              style={{
                marginBottom: "24px",
                textAlign: "left",
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  fontSize: "12px",
                  color: "var(--color-text-tertiary, #868e96)",
                  marginBottom: "8px",
                  userSelect: "none",
                }}
              >
                {(window as any).__STELLAR_T__?.layout?.k_error_details ?? "Show error details"}
              </summary>
              <div
                style={{
                  backgroundColor: "var(--color-bg-code, #f0f1f3)",
                  borderRadius: "8px",
                  padding: "12px 16px",
                  fontSize: "12px",
                  fontFamily: '"JetBrains Mono", "Source Code Pro", monospace',
                  lineHeight: 1.5,
                  overflow: "auto",
                  maxHeight: "200px",
                  border: "1px solid var(--color-border-secondary, #e9ecef)",
                  color: "var(--color-accent-danger, #e03131)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                <strong>{error.name}:</strong> {error.message}
                {errorInfo?.componentStack && (
                  <>
                    {"\n\n"}
                    <span
                      style={{
                        color: "var(--color-text-tertiary, #868e96)",
                      }}
                    >
                      {errorInfo.componentStack}
                    </span>
                  </>
                )}
              </div>
            </details>
          )}

          {/* アクションボタン */}
          <div
            style={{
              display: "flex",
              gap: "12px",
              justifyContent: "center",
            }}
          >
            <button
              onClick={this.handleRestart}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 24px",
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--color-text-inverse, #ffffff)",
                backgroundColor: "var(--color-accent-primary, #4285f4)",
                border: "none",
                borderRadius: "10px",
                cursor: "pointer",
                transition: "opacity 150ms ease-out",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.opacity = "0.9";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.opacity = "1";
              }}
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
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              {(window as any).__STELLAR_T__?.layout?.k_restart_app ?? "Restart app"}
            </button>

            <button
              onClick={this.handleDismiss}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 24px",
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--color-text-secondary, #495057)",
                backgroundColor: "var(--color-bg-hover, #e9ecef)",
                border: "1px solid var(--color-border-primary, #dee2e6)",
                borderRadius: "10px",
                cursor: "pointer",
                transition: "opacity 150ms ease-out",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.opacity = "0.8";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.opacity = "1";
              }}
            >
              {(window as any).__STELLAR_T__?.layout?.k_dismiss_error ?? "Dismiss"}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
