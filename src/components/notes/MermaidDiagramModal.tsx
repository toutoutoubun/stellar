// src/components/notes/MermaidDiagramModal.tsx
// Stellar — Mermaid ダイアグラム作成モーダル
// Mermaid 記法の入力 + ライブプレビュー + テンプレート選択
// エディタにコードブロック ```mermaid ... ``` として挿入

import type React from "react";
import { useState, useCallback, useEffect, useRef } from "react";
import { Modal } from "../ui/Modal";
import { useT, useI18nStore } from "../../stores/useI18nStore";

// ============================================================
// テンプレート定義
// ============================================================

interface MermaidTemplate {
  id: string;
  label: string;
  icon: React.ReactNode;
  code: string;
}

const MERMAID_TEMPLATES: MermaidTemplate[] = [
  {
    id: "flowchart",
    label: useI18nStore.getState().t.notes.k_wflnpu,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="5" rx="1" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <polygon points="12 12 7 17 12 22 17 17 12 12" />
      </svg>
    ),
    code: `graph TD
    A[${useI18nStore.getState().t.notes.k_mmd_flow_start}] --> B{${useI18nStore.getState().t.notes.k_mmd_flow_branch}}
    B -->|${useI18nStore.getState().t.notes.k_mmd_flow_yes}| C[${useI18nStore.getState().t.notes.k_mmd_flow_procA}]
    B -->|${useI18nStore.getState().t.notes.k_mmd_flow_no}| D[${useI18nStore.getState().t.notes.k_mmd_flow_procB}]
    C --> E[${useI18nStore.getState().t.notes.k_mmd_flow_end}]
    D --> E`,
  },
  {
    id: "sequence",
    label: useI18nStore.getState().t.notes.k_639uzj,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="6" y1="3" x2="6" y2="21" />
        <line x1="18" y1="3" x2="18" y2="21" />
        <line x1="6" y1="8" x2="18" y2="8" />
        <polyline points="15 5 18 8 15 11" />
        <line x1="18" y1="16" x2="6" y2="16" />
        <polyline points="9 13 6 16 9 19" />
      </svg>
    ),
    code: `sequenceDiagram
    participant A as ${useI18nStore.getState().t.notes.k_mmd_seq_user}
    participant B as ${useI18nStore.getState().t.notes.k_mmd_seq_system}
    participant C as ${useI18nStore.getState().t.notes.k_mmd_seq_db}
    A->>B: ${useI18nStore.getState().t.notes.k_mmd_seq_request}
    B->>C: ${useI18nStore.getState().t.notes.k_mmd_seq_query}
    C-->>B: ${useI18nStore.getState().t.notes.k_mmd_seq_result}
    B-->>A: ${useI18nStore.getState().t.notes.k_mmd_seq_response}`,
  },
  {
    id: "class",
    label: useI18nStore.getState().t.notes.k_6cglis,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="3" y1="15" x2="21" y2="15" />
      </svg>
    ),
    code: `classDiagram
    class Animal {
        +String name
        +int age
        +makeSound() void
    }
    class Dog {
        +String breed
        +fetch() void
    }
    class Cat {
        +String color
        +purr() void
    }
    Animal <|-- Dog
    Animal <|-- Cat`,
  },
  {
    id: "gantt",
    label: useI18nStore.getState().t.notes.k_xwvvz,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="6" x2="20" y2="6" />
        <line x1="4" y1="12" x2="16" y2="12" />
        <line x1="4" y1="18" x2="12" y2="18" />
        <rect x="4" y="4" width="10" height="4" rx="1" fill="currentColor" opacity="0.2" />
        <rect x="4" y="10" width="8" height="4" rx="1" fill="currentColor" opacity="0.2" />
      </svg>
    ),
    code: `gantt
    title ${useI18nStore.getState().t.notes.k_mmd_gantt_title}
    dateFormat  YYYY-MM-DD
    section ${useI18nStore.getState().t.notes.k_mmd_gantt_phase1}
    ${useI18nStore.getState().t.notes.k_mmd_gantt_req}      :a1, 2024-01-01, 14d
    ${useI18nStore.getState().t.notes.k_mmd_gantt_design}          :a2, after a1, 10d
    section ${useI18nStore.getState().t.notes.k_mmd_gantt_phase2}
    ${useI18nStore.getState().t.notes.k_mmd_gantt_impl}          :b1, after a2, 21d
    ${useI18nStore.getState().t.notes.k_mmd_gantt_test}        :b2, after b1, 7d`,
  },
  {
    id: "mindmap",
    label: useI18nStore.getState().t.notes.k_c85hii,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <line x1="12" y1="3" x2="12" y2="9" />
        <line x1="12" y1="15" x2="12" y2="21" />
        <line x1="3" y1="12" x2="9" y2="12" />
        <line x1="15" y1="12" x2="21" y2="12" />
      </svg>
    ),
    code: `mindmap
  root((${useI18nStore.getState().t.notes.k_mmd_mind_root}))
    ${useI18nStore.getState().t.notes.k_mmd_mind_prior}
      ${useI18nStore.getState().t.notes.k_mmd_mind_paperA}
      ${useI18nStore.getState().t.notes.k_mmd_mind_paperB}
    {t.qualitative.k_hbe2}
      ${useI18nStore.getState().t.notes.k_mmd_mind_exp1}
      ${useI18nStore.getState().t.notes.k_mmd_mind_exp2}
    {t.qualitative.k_lvt8}
      {t.notes.k_eiq2}
      ${useI18nStore.getState().t.notes.k_mmd_mind_discuss}`,
  },
  {
    id: "state",
    label: useI18nStore.getState().t.notes.k_z7gmmy,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="12" r="4" />
        <circle cx="18" cy="12" r="4" />
        <line x1="12" y1="12" x2="14" y2="12" />
        <polyline points="13 10 15 12 13 14" />
      </svg>
    ),
    code: `stateDiagram-v2
    [*] --> ${useI18nStore.getState().t.notes.k_mmd_state_idle}
    ${useI18nStore.getState().t.notes.k_mmd_state_idle} --> ${useI18nStore.getState().t.notes.k_mmd_state_proc} : ${useI18nStore.getState().t.notes.k_mmd_state_start}
    ${useI18nStore.getState().t.notes.k_mmd_state_proc} --> ${useI18nStore.getState().t.notes.k_mmd_state_done} : ${useI18nStore.getState().t.notes.k_mmd_state_success}
    ${useI18nStore.getState().t.notes.k_mmd_state_proc} --> ${useI18nStore.getState().t.notes.k_mmd_state_err} : ${useI18nStore.getState().t.notes.k_mmd_state_fail}
    ${useI18nStore.getState().t.notes.k_mmd_state_err} --> ${useI18nStore.getState().t.notes.k_mmd_state_idle} : ${useI18nStore.getState().t.notes.k_mmd_state_retry}
    ${useI18nStore.getState().t.notes.k_mmd_state_done} --> [*]`,
  },
  {
    id: "er",
    label: useI18nStore.getState().t.notes.k_1yau,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="8" height="6" rx="1" />
        <rect x="14" y="3" width="8" height="6" rx="1" />
        <rect x="8" y="15" width="8" height="6" rx="1" />
        <line x1="10" y1="6" x2="14" y2="6" />
        <line x1="12" y1="15" x2="6" y2="9" />
        <line x1="12" y1="15" x2="18" y2="9" />
      </svg>
    ),
    code: `erDiagram
    PAPER ||--o{ HIGHLIGHT : has
    PAPER ||--o{ NOTE : references
    NOTE ||--o{ LINK : contains
    PAPER {
        string id PK
        string title
        string doi
    }
    NOTE {
        string id PK
        string title
        string content
    }
    HIGHLIGHT {
        string id PK
        string text
        string color
    }`,
  },
  {
    id: "pie",
    label: useI18nStore.getState().t.notes.k_ahjbli,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
        <path d="M22 12A10 10 0 0 0 12 2v10z" />
      </svg>
    ),
    code: `pie title ${useI18nStore.getState().t.notes.k_mmd_pie_title}
    t.notes.k_dajeg3 : 30
    t.notes.k_gfh0 : 25
    t.notes.k_eiq2 : 20
    t.notes.k_hxpffk : 15
    t.notes.k_7bosl : 10`,
  },
];

// ============================================================
// Mermaid レンダリング（CDN ESM 動的 import — バンドル非依存）
// ============================================================

// mermaid の型を inline で宣言（npm パッケージ不要）
interface MermaidAPI {
  initialize: (config: Record<string, unknown>) => void;
  render: (
    id: string,
    text: string,
  ) => Promise<{ svg: string; bindFunctions?: (el: Element) => void }>;
}

// バージョン固定でセキュリティ・再現性を担保
const MERMAID_CDN_URL =
  "https://cdn.jsdelivr.net/npm/mermaid@10.9.3/dist/mermaid.esm.min.mjs";

let mermaidInstance: MermaidAPI | null = null;

/** Mermaid を CDN から ESM dynamic import でロード（キャッシュ付き） */
async function loadMermaid(): Promise<MermaidAPI> {
  if (mermaidInstance) return mermaidInstance;

  try {
    const mod = await import(/* @vite-ignore */ MERMAID_CDN_URL);
    const m = (mod.default ?? mod) as MermaidAPI;

    m.initialize({
      startOnLoad: false,
      theme: "neutral",
      securityLevel: "strict",
      fontFamily: "system-ui, -apple-system, 'Hiragino Kaku Gothic ProN', sans-serif",
    });

    mermaidInstance = m;
    return m;
  } catch {
    throw new Error(
      useI18nStore.getState().t.notes.k_gpxfp7,
    );
  }
}

// ============================================================
// Props
// ============================================================

interface MermaidDiagramModalProps {
  open: boolean;
  onClose: () => void;
  /** 生成されたコードブロックをエディタに挿入する */
  onInsert: (mermaidCodeBlock: string) => void;
}

// ============================================================
// MermaidDiagramModal コンポーネント
// ============================================================

export const MermaidDiagramModal: React.FC<MermaidDiagramModalProps> = ({
  open,
  onClose,
  onInsert,
}) => {
  const t = useT();
  const [code, setCode] = useState(MERMAID_TEMPLATES[0]?.code ?? "");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("flowchart");
  const [previewSvg, setPreviewSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const renderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Mermaid コードをレンダリングしてプレビュー更新 */
  const renderPreview = useCallback(async (mermaidCode: string) => {
    if (!mermaidCode.trim()) {
      setPreviewSvg("");
      setError(null);
      return;
    }
    setIsRendering(true);
    setError(null);
    try {
      const mermaid = await loadMermaid();
      // 一意のIDを生成
      const id = `mermaid-preview-${Date.now()}`;
      const { svg } = await mermaid.render(id, mermaidCode.trim());
      setPreviewSvg(svg);
      setError(null);
    } catch (e) {
      setPreviewSvg("");
      const msg = e instanceof Error ? e.message : t.notes.k_uwv1vx;
      // Mermaid のエラーメッセージを短く整形
      const shortMsg = String(msg.split("\n")[0] ?? "").slice(0, 200);
      setError(shortMsg);
    } finally {
      setIsRendering(false);
    }
  }, []);

  /** コード入力変更時にデバウンスしてプレビュー更新 */
  useEffect(() => {
    if (!open) return;
    if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current);
    renderTimeoutRef.current = setTimeout(() => {
      void renderPreview(code);
    }, 500);
    return () => {
      if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current);
    };
  }, [code, open, renderPreview]);

  /** テンプレート選択 */
  const handleTemplateSelect = useCallback((template: MermaidTemplate) => {
    setSelectedTemplate(template.id);
    setCode(template.code);
  }, []);

  /** 挿入ボタン */
  const handleInsert = useCallback(() => {
    const codeBlock = "```mermaid\n" + code.trim() + "\n```";
    onInsert(codeBlock);
    onClose();
  }, [code, onInsert, onClose]);

  /** モーダルを閉じるときにリセット */
  useEffect(() => {
    if (!open) {
      // 少し遅延してリセット（フェードアウト完了後）
      const timer = setTimeout(() => {
        setCode(MERMAID_TEMPLATES[0]?.code ?? "");
        setSelectedTemplate("flowchart");
        setPreviewSvg("");
        setError(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.notes.k_luos0t}
      width="880px"
      footer={
        <div className="flex items-center gap-2 w-full">
          <a
            href="https://mermaid.js.org/intro/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs flex items-center gap-1 mr-auto"
            style={{ color: "var(--color-text-tertiary)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--color-accent-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--color-text-tertiary)";
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            Mermaid 構文リファレンス
          </a>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium"
            style={{
              color: "var(--color-text-secondary)",
              border: "1px solid var(--color-border-primary)",
              borderRadius: "var(--radius-button)",
              backgroundColor: "transparent",
            }}
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={handleInsert}
            disabled={!code.trim() || !!error}
            className="px-4 py-2 text-xs font-semibold"
            style={{
              backgroundColor:
                !code.trim() || error
                  ? "var(--color-bg-tertiary)"
                  : "var(--color-accent-primary)",
              color:
                !code.trim() || error
                  ? "var(--color-text-tertiary)"
                  : "var(--color-text-inverse)",
              borderRadius: "var(--radius-button)",
              cursor: !code.trim() || error ? "not-allowed" : "pointer",
              border: "none",
            }}
          >
            ノートに挿入
          </button>
        </div>
      }
    >
      {/* テンプレートチップス */}
      <div className="mb-4">
        <div
          className="text-xs font-semibold uppercase tracking-wider mb-2"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          テンプレート
        </div>
        <div className="flex flex-wrap gap-1.5">
          {MERMAID_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.id}
              type="button"
              onClick={() => handleTemplateSelect(tmpl)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs"
              style={{
                borderRadius: "999px",
                border:
                  selectedTemplate === tmpl.id
                    ? "1.5px solid var(--color-accent-primary)"
                    : "1.5px solid var(--color-border-secondary)",
                backgroundColor:
                  selectedTemplate === tmpl.id
                    ? "var(--color-bg-hover)"
                    : "transparent",
                color:
                  selectedTemplate === tmpl.id
                    ? "var(--color-accent-primary)"
                    : "var(--color-text-secondary)",
                fontWeight: selectedTemplate === tmpl.id ? 600 : 400,
                transition: "all 150ms ease-out",
                cursor: "pointer",
              }}
            >
              {tmpl.icon}
              {tmpl.label}
            </button>
          ))}
        </div>
      </div>

      {/* エディタ + プレビュー */}
      <div className="flex gap-3" style={{ height: "360px" }}>
        {/* 左: コード入力 */}
        <div className="flex flex-col flex-1" style={{ minWidth: 0 }}>
          <div
            className="text-xs font-semibold uppercase tracking-wider mb-1.5"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Mermaid コード
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            className="flex-1 text-xs"
            style={{
              backgroundColor: "var(--color-bg-primary)",
              color: "var(--color-text-primary)",
              border: "1px solid var(--color-border-secondary)",
              borderRadius: "8px",
              padding: "12px",
              fontFamily: "var(--font-family-mono, 'SF Mono', 'Fira Code', monospace)",
              lineHeight: "1.6",
              resize: "none",
              outline: "none",
              tabSize: 4,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--color-accent-primary)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--color-border-secondary)";
            }}
            onKeyDown={(e) => {
              // Tab キーでインデント
              if (e.key === "Tab") {
                e.preventDefault();
                const target = e.currentTarget;
                const start = target.selectionStart;
                const end = target.selectionEnd;
                const newValue =
                  code.substring(0, start) + "    " + code.substring(end);
                setCode(newValue);
                // カーソル位置を更新（次の re-render 後）
                requestAnimationFrame(() => {
                  target.selectionStart = target.selectionEnd = start + 4;
                });
              }
            }}
          />
        </div>

        {/* 右: プレビュー */}
        <div className="flex flex-col flex-1" style={{ minWidth: 0 }}>
          <div
            className="text-xs font-semibold uppercase tracking-wider mb-1.5"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            プレビュー
          </div>
          <div
            ref={previewRef}
            className="flex-1 flex items-center justify-center overflow-auto"
            style={{
              backgroundColor: "var(--color-bg-primary)",
              border: "1px solid var(--color-border-secondary)",
              borderRadius: "8px",
              padding: "12px",
            }}
          >
            {isRendering ? (
              <div
                className="flex flex-col items-center gap-2"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ animation: "spin 1s linear infinite" }}
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                <span className="text-xs">レンダリング中...</span>
              </div>
            ) : error ? (
              <div
                className="flex flex-col items-center gap-2 text-center p-4"
                style={{ color: "var(--color-accent-danger)" }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                <span className="text-xs" style={{ maxWidth: "240px", wordBreak: "break-word" }}>
                  {error}
                </span>
              </div>
            ) : previewSvg ? (
              <div
                dangerouslySetInnerHTML={{ __html: previewSvg }}
                style={{
                  width: "100%",
                  maxHeight: "100%",
                  overflow: "auto",
                }}
                className="mermaid-preview-container"
              />
            ) : (
              <div
                className="flex flex-col items-center gap-2"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18" />
                  <path d="M9 21V9" />
                </svg>
                <span className="text-xs">コードを入力するとプレビューが表示されます</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
