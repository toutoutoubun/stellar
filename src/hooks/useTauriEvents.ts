// src/hooks/useTauriEvents.ts
// Stellar — Tauri イベントリスナーフック
// paper-import-request イベントを監視し、トースト通知 + 楽観的追加を行う

import { useEffect } from "react";
import { listen } from "../lib/tauriShim";
import type { Paper } from "../types";
import { useUIStore } from "../stores/useUIStore";
import { toast } from "../components/ui/Toast";
import { useI18nStore } from "../stores/useI18nStore";

/** Tauri バックエンドから送信される論文インポートリクエストのペイロード */
interface PaperImportPayload {
  /** インポート元（URL / DOI / ファイルパス） */
  source: string;
  /** パース済みの論文メタデータ（部分的） */
  paper?: Partial<Paper>;
}

/**
 * Tauri カスタムイベントをリッスンするフック。
 * App.tsx のトップレベルで 1 回だけ呼び出す。
 */
export function useTauriEvents(): void {
  const openPaper = useUIStore((s) => s.openPaper);

  useEffect(() => {
    // paper-import-request: 外部からの論文インポートリクエスト
    const unlistenImport = listen<PaperImportPayload>(
      "paper-import-request",
      (event) => {
        const payload = event.payload;

        // トースト通知
        toast.info(
          useI18nStore.getState().t.hooks.k_87adpo,
        );

        // 楽観的追加: パース済みの論文データがあればすぐに開く
        if (payload.paper?.id) {
          // バックエンドが既に ID を発行済みならそのまま開く
          openPaper(payload.paper.id);
        }

        // 注意: 実際のデータ保存はバックエンド側で行われる。
        // 保存完了後に "paper-imported" イベントが発火されるので、
        // ライブラリストアのリフレッシュはそちらで行う。
      },
    );

    // db-error: バックエンドの DB 初期化失敗通知
    // ファイル DB に接続できずインメモリ DB にフォールバックした場合に発火される。
    // ユーザーに明示的に警告し、データが保存されないことを伝える。
    const unlistenDbError = listen<string>(
      "db-error",
      (event) => {
        toast.error(
          "データベースの初期化に問題が発生しました。データが保存されない可能性があります。アプリを再起動してください。",
          10000,
        );
        console.error("[db-error]", event.payload);
      },
    );

    return () => {
      void unlistenImport.then((fn) => fn());
      void unlistenDbError.then((fn) => fn());
    };
  }, [openPaper]);
}
