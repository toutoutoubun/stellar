// src/lib/tauriShim.ts
// Stellar — Tauri 環境検出 + 安全な invoke / listen / convertFileSrc
// Tauri ランタイムが存在しない環境（ブラウザプレビュー等）では
// 即座に空データを返し、loading が永遠に終わらない問題を防ぐ。

// ── Tauri 環境検出 ─────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isTauri: boolean = !!(window as any).__TAURI_INTERNALS__;

// ── インメモリ CRUD ストア（非 Tauri 環境用）─────────
// ブラウザプレビューでも create / get / update / delete が動作するように
// メモリ上にデータを保持する軽量ストア。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockStore: { notes: any[]; projects: any[]; papers: any[]; datasets: any[]; analyses: any[]; codes: any[]; highlights: any[] } = {
  notes: [],
  projects: [],
  papers: [],
  datasets: [],
  analyses: [],
  codes: [],
  highlights: [],
};
let mockIdCounter = 1;
function mockId(): string {
  return `mock-${String(mockIdCounter++).padStart(6, "0")}`;
}
function now(): string {
  return new Date().toISOString();
}

/**
 * 動的にモック CRUD を処理するハンドラ。
 * 対応するコマンドの場合は結果を返し、未対応なら undefined を返す。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleDynamic(cmd: string, args?: Record<string, unknown>): { handled: true; result: any } | { handled: false } {
  // ── Notes ──
  if (cmd === "get_notes") {
    return { handled: true, result: { items: [...mockStore.notes], totalPages: 1, totalItems: mockStore.notes.length } };
  }
  if (cmd === "get_note") {
    const note = mockStore.notes.find((n) => n.id === args?.id) ?? null;
    return { handled: true, result: note };
  }
  if (cmd === "create_note") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const input = (args?.input ?? {}) as any;
    const note = {
      id: mockId(),
      title: input.title ?? "",
      content: input.content ?? "",
      tags: input.tags ?? [],
      paperId: input.paperId ?? null,
      createdAt: now(),
      updatedAt: now(),
    };
    mockStore.notes.unshift(note);
    return { handled: true, result: { ...note } };
  }
  if (cmd === "update_note") {
    const idx = mockStore.notes.findIndex((n) => n.id === args?.id);
    if (idx >= 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = (args?.input ?? {}) as any;
      const updated = { ...mockStore.notes[idx], ...input, updatedAt: now() };
      mockStore.notes[idx] = updated;
      return { handled: true, result: { ...updated } };
    }
    return { handled: true, result: null };
  }
  if (cmd === "delete_note") {
    mockStore.notes = mockStore.notes.filter((n) => n.id !== args?.id);
    return { handled: true, result: undefined };
  }

  // ── Qualitative Projects ──
  if (cmd === "get_projects" || cmd === "get_qual_projects") {
    return { handled: true, result: [...mockStore.projects] };
  }
  if (cmd === "create_project" || cmd === "create_qual_project") {
    // args はトップレベルに name, description, methodType を持つ場合と、
    // args.input にネストされている場合の両方に対応
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const input = (args?.input ?? args ?? {}) as any;
    const project = {
      id: mockId(),
      name: input.name ?? "新規プロジェクト",
      description: input.description ?? null,
      methodType: input.methodType ?? "thematic",
      createdAt: now(),
      updatedAt: null,
    };
    mockStore.projects.unshift(project);
    return { handled: true, result: { ...project } };
  }
  if (cmd === "delete_project" || cmd === "delete_qual_project") {
    mockStore.projects = mockStore.projects.filter((p) => p.id !== args?.id);
    return { handled: true, result: undefined };
  }

  // ── Papers (Library) ──
  if (cmd === "get_papers") {
    return { handled: true, result: { items: [...mockStore.papers], totalPages: 1, totalItems: mockStore.papers.length } };
  }
  if (cmd === "get_paper") {
    const paper = mockStore.papers.find((p) => p.id === args?.id) ?? null;
    return { handled: true, result: paper };
  }
  if (cmd === "create_paper") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const input = (args?.input ?? args ?? {}) as any;
    const paper = {
      id: mockId(),
      title: input.title ?? "無題の論文",
      authors: input.authors ?? [],
      year: input.year ?? null,
      journal: input.journal ?? null,
      volume: input.volume ?? null,
      issue: input.issue ?? null,
      pages: input.pages ?? null,
      doi: input.doi ?? null,
      url: input.url ?? null,
      abstract: input.abstract ?? null,
      pdfPath: input.pdfPath ?? null,
      tags: input.tags ?? [],
      createdAt: now(),
      updatedAt: now(),
    };
    mockStore.papers.unshift(paper);
    return { handled: true, result: { ...paper } };
  }
  if (cmd === "update_paper") {
    const idx = mockStore.papers.findIndex((p) => p.id === args?.id);
    if (idx >= 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = (args?.input ?? {}) as any;
      const updated = { ...mockStore.papers[idx], ...input, updatedAt: now() };
      mockStore.papers[idx] = updated;
      return { handled: true, result: { ...updated } };
    }
    return { handled: true, result: null };
  }
  if (cmd === "delete_paper") {
    mockStore.papers = mockStore.papers.filter((p) => p.id !== args?.id);
    return { handled: true, result: undefined };
  }

  // ── Datasets (Quantitative) ──
  if (cmd === "get_datasets") {
    return { handled: true, result: [...mockStore.datasets] };
  }
  if (cmd === "create_dataset") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = (args ?? {}) as any;
    const ds = {
      id: mockId(),
      name: a.name ?? "新規データセット",
      description: a.description ?? null,
      sourceType: a.sourceType ?? "manual",
      rowCount: 0,
      createdAt: now(),
      updatedAt: now(),
    };
    mockStore.datasets.unshift(ds);
    return { handled: true, result: { ...ds } };
  }
  if (cmd === "create_dataset_from_codes") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = (args ?? {}) as any;
    const ds = {
      id: mockId(),
      name: a.name ?? "コード集計データ",
      description: null,
      sourceType: "codes" as const,
      rowCount: 0,
      createdAt: now(),
      updatedAt: now(),
    };
    mockStore.datasets.unshift(ds);
    return { handled: true, result: { ...ds } };
  }
  if (cmd === "create_dataset_from_highlights") {
    const ds = {
      id: mockId(),
      name: "ハイライト抽出データ",
      description: null,
      sourceType: "highlights" as const,
      rowCount: 0,
      createdAt: now(),
      updatedAt: now(),
    };
    mockStore.datasets.unshift(ds);
    return { handled: true, result: { ...ds } };
  }
  if (cmd === "delete_dataset") {
    mockStore.datasets = mockStore.datasets.filter((d) => d.id !== args?.id);
    // Also delete associated analyses
    mockStore.analyses = mockStore.analyses.filter((a) => a.datasetId !== args?.id);
    return { handled: true, result: undefined };
  }

  // ── Variables & Data Rows (Quantitative) ──
  if (cmd === "get_variables") {
    return { handled: true, result: [] };
  }
  if (cmd === "get_data_rows") {
    return { handled: true, result: [] };
  }
  if (cmd === "import_csv") {
    return { handled: true, result: undefined };
  }
  if (cmd === "update_variable") {
    return { handled: true, result: undefined };
  }

  // ── Analyses (Quantitative) ──
  if (cmd === "get_analyses") {
    const datasetId = args?.datasetId as string | undefined;
    const filtered = datasetId
      ? mockStore.analyses.filter((a) => a.datasetId === datasetId)
      : [...mockStore.analyses];
    return { handled: true, result: filtered };
  }
  if (cmd === "save_analysis") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const input = (args?.input ?? args ?? {}) as any;
    const analysis = {
      id: mockId(),
      datasetId: input.datasetId ?? "",
      name: input.name ?? "新規分析",
      analysisType: input.analysisType ?? "descriptive",
      config: input.config ?? {},
      result: input.result ?? null,
      createdAt: now(),
      updatedAt: now(),
    };
    mockStore.analyses.unshift(analysis);
    return { handled: true, result: { ...analysis } };
  }
  if (cmd === "delete_analysis") {
    mockStore.analyses = mockStore.analyses.filter((a) => a.id !== args?.id);
    return { handled: true, result: undefined };
  }

  // ── Qualitative Codes ──
  if (cmd === "get_codes" || cmd === "get_code_tree") {
    const projectId = args?.projectId as string | undefined;
    const filtered = projectId
      ? mockStore.codes.filter((c) => c.projectId === projectId)
      : [...mockStore.codes];
    return { handled: true, result: filtered };
  }
  if (cmd === "create_code") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = (args ?? {}) as any;
    const code = {
      id: mockId(),
      projectId: a.projectId ?? "",
      parentId: a.parentId ?? null,
      label: a.label ?? "新規コード",
      color: a.color ?? "#6366f1",
      description: a.description ?? null,
      sortOrder: mockStore.codes.length,
      createdAt: now(),
      updatedAt: now(),
    };
    mockStore.codes.push(code);
    return { handled: true, result: { ...code } };
  }
  if (cmd === "update_code") {
    const idx = mockStore.codes.findIndex((c) => c.id === args?.id);
    if (idx >= 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const a = (args ?? {}) as any;
      const updated = { ...mockStore.codes[idx] };
      if (a.label != null) updated.label = a.label;
      if (a.color != null) updated.color = a.color;
      if (a.description != null) updated.description = a.description;
      if (a.parentId !== undefined) updated.parentId = a.parentId || null;
      if (a.sortOrder != null) updated.sortOrder = a.sortOrder;
      updated.updatedAt = now();
      mockStore.codes[idx] = updated;
    }
    return { handled: true, result: undefined };
  }
  if (cmd === "delete_code") {
    mockStore.codes = mockStore.codes.filter((c) => c.id !== args?.id);
    return { handled: true, result: undefined };
  }

  // ── Highlights ──
  if (cmd === "get_highlights") {
    return { handled: true, result: [...mockStore.highlights] };
  }
  if (cmd === "get_highlights_by_code") {
    const codeId = args?.codeId as string | undefined;
    const filtered = codeId
      ? mockStore.highlights.filter((h: any) => h.codeIds?.includes(codeId))
      : [];
    return { handled: true, result: filtered };
  }
  if (cmd === "create_highlight") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = (args ?? {}) as any;
    const hl = {
      id: mockId(),
      paperId: a.paperId ?? "",
      text: a.text ?? "",
      color: a.color ?? "#ffeb3b",
      comment: a.comment ?? null,
      codeIds: a.codeIds ?? [],
      pageNumber: a.pageNumber ?? null,
      rects: a.rects ?? [],
      createdAt: now(),
      updatedAt: now(),
    };
    mockStore.highlights.push(hl);
    return { handled: true, result: { ...hl } };
  }

  return { handled: false };
}

// ── 静的フォールバック（動的ハンドラ非対応コマンド用）────
// 動的ハンドラで処理されるコマンドはここに含めない。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MOCK_RESPONSES: Record<string, any> = {
  // Library — PDF/metadata helpers
  attach_pdf: null,
  import_pdf: null,
  fetch_metadata_by_doi: {},
  fetch_metadata_from_url: {},
  get_recent_items: [],

  // Notes — attachment helper
  save_note_attachment: null,

  // Highlights — helpers (main CRUD is in dynamic handler)
  update_highlight_comment: undefined,
  delete_highlight: undefined,
  create_note_from_highlights: "",
  assign_code_to_highlight: undefined,
  remove_code_from_highlight: undefined,

  // Links
  get_backlinks: [],
  create_link: null,
  delete_link: undefined,
  get_link_suggestions: [],

  // Search
  full_text_search: { papers: [], notes: [], highlights: [] },

  // Graph
  get_graph_data: { nodes: [], links: [] },

  // Qualitative — Coding Matrix
  get_coding_matrix: { rows: [], columns: [], cells: [] },

  // Qualitative — Source Critique
  get_source_critiques: [],
  get_source_critiques_by_project: [],
  get_source_critique: null,
  create_source_critique: null,
  update_source_critique: null,
  upsert_source_critique: null,
  delete_source_critique: undefined,

  // Qualitative — Timeline
  get_timeline_events: [],
  get_timeline_lanes: [],
  create_timeline_event: null,
  update_timeline_event: null,
  delete_timeline_event: undefined,

  // Qualitative — Actor Map
  get_actors: [],
  get_actor_map: { actors: [], relations: [] },
  create_actor: null,
  update_actor: null,
  delete_actor: undefined,
  get_actor_relations: [],
  create_actor_relation: null,
  delete_actor_relation: undefined,

  // Qualitative — Process Tracing
  get_pt_hypotheses: [],
  get_pt_data: { hypotheses: [], evidences: [] },
  get_pt_summary: null,
  create_pt_hypothesis: null,
  update_pt_hypothesis: null,
  delete_pt_hypothesis: undefined,
  get_pt_evidences: [],
  create_pt_evidence: null,
  add_pt_evidence: null,
  update_pt_evidence: null,
  update_pt_evidence_result: undefined,
  delete_pt_evidence: undefined,

  // Qualitative — Comparative Design
  get_comparative_design: null,
  create_comparative_design: null,
  update_comparative_design: null,
  get_comparative_cases: [],
  create_comparative_case: null,
  add_comparative_case: null,
  update_comparative_case: null,
  delete_comparative_case: undefined,
  get_comparative_variables: [],
  create_comparative_variable: null,
  add_comparative_variable: null,
  update_comparative_variable: null,
  delete_comparative_variable: undefined,
  get_comparative_cells: [],
  update_comparative_cell: undefined,
  upsert_comparative_cell: undefined,

  // Qualitative — Framing Analysis
  get_framing_matrices: [],
  get_framing_matrix: { frames: [], sources: [], cells: [] },
  get_frames: [],
  create_framing_matrix: null,
  create_frame: null,
  update_framing_matrix: null,
  delete_framing_matrix: undefined,
  delete_frame: undefined,

  // Qualitative — ICR
  get_icr_results: [],
  calculate_icr: null,

  // Qualitative — Report
  generate_analysis_report: "",
  export_qca_csv: "",
};

/**
 * 安全な invoke ラッパー。
 * Tauri 環境では本物の invoke を呼び、非 Tauri 環境ではモックデータを返す。
 */
export async function invoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!isTauri) {
    // 1) 動的ハンドラで処理を試みる（インメモリ CRUD）
    const dynamic = handleDynamic(cmd, args);
    if (dynamic.handled) {
      // ディープコピーして返す（undefined はそのまま）
      if (dynamic.result === undefined || dynamic.result === null) {
        return dynamic.result as T;
      }
      return JSON.parse(JSON.stringify(dynamic.result)) as T;
    }

    // 2) 静的フォールバック
    const mock = MOCK_RESPONSES[cmd];
    if (mock !== undefined) {
      return JSON.parse(JSON.stringify(mock)) as T;
    }

    // 3) 未登録コマンド: コマンド名パターンから安全なデフォルトを推測
    console.warn(`[tauriShim] Unknown command "${cmd}" — returning safe default`);
    if (cmd.startsWith("get_") || cmd.startsWith("list_")) {
      return [] as T;
    }
    return null as T;
  }

  // Tauri 環境: 本物の invoke を呼ぶ
  const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
  return tauriInvoke<T>(cmd, args);
}

// ── 安全な listen ──────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UnlistenFn = () => void;

/**
 * 安全な listen ラッパー。非 Tauri 環境では何もしない。
 */
export async function listen<T>(
  event: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (event: any) => void,
): Promise<UnlistenFn> {
  if (!isTauri) {
    return () => {};
  }
  const { listen: tauriListen } = await import("@tauri-apps/api/event");
  return tauriListen<T>(event, handler);
}

// ── 安全な convertFileSrc ──────────────────────────
/**
 * 安全な convertFileSrc ラッパー。非 Tauri 環境ではパスをそのまま返す。
 */
export function convertFileSrc(filePath: string, protocol?: string): string {
  if (!isTauri) {
    return filePath;
  }
  // Tauri の convertFileSrc は同期関数だが、動的importは非同期なので
  // ここでは同期的にアクセスできる __TAURI_INTERNALS__ を使う
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tauri = (window as any).__TAURI_INTERNALS__;
    if (tauri?.convertFileSrc) {
      return tauri.convertFileSrc(filePath, protocol);
    }
  } catch {
    // fallback
  }
  return filePath;
}

// ── 安全な getCurrentWindow ────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface WindowHandle {
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  close: () => Promise<void>;
}

const noopWindow: WindowHandle = {
  minimize: async () => {},
  toggleMaximize: async () => {},
  close: async () => {},
};

/**
 * 安全な getCurrentWindow。非 Tauri 環境では noop を返す。
 */
export async function getCurrentWindow(): Promise<WindowHandle> {
  if (!isTauri) return noopWindow;
  const { getCurrentWindow: tauriGetCurrentWindow } = await import("@tauri-apps/api/window");
  return tauriGetCurrentWindow() as unknown as WindowHandle;
}
