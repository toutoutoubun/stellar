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
const mockStore: Record<string, any[]> = {
  notes: [],
  projects: [],
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const input = (args?.input ?? {}) as any;
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

  return { handled: false };
}

// ── 静的フォールバック（動的ハンドラ非対応コマンド用）────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MOCK_RESPONSES: Record<string, any> = {
  // Library
  get_papers: { items: [], totalPages: 0, totalItems: 0 },
  get_paper: null,
  create_paper: null,
  update_paper: null,
  delete_paper: undefined,
  attach_pdf: null,
  import_pdf: null,
  fetch_metadata_by_doi: {},
  fetch_metadata_from_url: {},
  get_recent_items: [],

  // Notes — 動的ハンドラで処理するが、フォールバック用にも残す
  save_note_attachment: null,

  // Highlights
  get_highlights: [],
  get_highlights_by_code: [],
  create_highlight: null,
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

  // Qualitative — Codes
  get_codes: [],
  get_code_tree: [],
  create_code: null,
  update_code: undefined,
  delete_code: undefined,
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

  // Quantitative
  get_datasets: [],
  get_variables: [],
  get_data_rows: [],
  get_analyses: [],
  create_dataset: null,
  create_dataset_from_codes: null,
  create_dataset_from_highlights: null,
  import_csv: undefined,
  update_variable: undefined,
  save_analysis: null,
  delete_analysis: undefined,
  delete_dataset: undefined,
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
