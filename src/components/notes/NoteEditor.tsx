// src/components/notes/NoteEditor.tsx
// Stellar — ノートエディタ本体
// 左右2カラムレイアウト: エディタペイン（左） + コンテキストパネル（右）
// ツールバー: 戻るボタン、タイトル編集、検索、フォーカスモード切替、メニュー
// 下部ステータスバー: 文字数 + 最終保存時刻

import type React from "react";
import { useState, useCallback, useEffect, useRef } from "react";
import type { NodeType } from "../../types";
import { useNoteStore } from "../../stores/useNoteStore";
import { useUIStore } from "../../stores/useUIStore";
import { StellarEditor } from "./StellarEditor";
import { NoteContextPanel } from "./NoteContextPanel";
import { FocusMode } from "./FocusMode";
import { toast } from "../ui/Toast";

interface NoteEditorProps {
  /** 表示するノートのID */
  noteId: string;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({ noteId }) => {
  // ストア
  const activeNote = useNoteStore((s) => s.activeNote);
  const loading = useNoteStore((s) => s.loading);
  const autoSaveStatus = useNoteStore((s) => s.autoSaveStatus);
  const isModified = useNoteStore((s) => s.isModified);
  const openNoteAction = useNoteStore((s) => s.openNote);
  const saveNote = useNoteStore((s) => s.saveNote);
  const updateNote = useNoteStore((s) => s.updateNote);
  const deleteNote = useNoteStore((s) => s.deleteNote);
  const setIsModified = useNoteStore((s) => s.setIsModified);

  const openNoteUI = useUIStore((s) => s.openNote);
  const openPaper = useUIStore((s) => s.openPaper);
  const setMainPaneContent = useUIStore((s) => s.setMainPaneContent);
  const setSidebarView = useUIStore((s) => s.setSidebarView);

  // ローカル状態
  const [editorContent, setEditorContent] = useState("");
  const [charCount, setCharCount] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [contextPanelOpen, setContextPanelOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  /** ノートデータの取得 */
  useEffect(() => {
    void openNoteAction(noteId);
  }, [noteId, openNoteAction]);

  /** activeNote が読み込まれたらローカル状態を初期化 */
  useEffect(() => {
    if (activeNote) {
      setEditorContent(activeNote.content);
      setCharCount(activeNote.content.length);
      setTitleValue(activeNote.title);
      // 更新日時を最終保存時刻として表示
      const d = new Date(activeNote.updatedAt);
      setLastSavedAt(
        `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      );
    }
  }, [activeNote]);

  /** autoSaveStatus が saved に変わったら最終保存時刻を更新 */
  useEffect(() => {
    if (autoSaveStatus === "saved") {
      const now = new Date();
      setLastSavedAt(
        `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      );
    }
  }, [autoSaveStatus]);

  /** 自動保存コールバック（StellarEditor から呼ばれる） */
  const handleSave = useCallback(
    (content: string) => {
      if (!activeNote) return;
      void saveNote(activeNote.id, content);
    },
    [activeNote, saveNote],
  );

  /** エディタ内容変更コールバック */
  const handleContentChange = useCallback(
    (content: string) => {
      setEditorContent(content);
      setCharCount(content.length);
      setIsModified(true);
    },
    [setIsModified],
  );

  /** WikiLink / バックリンク遷移 */
  const handleNavigate = useCallback(
    (targetId: string, targetType: NodeType) => {
      if (targetType === "note") {
        openNoteUI(targetId);
      } else {
        openPaper(targetId);
      }
    },
    [openNoteUI, openPaper],
  );

  /** 戻るボタン */
  const handleBack = useCallback(() => {
    setSidebarView("notes");
    setMainPaneContent({ type: "empty" });
  }, [setSidebarView, setMainPaneContent]);

  /** タイトル保存 */
  const handleTitleSave = useCallback(async () => {
    if (!activeNote) return;
    const trimmed = titleValue.trim();
    if (trimmed && trimmed !== activeNote.title) {
      try {
        await updateNote(activeNote.id, { title: trimmed });
      } catch {
        toast.error("タイトルの保存に失敗しました");
      }
    }
    setTitleEditing(false);
  }, [activeNote, titleValue, updateNote]);

  /** ノート削除 */
  const handleDelete = useCallback(async () => {
    if (!activeNote) return;
    const { confirm } = await import("@tauri-apps/plugin-dialog");
    const ok = await confirm(
      `「${activeNote.title}」を削除しますか？この操作は取り消せません。`,
      { title: "ノートの削除", kind: "warning" },
    );
    if (ok) {
      try {
        await deleteNote(activeNote.id);
        handleBack();
        toast.success("ノートを削除しました");
      } catch {
        toast.error("ノートの削除に失敗しました");
      }
    }
    setMenuOpen(false);
  }, [activeNote, deleteNote, handleBack]);

  /** フォーカスモードトグル */
  const toggleFocusMode = useCallback(() => {
    setFocusMode((prev) => !prev);
  }, []);

  /** アウトライン見出しクリック → エディタの該当行にスクロール */
  const handleHeadingClick = useCallback((_line: number) => {
    // CodeMirror の EditorView を直接参照する必要があるが、
    // 現在のアーキテクチャでは StellarEditor 内部に閉じている。
    // 将来的に ref でスクロール関数を公開する拡張が可能。
  }, []);

  /** Markdown → HTML 変換ヘルパー（HTML/PDF/DOCX 共用） */
  const markdownToHtml = useCallback(
    (md: string, title: string) => {
      const htmlBody = md
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        // コードブロック（```mermaid 含む）
        .replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang: string, code: string) => {
          if (lang === "mermaid") {
            return `<pre class="mermaid">${code.trim()}</pre>`;
          }
          return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
        })
        .replace(/^### (.+)$/gm, "<h3>$1</h3>")
        .replace(/^## (.+)$/gm, "<h2>$1</h2>")
        .replace(/^# (.+)$/gm, "<h1>$1</h1>")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/~~(.+?)~~/g, "<del>$1</del>")
        .replace(/`(.+?)`/g, "<code>$1</code>")
        .replace(/==(.+?)==/g, "<mark>$1</mark>")
        .replace(/\[\[(.+?)\]\]/g, '<span class="wikilink">$1</span>')
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
        .replace(/\[([^\]]*)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        .replace(/@cite\{([^}]+)\}/g, '<span class="citation">[$1]</span>')
        .replace(/\n\n/g, "</p>\n<p>")
        .replace(/\n/g, "<br/>\n");

      return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: system-ui, -apple-system, 'Hiragino Kaku Gothic ProN', sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.8; color: #1a1a1a; }
    h1 { font-size: 1.6em; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.3em; }
    h2 { font-size: 1.35em; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.2em; }
    h3 { font-size: 1.15em; }
    h1, h2, h3 { margin-top: 1.5em; margin-bottom: 0.5em; }
    code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 0.88em; font-family: 'SF Mono', 'Fira Code', monospace; }
    pre { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    mark { background: rgba(255,235,59,0.35); padding: 1px 3px; border-radius: 3px; }
    .wikilink { color: #6366f1; text-decoration: underline dotted; text-underline-offset: 3px; }
    .citation { color: #6366f1; font-weight: 500; }
    img { max-width: 100%; height: auto; border-radius: 6px; margin: 1em 0; }
    blockquote { border-left: 3px solid #d1d5db; margin: 1em 0; padding-left: 1em; color: #6b7280; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #e5e7eb; padding: 8px 12px; text-align: left; }
    th { background: #f9fafb; font-weight: 600; }
    @media print { body { max-width: 100%; margin: 0; padding: 0; } }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p>${htmlBody}</p>
</body>
</html>`;
    },
    [],
  );

  /** ノート書き出し処理 */
  const handleExport = useCallback(
    async (format: "markdown" | "plaintext" | "html" | "pdf" | "docx") => {
      if (!activeNote) return;
      setMenuOpen(false);

      const title = activeNote.title || "無題のノート";

      switch (format) {
        case "markdown": {
          const content = editorContent;
          const fileName = `${title}.md`;
          try {
            const { save } = await import("@tauri-apps/plugin-dialog");
            const filePath = await save({
              defaultPath: fileName,
              filters: [{ name: "Markdown", extensions: ["md"] }],
            });
            if (filePath) {
              const { writeTextFile } = await import("@tauri-apps/plugin-fs");
              await writeTextFile(filePath, content);
              toast.success(`${fileName} を保存しました`);
            }
          } catch {
            toast.error("書き出しに失敗しました");
          }
          break;
        }

        case "plaintext": {
          const content = editorContent
            .replace(/^#{1,6}\s+/gm, "")
            .replace(/\*\*(.+?)\*\*/g, "$1")
            .replace(/\*(.+?)\*/g, "$1")
            .replace(/~~(.+?)~~/g, "$1")
            .replace(/`(.+?)`/g, "$1")
            .replace(/\[\[(.+?)\]\]/g, "$1")
            .replace(/!?\[([^\]]*)\]\([^)]+\)/g, "$1")
            .replace(/==(.+?)==/g, "$1")
            .replace(/@cite\{([^}]+)\}/g, "[$1]")
            .replace(/```[\s\S]*?```/g, ""); // コードブロック除去
          const fileName = `${title}.txt`;
          try {
            const { save } = await import("@tauri-apps/plugin-dialog");
            const filePath = await save({
              defaultPath: fileName,
              filters: [{ name: "テキスト", extensions: ["txt"] }],
            });
            if (filePath) {
              const { writeTextFile } = await import("@tauri-apps/plugin-fs");
              await writeTextFile(filePath, content);
              toast.success(`${fileName} を保存しました`);
            }
          } catch {
            toast.error("書き出しに失敗しました");
          }
          break;
        }

        case "html": {
          const content = markdownToHtml(editorContent, title);
          const fileName = `${title}.html`;
          try {
            const { save } = await import("@tauri-apps/plugin-dialog");
            const filePath = await save({
              defaultPath: fileName,
              filters: [{ name: "HTML", extensions: ["html", "htm"] }],
            });
            if (filePath) {
              const { writeTextFile } = await import("@tauri-apps/plugin-fs");
              await writeTextFile(filePath, content);
              toast.success(`${fileName} を保存しました`);
            }
          } catch {
            toast.error("書き出しに失敗しました");
          }
          break;
        }

        case "pdf": {
          // PDF エクスポート: Rust バックエンドの export_note_pdf コマンドを使用
          // フォールバック: HTML を経由してブラウザ印刷 API で PDF 出力
          const fileName = `${title}.pdf`;
          try {
            // まず Tauri コマンドを試行
            const { save } = await import("@tauri-apps/plugin-dialog");
            const filePath = await save({
              defaultPath: fileName,
              filters: [{ name: "PDF", extensions: ["pdf"] }],
            });
            if (!filePath) break;

            try {
              const { invoke } = await import("../../lib/tauriShim");
              const htmlContent = markdownToHtml(editorContent, title);
              await invoke("export_note_pdf", {
                html: htmlContent,
                outputPath: filePath,
              });
              toast.success(`${fileName} を保存しました`);
            } catch {
              // Tauri コマンド未実装時のフォールバック:
              // HTML をファイルとして書き出し、ユーザーにブラウザ印刷を案内
              const htmlContent = markdownToHtml(editorContent, title);
              const htmlPath = filePath.replace(/\.pdf$/i, ".html");
              const { writeTextFile } = await import("@tauri-apps/plugin-fs");
              await writeTextFile(htmlPath, htmlContent);
              toast.info(
                "PDF 変換コマンドが未実装のため、HTML ファイルとして保存しました。ブラウザで開いて「印刷 → PDF に保存」をご利用ください。"
              );
            }
          } catch {
            toast.error("PDF 書き出しに失敗しました");
          }
          break;
        }

        case "docx": {
          // DOCX エクスポート: Rust バックエンドの export_note_docx コマンドを使用
          // フォールバック: HTML 形式の .doc ファイル（Word 互換）を生成
          const fileName = `${title}.docx`;
          try {
            const { save } = await import("@tauri-apps/plugin-dialog");
            const filePath = await save({
              defaultPath: fileName,
              filters: [
                { name: "Word 文書", extensions: ["docx"] },
                { name: "Word 互換 HTML", extensions: ["doc"] },
              ],
            });
            if (!filePath) break;

            try {
              const { invoke } = await import("../../lib/tauriShim");
              const htmlContent = markdownToHtml(editorContent, title);
              await invoke("export_note_docx", {
                html: htmlContent,
                outputPath: filePath,
              });
              toast.success(`${fileName} を保存しました`);
            } catch {
              // Tauri コマンド未実装時のフォールバック:
              // Word 互換 HTML (.doc) を生成 — Word で正常に開ける
              const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
  <style>
    body { font-family: 'Yu Gothic', 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif; font-size: 10.5pt; line-height: 1.8; color: #1a1a1a; }
    h1 { font-size: 18pt; font-weight: bold; margin-top: 24pt; margin-bottom: 6pt; border-bottom: 1pt solid #d1d5db; padding-bottom: 4pt; }
    h2 { font-size: 14pt; font-weight: bold; margin-top: 18pt; margin-bottom: 4pt; }
    h3 { font-size: 12pt; font-weight: bold; margin-top: 14pt; margin-bottom: 4pt; }
    code { font-family: 'Courier New', monospace; font-size: 9pt; background-color: #f3f4f6; padding: 1pt 3pt; }
    pre { font-family: 'Courier New', monospace; font-size: 9pt; background-color: #f9fafb; border: 1pt solid #e5e7eb; padding: 8pt; white-space: pre-wrap; }
    mark { background-color: #fff59d; }
    .wikilink { color: #6366f1; text-decoration: underline; }
    .citation { color: #6366f1; font-weight: bold; }
    img { max-width: 100%; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1pt solid #d1d5db; padding: 4pt 8pt; }
    th { background-color: #f9fafb; font-weight: bold; }
  </style>
</head>
<body>
  ${markdownToHtml(editorContent, title)
    .replace(/<!DOCTYPE html>[\s\S]*?<body>/, "")
    .replace(/<\/body>[\s\S]*<\/html>/, "")}
</body>
</html>`;
              const docPath = filePath.replace(/\.docx$/i, ".doc");
              const { writeTextFile } = await import("@tauri-apps/plugin-fs");
              await writeTextFile(docPath, wordHtml);
              toast.success(
                `${title}.doc を保存しました（Word 互換 HTML 形式）`
              );
            }
          } catch {
            toast.error("DOCX 書き出しに失敗しました");
          }
          break;
        }
      }
    },
    [activeNote, editorContent, markdownToHtml],
  );

  /** キーボードショートカット */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      // Cmd+Shift+F → フォーカスモード
      if (isMod && e.shiftKey && e.key === "f") {
        e.preventDefault();
        toggleFocusMode();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleFocusMode]);

  /** メニュー外クリックで閉じる */
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  // ローディング
  if (loading && !activeNote) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ animation: "spin 1s linear infinite" }}
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <span className="text-sm">ノートを読み込んでいます…</span>
        </div>
      </div>
    );
  }

  // ノートが見つからない
  if (!activeNote) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="text-sm">ノートが見つかりません</span>
        </div>
      </div>
    );
  }

  /** エディタ部分（フォーカスモード / 通常モード共通） */
  const editorElement = (
    <StellarEditor
      noteId={activeNote.id}
      initialContent={activeNote.content}
      onSave={handleSave}
      onLinkClick={handleNavigate}
      onContentChange={handleContentChange}
    />
  );

  // フォーカスモード
  if (focusMode) {
    return (
      <FocusMode
        active={focusMode}
        onExit={() => setFocusMode(false)}
        noteTitle={activeNote.title}
        charCount={charCount}
        lastSavedAt={lastSavedAt}
      >
        {editorElement}
      </FocusMode>
    );
  }

  /** 自動保存ステータス表示テキスト */
  const statusText = (() => {
    switch (autoSaveStatus) {
      case "saving":
        return "保存中…";
      case "saved":
        return lastSavedAt ? `最終保存: ${lastSavedAt}` : "保存済み";
      case "error":
        return "保存エラー";
      default:
        return isModified ? "未保存" : lastSavedAt ? `最終保存: ${lastSavedAt}` : "";
    }
  })();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ツールバー */}
      <header
        className="flex items-center gap-2 px-4 shrink-0 select-none"
        style={{
          height: "44px",
          backgroundColor: "var(--color-bg-secondary)",
          borderBottom: "1px solid var(--color-border-primary)",
        }}
      >
        {/* 戻るボタン */}
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center justify-center"
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "6px",
            color: "var(--color-text-secondary)",
          }}
          title="一覧に戻る"
          aria-label="一覧に戻る"
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
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* タイトル（クリックで編集） */}
        {titleEditing ? (
          <input
            type="text"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={() => void handleTitleSave()}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleTitleSave();
              if (e.key === "Escape") {
                setTitleValue(activeNote.title);
                setTitleEditing(false);
              }
            }}
            autoFocus
            className="text-sm font-medium flex-1"
            style={{
              backgroundColor: "var(--color-bg-primary)",
              color: "var(--color-text-primary)",
              border: "1px solid var(--color-accent-primary)",
              borderRadius: "6px",
              padding: "4px 8px",
              outline: "none",
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setTitleEditing(true)}
            className="text-sm font-medium truncate text-left flex-1"
            style={{
              color: "var(--color-text-primary)",
              padding: "4px 8px",
              borderRadius: "6px",
            }}
            title="クリックでタイトルを編集"
          >
            {activeNote.title || "無題のノート"}
          </button>
        )}

        {/* フォーカスモードボタン */}
        <button
          type="button"
          onClick={toggleFocusMode}
          className="flex items-center justify-center"
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "6px",
            color: "var(--color-text-secondary)",
          }}
          title="フォーカスモード（Cmd+Shift+F）"
          aria-label="フォーカスモード"
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
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
        </button>

        {/* コンテキストパネルトグル */}
        <button
          type="button"
          onClick={() => setContextPanelOpen((p) => !p)}
          className="flex items-center justify-center"
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "6px",
            color: contextPanelOpen
              ? "var(--color-accent-primary)"
              : "var(--color-text-secondary)",
          }}
          title="コンテキストパネル"
          aria-label="コンテキストパネル"
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
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="15" y1="3" x2="15" y2="21" />
          </svg>
        </button>

        {/* メニューボタン */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((p) => !p)}
            className="flex items-center justify-center"
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              color: "var(--color-text-secondary)",
            }}
            title="メニュー"
            aria-label="メニュー"
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
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </button>

          {/* ドロップダウンメニュー */}
          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-1"
              style={{
                backgroundColor: "var(--color-bg-secondary)",
                border: "1px solid var(--color-border-primary)",
                borderRadius: "10px",
                boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
                minWidth: "200px",
                padding: "4px",
                zIndex: 50,
              }}
            >
              {/* 書き出しセクション */}
              <div
                className="text-xs font-semibold uppercase tracking-wider px-3 py-1.5"
                style={{ color: "var(--color-text-tertiary)", fontSize: "10px" }}
              >
                書き出し
              </div>

              {/* Markdown 書き出し */}
              <button
                type="button"
                className="flex items-center gap-2 w-full text-left text-xs px-3 py-2"
                style={{
                  color: "var(--color-text-secondary)",
                  borderRadius: "6px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--color-bg-tertiary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
                onClick={() => void handleExport("markdown")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                Markdown (.md)
              </button>

              {/* プレーンテキスト書き出し */}
              <button
                type="button"
                className="flex items-center gap-2 w-full text-left text-xs px-3 py-2"
                style={{
                  color: "var(--color-text-secondary)",
                  borderRadius: "6px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--color-bg-tertiary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
                onClick={() => void handleExport("plaintext")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="17" y1="10" x2="3" y2="10" />
                  <line x1="21" y1="6" x2="3" y2="6" />
                  <line x1="21" y1="14" x2="3" y2="14" />
                  <line x1="17" y1="18" x2="3" y2="18" />
                </svg>
                プレーンテキスト (.txt)
              </button>

              {/* HTML 書き出し */}
              <button
                type="button"
                className="flex items-center gap-2 w-full text-left text-xs px-3 py-2"
                style={{
                  color: "var(--color-text-secondary)",
                  borderRadius: "6px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--color-bg-tertiary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
                onClick={() => void handleExport("html")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
                HTML (.html)
              </button>

              {/* PDF 書き出し */}
              <button
                type="button"
                className="flex items-center gap-2 w-full text-left text-xs px-3 py-2"
                style={{
                  color: "var(--color-text-secondary)",
                  borderRadius: "6px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--color-bg-tertiary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
                onClick={() => void handleExport("pdf")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <path d="M10 12h4" />
                  <path d="M10 16h4" />
                </svg>
                PDF (.pdf)
              </button>

              {/* DOCX 書き出し */}
              <button
                type="button"
                className="flex items-center gap-2 w-full text-left text-xs px-3 py-2"
                style={{
                  color: "var(--color-text-secondary)",
                  borderRadius: "6px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--color-bg-tertiary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
                onClick={() => void handleExport("docx")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <path d="M9 15l2 2 4-4" />
                </svg>
                Word (.docx)
              </button>

              {/* セパレーター */}
              <div
                className="my-1"
                style={{ height: "1px", backgroundColor: "var(--color-border-secondary)" }}
              />

              {/* 削除 */}
              <button
                type="button"
                className="flex items-center gap-2 w-full text-left text-xs px-3 py-2"
                style={{
                  color: "var(--color-danger)",
                  borderRadius: "6px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    "var(--color-bg-tertiary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
                onClick={() => void handleDelete()}
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
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                ノートを削除
              </button>
            </div>
          )}
        </div>
      </header>

      {/* メインコンテンツ: エディタ（左） + コンテキストパネル（右） */}
      <div className="flex flex-1 overflow-hidden">
        {/* エディタペイン */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {editorElement}

          {/* ステータスバー */}
          <footer
            className="flex items-center justify-between px-4 shrink-0"
            style={{
              height: "28px",
              backgroundColor: "var(--color-bg-secondary)",
              borderTop: "1px solid var(--color-border-primary)",
            }}
          >
            <span
              className="text-xs"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {charCount.toLocaleString()}文字
            </span>
            <span
              className="text-xs"
              style={{
                color:
                  autoSaveStatus === "saving"
                    ? "var(--color-accent-primary)"
                    : autoSaveStatus === "error"
                      ? "var(--color-danger)"
                      : "var(--color-text-tertiary)",
              }}
            >
              {statusText}
            </span>
          </footer>
        </div>

        {/* コンテキストパネル（右） */}
        {contextPanelOpen && (
          <NoteContextPanel
            note={activeNote}
            editorContent={editorContent}
            onHeadingClick={handleHeadingClick}
            onNavigate={handleNavigate}
          />
        )}
      </div>
    </div>
  );
};
