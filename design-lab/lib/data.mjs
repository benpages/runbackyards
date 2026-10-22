// Real race data for the design-lab mockups.
// Every number and sentence comes from the live race page: lib/race.js for numbers,
// src/races/sydney-2026-sept.njk for the takeaways and commentary, race-page.njk for fixed copy.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { raceModel, clock } = require(path.join(ROOT, "lib/race.js"));

const SLUG = "sydney-2026-sept";
const raw = JSON.parse(readFileSync(path.join(ROOT, `src/_data/raceData/${SLUG}.json`), "utf8"));
const njk = readFileSync(path.join(ROOT, `src/races/${SLUG}.njk`), "utf8");

// Front matter race object (only the fields the page uses).
const fm = (key) => (njk.match(new RegExp(`^\\s+${key}: "?([^"\\n]+)"?$`, "m")) || [])[1];
const race = {
	slug: SLUG,
	name: "Sydney's Backyard Ultra",
	year: 2026,
	dateLabel: fm("dateLabel"),
	location: fm("location"),
	startHour: 8,
	loopKm: 6.7056,
	loopLabel: fm("loopLabel"),
	unit: "km",
	decimals: 1,
	timer: fm("timer"),
	date: "2026-09-19",
};
const takeaways = {};
for (const k of ["ending", "dropouts", "women", "daynight", "laptimes"]) takeaways[k] = fm(k);

// Commentary blocks as arrays of paragraphs.
const blocks = {};
for (const m of njk.matchAll(/{% block (\w+) %}([\s\S]*?){% endblock %}/g)) {
	blocks[m[1]] = [...m[2].matchAll(/<p>([\s\S]*?)<\/p>/g)].map((p) => p[1].trim());
}

const r = raceModel(raw, race);
const isNight = (loop) => { const h = (race.startHour + loop - 1) % 24; return h >= 21 || h < 6; };
const maxLoop = Math.max(...raw.runners.map((x) => x.loops));
const winnerLoops = r.winner.loops;

// Dropouts: bar L(k) = runners who completed k - 1 loops (the loop they did not finish).
const dnf = [];
for (let k = 1; k <= winnerLoops; k++) {
	dnf.push({ loop: k, stopped: raw.runners.filter((x) => x.loops === k - 1).length, night: isNight(k) });
}

// Night bands as [firstLoop, lastLoop].
const nights = [];
for (let k = 1; k <= maxLoop; k++) {
	if (isNight(k) && !isNight(k - 1)) nights.push([k, k]);
	else if (isNight(k)) nights[nights.length - 1][1] = k;
}

const byName = (n) => raw.runners.find((x) => x.name === n);
const duel = [byName(r.winner.name), byName(r.runnerUp.name)].map((x) => ({ name: x.name, laps: x.laps }));

// Median loop time per loop for women and men, cut when fewer than minRunners finished it.
const med = (a) => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const genderSeries = (sex) => {
	const out = [];
	for (let i = 0; i < maxLoop; i++) {
		const t = raw.runners.filter((x) => x.sex === sex && x.laps.length > i).map((x) => x.laps[i]);
		if (t.length < r.gender.minRunners) break;
		out.push(med(t));
	}
	return out;
};

// Loop-by-loop table: the top runners, every loop they ran.
const lapTable = raw.runners.slice(0, 12).map((x) => ({ place: x.place, name: x.name, sex: x.sex, loops: x.loops, laps: x.laps }));

export const data = {
	race, takeaways, blocks, r, dnf, nights, duel, maxLoop, winnerLoops, lapTable,
	gender: { F: genderSeries("F"), M: genderSeries("M") },
	top10: r.standings.slice(0, 10),
	clock,
	mmss: (s) => clock(s).replace(/^0:/, ""),
	isNight,
	// Fixed copy from race-page.njk, verbatim.
	copy: {
		restNote: "Rest banked is the time left over each hour after the loop, added up across the race.",
		dnfTitle: "Runners who stopped, loop by loop",
		dnfNote: "A runner who completed 16 loops sits in the L17 bar, the loop they did not complete. Shaded bars are night loops.",
		womenIntro: [
			"Each point on this chart is one loop. It shows the middle time of everyone who finished that loop. Half of them ran it faster. Half ran it slower. That middle time is called the median.",
			"We only put women next to men on the same loop. Same heat, same rain, same dark.",
			`A line stops when fewer than ${r.gender.minRunners} runners are left on it. After that, one runner can swing the number too much. You can still follow each runner in <a href="#lap-times">lap times for every runner</a>.`,
		],
		womenOutro: `Want to see when each group stopped? Use the Women and Men switch on the <a href="#dropouts">dropouts chart</a>.`,
		agender: `The field had ${r.gender.other} agender runners. They are left out of both groups, and show under All only.`,
		nightNote: "A night loop is one that starts between 9 pm and 5 am.",
		howItWorks: `Every runner starts a ${r.loopDistance} loop at the top of each hour. Finish it inside the hour and the time left over is your rest. Miss the next start and your race is over. The last runner to finish a loop alone wins.`,
		howItWorksLink: "More on how a backyard ultra works",
		toc: ["Results", "How it ended", "Dropouts", "Women and men", "Day vs night", "Lap times", "How it works"],
		h2: {
			results: `${race.name} ${race.year} results`,
			ending: "How the race ended",
			dropouts: "When runners dropped out",
			women: "Women and men",
			daynight: "Day vs night loops",
			laptimes: "Lap times for every runner",
			how: "How a backyard ultra works",
		},
	},
};

// Bullet lists exactly as race-page.njk writes them. Each item: [lead, rest].
const d = r.dropouts, dn = r.dayNight, g = r.gender;
data.bullets = {
	ending: r.duel.map((x) => [`${x.name}:`, `${x.loops} loops, ${x.distance}. ${x.rest} of rest banked.`]),
	dropouts: [
		["Biggest single exit:", `${d.biggest.stopped} runners stopped after loop ${d.biggest.loop}, ${d.biggest.distance}.`],
		["Half the field:", `more than half the runners stopped at ${d.halfLoops} loops or fewer.`],
		...d.milestones.map((m) => [`${m.label}:`, `${m.reached} runners reached it at loop ${m.loop}, ${m.distance}. ${m.stopped} of them stopped right there (${m.share}%).`]),
	],
	daynight: [
		["Before the first night:", `${dn.beforeFirstNight} runners stopped.`],
		["The first night", `(${dn.firstNightFrom} to ${dn.firstNightTo}): ${dn.duringFirstNight} stopped.`],
		["Through the first night:", `${dn.stillInAfterFirstNight} runners finished its last loop.`],
		["Whole race:", `${dn.stopsDay} stopped on a day loop, ${dn.stopsNight} on a night loop.`],
		["Hours:", `the race ran ${dn.dayHours} day loops and ${dn.nightHours} night loops.`],
		["Per hour:", `about ${dn.perDayHour} runners stopped each day hour, ${dn.perNightHour} each night hour.`],
	],
	laptimes: [["Middle runner:", `averaged ${r.laps.middleRunnerAverage} a loop. Half the field averaged faster, half slower.`]],
};
const lw = g.lastWoman;
data.standout = {
	name: lw.names.join(" and "),
	stat: `${lw.loops} loops · ${lw.distance}`,
	lines: [
		`Only ${lw.runnersFurther} runners in the whole field went further.`,
		`The next woman was ${g.nextWoman.name}, ${g.nextWoman.behind === 1 ? "one loop" : g.nextWoman.behind + " loops"} behind.`,
	],
	starters: `Of the ${g.starters} starters, ${g.women} were women and ${g.men} were men.`,
};
data.facts = [
	[String(r.starters), "runners"],
	["First loop", r.startLabel],
	[race.loopLabel, "loop"],
	[r.laps.totalLoops, "loops run"],
	["Timing", race.timer],
];

export const IMG = (f) => `../../src/assets/img/${f}`;
