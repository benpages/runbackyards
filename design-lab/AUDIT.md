# Phase 0 audit (Sep 23, 2026)

Screenshots: `design-lab/audit/` (home, race, article, pace tool, race finder at 1440 and 390).
Site built with `npx @11ty/eleventy --output=<scratch>` so `public/` was never touched.

## Mockup source

Sydney's Backyard Ultra, September 2026. CLAUDE.md names it the reference page for the new
race template (`race-page.njk` + `lib/race.js`), so every race will end up with this structure.
Last Soul and Big's still use the old layout that is being migrated away.

## Templates

- Shell: `base.njk` (head, Google Fonts, goatcounter), `nav.njk` (logo, 2 dropdowns, 2 links, red CTA), `footer.njk`, `race-credit.njk`
- Race: `race-page.njk` (new template), `race-analysis-charts.njk` (old template), `chart-scripts.njk`, `race-laps.njk` (writes laps.json)
- Races: `sydney-2026-sept` (new); `last-soul-2026`, `bigs-2025`, `legends-2025`, `g1m-2026`, `sydney-2026` (old) + two `-laps` data pages
- Pages: `index`, `pace-tool`, `backyard-ultra-finder`, `races-near-you`, `records`, `backyard-ultra-crew`, `list-your-event`, `feedback`
- Learn: `learn/index`, `what-is-backyard-ultra`, `crewing-tips`, `pacing-strategy` (1,292 lines, has its own chart components), `backyard-ultra-training`
- Includes: `page-newsletter-form.njk`

## main.css

3,357 lines, no `:root` tokens. Every color is hard-coded. 67 `border-radius`, 55 `letter-spacing`,
46 `text-transform: uppercase`. Section-per-page blocks (homepage, tips, learn, records, finder,
list event, pacing analysis, crew, forms) with their own versions of cards, heroes and tables.

## What the charts need (backyard-charts.js)

- Colors are hard-coded in JS, not read from CSS: 15-color runner palette (reds, blues, greens,
  purples, ochre), winner red `#C0392B`, women red / men near-black, ticks `#999`, grid
  `rgba(0,0,0,.06)`, night bands `rgba(20,30,90,.07)` with blue-grey labels, DNF bars `rgba(26,26,26,.75)`.
  A redesign has to pass a palette into JS (read CSS custom properties at init is the clean way).
- Fonts: Chart.js default family (Helvetica/Arial) except the winner label (Inter). Needs `Chart.defaults.font.family`.
- Containers: height comes from CSS (`.chart-wrap`, `.dnf-chart-wrap`, `maintainAspectRatio: false`).
  Legend pills (`.leg-item`, `.leg-swatch`, `.leg-name`, `.show-more-btn`), `.unit-toggle`, `.qbtn`,
  `.chart-keys`, standings search and filter, sticky `.race-toc` chips with `.is-active`.

## AI-default patterns in the current design

1. Uppercase letter-spaced red eyebrow above every heading ("BACKYARD ULTRA", "RACES", "BY THE NUMBERS", "LAST WOMAN STANDING").
2. Stat cards: big number over a tiny grey uppercase label (hero "66 / LOOPS", homepage "4.167 / MILES PER LOOP", pace tool 4-card stat row).
3. Three-column feature cards with eyebrow, title, blurb and a lone arrow.
4. Rounded corners and soft card backgrounds on everything: race cards, chart cards, pills, toggles, standout box.
5. Pill chips everywhere: contents nav, toggles, runner legend, "Show all" buttons.
6. Italic condensed uppercase display type on every heading, so nothing is louder than anything else.
7. One accent red doing every job: winner, link, eyebrow, CTA, women's line, active toggle. Color has no meaning left.
8. Dark hero, then cream body, then dark signup band: the default SaaS landing rhythm.
9. Identical section rhythm on the race page: H2, bold line, card with chart, red label, bullets, prose, rule. Seven times.
10. Charts use library defaults: gridlines on both axes, rainbow runner palette, blue-grey night bands that fight the red, dense tick labels.
11. Hero headline split across colors ("EVERY LOOP / TELLS A / STORY.") with a stats strip underneath.

## Mobile (390px)

- Nav wraps to three rows with the breadcrumb; takes ~120px before content.
- Race hero is ~630px tall before the first chip. The winner is visible, but the photo-led Instagram feel is absent.
- Standings table drops the distance column and fits. Chart cards shrink the canvas; the lap-time legend becomes a wall of pills.
- No race photography anywhere on race pages.

## Photos

26 photos in `src/assets/img`. The strongest are the crew and tips set (storm, tell, camp night,
"you are in a race" hand, handshake). None are from Sydney, and most are 600x750, too small for a
full-bleed desktop hero. Mockups use them as stand-ins and label them.
