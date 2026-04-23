# Housely — Task Board

## In Progress
<!-- Tag tasks here with [ACCOUNT-X] when you start them -->

## Todo
- [ ] lib/types.ts — all TypeScript interfaces
- [ ] lib/storage.ts — localStorage helpers
- [ ] lib/uk-apis.ts — postcodes.io wrapper
- [ ] lib/uk-apis.ts — police.uk crime wrapper
- [ ] lib/uk-apis.ts — Overpass amenities wrapper
- [ ] lib/uk-apis.ts — Environment Agency flood risk + live flood warnings
- [ ] lib/uk-apis.ts — DfT road traffic accidents wrapper
- [ ] lib/uk-apis.ts — planning.data.gov.uk (planning apps + conservation areas)
- [ ] lib/uk-apis.ts — Historic England NHLE (listed buildings)
- [ ] lib/uk-apis.ts — ONS IMD deprivation score by postcode
- [ ] lib/uk-apis.ts — DEFRA UK-AIR air quality by lat/lng
- [ ] lib/uk-apis.ts — Land Registry price history
- [ ] lib/uk-apis.ts — CQC GP surgery ratings (requires free registration)
- [ ] lib/uk-apis.ts — BODS bus stops/routes (requires free API key)
- [ ] lib/prompts.ts — system prompt + report prompt builder
- [ ] /api/analyse route — data assembly + Claude streaming
- [ ] Profile questionnaire UI (5 steps, /profile)
- [ ] Property search page (/search)
- [ ] /report/[id] page — streaming render
- [ ] SuitabilityScore component — animated score ring
- [ ] ScoreBreakdown component — category bars
- [ ] /saved page — saved reports list
- [ ] Landing page — hero + how it works
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
