// src/components/graph/GraphErrorBoundary.tsx
// Stellar — GraphView 専用 Error Boundary
// Safari WKWebView (Tauri) で react-force-graph-2d / d3 の評価が
// クラッシュした場合にアプリ全体のフリーズを防ぎ、
// フォールバック UI を表示してリトライを可能にする

import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { useI18nStore } from "../../stores/useI18nStore";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string | null;
  errorStack: string | null;
  componentStack: string | null;
}

export class GraphErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: null,
      errorStack: null,
      componentStack: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      errorMessage: error?.message ?? String(error),
      errorStack: error?.stack ?? null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(useI18nStore.getState().t.graph.k_xubm19, error);
    console.error(useI18nStore.getState().t.graph.k_wb4mep, error?.stack);
    console.error(useI18nStore.getState().t.graph.k_5m6z53, errorInfo.componentStack);
    this.setState({
      componentStack: errorInfo.componentStack ?? null,
    });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      errorMessage: null,
      errorStack: null,
      componentStack: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex items-center justify-center h-full"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          <div className="flex flex-col items-center gap-4">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: "var(--color-accent-danger)", opacity: 0.6 }}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div className="text-center">
              <p
                className="text-sm font-medium mb-1"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {useI18nStore.getState().t.graph.k_error_occurred}
              </p>
              <p
                className="text-xs mb-3"
                style={{
                  color: "var(--color-text-tertiary)",
                  maxWidth: "360px",
                }}
              >
                {useI18nStore.getState().t.graph.k_engine_load_failed}
              </p>
              {this.state.errorMessage && (
                <details
                  className="text-xs mb-3"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  <summary style={{ cursor: "pointer" }}>
                    {useI18nStore.getState().t.graph.k_error_details}
                  </summary>
                  <pre
                    className="mt-1 text-left"
                    style={{
                      fontSize: "10px",
                      maxWidth: "400px",
                      overflow: "auto",
                      padding: "8px",
                      backgroundColor: "var(--color-bg-tertiary)",
                      borderRadius: "6px",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    }}
                  >
                    {this.state.errorMessage}
                    {this.state.errorStack && (
                      <>
                        {"\n\n--- Stack ---\n"}
                        {this.state.errorStack}
                      </>
                    )}
                    {this.state.componentStack && (
                      <>
                        {"\n\n--- Component ---\n"}
                        {this.state.componentStack}
                      </>
                    )}
                  </pre>
                </details>
              )}
            </div>
            <button
              type="button"
              onClick={this.handleRetry}
              className="text-xs"
              style={{
                color: "var(--color-accent-primary)",
                padding: "8px 20px",
                borderRadius: "8px",
                border: "1px solid var(--color-accent-primary)",
                cursor: "pointer",
                background: "transparent",
              }}
            >
              {useI18nStore.getState().t.graph.k_retry}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
