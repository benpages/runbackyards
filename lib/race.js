/**
 * The race page model. Every number a race page prints comes from here, worked
 * out at build time from one data file, so no count is typed by hand.
 *
 * Input: src/_data/raceData/<slug>.json
 *   { meta: {…}, runners: [ { place, bib, name, sex, nation, loops, time, laps: [seconds…] } ] }
 *   loops = loops COMPLETED. laps[i] = seconds for loop i + 1.
 *   sex: "F" women, "M" men, "X" other (left out of both groups), null unknown.
 *
 * Race facts (start hour, loop distance…) come from the page's `race` front matter.
 *
 * Counting rules, written once so every page uses the same ones:
 *   - A runner with N loops completed N and stopped at the bell for loop N + 1.
 *   - The bell for loop N rings at startHour + (N - 1).
 *   - A bell is a night bell from 9 pm up to (not including) 6 am.
 */

const { genderSummary } = require("./gender");

const MARATHON_KM = 42.195;
const MILESTONES = [
	{ label: "Marathon", km: MARATHON_KM },
	{ label: "50 miles", km: 80.4672 },
	{ label: "100 km", km: 100 },
	{ label: "100 miles", km: 160.9344 },
	{ label: "200 miles", km: 321.8688 },
	{ label: "300 miles", km: 482.8032 },
];

const isNightHour = (h) => h >= 21 || h < 6;

function clock(seconds) {
	const s = Math.round(seconds);
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	return h
		? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
		: `${m}:${String(sec).padStart(2, "0")}`;
}

function hoursMinutes(seconds) {
	const m = Math.round(seconds / 60);
	return `${Math.floor(m / 60)} hours ${m % 60} minutes`;
}

function median(values) {
	const v = values.slice().sort((a, b) => a - b);
	const mid = Math.floor(v.length / 2);
	return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/** "9 pm Saturday" style label for the bell of loop N. */
function bellLabel(loop, startHour, startDay) {
	const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
	const total = startHour + (loop - 1);
	const h = total % 24;
	const hour = h === 0 ? "midnight" : h === 12 ? "noon" : h < 12 ? `${h} am` : `${h - 12} pm`;
	if (startDay == null) return hour;
	return `${hour} ${DAYS[(startDay + Math.floor(total / 24)) % 7]}`;
}

function raceModel(data, race) {
	if (!data || !race || !Array.isArray(data.runners) || !data.runners.length) return null;
	if (!Number.isFinite(race.startHour)) throw new Error(`race.startHour missing for ${race.slug}`);

	const runners = data.runners.slice().sort((a, b) => a.place - b.place);
	const loopKm = race.loopKm || 6.7056;
	const unit = race.unit || "km";
	const decimals = race.decimals ?? 1;
	const toUnit = (km) => (unit === "mi" ? km / 1.609344 : km);
	const dist = (loops) => `${toUnit(loops * loopKm).toFixed(decimals)} ${unit}`;
	const startHour = race.startHour;
	const startDay = race.date ? new Date(race.date).getUTCDay() : null;
	const bellHour = (loop) => (startHour + loop - 1) % 24;

	const starters = runners.length;
	const winnerLoops = Math.max(...runners.map((r) => r.loops));
	const atTop = runners.filter((r) => r.loops === winnerLoops);
	const winner = atTop.length === 1 ? atTop[0] : null;
	const runnerUp = winner ? runners.find((r) => r !== winner) : null;
	const count = (pred) => runners.filter((r) => pred(r.loops)).length;

	// ── Standings ──────────────────────────────────────────────────────────
	const standings = runners.map((r) => ({
		place: r.place,
		name: r.name,
		sex: r.sex,
		nation: r.nation,
		loops: r.loops,
		distance: dist(r.loops),
		time: r.time,
	}));

	// ── How it was won ─────────────────────────────────────────────────────
	const rest = (r) => r.laps.reduce((sum, s) => sum + (3600 - s), 0);
	const duel = winner && runnerUp
		? [winner, runnerUp].map((r) => ({
			name: r.name,
			loops: r.loops,
			distance: dist(r.loops),
			rest: hoursMinutes(rest(r)),
		}))
		: null;

	// ── When runners dropped out ───────────────────────────────────────────
	// Stops at each loop: runners whose race ended after completing that loop.
	const stoppedAfter = {};
	runners.forEach((r) => {
		if (r !== winner) stoppedAfter[r.loops] = (stoppedAfter[r.loops] || 0) + 1;
	});
	const biggestLoop = Object.keys(stoppedAfter)
		.map(Number)
		.sort((a, b) => stoppedAfter[b] - stoppedAfter[a] || a - b)[0];
	const milestones = MILESTONES.map((m) => {
		// First loop whose distance reaches the milestone (tiny tolerance: 24 loops is exactly 100 miles).
		const loop = Math.ceil(m.km / loopKm - 1e-9);
		if (loop > winnerLoops - 1) return null;
		const reached = count((l) => l >= loop);
		const stopped = stoppedAfter[loop] || 0;
		return {
			label: m.label,
			loop,
			distance: dist(loop),
			reached,
			stopped,
			share: Math.round((stopped / reached) * 100),
		};
	}).filter((m) => m && m.stopped > 0);
	// Smallest k where more than half the field completed k loops or fewer.
	let halfLoops = 0;
	while (halfLoops < winnerLoops && count((l) => l <= halfLoops) <= starters / 2) halfLoops++;

	// ── Day vs night ───────────────────────────────────────────────────────
	let dayHours = 0;
	let nightHours = 0;
	for (let loop = 1; loop <= winnerLoops; loop++) {
		if (isNightHour(bellHour(loop))) nightHours++;
		else dayHours++;
	}
	let stopsDay = 0;
	let stopsNight = 0;
	runners.forEach((r) => {
		if (r === winner) return;
		if (isNightHour(bellHour(r.loops + 1))) stopsNight++;
		else stopsDay++;
	});
	// First night: the first run of night bells.
	// (Bounded loops, so bad input can never hang the build.)
	let firstNightStart = 1;
	while (firstNightStart <= 48 && !isNightHour(bellHour(firstNightStart))) firstNightStart++;
	let firstNightEnd = firstNightStart;
	while (firstNightEnd < firstNightStart + 24 && isNightHour(bellHour(firstNightEnd + 1))) firstNightEnd++;
	const beforeFirstNight = count((l) => l + 1 < firstNightStart);
	const duringFirstNight = count((l) => l + 1 >= firstNightStart && l + 1 <= firstNightEnd);
	const dayNight = {
		dayHours,
		nightHours,
		stopsDay,
		stopsNight,
		perDayHour: (stopsDay / dayHours).toFixed(1),
		perNightHour: (stopsNight / nightHours).toFixed(1),
		beforeFirstNight,
		duringFirstNight,
		stillInAfterFirstNight: starters - beforeFirstNight - duringFirstNight,
		firstNightFrom: bellLabel(firstNightStart, startHour, startDay),
		firstNightTo: bellLabel(firstNightEnd, startHour, startDay),
	};

	// ── Lap times ──────────────────────────────────────────────────────────
	const withLaps = runners.filter((r) => r.laps.length);
	const runnerAverages = withLaps.map((r) => r.laps.reduce((a, b) => a + b, 0) / r.laps.length);
	// No "fastest loop of the race": a single split can be a timing glitch and
	// there is no way to tell from the data. Only whole-runner figures here.
	const laps = {
		middleRunnerAverage: clock(median(runnerAverages)),
		totalLoops: withLaps.reduce((n, r) => n + r.laps.length, 0).toLocaleString("en-US"),
	};

	const gender = genderSummary(
		{ runners: runners.map((r) => ({ d: r.name, n: r.name, g: r.sex, t: r.loops })) },
		{ loopDistance: toUnit(loopKm), distanceUnit: unit, distanceDecimals: decimals },
	);

	// ── Hero: last man and last woman standing ─────────────────────────────
	// With gender data: one row each, most loops first, the race winner marked.
	// Without it: a single "Winner" row.
	const standing = (sex, label) => {
		const group = runners.filter((r) => r.sex === sex);
		if (!group.length) return null;
		const top = Math.max(...group.map((r) => r.loops));
		const names = group.filter((r) => r.loops === top).map((r) => r.name);
		return { label, names, loops: top, distance: dist(top), won: Boolean(winner && winner.sex === sex && names.length === 1) };
	};
	const heroRows = gender.has
		? [standing("M", "Last man standing"), standing("F", "Last woman standing")].sort((a, b) => b.loops - a.loops)
		: winner
			? [{ label: "Winner", names: [winner.name], loops: winner.loops, distance: dist(winner.loops), won: true }]
			: [];

	return {
		heroRows,
		starters,
		winner: winner ? { name: winner.name, loops: winner.loops, distance: dist(winner.loops) } : null,
		runnerUp: runnerUp ? { name: runnerUp.name, loops: runnerUp.loops } : null,
		standings,
		duel,
		dropouts: {
			biggest: { loop: biggestLoop, stopped: stoppedAfter[biggestLoop], distance: dist(biggestLoop) },
			milestones,
			halfLoops,
		},
		dayNight,
		laps,
		gender,
		loopDistance: dist(1),
		startLabel: bellLabel(1, startHour, null),
	};
}

/**
 * The compact file the browser charts read (see expandLapFile in
 * src/js/backyard-charts.js): n "Last First", d display name, g sex, t loops,
 * l loop times "m:ss".
 */
function lapFile(data) {
	return {
		runners: data.runners.map((r) => {
			const parts = r.name.trim().split(/\s+/);
			return {
				n: parts.length > 1 ? `${parts[parts.length - 1]} ${parts.slice(0, -1).join(" ")}` : r.name,
				d: r.name,
				g: (r.sex || "").toLowerCase(),
				t: r.loops,
				l: r.laps.map((sec) => clock(sec)),
			};
		}),
	};
}

module.exports = { raceModel, lapFile, clock, median, bellLabel };
