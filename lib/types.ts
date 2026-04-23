// ─── User & Profile ──────────────────────────────────────────────────────────

export type LifePriority =
  | 'transport'
  | 'safety'
  | 'amenities'
  | 'flood_risk'
  | 'air_quality'
  | 'price_growth'
  | 'schools'
  | 'green_space'
  | 'deprivation'
  | 'gp_health'

export type LifeStage =
  | 'young_professional'
  | 'couple'
  | 'family_with_children'
  | 'dog_owner'
  | 'retired'
  | 'student'

export type PropertyType = 'flat' | 'terraced' | 'semi_detached' | 'detached' | 'any'

export interface UserProfile {
  id: string
  priorities: LifePriority[]           // ordered list of declared priorities
  lifeStages: LifeStage[]
  commuteMinutes: number               // max acceptable commute
  workPostcode?: string                // for actual commute routing
  createdAt: number
  updatedAt: number
}

export interface IdealHomeProfile {
  propertyTypes: PropertyType[]
  minBedrooms: number
  maxBedrooms: number
  maxBudget: number                    // GBP
  targetAreas: string[]               // postcode districts e.g. ['SW17', 'CR7']
  mustHaves: string[]                 // ['garden', 'parking', 'near_tube', 'quiet_street']
}

// ─── Neighbourhood data (raw from UK APIs) ────────────────────────────────────

export interface CrimeData {
  totalCrimes: number                  // last 12 months
  byCategory: Record<string, number>  // category slug → count
  hotspotLevel: 'low' | 'medium' | 'high' | 'very_high'
}

export interface TransportData {
  nearestTubeStation?: { name: string; distanceMetres: number; lines: string[] }
  nearestRailStation?: { name: string; distanceMetres: number }
  busStopCount: number                 // within 400m
  busRouteCount: number
  commuteMinutes?: number              // routed to workPostcode via OpenRouteService
}

export interface AmenityData {
  supermarkets: number
  cafes: number
  restaurants: number
  pubs: number
  gyms: number
  parks: number                        // greenspace polygons
  gpSurgeries: number
  schools: number
  pharmacies: number
  nearestParkDistanceMetres?: number
}

export interface FloodData {
  riskLevel: 'very_low' | 'low' | 'medium' | 'high'
  floodZone: string                    // e.g. 'Flood Zone 1'
  activeWarnings: number
}

export interface AirQualityData {
  no2Index: number                     // 1–10 DAQI scale
  pm25Index: number
  pm10Index: number
  overallIndex: number                 // worst of the three
  overallBand: 'Low' | 'Moderate' | 'High' | 'Very High'
}

export interface PriceData {
  medianSalePrice?: number
  salesLast12Months?: number
  priceChangePercent1yr?: number
  priceChangePercent5yr?: number
  postcode: string
}

export interface DeprivationData {
  imdScore: number                     // higher = more deprived
  imdRank: number                      // 1 = most deprived
  imdDecile: number                    // 1–10
  incomeScore?: number
  employmentScore?: number
  educationScore?: number
  healthScore?: number
  crimeScore?: number
  barriersScore?: number
  environmentScore?: number
}

export interface PlanningData {
  recentApplications: number           // last 2 years within 500m
  conservationArea: boolean
  listedBuildingsNearby: number
  aonbOrSssi: boolean
}

export interface AccidentData {
  accidentsLast3Years: number
  severities: { slight: number; serious: number; fatal: number }
}

export interface NeighbourhoodData {
  postcode: string
  latitude: number
  longitude: number
  district: string
  region: string
  crime?: CrimeData
  transport?: TransportData
  amenities?: AmenityData
  flood?: FloodData
  airQuality?: AirQualityData
  prices?: PriceData
  deprivation?: DeprivationData
  planning?: PlanningData
  accidents?: AccidentData
  fetchedAt: number
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

export interface CategoryScore {
  category: LifePriority
  rawScore: number          // 0–100, from UK data
  weight: number            // 0–1 from PreferenceVector
  weightedContribution: number  // rawScore × weight (scaled to 100)
  label: string             // human-readable: 'Transport', 'Safety', etc.
  summary: string           // short data-driven sentence
}

export interface SuitabilityReport {
  id: string
  propertyAddress: string
  postcode: string
  neighbourhoodData: NeighbourhoodData
  overallScore: number              // 0–100 weighted sum
  verdict: 'Strong match' | 'Good match' | 'Moderate match' | 'Poor match'
  categories: CategoryScore[]
  narrative: string                 // streamed Claude analysis
  weightsUsed: PreferenceVector     // snapshot of weights at report time
  userProfileId: string
  savedAt?: number
  createdAt: number
}

// ─── Preference learning ──────────────────────────────────────────────────────

export interface PreferenceVector {
  transport: number
  safety: number
  amenities: number
  flood_risk: number
  air_quality: number
  price_growth: number
  schools: number
  green_space: number
  deprivation: number
  gp_health: number
  // invariant: values sum to 1.0
}

export const DEFAULT_WEIGHTS: PreferenceVector = {
  transport:   0.20,
  safety:      0.15,
  amenities:   0.15,
  flood_risk:  0.10,
  air_quality: 0.10,
  price_growth: 0.10,
  schools:     0.08,
  green_space: 0.07,
  deprivation: 0.03,
  gp_health:   0.02,
}

export type InteractionType =
  | 'save'
  | 'dismiss'
  | 'view'
  | 'layer_toggle'
  | 'compare'
  | 'feedback'

export interface InteractionEvent {
  id: string
  type: InteractionType
  reportId: string
  postcode: string
  overallScore: number
  categoryScores: Partial<Record<LifePriority, number>>
  weightsAtTime: PreferenceVector
  // extra context per type
  layerName?: string          // for layer_toggle
  signal?: 'positive' | 'negative' | 'neutral'  // for feedback
  feedbackText?: string       // for feedback
  timestamp: number
}

export interface WeightChange {
  category: LifePriority
  from: number
  to: number
  delta: number
}

export interface PreferenceInference {
  id: string
  observation: string         // "You've dismissed 4 properties where safety < 65…"
  proposal: string            // "Increase safety weight from 15% to 27%"
  reasoning: string           // longer Claude explanation
  weightsBefore: PreferenceVector
  weightsAfter: PreferenceVector
  changes: WeightChange[]
  accepted: boolean | null    // null = pending
  eventsAnalysed: number      // how many interaction events fed in
  timestamp: number
}

export interface PreferenceState {
  weights: PreferenceVector
  interactionLog: InteractionEvent[]
  inferenceHistory: PreferenceInference[]
  lastInferenceAt: number | null
  totalInteractions: number
}

// ─── Scout agent ──────────────────────────────────────────────────────────────

export interface AgentMatch {
  id: string
  postcode: string
  district: string             // e.g. 'SW17'
  addressSummary: string       // e.g. 'Tooting Bec, SW17'
  overallScore: number
  categories: CategoryScore[]
  verdict: SuitabilityReport['verdict']
  estimatedPrice?: number      // from Land Registry median
  bedroomsEstimate?: string    // from IdealHomeProfile range
  foundAt: number
  reportId?: string            // if user has opened the full report
  dismissed: boolean
  saved: boolean
}

export interface ScoutRun {
  id: string
  startedAt: number
  completedAt?: number
  postcodesScanned: number
  matchesFound: number
  status: 'running' | 'complete' | 'error'
  error?: string
}
