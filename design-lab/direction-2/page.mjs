// Direction 2: Monday sports section. Broadsheet columns, agate tables, process inks.
import { dnfChart, lineChart, lapTable, heat } from "../lib/charts.mjs";
import { ul, ps, both, standingsRows, standoutLines } from "../lib/html.mjs";
import { IMG } from "../lib/data.mjs";

export const title = "Direction 2: The sports section";
export const fonts = "family=Newsreader:ital,opsz,wght@0,6..72,400..800;1,6..72,400..600&family=IBM+Plex+Sans+Condensed:wght@400;500;600;700";

export function render(d) {
	const { r, race, copy: c, takeaways: t, blocks: b } = d;
	const [man, woman] = r.heroRows;
	const dnfD = dnfChart(d, { w: 740, h: 320, pad: [18, 0, 26, 28], every: 5, yStep: 20, values: "big", valueMin: 30, gap: 0.18 });
	const dnfM = dnfChart(d, { w: 358, h: 230, pad: [16, 0, 24, 24], every: 10, yStep: 25, values: "big", valueMin: 60, gap: 0.14, nightLabels: false });
	const duel = (w, h, pad, every) => lineChart(d, [{ values: d.duel[1].laps, cls: "s1", label: "Warren" }, { values: d.duel[0].laps, cls: "s0", label: "Makhlouf" }], { w, h, pad, every, yMin: 40, yMax: 60, endLabels: true, nightLabels: w > 400, aria: "Line chart of loop times for the winner and the runner-up." });
	const gen = (w, h, pad) => lineChart(d, [{ values: d.gender.M, cls: "s1", label: "Men" }, { values: d.gender.F, cls: "s0", label: "Women", labelDy: 6 }], { w, h, pad, every: 5, loops: d.gender.M.length, yMin: 46, yMax: 54, yStep: 2, endLabels: true, nightLabels: w > 400, aria: "Line chart of the median loop time for women and for men." });

	return `<header class="mast">
	<a class="mast-name" href="#">backyards.run</a>
	<nav><a href="#">Results</a><a href="#">Learn</a><a href="#">Race finder</a><a href="#">Crew</a></nav>
</header>
<nav class="toc" aria-label="On this page">${c.toc.map((x) => `<a href="#">${x}</a>`).join("")}</nav>

<main class="paper">
<header class="front">
	<p class="dateline">${race.dateLabel}. ${race.location}</p>
	<h1>${race.name} ${race.year}</h1>
	<div class="front-grid">
		<figure class="photo"><img src="${IMG("byu-tip-camp-night-scene-vertical.jpeg")}" alt="Runners walk through camp at night with headlamps on." width="600" height="750"><figcaption>Stand-in photo, not from this race</figcaption></figure>
		<div class="front-side">
			<dl class="result-line">
				<div><dt>${man.label} · Winner</dt><dd class="nm">${man.names[0]}</dd><dd class="fig">${man.loops} loops, ${man.distance}</dd></div>
				<div><dt>${woman.label}</dt><dd class="nm">${woman.names[0]}</dd><dd class="fig">${woman.loops} loops, ${woman.distance}</dd></div>
			</dl>
			<ul class="facts">${d.facts.map(([a, x]) => `<li>${a} ${x}</li>`).join("")}</ul>
			<section id="results" class="box">
				<h2 class="box-h">${c.h2.results}</h2>
				<div class="tools"><input type="search" placeholder="Find a runner" aria-label="Find a runner"><div class="seg"><button class="on">All</button><button>Women</button><button>Men</button></div></div>
				<table class="agate"><thead><tr><th>Pl.</th><th>Runner</th><th>Loops</th><th class="st-dist">Distance</th><th>Time</th></tr></thead><tbody>${standingsRows(d)}</tbody></table>
				<button class="more">Show all ${r.starters} runners</button>
			</section>
		</div>
	</div>
</header>

<article class="story" id="how-it-ended">
	<h2>${c.h2.ending}</h2>
	<p class="deck">${t.ending}</p>
	<div class="story-grid">
		<div class="copy">${ps(b.ending)}</div>
		<figure class="fig-chart">${both(duel(470, 280, [16, 70, 26, 28], 10), duel(358, 220, [14, 58, 24, 24], 10))}<figcaption>Loop times, winner and runner-up, in minutes.</figcaption></figure>
		<aside class="numbers"><h3>By the numbers</h3>${ul(d.bullets.ending)}<p class="note">${c.restNote}</p></aside>
	</div>
</article>

<article class="story" id="dropouts">
	<h2>${c.h2.dropouts}</h2>
	<p class="deck">${t.dropouts}</p>
	<div class="story-grid story-grid--chart">
		<figure class="fig-chart">
			<div class="fig-head"><span>${c.dnfTitle}</span><div class="seg"><button class="on">All</button><button>Women</button><button>Men</button></div><div class="seg"><button>mi</button><button class="on">km</button></div></div>
			${both(dnfD, dnfM)}
			<figcaption>${c.dnfNote}</figcaption>
		</figure>
		<aside class="numbers"><h3>By the numbers</h3>${ul(d.bullets.dropouts)}</aside>
		<div class="copy">${ps(b.dropouts)}</div>
	</div>
</article>

<article class="story" id="women-and-men">
	<h2>${c.h2.women}</h2>
	<p class="deck">${t.women}</p>
	<div class="story-grid">
		<div class="copy">
			<p>${d.standout.starters}</p>
			<div class="profile"><p class="profile-k">Last woman standing</p><p class="profile-n">${d.standout.name}</p><p class="profile-s">${d.standout.stat}</p>${standoutLines(d)}</div>
			<h3>Loop by loop</h3>${ps(c.womenIntro)}
		</div>
		<figure class="fig-chart">${both(gen(470, 260, [16, 62, 26, 28]), gen(358, 210, [14, 52, 24, 24]))}<figcaption>Middle loop time, women and men, in minutes.</figcaption></figure>
		<div class="copy">${ps(b.women)}<p>${c.womenOutro}</p><p class="note">${c.agender}</p></div>
	</div>
</article>

<article class="story" id="day-vs-night">
	<h2>${c.h2.daynight}</h2>
	<p class="deck">${t.daynight}</p>
	<div class="story-grid">
		<aside class="numbers"><h3>By the numbers</h3>${ul(d.bullets.daynight)}<p class="note">${c.nightNote}</p></aside>
		<div class="copy">${ps(b.daynight)}</div>
	</div>
</article>

<article class="story" id="lap-times">
	<h2>${c.h2.laptimes}</h2>
	<p class="deck">${t.laptimes}</p>
	<div class="tools"><input type="search" placeholder="Find a runner" aria-label="Find a runner in the table"></div>
	<div class="scroll">${lapTable(d, { cell: (s) => "h" + heat(s), nameFmt: (x) => x.name.split(" ").slice(-1)[0] })}</div>
	<p class="note">Bold: under 45:00. Magenta: 54:00 and over. Grey columns: night loops.</p>
	<aside class="numbers numbers--inline">${ul(d.bullets.laptimes)}</aside>
</article>

<article class="story story--last" id="how-it-works">
	<h2>${c.h2.how}</h2>
	<div class="copy copy--wide"><p>${c.howItWorks}</p><p><a href="#">${c.howItWorksLink}</a></p></div>
</article>
</main>
<footer class="foot">Results data via raceresult.com · <a href="#">Feedback</a></footer>`;
}
