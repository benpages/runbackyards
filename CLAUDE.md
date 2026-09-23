# backyards.run — Project Memory

## Race pages: the template and the playbook (Sep 2026)

Every race results page is built on one template. Sydney Sept 2026 is the reference page.
Older race pages (Last Soul, Big's, Legends, G1M, Sydney April) still use the old layout
until they are migrated one at a time.

**Pieces**
- `src/_data/raceData/<slug>.json`: the race's data, one standard shape for every race:
  `{ meta, runners: [{ place, bib, name, sex, nation, loops, time, laps: [seconds…] }] }`.
  loops = loops COMPLETED. laps[i] = seconds for loop i + 1. sex F / M / X (X is left out of both groups).
- `lib/race.js`: the race model. Every number the page prints is worked out here (hero,
  standings, rest banked, dropouts, milestones, day vs night, lap times). `lib/gender.js` does women and men.
- `src/_includes/race-page.njk`: the page. Fixed section order, most important first:
  hero (last man / last woman standing: name, loops, distance; then a race facts line) →
  contents chips → Results (table only, no commentary) → How the race ended → When runners
  dropped out → Women and men → Day vs night → Lap times → How a backyard ultra works.
  Sections without data do not render.
- `src/race-laps.njk`: writes `/races/<slug>/laps.json` for every file in raceData (the charts read it).
- `src/js/backyard-charts.js`: charts, results search/filter, sticky contents chips.

**Section format (Smart Brevity):** standard H2 (same on every race, written for search) →
one bold takeaway line (race-specific, front matter `race.takeaways`: ending, dropouts, women,
daynight, laptimes) → chart → "By the numbers" (worked out from data) → a little commentary
(page blocks with the same names). No commentary that repeats a table or the hero.

**Adding a race, in order**
1. Fetch: write `scripts/fetch-<slug>.mjs` from `scripts/fetch-sydney-2026-sept.mjs`. It must write
   the standard shape, take `place` from the official results order, and print PASS/FAIL checks
   (split counts match results, every runner has a place). Ask Ben to run it and paste the output.
2. Check the data: loops completed (not started), duplicate names, unnamed chips, gender counts
   against the results site, and re-fetch before publishing (results stay "live" after a race).
3. Page: `src/races/<slug>.njk` with `layout: base.njk`, `{% extends "race-page.njk" %}` and
   `race:` front matter (slug, name, year, edition, date, dateLabel, location, startHour, loopKm,
   loopLabel, unit, decimals, timer, timerUrl, takeaways). Ask Ben for the timer.
4. Write the takeaways and commentary blocks: facts only, never causes, grade 4 reading level,
   no em dashes. Use numbers from the rendered "By the numbers" where possible.
5. Verify: build, check every number on the whole page against the data (both sides of every
   loop boundary), render at 1440px and 390px, regression-check the other race pages.
6. Add the race to the Race Results menu in `src/_includes/nav.njk`.

## What this is
A static site for backyard ultra race analysis at backyards.run. Per-race pages with live lap pacing charts + DNF distribution charts, plus a standalone multi-race pace comparison tool.

## Tech stack
- **Eleventy 3.x** (SSG) — `npm start` to dev, `npm run build` to build
- **Netlify** for hosting — auto-deploys from GitHub, pretty URLs (strips .html)
- **Chart.js 4.4.1** + chartjs-plugin-annotation (night bands) + chartjs-plugin-datalabels (DNF bar counts)
- **raceresult.com Simple API** — publicly accessible JSON, no auth needed
- Live data fetched client-side on page load

## Eleventy structure
```
src/
  _includes/
    base.njk          — shared HTML shell (head, nav, footer)
    nav.njk           — site nav with SVG logo mark + Races dropdown
    footer.njk        — shared footer
    race-analysis-charts.njk — shared chart HTML for race pages
    chart-scripts.njk — shared Chart.js script loader
  _data/
    site.json         — site-wide config (url, name)
  css/
    main.css          — single consolidated stylesheet
  js/
    backyard-charts.js — all chart logic
  races/
    bigs-2025.njk
    g1m-2026.njk
  pace-tool.njk
  index.njk
public/               — Eleventy output (gitignored)
```

## Brand / visual theme
- **Background:** `#EDEAE4` (warm cream)
- **Cards / inputs / pills:** `#F7F4EF` background, `#E8E4DE` border
- **Nav:** `#141414` dark background
- **Accent / winner:** `#C0392B` red
- **Display font:** Barlow Condensed (Google Fonts), weights 700–900, italic — used for hero headlines and race card titles via `.display` class (`font-style: italic; font-weight: 900; text-transform: uppercase`)
- **Body font:** Inter (Google Fonts), weights 300–800
- **Logo mark:** SVG arc on 20×20 viewBox, center (10,10), r=6.5, stroke-width=4, stroke-linecap=butt. Gap spans ~40°–70° from 12 o'clock (upper-right, ~1–2 o'clock). Path: `<path d="M16.11 7.78 A6.5 6.5 0 1 1 14.18 5.02" stroke="white" stroke-width="4" stroke-linecap="butt"/>` — 330° arc, flat ends at the gap.
- **Wordmark:** `<span class="brand-b">Backyards</span><span class="brand-d">.run</span>` — bold + light weight

## raceresult.com API
Two key formats in use:

**G1M format** — key separator ` /// ` (spaces around slashes):
- Key: `"#N_LastName, FirstName /// N Laps /// Total Time: HH:MM:SS"`
- Row: `[col, bib, flag, "LapN", cp, finishTime, rest]` — finishTime at index 5
- Names come as "Last, First" — stored internally as "LastName FirstName"

**Big's format** — key separator `///` (no spaces):
- Key: `"#N_bib///FirstName LastName///NLaps"`
- Row: `[flag, bib, lapNum, cumulativeTime, finishTime, rest]` — finishTime at index 4
- Names come as "First Last" — reversed to "LastName FirstName" for consistency

Parser auto-detects format by `key.includes(" /// ")`.

## Race configs
```js
// Big's Backyard Ultra 2023 — October 2023, Bell Buckle, TN
// r=pid&pid=5 is a single-runner preview; use r=all&l=0 for full pull.
{ id: "Bigs_2023", eventId: "266852", host: "my2",
  apiKey: "c32693b41c83792c4af8a8bcf61c4aa0",
  listname: "Result Lists|Lap Details", page: "F6E602",
  startHour: 7, extraParams: "&r=all&l=0" }

// Legends Backyard Ultra 2025 — April 2025, Retie, Belgium
// "Online|Ronden Details" with r=all returns all athletes' lap splits. r=pid&pid=N fetches one athlete.
{ id: "Legends_2025", eventId: "337369", host: "my2",
  apiKey: "07708f8146716bea0992945f49ba2ead",
  listname: "Online|Ronden Details", page: "4A0932",
  startHour: 10, extraParams: "&r=all&l=0" }

// Big's Backyard Ultra 2025 — October 2025, Bell Buckle, TN
{ id: "Bigs_2025", label: "Big's Backyard Ultra 2025", eventId: "364272",
  host: "my2", apiKey: "e35ba6322adb153e157d76e69096f692",
  listname: "Result Lists|Lap Details", page: "results", startHour: 7,
  extraParams: "&contest=0&r=all&l=0" }

// Legends Backyard Ultra 2026 — April 25, 2026, Retie, Belgium. Winner: Łukasz Wróbel, 114 loops.
// "Result Lists|Lap Details" with r=all returns all athletes' lap splits. r=pid&pid=N fetches one athlete.
{ id: "Legends_2026", eventId: "387219", host: "my1",
  apiKey: "a15c39a3af787ed11ce45bff82407380",
  listname: "Result Lists|Lap Details", page: "details0",
  startHour: 10, extraParams: "&r=all&l=0" }

// Go One More Ultra 2026 — April 10, 2026, Liberty Hill, TX
{ id: "G1M_2026", label: "Go One More 2026", eventId: "390956",
  host: "my4", apiKey: "f545f563e8d28831fb09508cd63b1365",
  listname: "Lists|Detail List", page: "details1", startHour: 12 }

// Sydney Backyard Ultra 2026 — April 18, 2026, St Ives Showground, Australia
// Uses G1M format ( /// separators, details1 page). Winner: Tim Kacprzak, 75 loops.
{ id: "Sydney_2026", label: "Sydney Backyard Ultra 2026", eventId: "392622",
  host: "my2", apiKey: "0a739b84b363738d6c6639ee30acd51e",
  listname: "Laps", page: "details1", startHour: 8 }
```

## Key chart details
- Night bands: opt-in via `startHour` in race config; annotation boxes from `nightBands()` helper
- Dynamic x-axis: max adjusts to visible runners' lap counts
- Runner pills: `name.split(" ")[0]` = last name (works for both API formats after normalization)
- LEGEND_INITIAL = 15, "show more" button reveals rest
- DNF chart: winner bar = `#C0392B`, others = `rgba(26,26,26,0.75)`
- Per-chart plugin registration for datalabels (not global)

## Future ideas
- Home/hub page (index.njk is currently just a placeholder)
- Blog section
- Cross-race DNF comparison tool
- Add more races as Eleventy pages (just add a new .njk in src/races/)
