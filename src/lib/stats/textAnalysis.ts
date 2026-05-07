// ============================================================================
// src/lib/stats/textAnalysis.ts
// Stellar — Japanese text mining: tokenisation (kuromoji), TF-IDF,
//           co-occurrence network construction.
// Dependencies: kuromoji (npm), graphology ecosystem.
// ============================================================================

import type { TextAnalysisResult, NetworkAnalysisResult } from "./types";
import { analyzeNetwork } from "./networkAnalysis";
import { useI18nStore } from "../../stores/useI18nStore";

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
  useI18nStore.getState().t.stats.k_9ke, useI18nStore.getState().t.stats.k_9kb, useI18nStore.getState().t.stats.k_9kf, useI18nStore.getState().t.stats.k_9le, useI18nStore.getState().t.stats.k_9jz, useI18nStore.getState().t.stats.k_9jg, useI18nStore.getState().t.stats.k_9k7, useI18nStore.getState().t.stats.k_9k6, useI18nStore.getState().t.stats.k_9k8, useI18nStore.getState().t.stats.k_9jr, useI18nStore.getState().t.stats.k_9l8, useI18nStore.getState().t.stats.k_9jp,
  useI18nStore.getState().t.stats.str_8h3d, useI18nStore.getState().t.stats.str_8h53, useI18nStore.getState().t.stats.k_9ky, useI18nStore.getState().t.stats.str_8hn6, useI18nStore.getState().t.quantitative.k_8hb2, useI18nStore.getState().t.stats.k_9ka, useI18nStore.getState().t.stats.str_8hh1, useI18nStore.getState().t.stats.str_7bqdz, useI18nStore.getState().t.stats.k_9j8, useI18nStore.getState().t.stats.k_9l0,
  useI18nStore.getState().t.stats.str_8iv3, useI18nStore.getState().t.stats.str_8i0v, useI18nStore.getState().t.stats.str_8i0p, useI18nStore.getState().t.stats.str_8hzu, useI18nStore.getState().t.stats.str_8hh7, useI18nStore.getState().t.stats.str_8hs2, useI18nStore.getState().t.stats.str_8hpt, useI18nStore.getState().t.stats.str_8h29, useI18nStore.getState().t.stats.str_8ipq,
  useI18nStore.getState().t.stats.str_8iht, useI18nStore.getState().t.stats.str_8ilo, useI18nStore.getState().t.stats.str_7bpwq, useI18nStore.getState().t.stats.str_8h3c, useI18nStore.getState().t.stats.str_8ii1, useI18nStore.getState().t.stats.str_8isj, useI18nStore.getState().t.stats.str_8i1t, useI18nStore.getState().t.stats.k_9ko, useI18nStore.getState().t.stats.k_9jf,
  useI18nStore.getState().t.stats.k_9k0, useI18nStore.getState().t.stats.str_8hi1, useI18nStore.getState().t.stats.str_6b6wtc, useI18nStore.getState().t.stats.str_7btt9, useI18nStore.getState().t.stats.str_8ha8, useI18nStore.getState().t.stats.str_8irm, useI18nStore.getState().t.stats.str_7btta, useI18nStore.getState().t.stats.k_9ju, useI18nStore.getState().t.stats.str_8i1s,
  useI18nStore.getState().t.stats.str_7cg5k, useI18nStore.getState().t.stats.str_6b5m3l, useI18nStore.getState().t.stats.k_9kg, useI18nStore.getState().t.stats.str_7brky, useI18nStore.getState().t.stats.str_8i05, useI18nStore.getState().t.stats.str_7bdhf, useI18nStore.getState().t.stats.str_6b65dn,
  useI18nStore.getState().t.stats.k_9jv, useI18nStore.getState().t.stats.str_8hs3, useI18nStore.getState().t.stats.str_8hqn, useI18nStore.getState().t.stats.str_8ifi, useI18nStore.getState().t.stats.str_8hyd, useI18nStore.getState().t.stats.str_8irn, useI18nStore.getState().t.stats.str_7bi8c, useI18nStore.getState().t.stats.str_7bqbm,
  // Common verbs in base forms that are too generic
  useI18nStore.getState().t.stats.str_7bpfp, useI18nStore.getState().t.stats.str_8i1t, useI18nStore.getState().t.stats.str_8h3d, useI18nStore.getState().t.stats.str_8h36, useI18nStore.getState().t.stats.str_ng56, useI18nStore.getState().t.stats.str_gm2x, useI18nStore.getState().t.stats.str_nnts, useI18nStore.getState().t.stats.str_nqkm,
  // Symbols & numbers that slip through
  useI18nStore.getState().t.stats.k_9hd, useI18nStore.getState().t.stats.k_9he, useI18nStore.getState().t.stats.k_9ob, useI18nStore.getState().t.stats.k_9ho, useI18nStore.getState().t.stats.k_9hp, useI18nStore.getState().t.stats.k_1edk, useI18nStore.getState().t.stats.k_1edl, useI18nStore.getState().t.stats.k_9hq, useI18nStore.getState().t.stats.k_9hr,
  "-", useI18nStore.getState().t.stats.k_9oc, useI18nStore.getState().t.stats.k_9i4, "…", "!", "?", " ", useI18nStore.getState().t.stats.k_9hc,
]);

/** POS tags we keep: nouns (名詞), verbs (動詞), adjectives (形容詞). */
const ALLOWED_POS = new Set([useI18nStore.getState().t.quantResults.str_f20h, useI18nStore.getState().t.quantResults.str_eujt, useI18nStore.getState().t.stats.str_efb8n]);

/** Noun sub-categories to exclude (too grammatical). */
const EXCLUDED_NOUN_DETAILS = new Set([
  useI18nStore.getState().t.stats.str_msxdr, useI18nStore.getState().t.stats.str_bz0us, useI18nStore.getState().t.stats.k_k1c, useI18nStore.getState().t.stats.str_hge1, useI18nStore.getState().t.stats.str_k27l,
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
        if (tok.surface_form === useI18nStore.getState().t.stats.k_9he && sentBuf.length > 0) {
          sentenceTokens.push([...sentBuf]);
          sentBuf = [];
        }
        continue;
      }

      // Exclude certain noun subcategories
      if (tok.pos === useI18nStore.getState().t.quantResults.str_f20h && EXCLUDED_NOUN_DETAILS.has(tok.pos_detail_1)) {
        continue;
      }

      // Use basic_form if available (lemmatisation), else surface
      const form =
        tok.basic_form && tok.basic_form !== "*"
          ? tok.basic_form
          : tok.surface_form;

      if (form.length < 2 && tok.pos !== useI18nStore.getState().t.quantResults.str_f20h) continue; // skip single-char verbs/adj
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
    pos: posMap.get(token) ?? useI18nStore.getState().t.stats.unknown,
  }));

  // ── Step 5: Co-occurrence network ─────────────────────────────────────
  const cooccurrenceNetwork = buildCooccurrenceNetwork(sentenceTokens, 2);

  // ── Step 6: Interpretation ────────────────────────────────────────────
  const top5 = topWords.slice(0, 5).map((w) => w.token);
  const interpretation =
    t.stats.k_n7ssx7 +
    t.stats.k_5um8a4 +
    `頻出語は「${top5.join(useI18nStore.getState().t.stats.str_8fq7)}」などです。` +
    (cooccurrenceNetwork.nodes.length > 0
      ? t.stats.k_8vfq2c +
        t.stats.k_cdvohy +
        t.stats.k_gusnfq
      : useI18nStore.getState().t.stats.str_4bxlt9);

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
      interpretation: useI18nStore.getState().t.stats.str_4bxlt9,
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
