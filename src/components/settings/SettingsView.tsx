// src/components/settings/SettingsView.tsx
// Stellar — 設定画面
// 4タブ: 外観 / データ / ショートカット / 引用スタイル

import type React from "react";
import { useState, useCallback, useEffect } from "react";
import { useThemeStore, THEMES } from "../../stores/useThemeStore";
import { ThemePreviewCard } from "./ThemePreviewCard";
import type {
  Theme,
  SettingsTab,
  AppearanceSettings,
  DataSummary,
  ShortcutEntry,
  CitationStyle,
  AuthorNameOrder,
} from "../../types";
import {
  DEFAULT_APPEARANCE_SETTINGS,
  EDITOR_FONTS,
  CITATION_STYLE_LABELS,
} from "../../types";

// ============================================================
// ショートカット一覧（定数）
// ============================================================

const SHORTCUTS: ShortcutEntry[] = [
  // ナビゲーション
  { keys: "Ctrl+K", description: "全文検索を開く", category: "ナビゲーション" },
  { keys: "Ctrl+N", description: "新しいノートを作成", category: "ナビゲーション" },
  { keys: "Ctrl+,", description: "設定を開く", category: "ナビゲーション" },
  { keys: "Ctrl+1", description: "文献ライブラリに切替", category: "ナビゲーション" },
  { keys: "Ctrl+2", description: "ノートビューに切替", category: "ナビゲーション" },
  { keys: "Ctrl+3", description: "グラフビューに切替", category: "ナビゲーション" },
  // エディタ
  { keys: "Ctrl+S", description: "保存", category: "エディタ" },
  { keys: "Ctrl+B", description: "太字", category: "エディタ" },
  { keys: "Ctrl+I", description: "斜体", category: "エディタ" },
  { keys: "Ctrl+Z", description: "元に戻す", category: "エディタ" },
  { keys: "Ctrl+Shift+Z", description: "やり直し", category: "エディタ" },
  { keys: "[[", description: "WikiLink を挿入", category: "エディタ" },
  // グラフ
  { keys: "Cmd+A", description: "全ノードを選択", category: "グラフ" },
  { keys: "スクロール", description: "ズームイン/アウト", category: "グラフ" },
  { keys: "ドラッグ", description: "キャンバスをパン", category: "グラフ" },
  { keys: "ダブルクリック", description: "ノード詳細へ遷移", category: "グラフ" },
  // PDF リーダー
  { keys: "Ctrl++", description: "ズームイン", category: "PDF リーダー" },
  { keys: "Ctrl+-", description: "ズームアウト", category: "PDF リーダー" },
  { keys: "Ctrl+0", description: "ズームリセット", category: "PDF リーダー" },
];

// ============================================================
// タブ定義
// ============================================================

const TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  {
    id: "appearance",
    label: "外観",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    ),
  },
  {
    id: "data",
    label: "データ",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </svg>
    ),
  },
  {
    id: "shortcuts",
    label: "ショートカット",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
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
  },
  {
    id: "citation",
    label: "引用スタイル",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 17c2-2 4-6 4-10" />
        <path d="M6 17H3" />
        <path d="M14 17c2-2 4-6 4-10" />
        <path d="M14 17h-3" />
      </svg>
    ),
  },
];

// ============================================================
// SettingsView コンポーネント
// ============================================================

export const SettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("appearance");

  // 外観設定
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const [appearance, setAppearance] = useState<AppearanceSettings>(
    DEFAULT_APPEARANCE_SETTINGS
  );

  // データ設定
  const [dataSummary, setDataSummary] = useState<DataSummary | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);

  // 引用スタイル設定
  const [citationStyle, setCitationStyle] = useState<CitationStyle>("apa7");
  const [authorNameOrder, setAuthorNameOrder] =
    useState<AuthorNameOrder>("surname-first");

  // データサマリーの読み込み
  useEffect(() => {
    if (activeTab === "data") {
      setIsLoadingData(true);
      // TODO: get_data_summary コマンド未実装 — デフォルト値を設定
      Promise.resolve()
        .then(() => {
          setDataSummary({
            paperCount: 0,
            noteCount: 0,
            highlightCount: 0,
            diskUsage: "計算中...",
            dataPath: "~/Stellar",
          });
        })
        .finally(() => setIsLoadingData(false));
    }
  }, [activeTab]);

  // テーマ切替ハンドラ（data-theme-transition クラス付与）
  const handleThemeChange = useCallback(
    (newTheme: Theme) => {
      document.body.setAttribute("data-theme-transition", "");
      setTheme(newTheme);
      setTimeout(() => {
        document.body.removeAttribute("data-theme-transition");
      }, 300);
    },
    [setTheme]
  );

  // データパス変更
  const handleChangeDataPath = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ directory: true, multiple: false });
      if (selected) {
        // TODO: change_data_path コマンド未実装
        console.warn("change_data_path は未実装です", selected);
      }
    } catch {
      // キャンセルまたはエラー
    }
  }, []);

  // エクスポート
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      // TODO: export_data コマンド未実装
      console.warn("export_data は未実装です");
    } catch {
      // エラー時は何もしない
    } finally {
      setIsExporting(false);
    }
  }, []);

  // バックアップ
  const handleBackup = useCallback(async () => {
    setIsBackingUp(true);
    try {
      // TODO: create_backup コマンド未実装
      console.warn("create_backup は未実装です");
    } catch {
      // エラー時は何もしない
    } finally {
      setIsBackingUp(false);
    }
  }, []);

  // ============================================================
  // 外観タブ
  // ============================================================
  const renderAppearanceTab = () => (
    <div className="flex flex-col gap-8">
      {/* テーマ選択 */}
      <section>
        <h3
          className="text-sm font-semibold mb-1"
          style={{ color: "var(--color-text-primary)" }}
        >
          テーマ
        </h3>
        <p
          className="text-xs mb-4"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          アプリの外観テーマを選択します
        </p>
        <div className="flex flex-wrap gap-3">
          {THEMES.map((meta) => (
            <ThemePreviewCard
              key={meta.id}
              meta={meta}
              isSelected={theme === meta.id}
              onSelect={handleThemeChange}
            />
          ))}
        </div>
      </section>

      {/* フォントサイズ */}
      <section>
        <h3
          className="text-sm font-semibold mb-1"
          style={{ color: "var(--color-text-primary)" }}
        >
          フォントサイズ
        </h3>
        <p
          className="text-xs mb-3"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          アプリ全体のベースフォントサイズ（13px〜16px）
        </p>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={13}
            max={16}
            step={1}
            value={appearance.fontSize}
            onChange={(e) =>
              setAppearance((s) => ({
                ...s,
                fontSize: Number(e.target.value),
              }))
            }
            style={{
              accentColor: "var(--color-accent-primary)",
              width: "200px",
            }}
          />
          <span
            className="text-sm font-medium"
            style={{
              color: "var(--color-text-primary)",
              minWidth: "40px",
            }}
          >
            {appearance.fontSize}px
          </span>
        </div>
      </section>

      {/* 行の高さ */}
      <section>
        <h3
          className="text-sm font-semibold mb-1"
          style={{ color: "var(--color-text-primary)" }}
        >
          行の高さ
        </h3>
        <p
          className="text-xs mb-3"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          エディタの行間（1.5〜2.0）
        </p>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={1.5}
            max={2.0}
            step={0.1}
            value={appearance.lineHeight}
            onChange={(e) =>
              setAppearance((s) => ({
                ...s,
                lineHeight: Number(e.target.value),
              }))
            }
            style={{
              accentColor: "var(--color-accent-primary)",
              width: "200px",
            }}
          />
          <span
            className="text-sm font-medium"
            style={{
              color: "var(--color-text-primary)",
              minWidth: "40px",
            }}
          >
            {appearance.lineHeight.toFixed(1)}
          </span>
        </div>
      </section>

      {/* エディタフォント */}
      <section>
        <h3
          className="text-sm font-semibold mb-1"
          style={{ color: "var(--color-text-primary)" }}
        >
          エディタフォント
        </h3>
        <p
          className="text-xs mb-3"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          ノートエディタで使用するフォント
        </p>
        <select
          value={appearance.editorFont}
          onChange={(e) =>
            setAppearance((s) => ({ ...s, editorFont: e.target.value }))
          }
          className="text-sm px-3 py-2"
          style={{
            backgroundColor: "var(--color-bg-input)",
            color: "var(--color-text-primary)",
            border: "1px solid var(--color-border-primary)",
            borderRadius: "var(--radius-input)",
            outline: "none",
            minWidth: "240px",
            fontFamily: appearance.editorFont,
          }}
        >
          {EDITOR_FONTS.map((font) => (
            <option key={font.value} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>
        <div
          className="mt-3 p-3 text-sm"
          style={{
            backgroundColor: "var(--color-bg-secondary)",
            borderRadius: "var(--radius-input)",
            border: "1px solid var(--color-border-secondary)",
            fontFamily: appearance.editorFont,
            fontSize: `${appearance.fontSize}px`,
            lineHeight: appearance.lineHeight,
            color: "var(--color-text-primary)",
          }}
        >
          これはプレビューテキストです。The quick brown fox jumps over the lazy
          dog. 研究論文を効率的に管理し、知識をつなげましょう。
        </div>
      </section>
    </div>
  );

  // ============================================================
  // データタブ
  // ============================================================
  const renderDataTab = () => (
    <div className="flex flex-col gap-8">
      {/* データサマリー */}
      <section>
        <h3
          className="text-sm font-semibold mb-1"
          style={{ color: "var(--color-text-primary)" }}
        >
          データサマリー
        </h3>
        <p
          className="text-xs mb-4"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          アプリケーションのデータ統計
        </p>
        {isLoadingData ? (
          <div
            className="flex items-center gap-2 text-sm"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            <svg
              className="animate-spin"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="2"
                opacity="0.3"
              />
              <path
                d="M12 2a10 10 0 0 1 10 10"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            読み込み中...
          </div>
        ) : dataSummary ? (
          <div
            className="grid grid-cols-2 gap-3"
            style={{ maxWidth: "400px" }}
          >
            {[
              { label: "論文", value: `${dataSummary.paperCount} 件`, icon: "📄" },
              { label: "ノート", value: `${dataSummary.noteCount} 件`, icon: "📝" },
              { label: "ハイライト", value: `${dataSummary.highlightCount} 件`, icon: "🟡" },
              { label: "ディスク使用量", value: dataSummary.diskUsage, icon: "💾" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-3 p-3"
                style={{
                  backgroundColor: "var(--color-bg-secondary)",
                  borderRadius: "var(--radius-input)",
                  border: "1px solid var(--color-border-secondary)",
                }}
              >
                <span style={{ fontSize: "20px" }}>{item.icon}</span>
                <div>
                  <div
                    className="text-xs"
                    style={{ color: "var(--color-text-tertiary)" }}
                  >
                    {item.label}
                  </div>
                  <div
                    className="text-sm font-medium"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {item.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {/* データパス */}
      <section>
        <h3
          className="text-sm font-semibold mb-1"
          style={{ color: "var(--color-text-primary)" }}
        >
          データ保存先
        </h3>
        <p
          className="text-xs mb-3"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          データベースと PDF ファイルの保存場所
        </p>
        <div className="flex items-center gap-3">
          <div
            className="flex-1 px-3 py-2 text-sm truncate"
            style={{
              backgroundColor: "var(--color-bg-tertiary)",
              color: "var(--color-text-secondary)",
              borderRadius: "var(--radius-input)",
              border: "1px solid var(--color-border-secondary)",
              maxWidth: "360px",
            }}
          >
            {dataSummary?.dataPath ?? "~/Stellar"}
          </div>
          <button
            onClick={handleChangeDataPath}
            className="px-3 py-2 text-xs font-medium"
            style={{
              backgroundColor: "var(--color-bg-hover)",
              color: "var(--color-text-primary)",
              borderRadius: "var(--radius-button)",
              border: "1px solid var(--color-border-primary)",
              transition: "all var(--transition-fast)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                "var(--color-bg-active)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                "var(--color-bg-hover)";
            }}
          >
            変更...
          </button>
        </div>
        <p
          className="text-xs mt-2"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          ※ 変更時に DB と PDF フォルダがコピーされます
        </p>
      </section>

      {/* エクスポート & バックアップ */}
      <section>
        <h3
          className="text-sm font-semibold mb-1"
          style={{ color: "var(--color-text-primary)" }}
        >
          エクスポート＆バックアップ
        </h3>
        <p
          className="text-xs mb-4"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          データの書き出しやバックアップを作成します
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium"
            style={{
              backgroundColor: "var(--color-accent-primary)",
              color: "var(--color-text-inverse)",
              borderRadius: "var(--radius-button)",
              opacity: isExporting ? 0.6 : 1,
              cursor: isExporting ? "not-allowed" : "pointer",
              transition: "all var(--transition-fast)",
            }}
          >
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
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {isExporting ? "エクスポート中..." : "データをエクスポート"}
          </button>

          <button
            onClick={handleBackup}
            disabled={isBackingUp}
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium"
            style={{
              backgroundColor: "var(--color-bg-hover)",
              color: "var(--color-text-primary)",
              borderRadius: "var(--radius-button)",
              border: "1px solid var(--color-border-primary)",
              opacity: isBackingUp ? 0.6 : 1,
              cursor: isBackingUp ? "not-allowed" : "pointer",
              transition: "all var(--transition-fast)",
            }}
          >
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
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            {isBackingUp ? "バックアップ中..." : "バックアップを作成"}
          </button>
        </div>
        <p
          className="text-xs mt-2"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          エクスポート: JSON + PDF ZIP / バックアップ:
          stellar_backup_YYYYMMDD.zip
        </p>
      </section>
    </div>
  );

  // ============================================================
  // ショートカットタブ
  // ============================================================
  const renderShortcutsTab = () => {
    const categories = Array.from(new Set(SHORTCUTS.map((s) => s.category)));
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h3
            className="text-sm font-semibold mb-1"
            style={{ color: "var(--color-text-primary)" }}
          >
            キーボードショートカット
          </h3>
          <p
            className="text-xs mb-4"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            利用可能なキーボードショートカットの一覧です
          </p>
        </div>

        {categories.map((category) => (
          <section key={category}>
            <h4
              className="text-xs font-semibold mb-2 uppercase tracking-wider"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {category}
            </h4>
            <div
              style={{
                borderRadius: "var(--radius-input)",
                border: "1px solid var(--color-border-secondary)",
                overflow: "hidden",
              }}
            >
              {SHORTCUTS.filter((s) => s.category === category).map(
                (shortcut, index, arr) => (
                  <div
                    key={shortcut.keys}
                    className="flex items-center justify-between px-4 py-2.5"
                    style={{
                      backgroundColor: "var(--color-bg-card)",
                      borderBottom:
                        index < arr.length - 1
                          ? "1px solid var(--color-border-secondary)"
                          : "none",
                    }}
                  >
                    <span
                      className="text-sm"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.split("+").map((key, ki) => (
                        <span key={ki}>
                          {ki > 0 && (
                            <span
                              className="mx-0.5 text-xs"
                              style={{ color: "var(--color-text-tertiary)" }}
                            >
                              +
                            </span>
                          )}
                          <kbd
                            className="px-1.5 py-0.5 text-xs"
                            style={{
                              backgroundColor: "var(--color-bg-tertiary)",
                              color: "var(--color-text-secondary)",
                              borderRadius: "4px",
                              border:
                                "1px solid var(--color-border-secondary)",
                              fontSize: "11px",
                              fontFamily: "system-ui",
                            }}
                          >
                            {key.trim()}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          </section>
        ))}

        <p
          className="text-xs"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          ※ ショートカットのカスタマイズは今後のアップデートで対応予定です
        </p>
      </div>
    );
  };

  // ============================================================
  // 引用スタイルタブ
  // ============================================================
  const renderCitationTab = () => (
    <div className="flex flex-col gap-8">
      {/* デフォルト引用スタイル */}
      <section>
        <h3
          className="text-sm font-semibold mb-1"
          style={{ color: "var(--color-text-primary)" }}
        >
          デフォルト引用スタイル
        </h3>
        <p
          className="text-xs mb-4"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          引用を生成する際のデフォルトフォーマットを選択します
        </p>
        <div className="flex flex-col gap-2" style={{ maxWidth: "400px" }}>
          {(
            Object.entries(CITATION_STYLE_LABELS) as [CitationStyle, string][]
          ).map(([style, label]) => (
            <label
              key={style}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer"
              style={{
                backgroundColor:
                  citationStyle === style
                    ? "var(--color-bg-hover)"
                    : "var(--color-bg-card)",
                borderRadius: "var(--radius-input)",
                border:
                  citationStyle === style
                    ? "2px solid var(--color-accent-primary)"
                    : "2px solid var(--color-border-secondary)",
                transition: "all var(--transition-fast)",
              }}
            >
              <input
                type="radio"
                name="citation-style"
                value={style}
                checked={citationStyle === style}
                onChange={() => setCitationStyle(style)}
                style={{ accentColor: "var(--color-accent-primary)" }}
              />
              <div>
                <div
                  className="text-sm font-medium"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {label}
                </div>
                <div
                  className="text-xs mt-0.5"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  {style === "apa7" && "著者名, (年). タイトル. 雑誌名, 巻(号), ページ."}
                  {style === "mla9" && '著者名. "タイトル." 雑誌名, 巻.号, 年, ページ.'}
                  {style === "chicago17" && "著者名. タイトル. 雑誌名 巻, no. 号 (年): ページ."}
                  {style === "hitotsubashi" && "著者名『タイトル』雑誌名、第巻号、年、ページ。"}
                </div>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* 著者名順序 */}
      <section>
        <h3
          className="text-sm font-semibold mb-1"
          style={{ color: "var(--color-text-primary)" }}
        >
          日本語著者名の表示順序
        </h3>
        <p
          className="text-xs mb-4"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          日本語の著者名を表示する際の姓名順序を選択します
        </p>
        <div className="flex flex-col gap-2" style={{ maxWidth: "400px" }}>
          <label
            className="flex items-center gap-3 px-4 py-3 cursor-pointer"
            style={{
              backgroundColor:
                authorNameOrder === "surname-first"
                  ? "var(--color-bg-hover)"
                  : "var(--color-bg-card)",
              borderRadius: "var(--radius-input)",
              border:
                authorNameOrder === "surname-first"
                  ? "2px solid var(--color-accent-primary)"
                  : "2px solid var(--color-border-secondary)",
              transition: "all var(--transition-fast)",
            }}
          >
            <input
              type="radio"
              name="author-order"
              value="surname-first"
              checked={authorNameOrder === "surname-first"}
              onChange={() => setAuthorNameOrder("surname-first")}
              style={{ accentColor: "var(--color-accent-primary)" }}
            />
            <div>
              <div
                className="text-sm font-medium"
                style={{ color: "var(--color-text-primary)" }}
              >
                姓・名（姓が先）
              </div>
              <div
                className="text-xs mt-0.5"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                例: 山田 太郎
              </div>
            </div>
          </label>
          <label
            className="flex items-center gap-3 px-4 py-3 cursor-pointer"
            style={{
              backgroundColor:
                authorNameOrder === "given-first"
                  ? "var(--color-bg-hover)"
                  : "var(--color-bg-card)",
              borderRadius: "var(--radius-input)",
              border:
                authorNameOrder === "given-first"
                  ? "2px solid var(--color-accent-primary)"
                  : "2px solid var(--color-border-secondary)",
              transition: "all var(--transition-fast)",
            }}
          >
            <input
              type="radio"
              name="author-order"
              value="given-first"
              checked={authorNameOrder === "given-first"}
              onChange={() => setAuthorNameOrder("given-first")}
              style={{ accentColor: "var(--color-accent-primary)" }}
            />
            <div>
              <div
                className="text-sm font-medium"
                style={{ color: "var(--color-text-primary)" }}
              >
                名・姓（名が先）
              </div>
              <div
                className="text-xs mt-0.5"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                例: 太郎 山田
              </div>
            </div>
          </label>
        </div>
      </section>
    </div>
  );

  // ============================================================
  // メインレンダリング
  // ============================================================
  return (
    <div
      className="flex h-full overflow-hidden"
      style={{ backgroundColor: "var(--color-bg-primary)" }}
    >
      {/* 左: タブナビゲーション */}
      <nav
        className="shrink-0 flex flex-col gap-1 p-3 overflow-y-auto"
        style={{
          width: "200px",
          borderRight: "1px solid var(--color-border-secondary)",
          backgroundColor: "var(--color-bg-secondary)",
        }}
      >
        <h2
          className="text-xs font-semibold uppercase tracking-wider px-3 py-2"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          設定
        </h2>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-left w-full"
            style={{
              borderRadius: "var(--radius-button)",
              color:
                activeTab === tab.id
                  ? "var(--color-accent-primary)"
                  : "var(--color-text-secondary)",
              backgroundColor:
                activeTab === tab.id
                  ? "var(--color-bg-hover)"
                  : "transparent",
              fontWeight: activeTab === tab.id ? 600 : 400,
              transition: "all var(--transition-fast)",
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.backgroundColor =
                  "var(--color-bg-hover)";
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.backgroundColor = "transparent";
              }
            }}
          >
            <span className="shrink-0" style={{ opacity: 0.8 }}>
              {tab.icon}
            </span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* 右: タブコンテンツ */}
      <div className="flex-1 overflow-y-auto p-8" style={{ maxWidth: "720px" }}>
        {activeTab === "appearance" && renderAppearanceTab()}
        {activeTab === "data" && renderDataTab()}
        {activeTab === "shortcuts" && renderShortcutsTab()}
        {activeTab === "citation" && renderCitationTab()}
      </div>
    </div>
  );
};
