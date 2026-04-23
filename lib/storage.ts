import type {
  UserProfile,
  IdealHomeProfile,
  SuitabilityReport,
  AgentMatch,
  PreferenceState,
  PreferenceVector,
  ScoutRun,
} from './types'
import { DEFAULT_WEIGHTS } from './types'

// ─── Keys ─────────────────────────────────────────────────────────────────────

const KEYS = {
  userProfile:      'housely:profile',
  idealHome:        'housely:ideal_home',
  reports:          'housely:reports',         // Record<id, SuitabilityReport>
  agentMatches:     'housely:matches',         // AgentMatch[]
  scoutRuns:        'housely:scout_runs',      // ScoutRun[]
  preferences:      'housely:preferences',     // PreferenceState
} as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

function get<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function set<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage full — silently ignore in hackathon context
  }
}

function remove(key: string): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(key)
}

// ─── User profile ─────────────────────────────────────────────────────────────

export function getProfile(): UserProfile | null {
  return get<UserProfile>(KEYS.userProfile)
}

export function saveProfile(profile: UserProfile): void {
  set(KEYS.userProfile, { ...profile, updatedAt: Date.now() })
}

export function clearProfile(): void {
  remove(KEYS.userProfile)
}

// ─── Ideal home (Scout criteria) ──────────────────────────────────────────────

export function getIdealHome(): IdealHomeProfile | null {
  return get<IdealHomeProfile>(KEYS.idealHome)
}

export function saveIdealHome(profile: IdealHomeProfile): void {
  set(KEYS.idealHome, profile)
}

// ─── Suitability reports ──────────────────────────────────────────────────────

export function getReports(): Record<string, SuitabilityReport> {
  return get<Record<string, SuitabilityReport>>(KEYS.reports) ?? {}
}

export function getReport(id: string): SuitabilityReport | null {
  return getReports()[id] ?? null
}

export function saveReport(report: SuitabilityReport): void {
  const all = getReports()
  all[report.id] = { ...report, savedAt: Date.now() }
  set(KEYS.reports, all)
}

export function deleteReport(id: string): void {
  const all = getReports()
  delete all[id]
  set(KEYS.reports, all)
}

export function clearAllReports(): void {
  remove(KEYS.reports)
}

export function getSavedReports(): SuitabilityReport[] {
  return Object.values(getReports())
    .filter(r => r.savedAt != null)
    .sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0))
}

// ─── Scout matches ────────────────────────────────────────────────────────────

export function getAgentMatches(): AgentMatch[] {
  return get<AgentMatch[]>(KEYS.agentMatches) ?? []
}

export function saveAgentMatches(matches: AgentMatch[]): void {
  set(KEYS.agentMatches, matches)
}

export function upsertAgentMatch(match: AgentMatch): void {
  const all = getAgentMatches()
  const idx = all.findIndex(m => m.postcode === match.postcode)
  if (idx >= 0) {
    all[idx] = match
  } else {
    all.unshift(match)
  }
  set(KEYS.agentMatches, all)
}

export function dismissMatch(id: string): void {
  const all = getAgentMatches().map(m =>
    m.id === id ? { ...m, dismissed: true } : m
  )
  set(KEYS.agentMatches, all)
}

export function saveMatch(id: string): void {
  const all = getAgentMatches().map(m =>
    m.id === id ? { ...m, saved: true } : m
  )
  set(KEYS.agentMatches, all)
}

export function clearAgentMatches(): void {
  remove(KEYS.agentMatches)
}

// ─── Scout runs ───────────────────────────────────────────────────────────────

export function getScoutRuns(): ScoutRun[] {
  return get<ScoutRun[]>(KEYS.scoutRuns) ?? []
}

export function addScoutRun(run: ScoutRun): void {
  const runs = getScoutRuns()
  runs.unshift(run)
  set(KEYS.scoutRuns, runs.slice(0, 20)) // keep last 20
}

export function updateScoutRun(id: string, updates: Partial<ScoutRun>): void {
  const runs = getScoutRuns().map(r => r.id === id ? { ...r, ...updates } : r)
  set(KEYS.scoutRuns, runs)
}

export function getLastScoutRun(): ScoutRun | null {
  return getScoutRuns()[0] ?? null
}

// ─── Preference state ─────────────────────────────────────────────────────────

export function getPreferenceState(): PreferenceState {
  return get<PreferenceState>(KEYS.preferences) ?? {
    weights: { ...DEFAULT_WEIGHTS },
    interactionLog: [],
    inferenceHistory: [],
    lastInferenceAt: null,
    totalInteractions: 0,
  }
}

export function savePreferenceState(state: PreferenceState): void {
  set(KEYS.preferences, state)
}

export function getWeights(): PreferenceVector {
  return getPreferenceState().weights
}

export function updateWeights(weights: PreferenceVector): void {
  const state = getPreferenceState()
  savePreferenceState({ ...state, weights })
}
