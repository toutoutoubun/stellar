/* eslint-disable react-refresh/only-export-components */
// src/components/onboarding/OnboardingFlow.tsx
// Stellar — オンボーディングフロー
// 初回起動時のみ表示（localStorage 'stellar-onboarded'）
// 5ステップ: ウェルカム → 言語選択 → ストレージ選択 → テーマプレビュー → 完了
// フェードトランジション（250ms）＋ プログレスドット

import type React from "react";
import { useState, useCallback, useEffect } from "react";
import { useThemeStore, THEMES, getAllThemes } from "../../stores/useThemeStore";
import { useI18nStore, useT } from "../../stores/useI18nStore";
import { SUPPORTED_LOCALES, LOCALE_NATIVE_NAMES } from "../../i18n";
import { ThemePreviewCard } from "../settings/ThemePreviewCard";
import type { Theme, Locale } from "../../types";
import { StellarIcon } from "../ui/StellarIcon";

const STORAGE_KEY = "stellar-onboarded";

/** オンボーディングが済んでいるかチェック */
export function isOnboarded(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/** オンボーディング完了をマーク */
function markOnboarded(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    // localStorage が使えない場合は無視
  }
}

// ============================================================
// ステップコンポーネント群
// ============================================================

/** Step 1: ウェルカム */
const WelcomeStep: React.FC<{ onNext: () => void }> = ({ onNext }) => {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <StellarIcon size={72} />
      <div>
        <h1 className="text-3xl font-bold mb-3" style={{ color: "var(--color-text-primary)" }}>
          {t.onboarding.welcome.title}
        </h1>
        <p className="text-base leading-relaxed" style={{ color: "var(--color-text-secondary)", maxWidth: "400px" }}>
          {t.onboarding.welcome.desc.split("\n").map((line, i) => (
            <span key={i}>{line}{i === 0 && <br />}</span>
          ))}
        </p>
      </div>
      <button
        onClick={onNext}
        className="px-6 py-2.5 text-sm font-semibold"
        style={{
          backgroundColor: "var(--color-accent-primary)", color: "var(--color-text-inverse)",
          borderRadius: "var(--radius-button)", border: "none", cursor: "pointer",
          transition: "opacity 150ms ease-out",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
      >
        {t.onboarding.welcome.start}
      </button>
    </div>
  );
};

/** Step 2: 言語選択 */
const LanguageStep: React.FC<{
  onNext: () => void;
  onBack: () => void;
}> = ({ onNext, onBack }) => {
  const t = useT();
  const locale = useI18nStore((s) => s.locale);
  const setLocale = useI18nStore((s) => s.setLocale);

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      {/* Globe icon */}
      <svg
        width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ color: "var(--color-accent-primary)" }}
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>

      <div>
        <h2 className="text-xl font-bold mb-2" style={{ color: "var(--color-text-primary)" }}>
          {t.onboarding.language.title}
        </h2>
        <p className="text-base leading-relaxed" style={{ color: "var(--color-text-secondary)", maxWidth: "400px" }}>
          {t.onboarding.language.desc}
        </p>
      </div>

      {/* 言語選択カード */}
      <div className="flex flex-col gap-2" style={{ width: "320px" }}>
        {SUPPORTED_LOCALES.map((loc: Locale) => (
          <button
            key={loc}
            type="button"
            onClick={() => setLocale(loc)}
            className="flex items-center gap-3 px-4 py-3 text-left"
            style={{
              backgroundColor: locale === loc ? "var(--color-bg-hover)" : "var(--color-bg-card)",
              borderRadius: "var(--radius-input)",
              border: locale === loc
                ? "2px solid var(--color-accent-primary)"
                : "2px solid var(--color-border-secondary)",
              cursor: "pointer",
              transition: "all var(--transition-fast)",
            }}
          >
            {/* locale name only — no flag */}
            <span className="flex-1 text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
              {LOCALE_NATIVE_NAMES[loc]}
            </span>
            {locale === loc && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ color: "var(--color-accent-primary)" }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
        ))}
      </div>

      {/* ナビゲーションボタン */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="px-5 py-2 text-sm font-medium"
          style={{
            color: "var(--color-text-secondary)", backgroundColor: "transparent",
            border: "1px solid var(--color-border-primary)", borderRadius: "var(--radius-button)", cursor: "pointer",
          }}
        >
          {t.common.back}
        </button>
        <button
          onClick={onNext}
          className="px-5 py-2 text-sm font-semibold"
          style={{
            backgroundColor: "var(--color-accent-primary)", color: "var(--color-text-inverse)",
            borderRadius: "var(--radius-button)", border: "none", cursor: "pointer",
          }}
        >
          {t.common.next}
        </button>
      </div>
    </div>
  );
};

/** Step 3: ストレージ選択 */
const StorageStep: React.FC<{
  onNext: () => void;
  onBack: () => void;
}> = ({ onNext, onBack }) => {
  const t = useT();
  const [dataPath, setDataPath] = useState("~/Stellar");

  const handleChooseFolder = useCallback(async () => {
    try {
      const { openDirectoryDialog } = await import("../../lib/tauriShim");
      const selected = await openDirectoryDialog();
      if (selected) {
        setDataPath(selected);
      }
    } catch {
      // キャンセルされた場合
    }
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <svg
        width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ color: "var(--color-accent-primary)" }}
      >
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>

      <div>
        <h2 className="text-xl font-bold mb-2" style={{ color: "var(--color-text-primary)" }}>
          {t.onboarding.storage.title}
        </h2>
        <p className="text-base leading-relaxed" style={{ color: "var(--color-text-secondary)", maxWidth: "400px" }}>
          {t.onboarding.storage.desc.split("\n").map((line, i) => (
            <span key={i}>{line}{i === 0 && <br />}</span>
          ))}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="px-4 py-2 text-sm truncate" style={{
          backgroundColor: "var(--color-bg-tertiary)", color: "var(--color-text-secondary)",
          borderRadius: "var(--radius-input)", border: "1px solid var(--color-border-secondary)",
          maxWidth: "300px", minWidth: "200px",
        }}>
          {dataPath}
        </div>
        <button
          onClick={handleChooseFolder}
          className="px-3 py-2 text-xs font-medium"
          style={{
            backgroundColor: "var(--color-bg-hover)", color: "var(--color-text-primary)",
            borderRadius: "var(--radius-button)", border: "1px solid var(--color-border-primary)",
            cursor: "pointer", transition: "all var(--transition-fast)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-bg-active)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--color-bg-hover)"; }}
        >
          {t.onboarding.storage.change}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="px-5 py-2 text-sm font-medium"
          style={{
            color: "var(--color-text-secondary)", backgroundColor: "transparent",
            border: "1px solid var(--color-border-primary)", borderRadius: "var(--radius-button)", cursor: "pointer",
          }}
        >
          {t.common.back}
        </button>
        <button
          onClick={onNext}
          className="px-5 py-2 text-sm font-semibold"
          style={{
            backgroundColor: "var(--color-accent-primary)", color: "var(--color-text-inverse)",
            borderRadius: "var(--radius-button)", border: "none", cursor: "pointer",
          }}
        >
          {t.common.next}
        </button>
      </div>
    </div>
  );
};

/** Step 4: テーマプレビュー */
const ThemeStep: React.FC<{
  onNext: () => void;
  onBack: () => void;
}> = ({ onNext, onBack }) => {
  const t = useT();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  const handleThemeChange = useCallback(
    (newTheme: Theme) => {
      document.body.setAttribute("data-theme-transition", "");
      setTheme(newTheme);
      setTimeout(() => {
        document.body.removeAttribute("data-theme-transition");
      }, 300);
    },
    [setTheme],
  );

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <svg
        width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ color: "var(--color-accent-primary)" }}
      >
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>

      <div>
        <h2 className="text-xl font-bold mb-2" style={{ color: "var(--color-text-primary)" }}>
          {t.onboarding.theme.title}
        </h2>
        <p className="text-base" style={{ color: "var(--color-text-secondary)" }}>
          {t.onboarding.theme.desc}
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {getAllThemes().map((meta) => (
          <ThemePreviewCard key={meta.id} meta={meta} isSelected={theme === meta.id} onSelect={handleThemeChange} />
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="px-5 py-2 text-sm font-medium"
          style={{
            color: "var(--color-text-secondary)", backgroundColor: "transparent",
            border: "1px solid var(--color-border-primary)", borderRadius: "var(--radius-button)", cursor: "pointer",
          }}
        >
          {t.common.back}
        </button>
        <button
          onClick={onNext}
          className="px-5 py-2 text-sm font-semibold"
          style={{
            backgroundColor: "var(--color-accent-primary)", color: "var(--color-text-inverse)",
            borderRadius: "var(--radius-button)", border: "none", cursor: "pointer",
          }}
        >
          {t.common.next}
        </button>
      </div>
    </div>
  );
};

/** Step 5: 完了 */
const CompletionStep: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div style={{
        width: "64px", height: "64px", borderRadius: "50%",
        backgroundColor: "var(--color-accent-secondary)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-2" style={{ color: "var(--color-text-primary)" }}>
          {t.onboarding.completion.title}
        </h2>
        <p className="text-base leading-relaxed" style={{ color: "var(--color-text-secondary)", maxWidth: "400px" }}>
          {t.onboarding.completion.desc.split("\n").map((line, i) => (
            <span key={i}>{line}{i === 0 && <br />}</span>
          ))}
        </p>
      </div>

      <div className="flex flex-col gap-2 text-sm" style={{ color: "var(--color-text-tertiary)" }}>
        <div className="flex items-center gap-2">
          <kbd className="px-1.5 py-0.5" style={{
            backgroundColor: "var(--color-bg-tertiary)", borderRadius: "4px",
            border: "1px solid var(--color-border-secondary)", fontSize: "10px",
          }}>Ctrl+K</kbd>
          <span>{t.onboarding.completion.shortcutSearch}</span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="px-1.5 py-0.5" style={{
            backgroundColor: "var(--color-bg-tertiary)", borderRadius: "4px",
            border: "1px solid var(--color-border-secondary)", fontSize: "10px",
          }}>Ctrl+N</kbd>
          <span>{t.onboarding.completion.shortcutNote}</span>
        </div>
      </div>

      <button
        onClick={onComplete}
        className="px-6 py-2.5 text-sm font-semibold"
        style={{
          backgroundColor: "var(--color-accent-primary)", color: "var(--color-text-inverse)",
          borderRadius: "var(--radius-button)", border: "none", cursor: "pointer",
          transition: "opacity 150ms ease-out",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
      >
        {t.onboarding.completion.startButton}
      </button>
    </div>
  );
};

// ============================================================
// メインコンポーネント
// ============================================================

const TOTAL_STEPS = 5;

interface OnboardingFlowProps {
  onComplete: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [fadeState, setFadeState] = useState<"in" | "out">("in");

  /** ステップ遷移（フェードアウト → ステップ変更 → フェードイン） */
  const goToStep = useCallback((nextStep: number) => {
    setFadeState("out");
    setTimeout(() => {
      setStep(nextStep);
      setFadeState("in");
    }, 250);
  }, []);

  const handleNext = useCallback(() => {
    if (step < TOTAL_STEPS - 1) {
      goToStep(step + 1);
    }
  }, [step, goToStep]);

  const handleBack = useCallback(() => {
    if (step > 0) {
      goToStep(step - 1);
    }
  }, [step, goToStep]);

  const handleComplete = useCallback(() => {
    markOnboarded();
    setFadeState("out");
    setTimeout(() => {
      onComplete();
    }, 250);
  }, [onComplete]);

  // フェードイン on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- legitimate data sync/fetch pattern
    setFadeState("in");
  }, []);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ backgroundColor: "var(--color-bg-primary)", zIndex: 9998 }}
    >
      {/* ステップコンテンツ（フェードトランジション） */}
      <div style={{
        opacity: fadeState === "in" ? 1 : 0,
        transition: "opacity 250ms ease-in-out",
        padding: "32px", minWidth: "480px",
      }}>
        {step === 0 && <WelcomeStep onNext={handleNext} />}
        {step === 1 && <LanguageStep onNext={handleNext} onBack={handleBack} />}
        {step === 2 && <StorageStep onNext={handleNext} onBack={handleBack} />}
        {step === 3 && <ThemeStep onNext={handleNext} onBack={handleBack} />}
        {step === 4 && <CompletionStep onComplete={handleComplete} />}
      </div>

      {/* プログレスドット */}
      <div className="fixed bottom-8 left-1/2" style={{ transform: "translateX(-50%)" }}>
        <div className="flex items-center gap-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              style={{
                width: step === i ? "24px" : "8px",
                height: "8px", borderRadius: "4px",
                backgroundColor: step === i ? "var(--color-accent-primary)" : "var(--color-border-primary)",
                transition: "all 250ms ease-out",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
