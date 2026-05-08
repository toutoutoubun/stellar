// src/lib/tauriShim.ts
// Stellar — Tauri 環境検出 + 安全な invoke / listen / convertFileSrc
// Tauri ランタイムが存在しない環境（ブラウザプレビュー等）では
// 即座に空データを返し、loading が永遠に終わらない問題を防ぐ。

import { useI18nStore } from "../stores/useI18nStore";

// ── Tauri 環境検出 ─────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isTauri: boolean = !!(window as any).__TAURI_INTERNALS__;

// ── インメモリ CRUD ストア（非 Tauri 環境用）─────────
// ブラウザプレビューでも create / get / update / delete が動作するように
// メモリ上にデータを保持する軽量ストア。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockStore: { notes: any[]; projects: any[]; papers: any[]; datasets: any[]; analyses: any[]; codes: any[]; highlights: any[]; links: any[] } = {
  notes: [],
  projects: [],
  papers: [],
  datasets: [],
  analyses: [],
  codes: [],
  highlights: [],
  links: [],
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
      name: input.name ?? useI18nStore.getState().t.utils.str_9w7zjx,
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
      title: input.title ?? useI18nStore.getState().t.utils.str_zgkhcc,
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
      name: a.name ?? useI18nStore.getState().t.quantitative.k_2jvud1,
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
      name: a.name ?? useI18nStore.getState().t.utils.str_7nzz94,
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
    return { handled: true, result: filtered };
  }
  if (cmd === "create_code") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = (args ?? {}) as any;
    const code = {
      id: mockId(),
      projectId: a.projectId ?? "",
      parentId: a.parentId ?? null,
      label: a.label ?? useI18nStore.getState().t.utils.str_b194an,
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
    return { handled: true, result: [...mockStore.highlights] };
  }
  if (cmd === "get_highlights_by_code") {
    const codeId = args?.codeId as string | undefined;
    const filtered = codeId
      ? mockStore.highlights.filter((h: Record<string, unknown>) => (h.codeIds as string[] | undefined)?.includes(codeId))
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

  // ── Graph Data（動的生成）──
  if (cmd === "get_graph_data") {
    // mockStore のノートと論文からグラフデータを動的に生成
    const nodes: any[] = [];
    for (const note of mockStore.notes) {
      if (note.isDraft === 1) continue; // 草稿は除外
      nodes.push({
        id: note.id,
        name: note.title || "Untitled Note",
        type: "note",
        val: 1,
        tags: note.tags ?? [],
      });
    }
    for (const paper of mockStore.papers) {
      nodes.push({
        id: paper.id,
        name: paper.title || "Untitled Paper",
        type: "paper",
        val: 1,
        tags: paper.tags ?? [],
      });
    }
    // mockStore.links からリンクを生成
    const nodeIdSet = new Set(nodes.map((n: any) => n.id));
    const links = mockStore.links
      .filter((l: any) => nodeIdSet.has(l.sourceId) && nodeIdSet.has(l.targetId))
      .map((l: any) => ({ id: l.id, source: l.sourceId, target: l.targetId }));
    return { handled: true, result: { nodes, links } };
  }

  // ── Links CRUD ──
  if (cmd === "create_link") {
    const a = (args ?? {}) as any;
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
    const result = mockStore.links
      .filter((l: any) => l.sourceId === itemId || l.targetId === itemId)
      .map((l: any) => ({
        id: l.id,
        sourceId: l.sourceId,
        sourceType: l.sourceType,
        sourceTitle: "",
        targetId: l.targetId,
        targetType: l.targetType,
        targetTitle: "",
        context: l.context,
        createdAt: l.createdAt,
      }));
    return { handled: true, result };
  }

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
if (!isTauri) {
  const seedNotes = [
    { id: "seed-note-001", title: "研究ノート: 社会関係資本の理論的枠組み", content: "Putnam (2000) の議論を整理する…", tags: ["theory", "social-capital"], isDraft: 0, draftMeta: "{}", wordCount: 320, readingTimeMin: 2, createdAt: "2025-04-01T10:00:00Z", updatedAt: "2025-04-15T08:30:00Z" },
    { id: "seed-note-002", title: "フィールドワーク記録 (2025-03)", content: "インタビュー結果のまとめ…", tags: ["fieldwork", "interview"], isDraft: 0, draftMeta: "{}", wordCount: 580, readingTimeMin: 3, createdAt: "2025-03-20T14:00:00Z", updatedAt: "2025-04-10T11:00:00Z" },
    { id: "seed-note-003", title: "方法論メモ: 質的比較分析 (QCA)", content: "Ragin (1987) の手法を検討…", tags: ["methodology", "QCA"], isDraft: 0, draftMeta: "{}", wordCount: 410, readingTimeMin: 2, createdAt: "2025-03-15T09:00:00Z", updatedAt: "2025-04-12T16:00:00Z" },
    { id: "seed-note-004", title: "文献レビュー草案", content: "先行研究の概観…", tags: ["review"], isDraft: 0, draftMeta: "{}", wordCount: 750, readingTimeMin: 4, createdAt: "2025-02-28T10:00:00Z", updatedAt: "2025-04-08T09:00:00Z" },
    { id: "seed-note-005", title: "制度論とガバナンス", content: "North (1990) の制度概念…", tags: ["theory", "institution"], isDraft: 0, draftMeta: "{}", wordCount: 290, readingTimeMin: 2, createdAt: "2025-04-05T13:00:00Z", updatedAt: "2025-04-18T10:00:00Z" },
  ];
  const seedPapers = [
    { id: "seed-paper-001", title: "Bowling Alone: The Collapse and Revival of American Community", authors: ["Robert D. Putnam"], year: 2000, journal: null, doi: null, url: null, abstract: "An exploration of declining social capital in America.", pdfPath: null, tags: ["social-capital", "theory"], createdAt: "2025-03-01T10:00:00Z", updatedAt: "2025-03-01T10:00:00Z" },
    { id: "seed-paper-002", title: "The Comparative Method: Moving Beyond Qualitative and Quantitative Strategies", authors: ["Charles C. Ragin"], year: 1987, journal: null, doi: null, url: null, abstract: "Introduction of QCA methodology.", pdfPath: null, tags: ["methodology", "QCA"], createdAt: "2025-03-05T10:00:00Z", updatedAt: "2025-03-05T10:00:00Z" },
    { id: "seed-paper-003", title: "Institutions, Institutional Change and Economic Performance", authors: ["Douglass C. North"], year: 1990, journal: null, doi: null, url: null, abstract: "A framework for analyzing institutions.", pdfPath: null, tags: ["theory", "institution"], createdAt: "2025-03-10T10:00:00Z", updatedAt: "2025-03-10T10:00:00Z" },
    { id: "seed-paper-004", title: "Governing the Commons", authors: ["Elinor Ostrom"], year: 1990, journal: null, doi: null, url: null, abstract: "The Evolution of Institutions for Collective Action.", pdfPath: null, tags: ["institution", "commons"], createdAt: "2025-03-12T10:00:00Z", updatedAt: "2025-03-12T10:00:00Z" },
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

  // Links (CRUD は動的ハンドラで処理)
  get_link_suggestions: [],

  // Search
  full_text_search: { papers: [], notes: [], highlights: [] },

  // Qualitative — Coding Matrix
  get_coding_matrix: { rows: [], cols: [], cells: {} },

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

  // Draft Mode (dynamic handler handles create_draft/get_drafts)
  get_draft_chapters: [],
  create_draft_chapter: null,
  update_draft_chapter: null,
  delete_draft_chapter: undefined,
  reorder_draft_chapters: undefined,
  insert_citation: null,
  get_citations_for_note: [],
  delete_citation: undefined,
  generate_bibliography: "",
  sync_word_count: undefined,

  // PDF metadata extraction
  // extract_metadata_from_pdf → 動的ハンドラで処理

  // Export / Import
  export_static_site: "/mock/export/static-site",
  export_stellar_package: "/mock/export/package.stellar",
  import_stellar_package: { papersImported: 0, notesImported: 0, highlightsImported: 0, linksImported: 0, pdfsExtracted: 0, conflicts: [] },

  // Citation Network
  update_reading_status: undefined,
  get_reading_status_counts: { unread: 0, reading: 0, done: 0, revisit: 0 },
  fetch_citation_network: { paperId: "", references: [], citedBy: [], fetchedAt: null },
  fetch_recommendations: [],
  get_recommendations: [],
  import_recommendation: null,
  get_citation_graph_data: { nodes: [], edges: [] },
  export_bibtex: "",
  export_ris: "",
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

  // Tauri 環境: 本物の invoke を呼ぶ（タイムアウト付き）
  const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
  const TIMEOUT_MS = 15000; // 15秒タイムアウト
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
  if (isTauri) {
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
  if (isTauri) {
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
  if (isTauri) {
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
  if (isTauri) {
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
  if (isTauri) {
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
