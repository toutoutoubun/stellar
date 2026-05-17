const PLUGIN_ID = "nlp-ja-preprocess.panel";
const DEFAULT_WINDOW_SIZE = 5;
const DEFAULT_TOP_N = 20;
const DEFAULT_THRESHOLD = 2;
const COOC_TOP_N_PER_SEGMENT = 100;

const POS_OPTIONS = [
  { key: "noun", label: "名詞" },
  { key: "verb", label: "動詞" },
  { key: "adjective", label: "形容詞" },
];

const STOP_WORDS = new Set([
  "これ",
  "それ",
  "あれ",
  "ここ",
  "そこ",
  "ため",
  "こと",
  "もの",
  "よう",
  "さん",
  "する",
  "した",
  "して",
  "いる",
  "ある",
  "なる",
  "から",
  "まで",
  "など",
  "また",
  "そして",
  "しかし",
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
]);

const styles = {
  panel: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    height: "100%",
    minHeight: "520px",
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
  title: {
    margin: 0,
    fontSize: "18px",
    fontWeight: 700,
    lineHeight: 1.35,
  },
  description: {
    margin: "4px 0 0",
    fontSize: "12px",
    lineHeight: 1.6,
    color: "var(--color-text-secondary)",
  },
  toolbar: {
    display: "grid",
    gridTemplateColumns: "minmax(220px, 1.2fr) repeat(3, minmax(170px, 1fr))",
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
  select: {
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
  checks: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "8px",
    minHeight: "32px",
  },
  checkLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--color-text-primary)",
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
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(260px, 0.9fr) minmax(360px, 1.35fr)",
    gap: "14px",
    alignItems: "start",
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
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "12px",
  },
  th: {
    padding: "7px 8px",
    borderBottom: "1px solid var(--color-border-secondary)",
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
};

export function register(api) {
  const React = api.React;
  const h = React.createElement;

  api.registerQualitativeAnalysisAddon({
    id: PLUGIN_ID,
    label: "テキスト前処理 (日本語)",
    description: "共起分析・頻度分析・キーワードネットワーク",
    order: 100,
    render: (context) => h(NlpPanel, { api, context }),
  });

  console.log("[nlp-ja-preprocess] qualitative analysis addon registered.");
}

function NlpPanel({ api, context }) {
  const React = api.React;
  const h = React.createElement;
  const projectId = context?.projectId || context?.project?.id || "";

  const [codes, setCodes] = React.useState([]);
  const [targetCodeId, setTargetCodeId] = React.useState("all");
  const [filters, setFilters] = React.useState({ noun: true, verb: false, adjective: false });
  const [topN, setTopN] = React.useState(DEFAULT_TOP_N);
  const [threshold, setThreshold] = React.useState(DEFAULT_THRESHOLD);
  const [windowSize, setWindowSize] = React.useState(DEFAULT_WINDOW_SIZE);
  const [segments, setSegments] = React.useState([]);
  const [frequency, setFrequency] = React.useState([]);
  const [pairs, setPairs] = React.useState([]);
  const [sortKey, setSortKey] = React.useState("count");
  const [sortDir, setSortDir] = React.useState("desc");
  const [loadingCodes, setLoadingCodes] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [progress, setProgress] = React.useState("");
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("コード付きセグメントを選択して分析を開始してください。");

  React.useEffect(() => {
    let cancelled = false;

    async function loadCodes() {
      if (!projectId) {
        setCodes([]);
        setNotice("質的分析プロジェクトを開くと利用できます。");
        return;
      }

      setLoadingCodes(true);
      setError("");
      try {
        const tree = await invoke("get_code_tree", { projectId });
        if (cancelled) return;
        const flatCodes = flattenCodeTree(Array.isArray(tree) ? tree : []);
        setCodes(flatCodes);
        setNotice(
          flatCodes.length > 0
            ? "コード付きセグメントを対象に、頻度・共起・ネットワークを集計します。"
            : "このプロジェクトにはまだコードがありません。",
        );
      } catch (err) {
        if (cancelled) return;
        setCodes([]);
        setError(`コード一覧の取得に失敗しました: ${toErrorMessage(err)}`);
      } finally {
        if (!cancelled) setLoadingCodes(false);
      }
    }

    void loadCodes();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const selectedCodes = React.useMemo(() => {
    if (targetCodeId === "all") return codes;
    return codes.filter((code) => code.id === targetCodeId);
  }, [codes, targetCodeId]);

  const sortedPairs = React.useMemo(() => {
    const next = [...pairs];
    next.sort((a, b) => {
      const av = sortKey === "count" ? Number(a.count) : String(a[sortKey] || "");
      const bv = sortKey === "count" ? Number(b.count) : String(b[sortKey] || "");
      const direction = sortDir === "asc" ? 1 : -1;
      if (av < bv) return -1 * direction;
      if (av > bv) return 1 * direction;
      return 0;
    });
    return next;
  }, [pairs, sortDir, sortKey]);

  const runAnalysis = React.useCallback(async () => {
    if (!projectId) {
      setError("質的分析プロジェクトが選択されていません。");
      return;
    }
    if (selectedCodes.length === 0) {
      setError("分析対象のコードがありません。");
      return;
    }

    setLoading(true);
    setError("");
    setProgress("コード付きセグメントを取得中...");
    setNotice("");

    try {
      const segmentGroups = await mapLimit(selectedCodes, 6, async (code) => {
        const result = await invoke("get_source_segments_by_code", { codeId: code.id });
        return Array.isArray(result) ? result : [];
      });
      const uniqueSegments = dedupeSegments(segmentGroups.flat());
      setSegments(uniqueSegments);

      if (uniqueSegments.length === 0) {
        setFrequency([]);
        setPairs([]);
        setProgress("");
        setNotice("対象コードにコード付きセグメントがありません。");
        return;
      }

      setProgress(`頻度を集計中... ${uniqueSegments.length} セグメント`);
      const nextFrequency = computeFrequencies(uniqueSegments, filters, topN);
      setFrequency(nextFrequency);

      let completed = 0;
      setProgress(`共起分析中... 0/${uniqueSegments.length}`);
      const pairGroups = await mapLimit(uniqueSegments, 4, async (segment) => {
        const result = await analyzeSegment(segment, filters, windowSize);
        completed += 1;
        setProgress(`共起分析中... ${completed}/${uniqueSegments.length}`);
        return result;
      });

      const aggregatedPairs = aggregatePairs(pairGroups.flat()).slice(0, 250);
      setPairs(aggregatedPairs);
      setProgress("");
      setNotice(
        `${uniqueSegments.length} セグメント、${nextFrequency.length} 語、${aggregatedPairs.length} 共起ペアを集計しました。`,
      );
    } catch (err) {
      setError(toErrorMessage(err));
      setProgress("");
    } finally {
      setLoading(false);
    }
  }, [filters, projectId, selectedCodes, topN, windowSize]);

  const toggleSort = React.useCallback((key) => {
    setSortKey((currentKey) => {
      if (currentKey === key) {
        setSortDir((currentDir) => (currentDir === "asc" ? "desc" : "asc"));
        return currentKey;
      }
      setSortDir(key === "count" ? "desc" : "asc");
      return key;
    });
  }, []);

  const disabled = loading || loadingCodes || !projectId || selectedCodes.length === 0;
  const targetLabel = targetCodeId === "all" ? "全コード付きセグメント" : selectedCodes[0]?.name || "コード";

  return h(
    "section",
    { style: styles.panel },
    h(
      "header",
      { style: styles.header },
      h(
        "div",
        null,
        h("h2", { style: styles.title }, "テキスト前処理 (日本語)"),
        h(
          "p",
          { style: styles.description },
          "Stellar の日本語共起分析コマンドを使い、コード付きセグメントから頻度表・共起表・キーワードネットワークを生成します。",
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
        "対象",
        h(
          "select",
          {
            value: targetCodeId,
            disabled: loadingCodes || loading,
            onChange: (event) => setTargetCodeId(event.target.value),
            style: styles.select,
          },
          h("option", { value: "all" }, `全セグメント (${codes.length} コード)`),
          ...codes.map((code) =>
            h(
              "option",
              { key: code.id, value: code.id },
              `${indent(code.depth)}${code.name}${code.assignmentCount ? ` (${code.assignmentCount})` : ""}`,
            ),
          ),
        ),
      ),
      h(
        "label",
        { style: styles.label },
        "品詞フィルター",
        h(
          "div",
          { style: styles.checks },
          ...POS_OPTIONS.map((option) =>
            h(
              "label",
              { key: option.key, style: styles.checkLabel },
              h("input", {
                type: "checkbox",
                checked: Boolean(filters[option.key]),
                onChange: (event) =>
                  setFilters((current) => ({ ...current, [option.key]: event.target.checked })),
              }),
              option.label,
            ),
          ),
        ),
      ),
      h(
        "label",
        { style: styles.label },
        `上位N語: ${topN}`,
        h("input", {
          type: "range",
          min: "5",
          max: "50",
          step: "5",
          value: topN,
          onChange: (event) => setTopN(Number(event.target.value)),
          style: styles.range,
        }),
      ),
      h(
        "label",
        { style: styles.label },
        `窓幅: ${windowSize}`,
        h("input", {
          type: "range",
          min: "2",
          max: "12",
          step: "1",
          value: windowSize,
          onChange: (event) => setWindowSize(Number(event.target.value)),
          style: styles.range,
        }),
      ),
    ),
    error ? h("div", { style: styles.error }, error) : null,
    progress ? h("div", { style: styles.status }, progress) : null,
    notice ? h("div", { style: styles.status }, `${notice} 対象: ${targetLabel}`) : null,
    h(
      "div",
      { style: styles.grid },
      h(
        "section",
        { style: styles.section },
        h(
          "div",
          { style: styles.sectionHeader },
          h("h3", { style: styles.sectionTitle }, "頻度分析"),
          h(
            "button",
            {
              type: "button",
              disabled: frequency.length === 0,
              onClick: () => exportCsv("nlp-ja-frequency.csv", frequencyToCsvRows(frequency)),
              style: {
                ...styles.secondaryButton,
                ...(frequency.length === 0 ? styles.disabledButton : null),
              },
            },
            "CSV",
          ),
        ),
        h(
          "div",
          { style: styles.sectionBody },
          frequency.length > 0
            ? h(FrequencyChart, { h, frequency })
            : h("div", { style: styles.empty }, "分析すると上位語の頻度が表示されます。"),
        ),
      ),
      h(
        "section",
        { style: styles.section },
        h(
          "div",
          { style: styles.sectionHeader },
          h("h3", { style: styles.sectionTitle }, "共起ネットワーク"),
          h(
            "label",
            { style: { ...styles.label, width: "150px" } },
            `閾値: ${threshold}`,
            h("input", {
              type: "range",
              min: "1",
              max: "12",
              step: "1",
              value: threshold,
              onChange: (event) => setThreshold(Number(event.target.value)),
              style: styles.range,
            }),
          ),
        ),
        h(
          "div",
          { style: styles.sectionBody },
          pairs.length > 0
            ? h(NetworkSvg, { h, frequency, pairs, threshold })
            : h("div", { style: styles.empty }, "共起ペアがあるとネットワークが表示されます。"),
        ),
      ),
    ),
    h(
      "section",
      { style: styles.section },
      h(
        "div",
        { style: styles.sectionHeader },
        h("h3", { style: styles.sectionTitle }, "共起テーブル"),
        h(
          "button",
          {
            type: "button",
            disabled: sortedPairs.length === 0,
            onClick: () => exportCsv("nlp-ja-cooccurrence.csv", pairsToCsvRows(sortedPairs)),
            style: {
              ...styles.secondaryButton,
              ...(sortedPairs.length === 0 ? styles.disabledButton : null),
            },
          },
          "CSV書き出し",
        ),
      ),
      sortedPairs.length > 0
        ? h(CooccurrenceTable, { h, pairs: sortedPairs, sortKey, sortDir, onSort: toggleSort })
        : h("div", { style: styles.empty }, "分析すると word_a / word_b / count の共起表が表示されます。"),
    ),
  );
}

function FrequencyChart({ h, frequency }) {
  const maxCount = Math.max(...frequency.map((item) => item.count), 1);

  return h(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "8px" } },
    ...frequency.map((item) =>
      h(
        "div",
        {
          key: item.token,
          style: {
            display: "grid",
            gridTemplateColumns: "minmax(64px, 110px) 1fr 38px",
            gap: "8px",
            alignItems: "center",
          },
        },
        h(
          "span",
          {
            title: item.token,
            style: {
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontSize: "12px",
              fontWeight: 700,
              color: "var(--color-text-primary)",
            },
          },
          item.token,
        ),
        h(
          "div",
          {
            style: {
              height: "12px",
              borderRadius: "999px",
              backgroundColor: "var(--color-bg-tertiary)",
              overflow: "hidden",
            },
          },
          h("div", {
            style: {
              width: `${Math.max(3, (item.count / maxCount) * 100)}%`,
              height: "100%",
              backgroundColor: "var(--color-accent-primary)",
              borderRadius: "999px",
            },
          }),
        ),
        h(
          "span",
          {
            style: {
              textAlign: "right",
              fontSize: "12px",
              color: "var(--color-text-secondary)",
            },
          },
          String(item.count),
        ),
      ),
    ),
  );
}

function NetworkSvg({ h, frequency, pairs, threshold }) {
  const graph = buildGraph(frequency, pairs, threshold);

  if (graph.nodes.length === 0) {
    return h("div", { style: styles.empty }, "閾値を満たすノードがありません。");
  }

  const maxEdge = Math.max(...graph.edges.map((edge) => edge.count), 1);
  const maxWeight = Math.max(...graph.nodes.map((node) => node.weight), 1);

  return h(
    "svg",
    {
      viewBox: "0 0 760 360",
      role: "img",
      "aria-label": "Japanese keyword co-occurrence network",
      style: {
        display: "block",
        width: "100%",
        minHeight: "280px",
        borderRadius: "6px",
        backgroundColor: "var(--color-bg-primary)",
        border: "1px solid var(--color-border-secondary)",
      },
    },
    h(
      "g",
      { opacity: 0.72 },
      ...graph.edges.map((edge) => {
        const source = graph.nodeById.get(edge.wordA);
        const target = graph.nodeById.get(edge.wordB);
        if (!source || !target) return null;
        return h("line", {
          key: `${edge.wordA}-${edge.wordB}`,
          x1: source.x,
          y1: source.y,
          x2: target.x,
          y2: target.y,
          stroke: "var(--color-accent-primary)",
          strokeWidth: 0.8 + (edge.count / maxEdge) * 4,
          strokeLinecap: "round",
        });
      }),
    ),
    h(
      "g",
      null,
      ...graph.nodes.map((node) => {
        const radius = 6 + Math.sqrt(node.weight / maxWeight) * 16;
        return h(
          "g",
          { key: node.id, transform: `translate(${node.x} ${node.y})` },
          h("circle", {
            r: radius,
            fill: "var(--color-bg-card)",
            stroke: "var(--color-accent-primary)",
            strokeWidth: "2",
          }),
          h("circle", {
            r: Math.max(2, radius - 5),
            fill: "var(--color-accent-primary)",
            opacity: 0.18,
          }),
          h(
            "text",
            {
              x: 0,
              y: radius + 14,
              textAnchor: "middle",
              fill: "var(--color-text-primary)",
              fontSize: "12",
              fontWeight: "700",
            },
            truncateLabel(node.id, 10),
          ),
        );
      }),
    ),
  );
}

function CooccurrenceTable({ h, pairs, sortKey, sortDir, onSort }) {
  const arrow = (key) => (sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "");
  const visiblePairs = pairs.slice(0, 120);

  return h(
    "div",
    { style: { maxHeight: "330px", overflow: "auto" } },
    h(
      "table",
      { style: styles.table },
      h(
        "thead",
        null,
        h(
          "tr",
          null,
          h("th", { style: styles.th }, tableButton(h, `word_a${arrow("wordA")}`, () => onSort("wordA"))),
          h("th", { style: styles.th }, tableButton(h, `word_b${arrow("wordB")}`, () => onSort("wordB"))),
          h("th", { style: { ...styles.th, textAlign: "right" } }, tableButton(h, `count${arrow("count")}`, () => onSort("count"))),
        ),
      ),
      h(
        "tbody",
        null,
        ...visiblePairs.map((pair) =>
          h(
            "tr",
            { key: `${pair.wordA}-${pair.wordB}` },
            h("td", { style: styles.td }, pair.wordA),
            h("td", { style: styles.td }, pair.wordB),
            h("td", { style: { ...styles.td, textAlign: "right", fontVariantNumeric: "tabular-nums" } }, String(pair.count)),
          ),
        ),
      ),
    ),
  );
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

async function analyzeSegment(segment, filters, windowSize) {
  const allowedTokens = new Set(tokenizeJapanese(segmentText(segment), filters));

  try {
    const result = await invoke("analyze_cooccurrence", {
      segmentId: segment.id,
      locale: "ja",
      windowSize,
      topN: COOC_TOP_N_PER_SEGMENT,
    });
    return filterPairsByAllowedTokens(normalizePairs(Array.isArray(result) ? result : []), allowedTokens);
  } catch (firstError) {
    try {
      const result = await invoke("analyze_cooccurrence", {
        segmentId: segment.id,
        windowSize,
        topN: COOC_TOP_N_PER_SEGMENT,
      });
      return filterPairsByAllowedTokens(normalizePairs(Array.isArray(result) ? result : []), allowedTokens);
    } catch (secondError) {
      console.warn("[nlp-ja-preprocess] backend co-occurrence failed; using local fallback.", firstError, secondError);
      return buildLocalPairs(segmentText(segment), filters, windowSize, COOC_TOP_N_PER_SEGMENT);
    }
  }
}

function computeFrequencies(segments, filters, topN) {
  const counts = new Map();
  for (const segment of segments) {
    for (const token of tokenizeJapanese(segmentText(segment), filters)) {
      counts.set(token, (counts.get(token) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([token, count]) => ({ token, count }))
    .sort((a, b) => b.count - a.count || a.token.localeCompare(b.token, "ja"))
    .slice(0, topN);
}

function buildLocalPairs(text, filters, windowSize, limit) {
  const tokens = tokenizeJapanese(text, filters);
  const counts = new Map();

  for (let start = 0; start < tokens.length; start += 1) {
    const end = Math.min(tokens.length, start + windowSize);
    for (let i = start; i < end; i += 1) {
      for (let j = i + 1; j < end; j += 1) {
        if (tokens[i] === tokens[j]) continue;
        const [wordA, wordB] = orderPair(tokens[i], tokens[j]);
        const key = `${wordA}\u0000${wordB}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
  }

  return [...counts.entries()]
    .map(([key, count]) => {
      const [wordA, wordB] = key.split("\u0000");
      return { wordA, wordB, count };
    })
    .sort((a, b) => b.count - a.count || a.wordA.localeCompare(b.wordA, "ja") || a.wordB.localeCompare(b.wordB, "ja"))
    .slice(0, limit);
}

function tokenizeJapanese(text, filters) {
  const normalized = String(text || "")
    .normalize("NFKC")
    .toLowerCase();
  const chunks = normalized.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー々〆ヵヶ]+|[a-z0-9][a-z0-9._-]*/gu) || [];
  const tokens = [];

  for (const chunk of chunks) {
    if (isNoiseToken(chunk)) continue;

    if (filters.noun) {
      const nounCandidates = nounCandidatesFromChunk(chunk);
      for (const token of nounCandidates) {
        if (!isNoiseToken(token)) tokens.push(token);
      }
    }

    if (filters.verb && isVerbLike(chunk) && !isNoiseToken(chunk)) {
      tokens.push(chunk);
    }

    if (filters.adjective && isAdjectiveLike(chunk) && !isNoiseToken(chunk)) {
      tokens.push(chunk);
    }
  }

  return tokens;
}

function nounCandidatesFromChunk(chunk) {
  if (/^[a-z0-9][a-z0-9._-]{1,}$/u.test(chunk)) return [chunk];
  if (/^[\p{Script=Katakana}ー]{2,}$/u.test(chunk)) return [chunk];
  if (/^[\p{Script=Han}々〆ヵヶ]{2,}$/u.test(chunk)) return [chunk];

  const candidates = [
    ...(chunk.match(/[\p{Script=Han}々〆ヵヶ]{2,}/gu) || []),
    ...(chunk.match(/[\p{Script=Katakana}ー]{2,}/gu) || []),
  ];

  return [...new Set(candidates)];
}

function isVerbLike(token) {
  return /[\p{Script=Hiragana}\p{Script=Han}](する|した|して|される|できる|なる|なった|いる|いた|ある|行う|見る|思う|考える|使う|作る|読む|書く|聞く|話す|示す|含む|得る|れる|られる|せる|させる|ます|ました|ない|た|て|う|く|ぐ|す|つ|ぬ|ぶ|む|る)$/u.test(token);
}

function isAdjectiveLike(token) {
  return /[\p{Script=Hiragana}\p{Script=Han}](い|しい|ない|らしい|っぽい|的)$/u.test(token);
}

function isNoiseToken(token) {
  if (!token || token.length < 2) return true;
  if (STOP_WORDS.has(token)) return true;
  if (/^[0-9._-]+$/u.test(token)) return true;
  return false;
}

function aggregatePairs(pairs) {
  const counts = new Map();

  for (const pair of normalizePairs(pairs)) {
    if (!pair.wordA || !pair.wordB || pair.wordA === pair.wordB) continue;
    const [wordA, wordB] = orderPair(pair.wordA, pair.wordB);
    const key = `${wordA}\u0000${wordB}`;
    counts.set(key, (counts.get(key) || 0) + Number(pair.count || 0));
  }

  return [...counts.entries()]
    .map(([key, count]) => {
      const [wordA, wordB] = key.split("\u0000");
      return { wordA, wordB, count };
    })
    .filter((pair) => pair.count > 0)
    .sort((a, b) => b.count - a.count || a.wordA.localeCompare(b.wordA, "ja") || a.wordB.localeCompare(b.wordB, "ja"));
}

function filterPairsByAllowedTokens(pairs, allowedTokens) {
  if (allowedTokens.size === 0) return [];
  return pairs.filter((pair) => allowedTokens.has(pair.wordA) && allowedTokens.has(pair.wordB));
}

function normalizePairs(pairs) {
  return pairs.map((pair) => ({
    wordA: String(pair.wordA ?? pair.word_a ?? ""),
    wordB: String(pair.wordB ?? pair.word_b ?? ""),
    count: Number(pair.count ?? 0),
  }));
}

function buildGraph(frequency, pairs, threshold) {
  const frequencyByToken = new Map(frequency.map((item) => [item.token, item.count]));
  const edges = pairs
    .filter((pair) => Number(pair.count) >= threshold)
    .slice(0, 80)
    .map((pair) => ({ wordA: pair.wordA, wordB: pair.wordB, count: Number(pair.count) }));
  const nodes = new Map();

  for (const edge of edges) {
    for (const word of [edge.wordA, edge.wordB]) {
      const current = nodes.get(word) || { id: word, weight: frequencyByToken.get(word) || 0 };
      current.weight += edge.count * 0.25;
      nodes.set(word, current);
    }
  }

  if (nodes.size === 0) {
    for (const item of frequency.slice(0, 16)) {
      nodes.set(item.token, { id: item.token, weight: item.count });
    }
  }

  const nodeList = [...nodes.values()].slice(0, 60);
  const positions = layoutNetwork(nodeList, edges, 760, 360);
  const positionedNodes = nodeList.map((node) => ({ ...node, ...(positions.get(node.id) || { x: 380, y: 180 }) }));
  const nodeById = new Map(positionedNodes.map((node) => [node.id, node]));

  return {
    nodes: positionedNodes,
    edges: edges.filter((edge) => nodeById.has(edge.wordA) && nodeById.has(edge.wordB)),
    nodeById,
  };
}

function layoutNetwork(nodes, edges, width, height) {
  const positions = new Map();
  const velocity = new Map();
  const margin = 42;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.32;
  const safeNodes = nodes.length > 0 ? nodes : [];

  safeNodes.forEach((node, index) => {
    const angle = (index / Math.max(safeNodes.length, 1)) * Math.PI * 2 + hashAngle(node.id);
    positions.set(node.id, {
      x: centerX + Math.cos(angle) * radius * (0.7 + (index % 5) * 0.05),
      y: centerY + Math.sin(angle) * radius * (0.7 + (index % 7) * 0.04),
    });
    velocity.set(node.id, { x: 0, y: 0 });
  });

  const area = width * height;
  const k = Math.sqrt(area / Math.max(safeNodes.length, 1));

  for (let tick = 0; tick < 90; tick += 1) {
    const temperature = (1 - tick / 90) * 10;

    for (let i = 0; i < safeNodes.length; i += 1) {
      for (let j = i + 1; j < safeNodes.length; j += 1) {
        const a = safeNodes[i];
        const b = safeNodes[j];
        const pa = positions.get(a.id);
        const pb = positions.get(b.id);
        const dx = pa.x - pb.x;
        const dy = pa.y - pb.y;
        const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const force = (k * k) / distance;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        addVelocity(velocity, a.id, fx, fy);
        addVelocity(velocity, b.id, -fx, -fy);
      }
    }

    for (const edge of edges) {
      const pa = positions.get(edge.wordA);
      const pb = positions.get(edge.wordB);
      if (!pa || !pb) continue;
      const dx = pa.x - pb.x;
      const dy = pa.y - pb.y;
      const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const force = (distance * distance) / k / Math.max(1, Math.sqrt(edge.count));
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;
      addVelocity(velocity, edge.wordA, -fx, -fy);
      addVelocity(velocity, edge.wordB, fx, fy);
    }

    for (const node of safeNodes) {
      const pos = positions.get(node.id);
      const vel = velocity.get(node.id);
      const length = Math.max(1, Math.sqrt(vel.x * vel.x + vel.y * vel.y));
      pos.x = clamp(pos.x + (vel.x / length) * Math.min(length, temperature), margin, width - margin);
      pos.y = clamp(pos.y + (vel.y / length) * Math.min(length, temperature), margin, height - margin);
      velocity.set(node.id, { x: 0, y: 0 });
    }
  }

  return positions;
}

function addVelocity(velocity, id, x, y) {
  const current = velocity.get(id) || { x: 0, y: 0 };
  current.x += x;
  current.y += y;
  velocity.set(id, current);
}

function flattenCodeTree(tree, depth = 0) {
  const output = [];
  for (const node of tree) {
    const code = node.code || node;
    if (code?.id) {
      output.push({
        id: code.id,
        name: code.name || "Untitled code",
        depth,
        assignmentCount: node.assignmentCount ?? node.assignment_count ?? code.assignmentCount ?? 0,
      });
    }
    const children = Array.isArray(node.children) ? node.children : [];
    output.push(...flattenCodeTree(children, depth + 1));
  }
  return output;
}

function dedupeSegments(segments) {
  const seen = new Set();
  const output = [];
  for (const segment of segments) {
    const id = segment?.id || `${segment?.sourceId || segment?.source_id || ""}:${segmentText(segment)}`;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    output.push(segment);
  }
  return output;
}

function segmentText(segment) {
  return String(segment?.segmentText ?? segment?.segment_text ?? segment?.text ?? "");
}

async function invoke(command, args) {
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

function frequencyToCsvRows(frequency) {
  return [["token", "count"], ...frequency.map((item) => [item.token, item.count])];
}

function pairsToCsvRows(pairs) {
  return [["word_a", "word_b", "count"], ...pairs.map((pair) => [pair.wordA, pair.wordB, pair.count])];
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/u.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function orderPair(a, b) {
  return a <= b ? [a, b] : [b, a];
}

function indent(depth) {
  return depth > 0 ? `${"　".repeat(depth)}↳ ` : "";
}

function truncateLabel(label, maxLength) {
  return label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label;
}

function hashAngle(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return ((hash % 360) / 180) * Math.PI;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toErrorMessage(err) {
  return String(err?.message || err || "不明なエラー").replace(/^Error:\s*/i, "");
}
