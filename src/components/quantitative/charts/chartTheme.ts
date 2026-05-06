// src/components/quantitative/charts/chartTheme.ts
// Stellar — D3チャート共通テーマユーティリティ
// 4テーマ (white, ivory, dark-blue, black) 対応、CSS変数経由

/** CSS変数から値を取得 */
export function getCSSVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** テーマカラーパレット（CSS変数フォールバック付き） */
export function getThemeColors() {
  const accent = getCSSVar("--color-accent-primary") || "#4285f4";
  const accentSecondary = getCSSVar("--color-accent-secondary") || "#34a853";
  const danger = getCSSVar("--color-accent-danger") || "#e03131";
  const warning = getCSSVar("--color-accent-warning") || "#fbbc04";
  const textPrimary = getCSSVar("--color-text-primary") || "#1a1a2e";
  const textSecondary = getCSSVar("--color-text-secondary") || "#555";
  const textTertiary = getCSSVar("--color-text-tertiary") || "#888";
  const bgPrimary = getCSSVar("--color-bg-primary") || "#ffffff";
  const bgSecondary = getCSSVar("--color-bg-secondary") || "#f8f9fa";
  const border = getCSSVar("--color-border-primary") || "#e0e0e0";

  return {
    accent,
    accentSecondary,
    danger,
    warning,
    textPrimary,
    textSecondary,
    textTertiary,
    bgPrimary,
    bgSecondary,
    border,
  };
}

/** 暗いテーマかどうか判定 */
export function isDarkTheme(): boolean {
  const bg = getCSSVar("--color-bg-primary") || "#ffffff";
  // #rrggbb 形式から赤を取り出す
  const hex = bg.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16) || 255;
  return r < 128;
}

/** アクセントカラーを70%不透明度で返す */
export function accentWithOpacity(opacity = 0.7): string {
  const accent = getCSSVar("--color-accent-primary") || "#4285f4";
  return hexToRgba(accent, opacity);
}

/** HEXをRGBA文字列に変換 */
export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** カテゴリカル色パレット（8色） */
export function getCategoryColors(): string[] {
  const accent = getCSSVar("--color-accent-primary") || "#4285f4";
  const secondary = getCSSVar("--color-accent-secondary") || "#34a853";
  const warning = getCSSVar("--color-accent-warning") || "#fbbc04";
  const danger = getCSSVar("--color-accent-danger") || "#e03131";
  return [
    accent,
    secondary,
    warning,
    danger,
    "#8b5cf6",
    "#06b6d4",
    "#f97316",
    "#ec4899",
  ];
}

/** リッカート色スキーム（否定→中立→肯定） */
export function getLikertColors(): string[] {
  return isDarkTheme()
    ? ["#c92a2a", "#e03131", "#868e96", "#51cf66", "#37b24d"]
    : ["#e03131", "#fa5252", "#ced4da", "#69db7c", "#2f9e44"];
}

/** D3軸の共通スタイリング */
export function styleAxis(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  textColor: string,
  opts?: { fontSize?: string; domainOpacity?: number; tickOpacity?: number },
): void {
  const fs = opts?.fontSize ?? "9px";
  const dOp = opts?.domainOpacity ?? 0.3;
  const tOp = opts?.tickOpacity ?? 0.2;

  g.select(".domain").attr("stroke", textColor).attr("opacity", dOp);
  g.selectAll(".tick line").attr("stroke", textColor).attr("opacity", tOp);
  g.selectAll(".tick text").attr("fill", textColor).attr("font-size", fs);
}

/** ツールチップ要素を作成・管理するヘルパー */
export function createTooltip(container: HTMLElement): {
  show: (html: string, x: number, y: number) => void;
  hide: () => void;
  el: HTMLDivElement;
} {
  const existing = container.querySelector<HTMLDivElement>(".stellar-tooltip");
  if (existing) existing.remove();

  const el = document.createElement("div");
  el.className = "stellar-tooltip";
  el.style.cssText = `
    position: absolute;
    pointer-events: none;
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 11px;
    line-height: 1.4;
    z-index: 999;
    opacity: 0;
    transition: opacity 0.15s ease;
    white-space: nowrap;
    backdrop-filter: blur(8px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  `;
  container.appendChild(el);

  function applyTheme() {
    const dark = isDarkTheme();
    el.style.backgroundColor = dark ? "rgba(30,30,50,0.92)" : "rgba(255,255,255,0.95)";
    el.style.color = dark ? "#e0e0e0" : "#333";
    el.style.border = dark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.08)";
  }

  return {
    show(html: string, x: number, y: number) {
      applyTheme();
      el.innerHTML = html;
      el.style.left = `${x + 12}px`;
      el.style.top = `${y - 8}px`;
      el.style.opacity = "1";
    },
    hide() {
      el.style.opacity = "0";
    },
    el,
  };
}

// D3 namespace import for type usage
import type * as d3 from "d3";

/** 数値フォーマット */
export function fmt(v: number, dp = 2): string {
  if (!Number.isFinite(v)) return "—";
  return v.toFixed(dp);
}
