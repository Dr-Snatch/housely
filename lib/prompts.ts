import type { NeighbourhoodData, UserProfile, PreferenceVector, CategoryScore } from './types'

// ─── System prompt ────────────────────────────────────────────────────────────

export const SYSTEM_PROMPT = `You are Housely's neighbourhood analyst — a knowledgeable, direct, and honest property advisor for UK house hunters.

Your job is to analyse real UK data about a neighbourhood and explain to a specific person whether it suits their lifestyle.

Guidelines:
- Be honest, not promotional. If something is a genuine concern, say so clearly.
- Be specific — cite actual numbers from the data (crime counts, scores, distances).
- Use British English throughout (flat not apartment, postcode not zip, neighbourhood not neighborhood).
- Write in plain, confident prose. No bullet points in the narrative. No markdown headers.
- Weigh your analysis against the user's stated priorities — someone who cares deeply about transport should hear more about transport than someone who doesn't.
- End with a clear verdict: is this a good fit or not, and what are the 1–2 things they should investigate further before deciding?
- Keep the narrative to 300–400 words.`

// ─── Raw score extraction from neighbourhood data ─────────────────────────────

/** Convert raw neighbourhood data into 0–100 scores per category */
export function extractRawScores(data: NeighbourhoodData): Partial<Record<string, number>> {
  const scores: Partial<Record<string, number>> = {}

  // Transport (proxy: bus stops + tube/rail presence)
  if (data.transport) {
    const t = data.transport
    let s = 40
    if (t.nearestTubeStation) s += 30 - Math.min(30, t.nearestTubeStation.distanceMetres / 100)
    if (t.nearestRailStation) s += 15 - Math.min(15, t.nearestRailStation.distanceMetres / 100)
    s += Math.min(15, t.busStopCount * 2)
    scores.transport = Math.max(0, Math.min(100, Math.round(s)))
  }

  // Safety: invert crime count (0 crimes = 100, 200+ = 0)
  if (data.crime) {
    const hotspot = data.crime.hotspotLevel
    scores.safety =
      hotspot === 'low'       ? 85 :
      hotspot === 'medium'    ? 60 :
      hotspot === 'high'      ? 35 : 15
  }

  // Amenities: composite of shop/service counts
  if (data.amenities) {
    const a = data.amenities
    const raw =
      Math.min(20, a.supermarkets * 10) +
      Math.min(20, a.cafes * 2) +
      Math.min(15, a.restaurants * 1.5) +
      Math.min(15, a.parks * 5) +
      Math.min(15, a.gyms * 10) +
      Math.min(15, a.gpSurgeries * 10)
    scores.amenities = Math.min(100, Math.round(raw))
  }

  // Flood risk: invert (high risk = low score)
  if (data.flood) {
    scores.flood_risk =
      data.flood.riskLevel === 'very_low' ? 95 :
      data.flood.riskLevel === 'low'      ? 75 :
      data.flood.riskLevel === 'medium'   ? 45 : 15
  }

  // Air quality: invert DAQI (1 = excellent, 10 = terrible)
  if (data.airQuality) {
    scores.air_quality = Math.max(0, Math.round(100 - (data.airQuality.overallIndex - 1) * 11))
  }

  // Price growth (use 1yr change if available; neutral 50 if not)
  if (data.prices) {
    const pct = data.prices.priceChangePercent1yr
    if (pct != null) {
      scores.price_growth = Math.min(100, Math.max(0, Math.round(50 + pct * 3)))
    }
  }

  // Schools: count nearby schools (capped)
  if (data.amenities) {
    scores.schools = Math.min(100, data.amenities.schools * 15)
  }

  // Green space: parks count
  if (data.amenities) {
    scores.green_space = Math.min(100, data.amenities.parks * 20)
  }

  // Deprivation: invert decile (decile 1 = very deprived, decile 10 = least deprived)
  if (data.deprivation) {
    scores.deprivation = Math.round((data.deprivation.imdDecile / 10) * 100)
  }

  // GP / health — count from Overpass + CQC quality rating bonus
  if (data.amenities) {
    let gpScore = Math.min(75, data.amenities.gpSurgeries * 25)
    const ratingBonus: Record<string, number> = {
      Outstanding: 25,
      Good: 15,
      'Requires Improvement': 0,
      Inadequate: -15,
    }
    if (data.amenities.nearestGPRating) {
      gpScore += ratingBonus[data.amenities.nearestGPRating] ?? 0
    }
    scores.gp_health = Math.max(0, Math.min(100, Math.round(gpScore)))
  }

  return scores
}

// ─── Report prompt builder ────────────────────────────────────────────────────

export function buildReportPrompt(
  address: string,
  data: NeighbourhoodData,
  profile: UserProfile,
  categories: CategoryScore[],
  overallScore: number,
  weights: PreferenceVector,
): string {
  const priorityList = profile.priorities
    .map(p => p.replace(/_/g, ' '))
    .join(', ')

  const categoryLines = categories
    .map(c => `  ${c.label}: ${c.rawScore}/100 (weight ${Math.round(c.weight * 100)}% → contributes ${c.weightedContribution} pts)`)
    .join('\n')

  const crimeDetail = data.crime
    ? `${data.crime.totalCrimes} crimes recorded in the last month. Hotspot level: ${data.crime.hotspotLevel}.`
    : 'Crime data unavailable.'

  const transportDetail = data.transport
    ? [
        data.transport.nearestTubeStation ? `Nearest tube: ${data.transport.nearestTubeStation.name} (${data.transport.nearestTubeStation.distanceMetres}m, ${data.transport.nearestTubeStation.lines.join('/')})` : null,
        data.transport.nearestRailStation ? `Nearest rail: ${data.transport.nearestRailStation.name} (${data.transport.nearestRailStation.distanceMetres}m)` : null,
        `${data.transport.busStopCount} bus stops within 400m.`,
        data.transport.commuteMinutes ? `Estimated commute: ${data.transport.commuteMinutes} min.` : null,
      ].filter(Boolean).join(' ')
    : 'Transport data unavailable.'

  const floodDetail = data.flood
    ? `Flood risk: ${data.flood.riskLevel} (${data.flood.floodZone}). ${data.flood.activeWarnings} active warnings in the region.`
    : 'Flood data unavailable.'

  const airDetail = data.airQuality
    ? `Air quality: ${data.airQuality.overallBand} (DAQI ${data.airQuality.overallIndex}/10). NO₂ index ${data.airQuality.no2Index}, PM2.5 index ${data.airQuality.pm25Index}.`
    : 'Air quality data unavailable.'

  const priceDetail = data.prices?.medianSalePrice
    ? `Median sale price: £${data.prices.medianSalePrice.toLocaleString()}. ${data.prices.salesLast12Months ?? 0} sales in the last 12 months.`
    : 'Price data unavailable.'

  const deprivDetail = data.deprivation
    ? `IMD decile: ${data.deprivation.imdDecile}/10 (1 = most deprived). Score: ${data.deprivation.imdScore.toFixed(1)}.`
    : 'Deprivation data unavailable.'

  const gpRatingNote = data.amenities?.nearestGPRating
    ? ` Nearest GP rated: ${data.amenities.nearestGPRating} (CQC).`
    : ''
  const amenityDetail = data.amenities
    ? `Supermarkets: ${data.amenities.supermarkets}, cafes: ${data.amenities.cafes}, restaurants: ${data.amenities.restaurants}, pubs: ${data.amenities.pubs}, parks: ${data.amenities.parks}, gyms: ${data.amenities.gyms}, GP surgeries: ${data.amenities.gpSurgeries}, schools: ${data.amenities.schools}.${gpRatingNote}`
    : 'Amenity data unavailable.'

  const conservationNote = data.planning?.conservationArea
    ? 'This area is within a conservation area.'
    : ''

  return `Analyse this property and neighbourhood for the user described below.

PROPERTY: ${address} (${data.postcode})
LOCATION: ${data.district}, ${data.region}

USER PROFILE:
- Declared priorities: ${priorityList}
- Life stage: ${profile.lifeStages.join(', ') || 'not specified'}
- Commute tolerance: ${profile.commuteMinutes} minutes

OVERALL SUITABILITY SCORE: ${overallScore}/100

CATEGORY SCORES (weighted by this user's preferences):
${categoryLines}

RAW DATA:
Crime: ${crimeDetail}
Transport: ${transportDetail}
Amenities: ${amenityDetail}
Flood: ${floodDetail}
Air quality: ${airDetail}
Prices: ${priceDetail}
Deprivation: ${deprivDetail}
${conservationNote}

Write a personalised suitability analysis for this specific user. Focus most on their top priorities. Be honest about concerns. End with a clear recommendation.`
}
