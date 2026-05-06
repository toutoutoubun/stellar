// src/components/notes/StellarEditor.tsx
// Stellar — CodeMirror 6 カスタムエディタ
// Markdown 編集 + WikiLink構文ハイライト + ==ハイライト== + @cite{} + 自動保存
// テーマは CSS 変数と連動

import type React from "react";
import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import { EditorView, keymap, ViewUpdate } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
} from "@codemirror/autocomplete";
import {
  syntaxHighlighting,
  HighlightStyle,
  bracketMatching,
  indentOnInput,
} from "@codemirror/language";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { tags } from "@lezer/highlight";
import {
  Decoration,
  type DecorationSet,
  ViewPlugin,
  WidgetType,
  MatchDecorator,
} from "@codemirror/view";
import { invoke } from "../../lib/tauriShim";
import type { LinkSuggestion, NodeType } from "../../types";
import { wikiLinkCompletionSource } from "./WikiLinkAutoComplete";
import { MermaidDiagramModal } from "./MermaidDiagramModal";

// ============================================================
// Stellar テーマ（CSS変数連動）
// ============================================================

const stellarTheme = EditorView.theme(
  {
    "&": {
      fontSize: "15px",
      fontFamily: "var(--font-family-sans)",
      lineHeight: "1.8",
    },
    "&.cm-focused": {
      outline: "none",
    },
    ".cm-content": {
      caretColor: "var(--color-accent-primary)",
      padding: "16px 0",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--color-accent-primary)",
      borderLeftWidth: "2px",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      {
        backgroundColor: "var(--color-bg-selection)",
      },
    ".cm-activeLine": {
      backgroundColor: "transparent",
    },
    ".cm-gutters": {
      display: "none",
    },
    ".cm-scroller": {
      overflow: "auto",
    },
    // WikiLink デコレーション
    ".cm-wikilink": {
      color: "var(--color-accent-primary)",
      textDecoration: "underline",
      textDecorationStyle: "dotted",
      textUnderlineOffset: "3px",
      cursor: "pointer",
      borderRadius: "2px",
      padding: "0 1px",
    },
    ".cm-wikilink:hover": {
      backgroundColor: "var(--color-bg-hover)",
    },
    // ==ハイライト== デコレーション
    ".cm-highlight-mark": {
      backgroundColor: "rgba(255, 235, 59, 0.35)",
      borderRadius: "2px",
      padding: "1px 0",
    },
    // @cite{} デコレーション
    ".cm-citation-badge": {
      display: "inline-block",
      backgroundColor: "var(--color-accent-primary)",
      color: "#fff",
      fontSize: "11px",
      fontWeight: "500",
      padding: "1px 6px",
      borderRadius: "999px",
      verticalAlign: "baseline",
      lineHeight: "1.4",
      cursor: "pointer",
    },
    // 見出しの強調
    ".cm-header-1": {
      fontSize: "1.6em",
      fontWeight: "700",
      color: "var(--color-text-primary)",
      lineHeight: "1.4",
    },
    ".cm-header-2": {
      fontSize: "1.35em",
      fontWeight: "600",
      color: "var(--color-text-primary)",
      lineHeight: "1.4",
    },
    ".cm-header-3": {
      fontSize: "1.15em",
      fontWeight: "600",
      color: "var(--color-text-secondary)",
      lineHeight: "1.5",
    },
    // コードブロック
    ".cm-code-inline": {
      backgroundColor: "var(--color-bg-tertiary)",
      fontFamily: "var(--font-family-mono)",
      fontSize: "0.9em",
      padding: "2px 4px",
      borderRadius: "4px",
    },
  },
  { dark: false },
);

// ============================================================
// 構文ハイライトスタイル
// ============================================================

const stellarHighlightStyle = HighlightStyle.define([
  { tag: tags.heading1, class: "cm-header-1" },
  { tag: tags.heading2, class: "cm-header-2" },
  { tag: tags.heading3, class: "cm-header-3" },
  {
    tag: tags.heading4,
    fontWeight: "600",
    color: "var(--color-text-secondary)",
  },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.link, color: "var(--color-accent-primary)" },
  { tag: tags.url, color: "var(--color-accent-primary)", opacity: "0.7" },
  { tag: tags.monospace, class: "cm-code-inline" },
  {
    tag: tags.quote,
    color: "var(--color-text-secondary)",
    fontStyle: "italic",
    borderLeft: "3px solid var(--color-border-secondary)",
    paddingLeft: "12px",
  },
  { tag: tags.meta, color: "var(--color-text-tertiary)" },
  { tag: tags.processingInstruction, color: "var(--color-text-tertiary)" },
]);

// ============================================================
// WikiLink デコレーション ([[リンク記法]])
// ============================================================

const wikiLinkMatcher = new MatchDecorator({
  regexp: /\[\[([^\]]+)\]\]/g,
  decoration: (match) =>
    Decoration.mark({
      class: "cm-wikilink",
      attributes: {
        "data-wikilink": match[1] ?? "",
        title: match[1] ?? "",
      },
    }),
});

const wikiLinkPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = wikiLinkMatcher.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = wikiLinkMatcher.updateDeco(update, this.decorations);
    }
  },
  { decorations: (v) => v.decorations },
);

// ============================================================
// ==ハイライト== デコレーション
// ============================================================

const highlightMatcher = new MatchDecorator({
  regexp: /==([^=]+)==/g,
  decoration: () =>
    Decoration.mark({
      class: "cm-highlight-mark",
    }),
});

const highlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = highlightMatcher.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = highlightMatcher.updateDeco(update, this.decorations);
    }
  },
  { decorations: (v) => v.decorations },
);

// ============================================================
// @cite{id} デコレーション
// ============================================================

/** Citation バッジウィジェット */
class CitationWidget extends WidgetType {
  readonly citeKey: string;
  constructor(citeKey: string) {
    super();
    this.citeKey = citeKey;
  }
  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-citation-badge";
    // SVG アイコン（論文）をインラインで挿入
    const iconSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    iconSvg.setAttribute("width", "11");
    iconSvg.setAttribute("height", "11");
    iconSvg.setAttribute("viewBox", "0 0 24 24");
    iconSvg.setAttribute("fill", "none");
    iconSvg.setAttribute("stroke", "currentColor");
    iconSvg.setAttribute("stroke-width", "2");
    iconSvg.setAttribute("stroke-linecap", "round");
    iconSvg.setAttribute("stroke-linejoin", "round");
    iconSvg.style.verticalAlign = "middle";
    iconSvg.style.marginRight = "3px";
    iconSvg.innerHTML = '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>';
    span.appendChild(iconSvg);
    span.appendChild(document.createTextNode(` ${this.citeKey}`));
    span.title = `引用: ${this.citeKey}`;
    return span;
  }
  ignoreEvent(): boolean {
    return false;
  }
}

const citationMatcher = new MatchDecorator({
  regexp: /@cite\{([^}]+)\}/g,
  decoration: (match) =>
    Decoration.replace({
      widget: new CitationWidget(match[1] ?? ""),
    }),
});

const citationPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = citationMatcher.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = citationMatcher.updateDeco(update, this.decorations);
    }
  },
  { decorations: (v) => v.decorations },
);

// ============================================================
// Props
// ============================================================

interface StellarEditorProps {
  /** ノートID */
  noteId: string;
  /** 初期コンテンツ */
  initialContent: string;
  /** 保存コールバック（自動保存から呼ばれる） */
  onSave: (content: string) => void;
  /** リンククリックコールバック */
  onLinkClick: (targetId: string, targetType: NodeType) => void;
  /** コンテンツ変更コールバック（文字数カウント等に使用） */
  onContentChange?: (content: string) => void;
}

// ============================================================
// メインコンポーネント
// ============================================================

export const StellarEditor: React.FC<StellarEditorProps> = ({
  noteId,
  initialContent,
  onSave,
  onLinkClick,
  onContentChange,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // コールバック refs で最新値をキャプチャ
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const onContentChangeRef = useRef(onContentChange);
  onContentChangeRef.current = onContentChange;

  /** WikiLink オートコンプリート候補取得 */
  const getSuggestions = useCallback(
    async (query: string): Promise<LinkSuggestion[]> => {
      try {
        return await invoke<LinkSuggestion[]>("get_link_suggestions", {
          query,
        });
      } catch {
        return [];
      }
    },
    [],
  );

  /** WikiLink クリックハンドラ */
  const handleWikiLinkClick = useCallback(
    async (linkText: string) => {
      try {
        // Rust 側でリンク先を解決
        const result = await invoke<{ id: string; itemType: NodeType }>(
          "resolve_wikilink",
          { title: linkText },
        );
        onLinkClick(result.id, result.itemType);
      } catch {
        // リンク先が見つからない場合、新規ノート作成を促す
        // （将来的に新規ノート自動作成に拡張可能）
      }
    },
    [onLinkClick],
  );

  /** autoSave Extension — キー入力から1秒後に自動保存 */
  const autoSaveExtension = useMemo(
    () =>
      EditorView.updateListener.of((update: ViewUpdate) => {
        if (!update.docChanged) return;
        const content = update.state.doc.toString();
        onContentChangeRef.current?.(content);

        // 既存タイマーをクリア
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
        }
        // 1秒後に自動保存
        autoSaveTimerRef.current = setTimeout(() => {
          onSaveRef.current(content);
        }, 1000);
      }),
    [],
  );

  /** WikiLink クリックハンドラ Extension */
  const clickHandlerExtension = useMemo(
    () =>
      EditorView.domEventHandlers({
        click: (event: MouseEvent, _view: EditorView) => {
          const target = event.target as HTMLElement;
          // WikiLink をクリックした場合（Ctrl/Cmd + クリック）
          if (
            target.classList.contains("cm-wikilink") &&
            (event.metaKey || event.ctrlKey)
          ) {
            const linkText = target.getAttribute("data-wikilink");
            if (linkText) {
              event.preventDefault();
              void handleWikiLinkClick(linkText);
              return true;
            }
          }
          return false;
        },
      }),
    [handleWikiLinkClick],
  );

  // エディタの初期化
  useEffect(() => {
    if (!editorRef.current) return;

    const state = EditorState.create({
      doc: initialContent,
      extensions: [
        // 基本機能
        history(),
        bracketMatching(),
        closeBrackets(),
        indentOnInput(),
        highlightSelectionMatches(),

        // キーマップ
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          indentWithTab,
        ]),

        // Markdown
        markdown({
          base: markdownLanguage,
          codeLanguages: languages,
        }),

        // 構文ハイライト
        syntaxHighlighting(stellarHighlightStyle),

        // テーマ
        stellarTheme,

        // カスタムプラグイン
        wikiLinkPlugin,
        highlightPlugin,
        citationPlugin,

        // オートコンプリート（WikiLink）
        autocompletion({
          override: [wikiLinkCompletionSource(getSuggestions)],
          activateOnTyping: true,
          maxRenderedOptions: 10,
        }),

        // 自動保存
        autoSaveExtension,

        // WikiLink クリック
        clickHandlerExtension,

        // 行折り返し
        EditorView.lineWrapping,

        // テキスト選択許可
        EditorView.contentAttributes.of({
          "data-selectable": "true",
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      // クリーンアップ
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      view.destroy();
      viewRef.current = null;
    };
    // noteId 変更時にエディタを再生成
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  /** 画像ファイルをエディタに挿入する処理 */
  const handleImageInsert = useCallback(async (files: FileList | File[]) => {
    const view = viewRef.current;
    if (!view) return;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      try {
        // Tauri 経由で画像をアプリデータに保存
        const bytes = new Uint8Array(await file.arrayBuffer());
        const savedPath = await invoke<string>("save_note_attachment", {
          noteId,
          fileName: file.name,
          data: Array.from(bytes),
        });
        // Markdown 画像記法を挿入
        const imgMarkdown = `![${file.name}](${savedPath})`;
        const cursor = view.state.selection.main.head;
        // 現在行の先頭かどうかを判定して前後に改行を追加
        const line = view.state.doc.lineAt(cursor);
        const prefix = line.text.trim() === "" ? "" : "\n";
        const insert = `${prefix}${imgMarkdown}\n`;
        view.dispatch({
          changes: { from: cursor, insert },
          selection: { anchor: cursor + insert.length },
        });
      } catch {
        // save_note_attachment が未実装の場合、Base64 インラインで挿入
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const imgMarkdown = `![${file.name}](${dataUrl})`;
          const cursor = view.state.selection.main.head;
          const docLine = view.state.doc.lineAt(cursor);
          const prefix = docLine.text.trim() === "" ? "" : "\n";
          const insert = `${prefix}${imgMarkdown}\n`;
          view.dispatch({
            changes: { from: cursor, insert },
            selection: { anchor: cursor + insert.length },
          });
        };
        reader.readAsDataURL(file);
      }
    }
  }, [noteId]);

  /** ファイル選択ダイアログから画像を挿入 */
  const handleImageButtonClick = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = () => {
      if (input.files && input.files.length > 0) {
        void handleImageInsert(input.files);
      }
    };
    input.click();
  }, [handleImageInsert]);

  // Mermaid ダイアグラムモーダルの状態
  const [mermaidModalOpen, setMermaidModalOpen] = useState(false);

  /** Mermaid コードブロックをエディタに挿入 */
  const handleMermaidInsert = useCallback((mermaidCodeBlock: string) => {
    const view = viewRef.current;
    if (!view) return;
    const cursor = view.state.selection.main.head;
    const line = view.state.doc.lineAt(cursor);
    const prefix = line.text.trim() === "" ? "" : "\n\n";
    const insert = `${prefix}${mermaidCodeBlock}\n`;
    view.dispatch({
      changes: { from: cursor, insert },
      selection: { anchor: cursor + insert.length },
    });
  }, []);

  return (
    <>
    <MermaidDiagramModal
      open={mermaidModalOpen}
      onClose={() => setMermaidModalOpen(false)}
      onInsert={handleMermaidInsert}
    />
    <div className="flex flex-col flex-1 overflow-hidden" style={{ minHeight: 0 }}>
      {/* 画像挿入ツールバー */}
      <div
        className="flex items-center gap-1 px-6 shrink-0"
        style={{
          height: "32px",
          borderBottom: "1px solid var(--color-border-secondary)",
          backgroundColor: "var(--color-bg-secondary)",
        }}
      >
        <button
          type="button"
          onClick={handleImageButtonClick}
          className="flex items-center gap-1.5 text-xs"
          style={{
            color: "var(--color-text-tertiary)",
            padding: "3px 8px",
            borderRadius: "5px",
            transition: "all 150ms ease-out",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
            e.currentTarget.style.color = "var(--color-text-secondary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "var(--color-text-tertiary)";
          }}
          title="画像を挿入"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          画像を挿入
        </button>

        {/* セパレーター */}
        <div
          style={{
            width: "1px",
            height: "14px",
            backgroundColor: "var(--color-border-secondary)",
            margin: "0 2px",
          }}
        />

        {/* ダイアグラム挿入ボタン */}
        <button
          type="button"
          onClick={() => setMermaidModalOpen(true)}
          className="flex items-center gap-1.5 text-xs"
          style={{
            color: "var(--color-text-tertiary)",
            padding: "3px 8px",
            borderRadius: "5px",
            transition: "all 150ms ease-out",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
            e.currentTarget.style.color = "var(--color-text-secondary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "var(--color-text-tertiary)";
          }}
          title="ダイアグラムを挿入（Mermaid）"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="5" rx="1" />
            <rect x="14" y="3" width="7" height="5" rx="1" />
            <rect x="8" y="16" width="8" height="5" rx="1" />
            <line x1="6.5" y1="8" x2="6.5" y2="13" />
            <line x1="17.5" y1="8" x2="17.5" y2="13" />
            <line x1="6.5" y1="13" x2="17.5" y2="13" />
            <line x1="12" y1="13" x2="12" y2="16" />
          </svg>
          ダイアグラム
        </button>
      </div>

      {/* エディタ領域（ドラッグ&ドロップ対応） */}
      <div
        ref={editorRef}
        className="flex-1 overflow-auto"
        style={{
          backgroundColor: "var(--color-bg-primary)",
          color: "var(--color-text-primary)",
          padding: "0 24px",
          minHeight: 0,
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.style.outline = "2px dashed var(--color-accent-primary)";
          e.currentTarget.style.outlineOffset = "-4px";
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.currentTarget.style.outline = "none";
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.style.outline = "none";
          if (e.dataTransfer.files.length > 0) {
            void handleImageInsert(e.dataTransfer.files);
          }
        }}
      />
    </div>
    </>
  );
};
