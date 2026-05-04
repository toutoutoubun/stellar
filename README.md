# Stellar

**文献管理 + ノート + グラフビュー** を1アプリで完結させる、日本の文系大学院生向け研究支援ツール。

Zotero の文献管理 × Obsidian の双方向リンク を単一デスクトップアプリに統合。

## 設計思想

- **ローカルファースト** — データはすべてローカル SQLite に保存
- **完全無料** — サブスクリプション不要
- **AI 機能なし** — 研究者自身の思考を支援するシンプルな設計
- **美しい日本語 UI** — 4テーマ対応（ホワイト / アイボリー / ダークブルー / ブラック）

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フレームワーク | Tauri 2.0 (Rust + React) |
| フロントエンド | React 19 + TypeScript 6 (strict) |
| スタイリング | Tailwind CSS v4 + CSS Custom Properties |
| 状態管理 | Zustand 5 (スライスパターン + persist) |
| データベース | SQLite (tauri-plugin-sql, FTS5 有効) |
| PDF レンダリング | react-pdf-highlighter 8.0 |
| テキストエディタ | CodeMirror 6 (@codemirror/lang-markdown) |
| グラフ描画 | react-force-graph-2d (D3.js ベース) |
| 仮想スクロール | @tanstack/react-virtual 3 |
| ビルドツール | Vite 6 |
| パッケージ管理 | npm / pnpm |

## プロジェクト構成

```
stellar/
├── src-tauri/                  # Rust バックエンド
│   ├── src/
│   │   ├── main.rs             # エントリーポイント
│   │   ├── lib.rs              # プラグイン登録・DB 初期化・コマンド登録
│   │   ├── commands/           # Tauri コマンド
│   │   │   ├── papers.rs       # 論文 CRUD
│   │   │   ├── notes.rs        # ノート CRUD
│   │   │   ├── highlights.rs   # ハイライト CRUD
│   │   │   ├── links.rs        # 双方向リンク CRUD
│   │   │   └── search.rs       # FTS5 全文検索
│   │   ├── db/
│   │   │   ├── migrations/     # SQL マイグレーション
│   │   │   └── models.rs       # DB モデル定義
│   │   └── utils/
│   │       ├── pdf.rs          # PDF ユーティリティ
│   │       └── metadata.rs     # CrossRef API メタデータ取得
│   ├── Cargo.toml
│   └── tauri.conf.json
│
└── src/                        # React フロントエンド
    ├── main.tsx                # エントリーポイント
    ├── App.tsx                 # ルート (ErrorBoundary + Onboarding + ScreenTransition)
    ├── components/
    │   ├── ui/                 # デザインシステム (Button/Card/Input/Modal/Badge/Toast)
    │   ├── layout/             # レイアウト (Titlebar/Sidebar/MainPane/ContextPanel)
    │   ├── library/            # 文献ライブラリ (LibraryView/PaperCard/PaperListRow/AddPaperModal/PaperDetailPanel)
    │   ├── reader/             # PDF リーダー (ReaderView/PdfViewer/HighlightPanel/HighlightCard/HighlightToolbar)
    │   ├── notes/              # ノートエディタ (NoteEditor/NoteList/StellarEditor/WikiLinkAutoComplete/FocusMode)
    │   ├── graph/              # グラフビュー (GraphView/ForceGraph/GraphFilterPanel/GraphLegendPanel/GraphMiniMap/NodeDetailPopup)
    │   ├── search/             # 全文検索 (SearchModal/SearchInput/SearchResults/SearchResultItem)
    │   ├── settings/           # 設定 (SettingsView/ThemePreviewCard)
    │   ├── onboarding/         # オンボーディング (OnboardingFlow — 4ステップ)
    │   └── ErrorBoundary.tsx   # エラーバウンダリ (relaunch 再起動)
    ├── hooks/
    │   ├── useGraphData.ts     # グラフデータ + rAF フィルタ
    │   ├── useHighlights.ts    # ハイライト管理
    │   ├── useSearch.ts        # 全文検索 (debounce 200ms)
    │   └── useTauriEvents.ts   # Tauri イベントリスナー
    ├── stores/
    │   ├── useLibraryStore.ts  # 論文ライブラリ状態
    │   ├── useNoteStore.ts     # ノート状態
    │   ├── useUIStore.ts       # UI 状態 + ナビゲーション履歴
    │   └── useThemeStore.ts    # テーマ状態 (localStorage 永続化)
    ├── utils/
    │   ├── ipc.ts              # 型安全 invoke<T> + API オブジェクト
    │   ├── citation.ts         # 引用フォーマット生成
    │   ├── highlight.ts        # ハイライトユーティリティ
    │   └── highlightColors.ts  # ハイライト色定義
    ├── types/index.ts          # 全型定義
    └── styles/
        ├── themes.css          # 4テーマの CSS Custom Properties
        └── global.css          # リセット・フォント・スクロールバー・禁則処理・アニメーション
```

## データモデル

| テーブル | 説明 |
|---|---|
| `papers` | 論文メタデータ (タイトル, 著者, DOI, PDF パス, タグ等) |
| `notes` | Markdown ノート (論文に紐づけ可能) |
| `highlights` | PDF ハイライト (テキスト選択 + コメント + 色 + 矩形座標) |
| `links` | 双方向リンク (ノート↔ノート, ノート↔論文, 論文↔論文) |
| `fts_search` | FTS5 仮想テーブル (論文・ノートの横断全文検索) |

FTS5 トリガーにより papers / notes の INSERT / UPDATE / DELETE 時に fts_search が自動同期されます。

## 実装済み機能

### バックエンド (Rust)
- [x] 全 Tauri コマンド (papers / notes / highlights / links / search / data / graph)
- [x] SQLite マイグレーション (FTS5 + トリガー + インデックス)
- [x] CrossRef API メタデータ取得
- [x] PDF 管理ユーティリティ

### フロントエンド共通
- [x] CSS テーマシステム (4テーマ: white / ivory / dark-blue / black)
- [x] グローバル CSS (リセット / 日本語フォント / スクロールバー / 禁則処理)
- [x] TypeScript 型定義 (全データモデル + UI 状態型)
- [x] Zustand ストア (テーマ / UI / ライブラリ / ノート)
- [x] UI コンポーネント (Button / Card / Input / Modal / Badge / Toast)

### レイアウト
- [x] カスタムタイトルバー (ドラッグ / 最小化 / 最大化 / 閉じる / テーマ切替)
- [x] サイドバー (library / notes / graph / settings ナビゲーション + 折りたたみ)
- [x] メインペイン (画面遷移アニメーション付き)
- [x] コンテキストパネル

### App.tsx — ルートコンポーネント
- [x] Zustand UIStore で画面管理 (library, reader, note, graph, search, settings)
- [x] navigationHistory による戻る/進む (Cmd+[ / Cmd+])
- [x] CSS トランジション (data-entering → slideInFromRight 200ms ease-out, data-leaving → slideOutToLeft 200ms)
- [x] ErrorBoundary ラッパー
- [x] OnboardingFlow ラッパー (初回起動時のみ)
- [x] グローバルキーボードショートカット (Cmd+K 検索, Cmd+, 設定)

### 文献ライブラリ
- [x] LibraryView (グリッド / リスト表示切替 / ソート / フィルタ)
- [x] PaperCard (React.memo + カスタム arePropsEqual / IntersectionObserver 遅延サムネイル)
- [x] PaperListRow (リスト表示用)
- [x] AddPaperModal (URL / DOI / 手動入力)
- [x] PaperDetailPanel (論文詳細表示)

### PDF リーダー
- [x] ReaderView (PDF 表示 + ハイライトパネル)
- [x] PdfViewer (react-pdf-highlighter 統合)
- [x] HighlightPanel / HighlightCard / HighlightToolbar

### ノートエディタ
- [x] NoteEditor (CodeMirror 6 Markdown エディタ)
- [x] NoteList (ノート一覧)
- [x] StellarEditor (カスタム CodeMirror ラッパー)
- [x] WikiLinkAutoComplete ([[ノート名]] オートコンプリート)
- [x] FocusMode (集中執筆モード)
- [x] NoteContextPanel (バックリンク + アウトライン)

### グラフビュー
- [x] GraphView (全画面キャンバス + 浮遊パネル)
- [x] ForceGraph (カスタムノード描画 / Bezier エッジ / ズーム / パン)
- [x] ノードラベル最適化 (nodeCount > 300 → zoom > 1.5 でのみ表示)
- [x] useMemo で connectedNodeIds / graphData メモ化
- [x] requestAnimationFrame ベースのフィルタ再計算
- [x] GraphFilterPanel (ノード種別 / タグ / 最小リンク数)
- [x] GraphLegendPanel / GraphMiniMap / NodeDetailPopup

### 全文検索
- [x] SearchModal (常時マウント + visibility:hidden / Cmd+K 開閉 / ESC 閉じ)
- [x] 仮想スクロール (@tanstack/react-virtual — >100件で有効化)
- [x] タブフィルタ (すべて / 論文 / ノート / ハイライト)
- [x] キーボードナビゲーション (↑↓ 移動 / Enter 開く / Tab タブ切替)
- [x] デバウンス 200ms リアルタイム検索

### 設定
- [x] SettingsView (4タブ: 外観 / データ / ショートカット / 引用)
- [x] テーマプレビューカード
- [x] フォントサイズ・行高さ・エディタフォント設定
- [x] データパス変更 / エクスポート / バックアップ
- [x] 引用スタイル選択 (APA 7 / MLA 9 / Chicago 17 / 一橋大学式)

### IPC / ユーティリティ
- [x] ipc.ts: 型安全 invoke<T> ラッパー + api オブジェクト (papers / notes / highlights / links / search / data)
- [x] citation.ts: 引用フォーマット生成 + クリップボードコピー

### エラー処理 / オンボーディング
- [x] ErrorBoundary (クラスコンポーネント / 全画面エラー UI / Tauri relaunch() 再起動)
- [x] OnboardingFlow (localStorage 'stellar-onboarded' / 4ステップ / 250ms フェード / プログレスドット)

### Tauri イベント
- [x] useTauriEvents (paper-import-request リスナー / トースト通知 / 楽観的追加)

### ビルド
- [x] TypeScript 6 strict モード — エラー 0
- [x] Vite 6 ビルド成功 (512MB メモリ制限内, ~13秒)
- [x] 細粒度チャンク分割 (vendor-react / vendor-codemirror / vendor-pdf / vendor-graph / etc.)

## キーボードショートカット

| キー | 機能 |
|---|---|
| `Cmd/Ctrl + K` | 全文検索モーダルを開閉 |
| `Cmd/Ctrl + ,` | 設定を開く |
| `Cmd/Ctrl + N` | 新しいノートを作成 |
| `Cmd/Ctrl + [` | 戻る |
| `Cmd/Ctrl + ]` | 進む |
| `Cmd/Ctrl + 0` | グラフを全体表示 |
| `Esc` | モーダルを閉じる / 選択解除 |
| `↑↓` | 検索結果を移動 |
| `Enter` | 検索結果を開く |
| `Tab` | 検索タブ切替 |

## 開発環境セットアップ

### 前提条件

- Node.js 20+
- npm 10+ (または pnpm 10+)
- Rust 1.77+
- Tauri 2.0 システム依存パッケージ

### インストール

```bash
# リポジトリをクローン
git clone <repository-url> stellar
cd stellar

# フロントエンド依存パッケージ
npm install

# 開発サーバー起動
npm run tauri dev
```

### ビルド

```bash
# TypeScript 型チェック
npx tsc -b --noEmit

# フロントエンドのみビルド
npm run build

# プロダクションビルド (Tauri アプリ)
npm run tauri build
```

## テーマ

| テーマ | 説明 |
|---|---|
| `white` | 清潔感のある純白ベース |
| `ivory` | 温かみのあるアイボリーベース |
| `dark-blue` | 落ち着いたダークブルー |
| `black` | 真の黒ベース (OLED 対応) |

テーマ切り替え: タイトルバー右側の太陽/月アイコンをクリック (white → ivory → dark-blue → black → white)

## ライセンス

MIT
