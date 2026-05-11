# backyards.run — Project Memory

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
- **Font:** Inter (Google Fonts), weights 300–800
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
// Go One More Ultra 2026
{ id: "G1M_2026", label: "Go One More 2026", eventId: "390956",
  host: "my4", apiKey: "f545f563e8d28831fb09508cd63b1365",
  listname: "Lists|Detail List", page: "details1", startHour: 12 }

// Big's Backyard Ultra 2025
{ id: "Bigs_2025", label: "Big's Backyard Ultra 2025", eventId: "364272",
  host: "my2", apiKey: "e35ba6322adb153e157d76e69096f692",
  listname: "Result Lists|Lap Details", page: "results", startHour: 7,
  extraParams: "&contest=0&r=all&l=0" }
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
