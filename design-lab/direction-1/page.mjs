// Direction 1: Matchday program. Words lead; the takeaway sentences are the display type.
import { dnfChart, lineChart, lapTable, heat } from "../lib/charts.mjs";
import { ul, ps, both, standingsRows, standoutLines } from "../lib/html.mjs";
import { IMG } from "../lib/data.mjs";

export const title = "Direction 1: Matchday program";
export const fonts = "family=Archivo:ital,wdth,wght@0,62..125,300..900;1,62..125,400..700";

export function render(d) {
	const { r, race, copy: c, takeaways: t, blocks: b } = d;
	const [man, woman] = r.heroRows;
	const dnfD = dnfChart(d, { w: 1040, h: 360, pad: [24, 0, 28, 32], every: 5, yStep: 25, valueMin: 40, annotate: [{ loop: 16, text: "98 after loop 15", dx: 10, anchor: "start", dy: 14 }] });
	const dnfM = dnfChart(d, { w: 358, h: 260, pad: [20, 0, 24, 24], every: 10, yStep: 25, gap: 0.2, values: "none", nightLabels: false, annotate: [{ loop: 16, text: "98", dy: 8 }] });
	const duel = (w, h, pad, every) => lineChart(d, [{ values: d.duel[1].laps, cls: "s1", label: "Warren" }, { values: d.duel[0].laps, cls: "s0", label: "Makhlouf" }], { w, h, pad, every, yMin: 40, yMax: 60, endLabels: w > 500, marks: [{ loop: 63, sec: d.duel[0].laps[62], text: "45:25", dy: 22 }], aria: "Line chart of loop times for the winner and the runner-up." });
	const gen = (w, h, pad, every) => lineChart(d, [{ values: d.gender.M, cls: "s1", label: "Men" }, { values: d.gender.F, cls: "s0", label: "Women", labelDy: 4 }], { w, h, pad, every, loops: d.gender.M.length, yMin: 46, yMax: 54, yStep: 2, dots: 2.5, endLabels: true, nightLabels: w > 500, aria: "Line chart of the median loop time for women and for men." });
	const nav = `<header class="bar"><a class="mark" href="#">backyards<span>.run</span></a><nav><a href="#">Races</a><a href="#">Learn</a><a href="#">Crew</a></nav></header>`;

	return `${nav}
<main>
<section class="hero">
	<figure class="hero-photo"><img src="${IMG("byu-tip-storm.jpeg")}" alt="A runner holds a tent pole in the rain." width="600" height="750"><figcaption>Stand-in photo, not from this race</figcaption></figure>
	<div class="hero-text">
		<p class="hero-meta">${race.dateLabel}<br>${race.location}</p>
		<h1>${race.name} ${race.year}</h1>
		<div class="standing">
			<p class="standing-label">${man.label}. Winner.</p>
			<p class="standing-name">${man.names[0]}</p>
			<p class="standing-num">${man.loops} loops <span>${man.distance}</span></p>
		</div>
		<div class="standing standing--2">
			<p class="standing-label">${woman.label}</p>
			<p class="standing-name">${woman.names[0]}</p>
			<p class="standing-num">${woman.loops} loops <span>${woman.distance}</span></p>
		</div>
		<p class="facts">${r.starters} runners. First loop ${r.startLabel}. ${race.loopLabel} loop. ${r.laps.totalLoops} loops run. Timing ${race.timer}.</p>
	</div>
</section>

<nav class="toc" aria-label="On this page">${c.toc.map((x, i) => `<a href="#"${i === 0 ? ' aria-current="true"' : ""}>${x}</a>`).join("")}</nav>

<section class="sec" id="results">
	<h2 class="sec-h">${c.h2.results}</h2>
	<div class="tools"><input type="search" placeholder="Find a runner" aria-label="Find a runner"><div class="seg"><button class="on">All</button><button>Women</button><button>Men</button></div></div>
	<div class="scroll"><table class="standings"><thead><tr><th>Pl.</th><th>Runner</th><th>Loops</th><th class="st-dist">Distance</th><th>Time on course</th></tr></thead><tbody>${standingsRows(d)}</tbody></table></div>
	<button class="more">Show all ${r.starters} runners</button>
</section>

<section class="sec sec--story" id="how-it-ended">
	<h2 class="sec-h">${c.h2.ending}</h2>
	<p class="lead">${t.ending}</p>
	<div class="chart">${both(duel(1040, 340, [20, 90, 28, 32], 5), duel(358, 240, [16, 8, 24, 24], 10))}</div>
	<div class="cols">
		<div class="numbers">${ul(d.bullets.ending)}<p class="note">${c.restNote}</p></div>
		<div class="prose">${ps(b.ending)}</div>
	</div>
</section>

<section class="sec sec--green" id="dropouts">
	<h2 class="sec-h">${c.h2.dropouts}</h2>
	<p class="lead">${t.dropouts}</p>
	<div class="chart">
		<div class="chart-head"><p>${c.dnfTitle}</p><div class="seg seg--light"><button class="on">All</button><button>Women</button><button>Men</button></div><div class="seg seg--light"><button>mi</button><button class="on">km</button></div></div>
		${both(dnfD, dnfM)}
		<p class="note">${c.dnfNote}</p>
	</div>
	<div class="cols">
		<div class="numbers">${ul(d.bullets.dropouts)}</div>
		<div class="prose">${ps(b.dropouts)}</div>
	</div>
</section>

<section class="sec" id="women-and-men">
	<h2 class="sec-h">${c.h2.women}</h2>
	<p class="lead">${t.women}</p>
	<div class="cols">
		<div>
			<p>${d.standout.starters}</p>
			<div class="standout"><p class="standing-label">Last woman standing</p><p class="standing-name">${d.standout.name}</p><p class="standing-num">${d.standout.stat}</p>${standoutLines(d)}</div>
		</div>
		<div class="prose"><h3>Loop by loop</h3>${ps(c.womenIntro)}</div>
	</div>
	<div class="chart">${both(gen(1040, 320, [20, 70, 28, 36], 5), gen(358, 230, [16, 44, 24, 28], 5))}</div>
	<div class="cols"><div class="prose">${ps(b.women)}</div><div class="prose"><p>${c.womenOutro}</p><p class="note">${c.agender}</p></div></div>
</section>

<section class="sec" id="day-vs-night">
	<h2 class="sec-h">${c.h2.daynight}</h2>
	<p class="lead">${t.daynight}</p>
	<div class="cols">
		<div class="numbers">${ul(d.bullets.daynight)}<p class="note">${c.nightNote}</p></div>
		<div class="prose">${ps(b.daynight)}</div>
	</div>
</section>

<section class="sec" id="lap-times">
	<h2 class="sec-h">${c.h2.laptimes}</h2>
	<p class="lead">${t.laptimes}</p>
	<div class="tools"><input type="search" placeholder="Find a runner" aria-label="Find a runner in the table"></div>
	<div class="scroll scroll--laps">${lapTable(d, { cell: (s) => "h" + heat(s), nameFmt: (x) => x.name.split(" ").slice(-1)[0] })}</div>
	<p class="key"><span class="k h0"></span>under 45:00 <span class="k h2"></span>48:00 to 51:00 <span class="k h4"></span>54:00 and over. Shaded columns are night loops.</p>
	<div class="numbers">${ul(d.bullets.laptimes)}</div>
</section>

<section class="sec sec--last" id="how-it-works">
	<h2 class="sec-h">${c.h2.how}</h2>
	<p class="prose-lg">${c.howItWorks}</p>
	<p><a href="#">${c.howItWorksLink}</a></p>
</section>
</main>
<footer class="foot"><p>Results data via raceresult.com</p><p><a href="#">Feedback</a></p></footer>`;
}
