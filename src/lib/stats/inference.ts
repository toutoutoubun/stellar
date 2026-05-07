// ============================================================================
// src/lib/stats/inference.ts
// Stellar — Inferential statistics: t-tests, Mann-Whitney U, chi-square,
//           simple & multiple linear regression.
// Dependencies: simple-statistics (npm).  Zero cloud / AI calls.
// ============================================================================

import {
  mean,
  sampleVariance,
  linearRegression as ssLinearRegression,
  linearRegressionLine,
  sum,
} from "simple-statistics";

import { tDistributionPValue } from "./descriptive";
import type {
  TTestResult,
  MannWhitneyResult,
  ChiSquareResult,
  RegressionResult,
} from "./types";
import { useI18nStore } from "../../stores/useI18nStore";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function r(v: number, dp = 4): number {
  if (!Number.isFinite(v)) return v;
  const f = Math.pow(10, dp);
  return Math.round(v * f) / f;
}

/** Cohen's d effect-size label (Japanese). */
function cohensLabel(d: number): string {
  const abs = Math.abs(d);
  if (abs < 0.2) return useI18nStore.getState().t.stats.str_l2qy0e;
  if (abs < 0.5) return useI18nStore.getState().t.stats.k_i6n;
  if (abs < 0.8) return useI18nStore.getState().t.stats.k_ffx;
  return useI18nStore.getState().t.stats.k_hlz;
}

/** Cramér's V effect-size label (Japanese). */
function cramersLabel(v: number): string {
  if (v < 0.1) return useI18nStore.getState().t.stats.str_6bgvuj;
  if (v < 0.3) return useI18nStore.getState().t.stats.str_b70maj;
  if (v < 0.5) return useI18nStore.getState().t.stats.str_bow3c;
  return useI18nStore.getState().t.stats.str_ggkt;
}

/**
 * Critical t value for two-tailed α = 0.05 via Newton–Raphson inversion of
 * the t-CDF.  Used for 95 % confidence intervals.
 */
function tCritical005(df: number): number {
  // Start with a good initial guess from normal approx
  let t = 1.96;
  if (df < 30) {
    // Rough approximation for small df
    t = 1.96 + 3.0 / df;
  }
  // Newton iterations (bisect-style: find t such that P(|T|>t) = 0.05)
  for (let i = 0; i < 60; i++) {
    const p = tDistributionPValue(t, df);
    const err = p - 0.05;
    if (Math.abs(err) < 1e-9) break;
    // numerical derivative
    const dp = (tDistributionPValue(t + 1e-6, df) - p) / 1e-6;
    if (dp === 0) break;
    t -= err / dp;
    if (t < 0) t = 0.01;
  }
  return t;
}

// ---------------------------------------------------------------------------
// Chi-square CDF via regularised lower incomplete gamma function
// ---------------------------------------------------------------------------

/** ln Γ(x) — Lanczos approximation. */
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

/**
 * Regularised lower incomplete gamma function P(a, x) = γ(a,x) / Γ(a).
 * Uses series expansion for x < a+1, continued fraction otherwise.
 */
function regularisedGammaP(a: number, x: number): number {
  if (x < 0 || a <= 0) return NaN;
  if (x === 0) return 0;
  if (x < a + 1) {
    // Series representation
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let n = 0; n < 200; n++) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-14) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - lnGamma(a));
  }
  // Continued fraction (Lentz)
  let b = x + 1 - a;
  let c = 1e30;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= 200; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = b + an / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-14) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h;
}

/** Upper-tail p-value for the χ² distribution. */
function chi2Pvalue(chi2: number, df: number): number {
  if (df <= 0 || chi2 < 0) return NaN;
  return 1 - regularisedGammaP(df / 2, chi2 / 2);
}

/** Upper-tail p-value for the F distribution. */
function fPvalue(f: number, df1: number, df2: number): number {
  if (f <= 0) return 1;
  const x = df2 / (df2 + df1 * f);
  return regularisedIncompleteBeta(x, df2 / 2, df1 / 2);
}

/** Regularised incomplete beta  I_x(a,b) — same algorithm as descriptive.ts. */
function regularisedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lnBeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta);
  if (x < (a + 1) / (a + b + 2)) {
    return (front * betaCf(x, a, b)) / a;
  }
  return 1 - (front * betaCf(1 - x, b, a)) / b;
}

function betaCf(x: number, a: number, b: number): number {
  const maxIter = 200;
  const eps = 1e-14;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < eps) d = eps;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= maxIter; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < eps) d = eps;
    c = 1 + aa / c;
    if (Math.abs(c) < eps) c = eps;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
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

/** Standard normal CDF  Φ(z). */
function normalCdf(z: number): number {
  // Abramowitz & Stegun 26.2.17 approximation
  if (z < -8) return 0;
  if (z > 8) return 1;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + p * x);
  const erf = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}

// ---------------------------------------------------------------------------
// Minimal matrix algebra for multiple regression
// ---------------------------------------------------------------------------

type Mat = number[][];

function matCreate(rows: number, cols: number): Mat {
  return Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
}

function matTranspose(A: Mat): Mat {
  const rows = A.length;
  const cols = A[0]!.length;
  const T = matCreate(cols, rows);
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) T[j]![i] = A[i]![j]!;
  return T;
}

function matMul(A: Mat, B: Mat): Mat {
  const aRows = A.length;
  const aCols = A[0]!.length;
  const bCols = B[0]!.length;
  const C = matCreate(aRows, bCols);
  for (let i = 0; i < aRows; i++)
    for (let j = 0; j < bCols; j++) {
      let s = 0;
      for (let k = 0; k < aCols; k++) s += A[i]![k]! * B[k]![j]!;
      C[i]![j] = s;
    }
  return C;
}

/** Matrix inverse via Gauss-Jordan elimination. Returns null if singular. */
function matInverse(A: Mat): Mat | null {
  const n = A.length;
  // Augment [A | I]
  const aug: Mat = A.map((row, i) => {
    const ext = new Array<number>(n).fill(0);
    ext[i] = 1;
    return [...row, ...ext];
  });

  for (let col = 0; col < n; col++) {
    // Partial pivot
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row]![col]!) > Math.abs(aug[maxRow]![col]!)) {
        maxRow = row;
      }
    }
    [aug[col], aug[maxRow]] = [aug[maxRow]!, aug[col]!];

    const pivot = aug[col]![col]!;
    if (Math.abs(pivot) < 1e-12) return null; // singular

    // Scale pivot row
    for (let j = 0; j < 2 * n; j++) aug[col]![j]! /= pivot;

    // Eliminate column
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row]![col]!;
      for (let j = 0; j < 2 * n; j++) {
        aug[row]![j] = aug[row]![j]! - factor * aug[col]![j]!;
      }
    }
  }

  // Extract inverse
  return aug.map((row) => row.slice(n));
}

// ---------------------------------------------------------------------------
// Independent-samples (Welch's) t-test
// ---------------------------------------------------------------------------

export function independentTTest(
  group1: number[],
  group2: number[],
  group1Label: string,
  group2Label: string,
  targetVarName: string,
): TTestResult {
  const n1 = group1.length;
  const n2 = group2.length;
  const m1 = mean(group1);
  const m2 = mean(group2);
  const v1 = sampleVariance(group1);
  const v2 = sampleVariance(group2);
  const se = Math.sqrt(v1 / n1 + v2 / n2);

  const t = se > 0 ? (m1 - m2) / se : 0;

  // Welch–Satterthwaite degrees of freedom
  const num = (v1 / n1 + v2 / n2) ** 2;
  const den =
    (v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1);
  const df = den > 0 ? num / den : n1 + n2 - 2;

  const pValue = r(tDistributionPValue(t, df), 6);
  const significant = pValue < 0.05;

  // Cohen's d  (pooled SD)
  const pooledSD = Math.sqrt(
    ((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2),
  );
  const d = pooledSD > 0 ? (m1 - m2) / pooledSD : 0;
  const label = cohensLabel(d);

  // 95 % CI
  const tCrit = tCritical005(df);
  const ci95Lower = r((m1 - m2) - tCrit * se);
  const ci95Upper = r((m1 - m2) + tCrit * se);

  // Japanese interpretation

  const parts: string[] = [
    useI18nStore.getState().t.stats.k_wc4pvp,
    `効果量 Cohen's d=${r(d)}（${label}）。`,
    useI18nStore.getState().t.stats.k_1iwabe,
  ];

  if (n1 < 30 || n2 < 30) {
    parts.push(
      useI18nStore.getState().t.stats.k_r5jrsp,
    );
  }

  return {
    testType: "independent",
    groupVar: `${group1Label} vs ${group2Label}`,
    targetVar: targetVarName,
    t: r(t),
    df: r(df, 1),
    pValue,
    effectSize: r(d),
    effectSizeLabel: label,
    mean1: r(m1),
    mean2: r(m2),
    ci95Lower,
    ci95Upper,
    significant,
    interpretation: parts.join(""),
  };
}

// ---------------------------------------------------------------------------
// Mann-Whitney U test
// ---------------------------------------------------------------------------

export function mannWhitneyU(
  group1: number[],
  group2: number[],
  group1Label: string,
  group2Label: string,
  targetVarName: string,
): MannWhitneyResult {
  const n1 = group1.length;
  const n2 = group2.length;
  const N = n1 + n2;

  // Combine, rank, then sum ranks for group 1
  const combined = [
    ...group1.map((v) => ({ v, g: 1 as const })),
    ...group2.map((v) => ({ v, g: 2 as const })),
  ];
  combined.sort((a, b) => a.v - b.v);

  // Assign average ranks (handle ties)
  const ranks = new Array<number>(N);
  let i = 0;
  while (i < N) {
    let j = i;
    while (j < N - 1 && combined[j + 1]!.v === combined[j]!.v) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[k] = avgRank;
    i = j + 1;
  }

  let R1 = 0;
  for (let idx = 0; idx < N; idx++) {
    if (combined[idx]!.g === 1) R1 += ranks[idx]!;
  }

  const U1 = n1 * n2 + (n1 * (n1 + 1)) / 2 - R1;
  const U2 = n1 * n2 - U1;
  const U = Math.min(U1, U2);

  // Normal approximation (with continuity correction)
  const muU = (n1 * n2) / 2;
  const sigmaU = Math.sqrt((n1 * n2 * (N + 1)) / 12);
  const z = sigmaU > 0 ? (Math.abs(U1 - muU) - 0.5) / sigmaU : 0;
  const pValue = r(2 * (1 - normalCdf(Math.abs(z))), 6);
  const significant = pValue < 0.05;

  // Effect size r = Z / sqrt(N)
  const effectR = r(Math.abs(z) / Math.sqrt(N));

  const _sigText = significant
    ? useI18nStore.getState().t.stats.str_t61a6j
    : useI18nStore.getState().t.stats.str_wubo15;

  const interpretation =
    useI18nStore.getState().t.stats.k_3mqqt4 +
    useI18nStore.getState().t.stats.k_yqrrij +
    `${_sigText}（U=${r(U)}, p=${pValue}）。` +
    useI18nStore.getState().t.stats.k_2781yo;

  return {
    targetVar: targetVarName,
    groupVar: `${group1Label} vs ${group2Label}`,
    U: r(U),
    pValue,
    effectSizeR: effectR,
    significant,
    interpretation,
  };
}

// ---------------------------------------------------------------------------
// Chi-square test of independence
// ---------------------------------------------------------------------------

export function chiSquareTest(
  table: number[][],
  rowLabels: string[],
  colLabels: string[],
  var1Id: string,
  var2Id: string,
): ChiSquareResult {
  const nRows = table.length;
  const nCols = table[0]!.length;

  // Row totals, column totals, grand total
  const rowTotals = table.map((row) => row.reduce((s, v) => s + v, 0));
  const colTotals = new Array<number>(nCols).fill(0);
  for (let j = 0; j < nCols; j++) {
    for (let i = 0; i < nRows; i++) colTotals[j]! += table[i]![j]!;
  }
  const grandTotal = rowTotals.reduce((s, v) => s + v, 0);

  // Expected frequencies & chi2
  let chi2 = 0;
  let lowExpected = false;
  const contingencyTable: Array<Array<{ observed: number; expected: number }>> = [];

  for (let i = 0; i < nRows; i++) {
    const row: Array<{ observed: number; expected: number }> = [];
    for (let j = 0; j < nCols; j++) {
      const observed = table[i]![j]!;
      const expected = (rowTotals[i]! * colTotals[j]!) / grandTotal;
      if (expected < 5) lowExpected = true;
      chi2 += expected > 0 ? (observed - expected) ** 2 / expected : 0;
      row.push({ observed, expected: r(expected) });
    }
    contingencyTable.push(row);
  }

  const df = (nRows - 1) * (nCols - 1);
  const pValue = r(chi2Pvalue(chi2, df), 6);
  const significant = pValue < 0.05;

  // Cramér's V
  const k = Math.min(nRows, nCols);
  const cramersV = k > 1 ? r(Math.sqrt(chi2 / (grandTotal * (k - 1)))) : 0;
  const esLabel = cramersLabel(cramersV);

  const parts: string[] = [
    useI18nStore.getState().t.stats.k_cl209p,
    significant
      ? useI18nStore.getState().t.stats.k_u3uf7v
      : useI18nStore.getState().t.stats.k_1724gz,
    `Cramér's V=${cramersV}（効果量：${esLabel}）。`,
  ];

  if (lowExpected) {
    parts.push(
      useI18nStore.getState().t.stats.str_5Fisher,
    );
  }

  return {
    var1Id,
    var2Id,
    chi2: r(chi2),
    df,
    pValue,
    cramersV,
    effectSizeLabel: esLabel,
    significant,
    contingencyTable,
    rowLabels,
    colLabels,
    interpretation: parts.join(""),
  };
}

// ---------------------------------------------------------------------------
// Linear / multiple regression (OLS via normal equations)
// ---------------------------------------------------------------------------

export function linearRegression(
  x: number[][],
  y: number[],
  independentVarNames: string[],
  dependentVarName: string,
): RegressionResult {
  const n = y.length;
  const p = x[0]?.length ?? 0; // number of predictors
  const isSimple = p === 1;

  // --- Simple regression shortcut via simple-statistics -----------------
  if (isSimple) {
    const xFlat = x.map((row) => row[0]!);
    const pairs: Array<[number, number]> = xFlat.map((xi, i) => [xi, y[i]!]);
    const reg = ssLinearRegression(pairs);
    const line = linearRegressionLine(reg);

    const yHat = xFlat.map((xi) => line(xi));
    const yMean = mean(y);
    const ssTot = sum(y.map((yi) => (yi - yMean) ** 2));
    const ssRes = sum(y.map((yi, i) => (yi - yHat[i]!) ** 2));
    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
    const adjR2 = n > 2 ? 1 - ((1 - r2) * (n - 1)) / (n - 2) : r2;
    const rmse = Math.sqrt(ssRes / (n - 2));

    // F = (ssTot - ssRes) / 1 / (ssRes / (n-2))
    const msReg = ssTot - ssRes;
    const msErr = ssRes / (n - 2);
    const fStat = msErr > 0 ? msReg / msErr : 0;
    const fP = r(fPvalue(fStat, 1, n - 2), 6);

    // Coefficient SE, t, p
    const xVar = sampleVariance(xFlat);
    const sxx = xVar * (n - 1);
    const seB = sxx > 0 ? rmse / Math.sqrt(sxx) : 0;
    const tB = seB > 0 ? reg.m / seB : 0;
    const pB = r(tDistributionPValue(tB, n - 2), 6);

    const interpretation =
      useI18nStore.getState().t.stats.k_z0cdlq +
      `（F(1,${n - 2})=${r(fStat)}, p=${fP}）。` +
      useI18nStore.getState().t.stats.k_3wlga0;

    return {
      type: "simple",
      dependentVar: dependentVarName,
      independentVars: independentVarNames,
      intercept: r(reg.b),
      coefficients: [
        {
          varName: independentVarNames[0]!,
          b: r(reg.m),
          stdError: r(seB),
          t: r(tB),
          pValue: pB,
          significant: pB < 0.05,
        },
      ],
      r2: r(r2),
      adjustedR2: r(adjR2),
      fStatistic: r(fStat),
      fPValue: fP,
      rmse: r(rmse),
      interpretation,
    };
  }

  // --- Multiple regression via normal equations:  b = (X'X)^-1 X'y ------
  // Build design matrix with intercept column
  const X: Mat = x.map((row) => [1, ...row]);
  const pFull = p + 1; // includes intercept

  const Xt = matTranspose(X);
  const XtX = matMul(Xt, X);
  const XtXinv = matInverse(XtX);

  if (!XtXinv) {
    // Singular — return degenerate result
    return {
      type: "multiple",
      dependentVar: dependentVarName,
      independentVars: independentVarNames,
      intercept: NaN,
      coefficients: independentVarNames.map((name) => ({
        varName: name,
        b: NaN,
        stdError: NaN,
        t: NaN,
        pValue: NaN,
        significant: false,
      })),
      r2: NaN,
      adjustedR2: NaN,
      fStatistic: NaN,
      fPValue: NaN,
      rmse: NaN,
      interpretation:
        useI18nStore.getState().t.stats.str_q7nsoj,
    };
  }

  const yMat: Mat = y.map((v) => [v]);
  const XtY = matMul(Xt, yMat);
  const bMat = matMul(XtXinv, XtY);
  const bVec = bMat.map((row) => row[0]!);

  // Predictions & residuals
  const yMean = mean(y);
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    let yHat = 0;
    for (let j = 0; j < pFull; j++) yHat += X[i]![j]! * bVec[j]!;
    ssRes += (y[i]! - yHat) ** 2;
    ssTot += (y[i]! - yMean) ** 2;
  }

  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  const adjR2 = n > pFull ? 1 - ((1 - r2) * (n - 1)) / (n - pFull) : r2;
  const mse = n > pFull ? ssRes / (n - pFull) : 0;
  const rmse = Math.sqrt(mse);

  // F-statistic
  const msReg = p > 0 ? (ssTot - ssRes) / p : 0;
  const fStat = mse > 0 ? msReg / mse : 0;
  const fP = r(fPvalue(fStat, p, n - pFull), 6);

  // Per-coefficient SE, t, p (from diagonal of (X'X)^-1 * MSE)
  const coefficients = independentVarNames.map((name, idx) => {
    const j = idx + 1; // skip intercept column
    const se = Math.sqrt(Math.max(0, XtXinv[j]![j]! * mse));
    const tVal = se > 0 ? bVec[j]! / se : 0;
    const pVal = r(tDistributionPValue(tVal, n - pFull), 6);
    return {
      varName: name,
      b: r(bVec[j]!),
      stdError: r(se),
      t: r(tVal),
      pValue: pVal,
      significant: pVal < 0.05,
    };
  });

  const sigVars = coefficients
    .filter((c) => c.significant)
    .map((c) => c.varName);
  const sigVarsText =
    sigVars.length > 0
      ? `有意な予測変数は${sigVars.join(useI18nStore.getState().t.stats.k_9hd)}です。`
      : useI18nStore.getState().t.stats.str_3p7bnb;

  const interpretation =
    useI18nStore.getState().t.stats.k_uw6hot +
    `（F(${p},${n - pFull})=${r(fStat)}, p=${fP}）。` +
    useI18nStore.getState().t.stats.k_3wlga0 +
    sigVarsText;

  return {
    type: "multiple",
    dependentVar: dependentVarName,
    independentVars: independentVarNames,
    intercept: r(bVec[0]!),
    coefficients,
    r2: r(r2),
    adjustedR2: r(adjR2),
    fStatistic: r(fStat),
    fPValue: fP,
    rmse: r(rmse),
    interpretation,
  };
}
