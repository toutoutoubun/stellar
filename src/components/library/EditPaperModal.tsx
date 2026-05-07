// src/components/library/EditPaperModal.tsx
// Stellar — 論文編集モーダル
// 既存の論文メタデータを編集して保存するモーダル

import type React from "react";
import { useState, useEffect, useCallback } from "react";
import type { Paper, UpdatePaperInput } from "../../types";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { useI18nStore } from "../../stores/useI18nStore";

interface EditPaperModalProps {
  open: boolean;
  onClose: () => void;
  paper: Paper | null;
  onSave: (id: string, input: UpdatePaperInput) => Promise<void>;
}

export const EditPaperModal: React.FC<EditPaperModalProps> = ({
  open,
  onClose,
  paper,
  onSave,
}) => {
  const t = useI18nStore.getState().t;

  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [year, setYear] = useState("");
  const [journal, setJournal] = useState("");
  const [volume, setVolume] = useState("");
  const [issue, setIssue] = useState("");
  const [pages, setPages] = useState("");
  const [doi, setDoi] = useState("");
  const [url, setUrl] = useState("");
  const [abstract_, setAbstract] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);

  // 論文データをフォームに反映
  useEffect(() => {
    if (paper && open) {
      setTitle(paper.title);
      setAuthors(paper.authors.join(", "));
      setYear(paper.year != null ? String(paper.year) : "");
      setJournal(paper.journal ?? "");
      setVolume(paper.volume ?? "");
      setIssue(paper.issue ?? "");
      setPages(paper.pages ?? "");
      setDoi(paper.doi ?? "");
      setUrl(paper.url ?? "");
      setAbstract(paper.abstract ?? "");
      setTags(paper.tags.join(", "));
    }
  }, [paper, open]);

  const handleSave = useCallback(async () => {
    if (!paper || !title.trim()) return;
    setSaving(true);
    try {
      const input: UpdatePaperInput = {
        title: title.trim(),
        authors: authors
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
        year: year ? Number(year) : null,
        journal: journal.trim() || null,
        volume: volume.trim() || null,
        issue: issue.trim() || null,
        pages: pages.trim() || null,
        doi: doi.trim() || null,
        url: url.trim() || null,
        abstract: abstract_.trim() || null,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      };
      await onSave(paper.id, input);
      onClose();
    } finally {
      setSaving(false);
    }
  }, [paper, title, authors, year, journal, volume, issue, pages, doi, url, abstract_, tags, onSave, onClose]);

  if (!paper) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${t.common.edit}: ${paper.title.length > 40 ? paper.title.slice(0, 40) + "..." : paper.title}`}
      width="560px"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? t.common.loading : t.common.save}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* タイトル */}
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "var(--color-text-secondary)" }}>
            {t.library.k_3n500e}
          </label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.library.k_nqxsud} />
        </div>

        {/* 著者 */}
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "var(--color-text-secondary)" }}>
            {t.library.k_tm1buw}
          </label>
          <Input value={authors} onChange={(e) => setAuthors(e.target.value)} placeholder={t.library.k_y8v2ho} />
        </div>

        {/* 年・ジャーナル */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--color-text-secondary)" }}>
              {t.library.k_ck7ty}
            </label>
            <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2024" />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--color-text-secondary)" }}>
              {t.library.k_f45ryr}
            </label>
            <Input value={journal} onChange={(e) => setJournal(e.target.value)} placeholder={t.library.k_mra1e} />
          </div>
        </div>

        {/* 巻・号・ページ */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--color-text-secondary)" }}>
              {t.library.k_ikb}
            </label>
            <Input value={volume} onChange={(e) => setVolume(e.target.value)} placeholder="Vol." />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--color-text-secondary)" }}>
              {t.library.k_gl3}
            </label>
            <Input value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="No." />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--color-text-secondary)" }}>
              {t.library.k_7e6xi}
            </label>
            <Input value={pages} onChange={(e) => setPages(e.target.value)} placeholder="1-20" />
          </div>
        </div>

        {/* DOI・URL */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--color-text-secondary)" }}>
              DOI
            </label>
            <Input value={doi} onChange={(e) => setDoi(e.target.value)} placeholder="10.1234/xxxxx" />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--color-text-secondary)" }}>
              URL
            </label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
          </div>
        </div>

        {/* アブストラクト */}
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "var(--color-text-secondary)" }}>
            {t.library.k_hq997l}
          </label>
          <textarea
            value={abstract_}
            onChange={(e) => setAbstract(e.target.value)}
            placeholder={t.library.k_palb1q}
            rows={4}
            className="w-full text-sm px-3 py-2 resize-y"
            style={{
              backgroundColor: "var(--color-bg-input)",
              color: "var(--color-text-primary)",
              border: "1px solid var(--color-border-primary)",
              borderRadius: "var(--radius-input)",
              outline: "none",
              lineHeight: "1.6",
            }}
          />
        </div>

        {/* タグ */}
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "var(--color-text-secondary)" }}>
            {t.library.k_f41763}
          </label>
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder={t.library.k_stzku} />
        </div>
      </div>
    </Modal>
  );
};
