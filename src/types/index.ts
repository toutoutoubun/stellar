// src/types/index.ts
// Stellar — TypeScript 型定義
// フロントエンド全体で使用するデータモデル・ユーティリティ型

// ============================================================
// 論文（Paper）
// ============================================================

/** 論文データモデル */
export interface Paper {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  journal: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  doi: string | null;
  url: string | null;
  abstract: string | null;
  pdfPath: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/** 論文作成時の入力型 */
export interface CreatePaperInput {
  title: string;
  authors: string[];
  year?: number | null;
  journal?: string | null;
  volume?: string | null;
  issue?: string | null;
  pages?: string | null;
  doi?: string | null;
  url?: string | null;
  abstract?: string | null;
  pdfPath?: string | null;
  tags?: string[];
}

/** 論文更新時の入力型（全フィールド任意） */
export interface UpdatePaperInput {
  title?: string;
  authors?: string[];
  year?: number | null;
  journal?: string | null;
  volume?: string | null;
  issue?: string | null;
  pages?: string | null;
  doi?: string | null;
  url?: string | null;
  abstract?: string | null;
  pdfPath?: string | null;
  tags?: string[];
}

// ============================================================
// ノート（Note）
// ============================================================

/** ノートデータモデル */
export interface Note {
  id: string;
  title: string;
  content: string;
  paperId: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/** ノート作成時の入力型 */
export interface CreateNoteInput {
  title: string;
  content?: string;
  paperId?: string | null;
  tags?: string[];
}

/** ノート更新時の入力型 */
export interface UpdateNoteInput {
  title?: string;
  content?: string;
  paperId?: string | null;
  tags?: string[];
}

// ============================================================
// ハイライト（Highlight）
// ============================================================

/** ハイライトの矩形座標 */
export interface HighlightRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** ハイライトカラー */
export type HighlightColor = 'yellow' | 'blue' | 'green' | 'pink';

/** ハイライトデータモデル */
export interface Highlight {
  id: string;
  paperId: string;
  text: string;
  comment: string | null;
  color: HighlightColor;
  page: number;
  rect: HighlightRect;
  createdAt: string;
}

/** ハイライト作成時の入力型 */
export interface CreateHighlightInput {
  paperId: string;
  text: string;
  comment?: string | null;
  color: HighlightColor;
  page: number;
  rect: HighlightRect;
}

/** ハイライト更新時の入力型 */
export interface UpdateHighlightInput {
  comment?: string | null;
  color?: HighlightColor;
}

// ============================================================
// リンク（Link）— 双方向リンク
// ============================================================

/** リンクのノード種別 */
export type NodeType = 'note' | 'paper';

/** リンクデータモデル */
export interface Link {
  id: string;
  sourceType: NodeType;
  sourceId: string;
  targetType: NodeType;
  targetId: string;
  context: string | null;
  createdAt: string;
}

/** リンク作成時の入力型 */
export interface CreateLinkInput {
  sourceType: NodeType;
  sourceId: string;
  targetType: NodeType;
  targetId: string;
  context?: string | null;
}

// ============================================================
// 検索（Search）
// ============================================================

/** 全文検索結果 */
export interface SearchResult {
  id: string;
  contentType: 'paper' | 'note';
  title: string;
  snippet: string;
  rank: number;
}

// ============================================================
// テーマ（Theme）
// ============================================================

/** アプリテーマ */
export type Theme = 'white' | 'ivory' | 'dark-blue' | 'black';

/** テーマ表示名（日本語） */
export const THEME_LABELS: Record<Theme, string> = {
  'white': 'ホワイト',
  'ivory': 'アイボリー',
  'dark-blue': 'ダークブルー',
  'black': 'ブラック',
};

// ============================================================
// UI 状態
// ============================================================

/** サイドバーのナビゲーションビュー */
export type SidebarView = 'library' | 'notes' | 'graph' | 'search';

/** メインペインに表示するコンテンツ種別 */
export type MainPaneContent =
  | { type: 'empty' }
  | { type: 'paper'; paperId: string }
  | { type: 'note'; noteId: string }
  | { type: 'graph' }
  | { type: 'search' };

/** ソート方向 */
export type SortDirection = 'asc' | 'desc';

/** 論文ソートキー */
export type PaperSortKey = 'title' | 'year' | 'createdAt' | 'updatedAt';

/** ノートソートキー */
export type NoteSortKey = 'title' | 'createdAt' | 'updatedAt';

// ============================================================
// グラフビュー
// ============================================================

/** グラフノード（react-force-graph-2d 用） */
export interface GraphNode {
  id: string;
  name: string;
  type: NodeType;
  /** ノードサイズ（リンク数に比例） */
  val: number;
  /** ノードカラー（テーマから取得） */
  color?: string;
}

/** グラフエッジ（react-force-graph-2d 用） */
export interface GraphLink {
  source: string;
  target: string;
  context?: string | null;
}

/** グラフデータ */
export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// ============================================================
// 引用スタイル（Citation）
// ============================================================

/** 対応する引用フォーマット */
export type CitationStyle = 'apa7' | 'mla9' | 'chicago17' | 'hitotsubashi';

/** 引用スタイルの表示名（日本語） */
export const CITATION_STYLE_LABELS: Record<CitationStyle, string> = {
  'apa7': 'APA 7th',
  'mla9': 'MLA 9th',
  'chicago17': 'Chicago 17th',
  'hitotsubashi': '一橋大学式',
};

// ============================================================
// ライブラリ画面の表示モード
// ============================================================

/** ライブラリの表示モード */
export type LibraryViewMode = 'grid' | 'list';

// ============================================================
// ユーティリティ型
// ============================================================

/** 非同期操作の状態 */
export type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

/** Tauri invoke コマンドのエラー型 */
export type InvokeError = string;
