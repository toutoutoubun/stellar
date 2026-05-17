/* eslint-disable react-refresh/only-export-components -- analysis add-ons register themselves by module side effect. */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "../lib/tauriShim";
import type { SourceSegmentCode } from "../types";
import { registerQualitativeAnalysisAddon } from "./analysisAddons";

const ADDON_ID = "sentiment-context";
const DEFAULT_WINDOW_SIZE = 5;
const DEFAULT_TOP_N = 80;
const LEXICON_STORAGE_KEY = "stellar.sentimentContextAddon.lexicon";
const TARGET_STORAGE_KEY = "stellar.sentimentContextAddon.targets";
const STOPWORD_STORAGE_KEY = "stellar.sentimentContextAddon.stopwords";

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

type LocaleMode = "auto" | "ja" | "en";
type SentimentLabel = "positive" | "negative" | "neutral";
type SortKey = "total" | "before" | "after" | "token" | "target";
type SortDir = "asc" | "desc";

interface CodeOption {
  id: string;
  name: string;
  depth: number;
  assignmentCount: number;
}

interface LexiconEntry {
  term: string;
  normalizedTerm: string;
  score: number;
  label: SentimentLabel;
  tokens: string[];
}

interface TargetEntry {
  term: string;
  normalizedTerm: string;
  tokens: string[];
}

interface TokenizedSegment {
  segment: SourceSegmentCode;
  tokens: string[];
}

interface ContextRow {
  target: string;
  token: string;
  beforeCount: number;
  afterCount: number;
  total: number;
}

interface ConcordanceRow {
  id: string;
  target: string;
  sourceTitle: string;
  before: string;
  after: string;
  score: number;
  label: SentimentLabel;
  matchedTerms: string[];
}

interface TargetSummary {
  target: string;
  hits: number;
  score: number;
  positive: number;
  negative: number;
  neutral: number;
}

interface AnalysisResult {
  segmentCount: number;
  tokenCount: number;
  hitCount: number;
  totalScore: number;
  targetSummaries: TargetSummary[];
  contextRows: ContextRow[];
  concordanceRows: ConcordanceRow[];
  sentimentTermRows: Array<{ term: string; label: SentimentLabel; score: number; count: number }>;
}

const SentimentIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 18,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 17.5 9 12l3.2 3.2L20 6.5" />
    <path d="M4 6.5h6" />
    <path d="M4 10h4" />
    <path d="M4 13.5h2.5" />
  </svg>
);

const styles: Record<string, React.CSSProperties> = {
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
    gridTemplateColumns: "minmax(220px, 1.2fr) minmax(150px, 0.7fr) minmax(180px, 0.9fr) minmax(140px, 0.7fr)",
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

registerQualitativeAnalysisAddon({
  id: ADDON_ID,
  label: "センチメント文脈",
  description: "評価語辞書と対象語の前後N語を集計します。",
  icon: SentimentIcon,
  order: 110,
  render: (context) => <SentimentContextPanel context={context} />,
});

function SentimentContextPanel({
  context,
}: {
  context: { projectId: string; project: unknown };
}) {
  const projectId = context.projectId;
  const [codes, setCodes] = useState<CodeOption[]>([]);
  const [targetCodeId, setTargetCodeId] = useState("all");
  const [locale, setLocale] = useState<LocaleMode>("auto");
  const [windowSize, setWindowSize] = useState(DEFAULT_WINDOW_SIZE);
  const [topN, setTopN] = useState(DEFAULT_TOP_N);
  const [lexiconText, setLexiconText] = useState(() =>
    readStorage(LEXICON_STORAGE_KEY, DEFAULT_LEXICON),
  );
  const [targetText, setTargetText] = useState(() => readStorage(TARGET_STORAGE_KEY, ""));
  const [stopwordText, setStopwordText] = useState(() =>
    readStorage(STOPWORD_STORAGE_KEY, DEFAULT_STOPWORDS),
  );
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("対象語と評価語リストを設定してください。");
  const [error, setError] = useState("");

  useEffect(() => {
    writeStorage(LEXICON_STORAGE_KEY, lexiconText);
  }, [lexiconText]);

  useEffect(() => {
    writeStorage(TARGET_STORAGE_KEY, targetText);
  }, [targetText]);

  useEffect(() => {
    writeStorage(STOPWORD_STORAGE_KEY, stopwordText);
  }, [stopwordText]);

  useEffect(() => {
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
        const tree = await invoke<unknown[]>("get_code_tree", { projectId });
        if (cancelled) return;
        const flatCodes = flattenCodeTree(Array.isArray(tree) ? tree : []);
        setCodes(flatCodes);
        setNotice(
          flatCodes.length > 0
            ? "コード付きセグメントを対象に分析できます。"
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

  const selectedCodes = useMemo(() => {
    if (targetCodeId === "all") return codes;
    return codes.filter((code) => code.id === targetCodeId);
  }, [codes, targetCodeId]);

  const sortedContextRows = useMemo(() => {
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

  const lexiconPreview = useMemo(() => parseLexicon(lexiconText), [lexiconText]);
  const targetPreview = useMemo(() => parseTargetTerms(targetText), [targetText]);

  const runAnalysis = useCallback(async () => {
    if (!projectId) {
      setError("質的分析プロジェクトが選択されていません。");
      return;
    }
    if (selectedCodes.length === 0) {
      setError("分析対象のコード付きセグメントがありません。");
      return;
    }

    const lexicon = parseLexicon(lexiconText);
    if (lexicon.errors.length > 0) {
      setError(lexicon.errors[0] ?? "評価語リストを確認してください。");
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
    setNotice("コード付きセグメントを取得中...");

    try {
      const segmentGroups = await mapLimit(selectedCodes, 6, async (code) => {
        const segments = await invoke<SourceSegmentCode[]>("get_source_segments_by_code", {
          codeId: code.id,
        });
        return Array.isArray(segments) ? segments : [];
      });
      const segments = dedupeSegments(segmentGroups.flat());

      if (segments.length === 0) {
        setResult(null);
        setNotice("対象コードにコード付きセグメントがありません。");
        return;
      }

      setNotice(`${segments.length} セグメントをトークン化中...`);
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
        `${nextResult.segmentCount} セグメント、${nextResult.hitCount} 対象語ヒットを集計しました。`,
      );
    } catch (err) {
      setError(toErrorMessage(err));
      setNotice("");
    } finally {
      setLoading(false);
    }
  }, [lexiconText, locale, projectId, selectedCodes, stopwordText, targetText, topN, windowSize]);

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey((currentKey) => {
      if (currentKey === key) {
        setSortDir((currentDir) => (currentDir === "asc" ? "desc" : "asc"));
        return currentKey;
      }
      setSortDir(key === "token" || key === "target" ? "asc" : "desc");
      return key;
    });
  }, []);

  const disabled = loading || loadingCodes || !projectId || selectedCodes.length === 0;

  return (
    <section style={styles.panel}>
      <header style={styles.header}>
        <div>
          <div style={styles.titleWrap}>
            <SentimentIcon size={20} />
            <h2 style={styles.title}>センチメント文脈分析</h2>
          </div>
          <p style={styles.description}>
            辞書ベースで対象語の前後N語を集計し、周辺の評価語スコアを算出します。
          </p>
        </div>
        <button
          type="button"
          onClick={runAnalysis}
          disabled={disabled}
          style={{ ...styles.button, ...(disabled ? styles.disabledButton : null) }}
        >
          {loading ? "分析中" : "分析する"}
        </button>
      </header>

      <div style={styles.toolbar}>
        <label style={styles.label}>
          対象コード
          <select
            value={targetCodeId}
            disabled={loadingCodes || loading}
            onChange={(event) => setTargetCodeId(event.target.value)}
            style={styles.select}
          >
            <option value="all">全コード付きセグメント ({codes.length} コード)</option>
            {codes.map((code) => (
              <option key={code.id} value={code.id}>
                {indent(code.depth)}
                {code.name}
                {code.assignmentCount ? ` (${code.assignmentCount})` : ""}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          言語
          <select
            value={locale}
            disabled={loading}
            onChange={(event) => setLocale(event.target.value as LocaleMode)}
            style={styles.select}
          >
            <option value="auto">自動</option>
            <option value="ja">日本語</option>
            <option value="en">English</option>
          </select>
        </label>

        <label style={styles.label}>
          前後N語: {windowSize}
          <input
            type="range"
            min="1"
            max="15"
            step="1"
            value={windowSize}
            onChange={(event) => setWindowSize(Number(event.target.value))}
            style={styles.range}
          />
        </label>

        <label style={styles.label}>
          表示件数
          <input
            type="number"
            min="20"
            max="300"
            step="10"
            value={topN}
            onChange={(event) => setTopN(clampNumber(Number(event.target.value), 20, 300))}
            style={styles.input}
          />
        </label>
      </div>

      <div style={styles.editorGrid}>
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>評価語リスト</h3>
            <button
              type="button"
              onClick={() => setLexiconText(DEFAULT_LEXICON)}
              style={styles.secondaryButton}
            >
              サンプル
            </button>
          </div>
          <div style={styles.sectionBody}>
            <textarea
              value={lexiconText}
              onChange={(event) => setLexiconText(event.target.value)}
              placeholder="term,score,label"
              spellCheck={false}
              style={styles.textArea}
            />
            <div style={{ ...styles.status, marginTop: "8px" }}>
              {lexiconPreview.entries.length} 語 / positive{" "}
              {lexiconPreview.entries.filter((entry) => entry.label === "positive").length} / negative{" "}
              {lexiconPreview.entries.filter((entry) => entry.label === "negative").length}
            </div>
          </div>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>対象語</h3>
            <span style={styles.pill}>{targetPreview.length} 語</span>
          </div>
          <div style={styles.sectionBody}>
            <textarea
              value={targetText}
              onChange={(event) => setTargetText(event.target.value)}
              placeholder="政策&#10;government&#10;climate change"
              spellCheck={false}
              style={styles.textArea}
            />
          </div>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>除外語</h3>
            <button
              type="button"
              onClick={() => setStopwordText(DEFAULT_STOPWORDS)}
              style={styles.secondaryButton}
            >
              初期値
            </button>
          </div>
          <div style={styles.sectionBody}>
            <textarea
              value={stopwordText}
              onChange={(event) => setStopwordText(event.target.value)}
              placeholder="the&#10;and&#10;こと"
              spellCheck={false}
              style={{ ...styles.textArea, minHeight: "150px" }}
            />
          </div>
        </section>
      </div>

      {error ? <div style={styles.error}>{error}</div> : null}
      {notice ? <div style={styles.status}>{notice}</div> : null}

      <Metrics result={result} />

      <div style={styles.resultGrid}>
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>対象語別スコア</h3>
            <button
              type="button"
              disabled={!result}
              onClick={() =>
                result
                  ? exportCsv("sentiment-target-summary.csv", targetSummaryToRows(result.targetSummaries))
                  : undefined
              }
              style={{ ...styles.secondaryButton, ...(!result ? styles.disabledButton : null) }}
            >
              CSV
            </button>
          </div>
          {result ? (
            <TargetSummaryTable summaries={result.targetSummaries} />
          ) : (
            <div style={styles.empty}>分析すると対象語別のスコアが表示されます。</div>
          )}
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>前後語カウント</h3>
            <button
              type="button"
              disabled={!result}
              onClick={() =>
                result ? exportCsv("sentiment-context-counts.csv", contextRowsToRows(result.contextRows)) : undefined
              }
              style={{ ...styles.secondaryButton, ...(!result ? styles.disabledButton : null) }}
            >
              CSV
            </button>
          </div>
          {result ? (
            <ContextTable rows={sortedContextRows} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
          ) : (
            <div style={styles.empty}>対象語の前後に出る語がここに集計されます。</div>
          )}
        </section>
      </div>

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>コンコーダンス</h3>
          <button
            type="button"
            disabled={!result}
            onClick={() =>
              result
                ? exportCsv("sentiment-concordance.csv", concordanceRowsToRows(result.concordanceRows))
                : undefined
            }
            style={{ ...styles.secondaryButton, ...(!result ? styles.disabledButton : null) }}
          >
            CSV書き出し
          </button>
        </div>
        {result ? (
          <ConcordanceTable rows={result.concordanceRows.slice(0, topN)} />
        ) : (
          <div style={styles.empty}>対象語の左右文脈と評価語ヒットが表示されます。</div>
        )}
      </section>

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>評価語ヒット</h3>
          <button
            type="button"
            disabled={!result}
            onClick={() =>
              result
                ? exportCsv("sentiment-lexicon-hits.csv", sentimentTermRowsToRows(result.sentimentTermRows))
                : undefined
            }
            style={{ ...styles.secondaryButton, ...(!result ? styles.disabledButton : null) }}
          >
            CSV
          </button>
        </div>
        {result ? (
          <SentimentTermTable rows={result.sentimentTermRows.slice(0, topN)} />
        ) : (
          <div style={styles.empty}>前後N語内で見つかった評価語が表示されます。</div>
        )}
      </section>
    </section>
  );
}

function Metrics({ result }: { result: AnalysisResult | null }) {
  const metrics = [
    { label: "対象語ヒット", value: result?.hitCount ?? 0 },
    { label: "総スコア", value: formatScore(result?.totalScore ?? 0) },
    { label: "セグメント", value: result?.segmentCount ?? 0 },
    { label: "トークン", value: result?.tokenCount ?? 0 },
  ];

  return (
    <div style={styles.metrics}>
      {metrics.map((metric) => (
        <div key={metric.label} style={styles.metric}>
          <p style={styles.metricLabel}>{metric.label}</p>
          <p style={styles.metricValue}>{metric.value}</p>
        </div>
      ))}
    </div>
  );
}

function TargetSummaryTable({ summaries }: { summaries: TargetSummary[] }) {
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>target</th>
            <th style={{ ...styles.th, textAlign: "right" }}>hits</th>
            <th style={{ ...styles.th, textAlign: "right" }}>score</th>
            <th style={{ ...styles.th, textAlign: "right" }}>positive</th>
            <th style={{ ...styles.th, textAlign: "right" }}>negative</th>
          </tr>
        </thead>
        <tbody>
          {summaries.map((summary) => (
            <tr key={summary.target}>
              <td style={styles.td}>{summary.target}</td>
              <td style={{ ...styles.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {summary.hits}
              </td>
              <td style={{ ...styles.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {formatScore(summary.score)}
              </td>
              <td style={{ ...styles.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {summary.positive}
              </td>
              <td style={{ ...styles.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {summary.negative}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContextTable({
  rows,
  sortKey,
  sortDir,
  onSort,
}: {
  rows: ContextRow[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const arrow = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "");

  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>{tableButton(`target${arrow("target")}`, () => onSort("target"))}</th>
            <th style={styles.th}>{tableButton(`token${arrow("token")}`, () => onSort("token"))}</th>
            <th style={{ ...styles.th, textAlign: "right" }}>
              {tableButton(`before${arrow("before")}`, () => onSort("before"))}
            </th>
            <th style={{ ...styles.th, textAlign: "right" }}>
              {tableButton(`after${arrow("after")}`, () => onSort("after"))}
            </th>
            <th style={{ ...styles.th, textAlign: "right" }}>
              {tableButton(`total${arrow("total")}`, () => onSort("total"))}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.target}:${row.token}`}>
              <td style={styles.td}>{row.target}</td>
              <td style={styles.td}>{row.token}</td>
              <td style={{ ...styles.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {row.beforeCount}
              </td>
              <td style={{ ...styles.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {row.afterCount}
              </td>
              <td style={{ ...styles.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {row.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConcordanceTable({ rows }: { rows: ConcordanceRow[] }) {
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>source</th>
            <th style={styles.th}>context</th>
            <th style={{ ...styles.th, textAlign: "right" }}>score</th>
            <th style={styles.th}>label</th>
            <th style={styles.th}>matched</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td style={{ ...styles.td, maxWidth: "170px" }}>{row.sourceTitle || "分析ソース"}</td>
              <td style={styles.td}>
                <div style={styles.snippet}>
                  <span title={row.before} style={{ ...styles.snippetSide, textAlign: "right" }}>
                    {row.before}
                  </span>
                  <span style={styles.snippetTarget}>{row.target}</span>
                  <span title={row.after} style={styles.snippetSide}>
                    {row.after}
                  </span>
                </div>
              </td>
              <td style={{ ...styles.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {formatScore(row.score)}
              </td>
              <td style={styles.td}>
                <SentimentPill label={row.label} />
              </td>
              <td style={styles.td}>{row.matchedTerms.join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SentimentTermTable({
  rows,
}: {
  rows: Array<{ term: string; label: SentimentLabel; score: number; count: number }>;
}) {
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>term</th>
            <th style={styles.th}>label</th>
            <th style={{ ...styles.th, textAlign: "right" }}>score</th>
            <th style={{ ...styles.th, textAlign: "right" }}>count</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.term}:${row.label}`}>
              <td style={styles.td}>{row.term}</td>
              <td style={styles.td}>
                <SentimentPill label={row.label} />
              </td>
              <td style={{ ...styles.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {formatScore(row.score)}
              </td>
              <td style={{ ...styles.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {row.count}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SentimentPill({ label }: { label: SentimentLabel }) {
  const color =
    label === "positive"
      ? "var(--color-accent-secondary)"
      : label === "negative"
        ? "var(--color-accent-danger)"
        : "var(--color-text-tertiary)";
  return <span style={{ ...styles.pill, color, borderColor: color }}>{label}</span>;
}

function tableButton(label: string, onClick: () => void) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: 0,
        border: "none",
        background: "none",
        color: "inherit",
        font: "inherit",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function parseLexicon(text: string): { entries: LexiconEntry[]; errors: string[] } {
  const entries: LexiconEntry[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

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
      label: parsed.label ?? labelFromScore(parsed.score),
      tokens,
    });
  }

  return { entries, errors };
}

function parseLexiconLine(
  line: string,
): { term: string; score: number; label?: SentimentLabel } | null {
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

  const first = parts[0];
  const second = parts[1];
  const third = parts[2];
  const score = parseScore(second, third);
  const label = parseLabel(third) ?? parseLabel(second) ?? labelFromScore(score);

  return { term: first, score, label };
}

function parseScore(primary?: string, secondary?: string): number {
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

function parseLabel(value?: string): SentimentLabel | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (["positive", "pos", "+"].includes(normalized)) return "positive";
  if (["negative", "neg", "-"].includes(normalized)) return "negative";
  if (["neutral", "neu", "0"].includes(normalized)) return "neutral";
  return null;
}

function labelFromScore(score: number): SentimentLabel {
  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}

function parseTargetTerms(text: string): TargetEntry[] {
  const seen = new Set<string>();
  const targets: TargetEntry[] = [];
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

function parseStopwords(text: string): Set<string> {
  return new Set(
    text
      .split(/[\n,、;；]+/u)
      .map((term) => normalizeTerm(stripComment(term)))
      .filter(Boolean),
  );
}

function tokenizeSegments(
  segments: SourceSegmentCode[],
  locale: LocaleMode,
  lexicon: LexiconEntry[],
  targets: TargetEntry[],
  stopwords: Set<string>,
): TokenizedSegment[] {
  const knownTerms = [...lexicon.map((entry) => entry.normalizedTerm), ...targets.map((target) => target.normalizedTerm)];
  return segments.map((segment) => ({
    segment,
    tokens: tokenizeText(segment.segmentText, locale, knownTerms).filter((token) => !stopwords.has(token)),
  }));
}

function analyzeTokenizedSegments(
  tokenizedSegments: TokenizedSegment[],
  lexicon: LexiconEntry[],
  targets: TargetEntry[],
  options: { windowSize: number; topN: number },
): AnalysisResult {
  const targetSummaryMap = new Map<string, TargetSummary>();
  const contextCountMap = new Map<string, ContextRow>();
  const sentimentTermMap = new Map<string, { term: string; label: SentimentLabel; score: number; count: number }>();
  const concordanceRows: ConcordanceRow[] = [];
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
        const sentimentHits = findSentimentHits(contextTokens, lexicon);
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
          sourceTitle: segment.sourceTitle,
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

function findSentimentHits(tokens: string[], lexicon: LexiconEntry[]) {
  const hits: Array<{ entry: LexiconEntry; start: number }> = [];
  for (const entry of lexicon) {
    for (const start of findTermMatches(tokens, entry.tokens)) {
      hits.push({ entry, start });
    }
  }
  return hits.sort((a, b) => a.start - b.start || b.entry.tokens.length - a.entry.tokens.length);
}

function updateTargetSummary(
  summaries: Map<string, TargetSummary>,
  target: string,
  score: number,
  label: SentimentLabel,
) {
  const current =
    summaries.get(target) ??
    {
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

function updateContextCounts(
  counts: Map<string, ContextRow>,
  target: string,
  tokens: string[],
  side: "before" | "after",
) {
  for (const token of tokens) {
    if (!token || token === target) continue;
    const key = `${target}\u0000${token}`;
    const current =
      counts.get(key) ??
      {
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

function updateSentimentTermCounts(
  counts: Map<string, { term: string; label: SentimentLabel; score: number; count: number }>,
  hits: Array<{ entry: LexiconEntry; start: number }>,
) {
  for (const hit of hits) {
    const key = `${hit.entry.normalizedTerm}\u0000${hit.entry.label}`;
    const current =
      counts.get(key) ??
      {
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

function findTermMatches(tokens: string[], termTokens: string[]): number[] {
  if (termTokens.length === 0 || tokens.length < termTokens.length) return [];
  const matches: number[] = [];
  for (let start = 0; start <= tokens.length - termTokens.length; start += 1) {
    let matched = true;
    for (let offset = 0; offset < termTokens.length; offset += 1) {
      if (tokens[start + offset] !== termTokens[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) matches.push(start);
  }
  return matches;
}

function tokenizeText(text: string, locale: LocaleMode, knownTerms: string[]): string[] {
  const normalized = String(text ?? "").normalize("NFKC").toLowerCase();
  const termList = knownTerms
    .filter((term) => term && !term.includes(" ") && containsJapanese(term))
    .sort((a, b) => b.length - a.length || a.localeCompare(b, "ja"));

  if (locale === "en") {
    return tokenizeEnglish(normalized);
  }

  const chunks =
    normalized.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー々〆ヵヶ]+|[a-z0-9][a-z0-9._'-]*/gu) ?? [];
  const tokens: string[] = [];

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

function tokenizeEnglish(text: string): string[] {
  return (
    text
      .match(/[a-z0-9][a-z0-9._'-]*/gu)
      ?.map(normalizeTerm)
      .filter((token) => token && !/^[0-9._'-]+$/u.test(token)) ?? []
  );
}

function splitJapaneseChunkByTerms(chunk: string, terms: string[]): string[] {
  if (terms.length === 0) return splitJapaneseFallback(chunk);

  const output: string[] = [];
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

    buffer += chunk[index] ?? "";
    index += 1;
  }

  output.push(...splitJapaneseFallback(buffer));
  return output.filter(Boolean);
}

function splitJapaneseFallback(chunk: string): string[] {
  if (!chunk) return [];
  const output: string[] = [];
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

function japaneseCharType(char: string): string {
  if (/\p{Script=Han}|々|〆|ヵ|ヶ/u.test(char)) return "kanji";
  if (/\p{Script=Katakana}|ー/u.test(char)) return "katakana";
  if (/\p{Script=Hiragana}/u.test(char)) return "hiragana";
  return "other";
}

function tokenizeTerm(term: string): string[] {
  const normalized = normalizeTerm(term);
  if (!normalized) return [];
  if (normalized.includes(" ")) {
    return normalized.split(/\s+/u).map(normalizeTerm).filter(Boolean);
  }
  return [normalized];
}

function normalizeTerm(term: string): string {
  return term
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/^[\s"'“”‘’.,!?;:()[\]{}]+|[\s"'“”‘’.,!?;:()[\]{}]+$/gu, "");
}

function containsJapanese(value: string): boolean {
  return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー々〆ヵヶ]/u.test(value);
}

function stripComment(line: string): string {
  const trimmed = line.trim();
  if (trimmed.startsWith("#")) return "";
  return line.replace(/\s+#.*$/u, "");
}

function flattenCodeTree(tree: unknown[], depth = 0): CodeOption[] {
  const output: CodeOption[] = [];
  for (const node of tree) {
    if (!isRecord(node)) continue;
    const rawCode = isRecord(node.code) ? node.code : node;
    const id = typeof rawCode.id === "string" ? rawCode.id : "";
    if (id) {
      output.push({
        id,
        name: typeof rawCode.name === "string" ? rawCode.name : "Untitled code",
        depth,
        assignmentCount:
          numberFrom(node.assignmentCount) ??
          numberFrom(node.assignment_count) ??
          numberFrom(rawCode.assignmentCount) ??
          0,
      });
    }
    if (Array.isArray(node.children)) {
      output.push(...flattenCodeTree(node.children, depth + 1));
    }
  }
  return output;
}

function dedupeSegments(segments: SourceSegmentCode[]): SourceSegmentCode[] {
  const seen = new Set<string>();
  const output: SourceSegmentCode[] = [];
  for (const segment of segments) {
    const key = segment.id || `${segment.sourceId}:${segment.codeId}:${segment.segmentText}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(segment);
  }
  return output;
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(items.length);
  let index = 0;

  async function run() {
    while (index < items.length) {
      const current = index;
      index += 1;
      output[current] = await worker(items[current] as T, current);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return output;
}

function valueForSort(row: ContextRow, key: SortKey): string | number {
  if (key === "before") return row.beforeCount;
  if (key === "after") return row.afterCount;
  if (key === "total") return row.total;
  if (key === "target") return row.target;
  return row.token;
}

function targetSummaryToRows(summaries: TargetSummary[]): Array<Array<string | number>> {
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

function contextRowsToRows(rows: ContextRow[]): Array<Array<string | number>> {
  return [
    ["target", "token", "before_count", "after_count", "total"],
    ...rows.map((row) => [row.target, row.token, row.beforeCount, row.afterCount, row.total]),
  ];
}

function concordanceRowsToRows(rows: ConcordanceRow[]): Array<Array<string | number>> {
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

function sentimentTermRowsToRows(
  rows: Array<{ term: string; label: SentimentLabel; score: number; count: number }>,
): Array<Array<string | number>> {
  return [
    ["term", "label", "score", "count"],
    ...rows.map((row) => [row.term, row.label, row.score, row.count]),
  ];
}

function exportCsv(filename: string, rows: Array<Array<string | number>>) {
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

function csvCell(value: string | number): string {
  const text = String(value ?? "");
  if (/[",\n\r]/u.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function readStorage(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(key) ?? fallback;
}

function writeStorage(key: string, value: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function numberFrom(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function indent(depth: number): string {
  return depth > 0 ? `${"　".repeat(depth)}↳ ` : "";
}

function formatScore(score: number): string {
  if (Number.isInteger(score)) return String(score);
  return score.toFixed(2);
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function toErrorMessage(err: unknown): string {
  return String(err instanceof Error ? err.message : err || "不明なエラー").replace(/^Error:\s*/i, "");
}
