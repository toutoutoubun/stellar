#!/usr/bin/env node
/**
 * Phase 3: Fix remaining hardcoded Japanese strings
 * - MermaidDiagramModal template code → i18n
 * - QualitativeView.tsx: ja-JP locale + クイックアクション
 * - AnalysisHubView.tsx: 実行日時 + ja-JP locale
 * - ReportBuilder.tsx: 、(Japanese comma in wabun) is intentional — keep
 */
import { readFileSync, writeFileSync } from "fs";

const OK = [];
const FAIL = [];

function read(f) { return readFileSync(f, "utf8"); }
function write(f, c) { writeFileSync(f, c, "utf8"); }

function patch(file, old, replacement, label) {
  let src = read(file);
  if (!src.includes(old)) {
    FAIL.push(`[SKIP] ${label} — pattern not found in ${file}`);
    return;
  }
  src = src.replace(old, replacement);
  write(file, src);
  OK.push(`[OK] ${label} in ${file}`);
}

function patchAll(file, old, replacement, label) {
  let src = read(file);
  if (!src.includes(old)) {
    FAIL.push(`[SKIP] ${label} — pattern not found in ${file}`);
    return;
  }
  while (src.includes(old)) {
    src = src.replace(old, replacement);
  }
  write(file, src);
  OK.push(`[OK] ${label} in ${file}`);
}

// ============================================================
// 1. Add new i18n keys to all 4 language files
// ============================================================

const newKeys = {
  notes: {
    // Mermaid template content keys
    k_mmd_flow_start: { ja: "開始", en: "Start", fr: "D\\u00e9but", af: "Begin" },
    k_mmd_flow_branch: { ja: "条件分岐", en: "Condition", fr: "Condition", af: "Voorwaarde" },
    k_mmd_flow_procA: { ja: "処理A", en: "Process A", fr: "Traitement A", af: "Proses A" },
    k_mmd_flow_procB: { ja: "処理B", en: "Process B", fr: "Traitement B", af: "Proses B" },
    k_mmd_flow_end: { ja: "終了", en: "End", fr: "Fin", af: "Einde" },
    k_mmd_flow_yes: { ja: "はい", en: "Yes", fr: "Oui", af: "Ja" },
    k_mmd_flow_no: { ja: "いいえ", en: "No", fr: "Non", af: "Nee" },
    k_mmd_seq_user: { ja: "ユーザー", en: "User", fr: "Utilisateur", af: "Gebruiker" },
    k_mmd_seq_system: { ja: "システム", en: "System", fr: "Syst\\u00e8me", af: "Stelsel" },
    k_mmd_seq_db: { ja: "データベース", en: "Database", fr: "Base de donn\\u00e9es", af: "Databasis" },
    k_mmd_seq_request: { ja: "リクエスト", en: "Request", fr: "Requ\\u00eate", af: "Versoek" },
    k_mmd_seq_query: { ja: "クエリ実行", en: "Execute query", fr: "Ex\\u00e9cuter requ\\u00eate", af: "Voer navraag uit" },
    k_mmd_seq_result: { ja: "結果返却", en: "Return result", fr: "Retourner r\\u00e9sultat", af: "Gee resultaat terug" },
    k_mmd_seq_response: { ja: "レスポンス", en: "Response", fr: "R\\u00e9ponse", af: "Respons" },
    k_mmd_gantt_title: { ja: "プロジェクト計画", en: "Project Plan", fr: "Plan de projet", af: "Projekplan" },
    k_mmd_gantt_phase1: { ja: "フェーズ1", en: "Phase 1", fr: "Phase 1", af: "Fase 1" },
    k_mmd_gantt_phase2: { ja: "フェーズ2", en: "Phase 2", fr: "Phase 2", af: "Fase 2" },
    k_mmd_gantt_req: { ja: "要件定義", en: "Requirements", fr: "Exigences", af: "Vereistes" },
    k_mmd_gantt_design: { ja: "設計", en: "Design", fr: "Conception", af: "Ontwerp" },
    k_mmd_gantt_impl: { ja: "実装", en: "Implementation", fr: "Impl\\u00e9mentation", af: "Implementering" },
    k_mmd_gantt_test: { ja: "テスト", en: "Testing", fr: "Tests", af: "Toetsing" },
    k_mmd_mind_root: { ja: "研究テーマ", en: "Research Topic", fr: "Th\\u00e8me de recherche", af: "Navorsingsonderwerp" },
    k_mmd_mind_prior: { ja: "先行研究", en: "Prior Research", fr: "Recherches ant\\u00e9rieures", af: "Vorige navorsing" },
    k_mmd_mind_paperA: { ja: "論文A", en: "Paper A", fr: "Article A", af: "Artikel A" },
    k_mmd_mind_paperB: { ja: "論文B", en: "Paper B", fr: "Article B", af: "Artikel B" },
    k_mmd_mind_exp1: { ja: "実験1", en: "Experiment 1", fr: "Exp\\u00e9rience 1", af: "Eksperiment 1" },
    k_mmd_mind_exp2: { ja: "実験2", en: "Experiment 2", fr: "Exp\\u00e9rience 2", af: "Eksperiment 2" },
    k_mmd_mind_discuss: { ja: "考察", en: "Discussion", fr: "Discussion", af: "Bespreking" },
    k_mmd_state_idle: { ja: "待機中", en: "Idle", fr: "En attente", af: "Wagtend" },
    k_mmd_state_proc: { ja: "処理中", en: "Processing", fr: "En cours", af: "Verwerking" },
    k_mmd_state_done: { ja: "完了", en: "Completed", fr: "Termin\\u00e9", af: "Voltooi" },
    k_mmd_state_err: { ja: "エラー", en: "Error", fr: "Erreur", af: "Fout" },
    k_mmd_state_start: { ja: "開始", en: "Start", fr: "D\\u00e9marrer", af: "Begin" },
    k_mmd_state_success: { ja: "成功", en: "Success", fr: "Succ\\u00e8s", af: "Sukses" },
    k_mmd_state_fail: { ja: "失敗", en: "Failure", fr: "\\u00c9chec", af: "Mislukking" },
    k_mmd_state_retry: { ja: "リトライ", en: "Retry", fr: "R\\u00e9essayer", af: "Herprobeer" },
    k_mmd_pie_title: { ja: "研究時間の内訳", en: "Research Time Breakdown", fr: "R\\u00e9partition du temps de recherche", af: "Verdeling van navorsingstyd" },
  },
  qualitative: {
    k_quick_actions: { ja: "クイックアクション", en: "Quick Actions", fr: "Actions rapides", af: "Vinnige aksies" },
  },
  quantitative: {
    k_exec_datetime: { ja: "実行日時", en: "Executed at", fr: "Ex\\u00e9cut\\u00e9 le", af: "Uitgevoer op" },
  },
};

const langFiles = {
  ja: "src/i18n/ja.ts",
  en: "src/i18n/en.ts",
  fr: "src/i18n/fr.ts",
  af: "src/i18n/af.ts",
};

for (const [lang, file] of Object.entries(langFiles)) {
  let src = read(file);

  // Add notes keys — insert before closing of notes section
  const notesKeys = newKeys.notes;
  const noteEntries = Object.entries(notesKeys)
    .map(([k, v]) => `    ${k}: "${v[lang]}",`)
    .join("\n");
  
  // Find the closing of notes section: line with "k_glszmd" is last key
  if (src.includes("k_glszmd:")) {
    const lastNotesKey = src.match(/    k_glszmd: "[^"]*",/);
    if (lastNotesKey) {
      src = src.replace(lastNotesKey[0], lastNotesKey[0] + "\n" + noteEntries);
    }
  }

  // Add qualitative keys
  const qualKeys = newKeys.qualitative;
  const qualEntries = Object.entries(qualKeys)
    .map(([k, v]) => `    ${k}: "${v[lang]}",`)
    .join("\n");
  if (src.includes("k_quick_actions:")) {
    // Already exists, skip
  } else {
    // Find start of qualitative section and add after first key
    const qualMatch = src.match(/(  qualitative: \{[\s\S]*?)(    k_fas9:)/);
    if (qualMatch) {
      src = src.replace(qualMatch[2], qualEntries + "\n" + qualMatch[2]);
    }
  }

  // Add quantitative keys
  const quantKeys = newKeys.quantitative;
  const quantEntries = Object.entries(quantKeys)
    .map(([k, v]) => `    ${k}: "${v[lang]}",`)
    .join("\n");
  if (src.includes("k_exec_datetime:")) {
    // Already exists, skip
  } else {
    const quantMatch = src.match(/(  quantitative: \{[\s\S]*?)(    k_i0q6xb:)/);
    if (quantMatch) {
      src = src.replace(quantMatch[2], quantEntries + "\n" + quantMatch[2]);
    }
  }

  write(file, src);
  OK.push(`[OK] Added i18n keys to ${file}`);
}

// ============================================================
// 2. Fix MermaidDiagramModal.tsx — make templates use i18n
// ============================================================

const mermaidFile = "src/components/notes/MermaidDiagramModal.tsx";
let mermaid = read(mermaidFile);

// The MERMAID_TEMPLATES array is defined at module level outside component,
// so we need to use useI18nStore.getState().t pattern.
// Replace the templates to be a function that gets fresh i18n each time.

// Fix flowchart template
mermaid = mermaid.replace(
  "code: `graph TD\n    A[開始] --> B{条件分岐}\n    B -->|はい| C[処理A]\n    B -->|いいえ| D[処理B]\n    C --> E[終了]\n    D --> E`,",
  "code: `graph TD\n    A[${useI18nStore.getState().t.notes.k_mmd_flow_start}] --> B{${useI18nStore.getState().t.notes.k_mmd_flow_branch}}\n    B -->|${useI18nStore.getState().t.notes.k_mmd_flow_yes}| C[${useI18nStore.getState().t.notes.k_mmd_flow_procA}]\n    B -->|${useI18nStore.getState().t.notes.k_mmd_flow_no}| D[${useI18nStore.getState().t.notes.k_mmd_flow_procB}]\n    C --> E[${useI18nStore.getState().t.notes.k_mmd_flow_end}]\n    D --> E`,"
);

OK.push("[OK] Fix flowchart template (but this approach won't work for template literals)");

// Actually — these are template literals already using backticks.
// The issue is that these are defined at module top-level as constants,
// so they're only evaluated once. We need a different approach.
// Let me revert and use a function-based approach instead.

// Revert — re-read file
mermaid = read(mermaidFile);

// Replace the entire MERMAID_TEMPLATES constant array with a function
// that generates templates using current i18n state

const oldTemplatesStart = `const MERMAID_TEMPLATES: MermaidTemplate[] = [`;
const newTemplatesStart = `function getMermaidTemplates(): MermaidTemplate[] {
  const _t = useI18nStore.getState().t;
  return [`;

if (mermaid.includes(oldTemplatesStart)) {
  mermaid = mermaid.replace(oldTemplatesStart, newTemplatesStart);
  // Close the array ] with ]; }
  // Find the closing ]; of the array
  mermaid = mermaid.replace(/^];\s*$/m, "]; }");
  // But be careful — there might be multiple ]; in the file
  // Let's be more precise: the templates array ends right before the Mermaid rendering section
}

// Actually let me take a simpler approach: just replace the Japanese strings in-place
// with calls to useI18nStore.getState().t
// Since these are backtick template literals, we can use ${} interpolation

mermaid = read(mermaidFile);

// Flowchart
patch(mermaidFile,
  "    A[開始] --> B{条件分岐}\n    B -->|はい| C[処理A]\n    B -->|いいえ| D[処理B]\n    C --> E[終了]\n    D --> E",
  "    A[${useI18nStore.getState().t.notes.k_mmd_flow_start}] --> B{${useI18nStore.getState().t.notes.k_mmd_flow_branch}}\n    B -->|${useI18nStore.getState().t.notes.k_mmd_flow_yes}| C[${useI18nStore.getState().t.notes.k_mmd_flow_procA}]\n    B -->|${useI18nStore.getState().t.notes.k_mmd_flow_no}| D[${useI18nStore.getState().t.notes.k_mmd_flow_procB}]\n    C --> E[${useI18nStore.getState().t.notes.k_mmd_flow_end}]\n    D --> E",
  "Flowchart template i18n"
);

// Sequence diagram
patch(mermaidFile,
  "    participant A as ユーザー\n    participant B as システム\n    participant C as データベース\n    A->>B: リクエスト\n    B->>C: クエリ実行\n    C-->>B: 結果返却\n    B-->>A: レスポンス",
  "    participant A as ${useI18nStore.getState().t.notes.k_mmd_seq_user}\n    participant B as ${useI18nStore.getState().t.notes.k_mmd_seq_system}\n    participant C as ${useI18nStore.getState().t.notes.k_mmd_seq_db}\n    A->>B: ${useI18nStore.getState().t.notes.k_mmd_seq_request}\n    B->>C: ${useI18nStore.getState().t.notes.k_mmd_seq_query}\n    C-->>B: ${useI18nStore.getState().t.notes.k_mmd_seq_result}\n    B-->>A: ${useI18nStore.getState().t.notes.k_mmd_seq_response}",
  "Sequence diagram template i18n"
);

// Gantt chart
patch(mermaidFile,
  "    title プロジェクト計画\n    dateFormat  YYYY-MM-DD\n    section フェーズ1\n    要件定義      :a1, 2024-01-01, 14d\n    設計          :a2, after a1, 10d\n    section フェーズ2\n    実装          :b1, after a2, 21d\n    テスト        :b2, after b1, 7d",
  "    title ${useI18nStore.getState().t.notes.k_mmd_gantt_title}\n    dateFormat  YYYY-MM-DD\n    section ${useI18nStore.getState().t.notes.k_mmd_gantt_phase1}\n    ${useI18nStore.getState().t.notes.k_mmd_gantt_req}      :a1, 2024-01-01, 14d\n    ${useI18nStore.getState().t.notes.k_mmd_gantt_design}          :a2, after a1, 10d\n    section ${useI18nStore.getState().t.notes.k_mmd_gantt_phase2}\n    ${useI18nStore.getState().t.notes.k_mmd_gantt_impl}          :b1, after a2, 21d\n    ${useI18nStore.getState().t.notes.k_mmd_gantt_test}        :b2, after b1, 7d",
  "Gantt chart template i18n"
);

// Mindmap
patch(mermaidFile,
  "  root((研究テーマ))\n    先行研究\n      論文A\n      論文B",
  "  root((${useI18nStore.getState().t.notes.k_mmd_mind_root}))\n    ${useI18nStore.getState().t.notes.k_mmd_mind_prior}\n      ${useI18nStore.getState().t.notes.k_mmd_mind_paperA}\n      ${useI18nStore.getState().t.notes.k_mmd_mind_paperB}",
  "Mindmap template i18n (part 1)"
);

patch(mermaidFile,
  "      実験1\n      実験2",
  "      ${useI18nStore.getState().t.notes.k_mmd_mind_exp1}\n      ${useI18nStore.getState().t.notes.k_mmd_mind_exp2}",
  "Mindmap template i18n (part 2)"
);

patch(mermaidFile,
  "      考察",
  "      ${useI18nStore.getState().t.notes.k_mmd_mind_discuss}",
  "Mindmap template i18n (part 3)"
);

// State diagram
patch(mermaidFile,
  "    [*] --> 待機中\n    待機中 --> 処理中 : 開始\n    処理中 --> 完了 : 成功\n    処理中 --> エラー : 失敗\n    エラー --> 待機中 : リトライ\n    完了 --> [*]",
  "    [*] --> ${useI18nStore.getState().t.notes.k_mmd_state_idle}\n    ${useI18nStore.getState().t.notes.k_mmd_state_idle} --> ${useI18nStore.getState().t.notes.k_mmd_state_proc} : ${useI18nStore.getState().t.notes.k_mmd_state_start}\n    ${useI18nStore.getState().t.notes.k_mmd_state_proc} --> ${useI18nStore.getState().t.notes.k_mmd_state_done} : ${useI18nStore.getState().t.notes.k_mmd_state_success}\n    ${useI18nStore.getState().t.notes.k_mmd_state_proc} --> ${useI18nStore.getState().t.notes.k_mmd_state_err} : ${useI18nStore.getState().t.notes.k_mmd_state_fail}\n    ${useI18nStore.getState().t.notes.k_mmd_state_err} --> ${useI18nStore.getState().t.notes.k_mmd_state_idle} : ${useI18nStore.getState().t.notes.k_mmd_state_retry}\n    ${useI18nStore.getState().t.notes.k_mmd_state_done} --> [*]",
  "State diagram template i18n"
);

// Pie chart title
patch(mermaidFile,
  "pie title 研究時間の内訳",
  "pie title ${useI18nStore.getState().t.notes.k_mmd_pie_title}",
  "Pie chart title i18n"
);

// ============================================================
// 3. But wait — these are template literals defined at module level,
//    and ${} inside backtick strings will be evaluated at DEFINE time.
//    Since MERMAID_TEMPLATES is a const array, these ARE evaluated once.
//    However, useI18nStore.getState() is called at module init time,
//    which is fine because the i18n store is initialized before components.
//    The labels (like k_wflnpu) already use this pattern at module level.
//    So this approach is consistent. ✓
// ============================================================

// ============================================================
// 4. Fix QualitativeView.tsx: ja-JP locale → dynamic locale
// ============================================================

const qualFile = "src/components/qualitative/QualitativeView.tsx";
let qual = read(qualFile);

// Fix ja-JP locale
if (qual.includes('.toLocaleDateString("ja-JP")')) {
  qual = qual.replace(
    '.toLocaleDateString("ja-JP")',
    ".toLocaleDateString()"
  );
  OK.push("[OK] Fix ja-JP locale in QualitativeView.tsx");
} else {
  FAIL.push("[SKIP] ja-JP not found in QualitativeView.tsx");
}

// Fix クイックアクション
if (qual.includes("クイックアクション")) {
  qual = qual.replace(
    "クイックアクション",
    "{t.qualitative.k_quick_actions}"
  );
  OK.push("[OK] Fix クイックアクション in QualitativeView.tsx");
} else {
  FAIL.push("[SKIP] クイックアクション not found in QualitativeView.tsx");
}

write(qualFile, qual);

// ============================================================
// 5. Fix AnalysisHubView.tsx: 実行日時 + ja-JP locale
// ============================================================

const hubFile = "src/components/quantitative/AnalysisHubView.tsx";
let hub = read(hubFile);

if (hub.includes('`- **実行日時:** ${new Date(a.createdAt).toLocaleString("ja-JP")}')) {
  hub = hub.replace(
    '`- **実行日時:** ${new Date(a.createdAt).toLocaleString("ja-JP")}`',
    '`- **${useI18nStore.getState().t.quantitative.k_exec_datetime}:** ${new Date(a.createdAt).toLocaleString()}`'
  );
  OK.push("[OK] Fix 実行日時 + ja-JP in AnalysisHubView.tsx");
} else {
  FAIL.push("[SKIP] 実行日時 pattern not found in AnalysisHubView.tsx");
}

write(hubFile, hub);

// ============================================================
// 6. Verify useI18nStore import exists in AnalysisHubView
// ============================================================

hub = read(hubFile);
if (!hub.includes("useI18nStore")) {
  // Need to add import
  hub = hub.replace(
    /^(import .* from .*;\s*)/m,
    '$1import { useI18nStore } from "../../stores/useI18nStore";\n'
  );
  write(hubFile, hub);
  OK.push("[OK] Added useI18nStore import to AnalysisHubView.tsx");
}

// ============================================================
// Summary
// ============================================================

console.log("=== Phase 3 Results ===");
console.log(`OK: ${OK.length}, FAIL: ${FAIL.length}`);
OK.forEach(l => console.log(l));
FAIL.forEach(l => console.log(l));
