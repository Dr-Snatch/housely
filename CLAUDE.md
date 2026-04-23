@AGENTS.md

# Housely — Claude Code Context

## What this is
Housely is a UK property app built for a 48h hackathon.
A user fills in a lifestyle profile, enters a UK property address, and an
AI agent (Claude) pulls real neighbourhood data and generates a personalised
suitability score and report.

## Stack
- Next.js 15 App Router + TypeScript
- Tailwind CSS + shadcn/ui
- Anthropic SDK (claude-sonnet-4-6) for the AI agent
- Vercel AI SDK for streaming
- localStorage for all state (no auth, no database)
- Vercel for deployment

## Key files
- `lib/types.ts` — all TypeScript interfaces (UserProfile, SuitabilityReport, etc.)
- `lib/uk-apis.ts` — wrappers for postcodes.io, police.uk, Overpass, Flood API
- `lib/prompts.ts` — Claude system prompt and report prompt builder
- `lib/storage.ts` — localStorage helpers for profile and saved reports
- `app/api/analyse/route.ts` — main endpoint: fetches UK data, streams Claude report

## UK data APIs — Tier 1 (no auth, build these first)
- Postcodes: https://postcodes.io
- Crime: https://data.police.uk/api
- Amenities: OpenStreetMap Overpass API
- Flood risk: https://environment.data.gov.uk/flood-risk-postcode-tool
- Flood warnings (live): https://environment.data.gov.uk/flood-monitoring/
- Road traffic accidents: https://roadtraffic.dft.gov.uk/api/
- Planning applications + conservation areas: https://www.planning.data.gov.uk/docs
- Listed buildings: Historic England NHLE (ArcGIS REST, lat/lng spatial)
- Deprivation (IMD): https://imd-by-postcode.opendatacommunities.org/
- Air quality: DEFRA UK-AIR SOS API (OGC REST, lat/lng)
- Land Registry price history: https://landregistry.data.gov.uk/

## UK data APIs — Tier 2 (free registration required)
- EPC: https://epc.opendatacommunities.org
- GP ratings: https://api.service.cqc.org.uk
- Bus stops/routes: https://www.bus-data.dft.gov.uk/ (free API key)
- School locations: https://www.get-information-schools.service.gov.uk/

## Scoring logic
Claude weights data sources against the user's declared priorities. See plan/TASKS.md for the priority → data source mapping.

## Env vars needed
```
ANTHROPIC_API_KEY=    # required
EPC_API_KEY=          # optional, for energy cert data
```

## Pages
- `/` → landing page
- `/profile` → lifestyle questionnaire (5 steps, saves to localStorage)
- `/search` → enter property address/postcode
- `/report/[id]` → streaming AI suitability report
- `/saved` → past reports list

## SESSION START PROTOCOL (follow every time, every account)
1. `git pull`
2. Read this file (CLAUDE.md)
3. Read `plan/TASKS.md` — find the first untagged item in Todo
4. Tag it with your account number: `[ACCOUNT-1]`, `[ACCOUNT-2]`, or `[ACCOUNT-3]`
5. Commit TASKS.md: `git commit -m "claim: [task name]"`
6. Then start building

## SESSION END PROTOCOL (follow every time, every account)
1. Commit all work with a descriptive message
2. In `plan/TASKS.md`: move your task to Done, add a one-line note on status/gotchas
3. `git push`

## File ownership zones (default — cross over when needed)
- Account 1: `/app/*/page.tsx`, `/components/**` (UI & pages)
- Account 2: `/app/api/**`, `/lib/uk-apis.ts` (data & APIs)
- Account 3: `/lib/prompts.ts`, `/lib/types.ts`, Claude integration (AI agent)

## Rules
- British English throughout (flat not apartment, postcode not zip, etc.)
- Keep scope tight — no auth, no database, localStorage only
- Always check `lib/types.ts` before creating new interfaces
- Streaming is via Vercel AI SDK `streamText` — see `app/api/analyse/route.ts` for pattern
- Mobile-first Tailwind — most house hunters browse on phone
- Never start a task already tagged in `plan/TASKS.md` — pick the next untagged one
