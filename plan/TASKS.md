# Housely — Task Board

## In Progress
<!-- Tag tasks here with [ACCOUNT-X] when you start them -->

## Todo
- [x] lib/types.ts — all TypeScript interfaces [ACCOUNT-1]
- [x] lib/storage.ts — localStorage helpers [ACCOUNT-1]
- [x] lib/uk-apis.ts — postcodes.io, crime, Overpass amenities, flood, air quality, IMD, Land Registry, planning, accidents — all in one file [ACCOUNT-1]
- [x] lib/uk-apis.ts — CQC GP surgery ratings (requires free registration) [ACCOUNT-2] — fetchCQCGP() using CQC Public API (no key); merged into AmenityData; factors into gp_health score
- [ ] lib/uk-apis.ts — BODS bus stops/routes (requires free API key)
- [x] lib/prompts.ts — system prompt + report prompt builder [ACCOUNT-1]
- [x] /api/analyse route — data assembly + Claude streaming [ACCOUNT-2] — NDJSON stream: data header + Claude chunks; uses streamText via @ai-sdk/anthropic
- [x] lib/interaction-log.ts — event tracker: logSave, logDismiss, logView, logLayerToggle, logCompare, logFeedback [ACCOUNT-1]
- [ ] lib/agent.ts — scout agent: expands target areas into candidate postcodes, scores each via /api/analyse, returns ranked matches
- [x] lib/preferences.ts — applyInference, getWeightedScore, explainScore, diffWeights, scoreVerdict [ACCOUNT-1]
- [ ] /api/agent/run route — runs scout agent for a given IdealHomeProfile, streams progress + results
- [x] /api/learn route — accepts last N InteractionEvents + current PreferenceVector; Claude analyses for weight mismatches; returns PreferenceInference (proposed weight changes + plain-English explanation) [ACCOUNT-2] — uses generateObject + Haiku; applies + normalises weight deltas; min 5 events guard
- [x] Profile UI (/profile) — desktop: single page, two-column (lifestyle left, ideal home right) — NOT a step wizard [ACCOUNT-1]
- [ ] Property search page (/search)
- [ ] /report/[id] page — desktop two-panel: score + breakdown + streaming AI narrative left, interactive Leaflet map right with toggleable layers (amenities, crime, flood, transport); log view event on mount; log layer toggles
- [ ] /report/[id] page — "Why this score?" section: per-category bar showing weight × raw score contribution; shows if weights have been updated ("recalculated after Scout learned from your behaviour")
- [ ] SuitabilityScore component — animated score ring
- [ ] ScoreBreakdown component — category bars with weight contribution overlay
- [ ] /matches page — desktop two-panel: ranked list + filters + tabs (New/All/Saved) left; pin map right coloured by score; tooltip on hover; /saved folds into this as a tab; log dismiss/save events per card
- [ ] PreferencePanel component — drawer/sidebar showing: current weight bars, inference history ("Scout noticed…"), accept/reject proposed weight changes, manual override sliders
- [ ] "Scout learned" notification — toast/banner when a new PreferenceInference is ready; links to PreferencePanel to review + accept
- [ ] Landing page — full-bleed dark hero with inline postcode search; Scout agent CTA banner below fold; desktop layout (1200px+)
- [ ] Vercel deploy + env vars
- [ ] End-to-end test with 3 UK postcodes
- [ ] DEPLOYMENT (do last):
    1. Add `basePath: "/projects/housely"` to `next.config.ts`
    2. Run `vercel deploy` → note the deployment URL (e.g. `housely-xxx.vercel.app`)
    3. In Vercel project settings → Domains → add `housely-arthur3.vercel.app` (or keep default)
    4. In Cloudflare Dashboard → Workers & Pages → Create Worker → paste proxy script below
    5. Add Worker Route: `arthur3.com/projects/housely*` → that Worker
    6. Worker intercepts BEFORE Astro's [slug].astro — no changes needed to arthur3.com repo

    Cloudflare Worker script:
    ```js
    export default {
      async fetch(request) {
        const url = new URL(request.url);
        url.hostname = "housely-xxx.vercel.app"; // replace with actual Vercel URL
        return fetch(new Request(url.toString(), request));
      },
    };
    ```

## Done
- [x] Project scaffold (Next.js 15 + TypeScript + Tailwind)
- [x] CLAUDE.md — session protocol + context
- [x] plan/TASKS.md — this file
- [x] GitHub repo created (Dr-Snatch/housely)
- [x] Profile UI (/profile) — two-column desktop layout, localStorage persist, mustHaves field added [ACCOUNT-1]
