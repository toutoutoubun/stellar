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
  /** 下書きフラグ（1 = 草稿モード） */
  isDraft?: number;
  /** 下書きメタ情報（JSON） */
  draftMeta?: DraftMeta;
  /** 単語数 */
  wordCount?: number;
  /** 推定読了時間（分） */
  readingTimeMin?: number;
}

/** 下書きメタ情報 */
export interface DraftMeta {
  chapters: DraftMetaChapter[];
}

/** 下書きメタ内の章要約 */
export interface DraftMetaChapter {
  id: string;
  title: string;
  order: number;
  wordCount: number;
}

/** 下書き章（DB モデル） */
export interface DraftChapter {
  id: string;
  noteId: string;
  title: string;
  orderIndex: number;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

/** 下書き引用（DB モデル） */
export interface DraftCitation {
  id: string;
  noteId: string;
  paperId: string;
  citationKey: string;
  citationStyle: string;
  inlineText: string;
  bibliographyText: string;
  pageRef: string | null;
  createdAt: string;
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
  'white': 'White',
  'ivory': 'Ivory',
  'dark-blue': 'Dark Blue',
  'black': 'Black',
};

// ============================================================
// UI 状態
// ============================================================

/** サイドバーのナビゲーションビュー */
export type SidebarView = 'library' | 'notes' | 'graph' | 'qualitative' | 'quantitative' | 'search' | 'settings';

/** メインペインに表示するコンテンツ種別 */
export type MainPaneContent =
  | { type: 'empty' }
  | { type: 'paper'; paperId: string }
  | { type: 'note'; noteId: string }
  | { type: 'graph' }
  | { type: 'qualitative' }
  | { type: 'quantitative' }
  | { type: 'search' }
  | { type: 'settings' }
  | { type: 'split-view'; paperId: string; noteId: string }
  | { type: 'draft'; noteId: string };

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
  'hitotsubashi': 'Hitotsubashi Style',
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
  /** リンクサジェスト用スコア */
  score?: number;
  /** リンクサジェスト用理由 */
  reason?: string;
}

/** バックリンクアイテム（コンテキストパネル表示用） */
export interface BacklinkItem {
  id: string;
  sourceType: NodeType;
  sourceId: string;
  sourceTitle: string;
  targetId: string;
  targetType: NodeType;
  targetTitle: string;
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
export type SettingsTab = 'appearance' | 'data' | 'shortcuts' | 'citation' | 'language';

/** 対応ロケール */
export type Locale = 'ja' | 'en' | 'fr' | 'af';

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
  { value: 'system-ui', label: 'System Font' },
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
// クラウドバックアップ
// ============================================================

/** クラウドバックアップのステータス */
export interface CloudBackupStatus {
  isConfigured: boolean;
  deviceId: string | null;
  recoveryCode: string | null;
  autoBackupEnabled: boolean;
  lastBackupAt: string | null;
  apiUrl: string;
}

/** バックアップデータ概要 */
export interface BackupDataSummary {
  paperCount: number;
  noteCount: number;
  highlightCount: number;
  linkCount: number;
}

/** バックアップ結果 */
export interface CloudBackupResult {
  success: boolean;
  backupId: string | null;
  backedUpAt: string;
  sizeBytes: number;
  summary: BackupDataSummary;
}

/** バックアップ一覧のエントリ */
export interface BackupEntry {
  backupId: string;
  createdAt: string;
  sizeBytes: number;
  summary: BackupDataSummary;
}

/** バックアップ一覧レスポンス */
export interface BackupListResponse {
  backups: BackupEntry[];
  totalCount: number;
}

/** リストア結果 */
export interface RestoreResult {
  success: boolean;
  papersRestored: number;
  notesRestored: number;
  highlightsRestored: number;
  linksRestored: number;
  restoredAt: string;
}

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
export type BuiltInQualitativeTab =
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

export type QualitativeTab = BuiltInQualitativeTab | (string & {});

// ============================================================
// 量的分析（Quantitative Analysis）— Data Studio
// ============================================================

/** データセットのソースタイプ */
export type DatasetSourceType = 'csv' | 'manual' | 'codes' | 'highlights';

/** データセット */
export interface Dataset {
  id: string;
  name: string;
  description: string | null;
  sourceType: DatasetSourceType;
  rowCount: number;
  createdAt: string;
  updatedAt: string | null;
}

/** 変数タイプ */
export type VariableType = 'scale' | 'nominal' | 'ordinal' | 'text' | 'date';

/** リッカートラベル */
export interface LikertLabel {
  value: number;
  label: string;
}

/** 変数定義 */
export interface Variable {
  id: string;
  datasetId: string;
  columnIndex: number;
  name: string;
  label: string | null;
  variableType: VariableType;
  missingCount: number;
  min: number | null;
  max: number | null;
  mean: number | null;
  dateFormat: string | null;
  likertLabels: LikertLabel[] | null;
  createdAt: string;
  updatedAt: string | null;
}

/** データ行（1行分のレコード） */
export interface DataRow {
  id: string;
  datasetId: string;
  rowIndex: number;
  /** カラム名 → 値のマッピング */
  values: Record<string, string | number | null>;
}

/** 分析結果 */
export interface Analysis {
  id: string;
  datasetId: string;
  name: string;
  analysisType: string;
  config: Record<string, unknown>;
  result: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string | null;
}

/** 分析保存時の入力型 */
export interface SaveAnalysisInput {
  datasetId: string;
  name: string;
  analysisType: string;
  config: Record<string, unknown>;
  result?: Record<string, unknown> | null;
}

/** Data Studio のタブ */
export type DataStudioTab = 'import' | 'variables' | 'preview' | 'analysis';

/** 変数作成時の入力型 */
export interface CreateVariableInput {
  datasetId: string;
  columnIndex: number;
  name: string;
  label?: string | null;
  varType?: string;
  unit?: string | null;
  likertMin?: number | null;
  likertMax?: number | null;
  likertLabels?: string | null;
}

/** トークン頻度 */
export interface TokenFrequency {
  id: string;
  datasetId: string;
  variableId: string;
  token: string;
  frequency: number;
  tfIdf: number | null;
  pos: string | null;
  documentCount: number | null;
}

/** タグカウント（get_all_tags 用） */
export interface TagCount {
  name: string;
  count: number;
}

/** ドラフト応答型（get_drafts 用） */
export interface DraftResponse {
  id: string;
  title: string;
  content: string;
  wordCount: number;
  readingTimeMin: number;
  chapterCount: number;
  createdAt: string;
  updatedAt: string;
}

/** ハイライト-フレーム関連（get_highlight_frames 用） */
export interface HighlightFrameRow {
  id: string;
  highlightId: string;
  frameId: string;
  assignedAt: string;
}

/** プロジェクト更新入力型 */
export interface UpdateProjectDto {
  name?: string;
  description?: string | null;
  methodType?: string;
}

/** アクター更新入力型 */
export interface UpdateActorDto {
  name?: string;
  actorType?: string;
  position?: string;
  influence?: number;
  level?: string;
  description?: string | null;
  xPosition?: number | null;
  yPosition?: number | null;
}

/** タイムラインイベント更新入力型 */
export interface UpdateTimelineEventDto {
  title?: string;
  description?: string | null;
  eventDate?: string;
  dateType?: string;
  eventType?: string;
  importance?: number;
  lane?: string | null;
  paperId?: string | null;
  highlightId?: string | null;
}

// ============================================================
// 引用ネットワーク（Citation Network）
// ============================================================

/** 読書ステータス */
export type ReadingStatus = 'unread' | 'reading' | 'done' | 'revisit';

/** Semantic Scholar 引用エントリ */
export interface CitationEntry {
  ssPaperId: string | null;
  title: string;
  authors: string[];
  year: number | null;
  doi: string | null;
  url: string | null;
}

/** 引用ネットワークデータ */
export interface CitationNetworkData {
  paperId: string;
  references: CitationEntry[];
  citedBy: CitationEntry[];
  fetchedAt: string | null;
}

/** 関連論文レコメンデーション */
export interface PaperRecommendation {
  id: string;
  paperId: string;
  recommendedPaperId: string | null;
  title: string;
  authors: string;         // JSON string
  year: number | null;
  doi: string | null;
  url: string | null;
  abstract: string | null;
  ssPaperId: string | null;
  relevanceScore: number | null;
  isImported: number;      // 0 | 1
  createdAt: string;
}

/** 引用グラフノード */
export interface CitationGraphNode {
  id: string;
  title: string;
  type: 'library' | 'reference';
  year: number | null;
}

/** 引用グラフエッジ */
export interface CitationGraphEdge {
  source: string;
  target: string;
  type: 'cites';
}

/** 引用グラフデータ */
export interface CitationGraphData {
  nodes: CitationGraphNode[];
  edges: CitationGraphEdge[];
}

/** 読書ステータス件数 */
export interface ReadingStatusCounts {
  unread: number;
  reading: number;
  done: number;
  revisit: number;
}
