// ============================================================================
// src/lib/stats/textAnalysis.ts
// Stellar — Japanese text mining: tokenisation (kuromoji), TF-IDF,
//           co-occurrence network construction.
// Dependencies: kuromoji (npm), graphology ecosystem.
// ============================================================================

import type { TextAnalysisResult, NetworkAnalysisResult } from "./types";
import { analyzeNetwork } from "./networkAnalysis";

// ---------------------------------------------------------------------------
// Kuromoji tokeniser singleton
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KuromojiTokenizer = { tokenize: (text: string) => KuromojiToken[] };

interface KuromojiToken {
  surface_form: string;
  pos: string;
  pos_detail_1: string;
  basic_form: string;
  reading?: string;
}

let _tokenizer: KuromojiTokenizer | null = null;

/**
 * Lazily initialise the kuromoji tokeniser.  Dictionary path is resolved
 * relative to the node_modules location bundled by Vite / Tauri.
 */
async function getTokenizer(): Promise<KuromojiTokenizer> {
  if (_tokenizer) return _tokenizer;

  // kuromoji is CJS — use variable to prevent Vite static analysis from
  // detecting and pre-bundling the 18 MB dictionary module.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modName = "kuromoji";
  const kuromoji = (await import(/* @vite-ignore */ modName)) as any;
  const kuromojiMod = kuromoji.default ?? kuromoji;

  return new Promise<KuromojiTokenizer>((resolve, reject) => {
    kuromojiMod
      .builder({ dicPath: "node_modules/kuromoji/dict/" })
      .build(
        (
          err: Error | null,
          tokenizer: KuromojiTokenizer,
        ) => {
          if (err) return reject(err);
          _tokenizer = tokenizer;
          resolve(tokenizer);
        },
      );
  });
}

// ---------------------------------------------------------------------------
// Default Japanese stopwords
// ---------------------------------------------------------------------------

const DEFAULT_STOPWORDS = new Set([
  // Particles
  "の", "に", "は", "を", "た", "が", "で", "て", "と", "し", "れ", "さ",
  "ある", "いる", "も", "する", "から", "な", "こと", "として", "い", "や",
  "れる", "など", "なっ", "ない", "この", "ため", "その", "あっ", "よう",
  "また", "もの", "という", "あり", "まで", "られ", "なる", "へ", "か",
  "だ", "これ", "によって", "により", "おり", "より", "による", "ず", "なり",
  "られる", "において", "ば", "なかっ", "なく", "しかし", "について",
  "せ", "だっ", "それ", "ほど", "とき", "よる", "そして", "ところ",
  // Common verbs in base forms that are too generic
  "できる", "なる", "ある", "いう", "行う", "思う", "見る", "言う",
  // Symbols & numbers that slip through
  "、", "。", "・", "「", "」", "（", "）", "『", "』",
  "-", "ー", "〜", "…", "!", "?", " ", "　",
]);

/** POS tags we keep: nouns (名詞), verbs (動詞), adjectives (形容詞). */
const ALLOWED_POS = new Set(["名詞", "動詞", "形容詞"]);

/** Noun sub-categories to exclude (too grammatical). */
const EXCLUDED_NOUN_DETAILS = new Set([
  "非自立", "代名詞", "数", "接尾", "特殊",
]);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyse an array of Japanese free-text responses.
 *
 * 1. Tokenise with kuromoji, filter by POS.
 * 2. Compute raw frequency & TF-IDF per token.
 * 3. Build co-occurrence network from sentence-level co-occurrences.
 * 4. Return {@link TextAnalysisResult}.
 */
export async function analyzeTextVariable(
  texts: string[],
  variableId: string,
  stopWords?: string[],
): Promise<TextAnalysisResult> {
  const tokenizer = await getTokenizer();
  const customStops = new Set([...DEFAULT_STOPWORDS, ...(stopWords ?? [])]);

  // ── Step 1: Tokenise each document ────────────────────────────────────
  /** Per-document token lists (surface forms, filtered). */
  const docTokens: string[][] = [];
  /** Per-sentence token lists (for co-occurrence). */
  const sentenceTokens: string[][] = [];
  /** Per-document token → count. */
  const docTokenMaps: Map<string, number>[] = [];
  /** POS map: token → original POS tag. */
  const posMap = new Map<string, string>();

  let totalTokenCount = 0;

  for (const text of texts) {
    const tokens = tokenizer.tokenize(text);
    const docMap = new Map<string, number>();
    const docList: string[] = [];

    // Split into sentences on 。 and process each
    let sentBuf: string[] = [];

    for (const tok of tokens) {
      if (!ALLOWED_POS.has(tok.pos)) {
        // Sentence boundary on 。
        if (tok.surface_form === "。" && sentBuf.length > 0) {
          sentenceTokens.push([...sentBuf]);
          sentBuf = [];
        }
        continue;
      }

      // Exclude certain noun subcategories
      if (tok.pos === "名詞" && EXCLUDED_NOUN_DETAILS.has(tok.pos_detail_1)) {
        continue;
      }

      // Use basic_form if available (lemmatisation), else surface
      const form =
        tok.basic_form && tok.basic_form !== "*"
          ? tok.basic_form
          : tok.surface_form;

      if (form.length < 2 && tok.pos !== "名詞") continue; // skip single-char verbs/adj
      if (customStops.has(form)) continue;

      docList.push(form);
      docMap.set(form, (docMap.get(form) ?? 0) + 1);
      sentBuf.push(form);
      totalTokenCount++;

      if (!posMap.has(form)) {
        posMap.set(form, tok.pos);
      }
    }

    // Flush remaining sentence buffer
    if (sentBuf.length > 0) {
      sentenceTokens.push(sentBuf);
    }

    docTokens.push(docList);
    docTokenMaps.push(docMap);
  }

  // ── Step 2: Global frequency ──────────────────────────────────────────
  const globalFreq = new Map<string, number>();
  for (const docMap of docTokenMaps) {
    for (const [token, count] of docMap) {
      globalFreq.set(token, (globalFreq.get(token) ?? 0) + count);
    }
  }

  const uniqueTokens = globalFreq.size;

  // ── Step 3: TF-IDF ────────────────────────────────────────────────────
  const N = docTokenMaps.length; // number of documents
  /** Document frequency: in how many docs does token appear? */
  const df = new Map<string, number>();
  for (const docMap of docTokenMaps) {
    for (const token of docMap.keys()) {
      df.set(token, (df.get(token) ?? 0) + 1);
    }
  }

  /** Average TF-IDF per token across all documents. */
  const avgTfIdf = new Map<string, number>();

  for (const [token, docFreq] of df) {
    const idf = Math.log(N / (docFreq + 1)) + 1; // smoothed IDF
    let sumTfIdf = 0;
    let docsWith = 0;

    for (const [idx, docMap] of docTokenMaps.entries()) {
      const count = docMap.get(token);
      if (count === undefined) continue;
      const totalInDoc = docTokens[idx]!.length;
      const tf = totalInDoc > 0 ? count / totalInDoc : 0;
      sumTfIdf += tf * idf;
      docsWith++;
    }

    avgTfIdf.set(token, docsWith > 0 ? sumTfIdf / docsWith : 0);
  }

  // ── Step 4: Top words ─────────────────────────────────────────────────
  const sorted = [...globalFreq.entries()].sort((a, b) => b[1] - a[1]);
  const topWords = sorted.slice(0, 200).map(([token, frequency]) => ({
    token,
    frequency,
    tfidf: round(avgTfIdf.get(token) ?? 0, 4),
    pos: posMap.get(token) ?? "不明",
  }));

  // ── Step 5: Co-occurrence network ─────────────────────────────────────
  const cooccurrenceNetwork = buildCooccurrenceNetwork(sentenceTokens, 2);

  // ── Step 6: Interpretation ────────────────────────────────────────────
  const top5 = topWords.slice(0, 5).map((w) => w.token);
  const interpretation =
    `テキスト${N}件を形態素解析した結果、合計${totalTokenCount}トークン（` +
    `異なり語数${uniqueTokens}）が抽出されました。` +
    `頻出語は「${top5.join("」「")}」などです。` +
    (cooccurrenceNetwork.nodes.length > 0
      ? `共起ネットワーク（${cooccurrenceNetwork.nodes.length}ノード・` +
        `${cooccurrenceNetwork.edges.length}エッジ）を構築しました。` +
        `${cooccurrenceNetwork.communities.length}個のトピッククラスタが検出されました。`
      : "共起ネットワークの構築に十分な共起ペアがありませんでした。");

  return {
    variableId,
    totalTokens: totalTokenCount,
    uniqueTokens,
    topWords,
    cooccurrenceNetwork,
    interpretation,
  };
}

// ---------------------------------------------------------------------------
// Co-occurrence network builder
// ---------------------------------------------------------------------------

/**
 * Build an undirected weighted co-occurrence network from sentence-level
 * token lists.
 *
 * @param sentences       - Each element is an array of tokens from one sentence.
 * @param minCooccurrence - Minimum edge weight to retain (default 2).
 */
export function buildCooccurrenceNetwork(
  sentences: string[][],
  minCooccurrence: number,
): NetworkAnalysisResult {
  // Count co-occurrences
  const coocMap = new Map<string, number>();
  const nodeFreq = new Map<string, number>();

  for (const tokens of sentences) {
    const unique = [...new Set(tokens)];
    for (const t of unique) {
      nodeFreq.set(t, (nodeFreq.get(t) ?? 0) + 1);
    }
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        const key = [unique[i]!, unique[j]!].sort().join("\0");
        coocMap.set(key, (coocMap.get(key) ?? 0) + 1);
      }
    }
  }

  // Filter edges by minimum co-occurrence
  const filteredEdges: Array<{ source: string; target: string; weight: number }> = [];
  const activeNodes = new Set<string>();

  for (const [key, weight] of coocMap) {
    if (weight < minCooccurrence) continue;
    const [source, target] = key.split("\0") as [string, string];
    filteredEdges.push({ source, target, weight });
    activeNodes.add(source);
    activeNodes.add(target);
  }

  // Keep only top 100 nodes by frequency among active nodes
  const sortedActive = [...activeNodes]
    .map((id) => ({ id, freq: nodeFreq.get(id) ?? 0 }))
    .sort((a, b) => b.freq - a.freq)
    .slice(0, 100);

  const topNodeSet = new Set(sortedActive.map((n) => n.id));

  const nodes = sortedActive.map((n) => ({ id: n.id, label: n.id }));
  const edges = filteredEdges.filter(
    (e) => topNodeSet.has(e.source) && topNodeSet.has(e.target),
  );

  if (nodes.length === 0) {
    return {
      nodes: [],
      edges: [],
      communities: [],
      globalMetrics: { density: 0, avgDegree: 0, avgClustering: 0, modularity: 0 },
      interpretation: "共起ネットワークの構築に十分な共起ペアがありませんでした。",
    };
  }

  return analyzeNetwork(nodes, edges, false);
}

// ---------------------------------------------------------------------------
// Tiny helper
// ---------------------------------------------------------------------------

function round(v: number, dp: number): number {
  if (!Number.isFinite(v)) return v;
  const f = Math.pow(10, dp);
  return Math.round(v * f) / f;
}
