// Direction 3: Swiss grid, hi-vis orange, one mark per person.
import { dotChart, lineChart, lapTable } from "../lib/charts.mjs";
import { ul, ps, both, standingsRows, standoutLines } from "../lib/html.mjs";
import { IMG } from "../lib/data.mjs";

export const title = "Direction 3: Hi-vis grid";
export const fonts = "family=Instrument+Sans:ital,wdth,wght@0,75..100,400..700;1,75..100,400..700";

// One ring per loop the winner ran. Night loops filled.
function rings(d, size, gap, perRow) {
	const n = d.winnerLoops, rows = Math.ceil(n / perRow), p = size + gap;
	let s = "";
	for (let i = 0; i < n; i++) {
		const k = i + 1, cx = (i % perRow) * p + size / 2 + 1, cy = Math.floor(i / perRow) * p + size / 2 + 1;
		s += `<circle class="${k === n ? "ring is-last" : d.isNight(k) ? "ring is-night" : "ring"}" cx="${cx}" cy="${cy}" r="${size / 2 - 1}"/>`;
	}
	return `<svg class="rings" viewBox="0 0 ${perRow * p} ${rows * p}" aria-hidden="true">${s}</svg>`;
}

export function render(d) {
	const { r, race, copy: c, takeaways: t, blocks: b } = d;
	const [man, woman] = r.heroRows;
	const dotsD = dotChart(d, { w: 700, pad: [24, 0, 26, 0], across: 2, r: 1.9, every: 10, valueMin: 40 });
	const dotsM = dotChart(d, { w: 358, pad: [4, 30, 4, 26], horizontal: true, pitch: 3.08, rowH: 6, r: 1.3, every: 10, valueMin: 40 });
	const duel = (w, h, pad, every) => lineChart(d, [{ values: d.duel[1].laps, cls: "s1", label: "Warren" }, { values: d.duel[0].laps, cls: "s0", label: "Makhlouf" }], { w, h, pad, every, yMin: 40, yMax: 60, endLabels: w > 400, grid: false, nightLabels: false, prefix: "", marks: [{ loop: 63, sec: d.duel[0].laps[62], text: "Loop 63, 45:25", dx: -8, dy: 20, anchor: "end", r: 4 }], aria: "Line chart of loop times for the winner and the runner-up." });
	const gen = (w, h, pad) => lineChart(d, [{ values: d.gender.M, cls: "s1", label: "Men" }, { values: d.gender.F, cls: "s0", label: "Women", labelDy: 6 }], { w, h, pad, every: 5, loops: d.gender.M.length, yMin: 46, yMax: 54, yStep: 2, dots: 2.5, grid: false, endLabels: true, nightLabels: false, prefix: "", aria: "Line chart of the median loop time for women and for men." });
	const best = (sec, k, row) => (sec === Math.min(...row.laps) ? "is-best" : sec === Math.max(...row.laps) ? "is-worst" : "");
	const section = (id, num, h2, lead, left, right) => `<section class="sec" id="${id}"><div class="sec-l"><p class="sec-n">${num}</p><h2>${h2}</h2>${lead ? `<p class="lead">${lead}</p>` : ""}${left}</div><div class="sec-r">${right}</div></section>`;

	return `<header class="top"><a class="mark" href="#"><svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M16.11 7.78 A6.5 6.5 0 1 1 14.18 5.02" fill="none" stroke="currentColor" stroke-width="4"/></svg>backyards.run</a><nav><a href="#">Results</a><a href="#">Learn</a><a href="#">Races</a></nav></header>
<main>
<section class="hero">
	<figure class="hero-img"><img src="${IMG("alyssa-mcclellan-timed-loops.jpeg")}" alt="A runner smiles on a forest trail during a timed loop." width="600" height="750"><figcaption>Stand-in photo, not from this race</figcaption></figure>
	<div class="hero-a">
		<p class="meta">${race.dateLabel}<br>${race.location}</p>
		<h1>${race.name}<br>${race.year}</h1>
	</div>
	<div class="hero-b">
		<dl class="who">
			<div class="who-row is-win"><dt>${man.label}, winner</dt><dd class="who-n">${man.names[0]}</dd><dd class="who-v"><b>${man.loops}</b> loops</dd><dd class="who-v">${man.distance}</dd></div>
			<div class="who-row"><dt>${woman.label}</dt><dd class="who-n">${woman.names[0]}</dd><dd class="who-v"><b>${woman.loops}</b> loops</dd><dd class="who-v">${woman.distance}</dd></div>
		</dl>
		<figure class="ring-fig">${rings(d, 14, 4, 12)}<figcaption>${r.winner.loops} loops. Filled: night loops.</figcaption></figure>
		<dl class="facts">${d.facts.map(([a, x]) => `<div><dt>${/\d/.test(a) ? x : a}</dt><dd>${/\d/.test(a) ? a : x}</dd></div>`).join("")}</dl>
	</div>
</section>

<nav class="toc" aria-label="On this page">${c.toc.map((x, i) => `<a href="#"${i === 0 ? ' aria-current="true"' : ""}>${x}</a>`).join("")}</nav>

<section class="sec sec--results" id="results">
	<div class="sec-l"><p class="sec-n">01</p><h2 class="h2-big">${c.h2.results}</h2>
		<div class="tools"><input type="search" placeholder="Find a runner" aria-label="Find a runner"><div class="seg"><button class="on">All</button><button>Women</button><button>Men</button></div></div>
	</div>
	<div class="sec-r"><table class="standings"><thead><tr><th>Pl.</th><th>Runner</th><th>Loops</th><th class="st-dist">Distance</th><th>Time on course</th></tr></thead><tbody>${standingsRows(d)}</tbody></table><button class="more">Show all ${r.starters} runners</button></div>
</section>

${section("how-it-ended", "02", c.h2.ending, t.ending, `<div class="nums">${ul(d.bullets.ending)}<p class="note">${c.restNote}</p></div>`,
	`<div class="chart"><p class="legend"><span class="sw s0"></span>Makhlouf <span class="sw s1"></span>Warren <span class="lg-note">Minutes per loop. Grey: night.</span></p>${both(duel(700, 320, [16, 72, 26, 26], 5), duel(358, 230, [14, 8, 24, 24], 10))}</div><div class="prose">${ps(b.ending)}</div>`)}

${section("dropouts", "03", c.h2.dropouts, t.dropouts, `<div class="nums">${ul(d.bullets.dropouts)}</div>`,
	`<div class="chart"><div class="chart-head"><p>${c.dnfTitle}</p><div class="seg"><button class="on">All</button><button>Women</button><button>Men</button></div><div class="seg"><button>mi</button><button class="on">km</button></div></div><p class="legend"><span class="sw dot"></span>One runner <span class="sw dot is-night"></span>Stopped at night</p>${both(dotsD, dotsM)}<p class="note">${c.dnfNote}</p></div><div class="prose">${ps(b.dropouts)}</div>`)}

${section("women-and-men", "04", c.h2.women, t.women, `<p class="body">${d.standout.starters}</p><div class="standout"><p class="so-k">Last woman standing</p><p class="so-n">${d.standout.name}</p><p class="so-v">${d.standout.stat}</p>${standoutLines(d)}</div>`,
	`<div class="prose"><h3>Loop by loop</h3>${ps(c.womenIntro)}</div><div class="chart">${both(gen(700, 280, [16, 64, 26, 26]), gen(358, 210, [14, 52, 24, 24]))}</div><div class="prose">${ps(b.women)}<p>${c.womenOutro}</p><p class="note">${c.agender}</p></div>`)}

${section("day-vs-night", "05", c.h2.daynight, t.daynight, `<div class="nums">${ul(d.bullets.daynight)}<p class="note">${c.nightNote}</p></div>`, `<div class="prose prose--top">${ps(b.daynight)}</div>`)}

<section class="sec sec--full" id="lap-times">
	<div class="sec-l"><p class="sec-n">06</p><h2>${c.h2.laptimes}</h2><p class="lead">${t.laptimes}</p></div>
	<div class="sec-r"><div class="tools"><input type="search" placeholder="Find a runner" aria-label="Find a runner in the table"></div><p class="legend"><span class="sw best"></span>Fastest loop <span class="sw worst"></span>Slowest loop <span class="lg-note">Grey columns: night.</span></p></div>
	<div class="scroll">${lapTable(d, { cell: best, nameFmt: (x) => x.name.split(" ").slice(-1)[0] })}</div>
	<div class="sec-r nums">${ul(d.bullets.laptimes)}</div>
</section>

${section("how-it-works", "07", c.h2.how, "", "", `<div class="prose prose--top prose--lg"><p>${c.howItWorks}</p><p><a href="#">${c.howItWorksLink}</a></p></div>`)}
</main>
<footer class="foot"><span>Results data via raceresult.com</span><a href="#">Feedback</a></footer>`;
}
