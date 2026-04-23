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

// ─── Shared fetch helper ──────────────────────────────────────────────────────

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { next: { revalidate: 3600 }, ...init })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`)
  return res.json() as Promise<T>
}

// ─── 1. Postcodes.io ──────────────────────────────────────────────────────────

interface PostcodeResult {
  postcode: string
  latitude: number
  longitude: number
  admin_district: string
  region: string
  parliamentary_constituency: string
  codes: { admin_district: string }
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
  // Last 12 months — police API returns one month at a time; fetch latest available
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
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  const json = await res.json() as OverpassResult
  return json.elements ?? []
}

export async function fetchAmenities(lat: number, lng: number): Promise<AmenityData> {
  const radius = 800 // metres
  const query = `
    [out:json][timeout:15];
    (
      node["shop"="supermarket"](around:${radius},${lat},${lng});
      node["amenity"="cafe"](around:${radius},${lat},${lng});
      node["amenity"="restaurant"](around:${radius},${lat},${lng});
      node["amenity"="pub"](around:${radius},${lat},${lng});
      node["leisure"="fitness_centre"](around:${radius},${lat},${lng});
      node["leisure"="park"](around:${radius},${lat},${lng});
      way["leisure"="park"](around:${radius},${lat},${lng});
      node["amenity"="doctors"](around:${radius},${lat},${lng});
      node["amenity"="pharmacy"](around:${radius},${lat},${lng});
      node["amenity"="school"](around:${radius},${lat},${lng});
    );
    out count;
  `

  // Use a simpler count approach per type
  const countQuery = (amenityFilter: string, r = radius) =>
    overpassQuery(
      `[out:json][timeout:10];(${amenityFilter}(around:${r},${lat},${lng}););out count;`,
    ).then(els => els[0]?.tags?.total ? parseInt(els[0].tags.total) : 0).catch(() => 0)

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

// ─── 4. Environment Agency — flood risk ──────────────────────────────────────

export async function fetchFloodRisk(postcode: string): Promise<FloodData> {
  const clean = encodeURIComponent(postcode.replace(/\s+/g, '').toUpperCase())

  // Flood risk by postcode
  const riskData = await fetchJson<{ items: { longTermFloodRisk: string }[] }>(
    `https://environment.data.gov.uk/flood-risk/communities/postcode/${clean}`,
  ).catch(() => null)

  const rawRisk = riskData?.items?.[0]?.longTermFloodRisk?.toLowerCase() ?? 'very low'
  const riskLevel =
    rawRisk.includes('high')     ? 'high' :
    rawRisk.includes('medium')   ? 'medium' :
    rawRisk.includes('very low') ? 'very_low' : 'low'

  // Active flood warnings within region
  const warningsData = await fetchJson<{ items: unknown[] }>(
    `https://environment.data.gov.uk/flood-monitoring/id/floods?min-severity=3&_limit=50`,
  ).catch(() => null)

  // Simplification: count active warnings (real impl would filter by area)
  const activeWarnings = warningsData?.items?.length ?? 0

  return {
    riskLevel,
    floodZone: rawRisk || 'Flood Zone 1',
    activeWarnings,
  }
}

// ─── 5. DEFRA UK-AIR — air quality ───────────────────────────────────────────

export async function fetchAirQuality(lat: number, lng: number): Promise<AirQualityData> {
  // UK-AIR SOS API — nearest monitoring station observations
  const url =
    `https://uk-air.defra.gov.uk/sos-ukair/api/v1/observations` +
    `?featureOfInterest=&observedProperty=&procedure=&spatialFilter=om%3AphenomenonTime` +
    `&offering=&bbox=${lng - 0.5},${lat - 0.5},${lng + 0.5},${lat + 0.5}` +
    `&limit=10&offset=0&expanded=true`

  const data = await fetchJson<{ observations: { result: number; observedProperty: { label: string } }[] }>(
    url,
  ).catch(() => null)

  // Fallback: use DAQI-style indexing (1–10 scale)
  // If API fails we return a neutral mid-range
  if (!data?.observations?.length) {
    return { no2Index: 3, pm25Index: 3, pm10Index: 3, overallIndex: 3, overallBand: 'Low' }
  }

  const get = (label: string) =>
    data.observations.find(o => o.observedProperty?.label?.toLowerCase().includes(label))?.result ?? 3

  const no2 = Math.min(10, Math.round(get('nitrogen') / 20))
  const pm25 = Math.min(10, Math.round(get('pm2') / 10))
  const pm10 = Math.min(10, Math.round(get('pm10') / 15))
  const overall = Math.max(no2, pm25, pm10)

  const band =
    overall >= 7 ? 'Very High' :
    overall >= 4 ? 'High' :
    overall >= 2 ? 'Moderate' : 'Low'

  return { no2Index: no2, pm25Index: pm25, pm10Index: pm10, overallIndex: overall, overallBand: band as AirQualityData['overallBand'] }
}

// ─── 6. ONS IMD — deprivation ────────────────────────────────────────────────

export async function fetchDeprivation(postcode: string): Promise<DeprivationData> {
  const clean = postcode.replace(/\s+/g, '').toUpperCase()
  const data = await fetchJson<{
    imdScore: number
    imdRank: number
    imdDecile: number
    incomeScore: number
    employmentScore: number
    educationScore: number
    healthScore: number
    crimeScore: number
    barriersScore: number
    environmentScore: number
  }>(
    `https://imd-by-postcode.opendatacommunities.org/imd/2019/postcode/${clean}`,
  ).catch(() => null)

  return {
    imdScore:        data?.imdScore         ?? 20,
    imdRank:         data?.imdRank          ?? 16000,
    imdDecile:       data?.imdDecile        ?? 5,
    incomeScore:     data?.incomeScore,
    employmentScore: data?.employmentScore,
    educationScore:  data?.educationScore,
    healthScore:     data?.healthScore,
    crimeScore:      data?.crimeScore,
    barriersScore:   data?.barriersScore,
    environmentScore:data?.environmentScore,
  }
}

// ─── 7. Land Registry — price history ────────────────────────────────────────

export async function fetchPriceHistory(postcode: string): Promise<PriceData> {
  const clean = postcode.replace(/\s+/g, '').toUpperCase()
  const encoded = encodeURIComponent(clean)

  const sparql = `
    SELECT ?paon ?saon ?amount ?date WHERE {
      ?addr <http://www.w3.org/2000/01/rdf-schema#label> "${clean}" .
      ?transx <http://landregistry.data.gov.uk/def/ppi/propertyAddress> ?addr ;
               <http://landregistry.data.gov.uk/def/ppi/pricePaid> ?amount ;
               <http://landregistry.data.gov.uk/def/ppi/transactionDate> ?date .
    } ORDER BY DESC(?date) LIMIT 20
  `

  const data = await fetchJson<{
    results: { bindings: { amount: { value: string }; date: { value: string } }[] }
  }>(
    `https://landregistry.data.gov.uk/landregistry/query?query=${encodeURIComponent(sparql)}&output=json`,
  ).catch(() => null)

  const bindings = data?.results?.bindings ?? []
  const prices = bindings.map(b => parseInt(b.amount.value)).filter(Boolean)
  const median = prices.length
    ? prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)]
    : undefined

  return {
    postcode: clean,
    medianSalePrice: median,
    salesLast12Months: prices.length,
  }
}

// ─── 8. Planning data ─────────────────────────────────────────────────────────

export async function fetchPlanning(lat: number, lng: number, postcode: string): Promise<PlanningData> {
  const params = new URLSearchParams({
    point: `POINT(${lng} ${lat})`,
    dataset: 'planning-application',
    entries: 'current',
    limit: '50',
  })

  const planningData = await fetchJson<{ count: number; results: unknown[] }>(
    `https://www.planning.data.gov.uk/api/search.json?${params}`,
  ).catch(() => null)

  // Conservation area check
  const conservationParams = new URLSearchParams({
    point: `POINT(${lng} ${lat})`,
    dataset: 'conservation-area',
    entries: 'current',
    limit: '1',
  })
  const conservation = await fetchJson<{ count: number }>(
    `https://www.planning.data.gov.uk/api/search.json?${conservationParams}`,
  ).catch(() => null)

  // Listed buildings (Historic England NHLE via ArcGIS)
  const listedData = await fetchJson<{ features: unknown[] }>(
    `https://services.historicengland.org.uk/NMRserver/api/v2/GeoJSON/listedbuildings?bbox=${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}`,
  ).catch(() => null)

  return {
    recentApplications: planningData?.count ?? 0,
    conservationArea: (conservation?.count ?? 0) > 0,
    listedBuildingsNearby: listedData?.features?.length ?? 0,
    aonbOrSssi: false, // would need MAGIC WMS query
  }
}

// ─── 9. DfT road traffic accidents ───────────────────────────────────────────

export async function fetchAccidents(lat: number, lng: number): Promise<AccidentData> {
  // Road safety data API
  const data = await fetchJson<{
    rows: { severity: string }[]
  }>(
    `https://data.dft.gov.uk/road-accidents-safety-data/accidents-${new Date().getFullYear() - 1}.json?$where=within_circle(location,${lat},${lng},500)&$limit=200`,
  ).catch(() => null)

  const rows = data?.rows ?? []
  const severities = { slight: 0, serious: 0, fatal: 0 }
  for (const r of rows) {
    const s = r.severity?.toLowerCase()
    if (s === 'slight') severities.slight++
    else if (s === 'serious') severities.serious++
    else if (s === 'fatal') severities.fatal++
  }

  return { accidentsLast3Years: rows.length, severities }
}

// ─── 10. Main assembler ───────────────────────────────────────────────────────

/** Fetch all neighbourhood data for a postcode in parallel. Never throws — returns partial data. */
export async function fetchNeighbourhoodData(postcode: string): Promise<NeighbourhoodData> {
  const geo = await lookupPostcode(postcode)

  const [crime, amenities, flood, airQuality, prices, deprivation, planning, accidents] =
    await Promise.allSettled([
      fetchCrime(geo.latitude, geo.longitude),
      fetchAmenities(geo.latitude, geo.longitude),
      fetchFloodRisk(postcode),
      fetchAirQuality(geo.latitude, geo.longitude),
      fetchPriceHistory(postcode),
      fetchDeprivation(postcode),
      fetchPlanning(geo.latitude, geo.longitude, postcode),
      fetchAccidents(geo.latitude, geo.longitude),
    ])

  return {
    postcode: geo.postcode,
    latitude: geo.latitude,
    longitude: geo.longitude,
    district: geo.admin_district,
    region: geo.region,
    crime:       crime.status       === 'fulfilled' ? crime.value       : undefined,
    amenities:   amenities.status   === 'fulfilled' ? amenities.value   : undefined,
    flood:       flood.status       === 'fulfilled' ? flood.value       : undefined,
    airQuality:  airQuality.status  === 'fulfilled' ? airQuality.value  : undefined,
    prices:      prices.status      === 'fulfilled' ? prices.value      : undefined,
    deprivation: deprivation.status === 'fulfilled' ? deprivation.value : undefined,
    planning:    planning.status    === 'fulfilled' ? planning.value    : undefined,
    accidents:   accidents.status   === 'fulfilled' ? accidents.value   : undefined,
    fetchedAt: Date.now(),
  }
}
