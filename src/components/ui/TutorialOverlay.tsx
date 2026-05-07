// src/components/ui/TutorialOverlay.tsx
// Stellar — 使い方チュートリアル・インフォメーション オーバーレイ
// アプリの主要機能を紹介するステップ型ガイド
// ヘルプボタン（?）からいつでも呼び出し可能
// localStorage で「チュートリアル済み」を記憶

import type React from "react";
import { useState, useCallback, useEffect } from "react";
import { StellarIcon } from "./StellarIcon";
import { useT, useI18nStore } from "../../stores/useI18nStore";

const TUTORIAL_STORAGE_KEY = "stellar-tutorial-seen";

/** チュートリアル表示済みか */
export function isTutorialSeen(): boolean {

  try {
    return localStorage.getItem(TUTORIAL_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/** チュートリアル表示済みをマーク */
function markTutorialSeen(): void {
  try {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, "true");
  } catch {
    // localStorage が使えない場合は無視
  }
}

// ============================================================
// チュートリアルステップ定義
// ============================================================

interface TutorialStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  tips?: string[];
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: useI18nStore.getState().t.ui.str_42m74l,
    description:
      useI18nStore.getState().t.ui.PDF_PDF,
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <line x1="8" y1="7" x2="16" y2="7" />
        <line x1="8" y1="11" x2="14" y2="11" />
      </svg>
    ),
    tips: [
      useI18nStore.getState().t.ui.str_7mkitv,
      useI18nStore.getState().t.ui.PDF,
      useI18nStore.getState().t.ui.PDF_2,
      useI18nStore.getState().t.ui.str_e5vkvi,
    ],
  },
  {
    title: useI18nStore.getState().t.ui.PDF_3,
    description:
      useI18nStore.getState().t.ui.PDF_4,
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <rect x="6" y="12" width="12" height="3" rx="1" fill="rgba(255,235,59,0.4)" stroke="none" />
      </svg>
    ),
    tips: [
      useI18nStore.getState().t.ui.str_pdath0,
      useI18nStore.getState().t.ui.str_12gmj3,
      useI18nStore.getState().t.ui.str_efmawu,
      useI18nStore.getState().t.ui.Ctrl_Ctrl,
    ],
  },
  {
    title: useI18nStore.getState().t.ui.str_70k5md,
    description:
      useI18nStore.getState().t.ui.Markdown_WikiLink,
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    tips: [
      useI18nStore.getState().t.ui.WikiLink,
      useI18nStore.getState().t.ui.str_12vhnw,
      useI18nStore.getState().t.ui.cite_ID,
      useI18nStore.getState().t.ui.Mermaid,
    ],
  },
  {
    title: useI18nStore.getState().t.ui.str_9of5o2,
    description:
      useI18nStore.getState().t.ui.str_jl33sc,
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="6" r="3" />
        <circle cx="18" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="18" r="3" />
        <line x1="8.5" y1="7.5" x2="15.5" y2="16.5" />
        <line x1="15.5" y1="7.5" x2="8.5" y2="16.5" />
        <line x1="6" y1="9" x2="6" y2="15" />
        <line x1="18" y1="9" x2="18" y2="15" />
      </svg>
    ),
    tips: [
      useI18nStore.getState().t.ui.str_8njrnl,
      useI18nStore.getState().t.ui.str_np8niw,
      useI18nStore.getState().t.ui.str_snbfcy,
      useI18nStore.getState().t.ui.str_q20ljt,
    ],
  },
  {
    title: useI18nStore.getState().t.sidebar.qualitative,
    description:
      useI18nStore.getState().t.ui.str_yl6zoy,
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <line x1="9" y1="12" x2="15" y2="12" />
        <line x1="9" y1="16" x2="13" y2="16" />
      </svg>
    ),
    tips: [
      useI18nStore.getState().t.ui.str_8mb9ay,
      useI18nStore.getState().t.ui.str_f86lqw,
      useI18nStore.getState().t.ui.str_usyyxr,
      useI18nStore.getState().t.ui.ICR,
    ],
  },
  {
    title: useI18nStore.getState().t.sidebar.quantitative,
    description:
      useI18nStore.getState().t.ui.CSV,
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
        <line x1="3" y1="20" x2="21" y2="20" />
      </svg>
    ),
    tips: [
      useI18nStore.getState().t.ui.CSV_2,
      useI18nStore.getState().t.ui.str_1ejdsm,
      useI18nStore.getState().t.ui.str_byjyhn,
      useI18nStore.getState().t.ui.str_fh5t7q,
    ],
  },
  {
    title: useI18nStore.getState().t.ui.str_44nlwx,
    description:
      useI18nStore.getState().t.ui.Markdown_PDF_DOCX,
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M6 8h.001" />
        <path d="M10 8h.001" />
        <path d="M14 8h.001" />
        <path d="M18 8h.001" />
        <path d="M8 12h.001" />
        <path d="M12 12h.001" />
        <path d="M16 12h.001" />
        <path d="M7 16h10" />
      </svg>
    ),
    tips: [
      useI18nStore.getState().t.ui.Ctrl_K,
      useI18nStore.getState().t.ui.Ctrl_N,
      useI18nStore.getState().t.ui.Ctrl,
      useI18nStore.getState().t.ui.Ctrl_Shift_F,
    ],
  },
];

const TOTAL_STEPS = TUTORIAL_STEPS.length;

// ============================================================
// TutorialOverlay コンポーネント
// ============================================================

interface TutorialOverlayProps {
  open: boolean;
  onClose: () => void;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  open,
  onClose,
}) => {
  const t = useT();
  const [step, setStep] = useState(0);
  const [fadeState, setFadeState] = useState<"in" | "out">("in");

  /** ステップ遷移 */
  const goToStep = useCallback((nextStep: number) => {
    setFadeState("out");
    setTimeout(() => {
      setStep(nextStep);
      setFadeState("in");
    }, 200);
  }, []);

  const handleNext = useCallback(() => {
    if (step < TOTAL_STEPS - 1) {
      goToStep(step + 1);
    }
  }, [step, goToStep]);

  const handlePrev = useCallback(() => {
    if (step > 0) {
      goToStep(step - 1);
    }
  }, [step, goToStep]);

  const handleClose = useCallback(() => {
    markTutorialSeen();
    setFadeState("out");
    setTimeout(() => {
      onClose();
      // リセット
      setStep(0);
      setFadeState("in");
    }, 200);
  }, [onClose]);

  // ESC キーで閉じる
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, handleClose]);

  // フェードイン on open
  useEffect(() => {
    if (open) setFadeState("in");
  }, [open]);

  if (!open) return null;

  const currentStep = TUTORIAL_STEPS[step];
  if (!currentStep) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(6px)",
        zIndex: 9999,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        style={{
          opacity: fadeState === "in" ? 1 : 0,
          transform: fadeState === "in" ? "translateY(0) scale(1)" : "translateY(12px) scale(0.98)",
          transition: "all 200ms ease-out",
          width: "580px",
          maxWidth: "92vw",
          maxHeight: "85vh",
          backgroundColor: "var(--color-bg-modal, var(--color-bg-primary))",
          borderRadius: "16px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
          border: "1px solid var(--color-border-secondary)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ── ヘッダー ── */}
        <div
          className="flex items-center justify-between"
          style={{
            flexShrink: 0,
            padding: "20px 24px 0 24px",
          }}
        >
          <div className="flex items-center gap-2.5">
            <StellarIcon size={22} />
            <span
              style={{
                fontSize: "13px",
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase" as const,
                color: "var(--color-text-tertiary)",
              }}
            >
              {t.ui.str_z5hxct}
            </span>
          </div>
          <button
            onClick={handleClose}
            className="flex items-center justify-center"
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "8px",
              border: "none",
              color: "var(--color-text-tertiary)",
              backgroundColor: "transparent",
              cursor: "pointer",
              transition: "all 150ms ease-out",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
              e.currentTarget.style.color = "var(--color-text-secondary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--color-text-tertiary)";
            }}
            aria-label={t.common.close}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── コンテンツ ── */}
        <div
          className="flex-1 overflow-y-auto"
          style={{
            padding: "24px 28px 20px 28px",
            opacity: fadeState === "in" ? 1 : 0,
            transition: "opacity 200ms ease-out",
          }}
        >
          {/* アイコン + タイトル + 説明 */}
          <div className="flex flex-col items-center text-center" style={{ marginBottom: "20px" }}>
            <div
              className="flex items-center justify-center"
              style={{
                width: "68px",
                height: "68px",
                borderRadius: "16px",
                backgroundColor: "var(--color-bg-hover)",
                color: "var(--color-accent-primary)",
                marginBottom: "16px",
              }}
            >
              {currentStep.icon}
            </div>
            <h2
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "var(--color-text-primary)",
                marginBottom: "8px",
                lineHeight: 1.3,
              }}
            >
              {currentStep.title}
            </h2>
            <p
              style={{
                fontSize: "14px",
                lineHeight: 1.7,
                color: "var(--color-text-secondary)",
                maxWidth: "440px",
                margin: "0 auto",
              }}
            >
              {currentStep.description}
            </p>
          </div>

          {/* ヒントカード */}
          {currentStep.tips && currentStep.tips.length > 0 && (
            <div
              style={{
                maxWidth: "440px",
                margin: "0 auto",
                backgroundColor: "var(--color-bg-secondary)",
                borderRadius: "12px",
                border: "1px solid var(--color-border-secondary)",
                padding: "14px 18px",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {currentStep.tips.map((tip, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      fontSize: "13px",
                      color: "var(--color-text-secondary)",
                      lineHeight: 1.5,
                    }}
                  >
                    <span
                      style={{
                        color: "var(--color-accent-primary)",
                        flexShrink: 0,
                        marginTop: "2px",
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── フッター: ナビゲーション ── */}
        <div
          className="flex items-center justify-between"
          style={{
            flexShrink: 0,
            padding: "14px 24px",
            borderTop: "1px solid var(--color-border-secondary)",
          }}
        >
          {/* プログレスドット */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goToStep(i)}
                style={{
                  width: step === i ? "22px" : "8px",
                  height: "8px",
                  borderRadius: "4px",
                  backgroundColor:
                    step === i
                      ? "var(--color-accent-primary)"
                      : "var(--color-border-primary)",
                  transition: "all 200ms ease-out",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
                aria-label={`${t.common.next} ${i + 1}`}
              />
            ))}
          </div>

          {/* ステップカウンター + ボタン */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                fontSize: "13px",
                color: "var(--color-text-tertiary)",
                marginRight: "4px",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {step + 1} / {TOTAL_STEPS}
            </span>

            {step > 0 && (
              <button
                onClick={handlePrev}
                style={{
                  padding: "7px 16px",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--color-text-secondary)",
                  backgroundColor: "transparent",
                  border: "1px solid var(--color-border-primary)",
                  borderRadius: "var(--radius-button, 8px)",
                  cursor: "pointer",
                  transition: "all 150ms ease-out",
                }}
              >
                {t.common.back}
              </button>
            )}

            {step < TOTAL_STEPS - 1 ? (
              <button
                onClick={handleNext}
                style={{
                  padding: "7px 18px",
                  fontSize: "13px",
                  fontWeight: 600,
                  backgroundColor: "var(--color-accent-primary)",
                  color: "var(--color-text-inverse)",
                  borderRadius: "var(--radius-button, 8px)",
                  border: "none",
                  cursor: "pointer",
                  transition: "opacity 150ms ease-out",
                }}
              >
                {t.common.next}
              </button>
            ) : (
              <button
                onClick={handleClose}
                style={{
                  padding: "7px 20px",
                  fontSize: "13px",
                  fontWeight: 600,
                  backgroundColor: "var(--color-accent-primary)",
                  color: "var(--color-text-inverse)",
                  borderRadius: "var(--radius-button, 8px)",
                  border: "none",
                  cursor: "pointer",
                  transition: "opacity 150ms ease-out",
                }}
              >
                {t.onboarding.welcome.start}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// ヘルプボタンコンポーネント（Titlebar等に配置用）
// ============================================================

interface HelpButtonProps {
  onClick: () => void;
}

export const HelpButton: React.FC<HelpButtonProps> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center justify-center"
    style={{
      width: "26px",
      height: "26px",
      borderRadius: "50%",
      border: "1.5px solid var(--color-border-secondary)",
      color: "var(--color-text-tertiary)",
      backgroundColor: "transparent",
      fontSize: "12px",
      fontWeight: 700,
      cursor: "pointer",
      transition: "all 150ms ease-out",
      lineHeight: 1,
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.borderColor = "var(--color-accent-primary)";
      e.currentTarget.style.color = "var(--color-accent-primary)";
      e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor = "var(--color-border-secondary)";
      e.currentTarget.style.color = "var(--color-text-tertiary)";
      e.currentTarget.style.backgroundColor = "transparent";
    }}
    title={useI18nStore.getState().t.ui.str_z5hxct}
    aria-label={useI18nStore.getState().t.ui.str_q9yn7d}
  >
    ?
  </button>
);
