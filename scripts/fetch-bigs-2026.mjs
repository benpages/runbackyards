#!/usr/bin/env node
/**
 * Big's Backyard Ultra 2026 (Team USA, team world championship year): lap splits + gender
 *
 * Writes src/_data/raceData/bigs-2026.json, the standard race data file every
 * template race page reads (see lib/race.js for the shape).
 *
 * Where the data comes from (checked in the browser on 22 Oct 2026):
 *
 *   Lap Details  /428717/results/list  listname="Result Lists|Lap Details"
 *     One key per runner, "#1_1///Harvey Lewis///83Laps" (no spaces round ///).
 *     Rows: [bib, bib, loopNum, raceClock, lapSplit "mm:ss", rest "mm:ss"]
 *     Only completed loops have a row, so "N Laps" = loops COMPLETED.
 *
 *   Live Leaderboard  /428717/results/list  listname="Presenter/Announcer|Live Leaderboard"
 *     Row order is the official order (status, loops, race time) = place.
 *     Cols: [bib, bib, flag, place-or-status, name, sex M/F, age, city, state,
 *            lastLap, fastLap, hour#, avgLap, slowLap, hour#, laps, miles, km, raceTime, …]
 *     Status codes from the timer: RTC refused to continue, OVER over time on
 *     the loop, INC did not complete the loop, DQ disqualified. The winner shows "1".
 *
 * Results can stay "live" for a while after the race. Re-run before publishing.
 *
 * Run it with:   node scripts/fetch-bigs-2026.mjs
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "src", "_data", "raceData", "bigs-2026.json");
const CACHE = path.join(ROOT, ".cache");

const HOST = "https://my4.raceresult.com";
const EVENT = "428717";
const KEY = "362d1461d9c5fc7583415fb273f007b0";

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

const listUrl = (listname) =>
	`${HOST}/${EVENT}/results/list?${new URLSearchParams({
		key: KEY, listname, page: "results", contest: "0", r: "all", l: "0",
	})}`;

async function main() {
	await mkdir(CACHE, { recursive: true });
	await mkdir(path.dirname(OUT), { recursive: true });

	// 1. Leaderboard: place, sex, status, official race time
	log("Fetching the leaderboard…");
	const lbRaw = await fetchJson(listUrl("Presenter/Announcer|Live Leaderboard"));
	await writeFile(path.join(CACHE, "bigs-2026-leaderboard.json"), JSON.stringify(lbRaw));
	const board = new Map();
	flat(lbRaw.data).forEach((row, i) => {
		const bib = String(row[0]).trim();
		const flag = String(row[2] || "");
		const nation = (flag.match(/flags\/([A-Z]{2})\./) || [])[1];
		board.set(bib, {
			place: i + 1,
			status: /^\d+$/.test(String(row[3]).trim()) ? null : String(row[3]).trim(),
			name: String(row[4]).trim(),
			sex: String(row[5]).trim().toUpperCase() || null,
			nation: nation === "US" ? "USA" : nation || null,
			loops: Number(row[15]),
			time: String(row[18]).trim() || null,
		});
	});
	log(`  ${board.size} runners`);

	// 2. Lap splits
	log("Fetching lap splits…");
	const lapsUrl = listUrl("Result Lists|Lap Details");
	const lapsRaw = await fetchJson(lapsUrl);
	await writeFile(path.join(CACHE, "bigs-2026-laps-raw.json"), JSON.stringify(lapsRaw));

	const runners = [];
	const problems = [];
	for (const [key, block] of Object.entries(lapsRaw.data)) {
		const rows = flat(block);
		const [head, keyName, keyLaps] = key.split("///");
		const bib = head.replace(/^#\d+_/, "").trim();
		const b = board.get(bib);
		if (!b) {
			problems.push(`${key}: not on the leaderboard`);
			continue;
		}
		const laps = rows
			.map((row) => ({ loop: Number(row[2]), seconds: toSeconds(row[4]) }))
			.filter((l) => Number.isFinite(l.loop) && l.seconds != null)
			.sort((a, c) => a.loop - c.loop);

		if (laps.length !== b.loops) problems.push(`${bib}: ${laps.length} splits vs ${b.loops} laps on the leaderboard`);
		if (parseInt(keyLaps, 10) !== b.loops) problems.push(`${bib}: key says ${keyLaps}, leaderboard ${b.loops}`);
		if (keyName.trim() !== b.name) problems.push(`${bib}: name "${keyName}" vs "${b.name}"`);
		laps.forEach((l, i) => {
			if (l.loop !== i + 1) problems.push(`${bib}: loop ${l.loop} at position ${i + 1}`);
			if (l.seconds >= 3600) problems.push(`${bib}: loop ${l.loop} took ${l.seconds}s`);
		});

		runners.push({
			place: b.place,
			bib,
			name: b.name,
			sex: b.sex,
			nation: b.nation,
			loops: b.loops,
			time: b.time,
			status: b.status,
			laps: laps.map((l) => l.seconds),
		});
	}
	runners.sort((a, c) => a.place - c.place);

	await writeFile(
		OUT,
		JSON.stringify({
			meta: {
				event: "Big's Backyard Ultra 2026",
				eventId: EVENT,
				source: lapsUrl,
				placeSource: "Presenter/Announcer|Live Leaderboard list order (status, loops desc, race time)",
				fetchedAt: new Date().toISOString(),
				notes: "place = official leaderboard order. loops = loops completed. time = official race time. status = timer's code for how the race ended (RTC refused to continue, OVER over time on the loop, INC did not complete the loop; the winner has none). laps = seconds for each completed loop, loop 1 first.",
			},
			runners,
		}),
	);

	// 3. Checks to paste back
	const count = (s) => runners.filter((r) => r.sex === s).length;
	const top = runners.filter((r) => r.loops === Math.max(...runners.map((x) => x.loops)));
	log("");
	log("Checks:");
	log(`  ${problems.length === 0 ? "PASS" : "FAIL"}  splits, keys and names match the leaderboard`);
	problems.slice(0, 15).forEach((p) => log(`         ${p}`));
	log(`  ${runners.length === board.size ? "PASS" : "FAIL"}  ${runners.length} runners with splits, ${board.size} on the leaderboard`);
	log(`  ${runners.every((r) => r.place) ? "PASS" : "FAIL"}  every runner has a place`);
	log(`  ${top.length === 1 && top[0].place === 1 && !top[0].status ? "PASS" : "FAIL"}  one winner, in first place: ${top.map((r) => r.name).join(", ")} (${top[0].loops})`);
	log(`  INFO  women ${count("F")} · men ${count("M")} · total loops ${runners.reduce((n, r) => n + r.loops, 0)}`);
	log("");
	log(`Saved ${runners.length} runners to src/_data/raceData/bigs-2026.json`);
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
