import { notFound } from 'next/navigation'
import Link from 'next/link'
import { fetchNeighbourhoodData } from '@/lib/uk-apis'
import { extractRawScores, buildReportPrompt } from '@/lib/prompts'
import { explainScore, getWeightedScore, scoreVerdict } from '@/lib/preferences'
import { DEFAULT_WEIGHTS } from '@/lib/types'
import type { UserProfile, LifePriority, CategoryScore } from '@/lib/types'
import NarrativeStream from './NarrativeStream'
import { SYSTEM_PROMPT } from '@/lib/prompts'

const DEFAULT_PROFILE: UserProfile = {
  id: 'default',
  priorities: ['transport', 'safety', 'amenities', 'flood_risk', 'air_quality'] as LifePriority[],
  lifeStages: [],
  commuteMinutes: 30,
  createdAt: 0,
  updatedAt: 0,
}

function ScoreRing({ score }: { score: number }) {
  const radius = 44
  const circ = 2 * Math.PI * radius
  const dash = (score / 100) * circ
  const color = score >= 75 ? '#16a34a' : score >= 55 ? '#d97706' : '#dc2626'

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#e7e5e4" strokeWidth="10" />
        <circle
          cx="60" cy="60" r={radius} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
        <text x="60" y="64" textAnchor="middle" fontSize="26" fontWeight="900" fill="#1c1917">
          {score}
        </text>
      </svg>
      <span className="text-xs font-bold tracking-widest uppercase text-stone-400">out of 100</span>
    </div>
  )
}

function CategoryBar({ cat }: { cat: CategoryScore }) {
  const scoreColor =
    cat.rawScore >= 75 ? '#16a34a' :
    cat.rawScore >= 55 ? '#d97706' : '#dc2626'

  const weightPct = Math.round(cat.weight * 100)
  const contribution = cat.weightedContribution

  return (
    <div>
      <div className="flex justify-between items-baseline text-sm mb-1">
        <span className="font-semibold text-stone-700">{cat.label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-400 tabular-nums">{weightPct}% weight</span>
          <span className="text-stone-700 font-mono tabular-nums text-xs">
            {cat.rawScore}<span className="text-stone-400">/100</span>
          </span>
        </div>
      </div>
      {/* Raw score bar */}
      <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${cat.rawScore}%`, backgroundColor: scoreColor }}
        />
      </div>
      {/* Weight contribution footnote */}
      <div className="flex justify-between items-center mt-1">
        <p className="text-xs text-stone-400">{cat.summary}</p>
        <span className="text-xs text-stone-300 tabular-nums ml-2 shrink-0">
          +{contribution} pts
        </span>
      </div>
    </div>
  )
}

function KeyDataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-stone-100 last:border-0">
      <dt className="text-stone-500 text-sm">{label}</dt>
      <dd className="font-semibold text-sm text-stone-800">{value}</dd>
    </div>
  )
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ postcode: string }>
}) {
  const { postcode: rawPostcode } = await params
  const postcode = decodeURIComponent(rawPostcode).toUpperCase()

  let data
  try {
    data = await fetchNeighbourhoodData(postcode)
  } catch {
    notFound()
  }

  const rawScores = extractRawScores(data)
  const categories = explainScore(rawScores as Partial<Record<LifePriority, number>>, DEFAULT_WEIGHTS)
  const overallScore = getWeightedScore(rawScores as Partial<Record<LifePriority, number>>, DEFAULT_WEIGHTS)
  const verdict = scoreVerdict(overallScore)
  const prompt = buildReportPrompt(
    data.postcode,
    data,
    DEFAULT_PROFILE,
    categories,
    overallScore,
    DEFAULT_WEIGHTS,
  )

  const verdictColor =
    overallScore >= 75 ? 'text-green-700 bg-green-50 border-green-200' :
    overallScore >= 55 ? 'text-amber-700 bg-amber-50 border-amber-200' :
    'text-red-700 bg-red-50 border-red-200'

  const totalWeightedScore = categories.reduce((s, c) => s + c.weightedContribution, 0)

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      {/* Back */}
      <Link href="/" className="text-sm text-stone-400 hover:text-stone-600 transition-colors mb-6 inline-block">
        ← New search
      </Link>

      {/* Address header */}
      <div className="mb-8">
        <h1 className="text-2xl font-black tracking-tight">{data.postcode}</h1>
        <p className="text-stone-500 mt-1">{data.district}, {data.region}</p>
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-[380px_1fr] gap-8 items-start">

        {/* Left panel */}
        <div className="space-y-5">

          {/* Score card */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 flex flex-col items-center gap-4">
            <ScoreRing score={overallScore} />
            <div className={`text-sm font-bold px-3 py-1 rounded-full border ${verdictColor}`}>
              {verdict}
            </div>
            <p className="text-xs text-stone-400 text-center">
              Weighted across {categories.length} categories · UK government data
            </p>
          </div>

          {/* Score breakdown — transparency section */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xs font-bold tracking-widest uppercase text-stone-400">
                Why this score?
              </h2>
              <span className="text-xs text-stone-400 tabular-nums">{totalWeightedScore} pts total</span>
            </div>
            <div className="space-y-5">
              {categories.map(cat => (
                <CategoryBar key={cat.category} cat={cat} />
              ))}
            </div>
            <p className="text-xs text-stone-300 mt-5 leading-relaxed">
              Score = raw data score (0–100) × category weight. Weights reflect lifestyle priorities.
              Higher weight categories have more influence on the overall score.
            </p>
          </div>

          {/* Raw data highlights */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6">
            <h2 className="text-xs font-bold tracking-widest uppercase text-stone-400 mb-3">Key data</h2>
            <dl>
              {data.crime && (
                <KeyDataRow label="Crimes (last month)" value={data.crime.totalCrimes.toLocaleString()} />
              )}
              {data.transport?.nearestTubeStation && (
                <KeyDataRow
                  label="Nearest tube"
                  value={`${data.transport.nearestTubeStation.name} · ${data.transport.nearestTubeStation.distanceMetres}m`}
                />
              )}
              {data.transport?.busStopCount !== undefined && (
                <KeyDataRow label="Bus stops within 400m" value={String(data.transport.busStopCount)} />
              )}
              {data.flood && (
                <KeyDataRow label="Flood risk" value={data.flood.riskLevel.replace('_', ' ')} />
              )}
              {data.airQuality && (
                <KeyDataRow label="Air quality" value={`${data.airQuality.overallBand} (DAQI ${data.airQuality.overallIndex}/10)`} />
              )}
              {data.prices?.medianSalePrice && (
                <KeyDataRow label="Median sale price" value={`£${data.prices.medianSalePrice.toLocaleString()}`} />
              )}
              {data.amenities && (
                <KeyDataRow label="Parks within 800m" value={String(data.amenities.parks)} />
              )}
              {data.planning?.conservationArea && (
                <KeyDataRow label="Conservation area" value="Yes" />
              )}
              {data.planning?.listedBuildingsNearby !== undefined && data.planning.listedBuildingsNearby > 0 && (
                <KeyDataRow label="Listed buildings nearby" value={String(data.planning.listedBuildingsNearby)} />
              )}
            </dl>
          </div>

          {/* Data sources */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6">
            <h2 className="text-xs font-bold tracking-widest uppercase text-stone-400 mb-3">Data sources</h2>
            <ul className="space-y-1.5 text-xs text-stone-400">
              {data.crime    && <li>Crime — <span className="text-stone-600">data.police.uk</span></li>}
              {data.transport && <li>Transport — <span className="text-stone-600">OpenStreetMap Overpass</span></li>}
              {data.amenities && <li>Amenities — <span className="text-stone-600">OpenStreetMap Overpass</span></li>}
              {data.flood    && <li>Flood risk — <span className="text-stone-600">Environment Agency</span></li>}
              {data.airQuality && <li>Air quality — <span className="text-stone-600">Open-Meteo / Copernicus</span></li>}
              {data.prices   && <li>Prices — <span className="text-stone-600">HM Land Registry PPD</span></li>}
              {data.planning && <li>Conservation / listed — <span className="text-stone-600">planning.data.gov.uk · Historic England</span></li>}
              <li>Postcode lookup — <span className="text-stone-600">postcodes.io</span></li>
            </ul>
            <p className="text-xs text-stone-300 mt-3">
              Data fetched live · cached 1 hour · last updated {new Date(data.fetchedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

        </div>

        {/* Right panel — AI narrative */}
        <div className="bg-white rounded-2xl border border-stone-200 p-8 sticky top-6">
          <div className="flex items-center gap-2 mb-6">
            <h2 className="text-xs font-bold tracking-widest uppercase text-stone-400">AI analysis</h2>
            <span className="text-xs text-stone-300">· powered by Claude</span>
          </div>
          <NarrativeStream systemPrompt={SYSTEM_PROMPT} prompt={prompt} />
        </div>
      </div>
    </div>
  )
}
