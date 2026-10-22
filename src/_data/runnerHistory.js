/**
 * Backyard race history for runners featured in a race page's winner section.
 * A race page shows the strip by setting `race.winnerHistory: <key>` in front matter.
 *
 * One entry per backyard ultra, oldest first. loops = loops COMPLETED (yards).
 * Sources per runner in `source`. Keep this to backyard ultras only.
 */

const runners = {
	"mark-dowdle": {
		name: "Mark Dowdle",
		source: "yardlore.com and UltraSignup, checked 22 Oct 2026",
		races: [
			{ date: "2021-04-30", race: "Wausa\u00adUltra", loops: 21, win: false },
			{ date: "2022-04-29", race: "Wausa\u00adUltra", loops: 20, win: false },
			{ date: "2022-06-04", race: "Last Runner Standing", loops: 22, win: false },
			{ date: "2024-05-03", race: "Wausa\u00adUltra", loops: 34, win: true },
			{ date: "2025-05-02", race: "Wausa\u00adUltra", loops: 38, win: true },
			// yardlore lists 64 and marks the race unofficial; Dowdle's own reel says 63.
			{ date: "2025-09-19", race: "Last Dot Standing", loops: 64, win: true },
			{ date: "2025-11-22", race: "Summit Trail", loops: 68, win: true },
			{ date: "2026-04-10", race: "Go One More", loops: 73, win: true, url: "/races/g1m-2026/" },
			{ date: "2026-05-01", race: "Wausa\u00adUltra", loops: 31, win: true },
			{ date: "2026-08-14", race: "Last Soul", loops: 94, win: true, url: "/races/last-soul-2026/" },
			{ date: "2026-10-17", race: "Big's", loops: 107, win: true },
		],
	},
};

// Precompute what the template needs, so the .njk stays logic-free.
for (const r of Object.values(runners)) {
	const max = Math.max(...r.races.map((x) => x.loops));
	let prevYear = null;
	r.races = r.races.map((x) => {
		const year = x.date.slice(0, 4);
		const out = { ...x, year, newYear: year !== prevYear, pct: Math.round((x.loops / max) * 100) };
		prevYear = year;
		return out;
	});
	r.wins = r.races.filter((x) => x.win).length;
	r.starts = r.races.length;
}

module.exports = runners;
