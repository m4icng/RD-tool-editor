import { analyzeAdaptiveLevel, createTuningState, estimateDerivedGenerateParameters } from "./adaptive-parameters.js";
import { analyzeGenerateSource } from "./generate-source.js";
import { normalizeGenerateSettings } from "./generate-settings.js";

export const DIFFICULTY_LABELS = Object.freeze([
  { maxScore: 29, label: "Easy" },
  { maxScore: 49, label: "Normal" },
  { maxScore: 69, label: "Medium" },
  { maxScore: 84, label: "Medium Hard" },
  { maxScore: 100, label: "Hard" }
]);

export function labelForDifficultyScore(score) {
  const normalized = Number(score);
  if (!Number.isFinite(normalized)) return "Không thể đánh giá";
  const score100 = normalized <= 1 ? Math.round(normalized * 100) : Math.round(normalized);
  return DIFFICULTY_LABELS.find((entry) => score100 <= entry.maxScore)?.label ?? "Hard";
}

function scoreFromMetadata(state) {
  const values = [
    state?.generationMeta?.derivedParameters?.difficultyScore,
    state?.generateSettings?.autoDerivedParameters?.difficultyScore,
    state?.generateSettings?.difficultyScore
  ];
  return values.find((value) => Number.isFinite(Number(value)));
}

export function evaluateDifficulty(state, rawSettings = state?.generateSettings) {
  const source = analyzeGenerateSource(state);
  const analysis = analyzeAdaptiveLevel(state, source);
  const issues = source.issues ?? [];
  const errors = issues.filter((issue) => issue.severity === "error");
  if (errors.length > 0) {
    return {
      evaluable: false,
      score: null,
      score100: null,
      label: "Không thể đánh giá",
      source,
      analysis,
      issues
    };
  }

  const existingScore = scoreFromMetadata(state);
  const settings = normalizeGenerateSettings({ ...(rawSettings ?? {}), difficultyScore: existingScore ?? rawSettings?.difficultyScore });
  const derived = estimateDerivedGenerateParameters(source, analysis, settings, createTuningState());
  const score = Number(derived.derivedParameters?.difficultyScore ?? settings.difficultyScore);
  const score100 = Number.isFinite(score) ? Math.round(score * 100) : null;
  return {
    evaluable: Number.isFinite(score),
    score: Number.isFinite(score) ? score : null,
    score100,
    label: labelForDifficultyScore(score),
    source,
    analysis,
    issues
  };
}
