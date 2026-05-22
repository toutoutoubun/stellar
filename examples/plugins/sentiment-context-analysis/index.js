const PLUGIN_ID = "sentiment-context-analysis.panel";
const DEFAULT_WINDOW_SIZE = 5;
const DEFAULT_TOP_N = 50;
const STORAGE_PREFIX = "stellar.sentimentContextAnalysis";
let stellarInvoke = null;

const DEFAULT_LEXICON = [
  "良い,1,positive",
  "よい,1,positive",
  "改善,1,positive",
  "有効,1,positive",
  "支持,1,positive",
  "成功,1,positive",
  "安定,1,positive",
  "good,1,positive",
  "positive,1,positive",
  "effective,1,positive",
  "support,1,positive",
  "success,1,positive",
  "悪い,-1,negative",
  "悪化,-1,negative",
  "懸念,-1,negative",
  "問題,-1,negative",
  "失敗,-1,negative",
  "不安,-1,negative",
  "bad,-1,negative",
  "negative,-1,negative",
  "concern,-1,negative",
  "problem,-1,negative",
  "failure,-1,negative",
].join("\n");

const DEFAULT_STOPWORDS = [
  "これ",
  "それ",
  "あれ",
  "ここ",
  "そこ",
  "こと",
  "もの",
  "ため",
  "よう",
  "する",
  "した",
  "して",
  "いる",
  "ある",
  "なる",
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "for",
  "with",
  "on",
  "at",
  "by",
].join("\n");

const styles = {
  panel: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    height: "100%",
    minHeight: "560px",
    padding: "18px",
    overflow: "auto",
    color: "var(--color-text-primary)",
    backgroundColor: "var(--color-bg-primary)",
    fontFamily: "var(--font-family-sans)",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "16px",
  },
  titleWrap: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  title: {
    margin: 0,
    fontSize: "18px",
    fontWeight: 700,
    lineHeight: 1.35,
  },
  description: {
    margin: "4px 0 0",
    maxWidth: "760px",
    fontSize: "12px",
    lineHeight: 1.6,
    color: "var(--color-text-secondary)",
  },
  toolbar: {
    display: "grid",
    gridTemplateColumns:
      "minmax(240px, 1.25fr) minmax(150px, 0.7fr) minmax(180px, 0.9fr) minmax(140px, 0.7fr)",
    gap: "10px",
    alignItems: "end",
    padding: "12px",
    border: "1px solid var(--color-border-primary)",
    borderRadius: "8px",
    backgroundColor: "var(--color-bg-secondary)",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    minWidth: 0,
    fontSize: "11px",
    fontWeight: 700,
    color: "var(--color-text-tertiary)",
  },
  input: {
    width: "100%",
    height: "32px",
    padding: "0 8px",
    border: "1px solid var(--color-border-primary)",
    borderRadius: "6px",
    backgroundColor: "var(--color-bg-primary)",
    color: "var(--color-text-primary)",
    fontSize: "12px",
  },
  range: {
    width: "100%",
    accentColor: "var(--color-accent-primary)",
  },
  button: {
    height: "32px",
    padding: "0 12px",
    border: "1px solid var(--color-accent-primary)",
    borderRadius: "6px",
    backgroundColor: "var(--color-accent-primary)",
    color: "var(--color-accent-contrast, #fff)",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  secondaryButton: {
    height: "28px",
    padding: "0 9px",
    border: "1px solid var(--color-border-primary)",
    borderRadius: "5px",
    backgroundColor: "var(--color-bg-tertiary)",
    color: "var(--color-text-primary)",
    fontSize: "11px",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  disabledButton: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  editorGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(280px, 1fr) minmax(280px, 1fr) minmax(220px, 0.75fr)",
    gap: "12px",
    alignItems: "stretch",
  },
  section: {
    border: "1px solid var(--color-border-primary)",
    borderRadius: "8px",
    backgroundColor: "var(--color-bg-card)",
    overflow: "hidden",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    padding: "10px 12px",
    borderBottom: "1px solid var(--color-border-secondary)",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1.3,
  },
  sectionBody: {
    padding: "12px",
  },
  textArea: {
    width: "100%",
    minHeight: "150px",
    resize: "vertical",
    padding: "10px",
    border: "1px solid var(--color-border-primary)",
    borderRadius: "6px",
    backgroundColor: "var(--color-bg-primary)",
    color: "var(--color-text-primary)",
    fontSize: "12px",
    lineHeight: 1.5,
    fontFamily: "var(--font-family-mono, monospace)",
  },
  metrics: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "10px",
  },
  metric: {
    minHeight: "72px",
    padding: "11px 12px",
    border: "1px solid var(--color-border-secondary)",
    borderRadius: "8px",
    backgroundColor: "var(--color-bg-secondary)",
  },
  metricLabel: {
    margin: 0,
    fontSize: "11px",
    fontWeight: 700,
    color: "var(--color-text-tertiary)",
  },
  metricValue: {
    margin: "7px 0 0",
    fontSize: "24px",
    lineHeight: 1.1,
    fontWeight: 800,
    color: "var(--color-text-primary)",
    fontVariantNumeric: "tabular-nums",
  },
  resultGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(280px, 0.85fr) minmax(360px, 1.25fr)",
    gap: "14px",
    alignItems: "start",
  },
  tableWrap: {
    maxHeight: "360px",
    overflow: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "12px",
  },
  th: {
    position: "sticky",
    top: 0,
    zIndex: 1,
    padding: "7px 8px",
    borderBottom: "1px solid var(--color-border-secondary)",
    backgroundColor: "var(--color-bg-card)",
    color: "var(--color-text-tertiary)",
    fontSize: "11px",
    fontWeight: 700,
    textAlign: "left",
  },
  td: {
    padding: "7px 8px",
    borderBottom: "1px solid var(--color-border-secondary)",
    color: "var(--color-text-primary)",
    verticalAlign: "top",
  },
  empty: {
    padding: "28px 12px",
    textAlign: "center",
    color: "var(--color-text-tertiary)",
    fontSize: "12px",
    lineHeight: 1.7,
  },
  status: {
    padding: "8px 10px",
    border: "1px solid var(--color-border-secondary)",
    borderRadius: "6px",
    backgroundColor: "var(--color-bg-secondary)",
    color: "var(--color-text-secondary)",
    fontSize: "12px",
    lineHeight: 1.6,
  },
  error: {
    padding: "8px 10px",
    border: "1px solid rgba(220, 38, 38, 0.28)",
    borderRadius: "6px",
    backgroundColor: "rgba(220, 38, 38, 0.08)",
    color: "var(--color-danger, #dc2626)",
    fontSize: "12px",
    lineHeight: 1.6,
  },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "22px",
    padding: "2px 7px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 700,
    border: "1px solid var(--color-border-secondary)",
    backgroundColor: "var(--color-bg-secondary)",
  },
  snippet: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    gap: "8px",
    alignItems: "center",
    minWidth: "320px",
  },
  snippetSide: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "var(--color-text-secondary)",
  },
  snippetTarget: {
    padding: "2px 7px",
    borderRadius: "5px",
    backgroundColor: "var(--color-accent-primary)",
    color: "var(--color-accent-contrast, #fff)",
    fontWeight: 800,
  },
};

export function register(api) {
  const React = api.React;
  const h = React.createElement;
  stellarInvoke = typeof api.invoke === "function" ? api.invoke.bind(api) : null;

  api.registerQualitativeAnalysisAddon({
    id: PLUGIN_ID,
    label: "センチメント文脈",
    description: "評価語辞書と対象語の前後N語を集計します。",
    icon: (props) => SentimentIcon(h, props),
    order: 110,
    render: (context) => h(SentimentContextPanel, { api, context }),
  });

  console.log("[sentiment-context-analysis] qualitative analysis addon registered.");
}

function SentimentContextPanel({ api, context }) {
  const React = api.React;
  const h = React.createElement;
  const projectId = context?.projectId || context?.project?.id || "";

  const [codes, setCodes] = React.useState([]);
  const [scope, setScope] = React.useState("sources");
  const [locale, setLocale] = React.useState("auto");
  const [windowSize, setWindowSize] = React.useState(DEFAULT_WINDOW_SIZE);
  const [topN, setTopN] = React.useState(DEFAULT_TOP_N);
  const [lexiconText, setLexiconText] = React.useState(() =>
    readStorage(`${STORAGE_PREFIX}.lexicon`, DEFAULT_LEXICON),
  );
  const [targetText, setTargetText] = React.useState(() =>
    readStorage(`${STORAGE_PREFIX}.targets`, ""),
  );
  const [stopwordText, setStopwordText] = React.useState(() =>
    readStorage(`${STORAGE_PREFIX}.stopwords`, DEFAULT_STOPWORDS),
  );
  const [result, setResult] = React.useState(null);
  const [sortKey, setSortKey] = React.useState("total");
  const [sortDir, setSortDir] = React.useState("desc");
  const [loadingMeta, setLoadingMeta] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [notice, setNotice] = React.useState("対象語と評価語リストを設定してください。");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    writeStorage(`${STORAGE_PREFIX}.lexicon`, lexiconText);
  }, [lexiconText]);

  React.useEffect(() => {
    writeStorage(`${STORAGE_PREFIX}.targets`, targetText);
  }, [targetText]);

  React.useEffect(() => {
    writeStorage(`${STORAGE_PREFIX}.stopwords`, stopwordText);
  }, [stopwordText]);

  React.useEffect(() => {
    let cancelled = false;

    async function loadMeta() {
      if (!projectId) {
        setCodes([]);
        setNotice("質的分析プロジェクトを開くと利用できます。");
        return;
      }

      setLoadingMeta(true);
      setError("");
      try {
        const tree = await invoke("get_code_tree", { projectId });
        if (cancelled) return;
        const flatCodes = flattenCodeTree(Array.isArray(tree) ? tree : []);
        setCodes(flatCodes);
        setNotice("全分析ソースは分析時に読み込みます。コード付きセグメントも選択できます。");
      } catch (err) {
        if (cancelled) return;
        setCodes([]);
        setError(`プロジェクト情報の取得に失敗しました: ${toErrorMessage(err)}`);
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    }

    void loadMeta();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const selectedCodes = React.useMemo(() => {
    if (scope === "coded") return codes;
    if (scope.startsWith("code:")) {
      const codeId = scope.slice("code:".length);
      return codes.filter((code) => code.id === codeId);
    }
    return [];
  }, [codes, scope]);

  const lexiconPreview = React.useMemo(() => parseLexicon(lexiconText), [lexiconText]);
  const targetPreview = React.useMemo(() => parseTargetTerms(targetText), [targetText]);

  const sortedContextRows = React.useMemo(() => {
    if (!result) return [];
    const rows = [...result.contextRows];
    rows.sort((a, b) => {
      const direction = sortDir === "asc" ? 1 : -1;
      const av = valueForSort(a, sortKey);
      const bv = valueForSort(b, sortKey);
      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * direction || a.token.localeCompare(b.token, "ja");
      }
      return String(av).localeCompare(String(bv), "ja") * direction;
    });
    return rows.slice(0, topN);
  }, [result, sortDir, sortKey, topN]);

  const runAnalysis = React.useCallback(async () => {
    if (!projectId) {
      setError("質的分析プロジェクトが選択されていません。");
      return;
    }

    const lexicon = parseLexicon(lexiconText);
    if (lexicon.errors.length > 0) {
      setError(lexicon.errors[0] || "評価語リストを確認してください。");
      return;
    }
    if (lexicon.entries.length === 0) {
      setError("評価語リストが空です。");
      return;
    }

    const targets = parseTargetTerms(targetText);
    if (targets.length === 0) {
      setError("対象語を1つ以上入力してください。");
      return;
    }

    setLoading(true);
    setError("");
    setNotice("分析対象テキストを取得中...");

    try {
      const segments = await loadAnalysisSegments(projectId, scope, selectedCodes);
      if (segments.length === 0) {
        setResult(null);
        setNotice("分析できるテキストがありません。分析ソースまたはコード付きセグメントを確認してください。");
        return;
      }

      setNotice(`${segments.length} 件のテキストをトークン化中...`);
      const tokenizedSegments = tokenizeSegments(
        segments,
        locale,
        lexicon.entries,
        targets,
        parseStopwords(stopwordText),
      );
      const nextResult = analyzeTokenizedSegments(tokenizedSegments, lexicon.entries, targets, {
        windowSize,
        topN,
      });
      setResult(nextResult);
      setNotice(
        `${nextResult.segmentCount} 件、${nextResult.hitCount} 対象語ヒットを集計しました。`,
      );
    } catch (err) {
      setError(toErrorMessage(err));
      setNotice("");
    } finally {
      setLoading(false);
    }
  }, [
    lexiconText,
    locale,
    projectId,
    scope,
    selectedCodes,
    stopwordText,
    targetText,
    topN,
    windowSize,
  ]);

  const toggleSort = React.useCallback((key) => {
    setSortKey((currentKey) => {
      if (currentKey === key) {
        setSortDir((currentDir) => (currentDir === "asc" ? "desc" : "asc"));
        return currentKey;
      }
      setSortDir(key === "token" || key === "target" ? "asc" : "desc");
      return key;
    });
  }, []);

  const hasScopeInput = scope === "sources" ? Boolean(projectId) : selectedCodes.length > 0;
  const disabled = loading || loadingMeta || !projectId || !hasScopeInput;

  return h(
    "section",
    { style: styles.panel },
    h(
      "header",
      { style: styles.header },
      h(
        "div",
        null,
        h(
          "div",
          { style: styles.titleWrap },
          SentimentIcon(h, { size: 20 }),
          h("h2", { style: styles.title }, "センチメント文脈分析"),
        ),
        h(
          "p",
          { style: styles.description },
          "辞書ベースで対象語の前後N語を集計し、周辺の評価語スコアを算出します。",
        ),
      ),
      h(
        "button",
        {
          type: "button",
          onClick: runAnalysis,
          disabled,
          style: { ...styles.button, ...(disabled ? styles.disabledButton : null) },
        },
        loading ? "分析中" : "分析する",
      ),
    ),
    h(
      "div",
      { style: styles.toolbar },
      h(
        "label",
        { style: styles.label },
        "対象範囲",
        h(
          "select",
          {
            value: scope,
            disabled: loadingMeta || loading,
            onChange: (event) => setScope(event.target.value),
            style: styles.input,
          },
          h("option", { value: "sources" }, "全分析ソース"),
          h("option", { value: "coded" }, `全コード付きセグメント (${codes.length} コード)`),
          ...codes.map((code) =>
            h(
              "option",
              { key: code.id, value: `code:${code.id}` },
              `${indent(code.depth)}${code.name}${code.assignmentCount ? ` (${code.assignmentCount})` : ""}`,
            ),
          ),
        ),
      ),
      h(
        "label",
        { style: styles.label },
        "言語",
        h(
          "select",
          {
            value: locale,
            disabled: loading,
            onChange: (event) => setLocale(event.target.value),
            style: styles.input,
          },
          h("option", { value: "auto" }, "自動"),
          h("option", { value: "ja" }, "日本語"),
          h("option", { value: "en" }, "English"),
        ),
      ),
      h(
        "label",
        { style: styles.label },
        `前後N語: ${windowSize}`,
        h("input", {
          type: "range",
          min: "1",
          max: "15",
          step: "1",
          value: windowSize,
          onChange: (event) => setWindowSize(Number(event.target.value)),
          style: styles.range,
        }),
      ),
      h(
        "label",
        { style: styles.label },
        "表示件数",
        h("input", {
          type: "number",
          min: "20",
          max: "300",
          step: "10",
          value: topN,
          onChange: (event) => setTopN(clampNumber(Number(event.target.value), 20, 300)),
          style: styles.input,
        }),
      ),
    ),
    h(
      "div",
      { style: styles.editorGrid },
      h(EditorSection, {
        h,
        title: "評価語リスト",
        buttonLabel: "サンプル",
        onButtonClick: () => setLexiconText(DEFAULT_LEXICON),
        value: lexiconText,
        onChange: setLexiconText,
        placeholder: "term,score,label",
        footer: `${lexiconPreview.entries.length} 語 / positive ${
          lexiconPreview.entries.filter((entry) => entry.label === "positive").length
        } / negative ${
          lexiconPreview.entries.filter((entry) => entry.label === "negative").length
        }`,
      }),
      h(EditorSection, {
        h,
        title: "対象語",
        badge: `${targetPreview.length} 語`,
        value: targetText,
        onChange: setTargetText,
        placeholder: "政策\ngovernment\nclimate change",
      }),
      h(EditorSection, {
        h,
        title: "除外語",
        buttonLabel: "初期値",
        onButtonClick: () => setStopwordText(DEFAULT_STOPWORDS),
        value: stopwordText,
        onChange: setStopwordText,
        placeholder: "the\nand\nこと",
      }),
    ),
    error ? h("div", { style: styles.error }, error) : null,
    notice ? h("div", { style: styles.status }, notice) : null,
    h(Metrics, { h, result }),
    h(
      "div",
      { style: styles.resultGrid },
      h(
        "section",
        { style: styles.section },
        h(
          "div",
          { style: styles.sectionHeader },
          h("h3", { style: styles.sectionTitle }, "対象語別スコア"),
          exportButton(h, "CSV", Boolean(result), () =>
            result ? exportCsv("sentiment-target-summary.csv", targetSummaryToRows(result.targetSummaries)) : null,
          ),
        ),
        result
          ? h(TargetSummaryTable, { h, summaries: result.targetSummaries })
          : h("div", { style: styles.empty }, "分析すると対象語別のスコアが表示されます。"),
      ),
      h(
        "section",
        { style: styles.section },
        h(
          "div",
          { style: styles.sectionHeader },
          h("h3", { style: styles.sectionTitle }, "前後語カウント"),
          exportButton(h, "CSV", Boolean(result), () =>
            result ? exportCsv("sentiment-context-counts.csv", contextRowsToRows(result.contextRows)) : null,
          ),
        ),
        result
          ? h(ContextTable, {
              h,
              rows: sortedContextRows,
              sortKey,
              sortDir,
              onSort: toggleSort,
            })
          : h("div", { style: styles.empty }, "対象語の前後に出る語がここに集計されます。"),
      ),
    ),
    h(
      "section",
      { style: styles.section },
      h(
        "div",
        { style: styles.sectionHeader },
        h("h3", { style: styles.sectionTitle }, "コンコーダンス"),
        exportButton(h, "CSV書き出し", Boolean(result), () =>
          result ? exportCsv("sentiment-concordance.csv", concordanceRowsToRows(result.concordanceRows)) : null,
        ),
      ),
      result
        ? h(ConcordanceTable, { h, rows: result.concordanceRows.slice(0, topN) })
        : h("div", { style: styles.empty }, "対象語の左右文脈と評価語ヒットが表示されます。"),
    ),
    h(
      "section",
      { style: styles.section },
      h(
        "div",
        { style: styles.sectionHeader },
        h("h3", { style: styles.sectionTitle }, "評価語ヒット"),
        exportButton(h, "CSV", Boolean(result), () =>
          result ? exportCsv("sentiment-lexicon-hits.csv", sentimentTermRowsToRows(result.sentimentTermRows)) : null,
        ),
      ),
      result
        ? h(SentimentTermTable, { h, rows: result.sentimentTermRows.slice(0, topN) })
        : h("div", { style: styles.empty }, "前後N語内で見つかった評価語が表示されます。"),
    ),
  );
}

function EditorSection({
  h,
  title,
  buttonLabel,
  onButtonClick,
  badge,
  value,
  onChange,
  placeholder,
  footer,
}) {
  return h(
    "section",
    { style: styles.section },
    h(
      "div",
      { style: styles.sectionHeader },
      h("h3", { style: styles.sectionTitle }, title),
      buttonLabel
        ? h("button", { type: "button", onClick: onButtonClick, style: styles.secondaryButton }, buttonLabel)
        : badge
          ? h("span", { style: styles.pill }, badge)
          : null,
    ),
    h(
      "div",
      { style: styles.sectionBody },
      h("textarea", {
        value,
        onChange: (event) => onChange(event.target.value),
        placeholder,
        spellCheck: false,
        style: styles.textArea,
      }),
      footer ? h("div", { style: { ...styles.status, marginTop: "8px" } }, footer) : null,
    ),
  );
}

function Metrics({ h, result }) {
  const metrics = [
    { label: "対象語ヒット", value: result?.hitCount ?? 0 },
    { label: "総スコア", value: formatScore(result?.totalScore ?? 0) },
    { label: "テキスト件数", value: result?.segmentCount ?? 0 },
    { label: "トークン", value: result?.tokenCount ?? 0 },
  ];

  return h(
    "div",
    { style: styles.metrics },
    ...metrics.map((metric) =>
      h(
        "div",
        { key: metric.label, style: styles.metric },
        h("p", { style: styles.metricLabel }, metric.label),
        h("p", { style: styles.metricValue }, String(metric.value)),
      ),
    ),
  );
}

function TargetSummaryTable({ h, summaries }) {
  return h(
    "div",
    { style: styles.tableWrap },
    h(
      "table",
      { style: styles.table },
      h(
        "thead",
        null,
        h(
          "tr",
          null,
          h("th", { style: styles.th }, "target"),
          h("th", { style: { ...styles.th, textAlign: "right" } }, "hits"),
          h("th", { style: { ...styles.th, textAlign: "right" } }, "score"),
          h("th", { style: { ...styles.th, textAlign: "right" } }, "positive"),
          h("th", { style: { ...styles.th, textAlign: "right" } }, "negative"),
        ),
      ),
      h(
        "tbody",
        null,
        ...summaries.map((summary) =>
          h(
            "tr",
            { key: summary.target },
            h("td", { style: styles.td }, summary.target),
            numberTd(h, summary.hits),
            numberTd(h, formatScore(summary.score)),
            numberTd(h, summary.positive),
            numberTd(h, summary.negative),
          ),
        ),
      ),
    ),
  );
}

function ContextTable({ h, rows, sortKey, sortDir, onSort }) {
  const arrow = (key) => (sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "");

  return h(
    "div",
    { style: styles.tableWrap },
    h(
      "table",
      { style: styles.table },
      h(
        "thead",
        null,
        h(
          "tr",
          null,
          h("th", { style: styles.th }, tableButton(h, `target${arrow("target")}`, () => onSort("target"))),
          h("th", { style: styles.th }, tableButton(h, `token${arrow("token")}`, () => onSort("token"))),
          h("th", { style: { ...styles.th, textAlign: "right" } }, tableButton(h, `before${arrow("before")}`, () => onSort("before"))),
          h("th", { style: { ...styles.th, textAlign: "right" } }, tableButton(h, `after${arrow("after")}`, () => onSort("after"))),
          h("th", { style: { ...styles.th, textAlign: "right" } }, tableButton(h, `total${arrow("total")}`, () => onSort("total"))),
        ),
      ),
      h(
        "tbody",
        null,
        ...rows.map((row) =>
          h(
            "tr",
            { key: `${row.target}:${row.token}` },
            h("td", { style: styles.td }, row.target),
            h("td", { style: styles.td }, row.token),
            numberTd(h, row.beforeCount),
            numberTd(h, row.afterCount),
            numberTd(h, row.total),
          ),
        ),
      ),
    ),
  );
}

function ConcordanceTable({ h, rows }) {
  return h(
    "div",
    { style: styles.tableWrap },
    h(
      "table",
      { style: styles.table },
      h(
        "thead",
        null,
        h(
          "tr",
          null,
          h("th", { style: styles.th }, "source"),
          h("th", { style: styles.th }, "context"),
          h("th", { style: { ...styles.th, textAlign: "right" } }, "score"),
          h("th", { style: styles.th }, "label"),
          h("th", { style: styles.th }, "matched"),
        ),
      ),
      h(
        "tbody",
        null,
        ...rows.map((row) =>
          h(
            "tr",
            { key: row.id },
            h("td", { style: { ...styles.td, maxWidth: "170px" } }, row.sourceTitle || "分析ソース"),
            h(
              "td",
              { style: styles.td },
              h(
                "div",
                { style: styles.snippet },
                h("span", { title: row.before, style: { ...styles.snippetSide, textAlign: "right" } }, row.before),
                h("span", { style: styles.snippetTarget }, row.target),
                h("span", { title: row.after, style: styles.snippetSide }, row.after),
              ),
            ),
            numberTd(h, formatScore(row.score)),
            h("td", { style: styles.td }, SentimentPill(h, row.label)),
            h("td", { style: styles.td }, row.matchedTerms.join(", ")),
          ),
        ),
      ),
    ),
  );
}

function SentimentTermTable({ h, rows }) {
  return h(
    "div",
    { style: styles.tableWrap },
    h(
      "table",
      { style: styles.table },
      h(
        "thead",
        null,
        h(
          "tr",
          null,
          h("th", { style: styles.th }, "term"),
          h("th", { style: styles.th }, "label"),
          h("th", { style: { ...styles.th, textAlign: "right" } }, "score"),
          h("th", { style: { ...styles.th, textAlign: "right" } }, "count"),
        ),
      ),
      h(
        "tbody",
        null,
        ...rows.map((row) =>
          h(
            "tr",
            { key: `${row.term}:${row.label}` },
            h("td", { style: styles.td }, row.term),
            h("td", { style: styles.td }, SentimentPill(h, row.label)),
            numberTd(h, formatScore(row.score)),
            numberTd(h, row.count),
          ),
        ),
      ),
    ),
  );
}

async function loadAnalysisSegments(projectId, scope, selectedCodes) {
  if (scope === "sources") {
    const sourceList = await invoke("get_qualitative_sources", { projectId });
    return (Array.isArray(sourceList) ? sourceList : [])
      .map((source) => ({
        id: `source:${source.id}`,
        sourceId: source.id,
        sourceTitle: source.title || "分析ソース",
        codeId: "",
        segmentText: sourceText(source),
      }))
      .filter((segment) => segment.segmentText.trim());
  }

  if (selectedCodes.length === 0) return [];
  const segmentGroups = await mapLimit(selectedCodes, 6, async (code) => {
    const result = await invoke("get_source_segments_by_code", { codeId: code.id });
    return Array.isArray(result) ? result : [];
  });
  return dedupeSegments(segmentGroups.flat());
}

function tokenizeSegments(segments, locale, lexicon, targets, stopwords) {
  const knownTerms = [
    ...lexicon.map((entry) => entry.normalizedTerm),
    ...targets.map((target) => target.normalizedTerm),
  ];

  return segments.map((segment) => ({
    segment,
    tokens: tokenizeText(segmentText(segment), locale, knownTerms).filter((token) => !stopwords.has(token)),
  }));
}

function analyzeTokenizedSegments(tokenizedSegments, lexicon, targets, options) {
  const targetSummaryMap = new Map();
  const contextCountMap = new Map();
  const sentimentTermMap = new Map();
  const concordanceRows = [];
  const lexiconIndex = buildLexiconIndex(lexicon);
  let tokenCount = 0;
  let hitCount = 0;
  let totalScore = 0;

  for (const item of tokenizedSegments) {
    const { segment, tokens } = item;
    tokenCount += tokens.length;

    for (const target of targets) {
      const matches = findTermMatches(tokens, target.tokens);
      for (const matchStart of matches) {
        hitCount += 1;
        const beforeStart = Math.max(0, matchStart - options.windowSize);
        const afterStart = matchStart + target.tokens.length;
        const afterEnd = Math.min(tokens.length, afterStart + options.windowSize);
        const beforeTokens = tokens.slice(beforeStart, matchStart);
        const afterTokens = tokens.slice(afterStart, afterEnd);
        const contextTokens = tokens.slice(beforeStart, afterEnd);
        const sentimentHits = findSentimentHits(contextTokens, lexiconIndex);
        const score = sentimentHits.reduce((sum, hit) => sum + hit.entry.score, 0);
        const label = labelFromScore(score);

        totalScore += score;
        updateTargetSummary(targetSummaryMap, target.normalizedTerm, score, label);
        updateContextCounts(contextCountMap, target.normalizedTerm, beforeTokens, "before");
        updateContextCounts(contextCountMap, target.normalizedTerm, afterTokens, "after");
        updateSentimentTermCounts(sentimentTermMap, sentimentHits);

        concordanceRows.push({
          id: `${segment.id}:${target.normalizedTerm}:${matchStart}:${hitCount}`,
          target: target.normalizedTerm,
          sourceTitle: segment.sourceTitle || segment.source_title || "",
          before: beforeTokens.join(" "),
          after: afterTokens.join(" "),
          score,
          label,
          matchedTerms: [...new Set(sentimentHits.map((hit) => hit.entry.term))],
        });
      }
    }
  }

  const targetSummaries = [...targetSummaryMap.values()].sort(
    (a, b) => b.hits - a.hits || Math.abs(b.score) - Math.abs(a.score) || a.target.localeCompare(b.target, "ja"),
  );
  const contextRows = [...contextCountMap.values()].sort(
    (a, b) => b.total - a.total || a.target.localeCompare(b.target, "ja") || a.token.localeCompare(b.token, "ja"),
  );
  const sentimentTermRows = [...sentimentTermMap.values()].sort(
    (a, b) => b.count - a.count || Math.abs(b.score) - Math.abs(a.score) || a.term.localeCompare(b.term, "ja"),
  );

  return {
    segmentCount: tokenizedSegments.length,
    tokenCount,
    hitCount,
    totalScore,
    targetSummaries,
    contextRows: contextRows.slice(0, Math.max(options.topN, 300)),
    concordanceRows,
    sentimentTermRows,
  };
}

function parseLexicon(text) {
  const entries = [];
  const errors = [];
  const seen = new Set();

  for (const [index, rawLine] of text.split(/\r?\n/u).entries()) {
    const line = stripComment(rawLine).trim();
    if (!line) continue;

    const parsed = parseLexiconLine(line);
    if (!parsed) {
      errors.push(`${index + 1}行目の形式を確認してください。`);
      continue;
    }

    const normalizedTerm = normalizeTerm(parsed.term);
    const tokens = tokenizeTerm(normalizedTerm);
    if (!normalizedTerm || tokens.length === 0) continue;

    const key = `${normalizedTerm}:${parsed.score}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({
      term: parsed.term.trim(),
      normalizedTerm,
      score: parsed.score,
      label: parsed.label || labelFromScore(parsed.score),
      tokens,
    });
  }

  return { entries, errors };
}

function parseLexiconLine(line) {
  const prefixed = line.match(/^([+-])\s+(.+)$/u);
  if (prefixed) {
    const sign = prefixed[1];
    const term = prefixed[2];
    if (!term) return null;
    const score = sign === "-" ? -1 : 1;
    return { term, score, label: labelFromScore(score) };
  }

  const parts = line
    .split(/[\t,;]/u)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0 || !parts[0]) return null;

  const score = parseScore(parts[1], parts[2]);
  const label = parseLabel(parts[2]) || parseLabel(parts[1]) || labelFromScore(score);
  return { term: parts[0], score, label };
}

function parseScore(primary, secondary) {
  for (const value of [primary, secondary]) {
    if (!value) continue;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    const normalized = value.toLowerCase();
    if (["positive", "pos", "+"].includes(normalized)) return 1;
    if (["negative", "neg", "-"].includes(normalized)) return -1;
    if (["neutral", "neu", "0"].includes(normalized)) return 0;
  }
  return 1;
}

function parseLabel(value) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (["positive", "pos", "+"].includes(normalized)) return "positive";
  if (["negative", "neg", "-"].includes(normalized)) return "negative";
  if (["neutral", "neu", "0"].includes(normalized)) return "neutral";
  return null;
}

function parseTargetTerms(text) {
  const seen = new Set();
  const targets = [];
  const terms = text
    .split(/[\n,、;；]+/u)
    .map((term) => normalizeTerm(stripComment(term)))
    .filter(Boolean);

  for (const normalizedTerm of terms) {
    if (seen.has(normalizedTerm)) continue;
    const tokens = tokenizeTerm(normalizedTerm);
    if (tokens.length === 0) continue;
    seen.add(normalizedTerm);
    targets.push({ term: normalizedTerm, normalizedTerm, tokens });
  }

  return targets;
}

function parseStopwords(text) {
  return new Set(
    text
      .split(/[\n,、;；]+/u)
      .map((term) => normalizeTerm(stripComment(term)))
      .filter(Boolean),
  );
}

function buildLexiconIndex(lexicon) {
  const index = new Map();
  for (const entry of lexicon) {
    const firstToken = entry.tokens[0];
    if (!firstToken) continue;
    const entries = index.get(firstToken) || [];
    entries.push(entry);
    index.set(firstToken, entries);
  }
  for (const entries of index.values()) {
    entries.sort((a, b) => b.tokens.length - a.tokens.length || a.normalizedTerm.localeCompare(b.normalizedTerm, "ja"));
  }
  return index;
}

function findSentimentHits(tokens, lexiconIndex) {
  const hits = [];
  for (let start = 0; start < tokens.length; start += 1) {
    const candidates = lexiconIndex.get(tokens[start]) || [];
    for (const entry of candidates) {
      if (!matchesTermAt(tokens, start, entry.tokens)) continue;
      hits.push({ entry, start });
    }
  }
  return hits.sort((a, b) => a.start - b.start || b.entry.tokens.length - a.entry.tokens.length);
}

function findTermMatches(tokens, termTokens) {
  if (termTokens.length === 0 || tokens.length < termTokens.length) return [];
  const matches = [];
  for (let start = 0; start <= tokens.length - termTokens.length; start += 1) {
    if (matchesTermAt(tokens, start, termTokens)) matches.push(start);
  }
  return matches;
}

function matchesTermAt(tokens, start, termTokens) {
  if (start + termTokens.length > tokens.length) return false;
  for (let offset = 0; offset < termTokens.length; offset += 1) {
    if (tokens[start + offset] !== termTokens[offset]) return false;
  }
  return true;
}

function updateTargetSummary(summaries, target, score, label) {
  const current =
    summaries.get(target) || {
      target,
      hits: 0,
      score: 0,
      positive: 0,
      negative: 0,
      neutral: 0,
    };
  current.hits += 1;
  current.score += score;
  current[label] += 1;
  summaries.set(target, current);
}

function updateContextCounts(counts, target, tokens, side) {
  for (const token of tokens) {
    if (!token || token === target) continue;
    const key = `${target}\u0000${token}`;
    const current =
      counts.get(key) || {
        target,
        token,
        beforeCount: 0,
        afterCount: 0,
        total: 0,
      };
    if (side === "before") current.beforeCount += 1;
    if (side === "after") current.afterCount += 1;
    current.total += 1;
    counts.set(key, current);
  }
}

function updateSentimentTermCounts(counts, hits) {
  for (const hit of hits) {
    const key = `${hit.entry.normalizedTerm}\u0000${hit.entry.label}`;
    const current =
      counts.get(key) || {
        term: hit.entry.term,
        label: hit.entry.label,
        score: 0,
        count: 0,
      };
    current.score += hit.entry.score;
    current.count += 1;
    counts.set(key, current);
  }
}

function tokenizeText(text, locale, knownTerms) {
  const normalized = String(text || "").normalize("NFKC").toLowerCase();
  const termList = knownTerms
    .filter((term) => term && !term.includes(" ") && containsJapanese(term))
    .sort((a, b) => b.length - a.length || a.localeCompare(b, "ja"));

  if (locale === "en") {
    return tokenizeEnglish(normalized);
  }

  const chunks =
    normalized.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー々〆ヵヶ]+|[a-z0-9][a-z0-9._'-]*/gu) || [];
  const tokens = [];

  for (const chunk of chunks) {
    if (/^[a-z0-9]/u.test(chunk)) {
      tokens.push(...tokenizeEnglish(chunk));
      continue;
    }

    if (locale === "ja" || containsJapanese(chunk)) {
      tokens.push(...splitJapaneseChunkByTerms(chunk, termList).map(normalizeTerm).filter(Boolean));
      continue;
    }

    tokens.push(...tokenizeEnglish(chunk));
  }

  return tokens.filter((token) => token.length > 0 && !/^[0-9._'-]+$/u.test(token));
}

function tokenizeEnglish(text) {
  return (
    text
      .match(/[a-z0-9][a-z0-9._'-]*/gu)
      ?.map(normalizeTerm)
      .filter((token) => token && !/^[0-9._'-]+$/u.test(token)) || []
  );
}

function splitJapaneseChunkByTerms(chunk, terms) {
  if (terms.length === 0) return splitJapaneseFallback(chunk);

  const output = [];
  let buffer = "";
  let index = 0;

  while (index < chunk.length) {
    const matched = terms.find((term) => chunk.startsWith(term, index));
    if (matched) {
      output.push(...splitJapaneseFallback(buffer));
      output.push(matched);
      buffer = "";
      index += matched.length;
      continue;
    }

    buffer += chunk[index] || "";
    index += 1;
  }

  output.push(...splitJapaneseFallback(buffer));
  return output.filter(Boolean);
}

function splitJapaneseFallback(chunk) {
  if (!chunk) return [];
  const output = [];
  let current = "";
  let currentType = "";

  for (const char of chunk) {
    const type = japaneseCharType(char);
    if (current && type !== currentType) {
      output.push(current);
      current = char;
    } else {
      current += char;
    }
    currentType = type;
  }
  if (current) output.push(current);

  return output.filter((token) => token.length >= 2 || containsJapanese(token));
}

function japaneseCharType(char) {
  if (/\p{Script=Han}|々|〆|ヵ|ヶ/u.test(char)) return "kanji";
  if (/\p{Script=Katakana}|ー/u.test(char)) return "katakana";
  if (/\p{Script=Hiragana}/u.test(char)) return "hiragana";
  return "other";
}

function tokenizeTerm(term) {
  const normalized = normalizeTerm(term);
  if (!normalized) return [];
  if (normalized.includes(" ")) {
    return normalized.split(/\s+/u).map(normalizeTerm).filter(Boolean);
  }
  return [normalized];
}

function normalizeTerm(term) {
  return String(term || "")
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/^[\s"'“”‘’.,!?;:()[\]{}]+|[\s"'“”‘’.,!?;:()[\]{}]+$/gu, "");
}

function labelFromScore(score) {
  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}

function valueForSort(row, key) {
  if (key === "before") return row.beforeCount;
  if (key === "after") return row.afterCount;
  if (key === "total") return row.total;
  if (key === "target") return row.target;
  return row.token;
}

function flattenCodeTree(tree, depth = 0) {
  const output = [];
  for (const node of tree) {
    const code = node?.code || node;
    if (code?.id) {
      output.push({
        id: code.id,
        name: code.name || "Untitled code",
        depth,
        assignmentCount: node.assignmentCount ?? node.assignment_count ?? code.assignmentCount ?? 0,
      });
    }
    const children = Array.isArray(node?.children) ? node.children : [];
    output.push(...flattenCodeTree(children, depth + 1));
  }
  return output;
}

function dedupeSegments(segments) {
  const seen = new Set();
  const output = [];
  for (const segment of segments) {
    const key = segment?.id || `${segment?.sourceId || segment?.source_id || ""}:${segmentText(segment)}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(segment);
  }
  return output;
}

function targetSummaryToRows(summaries) {
  return [
    ["target", "hits", "score", "positive", "negative", "neutral"],
    ...summaries.map((item) => [
      item.target,
      item.hits,
      item.score,
      item.positive,
      item.negative,
      item.neutral,
    ]),
  ];
}

function contextRowsToRows(rows) {
  return [
    ["target", "token", "before_count", "after_count", "total"],
    ...rows.map((row) => [row.target, row.token, row.beforeCount, row.afterCount, row.total]),
  ];
}

function concordanceRowsToRows(rows) {
  return [
    ["source", "target", "before", "after", "score", "label", "matched_terms"],
    ...rows.map((row) => [
      row.sourceTitle,
      row.target,
      row.before,
      row.after,
      row.score,
      row.label,
      row.matchedTerms.join("; "),
    ]),
  ];
}

function sentimentTermRowsToRows(rows) {
  return [
    ["term", "label", "score", "count"],
    ...rows.map((row) => [row.term, row.label, row.score, row.count]),
  ];
}

function SentimentIcon(h, { size = 18, color = "currentColor" } = {}) {
  return h(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: color,
      strokeWidth: 1.8,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
    },
    h("path", { d: "M4 17.5 9 12l3.2 3.2L20 6.5" }),
    h("path", { d: "M4 6.5h6" }),
    h("path", { d: "M4 10h4" }),
    h("path", { d: "M4 13.5h2.5" }),
  );
}

function SentimentPill(h, label) {
  const color =
    label === "positive"
      ? "var(--color-accent-secondary)"
      : label === "negative"
        ? "var(--color-accent-danger)"
        : "var(--color-text-tertiary)";
  return h("span", { style: { ...styles.pill, color, borderColor: color } }, label);
}

function tableButton(h, label, onClick) {
  return h(
    "button",
    {
      type: "button",
      onClick,
      style: {
        padding: 0,
        border: "none",
        background: "none",
        color: "inherit",
        font: "inherit",
        cursor: "pointer",
      },
    },
    label,
  );
}

function exportButton(h, label, enabled, onClick) {
  return h(
    "button",
    {
      type: "button",
      disabled: !enabled,
      onClick,
      style: { ...styles.secondaryButton, ...(!enabled ? styles.disabledButton : null) },
    },
    label,
  );
}

function numberTd(h, value) {
  return h("td", { style: { ...styles.td, textAlign: "right", fontVariantNumeric: "tabular-nums" } }, String(value));
}

function exportCsv(filename, rows) {
  const content = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/u.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

async function invoke(command, args) {
  if (typeof stellarInvoke === "function") {
    return stellarInvoke(command, args || {});
  }

  const apiInvoke =
    typeof window !== "undefined" && typeof window.StellarPluginApi?.invoke === "function"
      ? window.StellarPluginApi.invoke
      : null;
  if (apiInvoke) {
    return apiInvoke(command, args || {});
  }

  const bridge = typeof window !== "undefined" ? window.__TAURI__ : null;
  const invokeFn =
    bridge?.core?.invoke ||
    bridge?.invoke ||
    bridge?.tauri?.invoke ||
    (typeof window !== "undefined" ? window.__TAURI_INVOKE__ : null);

  if (typeof invokeFn !== "function") {
    throw new Error("Tauri invoke API is unavailable in this plugin context.");
  }

  return invokeFn(command, args || {});
}

async function mapLimit(items, limit, worker) {
  const output = new Array(items.length);
  let index = 0;

  async function run() {
    while (index < items.length) {
      const current = index;
      index += 1;
      output[current] = await worker(items[current], current);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return output;
}

function sourceText(source) {
  return String(source?.content ?? source?.text ?? "");
}

function segmentText(segment) {
  return String(segment?.segmentText ?? segment?.segment_text ?? segment?.text ?? "");
}

function containsJapanese(value) {
  return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー々〆ヵヶ]/u.test(value);
}

function stripComment(line) {
  const trimmed = String(line || "").trim();
  if (trimmed.startsWith("#")) return "";
  return String(line || "").replace(/\s+#.*$/u, "");
}

function readStorage(key, fallback) {
  try {
    if (typeof window === "undefined") return fallback;
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore unavailable storage in restricted preview contexts.
  }
}

function indent(depth) {
  return depth > 0 ? `${"　".repeat(depth)}↳ ` : "";
}

function formatScore(score) {
  if (Number.isInteger(score)) return String(score);
  return Number(score || 0).toFixed(2);
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function toErrorMessage(err) {
  return String(err?.message || err || "不明なエラー").replace(/^Error:\s*/i, "");
}
