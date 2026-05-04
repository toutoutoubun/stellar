// src/components/onboarding/OnboardingFlow.tsx
// Stellar — オンボーディングフロー
// 初回起動時のみ表示（localStorage 'stellar-onboarded'）
// 4ステップ: ウェルカム → ストレージ選択 → テーマプレビュー → 完了
// フェードトランジション（250ms）＋ プログレスドット

import type React from "react";
import { useState, useCallback, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useThemeStore, THEMES } from "../../stores/useThemeStore";
import { ThemePreviewCard } from "../settings/ThemePreviewCard";
import type { Theme } from "../../types";

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
const WelcomeStep: React.FC<{ onNext: () => void }> = ({ onNext }) => (
  <div className="flex flex-col items-center gap-6 text-center">
    {/* ロゴ */}
    <svg
      width="72"
      height="72"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: "var(--color-accent-primary)" }}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>

    <div>
      <h1
        className="text-2xl font-bold mb-2"
        style={{ color: "var(--color-text-primary)" }}
      >
        Stellar へようこそ
      </h1>
      <p
        className="text-sm leading-relaxed"
        style={{
          color: "var(--color-text-secondary)",
          maxWidth: "400px",
        }}
      >
        文献管理・ノート・グラフビューを1つのアプリで。
        <br />
        研究をもっとスマートに。
      </p>
    </div>

    <button
      onClick={onNext}
      className="px-6 py-2.5 text-sm font-semibold"
      style={{
        backgroundColor: "var(--color-accent-primary)",
        color: "var(--color-text-inverse)",
        borderRadius: "var(--radius-button)",
        border: "none",
        cursor: "pointer",
        transition: "opacity 150ms ease-out",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = "0.9";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = "1";
      }}
    >
      はじめる
    </button>
  </div>
);

/** Step 2: ストレージ選択 */
const StorageStep: React.FC<{
  onNext: () => void;
  onBack: () => void;
}> = ({ onNext, onBack }) => {
  const [dataPath, setDataPath] = useState("~/Stellar");

  const handleChooseFolder = useCallback(async () => {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (selected) {
        setDataPath(typeof selected === "string" ? selected : String(selected));
      }
    } catch {
      // キャンセルされた場合
    }
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      {/* アイコン */}
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: "var(--color-accent-primary)" }}
      >
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>

      <div>
        <h2
          className="text-xl font-bold mb-2"
          style={{ color: "var(--color-text-primary)" }}
        >
          データの保存先
        </h2>
        <p
          className="text-sm leading-relaxed"
          style={{
            color: "var(--color-text-secondary)",
            maxWidth: "400px",
          }}
        >
          文献データや PDF の保存先を選択してください。
          <br />
          あとから設定で変更できます。
        </p>
      </div>

      {/* 現在のパス表示 + 変更ボタン */}
      <div className="flex items-center gap-3">
        <div
          className="px-4 py-2 text-sm truncate"
          style={{
            backgroundColor: "var(--color-bg-tertiary)",
            color: "var(--color-text-secondary)",
            borderRadius: "var(--radius-input)",
            border: "1px solid var(--color-border-secondary)",
            maxWidth: "300px",
            minWidth: "200px",
          }}
        >
          {dataPath}
        </div>
        <button
          onClick={handleChooseFolder}
          className="px-3 py-2 text-xs font-medium"
          style={{
            backgroundColor: "var(--color-bg-hover)",
            color: "var(--color-text-primary)",
            borderRadius: "var(--radius-button)",
            border: "1px solid var(--color-border-primary)",
            cursor: "pointer",
            transition: "all var(--transition-fast)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--color-bg-active)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
          }}
        >
          変更...
        </button>
      </div>

      {/* ナビゲーションボタン */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="px-5 py-2 text-sm font-medium"
          style={{
            color: "var(--color-text-secondary)",
            backgroundColor: "transparent",
            border: "1px solid var(--color-border-primary)",
            borderRadius: "var(--radius-button)",
            cursor: "pointer",
          }}
        >
          戻る
        </button>
        <button
          onClick={onNext}
          className="px-5 py-2 text-sm font-semibold"
          style={{
            backgroundColor: "var(--color-accent-primary)",
            color: "var(--color-text-inverse)",
            borderRadius: "var(--radius-button)",
            border: "none",
            cursor: "pointer",
          }}
        >
          次へ
        </button>
      </div>
    </div>
  );
};

/** Step 3: テーマプレビュー */
const ThemeStep: React.FC<{
  onNext: () => void;
  onBack: () => void;
}> = ({ onNext, onBack }) => {
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
      {/* アイコン */}
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: "var(--color-accent-primary)" }}
      >
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>

      <div>
        <h2
          className="text-xl font-bold mb-2"
          style={{ color: "var(--color-text-primary)" }}
        >
          テーマを選ぶ
        </h2>
        <p
          className="text-sm"
          style={{ color: "var(--color-text-secondary)" }}
        >
          お好みの外観テーマを選択してください
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {THEMES.map((meta) => (
          <ThemePreviewCard
            key={meta.id}
            meta={meta}
            isSelected={theme === meta.id}
            onSelect={handleThemeChange}
          />
        ))}
      </div>

      {/* ナビゲーションボタン */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="px-5 py-2 text-sm font-medium"
          style={{
            color: "var(--color-text-secondary)",
            backgroundColor: "transparent",
            border: "1px solid var(--color-border-primary)",
            borderRadius: "var(--radius-button)",
            cursor: "pointer",
          }}
        >
          戻る
        </button>
        <button
          onClick={onNext}
          className="px-5 py-2 text-sm font-semibold"
          style={{
            backgroundColor: "var(--color-accent-primary)",
            color: "var(--color-text-inverse)",
            borderRadius: "var(--radius-button)",
            border: "none",
            cursor: "pointer",
          }}
        >
          次へ
        </button>
      </div>
    </div>
  );
};

/** Step 4: 完了 */
const CompletionStep: React.FC<{ onComplete: () => void }> = ({
  onComplete,
}) => (
  <div className="flex flex-col items-center gap-6 text-center">
    {/* チェックアイコン */}
    <div
      style={{
        width: "64px",
        height: "64px",
        borderRadius: "50%",
        backgroundColor: "var(--color-accent-secondary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>

    <div>
      <h2
        className="text-xl font-bold mb-2"
        style={{ color: "var(--color-text-primary)" }}
      >
        準備完了!
      </h2>
      <p
        className="text-sm leading-relaxed"
        style={{
          color: "var(--color-text-secondary)",
          maxWidth: "400px",
        }}
      >
        Stellar の設定が完了しました。
        <br />
        さっそく文献を追加して、研究を始めましょう。
      </p>
    </div>

    <div
      className="flex flex-col gap-2 text-xs"
      style={{ color: "var(--color-text-tertiary)" }}
    >
      <div className="flex items-center gap-2">
        <kbd
          className="px-1.5 py-0.5"
          style={{
            backgroundColor: "var(--color-bg-tertiary)",
            borderRadius: "4px",
            border: "1px solid var(--color-border-secondary)",
            fontSize: "10px",
          }}
        >
          Ctrl+K
        </kbd>
        <span>全文検索を開く</span>
      </div>
      <div className="flex items-center gap-2">
        <kbd
          className="px-1.5 py-0.5"
          style={{
            backgroundColor: "var(--color-bg-tertiary)",
            borderRadius: "4px",
            border: "1px solid var(--color-border-secondary)",
            fontSize: "10px",
          }}
        >
          Ctrl+N
        </kbd>
        <span>新しいノートを作成</span>
      </div>
    </div>

    <button
      onClick={onComplete}
      className="px-6 py-2.5 text-sm font-semibold"
      style={{
        backgroundColor: "var(--color-accent-primary)",
        color: "var(--color-text-inverse)",
        borderRadius: "var(--radius-button)",
        border: "none",
        cursor: "pointer",
        transition: "opacity 150ms ease-out",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = "0.9";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = "1";
      }}
    >
      Stellar を使い始める
    </button>
  </div>
);

// ============================================================
// メインコンポーネント
// ============================================================

const TOTAL_STEPS = 4;

interface OnboardingFlowProps {
  onComplete: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  onComplete,
}) => {
  const [step, setStep] = useState(0);
  const [fadeState, setFadeState] = useState<"in" | "out">("in");

  /** ステップ遷移（フェードアウト → ステップ変更 → フェードイン） */
  const goToStep = useCallback(
    (nextStep: number) => {
      setFadeState("out");
      setTimeout(() => {
        setStep(nextStep);
        setFadeState("in");
      }, 250);
    },
    [],
  );

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
    setFadeState("in");
  }, []);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        backgroundColor: "var(--color-bg-primary)",
        zIndex: 9998,
      }}
    >
      {/* ステップコンテンツ（フェードトランジション） */}
      <div
        style={{
          opacity: fadeState === "in" ? 1 : 0,
          transition: "opacity 250ms ease-in-out",
          padding: "32px",
          minWidth: "480px",
        }}
      >
        {step === 0 && <WelcomeStep onNext={handleNext} />}
        {step === 1 && <StorageStep onNext={handleNext} onBack={handleBack} />}
        {step === 2 && <ThemeStep onNext={handleNext} onBack={handleBack} />}
        {step === 3 && <CompletionStep onComplete={handleComplete} />}
      </div>

      {/* プログレスドット */}
      <div
        className="fixed bottom-8 left-1/2"
        style={{ transform: "translateX(-50%)" }}
      >
        <div className="flex items-center gap-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              style={{
                width: step === i ? "24px" : "8px",
                height: "8px",
                borderRadius: "4px",
                backgroundColor:
                  step === i
                    ? "var(--color-accent-primary)"
                    : "var(--color-border-primary)",
                transition: "all 250ms ease-out",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
