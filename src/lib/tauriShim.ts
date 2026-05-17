// src/lib/tauriShim.ts
// Stellar — Tauri 環境検出 + 安全な invoke / listen / convertFileSrc
// Tauri ランタイムが存在しない環境（ブラウザプレビュー等）では
// 即座に空データを返し、loading が永遠に終わらない問題を防ぐ。

import { useI18nStore } from "../stores/useI18nStore";

// ── Tauri 環境検出 ─────────────────────────────────
function detectTauriRuntime(): boolean {
  if (typeof window === "undefined") return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return Boolean(
    w.__TAURI_INTERNALS__ ||
    w.__TAURI__ ||
    typeof w.__TAURI_IPC__ === "function" ||
    window.location.protocol === "tauri:" ||
    navigator.userAgent.includes("Tauri"),
  );
}

export let isTauri: boolean = detectTauriRuntime();

function hasTauriRuntime(): boolean {
  isTauri = detectTauriRuntime();
  return isTauri;
}

// ── インメモリ CRUD ストア（非 Tauri 環境用）─────────
// ブラウザプレビューでも create / get / update / delete が動作するように
// メモリ上にデータを保持する軽量ストア。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockStore: { notes: any[]; projects: any[]; papers: any[]; datasets: any[]; variables: any[]; dataRows: any[]; analyses: any[]; codes: any[]; highlights: any[]; links: any[]; qualitativeSources: any[]; sourceSegments: any[]; qualitativeSourceHighlights: any[]; sourceHighlightCodes: any[]; qualSourceCritiques: any[]; comparativeDesigns: any[]; comparativeCases: any[]; comparativeVariables: any[]; comparativeCells: any[] } = {
  notes: [],
  projects: [],
  papers: [],
  datasets: [],
  variables: [],
  dataRows: [],
  analyses: [],
  codes: [],
  highlights: [],
  links: [],
  qualitativeSources: [],
  sourceSegments: [],
  qualitativeSourceHighlights: [],
  sourceHighlightCodes: [],
  qualSourceCritiques: [],
  comparativeDesigns: [],
  comparativeCases: [],
  comparativeVariables: [],
  comparativeCells: [],
};
let mockIdCounter = 1;
function mockId(): string {
  return `mock-${String(mockIdCounter++).padStart(6, "0")}`;
}
function now(): string {
  return new Date().toISOString();
}

function mockReportLabels(language: unknown): {
  title: string;
  method: string;
  generatedAt: string;
  empty: string;
  sections: Record<string, string>;
} {
  const key = commandString(language, "ja").split(/[-_]/)[0]?.toLowerCase();
  if (key === "en") {
    return {
      title: "Analysis Report",
      method: "Analysis Method",
      generatedAt: "Generated At",
      empty: "*No data*",
      sections: {
        codebook: "Codebook",
        matrix: "Coding Matrix",
        timeline: "Timeline",
        actors: "Actor Map",
        process_tracing: "Process Tracing",
        comparative: "Comparative Case Design",
        framing: "Framing Analysis",
      },
    };
  }
  if (key === "fr") {
    return {
      title: "Rapport d'analyse",
      method: "Méthode d'analyse",
      generatedAt: "Généré le",
      empty: "*Aucune donnée*",
      sections: {
        codebook: "Livre de codes",
        matrix: "Matrice de codage",
        timeline: "Chronologie",
        actors: "Carte des acteurs",
        process_tracing: "Traçage de processus",
        comparative: "Design comparatif de cas",
        framing: "Analyse de cadrage",
      },
    };
  }
  if (key === "af") {
    return {
      title: "Analiseverslag",
      method: "Ontledingsmetode",
      generatedAt: "Gegenereer op",
      empty: "*Geen data nie*",
      sections: {
        codebook: "Kodeboek",
        matrix: "Koderingsmatriks",
        timeline: "Tydlyn",
        actors: "Akteurkaart",
        process_tracing: "Prosesnasporing",
        comparative: "Vergelykende gevalontwerp",
        framing: "Raamwerk-ontleding",
      },
    };
  }
  return {
    title: "分析レポート",
    method: "分析手法",
    generatedAt: "生成日時",
    empty: "*データなし*",
    sections: {
      codebook: "コードブック",
      matrix: "コーディングマトリクス",
      timeline: "タイムライン",
      actors: "アクターマップ",
      process_tracing: "プロセス・トレーシング",
      comparative: "比較ケース設計",
      framing: "フレーミング分析",
    },
  };
}

function buildMockAnalysisReport(args?: Record<string, unknown>): string {
  const projectId = commandString(args?.projectId ?? args?.project_id);
  const project = mockStore.projects.find((item) => item.id === projectId);
  const sections = Array.isArray(args?.sections) ? args.sections.map(String) : [];
  const labels = mockReportLabels(args?.language);
  const lines = [
    `# ${labels.title}: ${project?.name ?? "Project"}`,
    "",
    `**${labels.method}**: ${project?.methodType ?? "thematic"}  `,
    `**${labels.generatedAt}**: ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
    "",
    "---",
    "",
  ];
  for (const section of sections) {
    lines.push(`## ${labels.sections[section] ?? section}`, "", labels.empty, "");
  }
  return lines.join("\n");
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function commandInput(args?: Record<string, unknown>): UnknownRecord {
  return isRecord(args?.input) ? args.input : (args ?? {});
}

function commandString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function commandNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeText(value: string): string {
  return value.normalize("NFC");
}

function commandNormalizedString(value: unknown, fallback = ""): string {
  return normalizeText(commandString(value, fallback));
}

function commandNormalizedNullableString(value: unknown): string | null {
  return typeof value === "string" ? normalizeText(value) : null;
}

function commandNormalizedStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map(normalizeText)
    : [];
}

function commandNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeMockDataValues(
  values: UnknownRecord,
  variables: UnknownRecord[],
): UnknownRecord {
  const variableIds = new Set(variables.map((v) => commandString(v.id)));
  const variableIdByName = new Map(
    variables.map((v) => [commandString(v.name), commandString(v.id)]),
  );
  const normalized: UnknownRecord = {};
  for (const [key, value] of Object.entries(values)) {
    const storageKey = variableIds.has(key) ? key : (variableIdByName.get(key) ?? key);
    normalized[storageKey] = value;
  }
  return normalized;
}

function detectMockVariableType(variable: UnknownRecord, rows: UnknownRecord[]): string {
  const variableId = commandString(variable.id);
  const variableName = commandString(variable.name);
  const variableLabel = commandNullableString(variable.label);
  const values = rows
    .map((row) => {
      const rowValues = isRecord(row.values) ? row.values : {};
      const value =
        rowValues[variableId] ??
        rowValues[variableName] ??
        (variableLabel ? rowValues[variableLabel] : undefined);
      return value == null ? "" : String(value).trim();
    })
    .filter(Boolean);

  if (values.length === 0) return "text";
  const nameLower = variableName.toLowerCase();
  if (nameLower.includes("日付") || nameLower.includes("年") || nameLower.includes("date")) {
    return "date";
  }

  const numericCount = values.filter((value) => Number.isFinite(Number(value))).length;
  if (numericCount / values.length >= 0.8) return "scale";
  return new Set(values).size <= 10 ? "nominal" : "text";
}

function compareSortOrder(a: UnknownRecord, b: UnknownRecord): number {
  return commandNumber(a.sortOrder) - commandNumber(b.sortOrder);
}

function buildMockComparativeDesignFull(design: UnknownRecord): UnknownRecord {
  const designId = commandString(design.id);
  const cases = mockStore.comparativeCases
    .filter((item) => item.designId === designId)
    .sort(compareSortOrder)
    .map((item) => ({ ...item }));
  const variables = mockStore.comparativeVariables
    .filter((item) => item.designId === designId)
    .sort(compareSortOrder)
    .map((item) => ({ ...item }));
  const caseIds = new Set(cases.map((item) => commandString(item.id)));
  const variableIds = new Set(variables.map((item) => commandString(item.id)));
  const cells = mockStore.comparativeCells
    .filter((item) => caseIds.has(commandString(item.caseId)) && variableIds.has(commandString(item.variableId)))
    .map((item) => ({ ...item }));
  return { ...design, cases, variables, cells };
}

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildMockQcaCsv(designId: string): string {
  const cases = mockStore.comparativeCases
    .filter((item) => item.designId === designId)
    .sort(compareSortOrder);
  const variables = mockStore.comparativeVariables
    .filter((item) => item.designId === designId)
    .sort(compareSortOrder);
  const cellMap = new Map<string, string>();
  for (const cell of mockStore.comparativeCells) {
    cellMap.set(`${cell.caseId}:${cell.variableId}`, commandString(cell.value));
  }

  const lines = [
    ["case", ...variables.map((item) => commandString(item.name))].map(csvCell).join(","),
  ];
  for (const itemCase of cases) {
    const caseId = commandString(itemCase.id);
    const values = variables.map((variable) =>
      cellMap.get(`${caseId}:${commandString(variable.id)}`) ?? "",
    );
    lines.push([commandString(itemCase.name), ...values].map(csvCell).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function mockCodeAssignmentCount(codeId: string): number {
  const paperHighlightCount = mockStore.highlights.filter((highlight) =>
    Array.isArray(highlight.codeIds) && highlight.codeIds.includes(codeId),
  ).length;
  const sourceSegmentCount = mockStore.sourceSegments.filter(
    (segment) => segment.codeId === codeId,
  ).length;
  const sourceHighlightCount = mockStore.sourceHighlightCodes.filter(
    (assignment) => assignment.codeId === codeId,
  ).length;
  return paperHighlightCount + sourceSegmentCount + sourceHighlightCount;
}

const MOCK_JA_STOPWORDS = new Set([
  "は", "が", "を", "に", "の", "で", "と", "も", "から", "まで", "より", "など",
  "こと", "ため", "よる", "おける", "れる", "られる", "する", "した", "して",
  "これ", "その", "この", "あの", "そのような",
]);

const MOCK_EN_STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "of", "in", "to", "and", "or",
  "but", "for", "with", "by", "on", "at",
]);

function normalizeMockToken(token: string): string | null {
  const normalized = token
    .replace(/^[\s'.,!?;:()\[\]{}"“”‘’]+|[\s'.,!?;:()[\]{}"“”‘’]+$/g, "")
    .toLowerCase()
    .normalize("NFC");
  if ([...normalized].length < 2) return null;
  if (/^\d+$/.test(normalized)) return null;
  return normalized;
}

function tokenizeMockCooccurrenceText(text: string, locale?: string): string[] {
  const hasJapanese = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(text);
  const normalizedLocale = locale?.trim().toLowerCase().split(/[-_]/)[0] ?? "";
  const stopwords =
    normalizedLocale === "ja" || (!normalizedLocale && hasJapanese)
      ? MOCK_JA_STOPWORDS
      : normalizedLocale === "zu" ||
          normalizedLocale === "xh" ||
          normalizedLocale === "nso" ||
          normalizedLocale === "tn" ||
          normalizedLocale === "st"
        ? new Set<string>()
        : MOCK_EN_STOPWORDS;
  const matches = text.match(/[A-Za-z0-9']+|[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaffー]+/g) ?? [];
  return matches
    .map(normalizeMockToken)
    .filter((token): token is string => Boolean(token && !stopwords.has(token)));
}

function buildMockCooccurrencePairs(
  text: string,
  windowSize = 5,
  topN = 10,
  locale?: string,
): Array<{ wordA: string; wordB: string; count: number }> {
  const tokens = tokenizeMockCooccurrenceText(text, locale);
  const window = Math.min(Math.max(Math.trunc(windowSize), 2), 50);
  const limit = Math.min(Math.max(Math.trunc(topN), 1), 100);
  const counts = new Map<string, number>();

  for (let start = 0; start < tokens.length; start++) {
    const end = Math.min(start + window, tokens.length);
    for (let i = start; i < end; i++) {
      for (let j = i + 1; j < end; j++) {
        const left = tokens[i]!;
        const right = tokens[j]!;
        if (left === right) continue;
        const [wordA, wordB] = [left, right].sort() as [string, string];
        const key = `${wordA}\0${wordB}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }

  return [...counts.entries()]
    .map(([key, count]) => {
      const [wordA, wordB] = key.split("\0") as [string, string];
      return { wordA, wordB, count };
    })
    .sort((a, b) => b.count - a.count || a.wordA.localeCompare(b.wordA) || a.wordB.localeCompare(b.wordB))
    .slice(0, limit);
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
      title: commandNormalizedString(input.title),
      content: commandNormalizedString(input.content),
      tags: commandNormalizedStringArray(input.tags),
      paperId: input.paperId ?? null,
      isDraft: 0,
      draftMeta: "{}",
      wordCount: 0,
      readingTimeMin: 0,
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
      if (input.title !== undefined) updated.title = commandNormalizedString(input.title, updated.title);
      if (input.content !== undefined) updated.content = commandNormalizedString(input.content, updated.content);
      if (input.tags !== undefined) updated.tags = commandNormalizedStringArray(input.tags);
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
      name: commandNormalizedString(input.name, useI18nStore.getState().t.utils.str_9w7zjx),
      description: commandNormalizedNullableString(input.description),
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
  if (cmd === "update_project" || cmd === "update_qual_project") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates = (args?.updates ?? args?.input ?? {}) as any;
    const idx = mockStore.projects.findIndex((p) => p.id === args?.id);
    if (idx !== -1) {
      const proj = mockStore.projects[idx]!;
      if (updates.name !== undefined) proj.name = commandNormalizedString(updates.name, proj.name);
      if (updates.description !== undefined) proj.description = commandNormalizedNullableString(updates.description);
      if (updates.methodType !== undefined) proj.methodType = updates.methodType;
      proj.updatedAt = now();
      return { handled: true, result: { ...proj } };
    }
    return { handled: true, result: null };
  }

  // ── Tags (Library) ──
  if (cmd === "get_all_tags") {
    const tagCount = new Map<string, number>();
    for (const paper of mockStore.papers) {
      for (const tag of (paper.tags ?? [])) {
        tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
      }
    }
    const result = [...tagCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
    return { handled: true, result };
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
      title: commandNormalizedString(input.title, useI18nStore.getState().t.utils.str_zgkhcc),
      authors: commandNormalizedStringArray(input.authors),
      year: input.year ?? null,
      journal: commandNormalizedNullableString(input.journal),
      volume: commandNormalizedNullableString(input.volume),
      issue: commandNormalizedNullableString(input.issue),
      pages: commandNormalizedNullableString(input.pages),
      doi: commandNormalizedNullableString(input.doi),
      url: commandNormalizedNullableString(input.url),
      abstract: commandNormalizedNullableString(input.abstract),
      pdfPath: input.pdfPath ?? null,
      tags: commandNormalizedStringArray(input.tags),
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
      if (input.title !== undefined) updated.title = commandNormalizedString(input.title, updated.title);
      if (input.authors !== undefined) updated.authors = commandNormalizedStringArray(input.authors);
      if (input.journal !== undefined) updated.journal = commandNormalizedNullableString(input.journal);
      if (input.volume !== undefined) updated.volume = commandNormalizedNullableString(input.volume);
      if (input.issue !== undefined) updated.issue = commandNormalizedNullableString(input.issue);
      if (input.pages !== undefined) updated.pages = commandNormalizedNullableString(input.pages);
      if (input.doi !== undefined) updated.doi = commandNormalizedNullableString(input.doi);
      if (input.url !== undefined) updated.url = commandNormalizedNullableString(input.url);
      if (input.abstract !== undefined) updated.abstract = commandNormalizedNullableString(input.abstract);
      if (input.tags !== undefined) updated.tags = commandNormalizedStringArray(input.tags);
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
    const a = commandInput(args);
    const ds = {
      id: mockId(),
      name: commandString(a.name, useI18nStore.getState().t.quantitative.k_2jvud1),
      description: commandNullableString(a.description),
      sourceType: commandString(a.sourceType, "manual"),
      sourceRef: commandNullableString(a.sourceRef),
      rowCount: 0,
      createdAt: now(),
      updatedAt: now(),
    };
    mockStore.datasets.unshift(ds);
    return { handled: true, result: { ...ds } };
  }
  if (cmd === "create_dataset_from_codes") {
    const a = commandInput(args);
    const ds = {
      id: mockId(),
      name: commandString(
        a.datasetName ?? a.name,
        useI18nStore.getState().t.utils.str_7nzz94,
      ),
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
    const paperId = typeof args?.paperId === "string" ? args.paperId : null;
    const highlights = paperId
      ? mockStore.highlights.filter((h) => h.paperId === paperId)
      : mockStore.highlights;
    if (highlights.length === 0) {
      throw new Error("この論文にはデータセット化できるハイライトがありません");
    }
    const ds = {
      id: mockId(),
      name: useI18nStore.getState().t.utils.str_gs5oob,
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
    const datasetId = args?.datasetId as string | undefined;
    const variables = datasetId
      ? mockStore.variables.filter((v) => v.datasetId === datasetId)
      : [...mockStore.variables];
    return { handled: true, result: variables };
  }
  if (cmd === "get_data_rows") {
    const datasetId = args?.datasetId as string | undefined;
    const offset = commandNumber(args?.offset, 0);
    const limit = commandNumber(args?.limit, 50);
    const rows = mockStore.dataRows
      .filter((row) => !datasetId || row.datasetId === datasetId)
      .sort((a, b) => commandNumber(a.rowIndex) - commandNumber(b.rowIndex))
      .slice(offset, offset + limit);
    return { handled: true, result: rows };
  }
  if (cmd === "import_csv") {
    const input = commandInput(args);
    const datasetId = commandString(input.datasetId);
    const csvText = commandString(input.csvText);
    const delimiter = commandString(input.delimiter, ",");
    const hasHeader = input.hasHeader !== false;
    const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (!datasetId || lines.length === 0) {
      return { handled: true, result: { datasetId, rowCount: 0, variableCount: 0, warnings: [] } };
    }

    const cells = lines.map((line) => line.split(delimiter));
    const headers = hasHeader
      ? (cells.shift() ?? []).map((header, index) => header.trim() || `column_${index + 1}`)
      : (cells[0] ?? []).map((_, index) => `column_${index + 1}`);
    mockStore.variables = mockStore.variables.filter((v) => v.datasetId !== datasetId);
    mockStore.dataRows = mockStore.dataRows.filter((row) => row.datasetId !== datasetId);
    const variables = headers.map((name, index) => ({
      id: mockId(),
      datasetId,
      columnIndex: index,
      name,
      label: null,
      varType: "text",
      unit: null,
      likertMin: null,
      likertMax: null,
      likertLabels: null,
    }));
    mockStore.variables.push(...variables);
    const rows = cells.map((row, rowIndex) => {
      const values: UnknownRecord = {};
      variables.forEach((variable, columnIndex) => {
        values[variable.id] = row[columnIndex] ?? "";
      });
      return { id: mockId(), datasetId, rowIndex, values, createdAt: now() };
    });
    mockStore.dataRows.push(...rows);
    const dataset = mockStore.datasets.find((d) => d.id === datasetId);
    if (dataset) {
      dataset.sourceType = "csv";
      dataset.rowCount = rows.length;
      dataset.updatedAt = now();
    }
    return {
      handled: true,
      result: { datasetId, rowCount: rows.length, variableCount: variables.length, warnings: [] },
    };
  }
  if (cmd === "create_variable") {
    const input = commandInput(args);
    const datasetId = commandString(input.datasetId);
    const variable = {
      id: mockId(),
      datasetId,
      columnIndex: commandNumber(input.columnIndex, mockStore.variables.length),
      name: commandString(input.name, `variable_${mockStore.variables.length + 1}`),
      label: commandNullableString(input.label),
      varType: commandString(input.varType, "text"),
      unit: commandNullableString(input.unit),
      likertMin: input.likertMin ?? null,
      likertMax: input.likertMax ?? null,
      likertLabels: input.likertLabels ?? null,
    };
    mockStore.variables.push(variable);
    return { handled: true, result: { ...variable } };
  }
  if (cmd === "update_variable") {
    const idx = mockStore.variables.findIndex((v) => v.id === args?.id);
    if (idx >= 0) {
      const current = mockStore.variables[idx];
      const updated = {
        ...current,
        name: commandString(args?.name, current.name),
        label: args?.label === undefined ? current.label : commandNullableString(args.label),
        varType: commandString(args?.varType, current.varType),
        unit: args?.unit === undefined ? current.unit : commandNullableString(args.unit),
        likertLabels: args?.likertLabels === undefined ? current.likertLabels : args.likertLabels,
      };
      mockStore.variables[idx] = updated;
      return { handled: true, result: { ...updated } };
    }
    return { handled: true, result: null };
  }
  if (cmd === "delete_variable") {
    mockStore.variables = mockStore.variables.filter((v) => v.id !== args?.id);
    return { handled: true, result: undefined };
  }
  if (cmd === "insert_data_rows") {
    const datasetId = commandString(args?.datasetId);
    const rows = Array.isArray(args?.rows) ? args.rows : [];
    const variables = mockStore.variables.filter((v) => v.datasetId === datasetId);
    const maxRowIndex = mockStore.dataRows
      .filter((row) => row.datasetId === datasetId)
      .reduce((max, row) => Math.max(max, commandNumber(row.rowIndex, -1)), -1);
    const createdRows = rows.map((row, index) => ({
      id: mockId(),
      datasetId,
      rowIndex: maxRowIndex + 1 + index,
      values: normalizeMockDataValues(isRecord(row) ? row : {}, variables),
      createdAt: now(),
    }));
    mockStore.dataRows.push(...createdRows);
    const dataset = mockStore.datasets.find((d) => d.id === datasetId);
    if (dataset) {
      dataset.rowCount = mockStore.dataRows.filter((row) => row.datasetId === datasetId).length;
      dataset.updatedAt = now();
    }
    return { handled: true, result: createdRows.length };
  }
  if (cmd === "delete_data_rows") {
    const datasetId = commandString(args?.datasetId);
    mockStore.dataRows = mockStore.dataRows.filter((row) => row.datasetId !== datasetId);
    const dataset = mockStore.datasets.find((d) => d.id === datasetId);
    if (dataset) {
      dataset.rowCount = 0;
      dataset.updatedAt = now();
    }
    return { handled: true, result: true };
  }
  if (cmd === "auto_detect_variable_types") {
    const datasetId = commandString(args?.datasetId);
    const rows = mockStore.dataRows.filter((row) => row.datasetId === datasetId);
    const variables = mockStore.variables
      .filter((variable) => variable.datasetId === datasetId)
      .map((variable) => {
        const updated = { ...variable, varType: detectMockVariableType(variable, rows) };
        const idx = mockStore.variables.findIndex((item) => item.id === variable.id);
        if (idx >= 0) {
          mockStore.variables[idx] = updated;
        }
        return updated;
      });
    return { handled: true, result: variables };
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
      name: input.name ?? useI18nStore.getState().t.utils.str_de9xm1,
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
    return {
      handled: true,
      result: filtered.map((code) => ({
        ...code,
        children: code.children ?? [],
        assignmentCount: mockCodeAssignmentCount(commandString(code.id)),
      })),
    };
  }
  if (cmd === "create_code") {
    const a = commandInput(args);
    const code = {
      id: mockId(),
      projectId: commandString(a.projectId),
      parentId: commandNullableString(a.parentId),
      name: commandNormalizedString(a.name, commandString(a.label, useI18nStore.getState().t.utils.str_b194an)),
      color: commandString(a.color, "#6366f1"),
      codeType: commandString(a.codeType, "thematic"),
      description: commandNormalizedNullableString(a.description),
      sortOrder: mockStore.codes.length,
      children: [],
      assignmentCount: 0,
      createdAt: now(),
      updatedAt: now(),
    };
    mockStore.codes.push(code);
    return { handled: true, result: { ...code } };
  }
  if (cmd === "update_code") {
    const idx = mockStore.codes.findIndex((c) => c.id === args?.id);
    if (idx >= 0) {
      const a = commandInput(args);
      const updated = { ...mockStore.codes[idx] };
      if (a.name != null) updated.name = commandNormalizedString(a.name, updated.name);
      if (a.label != null) updated.name = commandNormalizedString(a.label, updated.name);
      if (a.color != null) updated.color = a.color;
      if (a.description != null) updated.description = commandNormalizedString(a.description, updated.description);
      if (a.parentId !== undefined) updated.parentId = a.parentId || null;
      if (a.sortOrder != null) updated.sortOrder = a.sortOrder;
      updated.updatedAt = now();
      mockStore.codes[idx] = updated;
    }
    return { handled: true, result: undefined };
  }
  if (cmd === "delete_code") {
    const codeId = commandString(args?.id);
    mockStore.codes = mockStore.codes.filter((c) => c.id !== codeId);
    mockStore.sourceSegments = mockStore.sourceSegments.filter((segment) => segment.codeId !== codeId);
    mockStore.sourceHighlightCodes = mockStore.sourceHighlightCodes.filter((assignment) => assignment.codeId !== codeId);
    for (const highlight of mockStore.highlights) {
      if (Array.isArray(highlight.codeIds)) {
        highlight.codeIds = highlight.codeIds.filter((id: string) => id !== codeId);
      }
    }
    return { handled: true, result: undefined };
  }

  // ── Qualitative Comparative Design ──
  if (cmd === "get_comparative_design") {
    const projectId = commandString(args?.projectId ?? args?.project_id);
    const designs = mockStore.comparativeDesigns
      .filter((item) => !projectId || item.projectId === projectId)
      .sort((a, b) => commandString(a.createdAt).localeCompare(commandString(b.createdAt)))
      .map(buildMockComparativeDesignFull);
    return { handled: true, result: designs };
  }
  if (cmd === "create_comparative_design") {
    const input = commandInput(args);
    const design = {
      id: mockId(),
      projectId: commandString(input.projectId),
      designType: commandString(input.designType, "MSSD"),
      title: commandString(input.title, useI18nStore.getState().t.qualitative.k_x6q83e),
      createdAt: now(),
    };
    mockStore.comparativeDesigns.push(design);
    return { handled: true, result: { ...design } };
  }
  if (cmd === "update_comparative_design") {
    const id = commandString(args?.id);
    const input = commandInput(args);
    const idx = mockStore.comparativeDesigns.findIndex((item) => item.id === id);
    if (idx >= 0) {
      const updated = { ...mockStore.comparativeDesigns[idx] };
      if (input.title !== undefined) updated.title = commandString(input.title, updated.title);
      if (input.designType !== undefined) updated.designType = commandString(input.designType, updated.designType);
      mockStore.comparativeDesigns[idx] = updated;
      return { handled: true, result: { ...updated } };
    }
    return { handled: true, result: null };
  }
  if (cmd === "get_comparative_cases") {
    const designId = commandString(args?.designId ?? args?.design_id);
    return {
      handled: true,
      result: mockStore.comparativeCases
        .filter((item) => !designId || item.designId === designId)
        .sort(compareSortOrder)
        .map((item) => ({ ...item })),
    };
  }
  if (cmd === "add_comparative_case" || cmd === "create_comparative_case") {
    const input = commandInput(args);
    const designId = commandString(input.designId);
    const sortOrder = commandNumber(
      input.sortOrder,
      mockStore.comparativeCases.filter((item) => item.designId === designId).length,
    );
    const itemCase = {
      id: mockId(),
      designId,
      name: commandString(input.name, "Case"),
      sortOrder,
    };
    mockStore.comparativeCases.push(itemCase);
    return { handled: true, result: { ...itemCase } };
  }
  if (cmd === "delete_comparative_case") {
    const id = commandString(args?.id);
    mockStore.comparativeCases = mockStore.comparativeCases.filter((item) => item.id !== id);
    mockStore.comparativeCells = mockStore.comparativeCells.filter((item) => item.caseId !== id);
    return { handled: true, result: undefined };
  }
  if (cmd === "get_comparative_variables") {
    const designId = commandString(args?.designId ?? args?.design_id);
    return {
      handled: true,
      result: mockStore.comparativeVariables
        .filter((item) => !designId || item.designId === designId)
        .sort(compareSortOrder)
        .map((item) => ({ ...item })),
    };
  }
  if (cmd === "add_comparative_variable" || cmd === "create_comparative_variable") {
    const input = commandInput(args);
    const designId = commandString(input.designId);
    const sortOrder = commandNumber(
      input.sortOrder,
      mockStore.comparativeVariables.filter((item) => item.designId === designId).length,
    );
    const variable = {
      id: mockId(),
      designId,
      name: commandString(input.name, "Variable"),
      varType: commandString(input.varType, "independent"),
      sortOrder,
    };
    mockStore.comparativeVariables.push(variable);
    return { handled: true, result: { ...variable } };
  }
  if (cmd === "delete_comparative_variable") {
    const id = commandString(args?.id);
    mockStore.comparativeVariables = mockStore.comparativeVariables.filter((item) => item.id !== id);
    mockStore.comparativeCells = mockStore.comparativeCells.filter((item) => item.variableId !== id);
    return { handled: true, result: undefined };
  }
  if (cmd === "get_comparative_cells") {
    const designId = commandString(args?.designId ?? args?.design_id);
    const caseIds = new Set(
      mockStore.comparativeCases
        .filter((item) => !designId || item.designId === designId)
        .map((item) => item.id),
    );
    return {
      handled: true,
      result: mockStore.comparativeCells
        .filter((item) => caseIds.has(item.caseId))
        .map((item) => ({ ...item })),
    };
  }
  if (cmd === "upsert_comparative_cell" || cmd === "update_comparative_cell") {
    const input = commandInput(args);
    const caseId = commandString(input.caseId);
    const variableId = commandString(input.variableId);
    const existing = mockStore.comparativeCells.findIndex(
      (item) => item.caseId === caseId && item.variableId === variableId,
    );
    const cell = {
      id: existing >= 0 ? mockStore.comparativeCells[existing].id : mockId(),
      caseId,
      variableId,
      value: commandString(input.value),
      paperId: commandNullableString(input.paperId),
    };
    if (existing >= 0) {
      mockStore.comparativeCells[existing] = cell;
    } else {
      mockStore.comparativeCells.push(cell);
    }
    return { handled: true, result: undefined };
  }
  if (cmd === "export_qca_csv") {
    const designId = commandString(args?.designId ?? args?.design_id);
    return { handled: true, result: buildMockQcaCsv(designId) };
  }

  // ── Qualitative Sources ──
  if (cmd === "get_qualitative_sources") {
    const projectId = args?.projectId as string | undefined;
    const filtered = projectId
      ? mockStore.qualitativeSources.filter((source) => source.projectId === projectId)
      : [...mockStore.qualitativeSources];
    return { handled: true, result: filtered };
  }
  if (cmd === "get_qualitative_source") {
    const source = mockStore.qualitativeSources.find((item) => item.id === args?.id) ?? null;
    return { handled: true, result: source };
  }
  if (cmd === "import_qualitative_source") {
    const input = commandInput(args);
    const filePath = commandString(input.filePath);
    const title = commandNormalizedString(
      input.title,
      filePath.split(/[\\/]/).pop()?.replace(/\.(docx|pdf|md|markdown)$/i, "") ?? "分析ソース",
    );
    const fileType = filePath.split(".").pop()?.toLowerCase() ?? "md";
    const content = filePath
      ? normalizeText(`${title}\n\nブラウザプレビューでは本文抽出はTauri実行時に有効です。`)
      : "";
    const source = {
      id: mockId(),
      projectId: commandString(input.projectId),
      title,
      sourceType: commandString(input.sourceType, "primary_source"),
      fileType,
      filePath: filePath || null,
      content,
      wordCount: content.split(/\s+/).filter(Boolean).length,
      createdAt: now(),
      updatedAt: now(),
    };
    mockStore.qualitativeSources.unshift(source);
    return { handled: true, result: { ...source } };
  }
  if (cmd === "update_qualitative_source") {
    const idx = mockStore.qualitativeSources.findIndex((source) => source.id === args?.id);
    if (idx >= 0) {
      const input = commandInput(args);
      const updated = { ...mockStore.qualitativeSources[idx] };
      if (input.title !== undefined) updated.title = commandNormalizedString(input.title, updated.title);
      if (input.sourceType !== undefined) updated.sourceType = commandString(input.sourceType, updated.sourceType);
      if (input.content !== undefined) {
        updated.content = commandNormalizedString(input.content);
        updated.wordCount = updated.content.split(/\s+/).filter(Boolean).length;
      }
      updated.updatedAt = now();
      mockStore.qualitativeSources[idx] = updated;
      return { handled: true, result: { ...updated } };
    }
    return { handled: true, result: null };
  }
  if (cmd === "delete_qualitative_source") {
    const id = args?.id;
    const deletedHighlightIds = new Set(
      mockStore.qualitativeSourceHighlights
        .filter((highlight) => highlight.sourceId === id)
        .map((highlight) => highlight.id),
    );
    mockStore.qualitativeSources = mockStore.qualitativeSources.filter((source) => source.id !== id);
    mockStore.sourceSegments = mockStore.sourceSegments.filter((segment) => segment.sourceId !== id);
    mockStore.qualitativeSourceHighlights = mockStore.qualitativeSourceHighlights.filter((highlight) => highlight.sourceId !== id);
    mockStore.sourceHighlightCodes = mockStore.sourceHighlightCodes.filter(
      (assignment) => !deletedHighlightIds.has(assignment.sourceHighlightId),
    );
    mockStore.qualSourceCritiques = mockStore.qualSourceCritiques.filter((critique) => critique.sourceId !== id);
    return { handled: true, result: undefined };
  }
  if (cmd === "assign_code_to_source_segment") {
    const input = commandInput(args);
    const sourceId = commandString(input.sourceId);
    const source = mockStore.qualitativeSources.find((item) => item.id === sourceId);
    const segment = {
      id: mockId(),
      sourceId,
      sourceTitle: source?.title ?? "",
      codeId: commandString(input.codeId),
      segmentText: commandNormalizedString(input.segmentText).trim(),
      offsetStart: typeof input.offsetStart === "number" ? input.offsetStart : null,
      offsetEnd: typeof input.offsetEnd === "number" ? input.offsetEnd : null,
      memo: commandNormalizedNullableString(input.memo),
      assignedAt: now(),
    };
    mockStore.sourceSegments.push(segment);
    const code = mockStore.codes.find((item) => item.id === segment.codeId);
    if (code) code.assignmentCount = commandNumber(code.assignmentCount, 0) + 1;
    return { handled: true, result: { ...segment } };
  }
  if (cmd === "get_source_segments") {
    const sourceId = args?.sourceId as string | undefined;
    return {
      handled: true,
      result: mockStore.sourceSegments.filter((segment) => segment.sourceId === sourceId),
    };
  }
  if (cmd === "get_source_segments_by_code") {
    const codeId = args?.codeId as string | undefined;
    return {
      handled: true,
      result: mockStore.sourceSegments.filter((segment) => segment.codeId === codeId),
    };
  }
  if (cmd === "analyze_cooccurrence") {
    const segmentId = args?.segmentId as string | undefined;
    const segment = mockStore.sourceSegments.find((item) => item.id === segmentId);
    return {
      handled: true,
      result: buildMockCooccurrencePairs(
        commandString(segment?.segmentText),
        commandNumber(args?.windowSize, 5),
        commandNumber(args?.topN, 10),
        typeof args?.locale === "string" ? args.locale : undefined,
      ),
    };
  }
  if (cmd === "delete_source_segment_code") {
    mockStore.sourceSegments = mockStore.sourceSegments.filter((segment) => segment.id !== args?.id);
    return { handled: true, result: undefined };
  }
  if (cmd === "get_coding_matrix") {
    const projectId = args?.projectId as string | undefined;
    const projectCodes = mockStore.codes.filter((code) => !projectId || code.projectId === projectId);
    const projectCodeIds = new Set(projectCodes.map((code) => commandString(code.id)));
    const projectSourceIds = new Set(
      mockStore.qualitativeSources
        .filter((source) => !projectId || source.projectId === projectId)
        .map((source) => source.id),
    );
    const matrixSegments = mockStore.sourceSegments.filter((segment) => projectSourceIds.has(segment.sourceId));
    const highlightById = new Map(
      mockStore.qualitativeSourceHighlights
        .filter((highlight) => projectSourceIds.has(highlight.sourceId))
        .map((highlight) => [highlight.id, highlight]),
    );
    const matrixHighlightAssignments = mockStore.sourceHighlightCodes.filter(
      (assignment) =>
        projectCodeIds.has(assignment.codeId) &&
        highlightById.has(assignment.sourceHighlightId),
    );
    const sourceIdsWithSegments = new Set(matrixSegments.map((segment) => segment.sourceId));
    for (const assignment of matrixHighlightAssignments) {
      const highlight = highlightById.get(assignment.sourceHighlightId);
      if (highlight) sourceIdsWithSegments.add(highlight.sourceId);
    }
    const cols = mockStore.qualitativeSources
      .filter((source) => sourceIdsWithSegments.has(source.id))
      .map((source) => ({ paperId: source.id, paperTitle: source.title }));
    const rows = projectCodes.map((code) => ({
      codeId: code.id,
      codeName: code.name,
      codeColor: code.color,
    }));
    const cells: Record<string, number> = {};
    for (const segment of matrixSegments) {
      const key = `${segment.codeId}:${segment.sourceId}`;
      cells[key] = (cells[key] ?? 0) + 1;
    }
    for (const assignment of matrixHighlightAssignments) {
      const highlight = highlightById.get(assignment.sourceHighlightId);
      if (!highlight) continue;
      const key = `${assignment.codeId}:${highlight.sourceId}`;
      cells[key] = (cells[key] ?? 0) + 1;
    }
    return { handled: true, result: { rows, cols, cells } };
  }

  // ── Qualitative Source Critiques ──
  if (cmd === "get_qual_source_critique") {
    const sourceId = args?.sourceId as string | undefined;
    const critique = mockStore.qualSourceCritiques.find((item) => item.sourceId === sourceId) ?? null;
    return { handled: true, result: critique };
  }
  if (cmd === "get_qual_source_critiques_by_project") {
    const projectId = args?.projectId as string | undefined;
    const sourceIds = new Set(
      mockStore.qualitativeSources
        .filter((source) => !projectId || source.projectId === projectId)
        .map((source) => source.id),
    );
    return {
      handled: true,
      result: mockStore.qualSourceCritiques.filter((critique) => sourceIds.has(critique.sourceId)),
    };
  }
  if (cmd === "upsert_qual_source_critique") {
    const input = isRecord(args?.dto) ? args.dto : commandInput(args);
    const sourceId = commandString(input.sourceId);
    const existing = mockStore.qualSourceCritiques.findIndex((critique) => critique.sourceId === sourceId);
    const critique = {
      id: existing >= 0 ? mockStore.qualSourceCritiques[existing].id : mockId(),
      sourceId,
      authorInfo: commandNullableString(input.authorInfo),
      creationDate: commandNullableString(input.creationDate),
      isDateEstimated: Boolean(input.isDateEstimated),
      location: commandNullableString(input.location),
      sourceType: commandNullableString(input.sourceType),
      authenticity: commandNullableString(input.authenticity),
      archiveInfo: commandNullableString(input.archiveInfo),
      intent: commandNullableString(input.intent),
      audience: commandNullableString(input.audience),
      biasLevel: commandNullableString(input.biasLevel),
      biasReason: commandNullableString(input.biasReason),
      consistency: commandNullableString(input.consistency),
      reliabilityScore: commandNumber(input.reliabilityScore, 3),
      researcherNotes: commandNullableString(input.researcherNotes),
      createdAt: existing >= 0 ? mockStore.qualSourceCritiques[existing].createdAt : now(),
      updatedAt: now(),
    };
    if (existing >= 0) {
      mockStore.qualSourceCritiques[existing] = critique;
    } else {
      mockStore.qualSourceCritiques.unshift(critique);
    }
    return { handled: true, result: { ...critique } };
  }
  if (cmd === "delete_qual_source_critique") {
    mockStore.qualSourceCritiques = mockStore.qualSourceCritiques.filter((critique) => critique.id !== args?.id);
    return { handled: true, result: undefined };
  }

  // ── Drafts ──
  if (cmd === "create_draft") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = (args ?? {}) as any;
    const draft = {
      id: mockId(),
      title: a.title ?? "New Draft",
      content: "",
      tags: [],
      paperId: null,
      isDraft: 1,
      draftMeta: JSON.stringify({ chapters: [] }),
      wordCount: 0,
      readingTimeMin: 0,
      createdAt: now(),
      updatedAt: now(),
    };
    mockStore.notes.unshift(draft);
    return { handled: true, result: { ...draft } };
  }
  if (cmd === "get_drafts") {
    const drafts = mockStore.notes.filter((n: Record<string, unknown>) => n.isDraft === 1);
    return { handled: true, result: [...drafts] };
  }

  // ── Highlights ──
  if (cmd === "get_highlights") {
    const paperId = commandString(args?.paperId ?? args?.paper_id);
    const result = paperId
      ? mockStore.highlights.filter((highlight) => highlight.paperId === paperId)
      : [...mockStore.highlights];
    return { handled: true, result };
  }
  if (cmd === "get_highlights_by_code") {
    const codeId = args?.codeId as string | undefined;
    const paperHighlights = codeId
      ? mockStore.highlights
          .filter((h: Record<string, unknown>) => (h.codeIds as string[] | undefined)?.includes(codeId))
          .map((highlight) => {
            const paper = mockStore.papers.find((item) => item.id === highlight.paperId);
            return { ...highlight, paperTitle: paper?.title ?? "" };
          })
      : [];
    const sourceHighlights = codeId
      ? mockStore.sourceHighlightCodes
          .filter((assignment) => assignment.codeId === codeId)
          .map((assignment) => {
            const highlight = mockStore.qualitativeSourceHighlights.find(
              (item) => item.id === assignment.sourceHighlightId,
            );
            if (!highlight) return null;
            const source = mockStore.qualitativeSources.find((item) => item.id === highlight.sourceId);
            return {
              ...highlight,
              paperTitle: source ? `${source.title} · 分析ソース` : "分析ソース",
            };
          })
          .filter(Boolean)
      : [];
    return { handled: true, result: [...paperHighlights, ...sourceHighlights] };
  }
  if (cmd === "create_highlight") {
    const a = commandInput(args);
    const hl = {
      id: mockId(),
      paperId: commandString(a.paperId),
      sourceId: null,
      text: commandNormalizedString(a.text),
      color: commandString(a.color, "yellow"),
      comment: commandNormalizedNullableString(a.comment),
      codeIds: Array.isArray(a.codeIds) ? a.codeIds : [],
      page: commandNumber(a.page, 1),
      rect: isRecord(a.rect) ? a.rect : { x1: 0, y1: 0, x2: 0, y2: 0 },
      createdAt: now(),
    };
    mockStore.highlights.push(hl);
    return { handled: true, result: { ...hl } };
  }
  if (cmd === "update_highlight_comment") {
    const id = commandString(args?.id);
    const highlight = mockStore.highlights.find((item) => item.id === id);
    if (highlight) {
      highlight.comment = commandNormalizedNullableString(args?.comment);
      return { handled: true, result: { ...highlight } };
    }
    return { handled: true, result: null };
  }
  if (cmd === "delete_highlight") {
    const id = commandString(args?.id);
    mockStore.highlights = mockStore.highlights.filter((highlight) => highlight.id !== id);
    return { handled: true, result: undefined };
  }
  if (cmd === "assign_code_to_highlight") {
    const highlightId = commandString(args?.highlightId ?? args?.highlight_id);
    const codeId = commandString(args?.codeId ?? args?.code_id);
    const highlight = mockStore.highlights.find((item) => item.id === highlightId);
    if (highlight && codeId) {
      const codeIds = new Set(Array.isArray(highlight.codeIds) ? highlight.codeIds : []);
      codeIds.add(codeId);
      highlight.codeIds = [...codeIds];
    }
    return { handled: true, result: undefined };
  }
  if (cmd === "remove_code_from_highlight") {
    const highlightId = commandString(args?.highlightId ?? args?.highlight_id);
    const codeId = commandString(args?.codeId ?? args?.code_id);
    const highlight = mockStore.highlights.find((item) => item.id === highlightId);
    if (highlight && Array.isArray(highlight.codeIds)) {
      highlight.codeIds = highlight.codeIds.filter((id: string) => id !== codeId);
    }
    return { handled: true, result: undefined };
  }
  if (cmd === "get_qualitative_source_highlights") {
    const sourceId = commandString(args?.sourceId ?? args?.source_id);
    const result = mockStore.qualitativeSourceHighlights.filter(
      (highlight) => !sourceId || highlight.sourceId === sourceId,
    );
    return { handled: true, result };
  }
  if (cmd === "create_qualitative_source_highlight") {
    const input = commandInput(args);
    const sourceId = commandString(input.sourceId);
    const highlight = {
      id: mockId(),
      paperId: sourceId,
      sourceId,
      text: commandNormalizedString(input.text),
      comment: commandNormalizedNullableString(input.comment),
      color: commandString(input.color, "yellow"),
      page: commandNumber(input.page, 1),
      rect: isRecord(input.rect) ? input.rect : { x1: 0, y1: 0, x2: 0, y2: 0 },
      createdAt: now(),
    };
    mockStore.qualitativeSourceHighlights.push(highlight);
    return { handled: true, result: { ...highlight } };
  }
  if (cmd === "update_qualitative_source_highlight_comment") {
    const id = commandString(args?.id);
    const highlight = mockStore.qualitativeSourceHighlights.find((item) => item.id === id);
    if (highlight) {
      highlight.comment = commandNormalizedNullableString(args?.comment);
      return { handled: true, result: { ...highlight } };
    }
    return { handled: true, result: null };
  }
  if (cmd === "delete_qualitative_source_highlight") {
    const id = commandString(args?.id);
    mockStore.qualitativeSourceHighlights = mockStore.qualitativeSourceHighlights.filter(
      (highlight) => highlight.id !== id,
    );
    mockStore.sourceHighlightCodes = mockStore.sourceHighlightCodes.filter(
      (assignment) => assignment.sourceHighlightId !== id,
    );
    return { handled: true, result: undefined };
  }
  if (cmd === "assign_code_to_source_highlight") {
    const highlightId = commandString(args?.highlightId ?? args?.highlight_id);
    const codeId = commandString(args?.codeId ?? args?.code_id);
    const exists = mockStore.sourceHighlightCodes.some(
      (assignment) => assignment.sourceHighlightId === highlightId && assignment.codeId === codeId,
    );
    if (!exists && highlightId && codeId) {
      mockStore.sourceHighlightCodes.push({
        id: mockId(),
        sourceHighlightId: highlightId,
        codeId,
        assignedAt: now(),
      });
    }
    return { handled: true, result: undefined };
  }
  if (cmd === "remove_code_from_source_highlight") {
    const highlightId = commandString(args?.highlightId ?? args?.highlight_id);
    const codeId = commandString(args?.codeId ?? args?.code_id);
    mockStore.sourceHighlightCodes = mockStore.sourceHighlightCodes.filter(
      (assignment) => assignment.sourceHighlightId !== highlightId || assignment.codeId !== codeId,
    );
    return { handled: true, result: undefined };
  }
  if (cmd === "create_note_from_source_highlights") {
    const sourceId = commandString(args?.sourceId ?? args?.source_id);
    const highlightIds = Array.isArray(args?.highlightIds)
      ? args.highlightIds
      : Array.isArray(args?.highlight_ids)
        ? args.highlight_ids
        : [];
    const idSet = new Set(highlightIds);
    const source = mockStore.qualitativeSources.find((item) => item.id === sourceId);
    const selected = mockStore.qualitativeSourceHighlights.filter(
      (highlight) => highlight.sourceId === sourceId && idSet.has(highlight.id),
    );
    const note = {
      id: mockId(),
      title: normalizeText(`${source?.title ?? "分析ソース"} のハイライト`),
      content: normalizeText(selected
        .map((highlight) => `> ${highlight.text}\n\n${highlight.comment ?? ""}`)
        .join("\n\n")),
      tags: ["qualitative-source"],
      paperId: null,
      isDraft: 0,
      draftMeta: "{}",
      wordCount: selected.reduce((sum, highlight) => sum + commandString(highlight.text).split(/\s+/).filter(Boolean).length, 0),
      readingTimeMin: 1,
      createdAt: now(),
      updatedAt: now(),
    };
    mockStore.notes.unshift(note);
    return { handled: true, result: note.id };
  }

  if (cmd === "generate_analysis_report") {
    return { handled: true, result: buildMockAnalysisReport(args) };
  }

  // ── Graph Data（動的生成）──
  /* eslint-disable @typescript-eslint/no-explicit-any */
  if (cmd === "get_graph_data") {
    // mockStore のノートと論文からグラフデータを動的に生成
    const normalizeTitle = (title: string) => title.trim().normalize("NFC").toLowerCase();
    const extractWikiLinks = (content: string): string[] => {
      const titles: string[] = [];
      const re = /\[\[([^\]]+)\]\]/g;
      let match: RegExpExecArray | null;
      while ((match = re.exec(content)) !== null) {
        const target = String(match[1] ?? "").split("|")[0]?.trim();
        if (target) titles.push(target);
      }
      return titles;
    };

    const nodes: any[] = [];
    const noteTitleToId = new Map<string, string>();
    const paperTitleToId = new Map<string, string>();

    for (const note of mockStore.notes) {
      if (note.isDraft === 1) continue; // 草稿は除外
      noteTitleToId.set(normalizeTitle(note.title || ""), note.id);
      nodes.push({
        id: note.id,
        name: note.title || "Untitled Note",
        type: "note",
        val: 1,
        tags: note.tags ?? [],
        updatedAt: note.updatedAt ?? "",
      });
    }
    for (const paper of mockStore.papers) {
      paperTitleToId.set(normalizeTitle(paper.title || ""), paper.id);
      nodes.push({
        id: paper.id,
        name: paper.title || "Untitled Paper",
        type: "paper",
        val: 1,
        tags: paper.tags ?? [],
        updatedAt: paper.updatedAt ?? "",
      });
    }

    const nodeIdSet = new Set(nodes.map((n: any) => n.id));
    const seen = new Set<string>();
    const links: any[] = [];
    const linkCounts = new Map<string, number>();
    const addLink = (id: string, source: string, target: string) => {
      if (!source || !target || source === target) return;
      if (!nodeIdSet.has(source) || !nodeIdSet.has(target)) return;
      const key = source < target ? `${source}|${target}` : `${target}|${source}`;
      if (seen.has(key)) return;
      seen.add(key);
      links.push({ id, source, target });
      linkCounts.set(source, (linkCounts.get(source) ?? 0) + 1);
      linkCounts.set(target, (linkCounts.get(target) ?? 0) + 1);
    };

    // 1. 明示的に作成されたリンク
    for (const link of mockStore.links as any[]) {
      addLink(link.id, link.sourceId, link.targetId);
    }

    // 2. ノートと論文の紐づけ
    for (const note of mockStore.notes as any[]) {
      if (note.isDraft === 1) continue;
      if (note.paperId) addLink(`paper-note:${note.id}:${note.paperId}`, note.id, note.paperId);
    }

    // 3. ノート本文の [[WikiLink]]
    for (const note of mockStore.notes as any[]) {
      if (note.isDraft === 1) continue;
      for (const title of extractWikiLinks(note.content ?? "")) {
        const key = normalizeTitle(title);
        const targetId = noteTitleToId.get(key) ?? paperTitleToId.get(key);
        if (targetId) addLink(`wikilink:${note.id}:${targetId}`, note.id, targetId);
      }
    }

    for (const node of nodes) {
      const count = linkCounts.get(node.id) ?? 0;
      node.linkCount = count;
      node.val = Math.max(1, count);
    }

    return { handled: true, result: { nodes, links } };
  }

  // ── Links CRUD ──
  if (cmd === "create_link") {
    const a = ((args as any)?.input ?? args ?? {}) as any;
    const link = {
      id: mockId(),
      sourceId: a.sourceId ?? a.source_id ?? "",
      sourceType: a.sourceType ?? a.source_type ?? "note",
      targetId: a.targetId ?? a.target_id ?? "",
      targetType: a.targetType ?? a.target_type ?? "note",
      context: a.context ?? null,
      createdAt: now(),
    };
    mockStore.links.push(link);
    return { handled: true, result: { ...link } };
  }
  if (cmd === "delete_link") {
    mockStore.links = mockStore.links.filter((l: any) => l.id !== args?.id);
    return { handled: true, result: undefined };
  }
  if (cmd === "get_backlinks") {
    const itemId = (args?.itemId ?? args?.item_id ?? "") as string;
    // タイトルをストアから解決するヘルパー
    const resolveTitle = (id: string, type: string): string => {
      if (type === "note") {
        const note = mockStore.notes.find((n: any) => n.id === id);
        return note?.title || "Untitled Note";
      }
      const paper = mockStore.papers.find((p: any) => p.id === id);
      return paper?.title || "Untitled Paper";
    };
    const result = mockStore.links
      .filter((l: any) => l.sourceId === itemId || l.targetId === itemId)
      .map((l: any) => ({
        id: l.id,
        sourceId: l.sourceId,
        sourceType: l.sourceType,
        sourceTitle: resolveTitle(l.sourceId, l.sourceType),
        targetId: l.targetId,
        targetType: l.targetType,
        targetTitle: resolveTitle(l.targetId, l.targetType),
        context: l.context,
        createdAt: l.createdAt,
      }));
    return { handled: true, result };
  }

  // ── Citations（草稿引用）──
  if (cmd === "insert_citation") {
    const a = ((args as any)?.input ?? args ?? {}) as any;
    const noteId = a.noteId ?? "";
    const paperId = a.paperId ?? "";
    const style = a.citationStyle ?? "apa7";
    const pageRef = a.pageRef ?? null;
    const paper = mockStore.papers.find((p: any) => p.id === paperId);
    if (!paper) return { handled: true, result: null };
    const authorLast = (paper.authors?.[0] ?? "Unknown").split(" ").pop() ?? "Unknown";
    const yearStr = paper.year ? String(paper.year) : "n.d.";
    const citationKey = `${authorLast}${yearStr}`;
    const authorsStr = paper.authors?.join(", ") ?? "Unknown";
    let citationText: { inlineText: string; bibliographyText: string };
    if (style === "apa7") {
      citationText = {
        inlineText: pageRef ? `(${authorLast}, ${yearStr}, ${pageRef})` : `(${authorLast}, ${yearStr})`,
        bibliographyText: `${authorsStr} (${yearStr}). ${paper.title}.${paper.journal ? " " + paper.journal + "." : ""}`,
      };
    } else if (style === "mla9") {
      citationText = {
        inlineText: pageRef ? `(${authorLast} ${pageRef})` : `(${authorLast})`,
        bibliographyText: `${authorsStr}. "${paper.title}."${paper.journal ? " " + paper.journal + "," : ""} ${yearStr}.`,
      };
    } else if (style === "chicago17") {
      citationText = {
        inlineText: pageRef ? `(${authorLast} ${yearStr}, ${pageRef})` : `(${authorLast} ${yearStr})`,
        bibliographyText: `${authorsStr}. ${paper.title}.${paper.journal ? " " + paper.journal : ""}, ${yearStr}.`,
      };
    } else {
      citationText = {
        inlineText: pageRef ? `(${authorLast} ${yearStr}: ${pageRef})` : `(${authorLast} ${yearStr})`,
        bibliographyText: `${authorsStr}『${paper.title}』${paper.journal ? paper.journal + "、" : ""}${yearStr}年。`,
      };
    }
    const citation = {
      id: mockId(),
      noteId,
      paperId,
      citationKey,
      citationStyle: style,
      inlineText: citationText.inlineText,
      bibliographyText: citationText.bibliographyText,
      pageRef,
      createdAt: now(),
    };
    if (!(mockStore as any).citations) (mockStore as any).citations = [];
    (mockStore as any).citations.push(citation);
    return { handled: true, result: { ...citation } };
  }
  if (cmd === "get_citations_for_note") {
    const noteId = (args?.noteId ?? "") as string;
    const citations = ((mockStore as any).citations ?? []).filter((c: any) => c.noteId === noteId);
    return { handled: true, result: [...citations] };
  }
  if (cmd === "delete_citation") {
    const id = (args?.id ?? "") as string;
    if ((mockStore as any).citations) {
      (mockStore as any).citations = (mockStore as any).citations.filter((c: any) => c.id !== id);
    }
    return { handled: true, result: undefined };
  }
  if (cmd === "generate_bibliography") {
    const noteId = (args?.noteId ?? "") as string;
    const citations = ((mockStore as any).citations ?? []).filter((c: any) => c.noteId === noteId);
    if (citations.length === 0) return { handled: true, result: "" };
    const seen = new Set<string>();
    const entries = citations
      .sort((a: any, b: any) => String(a.citationKey).localeCompare(String(b.citationKey)))
      .filter((citation: any) => {
        if (seen.has(citation.paperId)) return false;
        seen.add(citation.paperId);
        return true;
      })
      .map((citation: any) => `- ${citation.bibliographyText}`);
    const bib = `## References\n\n${entries.join("\n")}`;
    return { handled: true, result: bib };
  }

  // ── Stellar Package（ブラウザプレビュー用）──
  if (cmd === "export_stellar_package") {
    const paperIds = ((args?.paperIds ?? []) as string[]).filter(Boolean);
    const noteIds = ((args?.noteIds ?? []) as string[]).filter(Boolean);
    const includePdfs = Boolean(args?.includePdfs);
    const papers = mockStore.papers.filter((p: any) => paperIds.includes(p.id));
    const notes = mockStore.notes.filter((n: any) => noteIds.includes(n.id));
    const linkedIds = new Set([...paperIds, ...noteIds]);
    const highlights = mockStore.highlights.filter((h: any) => linkedIds.has(h.paperId));
    const links = mockStore.links.filter((l: any) => linkedIds.has(l.sourceId) || linkedIds.has(l.targetId));
    const sizeBytes = Math.max(512, JSON.stringify({ papers, notes, highlights, links }).length);
    const manifest = {
      version: "1.0.0",
      createdAt: now(),
      paperCount: papers.length,
      noteCount: notes.length,
      highlightCount: highlights.length,
      linkCount: links.length,
      hasPdfs: includePdfs,
      fileSizeBytes: sizeBytes,
    };
    return {
      handled: true,
      result: {
        path: (args?.outputPath ?? "/mock/export/package.stellar") as string,
        sizeBytes,
        manifest,
      },
    };
  }

  if (cmd === "inspect_stellar_package") {
    const sizeBytes = Math.max(512, JSON.stringify(mockStore).length);
    return {
      handled: true,
      result: {
        version: "1.0.0",
        createdAt: now(),
        paperCount: mockStore.papers.length,
        noteCount: mockStore.notes.length,
        highlightCount: mockStore.highlights.length,
        linkCount: mockStore.links.length,
        hasPdfs: mockStore.papers.some((p: any) => Boolean(p.pdfPath)),
        fileSizeBytes: sizeBytes,
      },
    };
  }

  if (cmd === "import_stellar_package") {
    return {
      handled: true,
      result: {
        papersImported: 0,
        notesImported: 0,
        highlightsImported: 0,
        linksImported: 0,
        pdfsExtracted: 0,
        conflicts: [],
      },
    };
  }

  // ── データ移行コマンド（Zotero / Obsidian / BibTeX / RIS）──
  if (cmd === "preview_import_file") {
    return {
      handled: true,
      result: {
        entries: [
          { title: "[Preview] Sample BibTeX Article", authors: ["Author A", "Author B"], year: 2023, journal: "Journal of Examples", volume: "1", issue: "2", pages: "10-20", doi: "10.1234/example", url: null, abstract: "This is a sample abstract.", tags: ["sample", "preview"], entryType: "article" },
          { title: "[Preview] Another Reference", authors: ["Author C"], year: 2022, journal: "Sample Journal", volume: null, issue: null, pages: null, doi: null, url: "https://example.com", abstract: null, tags: [], entryType: "inproceedings" },
        ],
        notes: [],
        formatDetected: "bibtex",
        totalCount: 2,
      },
    };
  }

  if (cmd === "preview_obsidian_vault") {
    return {
      handled: true,
      result: {
        entries: [],
        notes: [
          { title: "[Preview] Research Notes", content: "# Research Notes\n\nSample content with [[WikiLink]].", tags: ["research", "preview"], sourcePath: "Research Notes.md" },
          { title: "[Preview] Meeting Minutes", content: "# Meeting\n\nDiscussion about methodology.", tags: ["meeting"], sourcePath: "meetings/Meeting Minutes.md" },
        ],
        formatDetected: "obsidian",
        totalCount: 2,
      },
    };
  }

  if (cmd === "import_references_file") {
    return {
      handled: true,
      result: {
        papersImported: 2,
        notesImported: 0,
        papersSkipped: 0,
        notesSkipped: 0,
        errors: [],
      },
    };
  }

  if (cmd === "import_obsidian_vault") {
    return {
      handled: true,
      result: {
        papersImported: 0,
        notesImported: 2,
        papersSkipped: 0,
        notesSkipped: 0,
        errors: [],
      },
    };
  }

  // ── Citation Network（動的生成）──
  if (cmd === "fetch_citation_network") {
    const paperId = (args?.paperId ?? "") as string;
    // シードデータに基づいたサンプル参照文献・被引用文献を生成
    const references = [
      { ssPaperId: "mock-ref-001", title: "[Preview mock] Social Capital: A Multifaceted Perspective", authors: ["Dasgupta, P.", "Serageldin, I."], year: 2000, doi: "10.1596/0-8213-4562-1", url: null, citationCount: 342 },
      { ssPaperId: "mock-ref-002", title: "[Preview mock] The Forms of Capital", authors: ["Bourdieu, P."], year: 1986, doi: null, url: "https://example.com/bourdieu1986", citationCount: 5210 },
      { ssPaperId: "mock-ref-003", title: "[Preview mock] Trust: The Social Virtues and the Creation of Prosperity", authors: ["Fukuyama, F."], year: 1995, doi: null, url: null, citationCount: 1820 },
    ];
    const citedBy = [
      { ssPaperId: "mock-cite-001", title: "[Preview mock] Community and Social Capital in the Digital Age", authors: ["Wellman, B.", "Haase, A."], year: 2019, doi: "10.1177/0002764219876543", url: null, citationCount: 78 },
      { ssPaperId: "mock-cite-002", title: "[Preview mock] Bridging and Bonding Social Capital Revisited", authors: ["Claridge, T."], year: 2020, doi: null, url: "https://example.com/claridge2020", citationCount: 45 },
    ];
    return {
      handled: true,
      result: {
        paperId,
        references,
        citedBy,
        fetchedAt: new Date().toISOString(),
      },
    };
  }

  if (cmd === "fetch_recommendations") {
    // シードデータに基づいたレコメンデーションを生成
    const recs = [
      { id: "mock-rec-001", title: "[Preview mock] Making Democracy Work: Civic Traditions in Modern Italy", authors: JSON.stringify(["Robert D. Putnam", "Robert Leonardi", "Raffaella Y. Nanetti"]), year: 1993, doi: "10.1515/9781400820740", url: null, abstract: "This browser-preview item is mock data. The Tauri app fetches real recommendations from Semantic Scholar.", relevanceScore: 0.92, isImported: 0 },
      { id: "mock-rec-002", title: "[Preview mock] The Logic of Collective Action: Public Goods and the Theory of Groups", authors: JSON.stringify(["Mancur Olson"]), year: 1965, doi: null, url: "https://example.com/olson1965", abstract: "This browser-preview item is mock data. The Tauri app fetches real recommendations from Semantic Scholar.", relevanceScore: 0.85, isImported: 0 },
      { id: "mock-rec-003", title: "[Preview mock] Social Capital in the Creation of Human Capital", authors: JSON.stringify(["James S. Coleman"]), year: 1988, doi: "10.1086/228943", url: null, abstract: "This browser-preview item is mock data. The Tauri app fetches real recommendations from Semantic Scholar.", relevanceScore: 0.78, isImported: 0 },
    ];
    return { handled: true, result: recs };
  }

  if (cmd === "get_recommendations") {
    // キャッシュ済みレコメンデーション（まだ取得していなければ空配列）
    return { handled: true, result: [] };
  }

  if (cmd === "import_recommendation") {
    // import_recommendation: モック環境では何もせず null を返す
    return { handled: true, result: null };
  }

  if (cmd === "export_bibtex") {
    const paperIds = (args?.paperIds ?? []) as string[];
    const entries: string[] = [];
    for (const pid of paperIds) {
      const paper = mockStore.papers.find((p: any) => p.id === pid);
      if (!paper) continue;
      const authorLast = (paper.authors?.[0] ?? "Unknown").split(" ").pop() ?? "Unknown";
      const key = `${authorLast}${paper.year ?? "nd"}`;
      entries.push(`@article{${key},\n  title = {${paper.title}},\n  author = {${(paper.authors ?? []).join(" and ")}},\n  year = {${paper.year ?? ""}},\n  journal = {${paper.journal ?? ""}},\n  doi = {${paper.doi ?? ""}}\n}`);
    }
    return { handled: true, result: entries.join("\n\n") || "% No papers selected" };
  }

  if (cmd === "export_ris") {
    const paperIds = (args?.paperIds ?? []) as string[];
    const entries: string[] = [];
    for (const pid of paperIds) {
      const paper = mockStore.papers.find((p: any) => p.id === pid);
      if (!paper) continue;
      const lines = [
        "TY  - JOUR",
        `TI  - ${paper.title}`,
        ...(paper.authors ?? []).map((a: string) => `AU  - ${a}`),
        `PY  - ${paper.year ?? ""}`,
        `JO  - ${paper.journal ?? ""}`,
        `DO  - ${paper.doi ?? ""}`,
        "ER  - ",
      ];
      entries.push(lines.join("\n"));
    }
    return { handled: true, result: entries.join("\n\n") || "" };
  }

  if (cmd === "get_citation_graph_data") {
    // 引用グラフ: mockStore の論文間リンクからグラフを生成
    const graphNodes = mockStore.papers.map((p: any) => ({
      id: p.id,
      label: p.title || "Untitled",
      type: "paper",
    }));
    const graphEdges = mockStore.links
      .filter((l: any) => l.sourceType === "paper" && l.targetType === "paper")
      .map((l: any) => ({ source: l.sourceId, target: l.targetId }));
    return { handled: true, result: { nodes: graphNodes, edges: graphEdges } };
  }

  // ── Link Suggestions（リンクサジェスト）──
  if (cmd === "get_link_suggestions") {
    const query = (args?.query ?? "") as string;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      const notes = mockStore.notes
        .filter((n: any) => n.isDraft !== 1 && String(n.title ?? "").toLowerCase().includes(q))
        .slice(0, 10)
        .map((n: any) => ({
          id: n.id,
          type: "note",
          title: n.title || "Untitled Note",
          detail: (n.tags ?? []).length > 0 ? `ノート - ${(n.tags ?? []).join(", ")}` : "ノート",
        }));
      const papers = mockStore.papers
        .filter((p: any) => String(p.title ?? "").toLowerCase().includes(q))
        .slice(0, 10)
        .map((p: any) => {
          const authors = (p.authors ?? []).slice(0, 2).join(", ");
          return {
            id: p.id,
            type: "paper",
            title: p.title || "Untitled Paper",
            detail: authors && p.year ? `${authors} (${p.year})` : authors || (p.year ? `論文 (${p.year})` : "論文"),
          };
        });
      return { handled: true, result: [...notes, ...papers].slice(0, 10) };
    }

    const itemId = (args?.itemId ?? args?.item_id ?? "") as string;
    const itemType = (args?.itemType ?? args?.item_type ?? "note") as string;
    const linkedIds = new Set<string>();
    for (const l of mockStore.links as any[]) {
      if (l.sourceId === itemId) linkedIds.add(l.targetId);
      if (l.targetId === itemId) linkedIds.add(l.sourceId);
    }
    linkedIds.add(itemId);
    const currentItem = itemType === "note"
      ? mockStore.notes.find((n: any) => n.id === itemId)
      : mockStore.papers.find((p: any) => p.id === itemId);
    const currentTags = new Set<string>(currentItem?.tags ?? []);
    const candidates: { id: string; type: string; title: string; detail: string; score: number; reason: string }[] = [];
    for (const note of mockStore.notes) {
      if (linkedIds.has(note.id) || note.isDraft === 1) continue;
      const overlap = (note.tags ?? []).filter((t: string) => currentTags.has(t));
      if (overlap.length > 0) {
        const reasonLabel = useI18nStore.getState().t.library.k_shared_tags ?? "Shared tags";
        candidates.push({
          id: note.id, type: "note", title: note.title || "Untitled Note",
          detail: "ノート", score: overlap.length, reason: `${reasonLabel}: ${overlap.join(", ")}`,
        });
      }
    }
    for (const paper of mockStore.papers) {
      if (linkedIds.has(paper.id)) continue;
      const overlap = (paper.tags ?? []).filter((t: string) => currentTags.has(t));
      if (overlap.length > 0) {
        const reasonLabel = useI18nStore.getState().t.library.k_shared_tags ?? "Shared tags";
        candidates.push({
          id: paper.id, type: "paper", title: paper.title || "Untitled Paper",
          detail: paper.year ? `論文 (${paper.year})` : "論文", score: overlap.length, reason: `${reasonLabel}: ${overlap.join(", ")}`,
        });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    return { handled: true, result: candidates.slice(0, 5) };
  }

  if (cmd === "resolve_wikilink") {
    const title = String(args?.title ?? "").trim().normalize("NFC").toLowerCase();
    const note = mockStore.notes.find((n: any) => n.isDraft !== 1 && String(n.title ?? "").trim().normalize("NFC").toLowerCase() === title);
    if (note) return { handled: true, result: { id: note.id, itemType: "note" } };
    const paper = mockStore.papers.find((p: any) => String(p.title ?? "").trim().normalize("NFC").toLowerCase() === title);
    if (paper) return { handled: true, result: { id: paper.id, itemType: "paper" } };
    return { handled: true, result: null };
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // ── メタデータ取得（ブラウザ開発用モック）──
  // 実環境では Rust 側の CrossRef API / HTML スクレイピングが動くが、
  // ブラウザプレビューではサンプルデータを返す
  if (cmd === "fetch_metadata_by_doi") {
    const doi = (args?.doi ?? "") as string;
    if (!doi) return { handled: true, result: {} };
    // DOI からそれらしいモックメタデータを生成
    const mockMeta = {
      title: `[Mock] Article for DOI: ${doi}`,
      authors: ["Mock Author A", "Mock Author B"],
      year: 2024,
      journal: "Mock Journal of Research",
      volume: "12",
      issue: "3",
      pages: "100-115",
      doi: doi,
      url: `https://doi.org/${doi}`,
      abstract: `This is a mock abstract for the paper with DOI ${doi}. In a real Tauri environment, this would be fetched from the CrossRef API.`,
    };
    return { handled: true, result: mockMeta };
  }

  if (cmd === "fetch_metadata_from_url") {
    const url = (args?.url ?? "") as string;
    if (!url) return { handled: true, result: {} };
    // URL からそれらしいモックメタデータを生成
    const hostname = (() => { try { return new URL(url).hostname; } catch { return "unknown"; } })();
    const siteNames: Record<string, string> = {
      "www.jstage.jst.go.jp": "J-Stage",
      "jstage.jst.go.jp": "J-Stage",
      "www.sciencedirect.com": "ScienceDirect",
      "www.tandfonline.com": "Taylor & Francis Online",
      "www.jstor.org": "JSTOR",
      "journals.co.za": "Sabinet African Journals",
      "irdb.nii.ac.jp": "IRDB",
      "cir.nii.ac.jp": "CiNii Research",
      "www.scielo.br": "SciELO Brazil",
      "www.scielo.org.mx": "SciELO Mexico",
      "arxiv.org": "arXiv",
      "pubmed.ncbi.nlm.nih.gov": "PubMed",
      "link.springer.com": "Springer",
      "www.nature.com": "Nature",
    };
    const siteName = siteNames[hostname] || hostname;
    // J-Stage / arXiv 等の場合は PDF URL をモック生成
    let mockPdfUrl: string | null = null;
    if (hostname.includes("jstage.jst.go.jp")) {
      // J-Stage の PDF URL パターン: /article/{journal}/{vol}/{issue}/{page}/_pdf
      mockPdfUrl = url.replace(/\/_article.*$/, "/_pdf/-char/ja");
    } else if (hostname === "arxiv.org") {
      mockPdfUrl = url.replace("/abs/", "/pdf/") + ".pdf";
    }
    const mockMeta = {
      title: `[Mock] Sample Article from ${siteName}`,
      authors: ["Sample Author"],
      year: 2024,
      journal: `${siteName} Journal`,
      volume: "5",
      issue: "1",
      pages: "1-20",
      doi: "10.1234/mock.2024.001",
      url: url,
      abstract: `This is a mock abstract for a paper fetched from ${siteName} (${url}). In a real Tauri environment, the Rust backend would scrape metadata from the actual page using site-specific strategies.`,
      pdfUrl: mockPdfUrl,
    };
    return { handled: true, result: mockMeta };
  }

  // ── PDF ダウンロード（モック） ──
  if (cmd === "download_pdf_from_url") {
    const paperId = (args?.paperId ?? args?.paper_id ?? "unknown") as string;
    const pdfUrl = (args?.pdfUrl ?? args?.pdf_url ?? "") as string;
    console.info(`[tauriShim] Mock download_pdf_from_url: paperId=${paperId}, pdfUrl=${pdfUrl}`);
    // モック環境ではダミーのファイルパスを返す
    const shortId = paperId.substring(0, 8);
    const mockPath = `/mock/pdfs/${shortId}_${Date.now()}.pdf`;
    return { handled: true, result: mockPath };
  }

  if (cmd === "extract_metadata_from_pdf") {
    const pdfPath = (args?.pdf_path ?? args?.pdfPath ?? "/mock/sample.pdf") as string;
    const fileName = pdfPath.split("/").pop()?.replace(".pdf", "") ?? "Sample Paper";
    const mockMeta = {
      title: fileName.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
      authors: ["Author A"],
      year: 2024,
      abstract: null,
      pdfPath: pdfPath,
      tags: [],
    };
    return { handled: true, result: mockMeta };
  }

  // ── クラウドバックアップ mock ──
  if (cmd === "cloud_backup_get_status") {
    return { handled: true, result: {
      isConfigured: false, deviceId: null, recoveryCode: null,
      autoBackupEnabled: false, lastBackupAt: null, apiUrl: "https://stellar-backup.workers.dev",
    }};
  }
  if (cmd === "cloud_backup_setup") {
    const deviceId = `mock-${Date.now()}`;
    return { handled: true, result: {
      isConfigured: true, deviceId, recoveryCode: "ABCD-EFGH-JKLM",
      autoBackupEnabled: false, lastBackupAt: null, apiUrl: "https://stellar-backup.workers.dev",
    }};
  }
  if (cmd === "cloud_backup_create") {
    return { handled: true, result: {
      success: true, backupId: `backup_mock_${Date.now()}`,
      backedUpAt: new Date().toISOString(), sizeBytes: 12345,
      summary: { paperCount: 0, noteCount: 0, highlightCount: 0, linkCount: 0 },
    }};
  }
  if (cmd === "cloud_backup_list") {
    return { handled: true, result: { backups: [], totalCount: 0 } };
  }
  if (cmd === "cloud_backup_restore") {
    return { handled: true, result: {
      success: true, papersRestored: 0, notesRestored: 0,
      highlightsRestored: 0, linksRestored: 0, restoredAt: new Date().toISOString(),
    }};
  }
  if (cmd === "cloud_backup_recover") {
    return { handled: true, result: {
      isConfigured: true, deviceId: "mock-recovered", recoveryCode: args?.recoveryCode ?? "",
      autoBackupEnabled: false, lastBackupAt: null, apiUrl: "https://stellar-backup.workers.dev",
    }};
  }
  if (cmd === "cloud_backup_toggle_auto") {
    return { handled: true, result: {
      isConfigured: true, deviceId: "mock", recoveryCode: "ABCD-EFGH-JKLM",
      autoBackupEnabled: !!args?.enabled, lastBackupAt: null, apiUrl: "https://stellar-backup.workers.dev",
    }};
  }
  if (cmd === "cloud_backup_set_api_url") {
    return { handled: true, result: {
      isConfigured: true, deviceId: "mock", recoveryCode: "ABCD-EFGH-JKLM",
      autoBackupEnabled: false, lastBackupAt: null, apiUrl: (args?.apiUrl as string) ?? "https://stellar-backup.workers.dev",
    }};
  }

  return { handled: false };
}

// ── 初期シードデータ（非 Tauri 環境でのブラウザプレビュー用）────
// グラフビュー等が空にならないように最小限のデモデータを投入
if (!hasTauriRuntime()) {
  const seedNotes = [
    { id: "seed-note-001", title: "研究ノート: 社会関係資本の理論的枠組み", content: "Putnam (2000) の議論を整理する…", tags: ["theory", "social-capital"], isDraft: 0, draftMeta: "{}", wordCount: 320, readingTimeMin: 2, createdAt: "2025-04-01T10:00:00Z", updatedAt: "2025-04-15T08:30:00Z" },
    { id: "seed-note-002", title: "フィールドワーク記録 (2025-03)", content: "インタビュー結果のまとめ…", tags: ["fieldwork", "interview"], isDraft: 0, draftMeta: "{}", wordCount: 580, readingTimeMin: 3, createdAt: "2025-03-20T14:00:00Z", updatedAt: "2025-04-10T11:00:00Z" },
    { id: "seed-note-003", title: "方法論メモ: 質的比較分析 (QCA)", content: "Ragin (1987) の手法を検討…", tags: ["methodology", "QCA"], isDraft: 0, draftMeta: "{}", wordCount: 410, readingTimeMin: 2, createdAt: "2025-03-15T09:00:00Z", updatedAt: "2025-04-12T16:00:00Z" },
    { id: "seed-note-004", title: "文献レビュー草案", content: "先行研究の概観…", tags: ["review"], isDraft: 0, draftMeta: "{}", wordCount: 750, readingTimeMin: 4, createdAt: "2025-02-28T10:00:00Z", updatedAt: "2025-04-08T09:00:00Z" },
    { id: "seed-note-005", title: "制度論とガバナンス", content: "North (1990) の制度概念…", tags: ["theory", "institution"], isDraft: 0, draftMeta: "{}", wordCount: 290, readingTimeMin: 2, createdAt: "2025-04-05T13:00:00Z", updatedAt: "2025-04-18T10:00:00Z" },
  ];
  const seedPapers = [
    { id: "seed-paper-001", title: "Bowling Alone: The Collapse and Revival of American Community", authors: ["Robert D. Putnam"], year: 2000, journal: "Journal of Democracy", doi: "10.1353/jod.2000.0016", url: "https://doi.org/10.1353/jod.2000.0016", abstract: "An exploration of declining social capital in America.", pdfPath: null, tags: ["social-capital", "theory"], createdAt: "2025-03-01T10:00:00Z", updatedAt: "2025-03-01T10:00:00Z" },
    { id: "seed-paper-002", title: "The Comparative Method: Moving Beyond Qualitative and Quantitative Strategies", authors: ["Charles C. Ragin"], year: 1987, journal: "University of California Press", doi: "10.2307/2069712", url: "https://doi.org/10.2307/2069712", abstract: "Introduction of QCA methodology.", pdfPath: null, tags: ["methodology", "QCA"], createdAt: "2025-03-05T10:00:00Z", updatedAt: "2025-03-05T10:00:00Z" },
    { id: "seed-paper-003", title: "Institutions, Institutional Change and Economic Performance", authors: ["Douglass C. North"], year: 1990, journal: "Cambridge University Press", doi: "10.1017/CBO9780511808678", url: "https://doi.org/10.1017/CBO9780511808678", abstract: "A framework for analyzing institutions.", pdfPath: null, tags: ["theory", "institution"], createdAt: "2025-03-10T10:00:00Z", updatedAt: "2025-03-10T10:00:00Z" },
    { id: "seed-paper-004", title: "Governing the Commons", authors: ["Elinor Ostrom"], year: 1990, journal: "Cambridge University Press", doi: "10.1017/CBO9780511807763", url: "https://doi.org/10.1017/CBO9780511807763", abstract: "The Evolution of Institutions for Collective Action.", pdfPath: null, tags: ["institution", "commons"], createdAt: "2025-03-12T10:00:00Z", updatedAt: "2025-03-12T10:00:00Z" },
  ];
  const seedLinks = [
    { id: "seed-link-001", sourceId: "seed-note-001", sourceType: "note", targetId: "seed-paper-001", targetType: "paper", context: null, createdAt: "2025-04-01T10:00:00Z" },
    { id: "seed-link-002", sourceId: "seed-note-003", sourceType: "note", targetId: "seed-paper-002", targetType: "paper", context: null, createdAt: "2025-04-01T10:00:00Z" },
    { id: "seed-link-003", sourceId: "seed-note-005", sourceType: "note", targetId: "seed-paper-003", targetType: "paper", context: null, createdAt: "2025-04-05T13:00:00Z" },
    { id: "seed-link-004", sourceId: "seed-note-005", sourceType: "note", targetId: "seed-paper-004", targetType: "paper", context: null, createdAt: "2025-04-05T13:00:00Z" },
    { id: "seed-link-005", sourceId: "seed-note-001", sourceType: "note", targetId: "seed-note-004", targetType: "note", context: null, createdAt: "2025-04-08T09:00:00Z" },
    { id: "seed-link-006", sourceId: "seed-note-004", sourceType: "note", targetId: "seed-paper-001", targetType: "paper", context: null, createdAt: "2025-04-08T09:00:00Z" },
    { id: "seed-link-007", sourceId: "seed-note-004", sourceType: "note", targetId: "seed-paper-003", targetType: "paper", context: null, createdAt: "2025-04-08T09:00:00Z" },
    { id: "seed-link-008", sourceId: "seed-note-002", sourceType: "note", targetId: "seed-note-001", targetType: "note", context: null, createdAt: "2025-04-10T11:00:00Z" },
    { id: "seed-link-009", sourceId: "seed-paper-003", sourceType: "paper", targetId: "seed-paper-004", targetType: "paper", context: null, createdAt: "2025-04-12T10:00:00Z" },
  ];
  mockStore.notes.push(...seedNotes);
  mockStore.papers.push(...seedPapers);
  mockStore.links.push(...seedLinks);
  mockIdCounter = 100; // シードID と衝突しないようにカウンタを進める
}

// ── 静的フォールバック（動的ハンドラ非対応コマンド用）────
// 動的ハンドラで処理されるコマンドはここに含めない。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MOCK_RESPONSES: Record<string, any> = {
  // Library — PDF/metadata helpers
  attach_pdf: null,
  import_pdf: null,
  // fetch_metadata_by_doi, fetch_metadata_from_url, extract_metadata_from_pdf
  // → 動的ハンドラで処理（handleDynamic 参照）
  get_recent_items: [],

  // Notes — attachment helper
  save_note_attachment: null,

  // Highlights — helpers (main CRUD is in dynamic handler)
  update_highlight_comment: undefined,
  delete_highlight: undefined,
  create_note_from_highlights: "",
  assign_code_to_highlight: undefined,
  remove_code_from_highlight: undefined,

  // Links (CRUD + suggestions は動的ハンドラで処理)
  // get_link_suggestions → 動的ハンドラで処理

  // Search
  full_text_search: { papers: [], notes: [], highlights: [] },

  // Qualitative — Coding Matrix
  get_coding_matrix: { rows: [], cols: [], cells: {} },

  // Qualitative — Sources
  get_qualitative_sources: [],
  get_qualitative_source: null,
  import_qualitative_source: null,
  update_qualitative_source: null,
  delete_qualitative_source: undefined,
  assign_code_to_source_segment: null,
  get_source_segments: [],
  get_source_segments_by_code: [],
  analyze_cooccurrence: [],
  delete_source_segment_code: undefined,

  // Qualitative — Source Critique
  get_source_critiques: [],
  get_source_critiques_by_project: [],
  get_source_critique: null,
  create_source_critique: null,
  update_source_critique: null,
  upsert_source_critique: null,
  delete_source_critique: undefined,
  get_qual_source_critique: null,
  upsert_qual_source_critique: null,
  get_qual_source_critiques_by_project: [],
  delete_qual_source_critique: undefined,

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
  get_pt_data: { hypotheses: [] },
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
  get_framing_matrix: { frames: [], papers: [], counts: {} },
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

  // Draft Mode (dynamic handler handles create_draft/get_drafts/citations)
  get_draft_chapters: [],
  create_draft_chapter: null,
  update_draft_chapter: null,
  delete_draft_chapter: undefined,
  reorder_draft_chapters: undefined,
  // insert_citation, get_citations_for_note, delete_citation, generate_bibliography
  // → 動的ハンドラで処理
  sync_word_count: undefined,

  // PDF metadata extraction
  // extract_metadata_from_pdf → 動的ハンドラで処理

  // Export / Import
  export_static_site: "/mock/export/static-site",
  export_stellar_package: { path: "/mock/export/package.stellar", sizeBytes: 0 },
  inspect_stellar_package: { version: "1.0.0", createdAt: new Date().toISOString(), paperCount: 0, noteCount: 0, highlightCount: 0, linkCount: 0, hasPdfs: false, fileSizeBytes: 0 },
  import_stellar_package: { papersImported: 0, notesImported: 0, highlightsImported: 0, linksImported: 0, pdfsExtracted: 0, conflicts: [] },

  // Data Migration (Zotero / Obsidian / BibTeX / RIS)
  // preview_import_file → 動的ハンドラで処理
  // preview_obsidian_vault → 動的ハンドラで処理
  // import_references_file → 動的ハンドラで処理
  // import_obsidian_vault → 動的ハンドラで処理

  // Citation Network
  // fetch_citation_network → 動的ハンドラで処理
  // fetch_recommendations → 動的ハンドラで処理
  // get_recommendations → 動的ハンドラで処理
  // import_recommendation → 動的ハンドラで処理
  // export_bibtex → 動的ハンドラで処理
  // export_ris → 動的ハンドラで処理
  // get_citation_graph_data → 動的ハンドラで処理
  update_reading_status: undefined,
  get_reading_status_counts: { unread: 0, reading: 0, done: 0, revisit: 0 },
};

/**
 * 安全な invoke ラッパー。
 * Tauri 環境では本物の invoke を呼び、非 Tauri 環境ではモックデータを返す。
 */
export async function invoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!hasTauriRuntime()) {
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

  // Tauri 環境: 本物の invoke を呼ぶ（タイムアウト付き）
  const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
  const COMMAND_TIMEOUTS: Record<string, number> = {
    fetch_citation_network: 45000,
    fetch_recommendations: 45000,
    fetch_metadata_by_doi: 45000,
    fetch_metadata_from_url: 45000,
    download_pdf_from_url: 120000,
  };
  const TIMEOUT_MS = COMMAND_TIMEOUTS[cmd] ?? 15000;
  const result = await Promise.race([
    tauriInvoke<T>(cmd, args),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`[invoke] "${cmd}" timed out after ${TIMEOUT_MS}ms`)), TIMEOUT_MS)
    ),
  ]);
  return result;
}

// ── 安全な listen ──────────────────────────────────
 
type UnlistenFn = () => void;

/**
 * 安全な listen ラッパー。非 Tauri 環境では何もしない。
 */
export async function listen<T>(
  event: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (event: any) => void,
): Promise<UnlistenFn> {
  if (!hasTauriRuntime()) {
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
  if (!hasTauriRuntime()) {
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
  if (!hasTauriRuntime()) return noopWindow;
  const { getCurrentWindow: tauriGetCurrentWindow } = await import("@tauri-apps/api/window");
  return tauriGetCurrentWindow() as unknown as WindowHandle;
}

// ── 安全な openFileDialog ────────────────────────────

/** ファイルダイアログのフィルター */
interface FileDialogFilter {
  name: string;
  extensions: string[];
}

/** ファイルダイアログのオプション */
interface OpenFileDialogOptions {
  multiple?: boolean;
  filters?: FileDialogFilter[];
  title?: string;
}

/**
 * 安全なファイル選択ダイアログラッパー。
 * Tauri 環境では @tauri-apps/plugin-dialog の open() を呼び、
 * 非 Tauri 環境（ブラウザプレビュー）では HTML <input type="file"> を使う。
 *
 * @returns 選択されたファイルパス（またはパス配列）。キャンセル時は null。
 *          非 Tauri 環境では File オブジェクトの name を返す。
 */
export async function openFileDialog(
  options?: OpenFileDialogOptions,
): Promise<string | string[] | null> {
  if (hasTauriRuntime()) {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const result = await open({
        multiple: options?.multiple ?? false,
        filters: options?.filters,
        title: options?.title,
      });
      return result;
    } catch (err) {
      console.error("[tauriShim] Tauri dialog open() failed:", err);
      return null;
    }
  }

  // 非 Tauri 環境: HTML <input type="file"> フォールバック
  return new Promise<string | string[] | null>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.style.display = "none";

    // フィルターから accept 属性を構築
    if (options?.filters?.length) {
      const exts = options.filters
        .flatMap((f) => f.extensions)
        .map((ext) => `.${ext}`);
      input.accept = exts.join(",");
    }

    if (options?.multiple) {
      input.multiple = true;
    }

    input.addEventListener("change", () => {
      const files = input.files;
      if (!files || files.length === 0) {
        resolve(null);
      } else if (options?.multiple) {
        resolve(Array.from(files).map((f) => f.name));
      } else {
        const first = files.item(0);
        resolve(first ? first.name : null);
      }
      input.remove();
    });

    // キャンセル検出: フォーカス復帰後にファイルが選択されていなければ null
    input.addEventListener("cancel", () => {
      resolve(null);
      input.remove();
    });

    document.body.appendChild(input);
    input.click();
  });
}

export interface TextFileSelection {
  name: string;
  path: string | null;
  content: string;
}

/**
 * テキストファイルを選択して本文まで読み込む。
 * Tauri 環境ではファイルパス、ブラウザプレビューでは File オブジェクトから読む。
 */
export async function openTextFileDialog(
  options?: OpenFileDialogOptions,
): Promise<TextFileSelection[]> {
  if (hasTauriRuntime()) {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      const result = await open({
        multiple: options?.multiple ?? false,
        filters: options?.filters,
        title: options?.title,
      });
      const paths = Array.isArray(result) ? result : result ? [result] : [];
      const selections: TextFileSelection[] = [];
      for (const path of paths) {
        const content = await readTextFile(path);
        const name = String(path).split(/[\\/]/).pop() ?? String(path);
        selections.push({ name, path: String(path), content });
      }
      return selections;
    } catch (err) {
      console.error("[tauriShim] Tauri text file open failed:", err);
      return [];
    }
  }

  return new Promise<TextFileSelection[]>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.style.display = "none";

    if (options?.filters?.length) {
      input.accept = options.filters
        .flatMap((f) => f.extensions)
        .map((ext) => `.${ext}`)
        .join(",");
    }
    if (options?.multiple) {
      input.multiple = true;
    }

    input.addEventListener("change", () => {
      const files = Array.from(input.files ?? []);
      Promise.all(
        files.map(
          (file) =>
            new Promise<TextFileSelection>((fileResolve, fileReject) => {
              const reader = new FileReader();
              reader.onload = () =>
                fileResolve({
                  name: file.name,
                  path: null,
                  content: String(reader.result ?? ""),
                });
              reader.onerror = () => fileReject(reader.error);
              reader.readAsText(file);
            }),
        ),
      )
        .then(resolve)
        .catch((err) => {
          console.error("[tauriShim] Browser text file open failed:", err);
          resolve([]);
        })
        .finally(() => input.remove());
    });

    input.addEventListener("cancel", () => {
      resolve([]);
      input.remove();
    });

    document.body.appendChild(input);
    input.click();
  });
}

// ── 安全な openDirectoryDialog ────────────────────────────

/** ディレクトリ選択ダイアログのオプション */
interface OpenDirectoryDialogOptions {
  title?: string;
  multiple?: boolean;
}

/**
 * 安全なディレクトリ選択ダイアログラッパー。
 * Tauri 環境では @tauri-apps/plugin-dialog の open({ directory: true }) を呼び、
 * 非 Tauri 環境ではコンソール警告と null を返す。
 */
export async function openDirectoryDialog(
  options?: OpenDirectoryDialogOptions,
): Promise<string | null> {
  if (hasTauriRuntime()) {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const result = await open({
        directory: true,
        multiple: options?.multiple ?? false,
        title: options?.title,
      });
      if (typeof result === "string") return result;
      // multiple: true の場合は配列が返る可能性がある
      if (Array.isArray(result) && (result as string[]).length > 0) return String((result as string[])[0]);
      return null;
    } catch (err) {
      console.error("[tauriShim] Tauri directory dialog open() failed:", err);
      return null;
    }
  }

  // 非 Tauri 環境: ディレクトリ選択はブラウザでは不可
  console.warn("[tauriShim] Directory dialog not available in browser preview");
  return null;
}

// ── 安全な saveFileDialog ────────────────────────────

/** 保存ダイアログのオプション */
interface SaveFileDialogOptions {
  defaultPath?: string;
  filters?: FileDialogFilter[];
  title?: string;
}

/**
 * 安全なファイル保存ダイアログラッパー。
 * Tauri 環境では @tauri-apps/plugin-dialog の save() を呼び、
 * 非 Tauri 環境ではデフォルトパスを返す。
 */
export async function saveFileDialog(
  options?: SaveFileDialogOptions,
): Promise<string | null> {
  if (hasTauriRuntime()) {
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const result = await save({
        defaultPath: options?.defaultPath,
        filters: options?.filters,
        title: options?.title,
      });
      return result ?? null;
    } catch (err) {
      console.error("[tauriShim] Tauri save dialog failed:", err);
      return null;
    }
  }

  // 非 Tauri 環境: デフォルトパスを返す（ダウンロード時にフロント側で処理）
  return options?.defaultPath ?? null;
}

// ── 安全な shellOpen ──────────────────────────────────

/**
 * 安全な shell open ラッパー。
 * Tauri 環境では @tauri-apps/plugin-shell の open() を呼び、
 * 非 Tauri 環境では window.open() にフォールバックする。
 */
export async function shellOpen(url: string): Promise<void> {
  if (hasTauriRuntime()) {
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(url);
      return;
    } catch (err) {
      console.error("[tauriShim] Tauri shell open() failed:", err);
      // フォールバック
    }
  }

  // 非 Tauri 環境またはフォールバック: window.open
  window.open(url, "_blank");
}

// ── 安全な relaunch ──────────────────────────────────

/**
 * 安全なアプリ再起動ラッパー。
 * Tauri 環境では @tauri-apps/plugin-process の relaunch() を呼び、
 * 非 Tauri 環境では window.location.reload() にフォールバックする。
 */
export async function relaunch(): Promise<void> {
  if (hasTauriRuntime()) {
    try {
      const { relaunch: tauriRelaunch } = await import("@tauri-apps/plugin-process");
      await tauriRelaunch();
      return;
    } catch (err) {
      console.error("[tauriShim] Tauri relaunch() failed:", err);
    }
  }

  // 非 Tauri 環境またはフォールバック
  window.location.reload();
}
