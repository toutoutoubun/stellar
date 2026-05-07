// src/components/library/AddPaperModal.tsx
// Stellar — 論文追加モーダル
// 3タブ構成: URLから追加 / DOIから追加 / 手動入力
// メタデータプレビュー → 編集可能 → 保存

import type React from "react";
import { useState, useCallback } from "react";
import type { CreatePaperInput } from "../../types";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { toast } from "../ui/Toast";
import { invoke } from "../../lib/tauriShim";
import { useI18nStore } from "../../stores/useI18nStore";

/** タブの種別 */
type AddPaperTab = "pdf" | "url" | "doi" | "manual";

/** タブ定義 */
const TABS: { key: AddPaperTab; label: string }[] = [
  { key: "pdf", label: useI18nStore.getState().t.library.k_69gmr7 },
  { key: "url", label: useI18nStore.getState().t.library.k_fc9gz4 },
  { key: "doi", label: useI18nStore.getState().t.library.k_mjxfup },
  { key: "manual", label: useI18nStore.getState().t.library.k_cqu9fk },
];

interface AddPaperModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (input: CreatePaperInput) => Promise<void>;
}

/** フォームの初期値 */
const EMPTY_FORM: CreatePaperInput = {
  title: "",
  authors: [],
  year: null,
  journal: null,
  volume: null,
  issue: null,
  pages: null,
  doi: null,
  url: null,
  abstract: null,
  pdfPath: null,
  tags: [],
};

/** 骨格スクリーン（ローディング表示） */
const SkeletonField: React.FC<{ width?: string }> = ({ width = "100%" }) => (
  <div
    className="animate-pulse"
    style={{
      height: "32px",
      backgroundColor: "var(--color-bg-tertiary)",
      borderRadius: "var(--radius-input)",
      width,
    }}
  />
);

const SkeletonForm: React.FC = () => (
  <div className="flex flex-col gap-3">
    <SkeletonField />
    <SkeletonField width="70%" />
    <div className="flex gap-3">
      <SkeletonField width="30%" />
      <SkeletonField width="40%" />
      <SkeletonField width="30%" />
    </div>
    <SkeletonField />
    <SkeletonField />
  </div>
);

export const AddPaperModal: React.FC<AddPaperModalProps> = ({
  open,
  onClose,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<AddPaperTab>("pdf");
  const [form, setForm] = useState<CreatePaperInput>({ ...EMPTY_FORM });
  const [authorsText, setAuthorsText] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [saving, setSaving] = useState(false);

  // URL / DOI 入力用
  const [urlInput, setUrlInput] = useState("");
  const [doiInput, setDoiInput] = useState("");

  // PDFも一緒に保存チェック
  const [downloadPdf, setDownloadPdf] = useState(false);

  // PDFファイルパス（PDFタブ用）
  const [pdfFilePath, setPdfFilePath] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);

  // ── フォームリセット ──
  const resetForm = useCallback(() => {

    setForm({ ...EMPTY_FORM });
    setAuthorsText("");
    setTagsText("");
    setFetched(false);
    setUrlInput("");
    setDoiInput("");
    setDownloadPdf(false);
    setFetching(false);
    setSaving(false);
    setPdfFilePath(null);
    setPdfFileName(null);
  }, []);

  // ── タブ切替時にリセット ──
  const handleTabChange = useCallback(
    (tab: AddPaperTab) => {
      setActiveTab(tab);
      resetForm();
    },
    [resetForm]
  );

  // ── モーダルを閉じるときにリセット ──
  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  // ── メタデータを取得してフォームに反映する共通関数 ──
  const applyMetadata = useCallback(
    (data: Partial<CreatePaperInput>) => {
      const updated: CreatePaperInput = {
        ...EMPTY_FORM,
        ...data,
      };
      setForm(updated);
      setAuthorsText((data.authors ?? []).join(", "));
      setTagsText((data.tags ?? []).join(", "));
      setFetched(true);
    },
    []
  );

  // ── URLからメタデータ取得 ──
  const handleFetchFromUrl = useCallback(async () => {
    if (!urlInput.trim()) {
      toast.warning(useI18nStore.getState().t.library.k_svpfs8);
      return;
    }
    setFetching(true);
    setFetched(false);
    try {
      const data = await invoke<Partial<CreatePaperInput>>(
        "fetch_metadata_from_url",
        { url: urlInput.trim() }
      );
      applyMetadata({ ...data, url: urlInput.trim() });
      toast.success(useI18nStore.getState().t.library.k_2uf93e);
    } catch (e) {
      toast.error(t.library.k_qr44fw);
    } finally {
      setFetching(false);
    }
  }, [urlInput, applyMetadata]);

  // ── DOIからメタデータ取得 ──
  const handleFetchFromDoi = useCallback(async () => {
    if (!doiInput.trim()) {
      toast.warning(useI18nStore.getState().t.library.k_kgo94p);
      return;
    }
    setFetching(true);
    setFetched(false);
    try {
      const data = await invoke<Partial<CreatePaperInput>>(
        "fetch_metadata_by_doi",
        { doi: doiInput.trim() }
      );
      applyMetadata({ ...data, doi: doiInput.trim() });
      toast.success(useI18nStore.getState().t.library.k_2uf93e);
    } catch (e) {
      toast.error(t.library.k_qr44fw);
    } finally {
      setFetching(false);
    }
  }, [doiInput, applyMetadata]);

  // ── フォームフィールド更新 ──
  const updateField = useCallback(
    <K extends keyof CreatePaperInput>(
      key: K,
      value: CreatePaperInput[K]
    ) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // ── 著者テキスト → 配列変換 ──
  const handleAuthorsChange = useCallback((text: string) => {
    setAuthorsText(text);
    const authors = text
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "");
    setForm((prev) => ({ ...prev, authors }));
  }, []);

  // ── タグテキスト → 配列変換 ──
  const handleTagsChange = useCallback((text: string) => {
    setTagsText(text);
    const tags = text
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "");
    setForm((prev) => ({ ...prev, tags }));
  }, []);

  // ── PDFファイル選択（Tauriダイアログ） ──
  const handlePickPdf = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (selected && typeof selected === "string") {
        setPdfFilePath(selected);
        // ファイル名を抽出
        const name = selected.split(/[\\/]/).pop() ?? selected;
        setPdfFileName(name);

        // Rust側でPDFメタデータ抽出を試みる
        setFetching(true);
        setFetched(false);
        try {
          const data = await invoke<Partial<CreatePaperInput>>(
            "extract_metadata_from_pdf",
            { pdfPath: selected }
          );
          applyMetadata({ ...data, pdfPath: selected });
          toast.success(useI18nStore.getState().t.library.k_lc058i);
        } catch {
          // メタデータ抽出が失敗してもファイルパスは保持
          const titleFromFile = name.replace(/\.pdf$/i, "").replace(/[_-]/g, " ");
          applyMetadata({ title: titleFromFile, pdfPath: selected });
          toast.info(useI18nStore.getState().t.library.k_eqyro1);
        } finally {
          setFetching(false);
        }
      }
    } catch {
      // ダイアログがキャンセルされた場合
    }
  }, [applyMetadata]);

  // ── 保存 ──
  const handleSave = useCallback(async () => {
    if (!form.title.trim()) {
      toast.warning(useI18nStore.getState().t.library.k_2mde7w);
      return;
    }
    // PDFタブでpdfPathが未設定の場合、選択済みパスを反映
    const finalForm = { ...form };
    if (activeTab === "pdf" && pdfFilePath && !finalForm.pdfPath) {
      finalForm.pdfPath = pdfFilePath;
    }
    setSaving(true);
    try {
      await onSave(finalForm);
      toast.success(useI18nStore.getState().t.library.k_9cffqr);
      handleClose();
    } catch (e) {
      toast.error(t.library.k_w7nzmp);
    } finally {
      setSaving(false);
    }
  }, [form, activeTab, pdfFilePath, onSave, handleClose]);

  // ── フォームフィールド群の描画 ──
  const renderFormFields = () => (
    <div className="flex flex-col gap-3">
      {/* タイトル */}
      <Input
        label={useI18nStore.getState().t.library.k_3n500e}
        value={form.title}
        onChange={(e) => updateField("title", e.target.value)}
        placeholder={useI18nStore.getState().t.library.k_nqxsud}
        fullWidth
      />

      {/* 著者（カンマ区切り） */}
      <Input
        label={useI18nStore.getState().t.library.k_tm1buw}
        value={authorsText}
        onChange={(e) => handleAuthorsChange(e.target.value)}
        placeholder={useI18nStore.getState().t.library.k_y8v2ho}
        fullWidth
      />

      {/* 年 + ジャーナル */}
      <div className="flex gap-3">
        <div style={{ width: "100px" }}>
          <Input
            label={useI18nStore.getState().t.library.k_ck7ty}
            type="number"
            value={form.year !== null && form.year !== undefined ? String(form.year) : ""}
            onChange={(e) => {
              const val = e.target.value;
              updateField("year", val ? parseInt(val, 10) : null);
            }}
            placeholder="2024"
            fullWidth
          />
        </div>
        <div className="flex-1">
          <Input
            label={useI18nStore.getState().t.library.k_f45ryr}
            value={form.journal ?? ""}
            onChange={(e) =>
              updateField("journal", e.target.value || null)
            }
            placeholder={useI18nStore.getState().t.library.k_mra1e}
            fullWidth
          />
        </div>
      </div>

      {/* 巻 + 号 + ページ */}
      <div className="flex gap-3">
        <div style={{ flex: 1 }}>
          <Input
            label={useI18nStore.getState().t.library.k_ikb}
            value={form.volume ?? ""}
            onChange={(e) =>
              updateField("volume", e.target.value || null)
            }
            placeholder="Vol."
            fullWidth
          />
        </div>
        <div style={{ flex: 1 }}>
          <Input
            label={useI18nStore.getState().t.library.k_gl3}
            value={form.issue ?? ""}
            onChange={(e) =>
              updateField("issue", e.target.value || null)
            }
            placeholder="No."
            fullWidth
          />
        </div>
        <div style={{ flex: 1 }}>
          <Input
            label={useI18nStore.getState().t.library.k_7e6xi}
            value={form.pages ?? ""}
            onChange={(e) =>
              updateField("pages", e.target.value || null)
            }
            placeholder="1-20"
            fullWidth
          />
        </div>
      </div>

      {/* DOI + URL */}
      <div className="flex gap-3">
        <div className="flex-1">
          <Input
            label="DOI"
            value={form.doi ?? ""}
            onChange={(e) =>
              updateField("doi", e.target.value || null)
            }
            placeholder="10.1234/xxxxx"
            fullWidth
          />
        </div>
        <div className="flex-1">
          <Input
            label="URL"
            value={form.url ?? ""}
            onChange={(e) =>
              updateField("url", e.target.value || null)
            }
            placeholder="https://..."
            fullWidth
          />
        </div>
      </div>

      {/* アブストラクト */}
      <div className="flex flex-col gap-1">
        <label
          className="text-xs font-medium"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {t.library.k_hq997l}
        </label>
        <textarea
          className="w-full text-sm selectable"
          style={{
            backgroundColor: "var(--color-bg-input)",
            color: "var(--color-text-primary)",
            border: "1px solid var(--color-border-primary)",
            borderRadius: "var(--radius-input)",
            padding: "var(--space-2) var(--space-3)",
            fontSize: "var(--font-size-sm)",
            fontFamily: "inherit",
            resize: "vertical",
            minHeight: "80px",
            outline: "none",
            transition: "border-color var(--transition-fast)",
          }}
          value={form.abstract ?? ""}
          onChange={(e) =>
            updateField("abstract", e.target.value || null)
          }
          placeholder={useI18nStore.getState().t.library.k_palb1q}
          data-selectable="true"
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--color-border-focus)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--color-border-primary)";
          }}
        />
      </div>

      {/* タグ（カンマ区切り） */}
      <Input
        label={useI18nStore.getState().t.library.k_f41763}
        value={tagsText}
        onChange={(e) => handleTagsChange(e.target.value)}
        placeholder={useI18nStore.getState().t.library.k_stzku}
        fullWidth
      />
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={useI18nStore.getState().t.library.k_cdnwe4}
      width="600px"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={saving}>
            {t.common.cancel}
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleSave()}
            loading={saving}
            disabled={!form.title.trim()}
          >
            {t.items.save}
          </Button>
        </>
      }
    >
      {/* ── タブバー ── */}
      <div
        className="flex gap-0 mb-4 shrink-0"
        style={{
          borderBottom: "1px solid var(--color-border-secondary)",
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className="px-4 py-2 text-xs font-medium"
            style={{
              color:
                activeTab === tab.key
                  ? "var(--color-accent-primary)"
                  : "var(--color-text-tertiary)",
              borderBottom:
                activeTab === tab.key
                  ? "2px solid var(--color-accent-primary)"
                  : "2px solid transparent",
              transition: "all var(--transition-fast)",
              marginBottom: "-1px",
            }}
            onClick={() => handleTabChange(tab.key)}
            onMouseEnter={(e) => {
              if (activeTab !== tab.key) {
                e.currentTarget.style.color = "var(--color-text-secondary)";
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.key) {
                e.currentTarget.style.color = "var(--color-text-tertiary)";
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab 0: PDFから追加 ── */}
      {activeTab === "pdf" && (
        <div className="flex flex-col gap-4">
          {/* PDFファイル選択エリア */}
          {!pdfFilePath ? (
            <button
              type="button"
              onClick={() => void handlePickPdf()}
              className="flex flex-col items-center justify-center gap-3 py-10"
              style={{
                border: "2px dashed var(--color-border-primary)",
                borderRadius: "var(--radius-card)",
                color: "var(--color-text-tertiary)",
                backgroundColor: "var(--color-bg-tertiary)",
                cursor: "pointer",
                transition: "all var(--transition-fast)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--color-accent-primary)";
                e.currentTarget.style.color = "var(--color-accent-primary)";
                e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--color-border-primary)";
                e.currentTarget.style.color = "var(--color-text-tertiary)";
                e.currentTarget.style.backgroundColor = "var(--color-bg-tertiary)";
              }}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
              <div className="flex flex-col items-center gap-1">
                <span className="text-sm font-medium">PDFファイルを選択</span>
                <span className="text-xs" style={{ color: "var(--color-text-disabled)" }}>
                  クリックしてPDFを選択してください
                </span>
              </div>
            </button>
          ) : (
            <div
              className="flex items-center gap-3 px-4 py-3"
              style={{
                backgroundColor: "var(--color-bg-tertiary)",
                borderRadius: "var(--radius-input)",
                border: "1px solid var(--color-border-secondary)",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--color-accent-primary)", flexShrink: 0 }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                  {pdfFileName}
                </p>
                <p className="text-xs truncate" style={{ color: "var(--color-text-tertiary)" }}>
                  {pdfFilePath}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPdfFilePath(null);
                  setPdfFileName(null);
                  setFetched(false);
                  setForm({ ...EMPTY_FORM });
                  setAuthorsText("");
                  setTagsText("");
                }}
                className="flex items-center justify-center shrink-0"
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "6px",
                  color: "var(--color-text-tertiary)",
                  transition: "all var(--transition-fast)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
                  e.currentTarget.style.color = "var(--color-text-primary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "var(--color-text-tertiary)";
                }}
                title={useI18nStore.getState().t.library.k_4vb94m}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}

          {/* メタデータプレビュー / スケルトン / フォーム */}
          {fetching ? (
            <SkeletonForm />
          ) : fetched ? (
            renderFormFields()
          ) : !pdfFilePath ? (
            <div
              className="flex flex-col items-center justify-center py-4 gap-2"
              style={{ color: "var(--color-text-disabled)" }}
            >
              <p className="text-xs">メタデータはPDFから自動抽出されます</p>
            </div>
          ) : null}
        </div>
      )}

      {/* ── Tab 1: URLから追加 ── */}
      {activeTab === "url" && (
        <div className="flex flex-col gap-4">
          {/* URL入力 + 取得ボタン */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Input
                label={useI18nStore.getState().t.library.k_t833la}
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://..."
                fullWidth
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                }
              />
            </div>
            <Button
              variant="primary"
              onClick={() => void handleFetchFromUrl()}
              loading={fetching}
              disabled={!urlInput.trim()}
            >
              取得
            </Button>
          </div>

          {/* PDFダウンロードオプション */}
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <div
              className="flex items-center justify-center"
              style={{
                width: "16px",
                height: "16px",
                borderRadius: "4px",
                border: downloadPdf
                  ? "none"
                  : "1.5px solid var(--color-border-primary)",
                backgroundColor: downloadPdf
                  ? "var(--color-accent-primary)"
                  : "transparent",
                transition: "all var(--transition-fast)",
              }}
              onClick={() => setDownloadPdf((v) => !v)}
            >
              {downloadPdf && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <span style={{ color: "var(--color-text-secondary)" }}>
              PDFも一緒に保存する
            </span>
          </label>

          {/* メタデータプレビュー / スケルトン / フォーム */}
          {fetching ? (
            <SkeletonForm />
          ) : fetched ? (
            renderFormFields()
          ) : (
            <div
              className="flex flex-col items-center justify-center py-8 gap-2"
              style={{ color: "var(--color-text-disabled)" }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-xs">URLを入力して「取得」をクリックしてください</p>
            </div>
          )}
        </div>
      )}

      {/* ── Tab 2: DOIから追加 ── */}
      {activeTab === "doi" && (
        <div className="flex flex-col gap-4">
          {/* DOI入力 + 取得ボタン */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Input
                label="DOI"
                value={doiInput}
                onChange={(e) => setDoiInput(e.target.value)}
                placeholder="10.1234/xxxxx"
                fullWidth
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                }
              />
            </div>
            <Button
              variant="primary"
              onClick={() => void handleFetchFromDoi()}
              loading={fetching}
              disabled={!doiInput.trim()}
            >
              取得
            </Button>
          </div>

          {/* メタデータプレビュー / スケルトン / フォーム */}
          {fetching ? (
            <SkeletonForm />
          ) : fetched ? (
            renderFormFields()
          ) : (
            <div
              className="flex flex-col items-center justify-center py-8 gap-2"
              style={{ color: "var(--color-text-disabled)" }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-xs">DOIを入力して「取得」をクリックしてください</p>
            </div>
          )}
        </div>
      )}

      {/* ── Tab 3: 手動入力 ── */}
      {activeTab === "manual" && renderFormFields()}
    </Modal>
  );
};
