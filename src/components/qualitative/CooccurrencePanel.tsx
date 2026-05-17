import React, { useCallback, useEffect, useState } from "react";
import { invoke } from "../../lib/tauriShim";
import { useI18nStore } from "../../stores/useI18nStore";
import type { CooccurrencePair } from "../../types";
import { IconActorMap, IconClose, IconRefresh } from "./icons/QualIcons";

interface CooccurrencePanelProps {
  segmentId: string;
  isOpen: boolean;
  onClose: () => void;
}

const WINDOW_SIZE = 5;
const TOP_N = 10;

export const CooccurrencePanel: React.FC<CooccurrencePanelProps> = ({
  segmentId,
  isOpen,
  onClose,
}) => {
  const locale = useI18nStore((s) => s.locale);
  const [pairs, setPairs] = useState<CooccurrencePair[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async () => {
    if (!segmentId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<CooccurrencePair[]>("analyze_cooccurrence", {
        segmentId,
        locale,
        windowSize: WINDOW_SIZE,
        topN: TOP_N,
      });
      setPairs(Array.isArray(result) ? result : []);
    } catch (err) {
      console.error("Failed to analyze cooccurrence:", err);
      setPairs([]);
      setError(String(err).replace(/^Error:\s*/i, ""));
    } finally {
      setLoading(false);
    }
  }, [locale, segmentId]);

  useEffect(() => {
    if (!isOpen || !segmentId) return;
    void analyze();
  }, [analyze, isOpen, segmentId]);

  if (!isOpen) return null;

  return (
    <section
      className="shrink-0"
      style={{
        borderBottom: "1px solid var(--color-border-primary)",
        backgroundColor: "var(--color-bg-primary)",
      }}
    >
      <header
        className="flex items-center justify-between gap-2 px-3 py-2"
        style={{ borderBottom: "1px solid var(--color-border-secondary)" }}
      >
        <div className="inline-flex items-center gap-1.5" style={{ minWidth: 0 }}>
          <IconActorMap size={13} color="var(--color-accent-primary)" />
          <h4
            className="text-xs font-semibold truncate"
            style={{ color: "var(--color-text-primary)" }}
          >
            共起語（上位{TOP_N}）
          </h4>
        </div>
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => void analyze()}
            disabled={loading}
            title="共起語を分析"
            className="inline-flex items-center justify-center"
            style={{
              width: "24px",
              height: "24px",
              backgroundColor: "var(--color-bg-tertiary)",
              color: "var(--color-text-secondary)",
              border: "1px solid var(--color-border-secondary)",
              borderRadius: "4px",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            <IconRefresh size={12} />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="閉じる"
            className="inline-flex items-center justify-center"
            style={{
              width: "24px",
              height: "24px",
              background: "none",
              color: "var(--color-text-tertiary)",
              border: "none",
              cursor: "pointer",
            }}
          >
            <IconClose size={13} />
          </button>
        </div>
      </header>

      <div className="px-3 py-2">
        {loading ? (
          <div className="text-xs py-4 text-center" style={{ color: "var(--color-text-tertiary)" }}>
            分析中
          </div>
        ) : error ? (
          <div className="text-xs py-3" style={{ color: "var(--color-danger, #dc2626)", lineHeight: 1.5 }}>
            {error}
          </div>
        ) : pairs.length === 0 ? (
          <div className="text-xs py-4 text-center" style={{ color: "var(--color-text-tertiary)" }}>
            共起ペアなし
          </div>
        ) : (
          <ol className="flex flex-col gap-1.5" style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {pairs.map((pair) => (
              <li
                key={`${pair.wordA}\0${pair.wordB}`}
                className="flex items-center justify-between gap-2 text-xs"
                style={{
                  padding: "6px 8px",
                  border: "1px solid var(--color-border-secondary)",
                  borderRadius: "6px",
                  backgroundColor: "var(--color-bg-secondary)",
                }}
              >
                <span
                  className="truncate"
                  style={{ color: "var(--color-text-primary)", minWidth: 0 }}
                  title={`${pair.wordA} ↔ ${pair.wordB}`}
                >
                  {pair.wordA} <span style={{ color: "var(--color-text-tertiary)" }}>↔</span> {pair.wordB}
                </span>
                <span
                  className="shrink-0 tabular-nums"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  ×{pair.count}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
};
