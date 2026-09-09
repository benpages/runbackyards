#!/usr/bin/env node
/**
 * Big's Backyard Ultra 2025 (Bell Buckle, TN) — lap data fetcher
 *
 * Same job as scripts/fetch-legends-2025.mjs, different event and a different
 * row shape. Big's publishes the "Big's format" rows:
 *   [flag, bib, lapNum, cumulativeTime, lapSplitTime, rest]
 * and keys them "#N_bib///FirstName LastName///NLaps" (no spaces around the
 * slashes). See CLAUDE.md and src/js/backyard-charts.js for the other shapes.
 *
 * Run it with:   node scripts/fetch-bigs-2025.mjs
 *
 * Writes: src/_data/bigs2025.json
 * Also dumps every raw response to .cache/ so a shape surprise can be
 * diagnosed without re-running the fetch.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "src", "_data", "bigs2025.json");
const CACHE = path.join(ROOT, ".cache");

const HOST = "https://my2.raceresult.com";
const EVENT = "364272";
const KEY = "e35ba6322adb153e157d76e69096f692";
const LOOP_MI = 4.167;

const LAPS_LISTNAME = "Result Lists|Lap Details";
const LAPS_PAGE = "results";
const LAPS_EXTRA = { contest: "0", r: "all", l: "0" };

// The standings list name is not known for this event. The script tries each
// of these and keeps whichever responds with rows. Anything it finds is dumped
// to .cache/ so the columns can be mapped by hand afterwards.
const STANDINGS_CANDIDATES = [
	"Result Lists|Results",
	"Result Lists|Final",
	"Result Lists|Overall",
	"Online|Results",
	"Online|Final",
];

const UA =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
	"(KHTML, like Gecko) Chrome/127.0 Safari/537.36";

function log(msg) {
	process.stdout.write(`${msg}\n`);
}

/**
 * Only re-case a name that arrives SHOUTED. Names like "McKinney" and "DeMoss"
 * are common in a US field and blanket title-casing would quietly flatten them.
 */
function tidyCase(str) {
	if (str !== str.toUpperCase()) return str.trim();
	return str.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).trim();
}

function toSeconds(clock) {
	if (!clock) return null;
	const parts = String(clock).trim().split(":").map(Number);
	if (parts.some(Number.isNaN)) return null;
	if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
	if (parts.length === 2) return parts[0] * 60 + parts[1];
	return null;
}

function fmtClock(totalSeconds) {
	if (totalSeconds == null) return null;
	const h = Math.floor(totalSeconds / 3600);
	const m = Math.floor((totalSeconds % 3600) / 60);
	const s = Math.floor(totalSeconds % 60);
	return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function fmtMinutes(totalSeconds) {
	if (totalSeconds == null) return null;
	const m = Math.floor(totalSeconds / 60);
	const s = Math.floor(totalSeconds % 60);
	return `${m}:${String(s).padStart(2, "0")}`;
}

function buildUrl(listname, page, extra = {}) {
	const q = new URLSearchParams({ key: KEY, listname, page, ...extra });
	return `${HOST}/${EVENT}/${page}/list?${q}`;
}

async function fetchJson(url) {
	const res = await fetch(url, {
		headers: {
			"User-Agent": UA,
			Accept: "*/*",
			"Accept-Language": "en-US,en;q=0.9",
			Referer: `${HOST}/${EVENT}`,
		},
	});
	if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
	const text = await res.text();
	try {
		return JSON.parse(text);
	} catch {
		throw new Error("Response was not JSON. First 400 characters:\n" + text.slice(0, 400));
	}
}

/**
 * Normalise a name to natural reading order, "First Last".
 *
 * Note this differs from backyard-charts.js on purpose. The chart module
 * reverses to "Last First" because its legend pills key off the first token.
 * This file feeds the standings table, which prints the name as-is, so the
 * committed JSON matches lastSoul2026.json and legends2025.json: "Mark Dowdle",
 * not "Dowdle Mark".
 */
function parseNameFragment(namePart) {
	const cleaned = namePart
		.replace(/^#\d+_\d*/, "")
		.replace(/^#/, "")
		.replace(/\s*\|.*$/, "")
		.trim();
	const commaIdx = cleaned.indexOf(", ");
	if (commaIdx !== -1) {
		// "Gore, Phil" → "Phil Gore"
		return tidyCase(`${cleaned.substring(commaIdx + 2)} ${cleaned.substring(0, commaIdx)}`);
	}
	return tidyCase(cleaned);
}

/**
 * Pull the lap split out of one row. Big's rows are
 * [flag, bib, lapNum, cumulativeTime, lapSplitTime, rest], but the fetcher
 * stays tolerant: if column 4 does not look like a clock it falls back to
 * the other candidates rather than writing nulls into the data file.
 */
function readLapRow(row) {
	const lapNum = parseInt(row[2], 10);
	const candidates = [row[4], row[3], row[5]];
	for (const c of candidates) {
		const secs = toSeconds(c);
		// A lap split is a plausible loop time, never the multi-day race clock.
		if (secs != null && secs > 0 && secs <= 3 * 3600) {
			return { loop: lapNum, time: String(c).trim(), seconds: secs };
		}
	}
	return null;
}

function parseLaps(dataBlock) {
	const runners = [];

	Object.entries(dataBlock).forEach(([key, lapRows]) => {
		const rows = Array.isArray(lapRows)
			? lapRows
			: lapRows && typeof lapRows === "object"
				? Object.values(lapRows).flat()
				: null;
		if (!rows) return;

		const sep = key.includes(" /// ") ? " /// " : "///";
		const parts = key.split(sep);
		const namePart = sep === " /// " ? parts[0] : parts[1] || "";
		const name = parseNameFragment(namePart);

		const bibMatch = key.match(/^#\d+_(\d+)/) || key.match(/^#(\d+)_/);
		const bib = bibMatch ? Number(bibMatch[1]) : null;

		const lapCountMatch = key.match(/(\d+)\s*Laps?/i) || (parts[2] || "").match(/(\d+)/);

		const laps = rows
			.filter((r) => Array.isArray(r) && r.length >= 5)
			.map(readLapRow)
			.filter(Boolean)
			.filter((l) => !Number.isNaN(l.loop))
			.sort((a, b) => a.loop - b.loop)
			.map((l) => ({
				...l,
				rest: fmtMinutes(Math.max(0, 3600 - l.seconds)),
				restSeconds: Math.max(0, 3600 - l.seconds),
			}));

		if (!laps.length) return;

		const totalLaps = lapCountMatch ? parseInt(lapCountMatch[1], 10) : laps.length;
		const lapSeconds = laps.map((l) => l.seconds);
		const totalSeconds = lapSeconds.reduce((a, b) => a + b, 0);

		runners.push({
			bib,
			name,
			loops: totalLaps || laps.length,
			miles: ((totalLaps || laps.length) * LOOP_MI).toFixed(1),
			totalTime: fmtClock(totalSeconds),
			minLap: fmtMinutes(Math.min(...lapSeconds)),
			maxLap: fmtMinutes(Math.max(...lapSeconds)),
			avgLap: fmtMinutes(Math.round(totalSeconds / lapSeconds.length)),
			laps,
		});
	});

	return runners;
}

/** Flatten any nested list response down to its plain rows. */
function flattenRows(node, out = []) {
	if (Array.isArray(node)) {
		const isRow = node.length >= 5 && node.every((c) => typeof c !== "object");
		if (isRow) out.push(node);
		else node.forEach((n) => flattenRows(n, out));
	} else if (node && typeof node === "object") {
		Object.values(node).forEach((n) => flattenRows(n, out));
	}
	return out;
}

async function main() {
	await mkdir(path.dirname(OUT), { recursive: true });
	await mkdir(CACHE, { recursive: true });

	const lapsUrl = buildUrl(LAPS_LISTNAME, LAPS_PAGE, LAPS_EXTRA);
	log("Fetching lap-by-lap data…");
	log(`  ${lapsUrl}`);
	const lapsRaw = await fetchJson(lapsUrl);
	await writeFile(path.join(CACHE, "bigs-2025-laps-raw.json"), JSON.stringify(lapsRaw, null, "\t"));

	const dataBlock = lapsRaw.data || lapsRaw;
	if (!dataBlock || typeof dataBlock !== "object") {
		throw new Error(
			"No usable 'data' object in the laps response.\n" +
				"Raw response saved to .cache/bigs-2025-laps-raw.json — send that to Claude.",
		);
	}

	const sampleKey = Object.keys(dataBlock)[0];
	log(`  Sample key:  ${JSON.stringify(sampleKey)}`);
	const sampleRows = dataBlock[sampleKey];
	const firstRow = Array.isArray(sampleRows) ? sampleRows[0] : Object.values(sampleRows || {}).flat()[0];
	log(`  Sample row:  ${JSON.stringify(firstRow)}`);

	const runners = parseLaps(dataBlock);
	if (!runners.length) {
		throw new Error(
			"Parsed 0 runners. Send Claude the two sample lines above plus .cache/bigs-2025-laps-raw.json.",
		);
	}
	log(`Parsed ${runners.length} runners from the laps list.`);

	log("");
	log("Looking for a standings list…");
	const standings = { listname: null, rows: [] };
	for (const candidate of STANDINGS_CANDIDATES) {
		try {
			const raw = await fetchJson(buildUrl(candidate, LAPS_PAGE, { contest: "0", r: "all", l: "0" }));
			const rows = flattenRows(raw.data || raw);
			if (rows.length) {
				standings.listname = candidate;
				standings.rows = rows;
				await writeFile(
					path.join(CACHE, "bigs-2025-standings-raw.json"),
					JSON.stringify(raw, null, "\t"),
				);
				log(`  Found ${rows.length} rows in "${candidate}"`);
				log(`  Sample standings row: ${JSON.stringify(rows[0])}`);
				break;
			}
			log(`  "${candidate}" returned no rows`);
		} catch (err) {
			log(`  "${candidate}" failed (${err.message.split("\n")[0]})`);
		}
	}
	if (!standings.listname) {
		log("  No standings list found. Lap data alone still covers loops, times and pacing.");
	}

	runners.sort((a, b) => b.loops - a.loops || (a.bib || 0) - (b.bib || 0));
	runners.forEach((r, i) => {
		r.place = i + 1;
	});

	const payload = {
		meta: {
			race: "Big's Backyard Ultra 2025",
			eventId: EVENT,
			source: lapsUrl,
			fetchedAt: new Date().toISOString(),
			runnerCount: runners.length,
			maxLoops: runners.reduce((n, r) => Math.max(n, r.loops), 0),
			loopMiles: LOOP_MI,
			standingsListname: standings.listname,
		},
		runners,
		standingsRowsRaw: standings.rows,
	};

	await writeFile(OUT, JSON.stringify(payload, null, "\t"));

	log("");
	log("Done.");
	log(`  ${runners.length} runners saved to src/_data/bigs2025.json`);
	log(`  Winner: ${runners[0].name} — ${runners[0].loops} loops, ${runners[0].miles} mi`);
	log(`  Runner-up: ${runners[1] ? `${runners[1].name} — ${runners[1].loops} loops` : "n/a"}`);
	log("");
	log("Paste this whole output back to Claude and it will take it from there.");
}

main().catch((err) => {
	log("");
	log("Something went wrong:");
	log(String(err.message || err));
	log("");
	log("Copy everything above and send it to Claude.");
	process.exitCode = 1;
});
