// japanese-text-mining/index.js
// Stellar Add-on Plugin — 日本語テキストマイニング
//
// 配布方法:
//   このフォルダ（stellar-plugin.json と index.js）を zip 化し、
//   Stellar の 設定 > アドオン/プラグイン から追加します。
//
// 機能:
//   - 日本語テキスト変数の頻出語ランキング
//   - 文字種（漢字・ひらがな・カタカナ・英数字・記号）の構成比
//   - 連続語（2-gram / 3-gram）の頻度
//   - 上位語の KWIC（前後文脈）サンプル

const DEFAULT_STOPWORDS = new Set([
  "これ", "それ", "あれ", "ここ", "そこ", "ため", "もの", "こと", "よう", "さん",
  "する", "した", "して", "いる", "ある", "なる", "ない", "です", "ます", "から",
  "まで", "また", "そして", "しかし", "ので", "など", "について", "として", "という",
  "および", "または", "より", "この", "その", "あの", "どの", "でも", "では", "には",
]);

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function classifyChar(char) {
  if (/\p{Script=Han}/u.test(char)) return "kanji";
  if (/\p{Script=Hiragana}/u.test(char)) return "hiragana";
  if (/\p{Script=Katakana}/u.test(char)) return "katakana";
  if (/[A-Za-z0-9]/.test(char)) return "latinNumber";
  if (/\s/.test(char)) return "space";
  return "symbol";
}

function countCharacterTypes(texts) {
  const counts = {
    kanji: 0,
    hiragana: 0,
    katakana: 0,
    latinNumber: 0,
    symbol: 0,
    space: 0,
  };
  for (const text of texts) {
    for (const char of text) {
      counts[classifyChar(char)] += 1;
    }
  }
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0) || 1;
  return Object.entries(counts).map(([key, count]) => ({
    key,
    label: {
      kanji: "漢字",
      hiragana: "ひらがな",
      katakana: "カタカナ",
      latinNumber: "英数字",
      symbol: "記号",
      space: "空白",
    }[key],
    count,
    rate: count / total,
  }));
}

function tokenizeJapanese(text) {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const tokens = normalized.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]+|[A-Za-z0-9][A-Za-z0-9._-]*/gu) ?? [];
  return tokens
    .flatMap((token) => splitJapaneseToken(token))
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .filter((token) => !DEFAULT_STOPWORDS.has(token));
}

function splitJapaneseToken(token) {
  const segments = [];
  let current = "";
  let previousType = "";

  for (const char of token) {
    const type = classifyChar(char);
    const compatible =
      (previousType === "kanji" && type === "hiragana") ||
      (previousType === "hiragana" && type === "kanji") ||
      previousType === type;

    if (current && !compatible) {
      segments.push(current);
      current = char;
    } else {
      current += char;
    }
    previousType = type;
  }
  if (current) segments.push(current);

  if (segments.length <= 1) return [token];
  return segments.filter((segment) => segment.length >= 2);
}

function increment(map, key, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function topEntries(map, limit) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
    .slice(0, limit)
    .map(([term, frequency]) => ({ term, frequency }));
}

function buildNgrams(tokens, n) {
  const map = new Map();
  for (let i = 0; i <= tokens.length - n; i += 1) {
    increment(map, tokens.slice(i, i + n).join(" "));
  }
  return topEntries(map, 20);
}

function buildKwic(texts, terms, windowSize = 18) {
  const rows = [];
  for (const term of terms) {
    for (const text of texts) {
      const index = text.indexOf(term);
      if (index < 0) continue;
      rows.push({
        term,
        left: text.slice(Math.max(0, index - windowSize), index),
        keyword: text.slice(index, index + term.length),
        right: text.slice(index + term.length, index + term.length + windowSize),
      });
      if (rows.filter((row) => row.term === term).length >= 3) break;
    }
  }
  return rows;
}

function analyzeVariable(variable, rows) {
  const texts = rows
    .map((row) => normalizeText(row.values[variable.name] ?? row.values[variable.id]))
    .filter(Boolean);
  const tokenLists = texts.map(tokenizeJapanese);
  const allTokens = tokenLists.flat();
  const frequencyMap = new Map();
  const documentMap = new Map();

  for (const tokens of tokenLists) {
    const unique = new Set(tokens);
    for (const token of tokens) increment(frequencyMap, token);
    for (const token of unique) increment(documentMap, token);
  }

  const topWords = topEntries(frequencyMap, 30).map((entry) => ({
    ...entry,
    documentCount: documentMap.get(entry.term) ?? 0,
  }));

  return {
    variableId: variable.id,
    variableName: variable.name,
    documentCount: texts.length,
    totalCharacters: texts.reduce((sum, text) => sum + text.length, 0),
    totalTokens: allTokens.length,
    uniqueTokens: frequencyMap.size,
    topWords,
    bigrams: buildNgrams(allTokens, 2),
    trigrams: buildNgrams(allTokens, 3),
    characterTypes: countCharacterTypes(texts),
    kwic: buildKwic(texts, topWords.slice(0, 5).map((word) => word.term)),
  };
}

function numberFormat(value) {
  return new Intl.NumberFormat("ja-JP").format(value);
}

function percentFormat(value) {
  return new Intl.NumberFormat("ja-JP", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

function createIcon(h) {
  return h(
    "svg",
    {
      width: 28,
      height: 28,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.8,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
    h("path", { d: "M4 5h16" }),
    h("path", { d: "M4 12h10" }),
    h("path", { d: "M4 19h7" }),
    h("circle", { cx: 18, cy: 16, r: 3 }),
    h("path", { d: "m20.5 18.5 1.5 1.5" }),
  );
}

function renderMetricCard(h, label, value, helper) {
  return h(
    "div",
    {
      style: {
        padding: "14px",
        backgroundColor: "var(--color-bg-secondary)",
        border: "1px solid var(--color-border-primary)",
        borderRadius: "var(--radius-lg)",
      },
    },
    h("div", { style: { fontSize: "11px", color: "var(--color-text-tertiary)", marginBottom: "6px" } }, label),
    h("div", { style: { fontSize: "22px", fontWeight: 700, color: "var(--color-text-primary)" } }, value),
    helper ? h("div", { style: { fontSize: "11px", color: "var(--color-text-secondary)", marginTop: "4px" } }, helper) : null,
  );
}

function renderTable(h, title, headers, rows) {
  return h(
    "section",
    { style: { marginTop: "18px" } },
    h("h4", { style: { fontSize: "13px", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "8px" } }, title),
    h(
      "div",
      {
        style: {
          overflowX: "auto",
          border: "1px solid var(--color-border-primary)",
          borderRadius: "var(--radius-lg)",
        },
      },
      h(
        "table",
        { style: { width: "100%", borderCollapse: "collapse", fontSize: "12px" } },
        h(
          "thead",
          null,
          h(
            "tr",
            null,
            ...headers.map((header) => h("th", {
              key: header,
              style: {
                padding: "8px 10px",
                textAlign: "left",
                color: "var(--color-text-secondary)",
                backgroundColor: "var(--color-bg-secondary)",
                borderBottom: "1px solid var(--color-border-primary)",
              },
            }, header)),
          ),
        ),
        h("tbody", null, ...rows),
      ),
    ),
  );
}

function renderResultPanel(h, result) {
  const variableResults = Array.isArray(result?.variableResults) ? result.variableResults : [];
  if (variableResults.length === 0) {
    return h("div", { style: { padding: "24px", color: "var(--color-text-secondary)" } }, "表示できる結果がありません。");
  }

  return h(
    "div",
    { style: { padding: "24px", color: "var(--color-text-primary)", overflow: "auto", height: "100%" } },
    h("h3", { style: { fontSize: "18px", fontWeight: 700, marginBottom: "6px" } }, "日本語テキストマイニング"),
    h("p", { style: { fontSize: "12px", color: "var(--color-text-secondary)", marginBottom: "18px" } }, "形態素解析エンジンを使わず、ブラウザ内で日本語テキストの概要を軽量に集計します。"),
    ...variableResults.map((item) => h(
      "article",
      { key: item.variableId, style: { marginBottom: "28px" } },
      h("h4", { style: { fontSize: "15px", fontWeight: 700, marginBottom: "12px" } }, item.variableName),
      h(
        "div",
        { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px" } },
        renderMetricCard(h, "文書数", numberFormat(item.documentCount), "空欄を除外"),
        renderMetricCard(h, "総文字数", numberFormat(item.totalCharacters), "NFKC正規化後"),
        renderMetricCard(h, "総トークン数", numberFormat(item.totalTokens), "ストップワード除外後"),
        renderMetricCard(h, "異なり語数", numberFormat(item.uniqueTokens), "2文字以上"),
      ),
      renderTable(
        h,
        "頻出語",
        ["語", "頻度", "出現文書数"],
        item.topWords.slice(0, 15).map((word) => h("tr", { key: word.term },
          h("td", { style: cellStyle() }, word.term),
          h("td", { style: cellStyle() }, numberFormat(word.frequency)),
          h("td", { style: cellStyle() }, numberFormat(word.documentCount)),
        )),
      ),
      renderTable(
        h,
        "文字種の構成",
        ["文字種", "文字数", "比率"],
        item.characterTypes.map((entry) => h("tr", { key: entry.key },
          h("td", { style: cellStyle() }, entry.label),
          h("td", { style: cellStyle() }, numberFormat(entry.count)),
          h("td", { style: cellStyle() }, percentFormat(entry.rate)),
        )),
      ),
      renderTable(
        h,
        "2-gram / 3-gram 上位",
        ["種類", "語列", "頻度"],
        [
          ...item.bigrams.slice(0, 10).map((entry) => ({ ...entry, kind: "2-gram" })),
          ...item.trigrams.slice(0, 10).map((entry) => ({ ...entry, kind: "3-gram" })),
        ].map((entry) => h("tr", { key: `${entry.kind}-${entry.term}` },
          h("td", { style: cellStyle() }, entry.kind),
          h("td", { style: cellStyle() }, entry.term),
          h("td", { style: cellStyle() }, numberFormat(entry.frequency)),
        )),
      ),
      renderTable(
        h,
        "KWIC サンプル",
        ["語", "左文脈", "キーワード", "右文脈"],
        item.kwic.map((row, index) => h("tr", { key: `${row.term}-${index}` },
          h("td", { style: cellStyle() }, row.term),
          h("td", { style: cellStyle() }, row.left),
          h("td", { style: { ...cellStyle(), fontWeight: 700, color: "var(--color-accent-primary)" } }, row.keyword),
          h("td", { style: cellStyle() }, row.right),
        )),
      ),
    )),
  );
}

function cellStyle() {
  return {
    padding: "8px 10px",
    borderBottom: "1px solid var(--color-border-secondary)",
    color: "var(--color-text-primary)",
    verticalAlign: "top",
  };
}

export function register(api) {
  const React = api.React;
  const h = React.createElement;

  api.registerQuantitativeAnalysisAddon({
    id: "jp-text-mining",
    label: "日本語テキストマイニング",
    description: "日本語テキスト変数から頻出語、文字種、N-gram、KWICを抽出します。",
    icon: createIcon(h),
    color: "#ec4899",
    groupKey: "text",
    groupLabel: "テキスト分析",
    minVariables: 1,
    supportsVariable: (variable) => variable.variableType === "text",
    validate: ({ selectedVariables, dataRows }) => {
      const warnings = [];
      const hasText = selectedVariables.some((variable) =>
        dataRows.some((row) => normalizeText(row.values[variable.name] ?? row.values[variable.id]).length > 0),
      );
      if (!hasText) warnings.push("選択したテキスト変数に分析可能な値がありません。");
      return warnings;
    },
    run: ({ selectedVariables, dataRows }) => ({
      generatedAt: new Date().toISOString(),
      variableResults: selectedVariables.map((variable) => analyzeVariable(variable, dataRows)),
      notes: [
        "このプラグインは軽量なルールベース分割を使用します。厳密な形態素解析が必要な場合は、内蔵テキスト分析や専門ツールの結果と併用してください。",
      ],
    }),
    renderResult: ({ analysis }) => renderResultPanel(h, analysis.result),
  });
}
