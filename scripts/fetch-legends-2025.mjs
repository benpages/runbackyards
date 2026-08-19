#!/usr/bin/env node
/**
 * Legends Backyard Ultra 2025 (Retie, Belgium) — lap data fetcher
 *
 * Classic raceresult.com API: one request returns every runner's full lap
 * splits (per raceresult.com/337369/details1). A second request pulls the
 * official standings (place, gender, total time) from the Final list.
 *
 * Run it with:   node scripts/fetch-legends-2025.mjs
 *
 * Writes: src/_data/legends2025.json
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "src", "_data", "legends2025.json");
const CACHE = path.join(ROOT, ".cache");

const HOST = "https://my2.raceresult.com";
const EVENT = "337369";
const KEY = "07708f8146716bea0992945f49ba2ead";
const LOOP_KM = 6.706;

const LAPS_LISTNAME = "Online|Ronden Details";
const LAPS_PAGE = "details1";

const FINAL_LISTNAME = "Online|Final";
const FINAL_PAGE = "results";

const UA =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
	"(KHTML, like Gecko) Chrome/127.0 Safari/537.36";

function log(msg) {
	process.stdout.write(`${msg}\n`);
}

function toTitleCase(str) {
	return str.replace(/\S+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
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

function buildUrl(listname, page) {
	const q = new URLSearchParams({ key: KEY, listname, page, r: "all", l: "0" });
	return `${HOST}/${EVENT}/${page}/list?${q}`;
}

async function fetchJson(url) {
	const res = await fetch(url, {
		headers: {
			"User-Agent": UA,
			Accept: "*/*",
			"Accept-Language": "en-GB,en;q=0.9",
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

/** Parse a "Last, First" or "First Last" key fragment into "Last First". */
function parseNameFragment(namePart) {
	const commaIdx = namePart.indexOf(", ");
	if (commaIdx !== -1) {
		return toTitleCase(`${namePart.substring(0, commaIdx)} ${namePart.substring(commaIdx + 2)}`);
	}
	const parts = namePart.trim().split(/\s+/);
	return toTitleCase(
		parts.length >= 2 ? `${parts[parts.length - 1]} ${parts.slice(0, -1).join(" ")}` : namePart,
	);
}

/**
 * data is keyed like "#1_1///Aerts, Gunther///15 Ronden" → array of
 * [bib, id, lapNum, cumulativeDistance, lapSplitTime] rows, one per lap.
 * The 5th column is already the individual lap's split time (MM:SS), not
 * a cumulative elapsed clock — do not subtract between laps.
 */
function parseLaps(dataBlock) {
	const runners = [];

	Object.entries(dataBlock).forEach(([key, rows]) => {
		if (!Array.isArray(rows)) return;

		const parts = key.split("///");
		const namePart = (parts[1] || "").trim();
		const athleteName = parseNameFragment(namePart);
		const totalMatch = (parts[2] || "").match(/(\d+)/);
		const totalLaps = totalMatch ? parseInt(totalMatch[1], 10) : rows.length;
		const bibMatch = (parts[0] || "").match(/^#(\d+)_/);
		const bib = bibMatch ? Number(bibMatch[1]) : null;

		const laps = rows
			.filter((row) => Array.isArray(row) && row.length >= 5)
			.map((row) => {
				const lapNum = parseInt(row[2], 10);
				const splitTime = String(row[3]).includes("km") ? row[4] : row[3];
				const seconds = toSeconds(splitTime);
				return {
					loop: lapNum,
					time: splitTime,
					seconds,
					rest: seconds != null ? fmtClock(Math.max(0, 3600 - seconds)) : null,
					restSeconds: seconds != null ? Math.max(0, 3600 - seconds) : null,
				};
			})
			.filter((l) => !isNaN(l.loop) && l.time)
			.sort((a, b) => a.loop - b.loop);

		const totalSeconds = laps.reduce((sum, l) => sum + (l.seconds || 0), 0);

		runners.push({
			bib,
			name: athleteName,
			loops: totalLaps || laps.length,
			kilometres: ((totalLaps || laps.length) * LOOP_KM).toFixed(1),
			lapTimeTotal: fmtClock(totalSeconds),
			laps,
		});
	});

	return runners;
}

/**
 * Final standings rows are flat arrays; column order varies by event but
 * always includes bib, place/rank, name, gender and total time somewhere
 * in the first ~10 columns. We match purely on bib since that's reliable,
 * and keep the raw row so nothing is silently dropped.
 */
function parseStandings(dataBlock) {
	const out = [];
	const walk = (node) => {
		if (Array.isArray(node)) {
			const isRow = node.length >= 5 && node.every((c) => typeof c !== "object");
			if (isRow) out.push(node);
			else node.forEach(walk);
		} else if (node && typeof node === "object") {
			Object.values(node).forEach(walk);
		}
	};
	walk(dataBlock);
	return out;
}

async function main() {
	await mkdir(path.dirname(OUT), { recursive: true });
	await mkdir(CACHE, { recursive: true });

	log("Fetching lap-by-lap data…");
	const lapsRaw = await fetchJson(buildUrl(LAPS_LISTNAME, LAPS_PAGE));
	await writeFile(path.join(CACHE, "legends-2025-laps-raw.json"), JSON.stringify(lapsRaw, null, "\t"));

	if (!lapsRaw.data || typeof lapsRaw.data !== "object") {
		throw new Error(
			"Expected a top-level 'data' object in the laps response but didn't find one.\n" +
				"Raw response saved to .cache/legends-2025-laps-raw.json — send that to Claude.",
		);
	}

	const runners = parseLaps(lapsRaw.data);
	if (!runners.length) {
		throw new Error("Parsed 0 runners from the laps data. Send Claude .cache/legends-2025-laps-raw.json.");
	}
	log(`Parsed ${runners.length} runners from the laps list.`);

	log("Fetching final standings…");
	let standingsRows = [];
	try {
		const standingsRaw = await fetchJson(buildUrl(FINAL_LISTNAME, FINAL_PAGE));
		await writeFile(path.join(CACHE, "legends-2025-final-raw.json"), JSON.stringify(standingsRaw, null, "\t"));
		standingsRows = parseStandings(standingsRaw.data || standingsRaw);
		log(`Parsed ${standingsRows.length} rows from the final standings list.`);
		log(`Sample standings row: ${JSON.stringify(standingsRows[0])}`);
	} catch (err) {
		log(`Could not fetch/parse final standings (${err.message}). Continuing with lap data only.`);
	}

	// Keep the raw standings rows alongside runners so we can hand-map columns
	// once we've seen a real sample (raceresult's column order isn't fixed).
	runners.sort((a, b) => b.loops - a.loops || (a.bib || 0) - (b.bib || 0));
	runners.forEach((r, i) => {
		r.place = i + 1;
	});

	const payload = {
		meta: {
			race: "Legends Backyard Ultra 2025",
			eventId: EVENT,
			source: buildUrl(LAPS_LISTNAME, LAPS_PAGE),
			fetchedAt: new Date().toISOString(),
			runnerCount: runners.length,
			maxLoops: runners.reduce((n, r) => Math.max(n, r.loops), 0),
		},
		runners,
		standingsRowsRaw: standingsRows,
	};

	await writeFile(OUT, JSON.stringify(payload, null, "\t"));

	log("");
	log("Done.");
	log(`  ${runners.length} runners saved to src/_data/legends2025.json`);
	log(`  Winner: ${runners[0].name} — ${runners[0].loops} loops`);
	log("");
	log("Say it's done and Claude will take it from here.");
}

main().catch((err) => {
	log("");
	log("Something went wrong:");
	log(String(err.message || err));
	log("");
	log("Copy everything above and send it to Claude.");
	process.exitCode = 1;
});
