// ============================================================================
// src/lib/stats/types.ts
// Stellar — Statistical computation layer shared type definitions
// All interfaces consumed by descriptive, inference, text, and network modules.
// ============================================================================

/** Descriptive statistics for a single numeric variable. */
export interface DescriptiveResult {
  variableId: string;
  variableName: string;
  n: number;
  mean: number;
  median: number;
  mode: number[];
  sd: number;
  variance: number;
  /** Coefficient of variation (%) */
  cv: number;
  min: number;
  max: number;
  range: number;
  q1: number;
  q3: number;
  iqr: number;
  skewness: number;
  kurtosis: number;
  missingCount: number;
  /** Japanese plain-language summary */
  interpretation: string;
}

/** Frequency distribution table for a categorical variable. */
export interface FrequencyTable {
  variableId: string;
  variableName: string;
  rows: Array<{
    value: string;
    count: number;
    percent: number;
    cumPercent: number;
  }>;
}

/** Pairwise correlation result (Pearson or Spearman). */
export interface CorrelationResult {
  var1Id: string;
  var2Id: string;
  var1Name: string;
  var2Name: string;
  method: "pearson" | "spearman";
  r: number;
  pValue: number;
  n: number;
  interpretation: string;
}

/** Result of a one-sample, independent, or paired t-test. */
export interface TTestResult {
  testType: "one_sample" | "independent" | "paired";
  groupVar?: string;
  targetVar: string;
  t: number;
  df: number;
  pValue: number;
  /** Cohen's d */
  effectSize: number;
  /** "小" | "中" | "大" etc. */
  effectSizeLabel: string;
  mean1: number;
  mean2?: number;
  ci95Lower: number;
  ci95Upper: number;
  significant: boolean;
  interpretation: string;
}

/** Mann-Whitney U (Wilcoxon rank-sum) non-parametric test result. */
export interface MannWhitneyResult {
  targetVar: string;
  groupVar: string;
  U: number;
  pValue: number;
  effectSizeR: number;
  significant: boolean;
  interpretation: string;
}

/** Chi-square test of independence result. */
export interface ChiSquareResult {
  var1Id: string;
  var2Id: string;
  chi2: number;
  df: number;
  pValue: number;
  cramersV: number;
  effectSizeLabel: string;
  significant: boolean;
  contingencyTable: Array<Array<{ observed: number; expected: number }>>;
  rowLabels: string[];
  colLabels: string[];
  interpretation: string;
}

/** OLS linear / multiple regression result. */
export interface RegressionResult {
  type: "simple" | "multiple";
  dependentVar: string;
  independentVars: string[];
  intercept: number;
  coefficients: Array<{
    varName: string;
    b: number;
    stdError: number;
    t: number;
    pValue: number;
    significant: boolean;
  }>;
  r2: number;
  adjustedR2: number;
  fStatistic: number;
  fPValue: number;
  rmse: number;
  interpretation: string;
}

/** Network / graph analysis result (used for co-occurrence, citation, etc.). */
export interface NetworkAnalysisResult {
  nodes: Array<{
    id: string;
    label: string;
    degree: number;
    betweenness: number;
    closeness: number;
    community: number;
    size: number;
  }>;
  edges: Array<{
    source: string;
    target: string;
    weight: number;
  }>;
  communities: Array<{
    id: number;
    label: string;
    nodeCount: number;
    color: string;
  }>;
  globalMetrics: {
    density: number;
    avgDegree: number;
    avgClustering: number;
    modularity: number;
  };
  interpretation: string;
}

/** Text-mining result for a free-text variable. */
export interface TextAnalysisResult {
  variableId: string;
  totalTokens: number;
  uniqueTokens: number;
  topWords: Array<{
    token: string;
    frequency: number;
    tfidf: number;
    pos: string;
  }>;
  cooccurrenceNetwork: NetworkAnalysisResult;
  interpretation: string;
}
