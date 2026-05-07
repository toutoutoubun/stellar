// src/components/qualitative/IcrCalculator.tsx
// ICR（インターコーダー信頼性）計算 — Cohen's κ
// ミニマルUI / カスタムアイコン / ヘルプ付き

import React, { useState, useCallback } from "react";
import { invoke } from "../../lib/tauriShim";
import type { IcrResult, ImportedCoding } from "../../types";
import { HelpTooltip } from "./HelpTooltip";
import { IconIcr } from "./icons/QualIcons";
import { useT } from "../../stores/useI18nStore";

interface IcrCalculatorProps {
  projectId: string;
}

export const IcrCalculator: React.FC<IcrCalculatorProps> = ({ projectId }) => {
  const t = useT();
  const [result, setResult] = useState<IcrResult | null>(null);
  const [jsonInput, setJsonInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCalculate = useCallback(async () => {
    if (!jsonInput.trim()) {
      setError(t.qualitative.k_4mccl5);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const importedCodings: ImportedCoding[] = JSON.parse(jsonInput);
      const res = await invoke<IcrResult>("calculate_icr", {
        projectId,
        importedCodings,
      });
      setResult(res);
    } catch (err) {
      const msg = typeof err === "string" ? err : t.qualitative.k_wmf8zr;
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId, jsonInput]);

  const getKappaLabel = (k: number): { label: string; color: string } => {
    if (k >= 0.81) return { label: t.qualitative.k_uwv8i7, color: "#22c55e" };
    if (k >= 0.61) return { label: t.qualitative.k_lcj52l, color: "#84cc16" };
    if (k >= 0.41) return { label: t.qualitative.k_kmvjlm, color: "#eab308" };
    if (k >= 0.21) return { label: t.qualitative.k_rjw5cy, color: "#f97316" };
    if (k >= 0.0) return { label: t.qualitative.k_q2hug2, color: "#ef4444" };
    return { label: t.qualitative.k_adl58a, color: "#dc2626" };
  };

  return (
    <div className="p-6" style={{ maxWidth: "800px" }}>
      <HelpTooltip
        storageKey="qual_icr"
        title={t.qualitative.k_azaeb7}
        paragraphs={[
          "Cohen's kappa 係数を用いて、2人のコーダー間の一致度を測定します。",
          t.qualitative.k_tnw3me,
        ]}
        steps={[
          t.qualitative.k_icbz15,
          t.qualitative.k_y3lhnm,
          t.qualitative.k_ar4n6p,
        ]}
      />

      <h3
        className="text-sm font-semibold mb-3"
        style={{ color: "var(--color-text-primary)" }}
      >
        ICR（インターコーダー信頼性）計算
      </h3>

      {/* 入力フォーマット説明 */}
      <div
        className="mb-4 p-3"
        style={{
          backgroundColor: "var(--color-bg-tertiary)",
          borderRadius: "8px",
          border: "1px solid var(--color-border-secondary)",
        }}
      >
        <div
          className="text-xs font-semibold mb-1"
          style={{ color: "var(--color-text-primary)" }}
        >
          入力フォーマット（JSON配列）
        </div>
        <pre
          className="text-xs"
          style={{
            color: "var(--color-text-secondary)",
            whiteSpace: "pre-wrap",
            fontFamily: "monospace",
          }}
        >
          {`[
  { "highlightId": "xxx", "codeIds": ["code1", "code2"] },
  { "highlightId": "yyy", "codeIds": ["code1"] }
]`}
        </pre>
      </div>

      {/* JSON入力 */}
      <textarea
        value={jsonInput}
        onChange={(e) => setJsonInput(e.target.value)}
        placeholder={t.qualitative.k_969yr5}
        rows={8}
        className="w-full text-xs mb-3 p-3"
        style={{
          backgroundColor: "var(--color-bg-primary)",
          color: "var(--color-text-primary)",
          border: "1px solid var(--color-border-primary)",
          borderRadius: "8px",
          outline: "none",
          fontFamily: "monospace",
          resize: "vertical",
        }}
      />

      {error && (
        <div
          className="text-xs mb-3 p-2"
          style={{
            color: "#ef4444",
            backgroundColor: "#ef444410",
            borderRadius: "6px",
          }}
        >
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={() => void handleCalculate()}
        disabled={loading}
        className="text-sm px-4 py-2 mb-6 inline-flex items-center gap-1.5"
        style={{
          backgroundColor: "var(--color-accent-primary)",
          color: "#fff",
          border: "none",
          borderRadius: "8px",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.6 : 1,
        }}
      >
        <IconIcr size={14} color="#fff" />
        {loading ? t.settings.data.calculating : t.qualitative.k_6putu0}
      </button>

      {/* 結果表示 */}
      {result && (
        <div>
          <h4
            className="text-sm font-semibold mb-3"
            style={{ color: "var(--color-text-primary)" }}
          >
            計算結果
          </h4>

          <div className="grid grid-cols-2 gap-3 mb-4" style={{ maxWidth: "400px" }}>
            {/* kappa係数 */}
            <div
              className="p-4"
              style={{
                backgroundColor: "var(--color-bg-secondary)",
                borderRadius: "10px",
                border: "1px solid var(--color-border-primary)",
              }}
            >
              <div
                className="text-xs mb-1"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                Cohen's kappa
              </div>
              <div
                className="text-2xl font-bold"
                style={{ color: getKappaLabel(result.cohenKappa).color }}
              >
                {result.cohenKappa.toFixed(3)}
              </div>
              <div
                className="text-xs mt-1"
                style={{ color: getKappaLabel(result.cohenKappa).color }}
              >
                {getKappaLabel(result.cohenKappa).label}
              </div>
            </div>

            {/* 一致率 */}
            <div
              className="p-4"
              style={{
                backgroundColor: "var(--color-bg-secondary)",
                borderRadius: "10px",
                border: "1px solid var(--color-border-primary)",
              }}
            >
              <div
                className="text-xs mb-1"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                観測一致率 (Po)
              </div>
              <div
                className="text-2xl font-bold"
                style={{ color: "var(--color-text-primary)" }}
              >
                {(result.percentAgreement * 100).toFixed(1)}%
              </div>
              <div
                className="text-xs mt-1"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                {result.agreements} / {result.totalSegments} セグメント
              </div>
            </div>
          </div>

          {/* 数式解説 */}
          <div
            className="p-3 mb-4"
            style={{
              backgroundColor: "var(--color-bg-tertiary)",
              borderRadius: "8px",
              border: "1px solid var(--color-border-secondary)",
            }}
          >
            <div
              className="text-xs"
              style={{ color: "var(--color-text-secondary)", lineHeight: "1.8" }}
            >
              <strong>計算式:</strong>
              <br />
              Po = 一致数 / 全セグメント数 = {result.agreements} / {result.totalSegments} ={" "}
              {result.percentAgreement.toFixed(4)}
              <br />
              Pe = 期待一致率（各カテゴリの偶然一致確率の合計）
              <br />
              kappa = (Po - Pe) / (1 - Pe) = {result.cohenKappa.toFixed(4)}
            </div>
          </div>

          {/* 不一致一覧 */}
          {result.disagreements.length > 0 && (
            <div>
              <h4
                className="text-sm font-semibold mb-2"
                style={{ color: "var(--color-text-primary)" }}
              >
                不一致箇所 ({result.disagreements.length}件)
              </h4>
              <div className="flex flex-col gap-2">
                {result.disagreements.slice(0, 20).map((d) => (
                  <div
                    key={d.highlightId}
                    className="p-2 text-xs"
                    style={{
                      backgroundColor: "var(--color-bg-secondary)",
                      borderRadius: "6px",
                      border: "1px solid var(--color-border-secondary)",
                    }}
                  >
                    <div
                      className="font-mono mb-1 truncate"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      {d.highlightId}
                    </div>
                    <div className="flex items-center gap-1" style={{ color: "var(--color-text-secondary)" }}>
                      <span>メイン: [{d.mainCodes.join(", ")}]</span>
                      <span style={{ color: "var(--color-text-tertiary)" }}>|</span>
                      <span>インポート: [{d.importedCodes.join(", ")}]</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
