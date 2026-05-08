// src/components/quantitative/DatasetList.tsx
// Stellar — データセット一覧 + 新規作成モーダル
// source_type バッジ付きリスト、右クリックコンテキストメニュー

import type React from "react";
import { useState, useCallback, useRef, useEffect } from "react";
import { useQuantitativeStore } from "../../stores/useQuantitativeStore";
import { useQualitativeStore } from "../../stores/useQualitativeStore";
import { useLibraryStore } from "../../stores/useLibraryStore";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { toast } from "../ui/Toast";
import type { DatasetSourceType } from "../../types";
import { useT, useI18nStore } from "../../stores/useI18nStore";
import { IconEdit, IconTag, IconClipboard, IconTrash } from "../ui/Icons";

// ── ソースタイプのバッジ設定 ──
const SOURCE_BADGES: Record<
  DatasetSourceType,
  { label: string; bg: string; text: string }
> = {
  csv: { label: "CSV", bg: "rgba(66, 133, 244, 0.15)", text: "#4285f4" },
  manual: { label: useI18nStore.getState().t.quantitative.k_eslep, bg: "rgba(52, 168, 83, 0.15)", text: "#34a853" },
  codes: {
    label: useI18nStore.getState().t.quantitative.k_gaoaw2,
    bg: "rgba(160, 140, 255, 0.15)",
    text: "#a08cff",
  },
  highlights: {
    label: useI18nStore.getState().t.quantitative.k_jgxomi,
    bg: "rgba(251, 140, 0, 0.15)",
    text: "#fb8c00",
  },
};

// ── 作成ソース選択肢 ──
type CreateSource = "csv" | "manual" | "codes" | "highlights";
const CREATE_SOURCES: { key: CreateSource; label: string; desc: string }[] = [
  {
    key: "csv",
    label: useI18nStore.getState().t.quantitative.k_otnss7,
    desc: useI18nStore.getState().t.quantitative.k_1m423,
  },
  {
    key: "manual",
    label: useI18nStore.getState().t.quantitative.k_eslep,
    desc: useI18nStore.getState().t.quantitative.k_gsikxv,
  },
  {
    key: "codes",
    label: useI18nStore.getState().t.quantitative.k_udnti7,
    desc: useI18nStore.getState().t.quantitative.k_fij35e,
  },
  {
    key: "highlights",
    label: useI18nStore.getState().t.quantitative.k_txzgk9,
    desc: useI18nStore.getState().t.quantitative.k_9z5ic3,
  },
];

export const DatasetList: React.FC = () => {
  const t = useT();
  const datasets = useQuantitativeStore((s) => s.datasets);
  const selectedDataset = useQuantitativeStore((s) => s.selectedDataset);
  const selectDataset = useQuantitativeStore((s) => s.selectDataset);
  const deleteDataset = useQuantitativeStore((s) => s.deleteDataset);
  const createDatasetManually = useQuantitativeStore(
    (s) => s.createDatasetManually,
  );
  const createDatasetFromCodes = useQuantitativeStore(
    (s) => s.createDatasetFromCodes,
  );
  const createDatasetFromHighlights = useQuantitativeStore(
    (s) => s.createDatasetFromHighlights,
  );
  const setTab = useQuantitativeStore((s) => s.setTab);
  const updateDataset = useQuantitativeStore((s) => s.updateDataset);
  const isLoading = useQuantitativeStore((s) => s.isLoading);

  // QDA プロジェクト（コード生成用）
  const qualProjects = useQualitativeStore((s) => s.projects);
  const loadQualProjects = useQualitativeStore((s) => s.loadProjects);

  // 論文一覧（ハイライト生成用）
  const papers = useLibraryStore((s) => s.papers);

  // モーダル制御
  const [modalOpen, setModalOpen] = useState(false);
  const [createSource, setCreateSource] = useState<CreateSource>("csv");
  const [datasetName, setDatasetName] = useState("");
  const [datasetDesc, setDatasetDesc] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedPaperId, setSelectedPaperId] = useState("");

  // コンテキストメニュー
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    datasetId: string;
  } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // モーダル表示時に QDA プロジェクトを読み込み
  useEffect(() => {
    if (modalOpen && createSource === "codes") {
      void loadQualProjects();
    }
  }, [modalOpen, createSource, loadQualProjects]);

  // コンテキストメニュー外クリックで閉じる
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [contextMenu]);

  // ── モーダルを開く ──
  const handleOpenModal = useCallback(() => {
    setModalOpen(true);
    setCreateSource("csv");
    setDatasetName("");
    setDatasetDesc("");
    setSelectedProjectId("");
    setSelectedPaperId("");
  }, []);

  // ── 自動名前サジェスト ──
  const getAutoName = useCallback((source: CreateSource): string => {
    switch (source) {
      case "csv":
        return t.quantitative.k_ewifof;
      case "manual":
        return t.quantitative.k_n15ubc;
      case "codes":
        return t.quantitative.k_wq3gz3;
      case "highlights":
        return t.quantitative.k_d7dk5g;
    }
  }, []);

  // ソース変更時に自動名前設定
  const handleSourceChange = useCallback(
    (source: CreateSource) => {
      setCreateSource(source);
      if (!datasetName || CREATE_SOURCES.some((s) => datasetName.startsWith(s.label.split(t.quantitative.k_8hb2)[0] ?? ""))) {
        setDatasetName(getAutoName(source));
      }
    },
    [datasetName, getAutoName],
  );

  // ── 作成実行 ──
  const handleCreate = useCallback(async () => {
    const name = datasetName.trim() || getAutoName(createSource);

    try {
      if (createSource === "csv") {
        // CSV: まず空のデータセットを作成し、インポートタブに遷移
        await createDatasetManually(name, datasetDesc);
        setTab("import");
        toast.success(t.quantitative.k_7zq8nc);
      } else if (createSource === "manual") {
        await createDatasetManually(name, datasetDesc);
        setTab("variables");
        toast.success(t.quantitative.k_7zq8nc);
      } else if (createSource === "codes") {
        if (!selectedProjectId) {
          toast.warning(t.quantitative.k_un0ypx);
          return;
        }
        await createDatasetFromCodes(selectedProjectId, name);
        setTab("preview");
        toast.success(
          t.quantitative.k_t1hi1i,
        );
      } else if (createSource === "highlights") {
        await createDatasetFromHighlights(
          selectedPaperId || undefined,
        );
        setTab("preview");
        toast.success(
          t.quantitative.k_t1hi1i,
        );
      }
      setModalOpen(false);
    } catch {
      // エラーはストアで処理済み
    }
  }, [
    createSource,
    datasetName,
    datasetDesc,
    selectedProjectId,
    selectedPaperId,
    getAutoName,
    createDatasetManually,
    createDatasetFromCodes,
    createDatasetFromHighlights,
    setTab,
  ]);

  // ── コンテキストメニュー ──
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, datasetId: string) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, datasetId });
    },
    [],
  );

  const handleDeleteFromContext = useCallback(async () => {
    if (!contextMenu) return;
    try {
      await deleteDataset(contextMenu.datasetId);
      toast.success(t.quantitative.k_lzypz9);
    } catch {
      // エラーはストアで処理済み
    }
    setContextMenu(null);
  }, [contextMenu, deleteDataset]);

  const handleGenerateCodesFromContext = useCallback(() => {
    if (!contextMenu) return;
    void selectDataset(contextMenu.datasetId);
    setContextMenu(null);
    // コード生成モーダルを開く
    setCreateSource("codes");
    setModalOpen(true);
  }, [contextMenu, selectDataset]);

  const handleGenerateHighlightsFromContext = useCallback(() => {
    if (!contextMenu) return;
    void selectDataset(contextMenu.datasetId);
    setContextMenu(null);
    setCreateSource("highlights");
    setModalOpen(true);
  }, [contextMenu, selectDataset]);

  // ── 日付フォーマット ──
  const formatDate = (dateStr: string): string => {
    try {
      const d = new Date(dateStr);
      return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      {/* ── ヘッダー ── */}
      <div
        className="shrink-0 flex items-center justify-between px-4"
        style={{
          height: "44px",
          borderBottom: "1px solid var(--color-border-primary)",
        }}
      >
        <span
          className="text-sm font-semibold"
          style={{ color: "var(--color-text-primary)" }}
        >
          データセット
        </span>
        <Button
          variant="primary"
          size="sm"
          onClick={handleOpenModal}
          icon={
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          }
        >
          新規
        </Button>
      </div>

      {/* ── データセット一覧 ── */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {datasets.length === 0 && !isLoading && (
          <div
            className="flex flex-col items-center justify-center py-12 gap-3"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ opacity: 0.4 }}
            >
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            </svg>
            <p className="text-xs text-center">
              データセットがありません
              <br />
              「＋ 新規」から作成してください
            </p>
          </div>
        )}

        {datasets.map((ds, idx) => {
          const isSelected = selectedDataset?.id === ds.id;
          const badge = SOURCE_BADGES[ds.sourceType];
          return (
            <button
              key={ds.id}
              onClick={() => selectDataset(ds.id)}
              onContextMenu={(e) => handleContextMenu(e, ds.id)}
              className="w-full text-left px-3 py-2.5 flex flex-col gap-1 select-none"
              style={{
                borderRadius: "var(--radius-button)",
                backgroundColor: isSelected
                  ? "var(--color-bg-active)"
                  : "transparent",
                border: isSelected
                  ? "1px solid var(--color-border-focus)"
                  : "1px solid transparent",
                transition: "all var(--transition-fast)",
                animation: `card-stagger-in 200ms ease-out ${idx * 30}ms both`,
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor =
                    "var(--color-bg-hover)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = "transparent";
                }
              }}
            >
              {/* 名前 + バッジ */}
              <div className="flex items-center gap-2">
                <span
                  className="text-sm font-medium truncate flex-1"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {ds.name}
                </span>
                <span
                  className="shrink-0 text-[10px] font-medium px-1.5 py-0.5"
                  style={{
                    backgroundColor: badge.bg,
                    color: badge.text,
                    borderRadius: "var(--radius-tag)",
                  }}
                >
                  {badge.label}
                </span>
              </div>

              {/* メタ情報 */}
              <div
                className="flex items-center gap-2 text-[11px]"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                <span>{t.quantitative.k_rows_label.replace("${count}", String(ds.rowCount))}</span>
                <span>·</span>
                <span>{formatDate(ds.createdAt)}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── コンテキストメニュー ── */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed animate-scale-in"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: "var(--z-dropdown)",
            backgroundColor: "var(--color-bg-card)",
            borderRadius: "var(--radius-button)",
            boxShadow: "var(--shadow-dropdown)",
            border: "1px solid var(--color-border-primary)",
            minWidth: "160px",
            padding: "4px",
          }}
        >
          {[
            {
              label: t.quantitative.k_ay4t7v,
              icon: <IconEdit size={13} />,
              action: () => {
                if (!contextMenu) return;
                const ds = datasets.find((d) => d.id === contextMenu.datasetId);
                if (!ds) { setContextMenu(null); return; }
                const newName = window.prompt(t.quantitative.k_otpnnt, ds.name);
                if (newName && newName.trim() && newName.trim() !== ds.name) {
                  void updateDataset(ds.id, { name: newName.trim() })
                    .then(() => toast.success(t.quantitative.k_7zq8nc))
                    .catch(() => toast.error("更新に失敗しました"));
                }
                setContextMenu(null);
              },
            },
            {
              label: t.quantitative.k_y5e6kx,
              icon: <IconTag size={13} />,
              action: handleGenerateCodesFromContext,
            },
            {
              label: t.quantitative.k_txzgk9,
              icon: <IconClipboard size={13} />,
              action: handleGenerateHighlightsFromContext,
            },
            { label: "separator", icon: null as React.ReactNode, action: () => {} },
            {
              label: t.common.delete,
              icon: <IconTrash size={13} />,
              action: handleDeleteFromContext,
              danger: true,
            },
          ].map((item, i) =>
            item.label === "separator" ? (
              <div
                key={`sep-${String(i)}`}
                className="my-1"
                style={{
                  height: "1px",
                  backgroundColor: "var(--color-border-secondary)",
                }}
              />
            ) : (
              <button
                key={item.label}
                onClick={item.action}
                className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2"
                style={{
                  borderRadius: "6px",
                  color: (item as { danger?: boolean }).danger
                    ? "var(--color-accent-danger)"
                    : "var(--color-text-primary)",
                  transition: "background-color var(--transition-fast)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    "var(--color-bg-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ),
          )}
        </div>
      )}

      {/* ── 新規データセット作成モーダル ── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t.quantitative.k_2jvud1}
        width="520px"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="primary"
              onClick={handleCreate}
              loading={isLoading}
            >
              作成
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {/* ソース選択 */}
          <div className="space-y-2">
            <label
              className="text-xs font-medium"
              style={{ color: "var(--color-text-secondary)" }}
            >
              データソース
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CREATE_SOURCES.map((src) => {
                const isActive = createSource === src.key;
                return (
                  <button
                    key={src.key}
                    onClick={() => handleSourceChange(src.key)}
                    className="text-left p-3 flex flex-col gap-1"
                    style={{
                      borderRadius: "var(--radius-card)",
                      border: isActive
                        ? "2px solid var(--color-accent-primary)"
                        : "1px solid var(--color-border-primary)",
                      backgroundColor: isActive
                        ? "var(--color-bg-selection)"
                        : "var(--color-bg-input)",
                      transition: "all var(--transition-fast)",
                    }}
                  >
                    <span
                      className="text-sm font-medium"
                      style={{
                        color: isActive
                          ? "var(--color-accent-primary)"
                          : "var(--color-text-primary)",
                      }}
                    >
                      {src.label}
                    </span>
                    <span
                      className="text-[11px]"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      {src.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 名前入力 */}
          <Input
            label={t.quantitative.k_otpnnt}
            value={datasetName}
            onChange={(e) => setDatasetName(e.target.value)}
            placeholder={t.quantitative.k_br9jg0}
            fullWidth
          />

          {/* 説明（手入力・CSV 時のみ） */}
          {(createSource === "manual" || createSource === "csv") && (
            <div className="flex flex-col gap-1">
              <label
                className="text-xs font-medium"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {t.qualitative.k_knmvip}
              </label>
              <textarea
                value={datasetDesc}
                onChange={(e) => setDatasetDesc(e.target.value)}
                placeholder={t.quantitative.k_eq1j72}
                rows={2}
                className="w-full text-sm resize-none selectable"
                data-selectable="true"
                style={{
                  backgroundColor: "var(--color-bg-input)",
                  color: "var(--color-text-primary)",
                  border: "1px solid var(--color-border-primary)",
                  borderRadius: "var(--radius-input)",
                  padding: "var(--space-2) var(--space-3)",
                  fontSize: "var(--font-size-sm)",
                  transition: "all var(--transition-fast)",
                }}
              />
            </div>
          )}

          {/* QDA プロジェクトピッカー */}
          {createSource === "codes" && (
            <div className="flex flex-col gap-1">
              <label
                className="text-xs font-medium"
                style={{ color: "var(--color-text-secondary)" }}
              >
                QDAプロジェクト
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full text-sm"
                style={{
                  backgroundColor: "var(--color-bg-input)",
                  color: "var(--color-text-primary)",
                  border: "1px solid var(--color-border-primary)",
                  borderRadius: "var(--radius-input)",
                  padding: "var(--space-2) var(--space-3)",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                <option value="">{t.quantitative.k_select_project_ds}</option>
                {qualProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 論文ピッカー */}
          {createSource === "highlights" && (
            <div className="flex flex-col gap-1">
              <label
                className="text-xs font-medium"
                style={{ color: "var(--color-text-secondary)" }}
              >
                論文（任意 — 指定しない場合は全ハイライト）
              </label>
              <select
                value={selectedPaperId}
                onChange={(e) => setSelectedPaperId(e.target.value)}
                className="w-full text-sm"
                style={{
                  backgroundColor: "var(--color-bg-input)",
                  color: "var(--color-text-primary)",
                  border: "1px solid var(--color-border-primary)",
                  borderRadius: "var(--radius-input)",
                  padding: "var(--space-2) var(--space-3)",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                <option value="">{t.quantitative.k_all_papers}</option>
                {papers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};
