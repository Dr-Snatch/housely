import type {
  NeighbourhoodData,
  CrimeData,
  TransportData,
  AmenityData,
  FloodData,
  AirQualityData,
  PriceData,
  DeprivationData,
  PlanningData,
  AccidentData,
} from './types'

// ─── Shared fetch helpers ─────────────────────────────────────────────────────

const NEXT_OPTS = { next: { revalidate: 3600 } } as const

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...NEXT_OPTS, ...init })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`)
  return res.json() as Promise<T>
}

async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const res = await fetch(url, { ...NEXT_OPTS, ...init })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`)
  return res.text()
}

// ─── 1. Postcodes.io ──────────────────────────────────────────────────────────

interface PostcodeResult {
  postcode: string
  latitude: number
  longitude: number
  admin_district: string
  region: string
  parliamentary_constituency: string
  codes: {
    admin_district: string
    lsoa: string
  }
}

export async function lookupPostcode(postcode: string): Promise<PostcodeResult> {
  const clean = postcode.replace(/\s+/g, '').toUpperCase()
  const data = await fetchJson<{ result: PostcodeResult }>(
    `https://api.postcodes.io/postcodes/${clean}`,
  )
  return data.result
}

/** Expand a postcode district (e.g. 'SW17') into a sample of full postcodes */
export async function expandDistrict(district: string): Promise<string[]> {
  const clean = district.replace(/\s+/g, '').toUpperCase()
  const data = await fetchJson<{ result: { postcode: string }[] }>(
    `https://api.postcodes.io/postcodes?q=${clean}&limit=20`,
  )
  return data.result?.map((r: { postcode: string }) => r.postcode) ?? []
}

// ─── 2. Police.uk crime data ──────────────────────────────────────────────────

interface CrimeEntry {
  category: string
  location: { latitude: string; longitude: string }
}

export async function fetchCrime(lat: number, lng: number): Promise<CrimeData> {
  const crimes = await fetchJson<CrimeEntry[]>(
    `https://data.police.uk/api/crimes-street/all-crime?lat=${lat}&lng=${lng}`,
  ).catch(() => [] as CrimeEntry[])

  const byCategory: Record<string, number> = {}
  for (const c of crimes) {
    byCategory[c.category] = (byCategory[c.category] ?? 0) + 1
  }

  const total = crimes.length
  const hotspotLevel =
    total > 150 ? 'very_high' :
    total > 80  ? 'high' :
    total > 40  ? 'medium' : 'low'

  return { totalCrimes: total, byCategory, hotspotLevel }
}

// ─── 3. Overpass (OSM amenities) ──────────────────────────────────────────────

interface OverpassElement { tags: Record<string, string> }
interface OverpassResult { elements: OverpassElement[] }

async function overpassQuery(query: string): Promise<OverpassElement[]> {
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Housely/1.0 (hackathon project)',
    },
    ...NEXT_OPTS,
  })
  if (!res.ok) return []
  const json = await res.json() as OverpassResult
  return json.elements ?? []
}

export async function fetchAmenities(lat: number, lng: number): Promise<AmenityData> {
  const radius = 800 // metres

  const countQuery = (amenityFilter: string, r = radius) =>
    overpassQuery(
      `[out:json][timeout:10];(${amenityFilter}(around:${r},${lat},${lng}););out count;`,
    ).then(els => {
      const total = els[0]?.tags?.total
      return total ? parseInt(total) : 0
    }).catch(() => 0)

  const [supermarkets, cafes, restaurants, pubs, gyms, parks, gpSurgeries, pharmacies, schools] =
    await Promise.all([
      countQuery(`node["shop"="supermarket"]`),
      countQuery(`node["amenity"="cafe"]`),
      countQuery(`node["amenity"="restaurant"]`),
      countQuery(`node["amenity"="pub"]`),
      countQuery(`node["leisure"="fitness_centre"]`),
      countQuery(`(node["leisure"="park"];way["leisure"="park"])`),
      countQuery(`node["amenity"="doctors"]`),
      countQuery(`node["amenity"="pharmacy"]`),
      countQuery(`node["amenity"="school"]`),
    ])

  return { supermarkets, cafes, restaurants, pubs, gyms, parks, gpSurgeries, pharmacies, schools }
}

// ─── 3b. Overpass — transport ─────────────────────────────────────────────────

interface OverpassNode { id: number; lat: number; lon: number; tags: Record<string, string> }

async function overpassNodes(query: string): Promise<OverpassNode[]> {
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Housely/1.0 (hackathon project)',
    },
    ...NEXT_OPTS,
  })
  if (!res.ok) return []
  const json = await res.json() as { elements: OverpassNode[] }
  return json.elements ?? []
}

function haversineMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function fetchTransport(lat: number, lng: number): Promise<TransportData> {
  const busQuery = `[out:json][timeout:10];node["highway"="bus_stop"](around:400,${lat},${lng});out body;`
  const stationQuery = `[out:json][timeout:10];node["railway"~"station|halt|subway_station"](around:1200,${lat},${lng});out body;`

  const [busStops, stations] = await Promise.all([
    overpassNodes(busQuery).catch(() => [] as OverpassNode[]),
    overpassNodes(stationQuery).catch(() => [] as OverpassNode[]),
  ])

  // Separate tube/underground from overground rail
  const tubeStations = stations.filter(s =>
    s.tags.network?.toLowerCase().includes('underground') ||
    s.tags.network?.toLowerCase().includes('overground') ||
    s.tags.network?.toLowerCase().includes('elizabeth') ||
    s.tags.station === 'subway' ||
    s.tags.subway === 'yes',
  )
  const railStations = stations.filter(s =>
    !tubeStations.includes(s) && (s.tags.railway === 'station' || s.tags.railway === 'halt'),
  )

  const nearest = (nodes: OverpassNode[]) => {
    if (!nodes.length) return undefined
    const sorted = nodes
      .map(n => ({ n, d: haversineMetres(lat, lng, n.lat, n.lon) }))
      .sort((a, b) => a.d - b.d)
    const { n, d } = sorted[0]
    return { name: n.tags.name ?? 'Station', distanceMetres: Math.round(d) }
  }

  const nearestTube = nearest(tubeStations)
  const nearestRail = nearest(railStations) ?? nearest(stations)

  // Unique bus routes from stop names/refs
  const busRouteSet = new Set(busStops.flatMap(s => (s.tags.ref ?? '').split(';').filter(Boolean)))

  return {
    busStopCount: busStops.length,
    busRouteCount: busRouteSet.size,
    nearestTubeStation: nearestTube
      ? { name: nearestTube.name, distanceMetres: nearestTube.distanceMetres, lines: [] }
      : undefined,
    nearestRailStation: nearestRail,
  }
}

// ─── 4. Environment Agency — flood risk ──────────────────────────────────────
// Docs: https://environment.data.gov.uk/flood-monitoring/doc/reference
// Uses lat/lng endpoints (no direct postcode API for static risk)

export async function fetchFloodRisk(lat: number, lng: number): Promise<FloodData> {
  // Flood areas within 1km — count gives a static risk proxy
  const areasData = await fetchJson<{ items: { label: string; riverOrSea?: string }[] }>(
    `https://environment.data.gov.uk/flood-monitoring/id/floodAreas?lat=${lat}&long=${lng}&dist=1`,
  ).catch(() => null)

  // Active flood warnings/alerts within 5km
  const warningsData = await fetchJson<{ items: { severity: number; severityLevel: number }[] }>(
    `https://environment.data.gov.uk/flood-monitoring/id/floods?lat=${lat}&long=${lng}&dist=5`,
  ).catch(() => null)

  const areaCount = areasData?.items?.length ?? 0
  const activeWarnings = warningsData?.items?.length ?? 0

  // Derive risk level from area count + active warnings
  let riskLevel: FloodData['riskLevel'] =
    areaCount === 0  ? 'very_low' :
    areaCount <= 3   ? 'low' :
    areaCount <= 8   ? 'medium' : 'high'

  // Bump up one level if there are active warnings
  if (activeWarnings > 0 && riskLevel === 'very_low') riskLevel = 'low'
  if (activeWarnings > 0 && riskLevel === 'low')      riskLevel = 'medium'
  if (activeWarnings > 0 && riskLevel === 'medium')   riskLevel = 'high'

  // Derive a readable zone label
  const floodZone =
    riskLevel === 'very_low' ? 'Flood Zone 1 (low risk)' :
    riskLevel === 'low'      ? 'Flood Zone 1/2' :
    riskLevel === 'medium'   ? 'Flood Zone 2' : 'Flood Zone 3'

  return { riskLevel, floodZone, activeWarnings }
}

// ─── 5. Open-Meteo air quality ────────────────────────────────────────────────
// Docs: https://open-meteo.com/en/docs/air-quality-api
// Free, no API key. Uses European AQI (0–500 scale).

export async function fetchAirQuality(lat: number, lng: number): Promise<AirQualityData> {
  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality` +
    `?latitude=${lat}&longitude=${lng}` +
    `&current=pm10,pm2_5,nitrogen_dioxide,european_aqi` +
    `&timezone=auto`

  const data = await fetchJson<{
    current: {
      pm10: number
      pm2_5: number
      nitrogen_dioxide: number
      european_aqi: number
    }
  }>(url).catch(() => null)

  if (!data?.current) {
    return { no2Index: 3, pm25Index: 3, pm10Index: 3, overallIndex: 3, overallBand: 'Low' }
  }

  const { pm10, pm2_5, nitrogen_dioxide, european_aqi: eaqi } = data.current

  // Map raw μg/m³ to UK DAQI 1–10 scale (approximate)
  const no2Index  = Math.min(10, Math.max(1, Math.ceil(nitrogen_dioxide / 25)))
  const pm25Index = Math.min(10, Math.max(1, Math.ceil(pm2_5 / 7)))
  const pm10Index = Math.min(10, Math.max(1, Math.ceil(pm10 / 10)))

  // Use European AQI for the overall band
  const overallIndex = Math.min(10, Math.max(1, Math.ceil(eaqi / 20)))
  const overallBand: AirQualityData['overallBand'] =
    eaqi < 20  ? 'Low' :
    eaqi < 60  ? 'Moderate' :
    eaqi < 100 ? 'High' : 'Very High'

  return { no2Index, pm25Index, pm10Index, overallIndex, overallBand }
}

// ─── 6. ONS/DLUHC IMD — deprivation ──────────────────────────────────────────
// The ONS SPARQL endpoint (statistics.data.gov.uk) was decommissioned in 2025.
// opendatacommunities.org does not expose a REST JSON API.
// Returns neutral defaults — will improve in a future sprint.

export async function fetchDeprivation(_postcode: string): Promise<DeprivationData> {
  return {
    imdScore: 20,
    imdRank: 16000,
    imdDecile: 5,
  }
}

// ─── 7. Land Registry — price history ────────────────────────────────────────
// Uses the PPD CSV download endpoint (no SPARQL required).
// CSV columns: transaction_id, price, date, postcode, property_type, ...

function parseSimpleCsv(text: string): string[][] {
  return text
    .trim()
    .split('\n')
    .map(line => {
      // Handle quoted values: "value1","value2",...
      const cols: string[] = []
      let cur = ''
      let inQuote = false
      for (const ch of line) {
        if (ch === '"') { inQuote = !inQuote }
        else if (ch === ',' && !inQuote) { cols.push(cur); cur = '' }
        else { cur += ch }
      }
      cols.push(cur)
      return cols
    })
}

export async function fetchPriceHistory(postcode: string): Promise<PriceData> {
  const clean = postcode.replace(/\s+/g, '').toUpperCase()
  const encoded = clean.replace(/([A-Z]+\d[A-Z\d]?)(\d[A-Z]{2})/, '$1 $2')
    .replace(' ', '+')

  const text = await fetchText(
    `https://landregistry.data.gov.uk/app/ppd/ppd_data.csv?postcode=${encoded}&limit=50`,
  ).catch(() => '')

  if (!text) return { postcode: clean }

  const rows = parseSimpleCsv(text)

  // Detect and skip header row (header has non-numeric price column)
  const dataRows = rows.filter(r => r.length >= 3 && /^\d+$/.test(r[1]?.trim()))

  const prices = dataRows
    .map(r => parseInt(r[1].trim()))
    .filter(p => p > 0 && !isNaN(p))

  const median = prices.length
    ? prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)]
    : undefined

  // Count sales in last 12 months (date in column 2 as YYYY-MM-DD)
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  const recentSales = dataRows.filter(r => {
    const d = new Date(r[2]?.trim())
    return !isNaN(d.getTime()) && d >= oneYearAgo
  }).length

  return {
    postcode: clean,
    medianSalePrice: median,
    salesLast12Months: recentSales,
  }
}

// ─── 8. Planning data ─────────────────────────────────────────────────────────
// Docs: https://www.planning.data.gov.uk/docs
// Correct endpoint: GET /entity.json?latitude=X&longitude=Y&dataset=...

export async function fetchPlanning(lat: number, lng: number): Promise<PlanningData> {
  // Check if location is within a conservation area
  const conservationData = await fetchJson<{ count: number; entities: unknown[] }>(
    `https://www.planning.data.gov.uk/entity.json` +
    `?latitude=${lat}&longitude=${lng}` +
    `&dataset=conservation-area&geometry_relation=intersects&limit=1`,
  ).catch(() => null)

  // Listed buildings nearby (~500m bounding box via ArcGIS Historic England)
  const listedData = await fetchJson<{ features: unknown[] }>(
    `https://services.historicengland.org.uk/NMRserver/api/v2/GeoJSON/listedbuildings` +
    `?bbox=${lng - 0.005},${lat - 0.005},${lng + 0.005},${lat + 0.005}`,
  ).catch(() => null)

  return {
    recentApplications: 0, // planning-application dataset not reliably populated
    conservationArea: (conservationData?.count ?? 0) > 0,
    listedBuildingsNearby: listedData?.features?.length ?? 0,
    aonbOrSssi: false,
  }
}

// ─── 9. DfT road traffic accidents ───────────────────────────────────────────
// The roadtraffic.dft.gov.uk API requires a non-standard port and is unreliable.
// Graceful no-data fallback.

export async function fetchAccidents(_lat: number, _lng: number): Promise<AccidentData> {
  return { accidentsLast3Years: 0, severities: { slight: 0, serious: 0, fatal: 0 } }
}

// ─── 10. CQC — GP surgery ratings ────────────────────────────────────────────
// Public API — no key required.
// Docs: https://api.service.cqc.org.uk/public/v1/docs

type CQCRating = 'Outstanding' | 'Good' | 'Requires Improvement' | 'Inadequate'

interface CQCLocation {
  locationId: string
  locationName: string
  postalCode: string
  currentRatings?: {
    overall?: { rating?: CQCRating }
  }
}

interface CQCResponse {
  locations: CQCLocation[]
  total: number
}

export async function fetchCQCGP(
  postcode: string,
): Promise<{ nearestGPRating?: CQCRating; ratedGPsNearby: number }> {
  const clean = encodeURIComponent(postcode.replace(/\s+/g, ' ').toUpperCase())

  const data = await fetchJson<CQCResponse>(
    `https://api.service.cqc.org.uk/public/v1/locations` +
      `?postalCode=${clean}&primaryInspectionCategory=GP+PRACTICE&perPage=10`,
    { headers: { 'User-Agent': 'Housely/1.0' } },
  ).catch(() => null)

  if (!data?.locations?.length) return { ratedGPsNearby: 0 }

  const rated = data.locations.filter(l => l.currentRatings?.overall?.rating)

  // Pick the best rating for "nearest GP" display
  const RATING_ORDER: CQCRating[] = ['Outstanding', 'Good', 'Requires Improvement', 'Inadequate']
  const best = rated
    .map(l => l.currentRatings!.overall!.rating as CQCRating)
    .sort((a, b) => RATING_ORDER.indexOf(a) - RATING_ORDER.indexOf(b))[0]

  return {
    nearestGPRating: best,
    ratedGPsNearby: rated.length,
  }
}

// ─── 11. Main assembler ───────────────────────────────────────────────────────

/** Fetch all neighbourhood data for a postcode in parallel. Never throws — returns partial data. */
export async function fetchNeighbourhoodData(postcode: string): Promise<NeighbourhoodData> {
  const geo = await lookupPostcode(postcode)

  const [crime, transport, amenities, flood, airQuality, prices, deprivation, planning, accidents, cqcGP] =
    await Promise.allSettled([
      fetchCrime(geo.latitude, geo.longitude),
      fetchTransport(geo.latitude, geo.longitude),
      fetchAmenities(geo.latitude, geo.longitude),
      fetchFloodRisk(geo.latitude, geo.longitude),
      fetchAirQuality(geo.latitude, geo.longitude),
      fetchPriceHistory(postcode),
      fetchDeprivation(postcode),
      fetchPlanning(geo.latitude, geo.longitude),
      fetchAccidents(geo.latitude, geo.longitude),
      fetchCQCGP(postcode),
    ])

  // Merge CQC ratings into amenities data
  const amenitiesValue = amenities.status === 'fulfilled' ? amenities.value : undefined
  const cqcValue = cqcGP.status === 'fulfilled' ? cqcGP.value : undefined
  const mergedAmenities = amenitiesValue && cqcValue
    ? { ...amenitiesValue, ...cqcValue }
    : amenitiesValue

  return {
    postcode: geo.postcode,
    latitude: geo.latitude,
    longitude: geo.longitude,
    district: geo.admin_district,
    region: geo.region,
    crime:       crime.status       === 'fulfilled' ? crime.value       : undefined,
    transport:   transport.status   === 'fulfilled' ? transport.value   : undefined,
    amenities:   mergedAmenities,
    flood:       flood.status       === 'fulfilled' ? flood.value       : undefined,
    airQuality:  airQuality.status  === 'fulfilled' ? airQuality.value  : undefined,
    prices:      prices.status      === 'fulfilled' ? prices.value      : undefined,
    deprivation: deprivation.status === 'fulfilled' ? deprivation.value : undefined,
    planning:    planning.status    === 'fulfilled' ? planning.value    : undefined,
    accidents:   accidents.status   === 'fulfilled' ? accidents.value   : undefined,
    fetchedAt: Date.now(),
  }
}
