// src/components/ui/TutorialOverlay.tsx
// Stellar — 使い方チュートリアル・インフォメーション オーバーレイ
// アプリの主要機能を紹介するステップ型ガイド
// ヘルプボタン（?）からいつでも呼び出し可能
// localStorage で「チュートリアル済み」を記憶

import type React from "react";
import { useState, useCallback, useEffect } from "react";

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
    title: "文献ライブラリ",
    description:
      "PDF をドラッグ&ドロップするか、手動で論文情報を入力して文献を管理できます。タグやフィルターで素早く必要な論文を見つけましょう。",
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <line x1="8" y1="7" x2="16" y2="7" />
        <line x1="8" y1="11" x2="14" y2="11" />
      </svg>
    ),
    tips: [
      "サイドバーの本のアイコンからアクセス",
      "PDF添付で自動メタデータ抽出",
      "タグ・年・PDF有無でフィルタリング",
    ],
  },
  {
    title: "PDF リーダー & ハイライト",
    description:
      "論文の PDF を読みながら、重要な箇所をハイライトできます。4色のカラーで分類し、メモを添えて整理しましょう。",
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <rect x="6" y="12" width="12" height="3" rx="1" fill="rgba(255,235,59,0.4)" stroke="none" />
      </svg>
    ),
    tips: [
      "テキスト選択でハイライトツールバー表示",
      "黄・青・緑・ピンクの4色で分類",
      "Ctrl++ / Ctrl+- でズーム操作",
    ],
  },
  {
    title: "ノートエディタ",
    description:
      "Markdown 記法で自由にノートを作成。WikiLink（[[リンク名]]）で他のノートや論文と繋げて知識ネットワークを構築できます。",
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    tips: [
      "[[ で WikiLink オートコンプリート",
      "==テキスト== でハイライト表示",
      "@cite{ID} で論文引用バッジ",
      "画像やダイアグラム（Mermaid）も挿入可能",
    ],
  },
  {
    title: "ダイアグラム & フローチャート",
    description:
      "Mermaid 記法を使って、フローチャート・シーケンス図・クラス図・ガントチャートなど様々なダイアグラムをノートに挿入できます。",
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="8" y="16" width="8" height="5" rx="1" />
        <line x1="6.5" y1="8" x2="6.5" y2="13" />
        <line x1="17.5" y1="8" x2="17.5" y2="13" />
        <line x1="6.5" y1="13" x2="17.5" y2="13" />
        <line x1="12" y1="13" x2="12" y2="16" />
      </svg>
    ),
    tips: [
      "エディタツールバーの「ダイアグラム」ボタンから",
      "8種類のテンプレートを用意",
      "ライブプレビューで確認しながら編集",
    ],
  },
  {
    title: "グラフビュー",
    description:
      "ノートと論文の繋がりを力学グラフで視覚化。クラスターを発見し、新しいアイデアの種を見つけましょう。",
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
      "サイドバーのグラフアイコンからアクセス",
      "ノード・リンク・タグでフィルタリング",
      "ダブルクリックでノート/論文に遷移",
    ],
  },
  {
    title: "書き出し & エクスポート",
    description:
      "ノートを Markdown、プレーンテキスト、HTML、PDF、DOCX 形式でエクスポートできます。研究成果をお好みの形式で共有しましょう。",
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
    tips: [
      "ノートエディタのメニュー（…）からエクスポート",
      "PDF/DOCX は Tauri 経由でネイティブ変換",
      "引用スタイルは設定画面で変更可能",
    ],
  },
  {
    title: "ショートカット & ヒント",
    description:
      "キーボードショートカットを覚えると、さらに効率的に作業できます。",
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
      "Ctrl+K — 全文検索",
      "Ctrl+N — 新規ノート作成",
      "Ctrl+, — 設定を開く",
      "Ctrl+Shift+F — フォーカスモード",
      "Ctrl+[ / ] — 戻る / 進む",
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
          width: "540px",
          maxWidth: "90vw",
          maxHeight: "80vh",
          backgroundColor: "var(--color-bg-modal, var(--color-bg-primary))",
          borderRadius: "16px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
          border: "1px solid var(--color-border-secondary)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ヘッダー（閉じるボタン） */}
        <div
          className="flex items-center justify-between px-6 pt-5 pb-0"
          style={{ flexShrink: 0 }}
        >
          <div className="flex items-center gap-2">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: "var(--color-accent-primary)" }}
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              Stellar ガイド
            </span>
          </div>
          <button
            onClick={handleClose}
            className="flex items-center justify-center"
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "8px",
              color: "var(--color-text-tertiary)",
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
            aria-label="閉じる"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* コンテンツ */}
        <div
          className="flex-1 overflow-y-auto px-6 pt-6 pb-4"
          style={{
            opacity: fadeState === "in" ? 1 : 0,
            transition: "opacity 200ms ease-out",
          }}
        >
          {/* アイコン + タイトル */}
          <div className="flex flex-col items-center text-center mb-5">
            <div
              className="flex items-center justify-center mb-4"
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "18px",
                backgroundColor: "var(--color-bg-hover)",
                color: "var(--color-accent-primary)",
              }}
            >
              {currentStep.icon}
            </div>
            <h2
              className="text-lg font-bold mb-2"
              style={{ color: "var(--color-text-primary)" }}
            >
              {currentStep.title}
            </h2>
            <p
              className="text-sm leading-relaxed"
              style={{
                color: "var(--color-text-secondary)",
                maxWidth: "420px",
              }}
            >
              {currentStep.description}
            </p>
          </div>

          {/* ヒント */}
          {currentStep.tips && currentStep.tips.length > 0 && (
            <div
              className="mx-auto"
              style={{
                maxWidth: "400px",
                backgroundColor: "var(--color-bg-secondary)",
                borderRadius: "12px",
                border: "1px solid var(--color-border-secondary)",
                padding: "12px 16px",
              }}
            >
              <div className="flex flex-col gap-2">
                {currentStep.tips.map((tip, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 text-xs"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    <span
                      style={{
                        color: "var(--color-accent-primary)",
                        fontWeight: 600,
                        flexShrink: 0,
                        marginTop: "1px",
                      }}
                    >
                      {/* チェックマーク or ドットアイコン */}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    <span style={{ lineHeight: "1.5" }}>{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* フッター: ナビゲーション */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{
            borderTop: "1px solid var(--color-border-secondary)",
            flexShrink: 0,
          }}
        >
          {/* プログレスドット */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goToStep(i)}
                style={{
                  width: step === i ? "20px" : "6px",
                  height: "6px",
                  borderRadius: "3px",
                  backgroundColor:
                    step === i
                      ? "var(--color-accent-primary)"
                      : "var(--color-border-primary)",
                  transition: "all 200ms ease-out",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
                aria-label={`ステップ ${i + 1}`}
              />
            ))}
          </div>

          {/* ステップカウンター + ボタン */}
          <div className="flex items-center gap-2">
            <span
              className="text-xs mr-2"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {step + 1} / {TOTAL_STEPS}
            </span>

            {step > 0 && (
              <button
                onClick={handlePrev}
                className="px-3 py-1.5 text-xs font-medium"
                style={{
                  color: "var(--color-text-secondary)",
                  backgroundColor: "transparent",
                  border: "1px solid var(--color-border-primary)",
                  borderRadius: "var(--radius-button, 8px)",
                  cursor: "pointer",
                }}
              >
                戻る
              </button>
            )}

            {step < TOTAL_STEPS - 1 ? (
              <button
                onClick={handleNext}
                className="px-3 py-1.5 text-xs font-semibold"
                style={{
                  backgroundColor: "var(--color-accent-primary)",
                  color: "var(--color-text-inverse)",
                  borderRadius: "var(--radius-button, 8px)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                次へ
              </button>
            ) : (
              <button
                onClick={handleClose}
                className="px-4 py-1.5 text-xs font-semibold"
                style={{
                  backgroundColor: "var(--color-accent-primary)",
                  color: "var(--color-text-inverse)",
                  borderRadius: "var(--radius-button, 8px)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                はじめる
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
      width: "24px",
      height: "24px",
      borderRadius: "50%",
      border: "1.5px solid var(--color-border-secondary)",
      color: "var(--color-text-tertiary)",
      backgroundColor: "transparent",
      fontSize: "11px",
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
    title="使い方ガイド"
    aria-label="使い方ガイドを開く"
  >
    ?
  </button>
);
