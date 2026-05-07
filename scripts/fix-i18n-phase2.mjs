#!/usr/bin/env node
/**
 * Phase 2: Fix remaining hardcoded Japanese strings
 * - Remove Japanese fallback strings (the ?? "日本語" patterns)
 * - Replace remaining visible Japanese in ReportBuilder, AnalysisWizard, ErrorBoundary, etc.
 * - Add missing i18n keys
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve("src");

// ─── NEW I18N KEYS (Phase 2) ───
const NEW_KEYS = {
  layout: {
    k_error_title: {
      ja: "予期しないエラーが発生しました",
      en: "An unexpected error occurred",
      fr: "Une erreur inattendue s'est produite",
      af: "'n Onverwagte fout het voorgekom",
    },
    k_error_desc: {
      ja: "アプリケーションで問題が発生しました。\\nアプリを再起動するか、このエラーを無視して続行できます。",
      en: "Something went wrong.\\nYou can restart the app or dismiss this error to continue.",
      fr: "Quelque chose s'est mal passé.\\nVous pouvez redémarrer l'application ou ignorer cette erreur.",
      af: "Iets het verkeerd gegaan.\\nJy kan die toepassing herbegin of hierdie fout ignoreer.",
    },
    k_error_details: {
      ja: "エラーの詳細を表示",
      en: "Show error details",
      fr: "Afficher les détails de l'erreur",
      af: "Wys foutbesonderhede",
    },
    k_restart_app: {
      ja: "アプリを再起動",
      en: "Restart app",
      fr: "Redémarrer l'application",
      af: "Herbegin toepassing",
    },
    k_dismiss_error: {
      ja: "無視して続行",
      en: "Dismiss",
      fr: "Ignorer",
      af: "Ignoreer",
    },
  },
  quantitative: {
    k_data_rows_count: {
      ja: "データ行: ${count}",
      en: "Data rows: ${count}",
      fr: "Lignes de données : ${count}",
      af: "Datarye: ${count}",
    },
    k_chart_insert_desc: {
      ja: "チャート: ${name} のグラフが挿入されます",
      en: "Chart: ${name} graph will be inserted",
      fr: "Graphique : le graphique de ${name} sera inséré",
      af: "Grafiek: ${name} grafiek sal ingevoeg word",
    },
    k_table_insert_desc: {
      ja: "${name} の${type}表が挿入されます",
      en: "${name} ${type} table will be inserted",
      fr: "Le tableau ${type} de ${name} sera inséré",
      af: "${name} ${type} tabel sal ingevoeg word",
    },
  },
  qualitative: {
    k_report_title_fmt: {
      ja: "質的分析レポート（${names}）",
      en: "Qualitative Analysis Report (${names})",
      fr: "Rapport d'analyse qualitative (${names})",
      af: "Kwalitatiewe Analise Verslag (${names})",
    },
  },
};

function addKeysToSection(content, sectionName, keys, lang) {
  const sectionRegex = new RegExp(`(  ${sectionName}:\\s*\\{[\\s\\S]*?)(\\n  \\},)`, "m");
  const match = content.match(sectionRegex);
  if (!match) {
    console.warn(`  Section "${sectionName}" not found in ${lang}`);
    return content;
  }
  let newKeys = "";
  for (const [key, translations] of Object.entries(keys)) {
    if (content.includes(`${key}:`)) continue;
    const val = translations[lang] ?? translations.ja;
    newKeys += `    ${key}: "${val}",\n`;
  }
  if (!newKeys) return content;
  return content.replace(sectionRegex, `$1\n${newKeys}$2`);
}

// Add keys to all lang files
for (const lang of ["ja", "en", "fr", "af"]) {
  const filePath = path.join(ROOT, "i18n", `${lang}.ts`);
  let content = fs.readFileSync(filePath, "utf8");
  let changed = false;
  for (const [section, keys] of Object.entries(NEW_KEYS)) {
    const before = content;
    content = addKeysToSection(content, section, keys, lang);
    if (content !== before) changed = true;
  }
  if (changed) {
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`✅ Updated ${lang}.ts with phase 2 keys`);
  }
}

console.log("\n=== Phase 2: Component replacements ===\n");

const replacements = [
  // StaticSiteExportModal.tsx - remove all ?? "日本語" fallbacks
  {
    file: "components/export/StaticSiteExportModal.tsx",
    changes: [
      { old: `t.exportImport.k_defaultSiteTitle ?? "私の研究ノート"`, new: `t.exportImport.k_defaultSiteTitle` },
      { old: `t.exportImport.k_selectOutputDir ?? "出力先を選択してください"`, new: `t.exportImport.k_selectOutputDir` },
      { old: `t.exportImport.k_siteGenerated ?? "サイトを生成しました"`, new: `t.exportImport.k_siteGenerated` },
      { old: `t.exportImport.k_siteSettings ?? "サイト設定"`, new: `t.exportImport.k_siteSettings` },
      { old: `t.exportImport.k_outputAndGenerate ?? "出力＆生成"`, new: `t.exportImport.k_outputAndGenerate` },
      { old: `t.exportImport.k_generate ?? "生成する"`, new: `t.exportImport.k_generate` },
      { old: `t.exportImport.k_deselectAll ?? "全解除"`, new: `t.exportImport.k_deselectAll` },
      { old: `t.exportImport.k_selectAll ?? "全選択"`, new: `t.exportImport.k_selectAll` },
      { old: `t.exportImport.k_backlinksDesc ?? "ノート間のバックリンクセクションを含めます"`, new: `t.exportImport.k_backlinksDesc` },
      { old: `t.exportImport.k_selectOutputDir ?? "フォルダを選択してください"`, new: `t.exportImport.k_selectOutputDir` },
    ],
  },
  // AnalysisWizard.tsx
  {
    file: "components/quantitative/AnalysisWizard.tsx",
    changes: [
      {
        old: `<span>データ行: {dataRows.length} {t.common.items}</span>`,
        new: `<span>{t.quantitative.k_data_rows_label} {dataRows.length} {t.common.items}</span>`,
      },
    ],
  },
  // ReportBuilder.tsx - chart/table insert descriptions
  {
    file: "components/quantitative/ReportBuilder.tsx",
    changes: [
      {
        old: `<span>チャート: {chartAnalysis.name} のグラフが挿入されます</span>`,
        new: `<span>{useI18nStore.getState().t.quantitative.k_chart_insert_desc.replace("\${name}", chartAnalysis.name)}</span>`,
      },
      {
        old: `<span>{tableAnalysis.name} の{block.tableType === "frequency" ? useI18nStore.getState().t.quantitative.k_cd0slj : block.tableType === "contingency" ? useI18nStore.getState().t.quantitative.k_cfa2k : useI18nStore.getState().t.quantitative.k_e4fi}表が挿入されます</span>`,
        new: `<span>{useI18nStore.getState().t.quantitative.k_table_insert_desc.replace("\${name}", tableAnalysis.name).replace("\${type}", block.tableType === "frequency" ? useI18nStore.getState().t.quantitative.k_cd0slj : block.tableType === "contingency" ? useI18nStore.getState().t.quantitative.k_cfa2k : useI18nStore.getState().t.quantitative.k_e4fi)}</span>`,
      },
    ],
  },
  // AnalysisReport.tsx - report title
  {
    file: "components/qualitative/AnalysisReport.tsx",
    changes: [
      {
        old: "const title = `質的分析レポート（${selectedNames.slice(0, 3).join(t.stats.k_9ob)}${selectedNames.length > 3 ? \"…\" : \"\"}）`;",
        new: "const title = t.qualitative.k_report_title_fmt.replace(\"${names}\", `${selectedNames.slice(0, 3).join(t.stats.k_9ob)}${selectedNames.length > 3 ? \"…\" : \"\"}`);",
      },
    ],
  },
  // ErrorBoundary.tsx
  {
    file: "components/ErrorBoundary.tsx",
    changes: [
      { old: "            予期しないエラーが発生しました", new: "            {(window as any).__STELLAR_T__?.layout?.k_error_title ?? \"An unexpected error occurred\"}" },
      {
        old: `            アプリケーションで問題が発生しました。\n            <br />\n            アプリを再起動するか、このエラーを無視して続行できます。`,
        new: `            {((window as any).__STELLAR_T__?.layout?.k_error_desc ?? "Something went wrong.\\nYou can restart the app or dismiss this error.").split("\\n").map((line: string, i: number) => (\n              <span key={i}>{line}{i === 0 && <br />}</span>\n            ))}`,
      },
      { old: "                エラーの詳細を表示", new: '                {(window as any).__STELLAR_T__?.layout?.k_error_details ?? "Show error details"}' },
      { old: "              アプリを再起動", new: '              {(window as any).__STELLAR_T__?.layout?.k_restart_app ?? "Restart app"}' },
      { old: "              無視して続行", new: '              {(window as any).__STELLAR_T__?.layout?.k_dismiss_error ?? "Dismiss"}' },
    ],
  },
];

let total = 0;
let failed = 0;

for (const { file, changes } of replacements) {
  const filePath = path.join(ROOT, file);
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  File not found: ${file}`);
    continue;
  }
  let content = fs.readFileSync(filePath, "utf8");
  let fileChanged = false;

  for (const { old: oldStr, new: newStr } of changes) {
    if (content.includes(oldStr)) {
      content = content.replace(oldStr, newStr);
      fileChanged = true;
      total++;
    } else {
      console.warn(`  ⚠️  Not found in ${file}: "${oldStr.slice(0, 70)}..."`);
      failed++;
    }
  }

  if (fileChanged) {
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`✅ Updated ${file}`);
  }
}

console.log(`\n✅ Successful: ${total}  ⚠️ Failed: ${failed}`);
