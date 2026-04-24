import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { fetchNeighbourhoodData } from '@/lib/uk-apis'
import { extractRawScores, buildReportPrompt, SYSTEM_PROMPT } from '@/lib/prompts'
import { explainScore, getWeightedScore, scoreVerdict } from '@/lib/preferences'
import { DEFAULT_WEIGHTS } from '@/lib/types'
import type { UserProfile, PreferenceVector, LifePriority } from '@/lib/types'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type AnalyseRequest = {
  postcode: string
  address?: string
  profile?: UserProfile
  weights?: PreferenceVector
}

// NDJSON event shapes emitted by this route:
// { type: 'data', ... }   — structured scores + neighbourhood data (first line)
// { type: 'chunk', text } — Claude narrative delta
// { type: 'done' }        — stream complete
// { type: 'error', message } — something went wrong

// ─── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_PROFILE: UserProfile = {
  id: 'default',
  priorities: ['transport', 'safety', 'amenities', 'flood_risk', 'air_quality'] as LifePriority[],
  lifeStages: [],
  commuteMinutes: 30,
  createdAt: 0,
  updatedAt: 0,
}

// ─── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let body: AnalyseRequest

  try {
    body = (await request.json()) as AnalyseRequest
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { postcode, address, profile = DEFAULT_PROFILE, weights = DEFAULT_WEIGHTS } = body

  if (!postcode?.trim()) {
    return Response.json({ error: 'postcode is required' }, { status: 400 })
  }

  // 1. Fetch neighbourhood data (parallel, never throws)
  let data
  try {
    data = await fetchNeighbourhoodData(postcode.trim().toUpperCase())
  } catch {
    return Response.json({ error: 'Invalid postcode or geocoding failed' }, { status: 404 })
  }

  // 2. Score
  const rawScores = extractRawScores(data) as Partial<Record<LifePriority, number>>
  const categories = explainScore(rawScores, weights)
  const overallScore = getWeightedScore(rawScores, weights)
  const verdict = scoreVerdict(overallScore)

  // 3. Build Claude prompt
  const reportPrompt = buildReportPrompt(
    address ?? data.postcode,
    data,
    profile,
    categories,
    overallScore,
    weights,
  )

  // 4. Stream NDJSON: data header first, then narrative chunks
  const encoder = new TextEncoder()
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = writable.getWriter()

  const emit = (obj: unknown) =>
    writer.write(encoder.encode(JSON.stringify(obj) + '\n'))

  ;(async () => {
    try {
      // First line: full structured payload — consumers can bail here if they only need scores
      await emit({
        type: 'data',
        postcode: data.postcode,
        district: data.district,
        region: data.region,
        overallScore,
        verdict,
        categories,
        weightsUsed: weights,
        neighbourhoodData: data,
      })

      // Stream Claude narrative
      const result = streamText({
        model: anthropic('claude-sonnet-4.6'),
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: reportPrompt }],
        maxOutputTokens: 600,
      })

      for await (const chunk of result.textStream) {
        await emit({ type: 'chunk', text: chunk })
      }

      await emit({ type: 'done' })
    } catch (err) {
      await emit({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      await writer.close()
    }
  })()

  return new Response(readable, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
