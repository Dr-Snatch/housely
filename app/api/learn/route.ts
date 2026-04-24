import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { normaliseWeights } from '@/lib/preferences'
import { DEFAULT_WEIGHTS } from '@/lib/types'
import type { InteractionEvent, PreferenceVector, LifePriority, PreferenceInference } from '@/lib/types'

// ─── Request / response ───────────────────────────────────────────────────────

export type LearnRequest = {
  events: InteractionEvent[]
  weights: PreferenceVector
}

// ─── Minimum events before we bother analysing ───────────────────────────────

const MIN_EVENTS = 5

// ─── Claude output schema ─────────────────────────────────────────────────────

const PRIORITIES = [
  'transport', 'safety', 'amenities', 'flood_risk', 'air_quality',
  'price_growth', 'schools', 'green_space', 'deprivation', 'gp_health',
] as const

const InferenceSchema = z.object({
  observation: z.string().describe('1–2 sentences describing the pattern noticed in the interaction data'),
  proposal: z.string().describe('1–2 sentences describing the weight changes being proposed'),
  reasoning: z.string().describe('3–5 sentences explaining the reasoning in plain English'),
  weightDeltas: z.record(z.enum(PRIORITIES), z.number())
    .describe('Map of category → delta (e.g. 0.05 or -0.03). Deltas should be small (|delta| ≤ 0.15). The sum of all deltas should be approximately zero so weights remain normalised.'),
})

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildLearnPrompt(events: InteractionEvent[], weights: PreferenceVector): string {
  const weightLines = Object.entries(weights)
    .sort(([, a], [, b]) => b - a)
    .map(([k, v]) => `  ${k}: ${Math.round(v * 100)}%`)
    .join('\n')

  // Summarise saved vs dismissed properties
  const saved    = events.filter(e => e.type === 'save')
  const dismissed = events.filter(e => e.type === 'dismiss')
  const viewed   = events.filter(e => e.type === 'view')
  const feedback = events.filter(e => e.type === 'feedback')

  const scoresSaved    = saved.map(e => e.overallScore)
  const scoresDismissed = dismissed.map(e => e.overallScore)

  const avgScore = (scores: number[]) =>
    scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : null

  // Per-category averages for saved vs dismissed
  const catAvg = (evts: InteractionEvent[], cat: LifePriority) => {
    const vals = evts
      .map(e => e.categoryScores[cat])
      .filter((v): v is number => v != null)
    return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null
  }

  const categoryRows = PRIORITIES.map(cat => {
    const s = catAvg(saved, cat)
    const d = catAvg(dismissed, cat)
    return `  ${cat.padEnd(14)} saved avg: ${s != null ? `${s}/100` : 'n/a'.padStart(6)}  |  dismissed avg: ${d != null ? `${d}/100` : 'n/a'.padStart(6)}`
  }).join('\n')

  const feedbackLines = feedback.length
    ? feedback.map(e => `  [${e.signal ?? 'neutral'}] ${e.feedbackText ?? '(no text)'}`).join('\n')
    : '  (none)'

  return `You are Housely's preference learning engine. Analyse this user's property interaction history and identify what they actually care about — not just what they said.

CURRENT WEIGHTS:
${weightLines}

INTERACTION SUMMARY (last ${events.length} events):
  Saved properties:    ${saved.length}  (avg score: ${avgScore(scoresSaved) ?? 'n/a'})
  Dismissed properties: ${dismissed.length}  (avg score: ${avgScore(scoresDismissed) ?? 'n/a'})
  Viewed reports:      ${viewed.length}
  Explicit feedback:   ${feedback.length}

PER-CATEGORY SCORES (saved vs dismissed):
${categoryRows}

EXPLICIT FEEDBACK:
${feedbackLines}

RAW EVENTS (last ${Math.min(events.length, 20)} — most recent first):
${events.slice(0, 20).map(e =>
  `  [${e.type.toUpperCase().padEnd(8)}] score=${e.overallScore} postcode=${e.postcode}` +
  (e.signal ? ` signal=${e.signal}` : '') +
  (e.feedbackText ? ` "${e.feedbackText}"` : '')
).join('\n')}

TASK:
1. Look for meaningful patterns — e.g. the user consistently saves high-safety properties but dismisses low-transport ones; or they left negative feedback about air quality.
2. Only propose changes if there is a clear, consistent signal (5+ events pointing the same way). Do not tweak weights speculatively.
3. Keep deltas small (|delta| ≤ 0.15 per category). Deltas must approximately sum to zero across all categories.
4. If there is no clear signal, return empty weightDeltas ({}) with an observation explaining why.

Respond with a JSON object matching the schema.`
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let body: LearnRequest

  try {
    body = (await request.json()) as LearnRequest
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { events = [], weights = DEFAULT_WEIGHTS } = body

  if (!Array.isArray(events) || events.length < MIN_EVENTS) {
    return Response.json(
      { error: `Need at least ${MIN_EVENTS} interaction events to learn. Got ${events.length}.` },
      { status: 422 },
    )
  }

  const prompt = buildLearnPrompt(events, weights)

  let result
  try {
    result = await generateObject({
      model: anthropic('claude-haiku-4-5-20251001'), // cheaper model — this is batch analysis not narrative
      schema: InferenceSchema,
      prompt,
    })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Claude inference failed' },
      { status: 502 },
    )
  }

  const { observation, proposal, reasoning, weightDeltas } = result.object

  // Apply deltas to current weights, then normalise so they sum to 1
  const rawAfter = { ...weights }
  for (const [cat, delta] of Object.entries(weightDeltas) as [LifePriority, number][]) {
    if (cat in rawAfter) {
      rawAfter[cat] = Math.max(0.01, rawAfter[cat] + delta)
    }
  }
  const weightsAfter = normaliseWeights(rawAfter)

  // Compute change list for UI display
  const changes = (Object.keys(weights) as LifePriority[])
    .map(cat => ({ category: cat, from: weights[cat], to: weightsAfter[cat], delta: weightsAfter[cat] - weights[cat] }))
    .filter(c => Math.abs(c.delta) > 0.001)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  const inference: PreferenceInference = {
    id: `inf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    observation,
    proposal,
    reasoning,
    weightsBefore: weights,
    weightsAfter,
    changes,
    accepted: null,
    eventsAnalysed: events.length,
    timestamp: Date.now(),
  }

  return Response.json(inference)
}
