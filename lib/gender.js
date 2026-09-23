/**
 * Women vs men, shared by every race page.
 *
 * Works on the compact lap-file shape that the chart module already reads
 * (see expandLapFile in src/js/backyard-charts.js):
 *
 *   { runners: [ { n: "Last First", d?: "First Last", g: "f" | "m" | "x",
 *                  t: loopsCompleted, l: ["48:15", …] } ] }
 *
 * A race gets the women vs men section as soon as its lap file carries `g`.
 * Nothing here is race-specific.
 *
 * Runners whose `g` is anything other than women or men (Sydney Sept 2026
 * had two agender runners) are counted as "other" and left out of both groups.
 */

// A group's median line on the chart stops at the first loop that fewer than
// this many of its runners finished. The page reads it from here and hands it
// to the chart through a data attribute, so the copy and the chart agree.
const MIN_RUNNERS_FOR_MEDIAN = 10;

const WOMEN = new Set(["f", "w", "female", "women", "woman"]);
const MEN = new Set(["m", "male", "men", "man"]);

function normSex(value) {
	if (value == null) return null;
	const s = String(value).trim().toLowerCase();
	if (!s) return null;
	if (WOMEN.has(s)) return "F";
	if (MEN.has(s)) return "M";
	return "X";
}

/** "Makhlouf Justin" -> "Justin Makhlouf", unless a display name is stored. */
function displayName(runner) {
	if (runner.d) return runner.d;
	const parts = String(runner.n).trim().split(/\s+/);
	return parts.length < 2 ? parts[0] : `${parts.slice(1).join(" ")} ${parts[0]}`;
}

/**
 * Everything the race-gender include prints, computed from the data so no
 * number on the page is typed by hand.
 *
 * @param payload   compact lap file ({ runners })
 * @param opts      { loopDistance, distanceUnit, distanceDecimals }
 */
function genderSummary(payload, opts = {}) {
	const runners = (payload && payload.runners) || [];
	const tagged = runners.map((r) => ({ ...r, sex: normSex(r.g), loops: Number(r.t) || 0 }));

	const women = tagged.filter((r) => r.sex === "F").sort((a, b) => b.loops - a.loops);
	const men = tagged.filter((r) => r.sex === "M");
	const other = tagged.filter((r) => r.sex === "X");

	if (!women.length || !men.length) {
		return { has: false };
	}

	const loopDistance = opts.loopDistance || 6.7056;
	const unit = opts.distanceUnit || "km";
	const decimals = opts.distanceDecimals ?? 1;
	const dist = (loops) => `${(loops * loopDistance).toFixed(decimals)} ${unit}`;

	const topLoops = women[0].loops;
	const topWomen = women.filter((r) => r.loops === topLoops);
	const raceMax = Math.max(...tagged.map((r) => r.loops));
	const atRaceMax = tagged.filter((r) => r.loops === raceMax);
	const next = women.find((r) => r.loops < topLoops) || null;

	return {
		has: true,
		minRunners: MIN_RUNNERS_FOR_MEDIAN,
		women: women.length,
		men: men.length,
		other: other.length,
		starters: tagged.length,
		lastWoman: {
			names: topWomen.map(displayName),
			loops: topLoops,
			distance: dist(topLoops),
			// Loops completed, strictly more than hers. Ties with her are not "further".
			runnersFurther: tagged.filter((r) => r.loops > topLoops).length,
			wonRace: topWomen.length === 1 && atRaceMax.length === 1 && atRaceMax[0] === topWomen[0],
		},
		nextWoman: next
			? { name: displayName(next), loops: next.loops, behind: topLoops - next.loops }
			: null,
	};
}

module.exports = { MIN_RUNNERS_FOR_MEDIAN, normSex, displayName, genderSummary };
