import { nanoid } from 'nanoid'
import type { InteractionEvent, InteractionType, LifePriority, PreferenceVector } from './types'
import { getPreferenceState, savePreferenceState, getWeights } from './storage'

const INFER_AFTER_N_EVENTS = 5   // trigger inference check after this many new events

function appendEvent(event: InteractionEvent): void {
  const state = getPreferenceState()
  state.interactionLog = [event, ...state.interactionLog].slice(0, 200) // keep last 200
  state.totalInteractions += 1
  savePreferenceState(state)
}

function makeEvent(
  type: InteractionType,
  reportId: string,
  postcode: string,
  overallScore: number,
  categoryScores: Partial<Record<LifePriority, number>>,
  extra: Partial<InteractionEvent> = {},
): InteractionEvent {
  return {
    id: nanoid(),
    type,
    reportId,
    postcode,
    overallScore,
    categoryScores,
    weightsAtTime: getWeights(),
    timestamp: Date.now(),
    ...extra,
  }
}

// ─── Public log functions ─────────────────────────────────────────────────────

export function logView(
  reportId: string,
  postcode: string,
  overallScore: number,
  categoryScores: Partial<Record<LifePriority, number>>,
): void {
  appendEvent(makeEvent('view', reportId, postcode, overallScore, categoryScores))
}

export function logSave(
  reportId: string,
  postcode: string,
  overallScore: number,
  categoryScores: Partial<Record<LifePriority, number>>,
): void {
  appendEvent(
    makeEvent('save', reportId, postcode, overallScore, categoryScores, {
      signal: 'positive',
    }),
  )
}

export function logDismiss(
  reportId: string,
  postcode: string,
  overallScore: number,
  categoryScores: Partial<Record<LifePriority, number>>,
): void {
  appendEvent(
    makeEvent('dismiss', reportId, postcode, overallScore, categoryScores, {
      signal: 'negative',
    }),
  )
}

export function logLayerToggle(
  reportId: string,
  postcode: string,
  overallScore: number,
  categoryScores: Partial<Record<LifePriority, number>>,
  layerName: string,
): void {
  appendEvent(
    makeEvent('layer_toggle', reportId, postcode, overallScore, categoryScores, {
      layerName,
    }),
  )
}

export function logCompare(
  reportId: string,
  postcode: string,
  overallScore: number,
  categoryScores: Partial<Record<LifePriority, number>>,
): void {
  appendEvent(makeEvent('compare', reportId, postcode, overallScore, categoryScores))
}

export function logFeedback(
  reportId: string,
  postcode: string,
  overallScore: number,
  categoryScores: Partial<Record<LifePriority, number>>,
  signal: 'positive' | 'negative' | 'neutral',
  feedbackText?: string,
): void {
  appendEvent(
    makeEvent('feedback', reportId, postcode, overallScore, categoryScores, {
      signal,
      feedbackText,
    }),
  )
}

// ─── Inference trigger check ──────────────────────────────────────────────────

/** Returns true when enough new events have accumulated since the last inference */
export function shouldTriggerInference(): boolean {
  const state = getPreferenceState()
  const lastInference = state.lastInferenceAt ?? 0
  const newEvents = state.interactionLog.filter(e => e.timestamp > lastInference)
  // Only trigger if we have meaningful signal events (saves/dismisses/feedback)
  const signalEvents = newEvents.filter(e =>
    e.type === 'save' || e.type === 'dismiss' || e.type === 'feedback',
  )
  return signalEvents.length >= INFER_AFTER_N_EVENTS
}

/** Returns the most recent N interaction events to pass to /api/learn */
export function getRecentEvents(n = 20): InteractionEvent[] {
  return getPreferenceState().interactionLog.slice(0, n)
}
