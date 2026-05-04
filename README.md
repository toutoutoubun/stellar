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
| 状態管理 | Zustand (スライスパターン) |
| データベース | SQLite (tauri-plugin-sql, FTS5 有効) |
| PDF レンダリング | react-pdf-highlighter |
| テキストエディタ | CodeMirror 6 (@codemirror/lang-markdown) |
| グラフ描画 | react-force-graph-2d (D3.js ベース) |
| ビルドツール | Vite 6 |
| パッケージ管理 | pnpm |

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
    ├── App.tsx                 # ルートコンポーネント
    ├── components/
    │   ├── ui/                 # デザインシステム (Button/Card/Input/Modal/Badge/Toast)
    │   ├── layout/             # レイアウト (Titlebar/Sidebar/MainPane/ContextPanel)
    │   ├── library/            # 文献ライブラリ画面 (未実装)
    │   ├── reader/             # PDF リーダー画面 (未実装)
    │   ├── notes/              # ノートエディタ画面 (未実装)
    │   ├── graph/              # グラフビュー画面 (未実装)
    │   └── search/             # 全文検索モーダル (未実装)
    ├── stores/                 # Zustand ストア
    │   ├── useLibraryStore.ts  # 論文ライブラリ状態
    │   ├── useNoteStore.ts     # ノート状態
    │   ├── useUIStore.ts       # UI レイアウト状態
    │   └── useThemeStore.ts    # テーマ状態 (localStorage 永続化)
    ├── types/index.ts          # 全型定義
    └── styles/
        ├── themes.css          # 4テーマの CSS Custom Properties
        └── global.css          # リセット・フォント・スクロールバー・禁則処理
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

- [x] プロジェクト雛形 (Tauri 2.0 + React + TypeScript + Tailwind CSS v4)
- [x] Rust バックエンド全コマンド (papers / notes / highlights / links / search)
- [x] SQLite マイグレーション (FTS5 + トリガー + インデックス)
- [x] CSS テーマシステム (4テーマ完全実装)
- [x] グローバル CSS (リセット / 日本語フォント / スクロールバー / 禁則処理)
- [x] TypeScript 型定義 (全データモデル + UI 状態型)
- [x] Zustand ストア (テーマ / UI / ライブラリ / ノート)
- [x] レイアウトコンポーネント (Titlebar / Sidebar / MainPane / ContextPanel)
- [x] UI コンポーネント (Button / Card / Input / Modal / Badge / Toast)
- [x] カスタムタイトルバー (ドラッグ / 最小化 / 最大化 / 閉じる)
- [x] Vite 6 フロントエンドビルド確認済み

## 未実装機能 (次のステップ)

- [ ] 文献ライブラリ画面 (一覧表示 / フィルタ / ソート / 追加モーダル)
- [ ] PDF リーダー画面 (react-pdf-highlighter 統合 / ハイライト CRUD)
- [ ] ノートエディタ画面 (CodeMirror 6 統合 / Markdown 編集 / プレビュー)
- [ ] グラフビュー画面 (react-force-graph-2d 統合 / ノード操作)
- [ ] 全文検索モーダル (Ctrl+K ショートカット / FTS5 検索)
- [ ] DOI からの自動メタデータ取得 (CrossRef API)
- [ ] PDF ファイルのインポート・管理
- [ ] 双方向リンクの自動検出 ([[ノート名]] 記法)
- [ ] エクスポート機能 (BibTeX / CSV)

## 開発環境セットアップ

### 前提条件

- Node.js 20+
- pnpm 10+
- Rust 1.77+
- Tauri 2.0 システム依存パッケージ

### インストール

```bash
# リポジトリをクローン
git clone <repository-url> stellar
cd stellar

# フロントエンド依存パッケージ
pnpm install

# 開発サーバー起動
pnpm tauri dev
```

### ビルド

```bash
# プロダクションビルド
pnpm tauri build
```

## テーマ

| テーマ | 説明 |
|---|---|
| `white` | 清潔感のある純白ベース |
| `ivory` | 温かみのあるアイボリーベース |
| `dark-blue` | 落ち着いたダークブルー |
| `black` | 真の黒ベース (OLED 対応) |

テーマ切り替え: タイトルバー右側の太陽アイコンをクリック

## ライセンス

MIT
