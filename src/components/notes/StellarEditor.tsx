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
import { useI18nStore } from "../../stores/useI18nStore";

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
    span.title = useI18nStore.getState().t.notes.k_ulvl3p;
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

  // ── 書式挿入ヘルパー ──

  /** 選択テキストを wrap するか、空なら placeholder を挿入 */
  const wrapSelection = useCallback(
    (before: string, after: string, placeholder: string) => {
      const view = viewRef.current;
      if (!view) return;
      const { from, to } = view.state.selection.main;
      const selected = view.state.sliceDoc(from, to);
      const text = selected || placeholder;
      const insert = `${before}${text}${after}`;
      view.dispatch({
        changes: { from, to, insert },
        selection: {
          anchor: from + before.length,
          head: from + before.length + text.length,
        },
      });
      view.focus();
    },
    [],
  );

  /** 行頭にプレフィックスを追加 */
  const insertLinePrefix = useCallback((prefix: string) => {
    const view = viewRef.current;
    if (!view) return;
    const cursor = view.state.selection.main.head;
    const line = view.state.doc.lineAt(cursor);
    view.dispatch({
      changes: { from: line.from, to: line.from, insert: prefix },
      selection: { anchor: line.from + prefix.length },
    });
    view.focus();
  }, []);

  /** カーソル位置にブロックテキストを挿入 */
  const insertBlock = useCallback((text: string) => {
    const view = viewRef.current;
    if (!view) return;
    const cursor = view.state.selection.main.head;
    const line = view.state.doc.lineAt(cursor);
    const prefix = line.text.trim() === "" ? "" : "\n\n";
    const insert = `${prefix}${text}\n`;
    view.dispatch({
      changes: { from: cursor, insert },
      selection: { anchor: cursor + insert.length },
    });
    view.focus();
  }, []);

  /** ツールバーボタン共通スタイル */
  const tbBtnStyle: React.CSSProperties = {
    color: "var(--color-text-tertiary)",
    padding: "3px 6px",
    borderRadius: "5px",
    transition: "all 120ms ease-out",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
  const tbEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
    e.currentTarget.style.color = "var(--color-text-secondary)";
  };
  const tbLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.backgroundColor = "transparent";
    e.currentTarget.style.color = "var(--color-text-tertiary)";
  };

  /** セパレーター */
  const Sep = () => (
    <div
      style={{
        width: "1px",
        height: "14px",
        backgroundColor: "var(--color-border-secondary)",
        margin: "0 2px",
        flexShrink: 0,
      }}
    />
  );

  return (
    <>
    <MermaidDiagramModal
      open={mermaidModalOpen}
      onClose={() => setMermaidModalOpen(false)}
      onInsert={handleMermaidInsert}
    />
    <div className="flex flex-col flex-1 overflow-hidden" style={{ minHeight: 0 }}>
      {/* ── 書式ツールバー（学術論文執筆向け） ── */}
      <div
        className="flex items-center gap-0.5 px-4 shrink-0 overflow-x-auto"
        style={{
          height: "36px",
          borderBottom: "1px solid var(--color-border-secondary)",
          backgroundColor: "var(--color-bg-secondary)",
        }}
      >
        {/* 見出し */}
        <button type="button" style={tbBtnStyle} onMouseEnter={tbEnter} onMouseLeave={tbLeave}
          onClick={() => insertLinePrefix("# ")} title={useI18nStore.getState().t.notes.k_a48qdd}>
          <span style={{ fontSize: "12px", fontWeight: 700, lineHeight: 1 }}>H1</span>
        </button>
        <button type="button" style={tbBtnStyle} onMouseEnter={tbEnter} onMouseLeave={tbLeave}
          onClick={() => insertLinePrefix("## ")} title={useI18nStore.getState().t.notes.k_9n73yb}>
          <span style={{ fontSize: "11px", fontWeight: 700, lineHeight: 1 }}>H2</span>
        </button>
        <button type="button" style={tbBtnStyle} onMouseEnter={tbEnter} onMouseLeave={tbLeave}
          onClick={() => insertLinePrefix("### ")} title={useI18nStore.getState().t.notes.k_965hj9}>
          <span style={{ fontSize: "10px", fontWeight: 700, lineHeight: 1 }}>H3</span>
        </button>

        <Sep />

        {/* 太字 */}
        <button type="button" style={tbBtnStyle} onMouseEnter={tbEnter} onMouseLeave={tbLeave}
          onClick={() => wrapSelection("**", "**", useI18nStore.getState().t.notes.k_j5jmrn)} title={useI18nStore.getState().t.notes.k_xd3aky}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
        </button>
        {/* 斜体 */}
        <button type="button" style={tbBtnStyle} onMouseEnter={tbEnter} onMouseLeave={tbLeave}
          onClick={() => wrapSelection("*", "*", useI18nStore.getState().t.notes.k_azkroz)} title={useI18nStore.getState().t.notes.k_gnhdwh}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
        </button>
        {/* 取り消し線 */}
        <button type="button" style={tbBtnStyle} onMouseEnter={tbEnter} onMouseLeave={tbLeave}
          onClick={() => wrapSelection("~~", "~~", useI18nStore.getState().t.notes.k_asaurn)} title={useI18nStore.getState().t.notes.k_ks737t}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4H9a3 3 0 0 0-3 3v0a3 3 0 0 0 3 3h6"/><line x1="4" y1="12" x2="20" y2="12"/><path d="M15 12a3 3 0 0 1 0 6H8"/></svg>
        </button>
        {/* ハイライト */}
        <button type="button" style={tbBtnStyle} onMouseEnter={tbEnter} onMouseLeave={tbLeave}
          onClick={() => wrapSelection("==", "==", useI18nStore.getState().t.settings.data.highlights)} title={useI18nStore.getState().t.settings.data.highlights}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>
        </button>
        {/* インラインコード */}
        <button type="button" style={tbBtnStyle} onMouseEnter={tbEnter} onMouseLeave={tbLeave}
          onClick={() => wrapSelection("`", "`", "code")} title={useI18nStore.getState().t.notes.k_qwgcbb}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        </button>

        <Sep />

        {/* 箇条書き */}
        <button type="button" style={tbBtnStyle} onMouseEnter={tbEnter} onMouseLeave={tbLeave}
          onClick={() => insertLinePrefix("- ")} title={useI18nStore.getState().t.notes.k_moc2fq}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>
        </button>
        {/* 番号付きリスト */}
        <button type="button" style={tbBtnStyle} onMouseEnter={tbEnter} onMouseLeave={tbLeave}
          onClick={() => insertLinePrefix("1. ")} title={useI18nStore.getState().t.notes.k_bopui1}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="2" y="8" fontSize="8" fill="currentColor" fontFamily="sans-serif" fontWeight="600">1</text><text x="2" y="14" fontSize="8" fill="currentColor" fontFamily="sans-serif" fontWeight="600">2</text><text x="2" y="20" fontSize="8" fill="currentColor" fontFamily="sans-serif" fontWeight="600">3</text></svg>
        </button>
        {/* 引用 */}
        <button type="button" style={tbBtnStyle} onMouseEnter={tbEnter} onMouseLeave={tbLeave}
          onClick={() => insertLinePrefix("> ")} title={useI18nStore.getState().t.notes.k_eybskq}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z"/></svg>
        </button>

        <Sep />

        {/* テーブル挿入 */}
        <button type="button" style={tbBtnStyle} onMouseEnter={tbEnter} onMouseLeave={tbLeave}
          onClick={() => insertBlock(useI18nStore.getState().t.notes.k_fomfvw)} title={useI18nStore.getState().t.notes.k_vwpl9p}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
        </button>
        {/* 脚注 */}
        <button type="button" style={tbBtnStyle} onMouseEnter={tbEnter} onMouseLeave={tbLeave}
          onClick={() => {
            const view = viewRef.current;
            if (!view) return;
            const cursor = view.state.selection.main.head;
            // 既存の脚注数をカウントして次の番号を決定
            const doc = view.state.doc.toString();
            const fnCount = (doc.match(/\[\^\d+\]/g) ?? []).length / 2 + 1;
            const id = String(fnCount);
            const ref = `[^${id}]`;
            const def = `\n\n[^${id}]: ${useI18nStore.getState().t.notes.k_footnote_text}`;
            view.dispatch({
              changes: [
                { from: cursor, insert: ref },
                { from: view.state.doc.length, insert: def },
              ],
            });
            view.focus();
          }} title={useI18nStore.getState().t.notes.k_lijex6}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><text x="8" y="14" fontSize="10" fill="currentColor" fontFamily="sans-serif" fontWeight="700">*</text></svg>
        </button>
        {/* 引用（@cite） */}
        <button type="button" style={tbBtnStyle} onMouseEnter={tbEnter} onMouseLeave={tbLeave}
          onClick={() => wrapSelection("@cite{", "}", "author2024")} title={useI18nStore.getState().t.notes.k_i7nim9}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        </button>
        {/* 水平線 */}
        <button type="button" style={tbBtnStyle} onMouseEnter={tbEnter} onMouseLeave={tbLeave}
          onClick={() => insertBlock("---")} title={useI18nStore.getState().t.notes.k_4qbkn1}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="2" y1="12" x2="22" y2="12"/></svg>
        </button>

        <Sep />

        {/* 画像 */}
        <button type="button" style={tbBtnStyle} onMouseEnter={tbEnter} onMouseLeave={tbLeave}
          onClick={handleImageButtonClick} title={useI18nStore.getState().t.notes.k_sg08yk}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        </button>
        {/* ダイアグラム */}
        <button type="button" style={tbBtnStyle} onMouseEnter={tbEnter} onMouseLeave={tbLeave}
          onClick={() => setMermaidModalOpen(true)} title={useI18nStore.getState().t.notes.k_bo10cn}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="5" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="8" y="16" width="8" height="5" rx="1"/><line x1="6.5" y1="8" x2="6.5" y2="13"/><line x1="17.5" y1="8" x2="17.5" y2="13"/><line x1="6.5" y1="13" x2="17.5" y2="13"/><line x1="12" y1="13" x2="12" y2="16"/></svg>
        </button>
        {/* コードブロック */}
        <button type="button" style={tbBtnStyle} onMouseEnter={tbEnter} onMouseLeave={tbLeave}
          onClick={() => insertBlock(`\`\`\`\n${useI18nStore.getState().t.notes.k_code_placeholder}\n\`\`\``)} title={useI18nStore.getState().t.notes.k_ejhizv}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="m9 10-2 2 2 2"/><path d="m15 10 2 2-2 2"/></svg>
        </button>
        {/* WikiLink */}
        <button type="button" style={tbBtnStyle} onMouseEnter={tbEnter} onMouseLeave={tbLeave}
          onClick={() => wrapSelection("[[", "]]", useI18nStore.getState().t.notes.k_6difsy)} title={useI18nStore.getState().t.settings.shortcuts.items.insertWikiLink}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
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
