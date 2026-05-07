// src/components/quantitative/VariableManager.tsx
// Stellar — 変数定義マネージャー
// 変数カードグリッド（2列）、リッカート設定、VariableEditSheet（ボトムドロワー）

import type React from "react";
import { useState, useCallback, useMemo } from "react";
import { useQuantitativeStore } from "../../stores/useQuantitativeStore";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { toast } from "../ui/Toast";
import type { Variable, VariableType, LikertLabel } from "../../types";
import { useT, useI18nStore } from "../../stores/useI18nStore";

// ── 変数タイプアイコン・ラベル ──
const VARIABLE_TYPE_META: Record<
  VariableType,
  { icon: string; label: string; color: string }
> = {
  scale: { icon: "📊", label: useI18nStore.getState().t.quantitative.k_6clnyf, color: "#4285f4" },
  nominal: { icon: "🏷", label: useI18nStore.getState().t.quantitative.k_ezwc, color: "#34a853" },
  ordinal: { icon: "📋", label: useI18nStore.getState().t.quantitative.k_qdl5, color: "#a08cff" },
  text: { icon: "📝", label: useI18nStore.getState().t.quantitative.k_6ctu6u, color: "#fb8c00" },
  date: { icon: "📅", label: useI18nStore.getState().t.quantitative.k_hrir, color: "#e03131" },
};

export const VariableManager: React.FC = () => {
  const t = useT();
  const variables = useQuantitativeStore((s) => s.variables);
  const updateVariable = useQuantitativeStore((s) => s.updateVariable);
  const selectedDataset = useQuantitativeStore((s) => s.selectedDataset);
  const isLoading = useQuantitativeStore((s) => s.isLoading);

  // ボトムシート制御
  const [editingVar, setEditingVar] = useState<Variable | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // 自動検出（モック）
  const handleAutoDetect = useCallback(() => {
    toast.info(t.quantitative.k_ljmr10);
    // 実際のバックエンド呼び出しに置き換え
    setTimeout(() => {
      toast.success(t.quantitative.k_mj4q1j);
    }, 800);
  }, []);

  // 変数カードのクリックで編集シートを開く
  const handleOpenSheet = useCallback((v: Variable) => {
    setEditingVar({ ...v });
    setSheetOpen(true);
  }, []);

  const handleCloseSheet = useCallback(() => {
    setSheetOpen(false);
    setEditingVar(null);
  }, []);

  if (!selectedDataset) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        <p className="text-sm">データセットを選択してください</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── ヘッダー ── */}
      <div
        className="shrink-0 flex items-center justify-between px-6 py-3"
        style={{
          borderBottom: "1px solid var(--color-border-secondary)",
        }}
      >
        <div>
          <h3
            className="text-sm font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            {t.quantitative.k_bnl1qu}
          </h3>
          <p
            className="text-[11px] mt-0.5"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {variables.length}個の変数
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleAutoDetect}
          loading={isLoading}
          icon={
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          }
        >
          変数を自動検出
        </Button>
      </div>

      {/* ── 変数カードグリッド ── */}
      <div className="flex-1 overflow-y-auto p-6">
        {variables.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 gap-4"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ opacity: 0.35 }}
            >
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <p className="text-sm">
              データをインポートすると変数が自動的に作成されます
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {variables.map((v, idx) => (
              <VariableCard
                key={v.id}
                variable={v}
                index={idx}
                onEdit={() => handleOpenSheet(v)}
                onUpdate={updateVariable}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── VariableEditSheet（ボトムドロワー） ── */}
      {sheetOpen && editingVar && (
        <VariableEditSheet
          variable={editingVar}
          onClose={handleCloseSheet}
          onSave={updateVariable}
        />
      )}
    </div>
  );
};

// ============================================================
// VariableCard コンポーネント
// ============================================================

const VariableCard: React.FC<{
  variable: Variable;
  index: number;
  onEdit: () => void;
  onUpdate: (id: string, updates: Partial<Variable>) => Promise<void>;
}> = ({ variable, index, onEdit, onUpdate }) => {
  const meta = VARIABLE_TYPE_META[variable.variableType];
  const [editingName, setEditingName] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [nameValue, setNameValue] = useState(variable.name);
  const [labelValue, setLabelValue] = useState(variable.label ?? "");
  const [likertExpanded, setLikertExpanded] = useState(false);

  // インライン名前編集の保存
  const handleNameBlur = useCallback(async () => {
    setEditingName(false);
    if (nameValue.trim() && nameValue !== variable.name) {
      try {
        await onUpdate(variable.id, { name: nameValue.trim() });
      } catch {
        setNameValue(variable.name);
      }
    } else {
      setNameValue(variable.name);
    }
  }, [nameValue, variable.name, variable.id, onUpdate]);

  const handleLabelBlur = useCallback(async () => {
    setEditingLabel(false);
    const val = labelValue.trim() || null;
    if (val !== variable.label) {
      try {
        await onUpdate(variable.id, { label: val });
      } catch {
        setLabelValue(variable.label ?? "");
      }
    }
  }, [labelValue, variable.label, variable.id, onUpdate]);

  // リッカートラベル更新
  const handleLikertChange = useCallback(
    async (pointValue: number, pointLabel: string) => {
      const current = variable.likertLabels ?? [];
      const updated = current.map((l) =>
        l.value === pointValue ? { ...l, label: pointLabel } : l,
      );
      if (!updated.find((l) => l.value === pointValue)) {
        updated.push({ value: pointValue, label: pointLabel });
      }
      try {
        await onUpdate(variable.id, { likertLabels: updated });
      } catch {
        // ロールバックはストアで対応
      }
    },
    [variable.id, variable.likertLabels, onUpdate],
  );

  return (
    <div
      className="flex flex-col gap-2 p-4"
      style={{
        backgroundColor: "var(--color-bg-card)",
        borderRadius: "var(--radius-card)",
        border: "1px solid var(--color-border-secondary)",
        boxShadow: "var(--shadow-card)",
        animation: `card-stagger-in 200ms ease-out ${index * 40}ms both`,
      }}
    >
      {/* ── 上部: インデックスバッジ + タイプ + 編集ボタン ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* カラムインデックスバッジ */}
          <span
            className="text-[10px] font-mono font-bold px-1.5 py-0.5"
            style={{
              backgroundColor: "var(--color-bg-tertiary)",
              color: "var(--color-text-tertiary)",
              borderRadius: "4px",
            }}
          >
            {variable.columnIndex}
          </span>

          {/* タイプアイコン + ラベル */}
          <span
            className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5"
            style={{
              backgroundColor: `${meta.color}15`,
              color: meta.color,
              borderRadius: "var(--radius-tag)",
            }}
          >
            <span>{meta.icon}</span>
            <span>{meta.label}</span>
          </span>
        </div>

        {/* 編集ボタン */}
        <button
          onClick={onEdit}
          className="flex items-center justify-center w-6 h-6"
          style={{
            borderRadius: "var(--radius-button)",
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
          aria-label={useI18nStore.getState().t.quantitative.k_5z9urt}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      </div>

      {/* ── 変数名（インライン編集可能） ── */}
      {editingName ? (
        <input
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          onBlur={handleNameBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          autoFocus
          className="text-sm font-semibold bg-transparent selectable"
          data-selectable="true"
          style={{
            color: "var(--color-text-primary)",
            border: "none",
            borderBottom: "1px solid var(--color-border-focus)",
            outline: "none",
            padding: "0 0 2px",
          }}
        />
      ) : (
        <button
          onClick={() => setEditingName(true)}
          className="text-sm font-semibold text-left truncate"
          style={{ color: "var(--color-text-primary)" }}
          title={useI18nStore.getState().t.quantitative.k_bziyy8}
        >
          {variable.name}
        </button>
      )}

      {/* ── ラベル（日本語、インライン編集可能） ── */}
      {editingLabel ? (
        <input
          value={labelValue}
          onChange={(e) => setLabelValue(e.target.value)}
          onBlur={handleLabelBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          autoFocus
          placeholder={useI18nStore.getState().t.quantitative.k_xuoqjj}
          className="text-xs bg-transparent selectable"
          data-selectable="true"
          style={{
            color: "var(--color-text-secondary)",
            border: "none",
            borderBottom: "1px solid var(--color-border-focus)",
            outline: "none",
            padding: "0 0 2px",
          }}
        />
      ) : (
        <button
          onClick={() => setEditingLabel(true)}
          className="text-xs text-left truncate"
          style={{
            color: variable.label
              ? "var(--color-text-secondary)"
              : "var(--color-text-disabled)",
          }}
          title={useI18nStore.getState().t.quantitative.k_twqqc5}
        >
          {variable.label || useI18nStore.getState().t.quantitative.k_wi39ho}
        </button>
      )}

      {/* ── メタ情報行 ── */}
      <div
        className="flex items-center gap-3 text-[11px] mt-1"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        {/* 欠損値 */}
        {variable.missingCount > 0 && (
          <span
            className="px-1.5 py-0.5"
            style={{
              backgroundColor: "var(--color-bg-tertiary)",
              borderRadius: "4px",
            }}
          >
            欠損 {variable.missingCount} {t.common.items}
          </span>
        )}

        {/* スケール変数の統計量 */}
        {variable.variableType === "scale" && (
          <>
            {variable.min !== null && (
              <span>
                最小: {variable.min}
              </span>
            )}
            {variable.max !== null && (
              <span>
                最大: {variable.max}
              </span>
            )}
            {variable.mean !== null && (
              <span>
                平均: {variable.mean.toFixed(2)}
              </span>
            )}
          </>
        )}

        {/* 日付フォーマットヒント */}
        {variable.variableType === "date" && variable.dateFormat && (
          <span>形式: {variable.dateFormat}</span>
        )}
      </div>

      {/* ── リッカート設定（スケール / 順序変数用） ── */}
      {(variable.variableType === "scale" ||
        variable.variableType === "ordinal") &&
        variable.min !== null &&
        variable.max !== null && (
          <div className="mt-1">
            <button
              onClick={() => setLikertExpanded((p) => !p)}
              className="flex items-center gap-1 text-[11px] font-medium"
              style={{
                color: "var(--color-accent-primary)",
                transition: "opacity var(--transition-fast)",
              }}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                style={{
                  transform: likertExpanded
                    ? "rotate(90deg)"
                    : "rotate(0deg)",
                  transition: "transform var(--transition-fast)",
                }}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <span>リッカート設定</span>
            </button>

            {likertExpanded && (
              <LikertEditor
                min={variable.min}
                max={variable.max}
                labels={variable.likertLabels ?? []}
                onChange={handleLikertChange}
              />
            )}
          </div>
        )}
    </div>
  );
};

// ============================================================
// LikertEditor コンポーネント
// ============================================================

const LikertEditor: React.FC<{
  min: number;
  max: number;
  labels: LikertLabel[];
  onChange: (value: number, label: string) => void;
}> = ({ min, max, labels, onChange }) => {
  const points = useMemo(() => {
    const arr: number[] = [];
    for (let i = min; i <= max; i++) {
      arr.push(i);
    }
    return arr;
  }, [min, max]);

  return (
    <div className="mt-2 space-y-1.5">
      {points.map((point) => {
        const existing = labels.find((l) => l.value === point);
        return (
          <div key={point} className="flex items-center gap-2">
            <span
              className="text-[11px] font-mono font-bold w-5 text-center shrink-0"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {point}
            </span>
            <span
              className="text-[11px] shrink-0"
              style={{ color: "var(--color-text-disabled)" }}
            >
              →
            </span>
            <input
              value={existing?.label ?? ""}
              onChange={(e) => onChange(point, e.target.value)}
              placeholder={t.quantitative.k_pbbqp}
              className="flex-1 text-[11px] px-2 py-1 selectable"
              data-selectable="true"
              style={{
                backgroundColor: "var(--color-bg-input)",
                border: "1px solid var(--color-border-secondary)",
                borderRadius: "4px",
                color: "var(--color-text-primary)",
                outline: "none",
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

// ============================================================
// VariableEditSheet コンポーネント（ボトムドロワー）
// ============================================================

const VariableEditSheet: React.FC<{
  variable: Variable;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Variable>) => Promise<void>;
}> = ({ variable, onClose, onSave }) => {
  const [name, setName] = useState(variable.name);
  const [label, setLabel] = useState(variable.label ?? "");
  const [varType, setVarType] = useState<VariableType>(variable.variableType);
  const [dateFormat, setDateFormat] = useState(variable.dateFormat ?? "");
  const [saving, setSaving] = useState(false);
  const [typeChanged, setTypeChanged] = useState(false);

  const handleTypeChange = useCallback(
    (newType: VariableType) => {
      setVarType(newType);
      setTypeChanged(newType !== variable.variableType);
    },
    [variable.variableType],
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave(variable.id, {
        name: name.trim(),
        label: label.trim() || null,
        variableType: varType,
        dateFormat: varType === "date" ? dateFormat || null : null,
      });
      toast.success(useI18nStore.getState().t.quantitative.k_a7t2i);
      onClose();
    } catch {
      // エラーはストアで処理
    } finally {
      setSaving(false);
    }
  }, [variable.id, name, label, varType, dateFormat, onSave, onClose]);

  return (
    <>
      {/* オーバーレイ */}
      <div
        className="fixed inset-0"
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.3)",
          backdropFilter: "blur(2px)",
          zIndex: "var(--z-modal-overlay)",
        }}
        onClick={onClose}
      />

      {/* ドロワー本体 */}
      <div
        className="fixed bottom-0 left-0 right-0 animate-slide-in-right"
        style={{
          zIndex: "var(--z-modal)",
          backgroundColor: "var(--color-bg-modal)",
          borderTop: "1px solid var(--color-border-primary)",
          borderTopLeftRadius: "var(--radius-modal)",
          borderTopRightRadius: "var(--radius-modal)",
          boxShadow: "var(--shadow-modal)",
          maxHeight: "60vh",
          overflow: "auto",
        }}
      >
        {/* ドラッグハンドル */}
        <div className="flex justify-center pt-3 pb-1">
          <div
            style={{
              width: "36px",
              height: "4px",
              borderRadius: "2px",
              backgroundColor: "var(--color-border-primary)",
            }}
          />
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* タイトル */}
          <div className="flex items-center justify-between">
            <h3
              className="text-base font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              変数の編集
            </h3>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-7 h-7"
              style={{
                borderRadius: "var(--radius-button)",
                color: "var(--color-text-tertiary)",
                transition: "all var(--transition-fast)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  "var(--color-bg-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* 変数名 */}
            <Input
              label={useI18nStore.getState().t.qualitative.k_dj71i}
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
            />

            {/* ラベル */}
            <Input
              label={useI18nStore.getState().t.quantitative.k_xuoqjj}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={useI18nStore.getState().t.quantitative.k_hhhlfi}
              fullWidth
            />
          </div>

          {/* タイプ選択 */}
          <div className="space-y-2">
            <label
              className="text-xs font-medium"
              style={{ color: "var(--color-text-secondary)" }}
            >
              変数タイプ
            </label>
            <div className="flex gap-2 flex-wrap">
              {(
                Object.entries(VARIABLE_TYPE_META) as [
                  VariableType,
                  (typeof VARIABLE_TYPE_META)[VariableType],
                ][]
              ).map(([type, m]) => (
                <button
                  key={type}
                  onClick={() => handleTypeChange(type)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
                  style={{
                    borderRadius: "var(--radius-button)",
                    border:
                      varType === type
                        ? `2px solid ${m.color}`
                        : "1px solid var(--color-border-primary)",
                    backgroundColor:
                      varType === type ? `${m.color}15` : "transparent",
                    color: varType === type ? m.color : "var(--color-text-secondary)",
                    transition: "all var(--transition-fast)",
                  }}
                >
                  <span>{m.icon}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>

            {/* タイプ変更警告 */}
            {typeChanged && (
              <p
                className="text-[11px] flex items-center gap-1"
                style={{ color: "var(--color-accent-warning)" }}
              >
                <span>⚠️</span>
                変数タイプを変更すると、この変数を使用した分析結果が無効になる場合があります
              </p>
            )}
          </div>

          {/* 日付フォーマット（日付タイプのみ） */}
          {varType === "date" && (
            <Input
              label={useI18nStore.getState().t.quantitative.k_pgiqya}
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value)}
              placeholder={useI18nStore.getState().t.quantitative.k_t6suhb}
              fullWidth
            />
          )}

          {/* アクション */}
          <div className="flex justify-end gap-2 pb-2">
            <Button variant="ghost" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {t.items.save}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};
