// ============================================================================
import { useI18nStore } from "../../stores/useI18nStore";
// src/lib/stats/index.ts
// Stellar — Public barrel file for the statistical computation layer.
// Re-exports every type and function; provides convenience warnings helper.
// ============================================================================

// ── Type re-exports ─────────────────────────────────────────────────────────
export type {
  DescriptiveResult,
  FrequencyTable,
  CorrelationResult,
  TTestResult,
  MannWhitneyResult,
  ChiSquareResult,
  RegressionResult,
  NetworkAnalysisResult,
  TextAnalysisResult,
} from "./types";

// ── Descriptive statistics ──────────────────────────────────────────────────
export {
  computeDescriptive,
  computeFrequencyTable,
  buildCorrelationMatrix,
  tDistributionPValue,
} from "./descriptive";

// ── Inferential statistics ──────────────────────────────────────────────────
export {
  independentTTest,
  mannWhitneyU,
  chiSquareTest,
  linearRegression,
} from "./inference";

// ── Text analysis ───────────────────────────────────────────────────────────
export {
  analyzeTextVariable,
  buildCooccurrenceNetwork,
} from "./textAnalysis";

// ── Network analysis ────────────────────────────────────────────────────────
export { analyzeNetwork } from "./networkAnalysis";

// ── Convenience: interpretation warnings ────────────────────────────────────

/**
 * Return a Japanese-language warning string if the given test type
 * and sample size combination warrants a caveat, or `null` otherwise.
 *
 * @param testType    - One of `"t-test"`, `"chi-square"`, `"regression"`.
 * @param n           - Total sample size.
 * @param predictors  - Number of predictor variables (only relevant for regression).
 */
export function getInterpretationWarning(
  testType: string,
  n: number,
  predictors?: number,
): string | null {
  switch (testType) {
    case "t-test":
      if (n < 30) {
        return useI18nStore.getState().t.stats.k_qp8r7v;
      }
      return null;

    case "chi-square":
      // Low expected-frequency warning is handled inside chiSquareTest itself.
      return null;

    case "regression": {
      const p = predictors ?? 1;
      if (n < 10 * p) {
        return useI18nStore.getState().t.stats.k_o9muiv;
      }
      return null;
    }

    default:
      return null;
  }
}
