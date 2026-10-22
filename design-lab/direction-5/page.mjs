// Direction 5: The crew's log. A printed log sheet, typed numbers, red pen only where a crew would mark it.
import { dnfChart, lineChart, lapTable } from "../lib/charts.mjs";
import { ul, ps, both, standingsRows, standoutLines } from "../lib/html.mjs";
import { IMG } from "../lib/data.mjs";

export const title = "Direction 5: The crew's log";
export const fonts = "family=Libre+Franklin:ital,wght@0,400..800;1,400&family=IBM+Plex+Mono:wght@400;500;600&family=Nanum+Pen+Script";

// A loose hand-drawn ring, as SVG, sized to its box.
const ring = (cls = "") => `<svg class="pen-ring ${cls}" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true"><path d="M8 34 C 6 14, 40 4, 64 7 C 90 10, 98 26, 92 40 C 84 56, 40 58, 20 50 C 8 45, 4 36, 14 24"/></svg>`;

export function render(d) {
	const { r, race, copy: c, takeaways: t, blocks: b } = d;
	const [man, woman] = r.heroRows;
	const [w, u] = d.duel;
	const ms = [{ loop: 8, text: "Marathon" }, { loop: 13, text: "50 miles" }, { loop: 16, text: "100 km", dx: 8, anchor: "start" }, { loop: 25, text: "100 miles" }];
	const dnfD = dnfChart(d, { w: 1000, h: 330, pad: [34, 0, 28, 30], every: 5, yStep: 20, values: "big", valueMin: 30, gap: 0.35, milestones: [7, 12, 15, 24].map((loop) => ({ loop })), annotate: ms.map((m) => ({ ...m, dy: 22 })) });
	const dnfM = dnfChart(d, { w: 358, h: 250, pad: [30, 0, 24, 24], every: 10, yStep: 25, values: "none", gap: 0.2, nightLabels: false, milestones: [7, 12, 15, 24].map((loop) => ({ loop })), annotate: [{ loop: 16, text: "100 km: 98", dx: 6, anchor: "start", dy: 6 }] });
	const gen = (wd, h, pad) => lineChart(d, [{ values: d.gender.M, cls: "s1", label: "Men" }, { values: d.gender.F, cls: "s0", label: "Women", labelDy: 6 }], { w: wd, h, pad, every: 5, loops: d.gender.M.length, yMin: 46, yMax: 54, yStep: 2, dots: 2.4, endLabels: true, nightLabels: wd > 400, aria: "Line chart of the median loop time for women and for men." });
	// The last ten loops, as the crew wrote them down.
	const endRows = [];
	for (let k = 57; k <= 66; k++) {
		const a = w.laps[k - 1], z = u.laps[k - 1];
		endRows.push(`<tr class="${k === 63 ? "is-split" : ""}${d.isNight(k) ? " is-night" : ""}"><th>${k}</th><td>${k === 63 ? `<span class="circled">${d.mmss(a)}${ring()}</span>` : d.mmss(a)}</td><td>${z ? d.mmss(z) : `<span class="dnf">Did not finish</span>`}</td></tr>`);
	}
	const best = (sec, k, row) => (sec === Math.min(...row.laps) ? "circled" : "");

	return `<header class="top"><a class="mark" href="#">backyards.run</a><nav><a href="#">Results</a><a href="#">Learn</a><a href="#">Crew</a></nav></header>
<main class="sheet">
<section class="hero">
	<div class="hero-form">
		<table class="form">
			<tr><th>Race</th><td colspan="3" class="form-race">${race.name} ${race.year}</td></tr>
			<tr><th>Date</th><td>${race.dateLabel}</td><th>First loop</th><td>${r.startLabel}</td></tr>
			<tr><th>Place</th><td colspan="3">${race.location}</td></tr>
			<tr><th>Loop</th><td>${race.loopLabel}</td><th>Timing</th><td>${race.timer}</td></tr>
			<tr><th>Runners</th><td>${r.starters}</td><th>Loops run</th><td>${r.laps.totalLoops}</td></tr>
		</table>
		<div class="finish">
			<p class="finish-k">${man.label} · Winner</p>
			<p class="finish-n">${man.names[0]}</p>
			<p class="finish-v"><span class="circled circled--big">${man.loops}${ring()}</span> loops &nbsp; ${man.distance}</p>
		</div>
		<div class="finish finish--2">
			<p class="finish-k">${woman.label}</p>
			<p class="finish-n">${woman.names[0]}</p>
			<p class="finish-v"><span>${woman.loops}</span> loops &nbsp; ${woman.distance}</p>
		</div>
	</div>
	<figure class="hero-photo"><img src="${IMG("byu-tip-ben-clipboard.jpeg")}" alt="A crew member writes loop times on a clipboard." width="600" height="750"><figcaption>Stand-in photo, not from this race</figcaption></figure>
</section>

<nav class="toc" aria-label="On this page">${c.toc.map((x, i) => `<a href="#"${i === 0 ? ' aria-current="true"' : ""}>${x}</a>`).join("")}</nav>

<section class="sec" id="results">
	<h2 class="h2-form">${c.h2.results}</h2>
	<div class="tools"><input type="search" placeholder="Find a runner" aria-label="Find a runner"><div class="seg"><button class="on">All</button><button>Women</button><button>Men</button></div></div>
	<div class="scroll"><table class="log standings"><thead><tr><th>Pl.</th><th>Runner</th><th>Loops</th><th class="st-dist">Distance</th><th>Time on course</th></tr></thead><tbody>${standingsRows(d)}</tbody></table></div>
	<button class="more">Show all ${r.starters} runners</button>
</section>

<section class="sec" id="how-it-ended">
	<h2>${c.h2.ending}</h2>
	<p class="take">${t.ending}</p>
	<div class="split">
		<div class="endlog">
			<table class="log log--end"><thead><tr><th>Loop</th><th>Makhlouf</th><th>Warren</th></tr></thead><tbody>${endRows.join("")}</tbody></table>
			<p class="pen pen--63">Loop 63 split them.</p>
		</div>
		<div>
			<div class="nums">${ul(d.bullets.ending)}<p class="note">${c.restNote}</p></div>
			<div class="prose">${ps(b.ending)}</div>
		</div>
	</div>
</section>

<section class="sec" id="dropouts">
	<h2>${c.h2.dropouts}</h2>
	<p class="take">${t.dropouts}</p>
	<div class="chart">
		<div class="chart-head"><p>${c.dnfTitle}</p><div class="seg"><button class="on">All</button><button>Women</button><button>Men</button></div><div class="seg"><button>mi</button><button class="on">km</button></div></div>
		${both(dnfD, dnfM)}
		<p class="note">${c.dnfNote}</p>
	</div>
	<div class="split"><div class="nums">${ul(d.bullets.dropouts)}</div><div class="prose">${ps(b.dropouts)}</div></div>
</section>

<section class="sec" id="women-and-men">
	<h2>${c.h2.women}</h2>
	<p class="take">${t.women}</p>
	<div class="split">
		<div><p class="body">${d.standout.starters}</p><div class="standout"><p class="finish-k">Last woman standing</p><p class="finish-n">${d.standout.name}</p><p class="finish-v">${d.standout.stat}</p>${standoutLines(d)}</div></div>
		<div class="prose"><h3>Loop by loop</h3>${ps(c.womenIntro)}</div>
	</div>
	<div class="chart">${both(gen(1000, 300, [20, 70, 28, 30]), gen(358, 220, [14, 52, 24, 26]))}<p class="pen pen--chart">Loop 19 flipped it.</p></div>
	<div class="split"><div class="prose">${ps(b.women)}</div><div class="prose"><p>${c.womenOutro}</p><p class="note">${c.agender}</p></div></div>
</section>

<section class="sec" id="day-vs-night">
	<h2>${c.h2.daynight}</h2>
	<p class="take">${t.daynight}</p>
	<div class="split"><div class="nums">${ul(d.bullets.daynight)}<p class="note">${c.nightNote}</p></div><div class="prose">${ps(b.daynight)}</div></div>
</section>

<section class="sec" id="lap-times">
	<h2>${c.h2.laptimes}</h2>
	<p class="take">${t.laptimes}</p>
	<div class="tools"><input type="search" placeholder="Find a runner" aria-label="Find a runner in the table"></div>
	<div class="scroll scroll--laps">${lapTable(d, { cell: best, nameFmt: (x) => x.name.split(" ").slice(-1)[0], cls: "laps log" })}</div>
	<p class="note">Circled: each runner's fastest loop. Shaded columns: night loops.</p>
	<div class="nums">${ul(d.bullets.laptimes)}</div>
</section>

<section class="sec sec--last" id="how-it-works">
	<h2>${c.h2.how}</h2>
	<p class="take take--body">${c.howItWorks}</p>
	<p><a href="#">${c.howItWorksLink}</a></p>
</section>
</main>
<footer class="foot">Results data via raceresult.com · <a href="#">Feedback</a></footer>`;
}
