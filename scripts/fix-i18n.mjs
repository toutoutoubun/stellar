#!/usr/bin/env node
/**
 * Comprehensive i18n fix script
 * 1. Add missing keys to ja.ts, en.ts, fr.ts, af.ts
 * 2. Replace hardcoded Japanese strings in component files
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve("src");

// ─── NEW I18N KEYS ───
// Keys to add to each section in ja.ts (and translations for en/fr/af)
const NEW_KEYS = {
  layout: {
    k_welcome_desc: {
      ja: "サイドバーから文献やノートを選択するか、\\n新しい文献を追加して研究を始めましょう。",
      en: "Select papers or notes from the sidebar,\\nor add new papers to start your research.",
      fr: "Sélectionnez des articles ou des notes dans la barre latérale,\\nou ajoutez de nouveaux articles pour commencer vos recherches.",
      af: "Kies artikels of notas uit die sybalk,\\nof voeg nuwe artikels by om jou navorsing te begin.",
    },
    k_detail_info: {
      ja: "詳細情報",
      en: "Details",
      fr: "Détails",
      af: "Besonderhede",
    },
    k_context_placeholder: {
      ja: "コンテキストパネル — 実装予定",
      en: "Context panel — coming soon",
      fr: "Panneau contextuel — à venir",
      af: "Kontekspaneel — binnekort beskikbaar",
    },
    k_context_paper: {
      ja: "論文選択時: メタデータ・ハイライト・関連ノート",
      en: "When paper selected: Metadata, highlights, related notes",
      fr: "Sélection d'article : métadonnées, surlignages, notes liées",
      af: "Wanneer artikel gekies: Metadata, hoogtepunte, verwante notas",
    },
    k_context_note: {
      ja: "ノート選択時: リンク先一覧・タグ",
      en: "When note selected: Links, tags",
      fr: "Sélection de note : liens, tags",
      af: "Wanneer nota gekies: Skakels, etikette",
    },
  },
  library: {
    k_tag_filter: {
      ja: "タグ",
      en: "Tags",
      fr: "Tags",
      af: "Etikette",
    },
    k_year_filter: {
      ja: "年",
      en: "Year",
      fr: "Année",
      af: "Jaar",
    },
    k_all_tags: {
      ja: "すべてのタグ",
      en: "All tags",
      fr: "Tous les tags",
      af: "Alle etikette",
    },
    k_no_tags: {
      ja: "タグがありません",
      en: "No tags",
      fr: "Aucun tag",
      af: "Geen etikette",
    },
    k_all_years: {
      ja: "すべての年",
      en: "All years",
      fr: "Toutes les années",
      af: "Alle jare",
    },
    k_confirm_delete: {
      ja: "「${title}」を削除しますか？\\nこの操作は取り消せません。",
      en: 'Delete "${title}"?\\nThis action cannot be undone.',
      fr: 'Supprimer « ${title} » ?\\nCette action est irréversible.',
      af: 'Verwyder "${title}"?\\nHierdie aksie kan nie ongedaan gemaak word nie.',
    },
    k_add_label: {
      ja: "追加",
      en: "Add",
      fr: "Ajouter",
      af: "Voeg by",
    },
    k_attach_pdf: {
      ja: "PDFを追加",
      en: "Attach PDF",
      fr: "Joindre PDF",
      af: "Heg PDF aan",
    },
    k_show_more_highlights: {
      ja: "他 ${count} 件を表示...",
      en: "Show ${count} more...",
      fr: "Afficher ${count} de plus...",
      af: "Wys ${count} meer...",
    },
  },
  graph: {
    k_loading_engine: {
      ja: "グラフエンジンを読み込み中…",
      en: "Loading graph engine…",
      fr: "Chargement du moteur de graphe…",
      af: "Laai grafiekenjin…",
    },
    k_loading_data: {
      ja: "グラフデータを読み込み中…",
      en: "Loading graph data…",
      fr: "Chargement des données du graphe…",
      af: "Laai grafiekdata…",
    },
    k_load_failed: {
      ja: "グラフの読み込みに失敗しました",
      en: "Failed to load graph",
      fr: "Échec du chargement du graphe",
      af: "Kon grafiek nie laai nie",
    },
    k_reload: {
      ja: "再読み込み",
      en: "Reload",
      fr: "Recharger",
      af: "Herlaai",
    },
    k_no_nodes: {
      ja: "グラフに表示するノードがありません",
      en: "No nodes to display in the graph",
      fr: "Aucun nœud à afficher dans le graphe",
      af: "Geen nodusse om in die grafiek te wys nie",
    },
    k_create_links_hint: {
      ja: "ノートと論文にリンクを作成すると、ここに関係図が表示されます",
      en: "Create links between notes and papers to see the graph here",
      fr: "Créez des liens entre notes et articles pour afficher le graphe ici",
      af: "Skep skakels tussen notas en artikels om die grafiek hier te sien",
    },
    k_min_links: {
      ja: "最小リンク数",
      en: "Min. links",
      fr: "Liens min.",
      af: "Min. skakels",
    },
    k_links_count: {
      ja: "${count} リンク",
      en: "${count} links",
      fr: "${count} liens",
      af: "${count} skakels",
    },
  },
  notes: {
    k_footnote_text: {
      ja: "脚注テキスト",
      en: "Footnote text",
      fr: "Texte de note de bas de page",
      af: "Voetnoot teks",
    },
    k_code_placeholder: {
      ja: "コードをここに入力",
      en: "Enter code here",
      fr: "Entrez le code ici",
      af: "Voer kode hier in",
    },
  },
  search: {
    k_tips_title: {
      ja: "検索のコツ:",
      en: "Search tips:",
      fr: "Astuces de recherche :",
      af: "Soek wenke:",
    },
    k_tip_shorter: {
      ja: "・キーワードを短くする",
      en: "· Use shorter keywords",
      fr: "· Utilisez des mots-clés plus courts",
      af: "· Gebruik korter sleutelwoorde",
    },
    k_tip_different: {
      ja: "・別の表現で試す",
      en: "· Try different expressions",
      fr: "· Essayez d'autres expressions",
      af: "· Probeer verskillende uitdrukkings",
    },
    k_tip_all_tab: {
      ja: "・タブを「すべて」にする",
      en: '· Switch to the "All" tab',
      fr: "· Passez à l'onglet « Tout »",
      af: '· Skakel na die "Alles" oortjie',
    },
  },
  qualitative: {
    k_select_placeholder: {
      ja: "選択",
      en: "Select",
      fr: "Sélectionner",
      af: "Kies",
    },
    k_select_project: {
      ja: "プロジェクトを選択",
      en: "Select project",
      fr: "Sélectionner un projet",
      af: "Kies projek",
    },
    k_no_codes: {
      ja: "コードなし",
      en: "No codes",
      fr: "Aucun code",
      af: "Geen kodes",
    },
    k_icr_desc: {
      ja: "Cohen's kappa 係数を用いて、2人のコーダー間の一致度を測定します。",
      en: "Measures inter-coder agreement using Cohen's kappa coefficient.",
      fr: "Mesure l'accord inter-codeurs à l'aide du coefficient kappa de Cohen.",
      af: "Meet interkodeerder-ooreenstemming met Cohen se kappa-koëffisiënt.",
    },
    k_formula: {
      ja: "計算式:",
      en: "Formula:",
      fr: "Formule :",
      af: "Formule:",
    },
    k_main_codes: {
      ja: "メイン:",
      en: "Main:",
      fr: "Principal :",
      af: "Hoof:",
    },
    k_imported_codes: {
      ja: "インポート:",
      en: "Imported:",
      fr: "Importé :",
      af: "Ingevoer:",
    },
    k_thematic: {
      ja: "テーマ分析",
      en: "Thematic analysis",
      fr: "Analyse thématique",
      af: "Tematiese analise",
    },
    k_grounded: {
      ja: "グラウンデッド・セオリー",
      en: "Grounded theory",
      fr: "Théorie ancrée",
      af: "Gegronde teorie",
    },
    k_content_analysis: {
      ja: "内容分析",
      en: "Content analysis",
      fr: "Analyse de contenu",
      af: "Inhoudsanalise",
    },
    k_historical: {
      ja: "歴史的分析",
      en: "Historical analysis",
      fr: "Analyse historique",
      af: "Historiese analise",
    },
    k_comparative: {
      ja: "比較政治分析",
      en: "Comparative political analysis",
      fr: "Analyse politique comparée",
      af: "Vergelykende politieke analise",
    },
    k_all_lanes: {
      ja: "全レーン",
      en: "All lanes",
      fr: "Toutes les voies",
      af: "Alle bane",
    },
    k_independent_var: {
      ja: "独立変数",
      en: "Independent variable",
      fr: "Variable indépendante",
      af: "Onafhanklike veranderlike",
    },
    k_dependent_var: {
      ja: "従属変数",
      en: "Dependent variable",
      fr: "Variable dépendante",
      af: "Afhanklike veranderlike",
    },
    k_control_var: {
      ja: "統制変数",
      en: "Control variable",
      fr: "Variable de contrôle",
      af: "Beheerveranderlike",
    },
  },
  quantitative: {
    k_rows_label: {
      ja: "${count}行",
      en: "${count} rows",
      fr: "${count} lignes",
      af: "${count} rye",
    },
    k_select_project_ds: {
      ja: "プロジェクトを選択...",
      en: "Select project...",
      fr: "Sélectionner un projet...",
      af: "Kies projek...",
    },
    k_all_papers: {
      ja: "全ての論文",
      en: "All papers",
      fr: "Tous les articles",
      af: "Alle artikels",
    },
    k_method_label: {
      ja: "手法:",
      en: "Method:",
      fr: "Méthode :",
      af: "Metode:",
    },
    k_vars_label: {
      ja: "変数:",
      en: "Variables:",
      fr: "Variables :",
      af: "Veranderlikes:",
    },
    k_data_rows_label: {
      ja: "データ行:",
      en: "Data rows:",
      fr: "Lignes de données :",
      af: "Datarye:",
    },
    k_sig_level: {
      ja: "有意水準: α =",
      en: "Significance: α =",
      fr: "Significativité : α =",
      af: "Betekenisvolheid: α =",
    },
    k_format_label: {
      ja: "形式:",
      en: "Format:",
      fr: "Format :",
      af: "Formaat:",
    },
    k_likert_settings: {
      ja: "リッカート設定",
      en: "Likert settings",
      fr: "Paramètres Likert",
      af: "Likert-instellings",
    },
    k_select_analysis: {
      ja: "分析を選択...",
      en: "Select analysis...",
      fr: "Sélectionner une analyse...",
      af: "Kies analise...",
    },
    k_select_chart_analysis: {
      ja: "チャートの分析を選択...",
      en: "Select chart analysis...",
      fr: "Sélectionner l'analyse du graphique...",
      af: "Kies grafiekanalise...",
    },
    k_chart_will_insert: {
      ja: "チャート: ${name} のグラフが挿入されます",
      en: "Chart: ${name} graph will be inserted",
      fr: "Graphique : le graphique de ${name} sera inséré",
      af: "Grafiek: ${name} grafiek sal ingevoeg word",
    },
    k_table_will_insert: {
      ja: "${name} の${tableType}表が挿入されます",
      en: "${name} ${tableType} table will be inserted",
      fr: "Le tableau ${tableType} de ${name} sera inséré",
      af: "${name} ${tableType} tabel sal ingevoeg word",
    },
    k_date_label: {
      ja: "日付:",
      en: "Date:",
      fr: "Date :",
      af: "Datum:",
    },
    k_dataset_label: {
      ja: "データセット:",
      en: "Dataset:",
      fr: "Jeu de données :",
      af: "Datastel:",
    },
    k_median: {
      ja: "中央値:",
      en: "Median:",
      fr: "Médiane :",
      af: "Mediaan:",
    },
    k_mean: {
      ja: "平均:",
      en: "Mean:",
      fr: "Moyenne :",
      af: "Gemiddeld:",
    },
    k_outliers: {
      ja: "外れ値: ${count}件",
      en: "Outliers: ${count}",
      fr: "Valeurs aberrantes : ${count}",
      af: "Uitskieters: ${count}",
    },
    k_group1_mean: {
      ja: "群1平均:",
      en: "Group 1 mean:",
      fr: "Moyenne groupe 1 :",
      af: "Groep 1 gemiddeld:",
    },
    k_group2_mean: {
      ja: "群2平均:",
      en: "Group 2 mean:",
      fr: "Moyenne groupe 2 :",
      af: "Groep 2 gemiddeld:",
    },
    k_t_stat: {
      ja: "t統計量:",
      en: "t-statistic:",
      fr: "Statistique t :",
      af: "t-statistiek:",
    },
    k_df: {
      ja: "自由度:",
      en: "Degrees of freedom:",
      fr: "Degrés de liberté :",
      af: "Grade van vryheid:",
    },
    k_p_value: {
      ja: "p値:",
      en: "p-value:",
      fr: "Valeur p :",
      af: "p-waarde:",
    },
    k_degree: {
      ja: "次数:",
      en: "Degree:",
      fr: "Degré :",
      af: "Graad:",
    },
    k_betweenness: {
      ja: "媒介中心性:",
      en: "Betweenness:",
      fr: "Intermédiarité :",
      af: "Tussenliggendheid:",
    },
    k_closeness: {
      ja: "近接中心性:",
      en: "Closeness:",
      fr: "Proximité :",
      af: "Nabyheid:",
    },
    k_community: {
      ja: "コミュニティ:",
      en: "Community:",
      fr: "Communauté :",
      af: "Gemeenskap:",
    },
    k_issues_not_numeric: {
      ja: "${count}件の値が数値に変換できません",
      en: "${count} values cannot be converted to numbers",
      fr: "${count} valeurs ne peuvent pas être converties en nombres",
      af: "${count} waardes kan nie na getalle omgeskakel word nie",
    },
    k_type_change_warning: {
      ja: "変数タイプを変更すると、この変数を使用した分析結果が無効になる場合があります",
      en: "Changing the variable type may invalidate analysis results that use this variable",
      fr: "Changer le type de variable peut invalider les résultats d'analyse utilisant cette variable",
      af: "Die verandering van die veranderlike tipe kan analise-resultate wat hierdie veranderlike gebruik ongeldig maak",
    },
  },
  settings: {
    k_extension_steps: {
      ja: [
        "1. Chrome Web Store / Firefox Add-ons で「Stellar Clipper」を検索",
        "2. 拡張機能をインストールし、ブラウザのツールバーにピン留め",
        "3. Stellar デスクトップアプリを起動（ローカルサーバーが自動起動）",
        "4. 論文ページで拡張機能アイコンをクリックしてインポート",
      ],
      en: [
        '1. Search "Stellar Clipper" on Chrome Web Store / Firefox Add-ons',
        "2. Install the extension and pin it to the browser toolbar",
        "3. Launch the Stellar desktop app (local server starts automatically)",
        "4. Click the extension icon on a paper page to import",
      ],
      fr: [
        '1. Recherchez « Stellar Clipper » sur Chrome Web Store / Firefox Add-ons',
        "2. Installez l'extension et épinglez-la à la barre d'outils",
        "3. Lancez l'application Stellar (le serveur local démarre automatiquement)",
        "4. Cliquez sur l'icône de l'extension sur une page d'article pour importer",
      ],
      af: [
        '1. Soek "Stellar Clipper" op Chrome Web Store / Firefox Add-ons',
        "2. Installeer die uitbreiding en speld dit aan die werkbalk vas",
        "3. Begin die Stellar-toepassing (plaaslike bediener begin outomaties)",
        "4. Klik op die uitbreidingsikoon op 'n artikelbladsy om in te voer",
      ],
    },
  },
};

// Helper: add keys to a specific section in a language file
function addKeysToSection(content, sectionName, keys, lang) {
  // Find the section's closing brace
  // We look for the pattern: sectionName: { ... }
  const sectionRegex = new RegExp(`(  ${sectionName}:\\s*\\{[\\s\\S]*?)(\\n  \\},)`, "m");
  const match = content.match(sectionRegex);
  if (!match) {
    console.warn(`  Section "${sectionName}" not found in ${lang}`);
    return content;
  }

  let newKeys = "";
  for (const [key, translations] of Object.entries(keys)) {
    // Skip if key already exists
    if (content.includes(`${key}:`)) continue;

    const val = translations[lang] ?? translations.ja;
    if (Array.isArray(val)) {
      // Array value (like extension steps)
      const items = val.map(v => `      "${v}"`).join(",\n");
      newKeys += `    ${key}: [\n${items},\n    ],\n`;
    } else {
      newKeys += `    ${key}: "${val}",\n`;
    }
  }

  if (!newKeys) return content;

  // Insert before the closing },
  return content.replace(sectionRegex, `$1\n${newKeys}$2`);
}

// Process each language file
for (const lang of ["ja", "en", "fr", "af"]) {
  const filePath = path.join(ROOT, "i18n", `${lang}.ts`);
  let content = fs.readFileSync(filePath, "utf8");
  let changed = false;

  for (const [section, keys] of Object.entries(NEW_KEYS)) {
    // settings section is special - it's nested
    if (section === "settings") {
      // Handle settings.k_extension_steps specially - add to exportImport instead
      const exportKeys = { k_extension_steps: keys.k_extension_steps };
      const before = content;
      content = addKeysToSection(content, "exportImport", exportKeys, lang);
      if (content !== before) changed = true;
      continue;
    }
    const before = content;
    content = addKeysToSection(content, section, keys, lang);
    if (content !== before) changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`✅ Updated ${lang}.ts`);
  } else {
    console.log(`⏭️  No changes needed for ${lang}.ts`);
  }
}

console.log("\n=== Phase 2: Replace hardcoded Japanese strings in components ===\n");

// ─── COMPONENT REPLACEMENTS ───
const replacements = [
  // MainPane.tsx
  {
    file: "components/layout/MainPane.tsx",
    changes: [
      {
        old: `        サイドバーから文献やノートを選択するか、\n        <br />\n        新しい文献を追加して研究を始めましょう。`,
        new: `        {useI18nStore.getState().t.layout.k_welcome_desc.split("\\n").map((line, i) => (\n          <span key={i}>{line}{i === 0 && <br />}</span>\n        ))}`,
      },
    ],
  },
  // ContextPanel.tsx
  {
    file: "components/layout/ContextPanel.tsx",
    changes: [
      { old: `          詳細情報`, new: `          {t.layout.k_detail_info}` },
      { old: `          コンテキストパネル — 実装予定`, new: `          {t.layout.k_context_placeholder}` },
      {
        old: `          論文選択時: メタデータ・ハイライト・関連ノート\n          <br />\n          ノート選択時: リンク先一覧・タグ`,
        new: `          {t.layout.k_context_paper}\n          <br />\n          {t.layout.k_context_note}`,
      },
    ],
  },
  // LibraryView.tsx
  {
    file: "components/library/LibraryView.tsx",
    changes: [
      {
        old: "                タグ {filterTag !== null ? `(${filterTag})` : \"▼\"}",
        new: "                {t.library.k_tag_filter} {filterTag !== null ? `(${filterTag})` : \"▼\"}",
      },
      {
        old: "                年 {filterYear !== null ? `(${filterYear})` : \"▼\"}",
        new: "                {t.library.k_year_filter} {filterYear !== null ? `(${filterYear})` : \"▼\"}",
      },
      {
        old: "                    すべてのタグ",
        new: "                    {t.library.k_all_tags}",
      },
      {
        old: "                      タグがありません",
        new: "                      {t.library.k_no_tags}",
      },
      {
        old: "const confirmed = await swalConfirm(t.library.k_cdyrih, `「${title}」を削除しますか？\\nこの操作は取り消せません。`);",
        new: "const confirmed = await swalConfirm(t.library.k_cdyrih, t.library.k_wf1by1.replace(\"${title}\", title));",
      },
    ],
  },
  // PaperDetailPanel.tsx
  {
    file: "components/library/PaperDetailPanel.tsx",
    changes: [
      {
        old: "                  他 {highlights.length - 3} 件を表示...",
        new: "                  {t.library.k_show_more_highlights.replace(\"${count}\", String(highlights.length - 3))}",
      },
      {
        old: "                <span>追加</span>",
        new: "                <span>{t.library.k_add_label}</span>",
      },
    ],
  },
  // PaperCard.tsx
  {
    file: "components/library/PaperCard.tsx",
    changes: [
      {
        old: "            <span>PDFを追加</span>",
        new: "            <span>{useI18nStore.getState().t.library.k_attach_pdf}</span>",
      },
    ],
  },
  // ForceGraph.tsx
  {
    file: "components/graph/ForceGraph.tsx",
    changes: [
      {
        old: '<span className="text-xs">グラフエンジンを読み込み中…</span>',
        new: '<span className="text-xs">{useI18nStore.getState().t.graph.k_loading_engine}</span>',
      },
    ],
  },
  // GraphView.tsx
  {
    file: "components/graph/GraphView.tsx",
    changes: [
      {
        old: '<span className="text-sm">グラフデータを読み込み中…</span>',
        new: '<span className="text-sm">{useI18nStore.getState().t.graph.k_loading_data}</span>',
      },
      {
        old: '<span className="text-sm">グラフの読み込みに失敗しました</span>',
        new: '<span className="text-sm">{useI18nStore.getState().t.graph.k_load_failed}</span>',
      },
      {
        old: "            再読み込み",
        new: "            {useI18nStore.getState().t.graph.k_reload}",
      },
      {
        old: '<p className="text-sm mb-1">グラフに表示するノードがありません</p>',
        new: '<p className="text-sm mb-1">{useI18nStore.getState().t.graph.k_no_nodes}</p>',
      },
      {
        old: `            <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>\n              ノートと論文にリンクを作成すると、ここに関係図が表示されます`,
        new: `            <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>\n              {useI18nStore.getState().t.graph.k_create_links_hint}`,
      },
    ],
  },
  // GraphFilterPanel.tsx
  {
    file: "components/graph/GraphFilterPanel.tsx",
    changes: [
      {
        old: "<span>最小リンク数</span>",
        new: "<span>{useI18nStore.getState().t.graph.k_min_links}</span>",
      },
    ],
  },
  // GraphLegendPanel.tsx
  {
    file: "components/graph/GraphLegendPanel.tsx",
    changes: [
      {
        old: "<span>{linkCount} リンク</span>",
        new: "<span>{useI18nStore.getState().t.graph.k_links_count.replace(\"${count}\", String(linkCount))}</span>",
      },
    ],
  },
  // StellarEditor.tsx
  {
    file: "components/notes/StellarEditor.tsx",
    changes: [
      {
        old: "const def = `\\n\\n[^${id}]: 脚注テキスト`;",
        new: "const def = `\\n\\n[^${id}]: ${useI18nStore.getState().t.notes.k_footnote_text}`;",
      },
      {
        old: "insertBlock(\"```\\nコードをここに入力\\n```\")",
        new: "insertBlock(`\\`\\`\\`\\n${useI18nStore.getState().t.notes.k_code_placeholder}\\n\\`\\`\\``)",
      },
    ],
  },
  // SearchResults.tsx
  {
    file: "components/search/SearchResults.tsx",
    changes: [
      {
        old: "<p>検索のコツ:</p>",
        new: "<p>{useI18nStore.getState().t.search.k_tips_title}</p>",
      },
      {
        old: "<p>・キーワードを短くする</p>",
        new: "<p>{useI18nStore.getState().t.search.k_tip_shorter}</p>",
      },
      {
        old: "<p>・別の表現で試す</p>",
        new: "<p>{useI18nStore.getState().t.search.k_tip_different}</p>",
      },
      {
        old: "<p>・タブを「すべて」にする</p>",
        new: "<p>{useI18nStore.getState().t.search.k_tip_all_tab}</p>",
      },
    ],
  },
  // SettingsView.tsx (extension steps)
  {
    file: "components/settings/SettingsView.tsx",
    changes: [
      {
        old: `                "1. Chrome Web Store / Firefox Add-ons で「Stellar Clipper」を検索",\n                "2. 拡張機能をインストールし、ブラウザのツールバーにピン留め",\n                "3. Stellar デスクトップアプリを起動（ローカルサーバーが自動起動）",\n                "4. 論文ページで拡張機能アイコンをクリックしてインポート",`,
        new: `                ...(t.exportImport.k_extension_steps ?? [\n                  "1. Search Stellar Clipper on Chrome Web Store / Firefox Add-ons",\n                  "2. Install and pin the extension",\n                  "3. Launch Stellar desktop app",\n                  "4. Click the extension icon on a paper page to import",\n                ]),`,
      },
    ],
  },
  // QualitativeView.tsx
  {
    file: "components/qualitative/QualitativeView.tsx",
    changes: [
      { old: '<option value="thematic">テーマ分析</option>', new: '<option value="thematic">{t.qualitative.k_thematic}</option>' },
      { old: '<option value="grounded">グラウンデッド・セオリー</option>', new: '<option value="grounded">{t.qualitative.k_grounded}</option>' },
      { old: '<option value="content">内容分析</option>', new: '<option value="content">{t.qualitative.k_content_analysis}</option>' },
      { old: '<option value="historical">歴史的分析</option>', new: '<option value="historical">{t.qualitative.k_historical}</option>' },
      { old: '<option value="comparative">比較政治分析</option>', new: '<option value="comparative">{t.qualitative.k_comparative}</option>' },
    ],
  },
  // ActorMapView.tsx
  {
    file: "components/qualitative/ActorMapView.tsx",
    changes: [
      { old: '<option value="">選択</option>', new: '<option value="">{t.qualitative.k_select_placeholder}</option>', all: true },
    ],
  },
  // CodePanel.tsx
  {
    file: "components/qualitative/CodePanel.tsx",
    changes: [
      { old: '<option value="">プロジェクトを選択</option>', new: '<option value="">{t.qualitative.k_select_project}</option>' },
      { old: "<span>コードなし</span>", new: "<span>{t.qualitative.k_no_codes}</span>" },
    ],
  },
  // TimelineView.tsx
  {
    file: "components/qualitative/TimelineView.tsx",
    changes: [
      { old: '<option value="">全レーン</option>', new: '<option value="">{t.qualitative.k_all_lanes}</option>' },
    ],
  },
  // ComparativeDesignView.tsx
  {
    file: "components/qualitative/ComparativeDesignView.tsx",
    changes: [
      { old: '<option value="independent">独立変数</option>', new: '<option value="independent">{t.qualitative.k_independent_var}</option>' },
      { old: '<option value="dependent">従属変数</option>', new: '<option value="dependent">{t.qualitative.k_dependent_var}</option>' },
      { old: '<option value="control">統制変数</option>', new: '<option value="control">{t.qualitative.k_control_var}</option>' },
    ],
  },
  // IcrCalculator.tsx
  {
    file: "components/qualitative/IcrCalculator.tsx",
    changes: [
      {
        old: "\"Cohen's kappa 係数を用いて、2人のコーダー間の一致度を測定します。\"",
        new: "t.qualitative.k_icr_desc",
      },
      { old: "<strong>計算式:</strong>", new: "<strong>{t.qualitative.k_formula}</strong>" },
      { old: "<span>メイン: [{d.mainCodes.join(\", \")}]</span>", new: "<span>{t.qualitative.k_main_codes} [{d.mainCodes.join(\", \")}]</span>" },
      { old: "<span>インポート: [{d.importedCodes.join(\", \")}]</span>", new: "<span>{t.qualitative.k_imported_codes} [{d.importedCodes.join(\", \")}]</span>" },
    ],
  },
  // DatasetList.tsx
  {
    file: "components/quantitative/DatasetList.tsx",
    changes: [
      { old: "<span>{ds.rowCount}行</span>", new: "<span>{t.quantitative.k_rows_label.replace(\"${count}\", String(ds.rowCount))}</span>" },
      { old: '<option value="">プロジェクトを選択...</option>', new: '<option value="">{t.quantitative.k_select_project_ds}</option>' },
      { old: '<option value="">全ての論文</option>', new: '<option value="">{t.quantitative.k_all_papers}</option>' },
    ],
  },
  // AnalysisWizard.tsx
  {
    file: "components/quantitative/AnalysisWizard.tsx",
    changes: [
      { old: '<span>手法: {METHODS.find((m) => m.key === method)?.label}</span>', new: '<span>{t.quantitative.k_method_label} {METHODS.find((m) => m.key === method)?.label}</span>' },
      { old: '<span>変数: {selectedVarIds.length}個</span>', new: '<span>{t.quantitative.k_vars_label} {selectedVarIds.length}</span>' },
      { old: "<span>有意水準: α = {alpha}</span>", new: "<span>{t.quantitative.k_sig_level} {alpha}</span>" },
    ],
  },
  // VariableManager.tsx
  {
    file: "components/quantitative/VariableManager.tsx",
    changes: [
      { old: "<span>形式: {variable.dateFormat}</span>", new: "<span>{t.quantitative.k_format_label} {variable.dateFormat}</span>" },
      { old: "<span>リッカート設定</span>", new: "<span>{t.quantitative.k_likert_settings}</span>" },
    ],
  },
  // ReportBuilder.tsx
  {
    file: "components/quantitative/ReportBuilder.tsx",
    changes: [
      { old: '<option value="">分析を選択...</option>', new: '<option value="">{useI18nStore.getState().t.quantitative.k_select_analysis}</option>', all: true },
      { old: '<option value="">チャートの分析を選択...</option>', new: '<option value="">{useI18nStore.getState().t.quantitative.k_select_chart_analysis}</option>' },
      { old: "<span>日付: {today}</span>", new: "<span>{useI18nStore.getState().t.quantitative.k_date_label} {today}</span>" },
      { old: "<span>| データセット: {selectedDataset.name}</span>", new: "<span>| {useI18nStore.getState().t.quantitative.k_dataset_label} {selectedDataset.name}</span>" },
    ],
  },
  // InferentialResult.tsx
  {
    file: "components/quantitative/results/InferentialResult.tsx",
    changes: [
      { old: "<span>群1平均: {fmt(result.mean1, 4)}</span>", new: "<span>{t.quantitative.k_group1_mean} {fmt(result.mean1, 4)}</span>" },
      { old: "<span>群2平均: {fmt(result.mean2 ?? NaN, 4)}</span>", new: "<span>{t.quantitative.k_group2_mean} {fmt(result.mean2 ?? NaN, 4)}</span>" },
      { old: "<span>t統計量: {fmt(result.t, 6)}</span>", new: "<span>{t.quantitative.k_t_stat} {fmt(result.t, 6)}</span>" },
      { old: "<span>自由度: {fmt(result.df, 4)}</span>", new: "<span>{t.quantitative.k_df} {fmt(result.df, 4)}</span>" },
      { old: "<span>p値: {result.pValue.toExponential(4)}</span>", new: "<span>{t.quantitative.k_p_value} {result.pValue.toExponential(4)}</span>" },
    ],
  },
  // NetworkAnalysisView.tsx
  {
    file: "components/quantitative/results/NetworkAnalysisView.tsx",
    changes: [
      { old: "<span>次数: {tooltipData.node.degree}</span>", new: "<span>{t.quantitative.k_degree} {tooltipData.node.degree}</span>" },
      { old: "<span>媒介中心性: {fmt(tooltipData.node.betweenness)}</span>", new: "<span>{t.quantitative.k_betweenness} {fmt(tooltipData.node.betweenness)}</span>" },
      { old: "<span>近接中心性: {fmt(tooltipData.node.closeness)}</span>", new: "<span>{t.quantitative.k_closeness} {fmt(tooltipData.node.closeness)}</span>" },
      { old: "<span>コミュニティ: {tooltipData.node.community + 1}</span>", new: "<span>{t.quantitative.k_community} {tooltipData.node.community + 1}</span>" },
    ],
  },
  // BoxPlot.tsx (chart tooltip)
  {
    file: "components/quantitative/charts/BoxPlot.tsx",
    changes: [
      {
        old: "`<strong>${label}</strong><br/>中央値: ${fmt(stats.median)}<br/>Q1: ${fmt(stats.q1)} / Q3: ${fmt(stats.q3)}<br/>平均: ${fmt(stats.mean)}${stats.outliers.length > 0 ? `<br/>外れ値: ${stats.outliers.length}件` : \"\"}`",
        new: "`<strong>${label}</strong><br/>${t.quantitative.k_median} ${fmt(stats.median)}<br/>Q1: ${fmt(stats.q1)} / Q3: ${fmt(stats.q3)}<br/>${t.quantitative.k_mean} ${fmt(stats.mean)}${stats.outliers.length > 0 ? `<br/>${t.quantitative.k_outliers.replace(\"\\${count}\", String(stats.outliers.length))}` : \"\"}`",
      },
    ],
  },
  // CsvImporter.tsx
  {
    file: "components/quantitative/CsvImporter.tsx",
    changes: [
      {
        old: "<IconWarning size={12} /> {issue.issues}件の値が数値に変換できません",
        new: "<IconWarning size={12} /> {t.quantitative.k_issues_not_numeric.replace(\"${count}\", String(issue.issues))}",
      },
    ],
  },
  // VariableManager.tsx (type change warning)
  {
    file: "components/quantitative/VariableManager.tsx",
    changes: [
      {
        old: "変数タイプを変更すると、この変数を使用した分析結果が無効になる場合があります",
        new: "{t.quantitative.k_type_change_warning}",
      },
    ],
  },
  // AnalysisReport.tsx (qualitative)
  {
    file: "components/qualitative/AnalysisReport.tsx",
    changes: [
      {
        old: "setReport(`エラー: ${typeof err === \"string\" ? err : t.qualitative.k_xbkqi6}`);",
        new: "setReport(`${t.common.error ?? \"Error\"}: ${typeof err === \"string\" ? err : t.qualitative.k_xbkqi6}`);",
      },
    ],
  },
];

let totalReplacements = 0;
let failedReplacements = 0;

for (const { file, changes } of replacements) {
  const filePath = path.join(ROOT, file);
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  File not found: ${file}`);
    continue;
  }
  let content = fs.readFileSync(filePath, "utf8");
  let fileChanged = false;

  for (const { old: oldStr, new: newStr, all } of changes) {
    if (content.includes(oldStr)) {
      if (all) {
        content = content.replaceAll(oldStr, newStr);
      } else {
        content = content.replace(oldStr, newStr);
      }
      fileChanged = true;
      totalReplacements++;
    } else {
      console.warn(`  ⚠️  Pattern not found in ${file}: "${oldStr.slice(0, 60)}..."`);
      failedReplacements++;
    }
  }

  if (fileChanged) {
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`✅ Updated ${file}`);
  }
}

console.log(`\n=== Summary ===`);
console.log(`✅ Successful replacements: ${totalReplacements}`);
if (failedReplacements > 0) {
  console.log(`⚠️  Failed patterns: ${failedReplacements}`);
}
console.log("Done!");
