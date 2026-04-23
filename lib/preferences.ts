import type {
  PreferenceVector,
  CategoryScore,
  LifePriority,
  PreferenceInference,
  WeightChange,
  PreferenceState,
} from './types'
import { DEFAULT_WEIGHTS } from './types'
import { getPreferenceState, savePreferenceState, updateWeights } from './storage'

// ─── Weight operations ────────────────────────────────────────────────────────

/** Normalise a weight vector so values sum to exactly 1.0 */
export function normaliseWeights(raw: PreferenceVector): PreferenceVector {
  const total = Object.values(raw).reduce((s, v) => s + v, 0)
  if (total === 0) return { ...DEFAULT_WEIGHTS }
  const result = {} as PreferenceVector
  for (const k of Object.keys(raw) as LifePriority[]) {
    result[k] = raw[k] / total
  }
  return result
}

/** Apply a validated inference to the stored preference state */
export function applyInference(inference: PreferenceInference): void {
  const state = getPreferenceState()

  // Mark accepted in history
  const history = state.inferenceHistory.map(i =>
    i.id === inference.id ? { ...i, accepted: true } : i,
  )

  savePreferenceState({
    ...state,
    weights: normaliseWeights(inference.weightsAfter),
    inferenceHistory: history,
  })
}

/** Reject an inference without applying weight changes */
export function dismissInference(inferenceId: string): void {
  const state = getPreferenceState()
  const history = state.inferenceHistory.map(i =>
    i.id === inferenceId ? { ...i, accepted: false } : i,
  )
  savePreferenceState({ ...state, inferenceHistory: history })
}

/** Record a new inference (from /api/learn) into state */
export function recordInference(inference: PreferenceInference): void {
  const state = getPreferenceState()
  savePreferenceState({
    ...state,
    inferenceHistory: [inference, ...state.inferenceHistory].slice(0, 50),
    lastInferenceAt: Date.now(),
  })
}

/** Get any pending (unreviewed) inference */
export function getPendingInference(): PreferenceInference | null {
  return getPreferenceState().inferenceHistory.find(i => i.accepted === null) ?? null
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Calculate a weighted overall score (0–100) from raw category scores.
 * rawScores: map of category → 0–100
 * weights: PreferenceVector (will be normalised)
 */
export function getWeightedScore(
  rawScores: Partial<Record<LifePriority, number>>,
  weights: PreferenceVector,
): number {
  const w = normaliseWeights(weights)
  let score = 0
  let totalWeight = 0

  for (const [category, raw] of Object.entries(rawScores) as [LifePriority, number][]) {
    const weight = w[category] ?? 0
    score += raw * weight
    totalWeight += weight
  }

  if (totalWeight === 0) return 0
  // scale to account for any missing categories
  return Math.round(score / totalWeight)
}

/**
 * Build CategoryScore[] with weighted contribution per category.
 * Suitable for the "Why this score?" breakdown.
 */
export function explainScore(
  rawScores: Partial<Record<LifePriority, number>>,
  weights: PreferenceVector,
  labels: Partial<Record<LifePriority, string>> = {},
): CategoryScore[] {
  const w = normaliseWeights(weights)

  const LABELS: Record<LifePriority, string> = {
    transport:    'Transport',
    safety:       'Safety & crime',
    amenities:    'Amenities',
    flood_risk:   'Flood risk',
    air_quality:  'Air quality',
    price_growth: 'Price growth',
    schools:      'Schools',
    green_space:  'Green space',
    deprivation:  'Deprivation',
    gp_health:    'GP & health',
    ...labels,
  }

  const SUMMARIES: Partial<Record<LifePriority, (score: number) => string>> = {
    transport:   s => s >= 80 ? 'Excellent connections nearby' : s >= 60 ? 'Reasonable transport links' : 'Limited transport options',
    safety:      s => s >= 80 ? 'Low crime in this area' : s >= 60 ? 'Moderate crime levels' : 'Elevated crime recorded',
    amenities:   s => s >= 80 ? 'Well-served for shops & services' : s >= 60 ? 'Good range of amenities' : 'Limited local amenities',
    flood_risk:  s => s >= 80 ? 'Very low flood risk' : s >= 60 ? 'Low to moderate flood risk' : 'Elevated flood risk — check carefully',
    air_quality: s => s >= 80 ? 'Clean air — low pollution' : s >= 60 ? 'Moderate air quality' : 'Poor air quality in this area',
    price_growth:s => s >= 80 ? 'Strong price growth locally' : s >= 60 ? 'Steady price growth' : 'Flat or declining prices',
    schools:     s => s >= 80 ? 'Good schools nearby' : s >= 60 ? 'Decent schooling options' : 'Schools may be a concern',
    green_space: s => s >= 80 ? 'Parks and green space close by' : s >= 60 ? 'Some green space available' : 'Limited green space nearby',
    deprivation: s => s >= 80 ? 'Low deprivation area' : s >= 60 ? 'Moderate deprivation' : 'Higher deprivation locally',
    gp_health:   s => s >= 80 ? 'GP surgeries well-rated nearby' : 'GP access may be limited',
  }

  return (Object.entries(rawScores) as [LifePriority, number][])
    .map(([category, rawScore]) => ({
      category,
      rawScore,
      weight: w[category] ?? 0,
      weightedContribution: Math.round(rawScore * (w[category] ?? 0)),
      label: LABELS[category],
      summary: SUMMARIES[category]?.(rawScore) ?? '',
    }))
    .sort((a, b) => b.weightedContribution - a.weightedContribution)
}

/**
 * Compute the diff between two weight vectors.
 * Used to show before/after in the PreferencePanel.
 */
export function diffWeights(before: PreferenceVector, after: PreferenceVector): WeightChange[] {
  return (Object.keys(before) as LifePriority[])
    .map(cat => ({
      category: cat,
      from: before[cat],
      to: after[cat],
      delta: after[cat] - before[cat],
    }))
    .filter(c => Math.abs(c.delta) > 0.001)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
}

/** Verdict label from score */
export function scoreVerdict(score: number): 'Strong match' | 'Good match' | 'Moderate match' | 'Poor match' {
  if (score >= 80) return 'Strong match'
  if (score >= 65) return 'Good match'
  if (score >= 50) return 'Moderate match'
  return 'Poor match'
}
