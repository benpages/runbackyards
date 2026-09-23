#!/usr/bin/env node
/**
 * Sydney's Backyard Ultra 2026 (September) — lap splits + gender fetcher
 *
 * Writes src/_data/raceData/sydney-2026-sept.json, the standard race data file
 * that every template race page reads (see lib/race.js for the shape).
 * Names already in that file are kept, so hand-tidied spellings survive a re-run.
 *
 * Where the data comes from (checked in the browser on 23 Sep 2026):
 *
 *   Laps list   /420967/details1/list  listname=Laps
 *     One key per runner, "#N_Justin MAKHLOUF | AUS  /// 66 Laps /// Total Time: …".
 *     The "N Laps" in the key counts loops STARTED, not completed.
 *     Rows: [bib, id, flag, loopNum, startClock, cp1, cp2, cp3, finishClock, lapTime, …]
 *     lapTime (col 9, "mm:ss") is blank on the loop a runner did not finish.
 *     Also holds two unnamed chips ("N.n. 773", "N.n. 775") that are not in the results.
 *
 *   Results list  /420967/results/list  listname=Results
 *     Unfiltered, its row order is the official finishing order (place).
 *     No gender column, but the page's Gender filter works as the `f` param:
 *     f = "<Gender>\f<Ignore>"  with Gender one of Women / Men / Agender.
 *     Row col 0 = bib, col 10 = loops completed.
 *
 *   The results stayed "live" after the race: on 23 Sep the timer corrected one
 *   runner (bib 678) from 33 to 32 loops. Re-run this before publishing.
 *
 * Run it with:   node scripts/fetch-sydney-2026-sept.mjs
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "src", "_data", "raceData", "sydney-2026-sept.json");
const CACHE = path.join(ROOT, ".cache");

const HOST = "https://my4.raceresult.com";
const EVENT = "420967";
const KEY = "b71449a8ea7e021fe7593f3acc460ee9";
const START_HOUR = 8;

// Site label -> code stored in the data file. Agender runners are kept in the
// file as "X" and left out of both the women and men groups on the page.
const GENDERS = { Women: "F", Men: "M", Agender: "X" };

const UA =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
	"(KHTML, like Gecko) Chrome/127.0 Safari/537.36";

const log = (msg = "") => process.stdout.write(`${msg}\n`);

function toSeconds(clock) {
	if (!clock || !String(clock).trim()) return null;
	const parts = String(clock).trim().split(":").map(Number);
	if (parts.some(Number.isNaN)) return null;
	if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
	if (parts.length === 2) return parts[0] * 60 + parts[1];
	return null;
}

async function fetchJson(url) {
	const res = await fetch(url, {
		headers: { "User-Agent": UA, Accept: "*/*", Referer: `https://my.raceresult.com/${EVENT}/` },
	});
	if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
	return JSON.parse(await res.text());
}

/** Every plain row in a (possibly grouped) list response. */
function flat(node, out = []) {
	if (Array.isArray(node)) {
		if (node.length && node.every((c) => c === null || typeof c !== "object")) out.push(node);
		else node.forEach((n) => flat(n, out));
	} else if (node && typeof node === "object") {
		Object.values(node).forEach((n) => flat(n, out));
	}
	return out;
}

/** "Justin MAKHLOUF | AUS" -> "Justin Makhlouf". Only used when the existing file has no name. */
function tidyName(raw) {
	const s = raw.replace(/^#\d+_/, "").replace(/\s*\|.*$/, "").trim();
	return s.replace(/\S+/g, (w) =>
		w === w.toUpperCase() ? w.charAt(0) + w.slice(1).toLowerCase() : w,
	);
}

function clockFor(loop) {
	// Loop N starts at START_HOUR + (N - 1). Returned as day of running + hh:00.
	const h = START_HOUR + (loop - 1);
	return `day ${Math.floor(h / 24) + 1}, ${String(h % 24).padStart(2, "0")}:00`;
}

async function main() {
	await mkdir(CACHE, { recursive: true });

	await mkdir(path.dirname(OUT), { recursive: true });

	// Names already tidied by hand in the existing file, keyed by bib.
	const existingNames = new Map();
	try {
		const ex = JSON.parse(await readFile(OUT, "utf8"));
		ex.runners.forEach((r) => existingNames.set(String(r.bib), r.name));
	} catch {
		log("(No existing data file; names will be tidied from the feed.)");
	}

	// 0. Official finishing order
	const oq = new URLSearchParams({ key: KEY, listname: "Results", page: "results", contest: "0", r: "all", l: "0" });
	const officialRows = flat((await fetchJson(`${HOST}/${EVENT}/results/list?${oq}`)).data);
	const placeOf = new Map(officialRows.map((row, i) => [String(row[0]).trim(), i + 1]));

	// 1. Gender, one filtered request per group
	log("Fetching gender groups from the results list…");
	const results = new Map(); // bib -> { sex, loops }
	for (const [label, code] of Object.entries(GENDERS)) {
		const f = `${label}\f<Ignore>`;
		const q = new URLSearchParams({
			key: KEY, listname: "Results", page: "results", contest: "0", r: "all", l: "0", f,
		});
		const raw = await fetchJson(`${HOST}/${EVENT}/results/list?${q}`);
		await writeFile(path.join(CACHE, `sydney-sept-results-${label.toLowerCase()}.json`), JSON.stringify(raw));
		const rows = flat(raw.data);
		rows.forEach((row) => {
			const bib = String(row[0]).trim();
			if (results.has(bib)) throw new Error(`Bib ${bib} appears in two gender groups`);
			results.set(bib, { sex: code, loops: Number(row[10]) });
		});
		log(`  ${label}: ${rows.length}`);
	}

	// 2. Lap splits
	log("");
	log("Fetching lap splits…");
	const lq = new URLSearchParams({ key: KEY, listname: "Laps", page: "details1", r: "all", l: "0" });
	const lapsUrl = `${HOST}/${EVENT}/details1/list?${lq}`;
	const lapsRaw = await fetchJson(lapsUrl);
	await writeFile(path.join(CACHE, "sydney-sept-laps-raw.json"), JSON.stringify(lapsRaw));

	const runners = [];
	const dropped = [];
	const mismatches = [];
	for (const [key, block] of Object.entries(lapsRaw.data)) {
		const rows = flat(block);
		if (!rows.length) continue;
		const bib = String(rows[0][0]).trim();
		const res = results.get(bib);
		if (!res) {
			dropped.push(key.split(" /// ")[0]);
			continue;
		}
		const laps = rows
			.map((row) => ({ loop: Number(row[3]), seconds: toSeconds(row[9]) }))
			.filter((l) => Number.isFinite(l.loop) && l.seconds != null)
			.sort((a, b) => a.loop - b.loop);

		// Completed loops = loops with a lap time. Must equal the results list.
		if (laps.length !== res.loops) mismatches.push(`${bib}: ${laps.length} splits vs ${res.loops} in results`);
		// Splits must be contiguous from loop 1 and inside the hour.
		laps.forEach((l, i) => {
			if (l.loop !== i + 1) mismatches.push(`${bib}: loop ${l.loop} at position ${i + 1}`);
			if (l.seconds > 3600) mismatches.push(`${bib}: loop ${l.loop} took ${l.seconds}s`);
		});

		const keyParts = key.split(" /// ");
		const nation = (keyParts[0].split("|")[1] || "").trim() || null;
		const timeMatch = key.match(/Total Time:\s*([\d:]+)/);
		runners.push({
			place: placeOf.get(bib),
			bib,
			name: existingNames.get(bib) || tidyName(keyParts[0]),
			sex: res.sex,
			nation,
			loops: res.loops,
			time: timeMatch ? timeMatch[1] : null,
			laps: laps.map((l) => l.seconds),
		});
	}

	runners.sort((a, b) => a.place - b.place);
	const count = (s) => runners.filter((r) => r.sex === s).length;
	const counts = { F: count("F"), M: count("M"), X: count("X") };

	await writeFile(
		OUT,
		JSON.stringify(
			{
				meta: {
					event: "Sydney's Backyard Ultra 2026 (September)",
					eventId: EVENT,
					source: lapsUrl,
					genderSource: "Results list, Gender filter (Women / Men / Agender)",
					fetchedAt: new Date().toISOString(),
					notes: "place = official results order. loops = loops completed. time = official time on course. laps = seconds for each completed loop, loop 1 first. sex: F women, M men, X agender.",
				},
				runners,
			},
		),
	);

	// 3. Checks to paste back
	log("");
	log("Checks:");
	log(`  ${mismatches.length === 0 ? "PASS" : "FAIL"}  split counts match the results list for every runner`);
	mismatches.slice(0, 10).forEach((m) => log(`         ${m}`));
	log(`  ${runners.length === results.size ? "PASS" : "FAIL"}  ${runners.length} runners with splits, ${results.size} in results`);
	log(`  ${runners.every((r) => r.place) ? "PASS" : "FAIL"}  every runner has an official place`);
	log(`  INFO  dropped from Laps list (not in results): ${dropped.join(", ") || "none"}`);
	log(`  INFO  women ${counts.F} · men ${counts.M} · agender ${counts.X}`);

	const topW = runners.find((r) => r.sex === "F");
	const topM = runners.find((r) => r.sex === "M");
	const womenTied = runners.filter((r) => r.sex === "F" && r.loops === topW.loops).map((r) => r.name);
	log(`  INFO  top woman: ${womenTied.join(" and ")}, ${topW.loops} loops (her loop ${topW.loops} started ${clockFor(topW.loops)})`);
	log(`  INFO  top man: ${topM.name}, ${topM.loops} loops`);
	const place = runners.filter((r) => r.loops > topW.loops).length + 1;
	log(`  INFO  ${runners.filter((r) => r.loops > topW.loops).length} runners completed more loops than the top woman (tied-${place} on loops)`);

	log("");
	log(`Saved ${runners.length} runners to src/_data/raceData/sydney-2026-sept.json`);
	log("Paste this whole output back to Claude.");
}

main().catch((err) => {
	log("");
	log("Something went wrong:");
	log(String(err.stack || err));
	log("");
	log("Copy everything above and send it to Claude.");
	process.exitCode = 1;
});
