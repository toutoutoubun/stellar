// src/components/search/SearchModal.tsx
// Stellar — グローバル全文検索モーダル
// React Portal で body 直下にマウント
// Cmd+K で開閉、ESC / バックドロップクリックで閉じる
// 検索入力 + タブフィルタ + 結果表示 + キーボードナビゲーション

import type React from "react";
import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useUIStore } from "../../stores/useUIStore";
import type { SearchResultItem, RecentItem } from "../../types";
import { useSearch } from "../../hooks/useSearch";
import { SearchInput } from "./SearchInput";
import { SearchResults } from "./SearchResults";

export const SearchModal: React.FC = () => {
  const isOpen = useUIStore((s) => s.searchModalOpen);
  const closeModal = useUIStore((s) => s.closeSearchModal);
  const openPaper = useUIStore((s) => s.openPaper);
  const openNote = useUIStore((s) => s.openNote);

  const {
    query,
    setQuery,
    activeTab,
    setActiveTab,
    results,
    isLoading,
    selectedIndex,
    setSelectedIndex,
    handleKeyDown,
    getSelectedItem,
    flatResults,
    recentItems,
    reset,
  } = useSearch();

  const modalRef = useRef<HTMLDivElement>(null);

  // モーダルを閉じるときにリセット
  const handleClose = useCallback(() => {
    closeModal();
    // 少し遅延してリセット（アニメーション用）
    setTimeout(() => reset(), 200);
  }, [closeModal, reset]);

  /** 検索結果アイテムを開く */
  const handleItemClick = useCallback(
    (item: SearchResultItem) => {
      handleClose();
      if (item.itemType === "paper") {
        openPaper(item.paperId ?? item.id);
      } else if (item.itemType === "note") {
        openNote(item.noteId ?? item.id);
      } else if (item.itemType === "highlight" && item.paperId) {
        openPaper(item.paperId);
      }
    },
    [handleClose, openPaper, openNote],
  );

  /** 最近開いた項目を開く */
  const handleRecentItemClick = useCallback(
    (item: RecentItem) => {
      handleClose();
      if (item.itemType === "paper") {
        openPaper(item.id);
      } else {
        openNote(item.id);
      }
    },
    [handleClose, openPaper, openNote],
  );

  /** Enter で選択中アイテムを開く */
  const handleEnter = useCallback(() => {
    const item = getSelectedItem();
    if (item) {
      handleItemClick(item);
    }
  }, [getSelectedItem, handleItemClick]);

  /** ESC キーでモーダルを閉じる */
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [isOpen, handleClose]);

  /** バックドロップクリック */
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      // モーダル外クリック判定
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        handleClose();
      }
    },
    [handleClose],
  );

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex justify-center"
      style={{
        zIndex: "var(--z-modal-overlay)",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        paddingTop: "max(20vh, 100px)",
        animation: "fade-in 150ms ease-out both",
      }}
      onClick={handleBackdropClick}
      onKeyDown={() => {}}
      role="dialog"
      aria-modal="true"
      aria-label="全文検索"
    >
      {/* モーダル本体 */}
      <div
        ref={modalRef}
        className="flex flex-col"
        style={{
          width: "100%",
          maxWidth: "680px",
          maxHeight: "min(70vh, 600px)",
          backgroundColor: "var(--color-bg-modal)",
          borderRadius: "var(--radius-modal)",
          boxShadow: "var(--shadow-modal)",
          border: "1px solid var(--color-border-primary)",
          overflow: "hidden",
          animation: "scale-in 150ms ease-out both",
          alignSelf: "flex-start",
        }}
      >
        {/* 検索入力 */}
        <SearchInput
          value={query}
          onChange={setQuery}
          isLoading={isLoading}
          onKeyDown={handleKeyDown}
          onEnter={handleEnter}
        />

        {/* 検索結果 */}
        <SearchResults
          query={query}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          results={results}
          flatResults={flatResults}
          isLoading={isLoading}
          selectedIndex={selectedIndex}
          onSelectedIndexChange={setSelectedIndex}
          onItemClick={handleItemClick}
          recentItems={recentItems}
          onRecentItemClick={handleRecentItemClick}
        />
      </div>
    </div>,
    document.body,
  );
};
