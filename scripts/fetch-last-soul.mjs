#!/usr/bin/env node
/**
 * Last Soul Ultra 2026 — lap data fetcher
 *
 * Pulls the final standings for every runner, then each runner's individual
 * page, and pulls the lap-by-lap splits out of it.
 *
 * Run it with:   node scripts/fetch-last-soul.mjs
 *
 * Safe to run more than once. Everything it downloads is kept in
 * .cache/last-soul/, so a second run only fetches what it missed.
 *
 * Writes: src/_data/lastSoul2026.json
 */

import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = path.join(ROOT, ".cache", "last-soul");
const OUT = path.join(ROOT, "src", "_data", "lastSoul2026.json");

const HOST = "https://my2.raceresult.com";
const EVENT = "412639";
const KEY = "ba611fd3bfb5ab244c5981802dc83d02";
const LISTNAME = "20 Ergebnislisten|Final";

// Be a good citizen: one request at a time, with a pause between each.
const DELAY_MS = 700;
const MAX_RETRIES = 3;

const UA =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
	"(KHTML, like Gecko) Chrome/127.0 Safari/537.36";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function log(msg) {
	process.stdout.write(`${msg}\n`);
}

async function fetchText(url, { referer } = {}) {
	let lastErr;
	for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
		try {
			const res = await fetch(url, {
				headers: {
					"User-Agent": UA,
					Accept: "*/*",
					"Accept-Language": "en-GB,en;q=0.9",
					...(referer ? { Referer: referer } : {}),
				},
			});
			if (!res.ok) {
				throw new Error(`HTTP ${res.status}`);
			}
			return await res.text();
		} catch (err) {
			lastErr = err;
			if (attempt < MAX_RETRIES) {
				await sleep(DELAY_MS * attempt * 2);
			}
		}
	}
	throw lastErr;
}

/**
 * Responses come back either as raw HTML or as JSON with HTML inside it.
 * Either way we want one flat string we can pattern-match against.
 */
function flatten(text) {
	const trimmed = text.trim();
	if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
		try {
			const parsed = JSON.parse(trimmed);
			const parts = [];
			const walk = (v) => {
				if (typeof v === "string") parts.push(v);
				else if (Array.isArray(v)) v.forEach(walk);
				else if (v && typeof v === "object") Object.values(v).forEach(walk);
			};
			walk(parsed);
			return parts.join("\n");
		} catch {
			/* fall through */
		}
	}
	return trimmed;
}

const decode = (s) =>
	String(s ?? "")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#0?39;/g, "'")
		.replace(/\s+/g, " ")
		.trim();

const toSeconds = (clock) => {
	if (!clock) return null;
	const parts = String(clock).trim().split(":").map(Number);
	if (parts.some(Number.isNaN)) return null;
	if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
	if (parts.length === 2) return parts[0] * 60 + parts[1];
	return null;
};

// ── Step 1: the standings list ──────────────────────────────────────────────

function standingsUrl() {
	const q = new URLSearchParams({
		key: KEY,
		listname: LISTNAME,
		page: "results",
		contest: "0",
		r: "all",
		l: "0",
	});
	return `${HOST}/${EVENT}/results/list?${q}`;
}

async function getStandings() {
	const cached = path.join(CACHE, "standings.json");
	if (existsSync(cached)) {
		log("Standings: using the copy already downloaded.");
		return JSON.parse(await readFile(cached, "utf8"));
	}
	log("Standings: downloading…");
	const text = await fetchText(standingsUrl(), {
		referer: `${HOST}/${EVENT}/results`,
	});
	let json;
	try {
		json = JSON.parse(text);
	} catch {
		throw new Error(
			"The standings response was not JSON. First 400 characters:\n" +
				text.slice(0, 400),
		);
	}
	await writeFile(cached, JSON.stringify(json, null, "\t"));
	return json;
}

/**
 * Each standings row is a flat array. The first two entries are the runner's
 * bib and their internal id — the id is what the individual pages are keyed
 * on, NOT the bib. The rest follow the DataFields order:
 *   [BIB, ID, place, bib, name, overallRank, genderRank, sex, loops, time, gap]
 */
function participantsFromStandings(payload) {
	const buckets = payload?.data ?? payload;
	const out = [];
	const walk = (node) => {
		if (Array.isArray(node)) {
			const isRow = node.length > 8 && node.every((c) => typeof c !== "object");
			if (isRow) {
				const r = node.map(decode);
				out.push({
					bib: Number(r[0]),
					id: String(r[1]),
					place: r[2],
					listName: r[4],
					overallRank: r[5],
					genderRank: r[6],
					gender: r[7],
					officialLoops: Number(r[8]),
					totalTime: r[9],
					gap: r[10],
				});
			} else node.forEach(walk);
		} else if (node && typeof node === "object") {
			Object.values(node).forEach(walk);
		}
	};
	walk(buckets);
	return out;
}

// ── Step 2: each runner's individual page ───────────────────────────────────

const VIEW_SHAPES = [
	(id, page) =>
		`${HOST}/${EVENT}/${page}/view?lang=en&noVisitor=1&mid=0&standalone=false&pid=${id}`,
	(id, page) =>
		`${HOST}/${EVENT}/${page}/view?lang=en&noVisitor=1&mid=0&standalone=false&pid=${id}&key=${KEY}`,
	(id) =>
		`${HOST}/${EVENT}/RRPublish/data/view?lang=en&noVisitor=1&mid=0&standalone=false&pid=${id}&key=${KEY}`,
];
const VIEW_PAGES = ["results", "details1"];

let resolvedShape = null;

async function probeViewShape(sampleId) {
	log(`Working out the runner-page address (testing with runner ${sampleId})…`);
	for (const page of VIEW_PAGES) {
		for (const shape of VIEW_SHAPES) {
			const url = shape(sampleId, page);
			try {
				const text = await fetchText(url, {
					referer: `${HOST}/${EVENT}/results`,
				});
				const flat = flatten(text);
				if (flat.includes("lsu-chart") || flat.includes("lsu-name")) {
					log("Found it.");
					resolvedShape = { shape, page };
					return { url, text };
				}
			} catch {
				/* try the next one */
			}
			await sleep(DELAY_MS);
		}
	}
	throw new Error(
		"Could not find the address the runner pages are served from.\n" +
			"Send Claude this whole message and it will adjust the script.",
	);
}

async function getRunnerPage(id) {
	const cached = path.join(CACHE, `runner-${id}.html`);
	if (existsSync(cached)) return await readFile(cached, "utf8");
	const url = resolvedShape.shape(id, resolvedShape.page);
	const text = await fetchText(url, { referer: `${HOST}/${EVENT}/results` });
	await writeFile(cached, text);
	await sleep(DELAY_MS);
	return text;
}

// ── Step 3: pull the numbers out of the page ────────────────────────────────

function parseRunner(rawHtml) {
	const html = flatten(rawHtml).replace(/\\"/g, '"').replace(/\\\//g, "/");

	const one = (re) => {
		const m = html.match(re);
		return m ? decode(m[1]) : null;
	};

	const labelled = (label, valueClass) => {
		const re = new RegExp(
			`<(?:div|span) class="lab"[^>]*>\\s*${label}\\s*</(?:div|span)>\\s*` +
				`<(?:div|span) class="${valueClass}[^"]*"[^>]*>([^<]+)</(?:div|span)>`,
			"i",
		);
		return one(re);
	};

	const laps = [];
	const barRe =
		/<div class="b">\s*<div class="bf"[^>]*>\s*<b>([0-9:]+)<\/b>\s*<\/div>\s*<i>(\d+)<\/i>(?:\s*<u>([0-9:]+)<\/u>)?/g;
	let m;
	while ((m = barRe.exec(html)) !== null) {
		laps.push({
			loop: Number(m[2]),
			time: m[1],
			seconds: toSeconds(m[1]),
			rest: m[3] ?? null,
			restSeconds: toSeconds(m[3]),
		});
	}
	laps.sort((a, b) => a.loop - b.loop);

	const meta = decode(one(/<span class="lsu-nat">([^<]+)<\/span>/) ?? "");
	const bibMatch = meta.match(/BIB\s*(\d+)/i);
	const natMatch = meta.match(/^([A-Z]{2,3})\b/);

	return {
		name: one(/<h1 class="lsu-name">([^<]+)<\/h1>/),
		nationality: natMatch ? natMatch[1] : null,
		bib: bibMatch ? Number(bibMatch[1]) : null,
		status: one(/<span class="lsu-chip[^"]*">([^<]+)<\/span>/),
		kilometres: one(/<div class="lsu-bigv">([^<]+)<\/div>/),
		yards: labelled("Yards", "lsu-mcv"),
		lastLoop: labelled("Last loop", "lsu-mcv"),
		avgLoop: labelled("Avg loop", "lsu-mcv"),
		timeOnCourse: labelled("Time on course", "lsu-mcv"),
		position: labelled("Position", "lsu-kvv"),
		restBanked: labelled("Rest banked", "lsu-kvv"),
		laps,
	};
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
	await mkdir(CACHE, { recursive: true });
	await mkdir(path.dirname(OUT), { recursive: true });

	const standings = await getStandings();
	const entrants = participantsFromStandings(standings);
	if (!entrants.length) {
		throw new Error(
			"No runners found in the standings. Send Claude the file at\n" +
				path.join(CACHE, "standings.json"),
		);
	}
	log(`Found ${entrants.length} runners in the standings.`);

	await probeViewShape(entrants[0].id);

	const runners = [];
	const failed = [];
	let done = 0;

	for (const entrant of entrants) {
		try {
			const html = await getRunnerPage(entrant.id);
			const parsed = parseRunner(html);
			if (!parsed.name) throw new Error("no name found on the page");
			if (parsed.bib && parsed.bib !== entrant.bib) {
				throw new Error(
					`page for id ${entrant.id} shows bib ${parsed.bib}, expected ${entrant.bib}`,
				);
			}
			if (parsed.laps.length !== entrant.officialLoops) {
				log(
					`  note: ${parsed.name} has ${parsed.laps.length} splits but ` +
						`${entrant.officialLoops} loops in the standings`,
				);
			}
			runners.push({
				id: entrant.id,
				bib: entrant.bib,
				name: parsed.name,
				gender: entrant.gender,
				place: entrant.place,
				overallRank: entrant.overallRank,
				genderRank: entrant.genderRank,
				loops: entrant.officialLoops,
				totalTime: entrant.totalTime,
				gap: entrant.gap,
				kilometres: parsed.kilometres,
				avgLoop: parsed.avgLoop,
				timeOnCourse: parsed.timeOnCourse,
				restBanked: parsed.restBanked,
				laps: parsed.laps,
			});
		} catch (err) {
			failed.push({ id: entrant.id, bib: entrant.bib, reason: err.message });
		}
		done++;
		if (done % 20 === 0 || done === entrants.length) {
			log(`  ${done} of ${entrants.length} runners done`);
		}
	}

	runners.sort((a, b) => b.loops - a.loops || a.bib - b.bib);

	const payload = {
		meta: {
			race: "Last Soul Ultra 2026",
			eventId: EVENT,
			source: `${HOST}/${EVENT}/results`,
			fetchedAt: new Date().toISOString(),
			runnerCount: runners.length,
			maxLoops: runners.reduce((n, r) => Math.max(n, r.loops), 0),
			withSplits: runners.filter((r) => r.laps.length > 0).length,
		},
		runners,
	};

	await writeFile(OUT, JSON.stringify(payload, null, "\t"));

	log("");
	log("Done.");
	log(`  ${runners.length} runners saved to src/_data/lastSoul2026.json`);
	log(`  Longest run: ${payload.meta.maxLoops} loops`);
	log(`  ${payload.meta.withSplits} of them have lap-by-lap splits`);
	if (failed.length) {
		log("");
		log(`  ${failed.length} could not be read:`);
		failed
			.slice(0, 15)
			.forEach((f) => log(`    bib ${f.bib} (id ${f.id}): ${f.reason}`));
		log("  Send this list to Claude if it looks wrong.");
	}
}

main().catch((err) => {
	log("");
	log("Something went wrong:");
	log(String(err.message || err));
	log("");
	log("Copy everything above and send it to Claude.");
	process.exitCode = 1;
});
