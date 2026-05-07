// src/lib/swal.ts
// SweetAlert2 ラッパー — アプリ全体の confirm / alert / toast を統一
// テーマカラー連動 + 日本語デフォルト

import Swal from "sweetalert2";

/** テーマ変数からカラーを取得 */
function css(varName: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallback;
}

/** アプリテーマに合わせた SweetAlert2 基本設定 */
function themed() {
  return Swal.mixin({
    background: css("--color-bg-modal", css("--color-bg-primary", "#fff")),
    color: css("--color-text-primary", "#1a1a2e"),
    confirmButtonColor: css("--color-accent-primary", "#4285f4"),
    cancelButtonColor: css("--color-text-tertiary", "#999"),
    customClass: {
      popup: "stellar-swal-popup",
      title: "stellar-swal-title",
      htmlContainer: "stellar-swal-html",
      confirmButton: "stellar-swal-btn",
      cancelButton: "stellar-swal-btn-cancel",
    },
    buttonsStyling: true,
    showClass: { popup: "swal2-show", backdrop: "swal2-backdrop-show" },
    hideClass: { popup: "swal2-hide", backdrop: "swal2-backdrop-hide" },
  });
}

// ─── 公開 API ───────────────────────────────────

/** 確認ダイアログ（削除等の破壊的操作用） */
export async function swalConfirm(
  title: string,
  text?: string,
  options?: {
    confirmText?: string;
    cancelText?: string;
    icon?: "warning" | "question" | "info";
  },
): Promise<boolean> {
  const result = await themed().fire({
    title,
    text,
    icon: options?.icon ?? "warning",
    showCancelButton: true,
    confirmButtonText: options?.confirmText ?? "はい",
    cancelButtonText: options?.cancelText ?? "キャンセル",
    reverseButtons: true,
    focusCancel: true,
  });
  return result.isConfirmed;
}

/** 成功通知（トースト） */
export function swalSuccess(title: string, text?: string): void {
  themed().fire({
    title,
    text,
    icon: "success",
    timer: 2000,
    timerProgressBar: true,
    showConfirmButton: false,
    toast: true,
    position: "top-end",
  });
}

/** エラー通知 */
export function swalError(title: string, text?: string): void {
  themed().fire({
    title,
    text,
    icon: "error",
    confirmButtonText: "OK",
  });
}

/** 情報通知（トースト） */
export function swalInfo(title: string, text?: string): void {
  themed().fire({
    title,
    text,
    icon: "info",
    timer: 2500,
    timerProgressBar: true,
    showConfirmButton: false,
    toast: true,
    position: "top-end",
  });
}

/** テキスト入力付きダイアログ */
export async function swalPrompt(
  title: string,
  options?: {
    inputLabel?: string;
    inputPlaceholder?: string;
    inputValue?: string;
    confirmText?: string;
  },
): Promise<string | null> {
  const result = await themed().fire({
    title,
    input: "text",
    inputLabel: options?.inputLabel,
    inputPlaceholder: options?.inputPlaceholder ?? "",
    inputValue: options?.inputValue ?? "",
    showCancelButton: true,
    confirmButtonText: options?.confirmText ?? "OK",
    cancelButtonText: "キャンセル",
    reverseButtons: true,
    inputValidator: (value: string) => {
      if (!value.trim()) return "入力してください";
      return null;
    },
  });
  return result.isConfirmed ? (result.value as string) : null;
}

export { Swal };
export default Swal;
