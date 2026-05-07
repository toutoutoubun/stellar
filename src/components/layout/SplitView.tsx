// src/components/layout/SplitView.tsx
// Stellar — 分割表示（PDF リーダー + ノートエディタ）
// リサイズ可能な2ペイン、比率は localStorage に保存

import type React from "react";
import { useState, useCallback, useRef, useEffect, Suspense, lazy } from "react";
import { invoke } from "../../lib/tauriShim";
import type { Paper, Note } from "../../types";
import { NoteEditor } from "../notes/NoteEditor";
import { DraftNoteEditor } from "../notes/DraftNoteEditor";
import { useT } from "../../stores/useI18nStore";

const ReaderView = lazy(() =>
  import("../reader/ReaderView").then((m) => ({ default: m.ReaderView })),
);

interface SplitViewProps {
  paperId: string;
  noteId: string;
}

const STORAGE_KEY = "stellar-split-ratio";
const DEFAULT_RATIO = 0.55;

export const SplitView: React.FC<SplitViewProps> = ({ paperId, noteId }) => {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // 論文・ノートのタイトル取得
  const [paperTitle, setPaperTitle] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [isDraft, setIsDraft] = useState(false);

  // 分割比率（左ペインの幅割合）
  const [ratio, setRatio] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const val = Number.parseFloat(saved);
        if (val > 0.2 && val < 0.8) return val;
      }
    } catch {
      // ignore
    }
    return DEFAULT_RATIO;
  });

  /** タイトルを取得 */
  useEffect(() => {
    let cancelled = false;
    const fetchTitles = async () => {
      try {
        const [paper, note] = await Promise.all([
          invoke<Paper>("get_paper", { id: paperId }),
          invoke<Note>("get_note", { id: noteId }),
        ]);
        if (!cancelled) {
          if (paper) setPaperTitle(paper.title);
          if (note) {
            setNoteTitle(note.title);
            setIsDraft(note.isDraft === 1);
          }
        }
      } catch {
        // 静かに処理
      }
    };
    void fetchTitles();
    return () => { cancelled = true; };
  }, [paperId, noteId]);

  /** 比率を localStorage に保存 */
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(ratio));
    } catch {
      // ignore
    }
  }, [ratio]);

  /** ドラッグ開始 */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  /** ドラッグ中 */
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const newRatio = Math.max(0.2, Math.min(0.8, x / rect.width));
      setRatio(newRatio);
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  /** 比率リセット */
  const handleReset = useCallback(() => {
    setRatio(DEFAULT_RATIO);
  }, []);

  const leftPercent = `${(ratio * 100).toFixed(1)}%`;
  const rightPercent = `${((1 - ratio) * 100).toFixed(1)}%`;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ツールバー */}
      <header
        className="flex items-center gap-2 px-4 shrink-0 select-none"
        style={{
          height: "36px",
          backgroundColor: "var(--color-bg-secondary)",
          borderBottom: "1px solid var(--color-border-primary)",
        }}
      >
        {/* 論文タイトル */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {/* 論文アイコン */}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "var(--color-text-tertiary)", flexShrink: 0 }}
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span
            className="text-xs truncate"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {paperTitle}
          </span>
        </div>

        {/* セパレーター */}
        <div
          style={{
            width: "1px",
            height: "16px",
            backgroundColor: "var(--color-border-secondary)",
          }}
        />

        {/* ノートタイトル */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {/* ノートアイコン */}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "var(--color-text-tertiary)", flexShrink: 0 }}
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <span
            className="text-xs truncate"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {noteTitle}
          </span>
          {isDraft && (
            <span
              className="text-xs shrink-0"
              style={{
                backgroundColor: "var(--color-accent-primary)",
                color: "#fff",
                padding: "0px 5px",
                borderRadius: "999px",
                fontSize: "9px",
                fontWeight: 600,
              }}
            >
              {t.draftMode.draftBadge}
            </span>
          )}
        </div>

        {/* リセットボタン */}
        <button
          type="button"
          onClick={handleReset}
          className="text-xs"
          style={{
            color: "var(--color-text-tertiary)",
            padding: "3px 8px",
            borderRadius: "6px",
            transition: "all 120ms ease-out",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--color-accent-primary)";
            e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--color-text-tertiary)";
            e.currentTarget.style.backgroundColor = "transparent";
          }}
          title={t.draftMode.resetRatio}
        >
          {/* リセットアイコン */}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1 4v6h6" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
        </button>
      </header>

      {/* 分割ペイン */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden relative">
        {/* 左: ReaderView */}
        <div
          className="overflow-hidden"
          style={{ width: leftPercent, minWidth: "200px" }}
        >
          <Suspense
            fallback={
              <div
                className="flex items-center justify-center h-full"
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
              </div>
            }
          >
            <ReaderView paperId={paperId} />
          </Suspense>
        </div>

        {/* リサイズハンドル */}
        <div
          onMouseDown={handleMouseDown}
          style={{
            width: "6px",
            cursor: "col-resize",
            backgroundColor: "var(--color-border-primary)",
            position: "relative",
            zIndex: 10,
            flexShrink: 0,
            transition: "background-color 120ms ease-out",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--color-accent-primary)";
          }}
          onMouseLeave={(e) => {
            if (!isDragging.current) {
              e.currentTarget.style.backgroundColor = "var(--color-border-primary)";
            }
          }}
        >
          {/* ハンドルのドットインジケーター */}
          <div
            className="absolute top-1/2 left-1/2"
            style={{
              transform: "translate(-50%, -50%)",
              display: "flex",
              flexDirection: "column",
              gap: "3px",
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: "2px",
                  height: "2px",
                  borderRadius: "999px",
                  backgroundColor: "var(--color-text-disabled)",
                }}
              />
            ))}
          </div>
        </div>

        {/* 右: NoteEditor or DraftNoteEditor */}
        <div
          className="overflow-hidden"
          style={{ width: rightPercent, minWidth: "200px" }}
        >
          {isDraft ? (
            <DraftNoteEditor noteId={noteId} />
          ) : (
            <NoteEditor noteId={noteId} />
          )}
        </div>
      </div>
    </div>
  );
};
