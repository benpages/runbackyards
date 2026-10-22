// Direction 4: The timing tent at 3am. Night by default; the race clock organizes the page.
import { lineChart, lapTable, heat } from "../lib/charts.mjs";
import { ul, ps, both, standingsRows, standoutLines } from "../lib/html.mjs";
import { IMG } from "../lib/data.mjs";

export const title = "Direction 4: Timing tent, 3am";
export const fonts = "family=Chivo:ital,wght@0,300..800;1,400&family=Chivo+Mono:wght@400;500;700";

const hourLabel = (h) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;

// The loop board: 24 loops per race day, one cell per loop, lit by how many runners stopped there.
function board(d, horizontal) {
	const max = Math.max(...d.dnf.map((x) => x.stopped));
	const days = Math.ceil(d.winnerLoops / 24);
	const cell = (k) => {
		const x = d.dnf[k - 1];
		if (!x) return `<div class="bd-cell is-empty"></div>`;
		const lvl = x.stopped === 0 ? 0 : Math.max(1, Math.ceil((x.stopped / max) * 5));
		const win = k === d.winnerLoops;
		return `<div class="bd-cell l${lvl}${x.night ? " is-night" : ""}${win ? " is-win" : ""}"><span class="bd-k">L${k}${win ? " won" : ""}</span><span class="bd-v">${x.stopped || ""}</span></div>`;
	};
	let s = "";
	if (horizontal) {
		s += `<div class="bd-row bd-head"><span></span>${Array.from({ length: 24 }, (_, i) => `<span class="${d.isNight(i + 1) ? "is-night" : ""}">${i % 3 === 0 ? hourLabel((8 + i) % 24) : ""}</span>`).join("")}</div>`;
		for (let day = 0; day < days; day++) s += `<div class="bd-row"><span class="bd-day">Day ${day + 1}</span>${Array.from({ length: 24 }, (_, i) => cell(day * 24 + i + 1)).join("")}</div>`;
	} else {
		s += `<div class="bd-row bd-head"><span></span>${Array.from({ length: days }, (_, i) => `<span>Day ${i + 1}</span>`).join("")}</div>`;
		for (let i = 0; i < 24; i++) s += `<div class="bd-row"><span class="bd-hour${d.isNight(i + 1) ? " is-night" : ""}">${hourLabel((8 + i) % 24)}</span>${Array.from({ length: days }, (_, day) => cell(day * 24 + i + 1)).join("")}</div>`;
	}
	return `<div class="board ${horizontal ? "board--h" : "board--v"}" role="img" aria-label="Loop board. One cell per loop, 24 loops per race day. The number is how many runners stopped at that loop.">${s}</div>`;
}

export function render(d) {
	const { r, race, copy: c, takeaways: t, blocks: b } = d;
	const [man, woman] = r.heroRows;
	const duel = (w, h, pad, every) => lineChart(d, [{ values: d.duel[1].laps, cls: "s1", label: "Warren" }, { values: d.duel[0].laps, cls: "s0", label: "Makhlouf" }], { w, h, pad, every, yMin: 40, yMax: 60, endLabels: w > 400, nightLabels: w > 400, marks: [{ loop: 63, sec: d.duel[0].laps[62], text: "L63 45:25", dx: -8, dy: 22, anchor: "end", r: 4 }], aria: "Line chart of loop times for the winner and the runner-up." });
	const gen = (w, h, pad) => lineChart(d, [{ values: d.gender.M, cls: "s1", label: "Men" }, { values: d.gender.F, cls: "s0", label: "Women", labelDy: 6 }], { w, h, pad, every: 5, loops: d.gender.M.length, yMin: 46, yMax: 54, yStep: 2, dots: 2.2, endLabels: true, nightLabels: w > 400, aria: "Line chart of the median loop time for women and for men." });

	return `<header class="clockbar">
	<a class="mark" href="#"><svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M16.11 7.78 A6.5 6.5 0 1 1 14.18 5.02" fill="none" stroke="currentColor" stroke-width="4"/></svg>backyards.run</a>
	<span class="clock"><span class="clock-l">L${r.winner.loops}</span> ${r.standings[0].time}</span>
</header>
<main>
<section class="hero">
	<figure class="hero-img"><img src="${IMG("byu-tip-tell.jpeg")}" alt="A runner with a headlamp and tape on his face looks at his crew." width="600" height="750"><figcaption>Stand-in photo, not from this race</figcaption></figure>
	<div class="hero-copy">
		<p class="event">${race.dateLabel} · ${race.location}</p>
		<h1>${race.name} ${race.year}</h1>
		<div class="standing">
			<p class="st-label">${man.label} · Winner</p>
			<p class="st-name">${man.names[0]}</p>
			<p class="st-fig"><span>${man.loops}</span> loops · ${man.distance}</p>
		</div>
		<div class="standing standing--w">
			<p class="st-label">${woman.label}</p>
			<p class="st-name">${woman.names[0]}</p>
			<p class="st-fig"><span>${woman.loops}</span> loops · ${woman.distance}</p>
		</div>
	</div>
</section>
<ul class="ticker">${d.facts.map(([a, x]) => `<li>${a} <b>${x}</b></li>`).join("")}</ul>

<nav class="toc" aria-label="On this page">${c.toc.map((x, i) => `<a href="#"${i === 0 ? ' aria-current="true"' : ""}>${x}</a>`).join("")}</nav>

<section class="sec" id="results">
	<h2 class="h2-screen">${c.h2.results}</h2>
	<div class="tools"><input type="search" placeholder="Find a runner" aria-label="Find a runner"><div class="seg"><button class="on">All</button><button>Women</button><button>Men</button></div></div>
	<div class="scroll"><table class="standings"><thead><tr><th>Pl.</th><th>Runner</th><th>Loops</th><th class="st-dist">Distance</th><th>Time on course</th></tr></thead><tbody>${standingsRows(d)}</tbody></table></div>
	<button class="more">Show all ${r.starters} runners</button>
</section>

<section class="sec" id="how-it-ended">
	<h2>${c.h2.ending}</h2>
	<p class="take">${t.ending}</p>
	<div class="chart"><p class="legend"><span class="sw s0"></span>Makhlouf <span class="sw s1"></span>Warren</p>${both(duel(1100, 340, [20, 80, 28, 30], 5), duel(358, 240, [14, 8, 24, 26], 10))}</div>
	<div class="cols"><div class="nums">${ul(d.bullets.ending)}<p class="note">${c.restNote}</p></div><div class="prose">${ps(b.ending)}</div></div>
</section>

<section class="sec" id="dropouts">
	<h2>${c.h2.dropouts}</h2>
	<p class="take">${t.dropouts}</p>
	<div class="board-wrap">
		<div class="chart-head"><p>${c.dnfTitle}</p><div class="seg"><button class="on">All</button><button>Women</button><button>Men</button></div><div class="seg"><button>mi</button><button class="on">km</button></div></div>
		${both(board(d, true), board(d, false))}
		<p class="note">${c.dnfNote}</p>
	</div>
	<div class="cols"><div class="nums">${ul(d.bullets.dropouts)}</div><div class="prose">${ps(b.dropouts)}</div></div>
</section>

<section class="sec" id="women-and-men">
	<h2>${c.h2.women}</h2>
	<p class="take">${t.women}</p>
	<div class="cols">
		<div><p class="body">${d.standout.starters}</p><div class="standout"><p class="st-label">Last woman standing</p><p class="st-name">${d.standout.name}</p><p class="st-fig">${d.standout.stat}</p>${standoutLines(d)}</div></div>
		<div class="prose"><h3>Loop by loop</h3>${ps(c.womenIntro)}</div>
	</div>
	<div class="chart">${both(gen(1100, 300, [20, 70, 28, 30]), gen(358, 220, [14, 52, 24, 26]))}</div>
	<div class="cols"><div class="prose">${ps(b.women)}</div><div class="prose"><p>${c.womenOutro}</p><p class="note">${c.agender}</p></div></div>
</section>

<section class="sec" id="day-vs-night">
	<h2>${c.h2.daynight}</h2>
	<p class="take">${t.daynight}</p>
	<div class="cols"><div class="nums">${ul(d.bullets.daynight)}<p class="note">${c.nightNote}</p></div><div class="prose">${ps(b.daynight)}</div></div>
</section>

<section class="sec" id="lap-times">
	<h2>${c.h2.laptimes}</h2>
	<p class="take">${t.laptimes}</p>
	<div class="tools"><input type="search" placeholder="Find a runner" aria-label="Find a runner in the table"></div>
	<div class="scroll scroll--laps">${lapTable(d, { cell: (s) => "h" + heat(s), nameFmt: (x) => x.name.split(" ").slice(-1)[0] })}</div>
	<p class="note">Amber: under 45:00. Dim: 54:00 and over. Darker columns: night loops.</p>
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
