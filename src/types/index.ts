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

/** 検索タブ種別 */
export type SearchTab = 'all' | 'paper' | 'note' | 'highlight';

/** 全文検索結果（Rustバックエンドから返される個別アイテム） */
export interface SearchResult {
  id: string;
  contentType: 'paper' | 'note';
  title: string;
  snippet: string;
  rank: number;
}

/** 検索結果アイテム（UI表示用拡張 — ハイライト含む） */
export interface SearchResultItem {
  id: string;
  /** アイテム種別 */
  itemType: 'paper' | 'note' | 'highlight';
  /** 表示タイトル */
  title: string;
  /** スニペット（[[match]] 形式でヒット箇所を囲む） */
  snippet: string;
  /** 補助テキスト（著者·年 / 更新日 / ページ番号など） */
  meta: string;
  /** ハイライトカラー（highlight の場合のみ） */
  highlightColor?: HighlightColor;
  /** 関連する論文ID（highlight の場合） */
  paperId?: string;
  /** 関連するノートID（note の場合） */
  noteId?: string;
  /** 検索ランク */
  rank: number;
}

/** グループ化された検索結果 */
export interface GroupedSearchResults {
  papers: SearchResultItem[];
  notes: SearchResultItem[];
  highlights: SearchResultItem[];
  total: number;
}

/** 最近開いた項目（検索前の表示用） */
export interface RecentItem {
  id: string;
  itemType: 'paper' | 'note';
  title: string;
  meta: string;
  accessedAt: string;
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
export type SidebarView = 'library' | 'notes' | 'graph' | 'qualitative' | 'search' | 'settings';

/** メインペインに表示するコンテンツ種別 */
export type MainPaneContent =
  | { type: 'empty' }
  | { type: 'paper'; paperId: string }
  | { type: 'note'; noteId: string }
  | { type: 'graph' }
  | { type: 'qualitative' }
  | { type: 'search' }
  | { type: 'settings' };

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
// ノートエディタ・双方向リンク
// ============================================================

/** 自動保存ステータス */
export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** WikiLink オートコンプリート候補 */
export interface LinkSuggestion {
  id: string;
  title: string;
  type: NodeType;
  /** 補助テキスト（著者名・更新日など） */
  detail?: string;
}

/** バックリンクアイテム（コンテキストパネル表示用） */
export interface BacklinkItem {
  id: string;
  sourceType: NodeType;
  sourceId: string;
  sourceTitle: string;
  context: string | null;
}

/** アウトライン見出しアイテム */
export interface OutlineHeading {
  level: number;
  text: string;
  line: number;
}

// ============================================================
// グラフビュー — フィルタ・拡張ノード
// ============================================================

/** グラフフィルタ設定 */
export interface GraphFilters {
  /** ノートを表示するか */
  showNotes: boolean;
  /** 論文を表示するか */
  showPapers: boolean;
  /** タグフィルタ（空配列 = 全タグ表示） */
  selectedTags: string[];
  /** 最小リンク数（この数以上のリンクを持つノードのみ表示） */
  minLinkCount: number;
}

/** グラフフィルタのデフォルト値 */
export const DEFAULT_GRAPH_FILTERS: GraphFilters = {
  showNotes: true,
  showPapers: true,
  selectedTags: [],
  minLinkCount: 0,
};

/** 拡張グラフノード（描画・インタラクション用に追加プロパティを持つ） */
export interface GraphNodeExtended extends GraphNode {
  /** リンク数（接続エッジ数） */
  linkCount: number;
  /** タグ一覧 */
  tags: string[];
  /** 最終更新日 */
  updatedAt: string;
  /** 座標（react-force-graph-2d が設定） */
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
}

// ============================================================
// 設定（Settings）
// ============================================================

/** 設定タブ種別 */
export type SettingsTab = 'appearance' | 'data' | 'shortcuts' | 'citation';

/** 外観設定 */
export interface AppearanceSettings {
  /** フォントサイズ (px) */
  fontSize: number;
  /** 行の高さ */
  lineHeight: number;
  /** エディタフォント */
  editorFont: string;
}

/** 外観設定のデフォルト値 */
export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  fontSize: 14,
  lineHeight: 1.6,
  editorFont: 'system-ui',
};

/** エディタフォント選択肢 */
export const EDITOR_FONTS: { value: string; label: string }[] = [
  { value: 'system-ui', label: 'システムフォント' },
  { value: '"Noto Sans JP", sans-serif', label: 'Noto Sans JP' },
  { value: '"Noto Serif JP", serif', label: 'Noto Serif JP' },
  { value: '"Source Code Pro", monospace', label: 'Source Code Pro' },
  { value: '"JetBrains Mono", monospace', label: 'JetBrains Mono' },
  { value: '"IBM Plex Mono", monospace', label: 'IBM Plex Mono' },
];

/** データサマリー情報 */
export interface DataSummary {
  paperCount: number;
  noteCount: number;
  highlightCount: number;
  diskUsage: string;
  dataPath: string;
}

/** ショートカット定義 */
export interface ShortcutEntry {
  /** ショートカットキー表記 */
  keys: string;
  /** 説明 */
  description: string;
  /** カテゴリ */
  category: string;
}

/** 日本語著者名順序 */
export type AuthorNameOrder = 'surname-first' | 'given-first';

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

// ============================================================
// 質的分析（Qualitative Analysis）— Rust バックエンドと完全一致
// ============================================================

/** 質的分析プロジェクト */
export interface QualProject {
  id: string;
  name: string;
  description: string | null;
  methodType: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface CreateQualProjectInput {
  name: string;
  description?: string | null;
  methodType?: string;
}

export interface UpdateQualProjectInput {
  name?: string;
  description?: string | null;
  methodType?: string;
}

/** コード（質的コーディング） */
export interface QualCode {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
  description: string | null;
  color: string;
  codeType: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string | null;
}

/** コードツリーノード */
export interface CodeNode extends QualCode {
  children: CodeNode[];
  assignmentCount: number;
}

export interface CreateQualCodeInput {
  projectId: string;
  parentId?: string | null;
  name: string;
  description?: string | null;
  color?: string;
  codeType?: string;
  sortOrder?: number;
}

export interface UpdateQualCodeInput {
  name?: string;
  description?: string | null;
  color?: string;
  codeType?: string;
  parentId?: string | null;
  sortOrder?: number;
}

/** ハイライト + コンテキスト（コード別取得用） */
export interface HighlightWithContext {
  id: string;
  paperId: string;
  text: string;
  comment: string | null;
  color: string;
  page: number;
  paperTitle: string;
  createdAt: string;
}

/** コーディングマトリクス */
export interface CodingMatrixRow {
  codeId: string;
  codeName: string;
  codeColor: string;
}

export interface CodingMatrixCol {
  paperId: string;
  paperTitle: string;
}

export interface CodingMatrix {
  rows: CodingMatrixRow[];
  cols: CodingMatrixCol[];
  /** キー: "codeId:paperId" → 割り当て数 */
  cells: Record<string, number>;
}

/** ICR インポート用コーディング */
export interface ImportedCoding {
  highlightId: string;
  codeIds: string[];
}

/** ICR 不一致アイテム */
export interface DisagreementItem {
  highlightId: string;
  mainCodes: string[];
  importedCodes: string[];
}

/** ICR 計算結果 */
export interface IcrResult {
  cohenKappa: number;
  percentAgreement: number;
  totalSegments: number;
  agreements: number;
  disagreements: DisagreementItem[];
}

/** 史料批判シート */
export interface SourceCritique {
  id: string;
  paperId: string;
  authorInfo: string | null;
  creationDate: string | null;
  isDateEstimated: boolean;
  location: string | null;
  sourceType: string | null;
  authenticity: string | null;
  archiveInfo: string | null;
  intent: string | null;
  audience: string | null;
  biasLevel: string | null;
  biasReason: string | null;
  consistency: string | null;
  reliabilityScore: number;
  researcherNotes: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface SourceCritiqueInput {
  paperId: string;
  authorInfo?: string | null;
  creationDate?: string | null;
  isDateEstimated?: boolean;
  location?: string | null;
  sourceType?: string | null;
  authenticity?: string | null;
  archiveInfo?: string | null;
  intent?: string | null;
  audience?: string | null;
  biasLevel?: string | null;
  biasReason?: string | null;
  consistency?: string | null;
  reliabilityScore?: number;
  researcherNotes?: string | null;
}

/** タイムラインイベント */
export interface TimelineEvent {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  eventDate: string;
  dateType: string;
  eventType: string;
  importance: number;
  lane: string | null;
  paperId: string | null;
  highlightId: string | null;
  createdAt: string;
}

export interface CreateTimelineEventInput {
  projectId: string;
  title: string;
  description?: string | null;
  eventDate: string;
  dateType?: string;
  eventType?: string;
  importance?: number;
  lane?: string | null;
  paperId?: string | null;
  highlightId?: string | null;
}

/** アクター */
export interface Actor {
  id: string;
  projectId: string;
  name: string;
  actorType: string;
  position: string;
  influence: number;
  level: string;
  description: string | null;
  xPosition: number | null;
  yPosition: number | null;
  createdAt: string;
}

export interface CreateActorInput {
  projectId: string;
  name: string;
  actorType?: string;
  position?: string;
  influence?: number;
  level?: string;
  description?: string | null;
  xPosition?: number | null;
  yPosition?: number | null;
}

/** アクター関係 */
export interface ActorRelation {
  id: string;
  actorFrom: string;
  actorTo: string;
  relationType: string;
  startYear: number | null;
  endYear: number | null;
  description: string | null;
  paperId: string | null;
  createdAt: string;
}

export interface CreateActorRelationInput {
  actorFrom: string;
  actorTo: string;
  relationType: string;
  startYear?: number | null;
  endYear?: number | null;
  description?: string | null;
  paperId?: string | null;
}

/** アクターマップデータ */
export interface ActorMapData {
  actors: Actor[];
  relations: ActorRelation[];
}

/** プロセストレーシング仮説 */
export interface PtHypothesis {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  isMain: boolean;
  sortOrder: number;
  createdAt: string;
}

/** プロセストレーシング証拠 */
export interface PtEvidence {
  id: string;
  hypothesisId: string;
  description: string;
  testType: 'hoop' | 'smoking_gun' | 'straw' | 'doubly_decisive';
  result: 'pass' | 'fail' | 'partial' | 'pending';
  paperId: string | null;
  highlightId: string | null;
  createdAt: string;
}

export interface CreatePtHypothesisInput {
  projectId: string;
  title: string;
  description?: string | null;
  isMain?: boolean;
  sortOrder?: number;
}

export interface CreatePtEvidenceInput {
  hypothesisId: string;
  description: string;
  testType: string;
  result?: string;
  paperId?: string | null;
  highlightId?: string | null;
}

/** 仮説 + 証拠リスト */
export interface HypothesisWithEvidences extends PtHypothesis {
  evidences: PtEvidence[];
}

/** PTデータ */
export interface PtData {
  hypotheses: HypothesisWithEvidences[];
}

/** PTサマリー */
export interface PtSummary {
  hoopPassRate: number;
  hasSmokingGun: boolean;
  overallVerdict: string;
}

/** 比較デザイン */
export interface ComparativeDesign {
  id: string;
  projectId: string;
  designType: string;
  title: string;
  createdAt: string;
}

/** 比較ケース */
export interface ComparativeCase {
  id: string;
  designId: string;
  name: string;
  sortOrder: number;
}

/** 比較変数 */
export interface ComparativeVariable {
  id: string;
  designId: string;
  name: string;
  varType: string;
  sortOrder: number;
}

/** 比較セル */
export interface ComparativeCell {
  id: string;
  caseId: string;
  variableId: string;
  value: string | null;
  paperId: string | null;
}

/** 比較デザインフル */
export interface ComparativeDesignFull extends ComparativeDesign {
  cases: ComparativeCase[];
  variables: ComparativeVariable[];
  cells: ComparativeCell[];
}

export interface CreateComparativeDesignInput {
  projectId: string;
  title: string;
  designType?: string;
}

/** フレーム（Entman のフレーミング分析） */
export interface Frame {
  id: string;
  projectId: string;
  name: string;
  problemDefinition: string | null;
  causalInterpretation: string | null;
  moralEvaluation: string | null;
  treatmentRecommendation: string | null;
  color: string;
  createdAt: string;
}

export interface CreateFrameInput {
  projectId: string;
  name: string;
  problemDefinition?: string | null;
  causalInterpretation?: string | null;
  moralEvaluation?: string | null;
  treatmentRecommendation?: string | null;
  color?: string;
}

/** フレーミングマトリクス */
export interface FramingMatrix {
  frames: Frame[];
  papers: CodingMatrixCol[];
  counts: Record<string, number>;
}

/** 質的分析ビューのタブ */
export type QualitativeTab =
  | 'dashboard'
  | 'codebook'
  | 'matrix'
  | 'icr'
  | 'source-critique'
  | 'timeline'
  | 'actor-map'
  | 'process-tracing'
  | 'comparative'
  | 'framing'
  | 'report';
