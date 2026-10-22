// Direction 6: The race poster. Two inks on paper, loop counts as the hero type, results billed like a lineup.
import { dnfChart, lineChart, lapTable, heat } from "../lib/charts.mjs";
import { ul, ps, both, standoutLines } from "../lib/html.mjs";
import { IMG } from "../lib/data.mjs";

export const title = "Direction 6: The race poster";
export const fonts = "family=Big+Shoulders+Display:wght@500;700;800;900&family=Public+Sans:ital,wght@0,400..700;1,400";

export function render(d) {
	const { r, race, copy: c, takeaways: t, blocks: b } = d;
	const [man, woman] = r.heroRows;
	const dnfD = dnfChart(d, { w: 1100, h: 360, pad: [26, 0, 28, 30], every: 5, yStep: 25, values: "big", valueMin: 40, gap: 0.22 });
	const dnfM = dnfChart(d, { w: 358, h: 250, pad: [22, 0, 24, 24], every: 10, yStep: 25, values: "big", valueMin: 90, gap: 0.16, nightLabels: false });
	const duel = (w, h, pad, every) => lineChart(d, [{ values: d.duel[1].laps, cls: "s1", label: "Warren" }, { values: d.duel[0].laps, cls: "s0", label: "Makhlouf" }], { w, h, pad, every, yMin: 40, yMax: 60, endLabels: w > 400, nightLabels: w > 400, grid: false, marks: [{ loop: 63, sec: d.duel[0].laps[62], text: "45:25", dy: 24 }], aria: "Line chart of loop times for the winner and the runner-up." });
	const gen = (w, h, pad) => lineChart(d, [{ values: d.gender.M, cls: "s1", label: "Men" }, { values: d.gender.F, cls: "s0", label: "Women", labelDy: 6 }], { w, h, pad, every: 5, loops: d.gender.M.length, yMin: 46, yMax: 54, yStep: 2, dots: 2.6, grid: false, endLabels: true, nightLabels: w > 400, aria: "Line chart of the median loop time for women and for men." });
	const top = d.top10;
	const bill = (s, cls) => `<li class="${cls}${s.sex === "F" ? " is-f" : ""}"><span class="b-name">${s.name}</span> <span class="b-loops">${s.loops}</span></li>`;

	return `<header class="top"><a class="mark" href="#">backyards.run</a><nav><a href="#">Results</a><a href="#">Learn</a><a href="#">Races</a></nav></header>
<main>
<section class="poster">
	<p class="p-bill">${race.dateLabel} · ${race.location}</p>
	<h1 class="p-race">${race.name} ${race.year}</h1>
	<figure class="p-photo"><img src="${IMG("byu-tip-you-are-in-a-race.jpeg")}" alt="A runner's hand with writing on the palm." width="600" height="750"><figcaption>Stand-in photo, not from this race</figcaption></figure>
	<div class="p-hero">
		<p class="p-num">${man.loops}</p>
		<div class="p-who">
			<p class="p-label">${man.label} · Winner</p>
			<p class="p-name">${man.names[0]}</p>
			<p class="p-dist">${man.loops} loops · ${man.distance}</p>
		</div>
	</div>
	<div class="p-second">
		<p class="p-num p-num--2">${woman.loops}</p>
		<div class="p-who"><p class="p-label">${woman.label}</p><p class="p-name p-name--2">${woman.names[0]}</p><p class="p-dist">${woman.loops} loops · ${woman.distance}</p></div>
	</div>
	<ul class="p-facts">${d.facts.map(([a, x]) => `<li>${a} ${x}</li>`).join("")}</ul>
</section>

<nav class="toc" aria-label="On this page">${c.toc.map((x, i) => `<a href="#"${i === 0 ? ' aria-current="true"' : ""}>${x}</a>`).join("")}</nav>

<section class="sec" id="results">
	<h2 class="h2-poster">${c.h2.results}</h2>
	<ol class="lineup">
		${bill(top[0], "b1")}${bill(top[1], "b2")}${top.slice(2, 4).map((s) => bill(s, "b3")).join("")}
		${top.slice(4).map((s) => bill(s, "b4")).join("")}
	</ol>
	<p class="lineup-key">Name, then loops. Places 1 to 10.</p>
	<div class="tools"><input type="search" placeholder="Find a runner" aria-label="Find a runner"><div class="seg"><button class="on">All</button><button>Women</button><button>Men</button></div></div>
	<button class="more">Show all ${r.starters} runners</button>
</section>

<section class="sec" id="how-it-ended">
	<h2>${c.h2.ending}</h2>
	<div class="big-take"><p class="big-n">63</p><p class="take">${t.ending}</p></div>
	<div class="chart"><p class="legend"><span class="sw s0"></span>Makhlouf <span class="sw s1"></span>Warren · minutes per loop</p>${both(duel(1100, 340, [20, 80, 28, 30], 5), duel(358, 240, [14, 8, 24, 26], 10))}</div>
	<div class="cols"><div class="nums">${ul(d.bullets.ending)}<p class="note">${c.restNote}</p></div><div class="prose">${ps(b.ending)}</div></div>
</section>

<section class="sec sec--ink" id="dropouts">
	<h2>${c.h2.dropouts}</h2>
	<div class="big-take"><p class="big-n">348</p><p class="take">${t.dropouts}</p></div>
	<div class="chart">
		<div class="chart-head"><p>${c.dnfTitle}</p><div class="seg"><button class="on">All</button><button>Women</button><button>Men</button></div><div class="seg"><button>mi</button><button class="on">km</button></div></div>
		${both(dnfD, dnfM)}
		<p class="note">${c.dnfNote}</p>
	</div>
	<div class="cols"><div class="nums">${ul(d.bullets.dropouts)}</div><div class="prose">${ps(b.dropouts)}</div></div>
</section>

<section class="sec" id="women-and-men">
	<h2>${c.h2.women}</h2>
	<p class="take take--solo">${t.women}</p>
	<div class="cols">
		<div><p class="body">${d.standout.starters}</p><div class="standout"><p class="p-label">Last woman standing</p><p class="so-name">${d.standout.name}</p><p class="so-v">${d.standout.stat}</p>${standoutLines(d)}</div></div>
		<div class="prose"><h3>Loop by loop</h3>${ps(c.womenIntro)}</div>
	</div>
	<div class="chart">${both(gen(1100, 300, [20, 70, 28, 30]), gen(358, 220, [14, 52, 24, 26]))}</div>
	<div class="cols"><div class="prose">${ps(b.women)}</div><div class="prose"><p>${c.womenOutro}</p><p class="note">${c.agender}</p></div></div>
</section>

<section class="sec" id="day-vs-night">
	<h2>${c.h2.daynight}</h2>
	<p class="take take--solo">${t.daynight}</p>
	<div class="cols"><div class="nums">${ul(d.bullets.daynight)}<p class="note">${c.nightNote}</p></div><div class="prose">${ps(b.daynight)}</div></div>
</section>

<section class="sec" id="lap-times">
	<h2>${c.h2.laptimes}</h2>
	<p class="take take--solo">${t.laptimes}</p>
	<div class="tools"><input type="search" placeholder="Find a runner" aria-label="Find a runner in the table"></div>
	<div class="scroll">${lapTable(d, { cell: (s) => "h" + heat(s), nameFmt: (x) => x.name.split(" ").slice(-1)[0] })}</div>
	<p class="note">Red: under 45:00. Shaded columns: night loops.</p>
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
