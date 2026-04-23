'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LandingPage() {
  const router = useRouter()
  const [postcode, setPostcode] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const clean = postcode.trim().replace(/\s+/g, '').toUpperCase()
    if (!clean) { setError('Enter a UK postcode'); return }
    if (!/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(clean)) {
      setError("That doesn't look like a valid UK postcode")
      return
    }
    router.push(`/report/${clean}`)
  }

  return (
    <div>
      {/* Hero */}
      <section className="bg-stone-900 text-white relative overflow-hidden" style={{ minHeight: '520px' }}>
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="relative max-w-7xl mx-auto px-6 py-32 flex flex-col items-center text-center">
          <p className="text-stone-400 text-xs font-bold tracking-widest uppercase mb-4">
            Real UK data · No sign-up required
          </p>
          <h1 className="text-5xl font-black tracking-tight leading-tight mb-4">
            Does this neighbourhood<br />actually fit your life?
          </h1>
          <p className="text-stone-400 text-lg max-w-xl mb-10">
            Crime, transport, flood risk, air quality, schools and more —
            scored against your priorities by Claude AI.
          </p>

          <form onSubmit={handleSubmit} className="w-full max-w-lg">
            <div className="flex shadow-xl rounded-xl overflow-hidden">
              <input
                type="text"
                value={postcode}
                onChange={e => { setPostcode(e.target.value); setError('') }}
                placeholder="Enter a UK postcode — e.g. SW1A 1AA"
                className="flex-1 bg-white text-stone-900 px-5 py-4 text-base outline-none placeholder:text-stone-400"
                autoFocus
              />
              <button
                type="submit"
                className="bg-white text-stone-900 font-bold px-6 py-4 border-l border-stone-200 hover:bg-stone-50 transition-colors whitespace-nowrap"
              >
                Analyse →
              </button>
            </div>
            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          </form>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-xs font-bold tracking-widest uppercase text-stone-400 mb-3">How it works</p>
          <h2 className="text-3xl font-black tracking-tight">Know before you view.</h2>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-16">
          {[
            { n: '1', title: 'Enter a postcode', body: 'Any UK postcode. Found a property on Rightmove? Paste its postcode straight in.' },
            { n: '2', title: 'We fetch real data', body: '15+ UK government APIs — crime, flood risk, transport, air quality, prices and more.' },
            { n: '3', title: 'Get your score', body: 'Claude AI weighs the data against your lifestyle and writes a plain-English suitability report.' },
          ].map(s => (
            <div key={s.n} className="bg-white rounded-2xl border border-stone-200 p-8">
              <div className="w-10 h-10 bg-stone-900 text-white rounded-full flex items-center justify-center text-sm font-black mb-5">
                {s.n}
              </div>
              <h3 className="font-bold text-lg mb-2">{s.title}</h3>
              <p className="text-stone-500 text-sm leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <p className="text-sm text-stone-400 mb-3">Try an example</p>
          <div className="flex gap-3 justify-center flex-wrap">
            {['SW1A1AA', 'M11AE', 'E16RF', 'BS11AA'].map((pc, i) => (
              <button
                key={pc}
                onClick={() => router.push(`/report/${pc}`)}
                className="px-4 py-2 text-sm font-mono bg-white border border-stone-200 rounded-lg hover:border-stone-400 hover:bg-stone-50 transition-colors"
              >
                {['SW1A 1AA', 'M1 1AE', 'E1 6RF', 'BS1 1AA'][i]}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
