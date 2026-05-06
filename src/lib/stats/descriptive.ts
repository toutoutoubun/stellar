// ============================================================================
// src/lib/stats/descriptive.ts
// Stellar — Descriptive statistics, frequency tables, correlation matrices.
// Dependencies: simple-statistics (npm).  Zero cloud / AI calls.
// ============================================================================

import {
  mean,
  median,
  mode,
  sampleStandardDeviation,
  sampleVariance,
  min,
  max,
  quantile,
  sampleSkewness,
  sampleKurtosis,
  sampleCorrelation,
} from "simple-statistics";

import type {
  DescriptiveResult,
  FrequencyTable,
  CorrelationResult,
} from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Round to fixed decimal places (avoids floating-point display noise). */
function r(v: number, dp = 4): number {
  if (!Number.isFinite(v)) return v;
  const f = Math.pow(10, dp);
  return Math.round(v * f) / f;
}

/**
 * Two-tailed p-value for Student's t-distribution via the regularised
 * incomplete beta function (Abramowitz & Stegun §26.5.8 / §26.2.18).
 *
 * Accurate to ~4–5 significant figures for df ≥ 1.
 */
export function tDistributionPValue(t: number, df: number): number {
  if (df <= 0) return NaN;
  const x = df / (df + t * t);
  // I_x(a, b) where a = df/2, b = 0.5
  const p = regularisedIncompleteBeta(x, df / 2, 0.5);
  return Math.min(1, Math.max(0, p));
}

/**
 * Regularised incomplete beta function  I_x(a,b)  via the continued-fraction
 * expansion (Lentz's algorithm).  Falls back to the series expansion when
 * x < (a+1)/(a+b+2) for better convergence.
 */
function regularisedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  const lnBeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
  const front = Math.exp(
    Math.log(x) * a + Math.log(1 - x) * b - lnBeta
  );

  // Use the identity I_x(a,b) = 1 - I_{1-x}(b,a) when appropriate
  if (x < (a + 1) / (a + b + 2)) {
    return front * betaCf(x, a, b) / a;
  }
  return 1 - front * betaCf(1 - x, b, a) / b;
}

/** Continued fraction for the incomplete beta function (Lentz). */
function betaCf(x: number, a: number, b: number): number {
  const maxIter = 200;
  const eps = 1e-14;
  let qab = a + b;
  let qap = a + 1;
  let qam = a - 1;
  let c = 1;
  let d = 1 - qab * x / qap;
  if (Math.abs(d) < eps) d = eps;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= maxIter; m++) {
    const m2 = 2 * m;
    // even step
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < eps) d = eps;
    c = 1 + aa / c;
    if (Math.abs(c) < eps) c = eps;
    d = 1 / d;
    h *= d * c;
    // odd step
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < eps) d = eps;
    c = 1 + aa / c;
    if (Math.abs(c) < eps) c = eps;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < eps) break;
  }
  return h;
}

/** Lanczos approximation of ln Γ(x). */
function lnGamma(x: number): number {
  const cof = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) {
    y += 1;
    ser += cof[j]! / y;
  }
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

// ---------------------------------------------------------------------------
// Rank transform (for Spearman)
// ---------------------------------------------------------------------------

/** Return fractional ranks (average ranks for ties). */
function rankTransform(arr: number[]): number[] {
  const n = arr.length;
  const indexed = arr.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);

  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    // collect ties
    while (j < n - 1 && indexed[j + 1]!.v === indexed[j]!.v) j++;
    const avgRank = (i + j) / 2 + 1; // 1-based
    for (let k = i; k <= j; k++) {
      ranks[indexed[k]!.i] = avgRank;
    }
    i = j + 1;
  }
  return ranks;
}

// ---------------------------------------------------------------------------
// Descriptive statistics
// ---------------------------------------------------------------------------

/**
 * Compute comprehensive descriptive statistics for a numeric variable.
 *
 * @param values   - Clean (no NaN/null) number array.
 * @param variableId   - Unique id of the variable.
 * @param variableName - Human-readable label.
 * @param allValues    - Original array (may include null/undefined/NaN) used
 *                       to compute missingCount.
 */
export function computeDescriptive(
  values: number[],
  variableId: string,
  variableName: string,
  allValues: (number | null | undefined)[],
): DescriptiveResult {
  const n = values.length;
  const missingCount = allValues.length - n;

  if (n === 0) {
    return {
      variableId,
      variableName,
      n: 0,
      mean: NaN,
      median: NaN,
      mode: [],
      sd: NaN,
      variance: NaN,
      cv: NaN,
      min: NaN,
      max: NaN,
      range: NaN,
      q1: NaN,
      q3: NaN,
      iqr: NaN,
      skewness: NaN,
      kurtosis: NaN,
      missingCount,
      interpretation: `${variableName}：有効なデータがありません（欠損${missingCount}件）。`,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);

  const _mean = r(mean(sorted));
  const _median = r(median(sorted));
  const _mode = mode(sorted);
  const _sd = n > 1 ? r(sampleStandardDeviation(sorted)) : 0;
  const _var = n > 1 ? r(sampleVariance(sorted)) : 0;
  const _min = min(sorted);
  const _max = max(sorted);
  const _range = r(_max - _min);
  const _q1 = r(quantile(sorted, 0.25));
  const _q3 = r(quantile(sorted, 0.75));
  const _iqr = r(_q3 - _q1);
  const _cv = _mean !== 0 ? r((_sd / Math.abs(_mean)) * 100) : NaN;
  const _skew = n > 2 ? r(sampleSkewness(sorted)) : NaN;
  const _kurt = n > 3 ? r(sampleKurtosis(sorted)) : NaN;

  // Build Japanese interpretation
  const parts: string[] = [];
  parts.push(
    `n=${n}件（欠損${missingCount}件）。平均${_mean}（SD=${_sd}）、中央値${_median}。`,
  );
  if (Number.isFinite(_skew) && Math.abs(_skew) > 1) {
    parts.push(
      "分布が大きく歪んでいるため、中央値の使用を推奨します。",
    );
  }
  if (Number.isFinite(_cv) && _cv > 30) {
    parts.push(
      `変動係数が高く（${_cv}%）、データのばらつきが大きいです。`,
    );
  }

  return {
    variableId,
    variableName,
    n,
    mean: _mean,
    median: _median,
    mode: Array.isArray(_mode) ? _mode : [_mode],
    sd: _sd,
    variance: _var,
    cv: Number.isFinite(_cv) ? _cv : NaN,
    min: _min,
    max: _max,
    range: _range,
    q1: _q1,
    q3: _q3,
    iqr: _iqr,
    skewness: _skew,
    kurtosis: _kurt,
    missingCount,
    interpretation: parts.join(""),
  };
}

// ---------------------------------------------------------------------------
// Frequency table
// ---------------------------------------------------------------------------

/**
 * Build a frequency distribution table for categorical (string) data.
 * Rows are sorted descending by count.
 */
export function computeFrequencyTable(
  values: string[],
  variableId: string,
  variableName: string,
): FrequencyTable {
  const counts = new Map<string, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }

  const total = values.length;
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  let cumPercent = 0;
  const rows = sorted.map(([value, count]) => {
    const percent = r((count / total) * 100, 2);
    cumPercent = r(cumPercent + percent, 2);
    return { value, count, percent, cumPercent };
  });

  return { variableId, variableName, rows };
}

// ---------------------------------------------------------------------------
// Correlation matrix
// ---------------------------------------------------------------------------

/** Strength label for |r|. */
function corrStrengthLabel(absR: number): string {
  if (absR >= 0.7) return "強い";
  if (absR >= 0.4) return "中程度の";
  if (absR >= 0.2) return "弱い";
  return "ほぼない";
}

/**
 * Build a full pairwise correlation matrix from a dict of numeric arrays.
 *
 * @param data   - Maps variable name → number[].  All arrays must be the same
 *                 length (paired observations; pre-filtered for missing).
 * @param method - `"pearson"` or `"spearman"`.
 */
export function buildCorrelationMatrix(
  data: Record<string, number[]>,
  method: "pearson" | "spearman",
): CorrelationResult[] {
  const keys = Object.keys(data);
  const results: CorrelationResult[] = [];

  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const nameA = keys[i]!;
      const nameB = keys[j]!;
      let a = data[nameA]!;
      let b = data[nameB]!;
      const n = Math.min(a.length, b.length);

      if (n < 3) continue; // need at least 3 observations

      a = a.slice(0, n);
      b = b.slice(0, n);

      if (method === "spearman") {
        a = rankTransform(a);
        b = rankTransform(b);
      }

      const rVal = r(sampleCorrelation(a, b));

      // t = r * sqrt((n-2)/(1 - r²))
      const r2 = rVal * rVal;
      const tStat = r2 < 1 ? rVal * Math.sqrt((n - 2) / (1 - r2)) : Infinity;
      const df = n - 2;
      const pVal = r(tDistributionPValue(tStat, df), 6);

      const direction = rVal >= 0 ? "正" : "負";
      const strength = corrStrengthLabel(Math.abs(rVal));

      const interp =
        `${nameA}と${nameB}の間に${strength}${direction}の相関（${method === "spearman" ? "Spearman" : "Pearson"} r=${rVal}, p=${pVal}）` +
        (pVal < 0.05
          ? "が認められました。"
          : "が見られましたが、統計的に有意ではありませんでした。");

      results.push({
        var1Id: nameA,
        var2Id: nameB,
        var1Name: nameA,
        var2Name: nameB,
        method,
        r: rVal,
        pValue: pVal,
        n,
        interpretation: interp,
      });
    }
  }

  return results;
}
