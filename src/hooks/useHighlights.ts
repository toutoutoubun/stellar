// src/hooks/useHighlights.ts
// Stellar — ハイライト管理カスタムフック
// Tauri バックエンドとの CRUD 通信、楽観的更新、debounce コメント保存を提供

import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "../lib/tauriShim";
import type {
  Highlight,
  HighlightColor,
  HighlightRect,
  CreateHighlightInput,
} from "../types";
import { toast } from "../components/ui/Toast";
import { useI18nStore } from "../stores/useI18nStore";

/** debounce 用タイマーマップ（ハイライトID → タイマーID） */
type TimerMap = Map<string, ReturnType<typeof setTimeout>>;

/** コメント保存中のハイライトIDセット */
type SavingSet = Set<string>;

/** useHighlights フックの戻り値 */
export interface UseHighlightsReturn {
  /** ハイライト一覧 */
  highlights: Highlight[];
  /** 読み込み中フラグ */
  isLoading: boolean;
  /** 選択中のハイライトID一覧 */
  selectedHighlightIds: Set<string>;
  /** コメント保存中のハイライトIDセット */
  savingCommentIds: Set<string>;
  /** ハイライト追加（楽観的更新） */
  addHighlight: (
    text: string,
    color: HighlightColor,
    page: number,
    rect: HighlightRect,
  ) => Promise<Highlight | null>;
  /** コメント更新（500ms debounce） */
  updateComment: (highlightId: string, comment: string) => void;
  /** ハイライト削除（即時） */
  deleteHighlight: (highlightId: string) => Promise<void>;
  /** 選択トグル */
  toggleSelect: (highlightId: string) => void;
  /** 全選択解除 */
  clearSelection: () => void;
  /** 選択ハイライトからノートを生成 */
  createNoteFromSelected: () => Promise<string | null>;
  /** ハイライトの再読み込み */
  reload: () => Promise<void>;
}

export type HighlightTargetKind = "paper" | "qualitativeSource";

/**
 * ハイライト管理カスタムフック
 * @param targetId 対象論文または質的分析ソースのID
 */
export function useHighlights(
  targetId: string,
  targetKind: HighlightTargetKind = "paper",
): UseHighlightsReturn {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedHighlightIds, setSelectedHighlightIds] = useState<Set<string>>(
    new Set(),
  );
  const [savingCommentIds, setSavingCommentIds] = useState<Set<string>>(
    new Set(),
  );

  // debounce タイマー管理用 ref（再レンダリングに依存しない）
  const debounceTimers = useRef<TimerMap>(new Map());
  const savingSet = useRef<SavingSet>(new Set());

  /** ハイライト取得 */
  const fetchHighlights = useCallback(async () => {
    setIsLoading(true);
    try {
      const result =
        targetKind === "qualitativeSource"
          ? await invoke<Highlight[]>("get_qualitative_source_highlights", {
              sourceId: targetId,
            })
          : await invoke<Highlight[]>("get_highlights", {
              paperId: targetId,
            });
      // createdAt 昇順でソート
      const sorted = [...result].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      setHighlights(sorted);
    } catch (err) {
      const message = typeof err === "string" ? err : useI18nStore.getState().t.hooks.k_15m56x;
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [targetId, targetKind]);

  // 初回読み込み
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- legitimate data sync/fetch pattern
    void fetchHighlights();
  }, [fetchHighlights]);

  // アンマウント時にすべての debounce タイマーをクリア
  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  /** ハイライト追加（楽観的更新） */
  const addHighlight = useCallback(
    async (
      text: string,
      color: HighlightColor,
      page: number,
      rect: HighlightRect,
    ): Promise<Highlight | null> => {
      const input: CreateHighlightInput = {
        ...(targetKind === "qualitativeSource"
          ? { sourceId: targetId }
          : { paperId: targetId }),
        text,
        color,
        page,
        rect,
      };

      // 楽観的更新用の仮データ（UUID は Rust 側で生成されるので仮ID）
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimisticHighlight: Highlight = {
        id: tempId,
        paperId: targetId,
        sourceId: targetKind === "qualitativeSource" ? targetId : null,
        text,
        comment: null,
        color,
        page,
        rect,
        createdAt: new Date().toISOString(),
      };

      // 楽観的にUIに追加
      setHighlights((prev) => [...prev, optimisticHighlight]);

      try {
        const created =
          targetKind === "qualitativeSource"
            ? await invoke<Highlight>("create_qualitative_source_highlight", { input })
            : await invoke<Highlight>("create_highlight", { input });
        // 仮IDを実際のIDに置換
        setHighlights((prev) =>
          prev.map((h) => (h.id === tempId ? created : h)),
        );
        return created;
      } catch (err) {
        // 失敗時は楽観的に追加したデータを削除
        setHighlights((prev) => prev.filter((h) => h.id !== tempId));
        const message =
          typeof err === "string" ? err : useI18nStore.getState().t.hooks.k_9x4ym1;
        toast.error(message);
        return null;
      }
    },
    [targetId, targetKind],
  );

  /** コメント更新（500ms debounce） */
  const updateComment = useCallback(
    (highlightId: string, comment: string) => {
      // UI上ではすぐに反映
      setHighlights((prev) =>
        prev.map((h) =>
          h.id === highlightId ? { ...h, comment: comment || null } : h,
        ),
      );

      // 保存中フラグを立てる
      savingSet.current.add(highlightId);
      setSavingCommentIds(new Set(savingSet.current));

      // 既存タイマーをクリア
      const existing = debounceTimers.current.get(highlightId);
      if (existing) {
        clearTimeout(existing);
      }

      // 500ms 後にバックエンドへ保存
      const timer = setTimeout(async () => {
        try {
          await invoke(
            targetKind === "qualitativeSource"
              ? "update_qualitative_source_highlight_comment"
              : "update_highlight_comment",
            {
              id: highlightId,
              comment: comment || "",
            },
          );
        } catch (err) {
          const message =
            typeof err === "string" ? err : useI18nStore.getState().t.hooks.k_jkw2ka;
          toast.error(message);
        } finally {
          // 保存中フラグを下ろす
          savingSet.current.delete(highlightId);
          setSavingCommentIds(new Set(savingSet.current));
          debounceTimers.current.delete(highlightId);
        }
      }, 500);

      debounceTimers.current.set(highlightId, timer);
    },
    [targetKind],
  );

  /** ハイライト削除（即時） */
  const deleteHighlight = useCallback(async (highlightId: string) => {
    // 楽観的に削除
    setHighlights((prev) => prev.filter((h) => h.id !== highlightId));
    setSelectedHighlightIds((prev) => {
      const next = new Set(prev);
      next.delete(highlightId);
      return next;
    });

    try {
      await invoke(
        targetKind === "qualitativeSource"
          ? "delete_qualitative_source_highlight"
          : "delete_highlight",
        { id: highlightId },
      );
      toast.success(useI18nStore.getState().t.hooks.k_fr4nj7);
    } catch (err) {
      // 削除失敗時は再読み込みで整合性を回復
      const message =
        typeof err === "string" ? err : useI18nStore.getState().t.hooks.k_opvwls;
      toast.error(message);
      void fetchHighlights();
    }
  }, [fetchHighlights, targetKind]);

  /** 選択トグル */
  const toggleSelect = useCallback((highlightId: string) => {
    setSelectedHighlightIds((prev) => {
      const next = new Set(prev);
      if (next.has(highlightId)) {
        next.delete(highlightId);
      } else {
        next.add(highlightId);
      }
      return next;
    });
  }, []);

  /** 全選択解除 */
  const clearSelection = useCallback(() => {
    setSelectedHighlightIds(new Set());
  }, []);

  /** 選択ハイライトからノートを生成 */
  const createNoteFromSelected = useCallback(async (): Promise<
    string | null
  > => {
    const ids = Array.from(selectedHighlightIds);
    if (ids.length === 0) {
      toast.info(useI18nStore.getState().t.hooks.k_vynamp);
      return null;
    }

    try {
      const noteId =
        targetKind === "qualitativeSource"
          ? await invoke<string>("create_note_from_source_highlights", {
              highlightIds: ids,
              sourceId: targetId,
            })
          : await invoke<string>("create_note_from_highlights", {
              highlightIds: ids,
              paperId: targetId,
            });
      toast.success(useI18nStore.getState().t.hooks.k_hup4rp);
      setSelectedHighlightIds(new Set());
      return noteId;
    } catch (err) {
      const message =
        typeof err === "string" ? err : useI18nStore.getState().t.notes.createFailed;
      toast.error(message);
      return null;
    }
  }, [selectedHighlightIds, targetId, targetKind]);

  return {
    highlights,
    isLoading,
    selectedHighlightIds,
    savingCommentIds,
    addHighlight,
    updateComment,
    deleteHighlight,
    toggleSelect,
    clearSelection,
    createNoteFromSelected,
    reload: fetchHighlights,
  };
}
