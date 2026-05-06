// src/components/qualitative/SourceCritiqueForm.tsx
// 史料批判シート — プロジェクトスコープで論文を選択し批判シートを管理
// 折りたたみセクション + 星評価 + バイアストグル

import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { SourceCritique, SourceCritiqueInput, Paper } from '../../types';

interface SourceCritiqueFormProps {
  projectId: string;
}

export const SourceCritiqueForm: React.FC<SourceCritiqueFormProps> = ({
  projectId,
}) => {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [critiques, setCritiques] = useState<SourceCritique[]>([]);
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [critique, setCritique] = useState<SourceCritique | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true,
    content: false,
    evaluation: false,
    notes: false,
  });
  const [form, setForm] = useState<SourceCritiqueInput>({
    paperId: '',
    authorInfo: '',
    creationDate: '',
    isDateEstimated: false,
    location: '',
    sourceType: '',
    authenticity: '',
    archiveInfo: '',
    intent: '',
    audience: '',
    biasLevel: '',
    biasReason: '',
    consistency: '',
    reliabilityScore: 3,
    researcherNotes: '',
  });

  const resetForm = useCallback(() => {
    setForm({
      paperId: selectedPaperId ?? '',
      authorInfo: '',
      creationDate: '',
      isDateEstimated: false,
      location: '',
      sourceType: '',
      authenticity: '',
      archiveInfo: '',
      intent: '',
      audience: '',
      biasLevel: '',
      biasReason: '',
      consistency: '',
      reliabilityScore: 3,
      researcherNotes: '',
    });
    setCritique(null);
  }, [selectedPaperId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [paperList, critiqueList] = await Promise.all([
        invoke<Paper[]>('get_papers'),
        invoke<SourceCritique[]>('get_source_critiques_by_project', { projectId }),
      ]);
      setPapers(paperList);
      setCritiques(critiqueList);
    } catch (e) {
      console.error('データ取得に失敗:', e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 論文選択時に批判シートを読み込む
  useEffect(() => {
    if (!selectedPaperId) {
      resetForm();
      return;
    }
    const existing = critiques.find((c) => c.paperId === selectedPaperId);
    if (existing) {
      setCritique(existing);
      setForm({
        paperId: selectedPaperId,
        authorInfo: existing.authorInfo ?? '',
        creationDate: existing.creationDate ?? '',
        isDateEstimated: existing.isDateEstimated,
        location: existing.location ?? '',
        sourceType: existing.sourceType ?? '',
        authenticity: existing.authenticity ?? '',
        archiveInfo: existing.archiveInfo ?? '',
        intent: existing.intent ?? '',
        audience: existing.audience ?? '',
        biasLevel: existing.biasLevel ?? '',
        biasReason: existing.biasReason ?? '',
        consistency: existing.consistency ?? '',
        reliabilityScore: existing.reliabilityScore,
        researcherNotes: existing.researcherNotes ?? '',
      });
      setShowForm(true);
    } else {
      resetForm();
      setForm((prev) => ({ ...prev, paperId: selectedPaperId }));
      setShowForm(true);
    }
  }, [selectedPaperId, critiques, resetForm]);

  const handleSave = async () => {
    if (!form.paperId) return;
    setSaving(true);
    try {
      await invoke<SourceCritique>('upsert_source_critique', { dto: form });
      await loadData();
    } catch (e) {
      console.error('史料批判保存に失敗:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('この史料批判シートを削除しますか？')) return;
    try {
      await invoke('delete_source_critique', { id });
      setCritique(null);
      setSelectedPaperId(null);
      setShowForm(false);
      await loadData();
    } catch (e) {
      console.error('史料批判削除に失敗:', e);
    }
  };

  const handleEdit = (c: SourceCritique) => {
    setSelectedPaperId(c.paperId);
    setShowForm(true);
  };

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const updateField = <K extends keyof SourceCritiqueInput>(
    key: K,
    value: SourceCritiqueInput[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return <div className="qual-loading">読み込み中...</div>;
  }

  const SectionHeader: React.FC<{
    sectionKey: string;
    title: string;
    icon: string;
  }> = ({ sectionKey, title, icon }) => (
    <button
      className="source-critique-section-header"
      onClick={() => toggleSection(sectionKey)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '8px 12px',
        backgroundColor: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border-secondary)',
        borderRadius: '6px',
        color: 'var(--color-text-primary)',
        cursor: 'pointer',
      }}
    >
      <span className="flex items-center gap-2">
        <span>{icon}</span>
        <span className="text-sm font-semibold">{title}</span>
      </span>
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        style={{
          transform: expandedSections[sectionKey] ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
        }}
      >
        <path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </button>
  );

  const selectedPaperTitle = papers.find((p) => p.id === selectedPaperId)?.title;

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              史料批判シート
            </h3>
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              論文ごとに史料の信頼性を評価
            </p>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setSelectedPaperId(null); resetForm(); }}
            className="text-xs px-3 py-1.5"
            style={{ backgroundColor: 'var(--color-accent-primary)', color: 'white', borderRadius: '6px' }}
          >
            + 新規作成
          </button>
        </div>

        {/* 新規作成/編集フォーム */}
        {showForm && (
          <div
            className="mb-6 p-4"
            style={{
              backgroundColor: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border-secondary)',
              borderRadius: '10px',
            }}
          >
            <div className="mb-3">
              <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                対象論文
              </label>
              <select
                className="w-full mt-1 text-sm"
                value={selectedPaperId ?? ''}
                onChange={(e) => setSelectedPaperId(e.target.value || null)}
                style={{
                  backgroundColor: 'var(--color-bg-tertiary)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border-secondary)',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  outline: 'none',
                  width: '100%',
                }}
              >
                <option value="">論文を選択...</option>
                {papers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} {p.year ? `(${p.year})` : ''}
                  </option>
                ))}
              </select>
              {selectedPaperTitle && (
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                  {selectedPaperTitle}
                </p>
              )}
            </div>

            {selectedPaperId && (
              <>
                {/* 基本情報 */}
                <div className="mb-2">
                  <SectionHeader sectionKey="basic" title="基本情報" icon="📋" />
                  {expandedSections.basic && (
                    <div className="p-3 flex flex-col gap-2 mt-1">
                      <div>
                        <label className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>著者/作成者情報</label>
                        <input className="w-full mt-1 text-sm" value={form.authorInfo ?? ''} onChange={(e) => updateField('authorInfo', e.target.value)} placeholder="著者の背景・所属・立場..." style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-secondary)', borderRadius: '6px', padding: '6px 10px', outline: 'none', width: '100%' }} />
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>作成日</label>
                          <input className="w-full mt-1 text-sm" value={form.creationDate ?? ''} onChange={(e) => updateField('creationDate', e.target.value)} placeholder="YYYY-MM-DD or 概算" style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-secondary)', borderRadius: '6px', padding: '6px 10px', outline: 'none', width: '100%' }} />
                        </div>
                        <div>
                          <label className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>推定日</label>
                          <button className="block mt-1 text-xs px-3 py-1.5" onClick={() => updateField('isDateEstimated', !form.isDateEstimated)} style={{ backgroundColor: form.isDateEstimated ? 'var(--color-accent-primary)' : 'var(--color-bg-tertiary)', color: form.isDateEstimated ? 'white' : 'var(--color-text-secondary)', border: '1px solid var(--color-border-secondary)', borderRadius: '6px' }}>
                            {form.isDateEstimated ? '推定' : '確定'}
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>作成地</label>
                          <input className="w-full mt-1 text-sm" value={form.location ?? ''} onChange={(e) => updateField('location', e.target.value)} placeholder="場所..." style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-secondary)', borderRadius: '6px', padding: '6px 10px', outline: 'none', width: '100%' }} />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>史料種別</label>
                          <select className="w-full mt-1 text-sm" value={form.sourceType ?? ''} onChange={(e) => updateField('sourceType', e.target.value)} style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-secondary)', borderRadius: '6px', padding: '6px 10px', outline: 'none', width: '100%' }}>
                            <option value="">選択...</option>
                            <option value="primary">一次史料</option>
                            <option value="secondary">二次史料</option>
                            <option value="official">公文書</option>
                            <option value="personal">私文書</option>
                            <option value="newspaper">新聞記事</option>
                            <option value="interview">インタビュー</option>
                            <option value="memoir">回顧録</option>
                            <option value="statistics">統計資料</option>
                            <option value="other">その他</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>原本性/所蔵情報</label>
                        <input className="w-full mt-1 text-sm" value={form.archiveInfo ?? ''} onChange={(e) => updateField('archiveInfo', e.target.value)} placeholder="所蔵機関・資料番号..." style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-secondary)', borderRadius: '6px', padding: '6px 10px', outline: 'none', width: '100%' }} />
                      </div>
                      <div>
                        <label className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>真正性</label>
                        <select className="w-full mt-1 text-sm" value={form.authenticity ?? ''} onChange={(e) => updateField('authenticity', e.target.value)} style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-secondary)', borderRadius: '6px', padding: '6px 10px', outline: 'none', width: '100%' }}>
                          <option value="">選択...</option>
                          <option value="verified">検証済み</option>
                          <option value="likely">おそらく真正</option>
                          <option value="uncertain">不確実</option>
                          <option value="disputed">係争中</option>
                          <option value="fabricated">偽造の疑い</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* 内容分析 */}
                <div className="mb-2">
                  <SectionHeader sectionKey="content" title="内容分析" icon="🔍" />
                  {expandedSections.content && (
                    <div className="p-3 flex flex-col gap-2 mt-1">
                      <div>
                        <label className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>作成意図/目的</label>
                        <textarea className="w-full mt-1 text-sm" rows={2} value={form.intent ?? ''} onChange={(e) => updateField('intent', e.target.value)} placeholder="この史料が作成された目的..." style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-secondary)', borderRadius: '6px', padding: '6px 10px', outline: 'none', width: '100%', resize: 'vertical' }} />
                      </div>
                      <div>
                        <label className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>想定読者/受容者</label>
                        <input className="w-full mt-1 text-sm" value={form.audience ?? ''} onChange={(e) => updateField('audience', e.target.value)} placeholder="誰に向けて書かれたか..." style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-secondary)', borderRadius: '6px', padding: '6px 10px', outline: 'none', width: '100%' }} />
                      </div>
                      <div>
                        <label className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>他史料との整合性</label>
                        <textarea className="w-full mt-1 text-sm" rows={2} value={form.consistency ?? ''} onChange={(e) => updateField('consistency', e.target.value)} placeholder="他の史料との一致/矛盾点..." style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-secondary)', borderRadius: '6px', padding: '6px 10px', outline: 'none', width: '100%', resize: 'vertical' }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* 信頼性評価 */}
                <div className="mb-2">
                  <SectionHeader sectionKey="evaluation" title="信頼性評価" icon="⭐" />
                  {expandedSections.evaluation && (
                    <div className="p-3 flex flex-col gap-2 mt-1">
                      <div>
                        <label className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>バイアス度</label>
                        <div className="flex gap-2 mt-1">
                          {(['none', 'low', 'medium', 'high', 'extreme'] as const).map((level) => (
                            <button
                              key={level}
                              className="text-xs px-2 py-1"
                              onClick={() => updateField('biasLevel', level)}
                              style={{
                                backgroundColor: form.biasLevel === level ? 'var(--color-accent-primary)' : 'var(--color-bg-tertiary)',
                                color: form.biasLevel === level ? 'white' : 'var(--color-text-secondary)',
                                border: '1px solid var(--color-border-secondary)',
                                borderRadius: '4px',
                                cursor: 'pointer',
                              }}
                            >
                              {{ none: 'なし', low: '低', medium: '中', high: '高', extreme: '極高' }[level]}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>バイアス理由</label>
                        <textarea className="w-full mt-1 text-sm" rows={2} value={form.biasReason ?? ''} onChange={(e) => updateField('biasReason', e.target.value)} placeholder="バイアスの根拠..." style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-secondary)', borderRadius: '6px', padding: '6px 10px', outline: 'none', width: '100%', resize: 'vertical' }} />
                      </div>
                      <div>
                        <label className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>信頼性スコア</label>
                        <div className="flex items-center gap-1 mt-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button key={star} onClick={() => updateField('reliabilityScore', star)} style={{ fontSize: '18px', color: (form.reliabilityScore ?? 0) >= star ? '#f59e0b' : 'var(--color-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}>
                              ★
                            </button>
                          ))}
                          <span className="text-xs ml-2" style={{ color: 'var(--color-text-secondary)' }}>{form.reliabilityScore}/5</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 研究者メモ */}
                <div className="mb-3">
                  <SectionHeader sectionKey="notes" title="研究者メモ" icon="📝" />
                  {expandedSections.notes && (
                    <div className="p-3 mt-1">
                      <textarea className="w-full text-sm" rows={4} value={form.researcherNotes ?? ''} onChange={(e) => updateField('researcherNotes', e.target.value)} placeholder="この史料に関する考察・分析メモ..." style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-secondary)', borderRadius: '6px', padding: '6px 10px', outline: 'none', width: '100%', resize: 'vertical' }} />
                    </div>
                  )}
                </div>

                {/* 保存ボタン */}
                <div className="flex items-center gap-3">
                  <button className="text-xs px-4 py-1.5" onClick={handleSave} disabled={saving} style={{ backgroundColor: 'var(--color-accent-primary)', color: 'white', borderRadius: '6px', opacity: saving ? 0.6 : 1 }}>
                    {saving ? '保存中...' : critique ? '更新' : '保存'}
                  </button>
                  <button className="text-xs px-3 py-1.5" onClick={() => { setShowForm(false); setSelectedPaperId(null); }} style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-secondary)', borderRadius: '6px' }}>
                    キャンセル
                  </button>
                  {critique && (
                    <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                      最終更新: {critique.updatedAt ?? critique.createdAt}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* 既存の史料批判一覧 */}
        {critiques.length > 0 && (
          <div>
            <h4 className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              登録済み史料批判 ({critiques.length}件)
            </h4>
            <div className="flex flex-col gap-2">
              {critiques.map((c) => {
                const paper = papers.find((p) => p.id === c.paperId);
                return (
                  <div
                    key={c.id}
                    className="p-3 flex items-center justify-between group"
                    style={{
                      backgroundColor: 'var(--color-bg-secondary)',
                      border: '1px solid var(--color-border-secondary)',
                      borderRadius: '8px',
                    }}
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {paper?.title ?? c.paperId}
                      </p>
                      <div className="flex gap-3 mt-1 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                        {c.authorInfo && <span>著者: {c.authorInfo}</span>}
                        {c.creationDate && <span>作成日: {c.creationDate}</span>}
                        <span>信頼性: {'★'.repeat(c.reliabilityScore)}{'☆'.repeat(5 - c.reliabilityScore)}</span>
                        {c.biasLevel && <span>バイアス: {c.biasLevel}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(c)} className="text-xs px-2 py-1" style={{ color: 'var(--color-accent-primary)' }}>編集</button>
                      <button onClick={() => handleDelete(c.id)} className="text-xs px-2 py-1 opacity-0 group-hover:opacity-100" style={{ color: '#ef4444', transition: 'opacity 0.15s' }}>削除</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {critiques.length === 0 && !showForm && (
          <div className="flex flex-col items-center justify-center py-12" style={{ color: 'var(--color-text-tertiary)' }}>
            <span className="text-3xl opacity-30">📜</span>
            <p className="text-sm mt-2">史料批判シートを作成して論文の信頼性を評価しましょう</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SourceCritiqueForm;
