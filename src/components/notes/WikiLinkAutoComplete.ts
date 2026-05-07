// src/components/notes/WikiLinkAutoComplete.ts
// Stellar — [[WikiLink]] オートコンプリート
// CodeMirror 6 の CompletionSource として実装
// [[ が入力されたらオートコンプリートを起動し、候補を表示する

import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import type { LinkSuggestion } from "../../types";
import { useI18nStore } from "../../stores/useI18nStore";

/**
 * WikiLink オートコンプリートの CompletionSource を生成する
 * @param getSuggestions  クエリ文字列から候補を取得する非同期関数
 *                        （内部で invoke('get_link_suggestions', { query }) を呼ぶ想定）
 */
export function wikiLinkCompletionSource(
  getSuggestions: (query: string) => Promise<LinkSuggestion[]>,
) {
  return async (
    context: CompletionContext,
  ): Promise<CompletionResult | null> => {
    // カーソル位置から後方に [[ を探す
    const line = context.state.doc.lineAt(context.pos);
    const textBefore = line.text.slice(0, context.pos - line.from);

    // 最後の [[ を見つける（未閉じの状態のみ）
    const openIdx = textBefore.lastIndexOf("[[");
    if (openIdx === -1) return null;

    // [[ の後ろに ]] が既にある場合は補完しない
    const afterOpen = textBefore.slice(openIdx + 2);
    if (afterOpen.includes("]]")) return null;

    // [[ から現在のカーソルまでのクエリ文字列を抽出
    const query = afterOpen;
    const from = line.from + openIdx + 2;

    // 明示的に呼ばれたか、1文字以上入力されている場合のみ補完
    if (!context.explicit && query.length === 0) return null;

    try {
      const suggestions = await getSuggestions(query);

      if (suggestions.length === 0) return null;

      return {
        from,
        to: context.pos,
        options: suggestions.map((s) => ({
          label: s.title,
          detail: s.detail ?? (s.type === "paper" ? useI18nStore.getState().t.settings.data.papers : useI18nStore.getState().t.notes.title),
          type: s.type === "paper" ? "class" : "text",
          // 補完確定時に [[タイトル]] を挿入（[[ は既に入力済み、]] を付加）
          apply: `${s.title}]]`,
          info: s.type === "paper" ? useI18nStore.getState().t.notes.k_re2tdz : useI18nStore.getState().t.notes.k_glszmd,
          boost: s.type === "note" ? 1 : 0,
        })),
        filter: true,
      };
    } catch {
      return null;
    }
  };
}
