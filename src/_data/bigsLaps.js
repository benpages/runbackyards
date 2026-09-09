const race = require("./bigs2025.json");

/**
 * The chart module keys athletes as "Last First" and flips them back for
 * display, so store them that way here rather than converting in the browser.
 */
function lastFirst(name) {
	const parts = String(name).trim().split(/\s+/);
	if (parts.length < 2) {
		return String(name).trim();
	}
	return `${parts[parts.length - 1]} ${parts.slice(0, -1).join(" ")}`;
}

module.exports = {
	race: "Bigs_2025",
	loopMi: 4.167,
	runners: race.runners.map((runner) => ({
		n: lastFirst(runner.name),
		t: runner.loops,
		l: runner.laps.map((lap) => lap.time),
		r: runner.laps.map((lap) => lap.rest),
	})),
};
