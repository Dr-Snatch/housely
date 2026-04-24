'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSavedReports, getReports } from '@/lib/storage'
import type { SuitabilityReport } from '@/lib/types'

type Tab = 'saved' | 'all'

function ScoreBadge({ score }: { score: number }) {
  const bg =
    score >= 75 ? 'bg-green-50 text-green-700 border-green-200' :
    score >= 55 ? 'bg-amber-50 text-amber-700 border-amber-200' :
    'bg-red-50 text-red-700 border-red-200'
  return (
    <span className={`text-sm font-black px-2.5 py-0.5 rounded-full border ${bg}`}>
      {score}
    </span>
  )
}

function ReportCard({ report }: { report: SuitabilityReport }) {
  const topCategories = report.categories.slice(0, 3)

  return (
    <Link
      href={`/report/${report.postcode}`}
      className="block bg-white rounded-xl border border-stone-200 p-5 hover:border-stone-400 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-black text-stone-900">{report.postcode}</h3>
          <p className="text-sm text-stone-400 mt-0.5">
            {report.neighbourhoodData.district}, {report.neighbourhoodData.region}
          </p>
        </div>
        <ScoreBadge score={report.overallScore} />
      </div>

      <p className="text-xs font-bold text-stone-500 mb-2">{report.verdict}</p>

      <div className="space-y-1.5">
        {topCategories.map(cat => (
          <div key={cat.category} className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${cat.rawScore}%`,
                  backgroundColor:
                    cat.rawScore >= 75 ? '#16a34a' :
                    cat.rawScore >= 55 ? '#d97706' : '#dc2626',
                }}
              />
            </div>
            <span className="text-xs text-stone-400 w-20 shrink-0">{cat.label}</span>
          </div>
        ))}
      </div>

      {report.neighbourhoodData.prices?.medianSalePrice && (
        <p className="text-xs text-stone-400 mt-3">
          Median price: <span className="font-semibold text-stone-600">
            £{report.neighbourhoodData.prices.medianSalePrice.toLocaleString()}
          </span>
        </p>
      )}

      <p className="text-xs text-stone-300 mt-2">
        {report.savedAt
          ? `Saved ${new Date(report.savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
          : `Viewed ${new Date(report.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
        }
      </p>
    </Link>
  )
}

function EmptyState({ tab }: { tab: Tab }) {
  return (
    <div className="col-span-full py-16 text-center">
      <p className="text-stone-400 text-sm mb-4">
        {tab === 'saved'
          ? 'No saved reports yet. Search a postcode and save reports you like.'
          : 'No reports yet. Search a postcode to get started.'
        }
      </p>
      <Link
        href="/"
        className="inline-block bg-stone-900 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-stone-800 transition-colors"
      >
        Search a postcode →
      </Link>
    </div>
  )
}

export default function MatchesPage() {
  const [tab, setTab] = useState<Tab>('saved')
  const [savedReports, setSavedReports] = useState<SuitabilityReport[]>([])
  const [allReports, setAllReports] = useState<SuitabilityReport[]>([])

  useEffect(() => {
    setSavedReports(getSavedReports())
    setAllReports(
      Object.values(getReports()).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    )
  }, [])

  const shown = tab === 'saved' ? savedReports : allReports

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-black tracking-tight">Your reports</h1>
        <p className="text-stone-500 mt-1">Postcodes you've analysed, all in one place.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-stone-200">
        {(['saved', 'all'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-400 hover:text-stone-600'
            }`}
          >
            {t === 'saved' ? `Saved (${savedReports.length})` : `All (${allReports.length})`}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 gap-4">
        {shown.length === 0
          ? <EmptyState tab={tab} />
          : shown.map(r => <ReportCard key={r.id} report={r} />)
        }
      </div>

      {/* Scout placeholder */}
      <div className="mt-10 bg-stone-900 rounded-2xl p-8 text-white flex items-center justify-between">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase text-stone-400 mb-2">Coming soon</p>
          <h2 className="text-xl font-black mb-1">Scout agent</h2>
          <p className="text-stone-400 text-sm max-w-md">
            Set your target areas and ideal home criteria. Scout will continuously scan postcodes,
            score each neighbourhood against your priorities, and surface the best matches automatically.
          </p>
        </div>
        <button
          disabled
          className="shrink-0 ml-8 px-5 py-3 rounded-xl bg-stone-700 text-stone-400 font-bold cursor-not-allowed text-sm"
        >
          Run Scout
        </button>
      </div>
    </div>
  )
}
