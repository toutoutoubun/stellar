// src/hooks/useTauriEvents.ts
// Stellar — Tauri イベントリスナーフック
// paper-import-request イベントを監視し、トースト通知 + 楽観的追加を行う

import { useEffect } from "react";
import { listen } from "../lib/tauriShim";
import type { Paper } from "../types";
import { useUIStore } from "../stores/useUIStore";
import { toast } from "../components/ui/Toast";

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
    const unlisten = listen<PaperImportPayload>(
      "paper-import-request",
      (event) => {
        const payload = event.payload;

        // トースト通知
        toast.info(
          `論文をインポート中: ${payload.paper?.title ?? payload.source}`,
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

    return () => {
      // クリーンアップ: リスナー解除
      void unlisten.then((fn) => fn());
    };
  }, [openPaper]);
}
