// src/utils/highlight.ts
// Stellar — スニペット強調表示ユーティリティ
// Rustバックエンドから返される [[match]] 形式のスニペットを
// React ノードに変換し、ヒット箇所を <mark> で強調する

import { createElement, type ReactNode, Fragment } from "react";
import { useI18nStore } from "../stores/useI18nStore";

/**
 * [[match]] 形式のスニペットを解析して React ノード配列に変換する
 *
 * 例: "前の文章 [[ヒットワード]] 後の文章"
 * →  [<span>前の文章 </span>, <mark>ヒットワード</mark>, <span> 後の文章</span>]
 */
export function parseSnippet(snippet: string): ReactNode {
  if (!snippet) return null;

  // [[...]] パターンを分割
  const parts = snippet.split(/\[\[(.+?)\]\]/g);

  if (parts.length === 1) {
    // マッチなし — そのまま返す
    return snippet;
  }

  const nodes: ReactNode[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;

    if (i % 2 === 0) {
      // 通常テキスト
      nodes.push(
        createElement("span", { key: `t-${i}` }, part),
      );
    } else {
      // マッチ部分 → <mark> で強調
      nodes.push(
        createElement(
          "mark",
          {
            key: `m-${i}`,
            style: {
              background: "var(--color-highlight-yellow)",
              borderRadius: "3px",
              padding: "0 2px",
              color: "inherit",
            },
          },
          part,
        ),
      );
    }
  }

  return createElement(Fragment, null, ...nodes);
}

/**
 * 日付文字列を「YYYY/MM/DD」形式にフォーマット
 */
export function formatDate(isoStr: string): string {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return "—";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

/**
 * 日付文字列を相対時間（例: "3分前", "2日前"）に変換
 */
export function formatRelativeTime(isoStr: string): string {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return "—";

  const now = Date.now();
  const diff = now - d.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return useI18nStore.getState().t.notes.justNow;
  if (minutes < 60) return t.utils.k_3v7tp8;
  if (hours < 24) return t.utils.k_vp30vd;
  if (days < 7) return t.utils.k_6zn26v;
  return formatDate(isoStr);
}
