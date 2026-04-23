import { notFound } from 'next/navigation'
import Link from 'next/link'
import { fetchNeighbourhoodData } from '@/lib/uk-apis'
import { extractRawScores, buildReportPrompt } from '@/lib/prompts'
import { explainScore, getWeightedScore, scoreVerdict } from '@/lib/preferences'
import { DEFAULT_WEIGHTS } from '@/lib/types'
import type { UserProfile, LifePriority } from '@/lib/types'
import NarrativeStream from './NarrativeStream'

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

        {/* Left panel — score + breakdown */}
        <div className="space-y-6">

          {/* Score card */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 flex flex-col items-center gap-4">
            <ScoreRing score={overallScore} />
            <div className={`text-sm font-bold px-3 py-1 rounded-full border ${verdictColor}`}>
              {verdict}
            </div>
            <p className="text-xs text-stone-400 text-center">Based on UK government data · weighted by lifestyle priorities</p>
          </div>

          {/* Breakdown */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6">
            <h2 className="text-xs font-bold tracking-widest uppercase text-stone-400 mb-5">Score breakdown</h2>
            <div className="space-y-4">
              {categories.map(cat => (
                <div key={cat.category}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-semibold text-stone-700">{cat.label}</span>
                    <span className="text-stone-400 tabular-nums">{cat.rawScore}</span>
                  </div>
                  <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${cat.rawScore}%`,
                        backgroundColor:
                          cat.rawScore >= 75 ? '#16a34a' :
                          cat.rawScore >= 55 ? '#d97706' : '#dc2626',
                      }}
                    />
                  </div>
                  <p className="text-xs text-stone-400 mt-1">{cat.summary}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Raw data highlights */}
          {(data.crime || data.flood || data.prices) && (
            <div className="bg-white rounded-2xl border border-stone-200 p-6">
              <h2 className="text-xs font-bold tracking-widest uppercase text-stone-400 mb-4">Key data</h2>
              <dl className="space-y-2 text-sm">
                {data.crime && (
                  <div className="flex justify-between">
                    <dt className="text-stone-500">Crimes (last month)</dt>
                    <dd className="font-semibold">{data.crime.totalCrimes.toLocaleString()}</dd>
                  </div>
                )}
                {data.flood && (
                  <div className="flex justify-between">
                    <dt className="text-stone-500">Flood risk</dt>
                    <dd className="font-semibold capitalize">{data.flood.riskLevel.replace('_', ' ')}</dd>
                  </div>
                )}
                {data.airQuality && (
                  <div className="flex justify-between">
                    <dt className="text-stone-500">Air quality</dt>
                    <dd className="font-semibold">{data.airQuality.overallBand}</dd>
                  </div>
                )}
                {data.prices?.medianSalePrice && (
                  <div className="flex justify-between">
                    <dt className="text-stone-500">Median sale price</dt>
                    <dd className="font-semibold">£{data.prices.medianSalePrice.toLocaleString()}</dd>
                  </div>
                )}
                {data.amenities && (
                  <div className="flex justify-between">
                    <dt className="text-stone-500">Parks within 800m</dt>
                    <dd className="font-semibold">{data.amenities.parks}</dd>
                  </div>
                )}
                {data.deprivation && (
                  <div className="flex justify-between">
                    <dt className="text-stone-500">Deprivation decile</dt>
                    <dd className="font-semibold">{data.deprivation.imdDecile} / 10</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>

        {/* Right panel — AI narrative */}
        <div className="bg-white rounded-2xl border border-stone-200 p-8">
          <div className="flex items-center gap-2 mb-6">
            <h2 className="text-xs font-bold tracking-widest uppercase text-stone-400">AI analysis</h2>
            <span className="text-xs text-stone-300">· powered by Claude</span>
          </div>
          <NarrativeStream prompt={prompt} />
        </div>
      </div>
    </div>
  )
}
