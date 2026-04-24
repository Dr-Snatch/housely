'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getProfile, saveProfile, getIdealHome, saveIdealHome } from '@/lib/storage'
import type { UserProfile, IdealHomeProfile, LifePriority, LifeStage, PropertyType } from '@/lib/types'

// ─── Priority config ──────────────────────────────────────────────────────────

const PRIORITIES: { id: LifePriority; label: string; desc: string }[] = [
  { id: 'transport',    label: 'Transport',       desc: 'Tube, rail, bus links' },
  { id: 'safety',       label: 'Safety',           desc: 'Crime levels in the area' },
  { id: 'amenities',    label: 'Amenities',        desc: 'Shops, cafes, restaurants' },
  { id: 'flood_risk',   label: 'Flood risk',       desc: 'Proximity to flood zones' },
  { id: 'air_quality',  label: 'Air quality',      desc: 'Pollution and DAQI index' },
  { id: 'price_growth', label: 'Price growth',     desc: 'Investment potential' },
  { id: 'schools',      label: 'Schools',          desc: 'Nearby school quality' },
  { id: 'green_space',  label: 'Green space',      desc: 'Parks and open areas' },
  { id: 'gp_health',    label: 'GP & health',      desc: 'Local healthcare access' },
]

const LIFE_STAGES: { id: LifeStage; label: string }[] = [
  { id: 'young_professional', label: 'Young professional' },
  { id: 'couple',             label: 'Couple' },
  { id: 'family_with_children', label: 'Family with children' },
  { id: 'dog_owner',          label: 'Dog owner' },
  { id: 'retired',            label: 'Retired' },
  { id: 'student',            label: 'Student' },
]

const PROPERTY_TYPES: { id: PropertyType; label: string }[] = [
  { id: 'flat',          label: 'Flat' },
  { id: 'terraced',      label: 'Terraced' },
  { id: 'semi_detached', label: 'Semi-detached' },
  { id: 'detached',      label: 'Detached' },
  { id: 'any',           label: 'Any' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toggle<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item]
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
        active
          ? 'bg-stone-900 text-white border-stone-900'
          : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
      }`}
    >
      {children}
    </button>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold tracking-widest uppercase text-stone-400 mb-3">
      {children}
    </p>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-6 space-y-4">
      <h2 className="font-black text-base text-stone-800">{title}</h2>
      {children}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter()
  const [saved, setSaved] = useState(false)

  // Lifestyle state
  const [priorities, setPriorities] = useState<LifePriority[]>([
    'transport', 'safety', 'amenities', 'flood_risk', 'air_quality',
  ])
  const [lifeStages, setLifeStages] = useState<LifeStage[]>([])
  const [commuteMinutes, setCommuteMinutes] = useState(30)
  const [workPostcode, setWorkPostcode] = useState('')

  // Ideal home state
  const [propertyTypes, setPropertyTypes] = useState<PropertyType[]>(['any'])
  const [minBedrooms, setMinBedrooms] = useState(1)
  const [maxBedrooms, setMaxBedrooms] = useState(3)
  const [maxBudget, setMaxBudget] = useState(500000)
  const [targetAreas, setTargetAreas] = useState('')
  const [mustHaves, setMustHaves] = useState('')

  // Preserved timestamps
  const [profileCreatedAt, setProfileCreatedAt] = useState<number | null>(null)

  // Load existing data
  useEffect(() => {
    const profile = getProfile()
    if (profile) {
      setPriorities(profile.priorities)
      setLifeStages(profile.lifeStages)
      setCommuteMinutes(profile.commuteMinutes)
      setWorkPostcode(profile.workPostcode ?? '')
      setProfileCreatedAt(profile.createdAt)
    }
    const ideal = getIdealHome()
    if (ideal) {
      setPropertyTypes(ideal.propertyTypes)
      setMinBedrooms(ideal.minBedrooms)
      setMaxBedrooms(ideal.maxBedrooms)
      setMaxBudget(ideal.maxBudget)
      setTargetAreas(ideal.targetAreas.join(', '))
      setMustHaves(ideal.mustHaves.join(', '))
    }
  }, [])

  function handleSave() {
    const now = Date.now()
    const profile: UserProfile = {
      id: 'default',
      priorities,
      lifeStages,
      commuteMinutes,
      workPostcode: workPostcode.trim() || undefined,
      createdAt: profileCreatedAt ?? now,
      updatedAt: now,
    }
    saveProfile(profile)

    const areas = targetAreas
      .split(',')
      .map(a => a.trim().toUpperCase())
      .filter(Boolean)

    const must = mustHaves
      .split(',')
      .map(m => m.trim().toLowerCase())
      .filter(Boolean)

    const ideal: IdealHomeProfile = {
      propertyTypes,
      minBedrooms,
      maxBedrooms,
      maxBudget,
      targetAreas: areas,
      mustHaves: must,
    }
    saveIdealHome(ideal)

    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-black tracking-tight">Your profile</h1>
        <p className="text-stone-500 mt-1">
          Tell us what matters to you. Claude weighs neighbourhood data against your priorities.
        </p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* Left — lifestyle */}
        <div className="space-y-5">

          <Section title="What matters most to you?">
            <Label>Select your top priorities (in any order)</Label>
            <div className="flex flex-wrap gap-2">
              {PRIORITIES.map(p => (
                <Pill
                  key={p.id}
                  active={priorities.includes(p.id)}
                  onClick={() => setPriorities(prev => toggle(prev, p.id))}
                >
                  {p.label}
                </Pill>
              ))}
            </div>
            {priorities.length > 0 && (
              <div className="mt-3 space-y-1">
                {priorities.map(id => {
                  const p = PRIORITIES.find(x => x.id === id)!
                  return (
                    <div key={id} className="flex items-center gap-2 text-xs text-stone-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-stone-400 shrink-0" />
                      <span className="font-medium text-stone-700">{p.label}</span>
                      <span>— {p.desc}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </Section>

          <Section title="Life stage">
            <Label>Select all that apply</Label>
            <div className="flex flex-wrap gap-2">
              {LIFE_STAGES.map(s => (
                <Pill
                  key={s.id}
                  active={lifeStages.includes(s.id)}
                  onClick={() => setLifeStages(prev => toggle(prev, s.id))}
                >
                  {s.label}
                </Pill>
              ))}
            </div>
          </Section>

          <Section title="Commute">
            <Label>Maximum commute you'd accept</Label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={10}
                max={90}
                step={5}
                value={commuteMinutes}
                onChange={e => setCommuteMinutes(Number(e.target.value))}
                className="flex-1 accent-stone-900"
              />
              <span className="text-lg font-black tabular-nums w-20 shrink-0">
                {commuteMinutes} min
              </span>
            </div>
            <div className="mt-2">
              <label className="text-xs text-stone-400 block mb-1">Work postcode (optional)</label>
              <input
                type="text"
                value={workPostcode}
                onChange={e => setWorkPostcode(e.target.value.toUpperCase())}
                placeholder="e.g. EC2A 2JA"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 font-mono"
              />
            </div>
          </Section>

        </div>

        {/* Right — ideal home */}
        <div className="space-y-5">

          <Section title="Ideal property">
            <Label>Property type</Label>
            <div className="flex flex-wrap gap-2">
              {PROPERTY_TYPES.map(t => (
                <Pill
                  key={t.id}
                  active={propertyTypes.includes(t.id)}
                  onClick={() => setPropertyTypes(prev => toggle(prev, t.id))}
                >
                  {t.label}
                </Pill>
              ))}
            </div>
          </Section>

          <Section title="Bedrooms">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Minimum</Label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMinBedrooms(Math.max(1, minBedrooms - 1))}
                    className="w-8 h-8 rounded-full border border-stone-200 text-stone-600 hover:border-stone-400 font-bold"
                  >
                    −
                  </button>
                  <span className="text-lg font-black tabular-nums w-6 text-center">{minBedrooms}</span>
                  <button
                    type="button"
                    onClick={() => setMinBedrooms(Math.min(maxBedrooms, minBedrooms + 1))}
                    className="w-8 h-8 rounded-full border border-stone-200 text-stone-600 hover:border-stone-400 font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
              <div>
                <Label>Maximum</Label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMaxBedrooms(Math.max(minBedrooms, maxBedrooms - 1))}
                    className="w-8 h-8 rounded-full border border-stone-200 text-stone-600 hover:border-stone-400 font-bold"
                  >
                    −
                  </button>
                  <span className="text-lg font-black tabular-nums w-6 text-center">{maxBedrooms}</span>
                  <button
                    type="button"
                    onClick={() => setMaxBedrooms(Math.min(6, maxBedrooms + 1))}
                    className="w-8 h-8 rounded-full border border-stone-200 text-stone-600 hover:border-stone-400 font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </Section>

          <Section title="Budget">
            <Label>Maximum purchase price</Label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={100000}
                max={2000000}
                step={25000}
                value={maxBudget}
                onChange={e => setMaxBudget(Number(e.target.value))}
                className="flex-1 accent-stone-900"
              />
              <span className="text-lg font-black tabular-nums w-28 shrink-0">
                £{(maxBudget / 1000).toFixed(0)}k
              </span>
            </div>
          </Section>

          <Section title="Must-haves">
            <Label>Features you won't compromise on</Label>
            <textarea
              value={mustHaves}
              onChange={e => setMustHaves(e.target.value)}
              placeholder="garden, parking, near_tube, quiet_street — separate with commas"
              rows={2}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 font-mono resize-none"
            />
          </Section>

          <Section title="Target areas">
            <Label>Postcode districts to search</Label>
            <textarea
              value={targetAreas}
              onChange={e => setTargetAreas(e.target.value)}
              placeholder="SW17, CR7, SE22 — separate with commas"
              rows={2}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 font-mono resize-none"
            />
            <p className="text-xs text-stone-400">
              The Scout agent will scan these areas for matching properties.
            </p>
          </Section>

          {/* Save */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 bg-stone-900 text-white font-bold py-3 rounded-xl hover:bg-stone-800 transition-colors"
            >
              {saved ? 'Saved ✓' : 'Save profile'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="px-5 py-3 rounded-xl border border-stone-200 text-stone-600 hover:border-stone-400 transition-colors font-medium"
            >
              Search now →
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
