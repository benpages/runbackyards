/*
 * Hour rings: one runner's whole race, one ring per loop.
 * Each ring starts at 12 o'clock (the bell) and runs clockwise for the loop
 * time. The gap before 12 is the rest. Loop 1 is the smallest ring.
 *
 * Draws the winner's rings in the race hero, and any runner's rings when their
 * row in the results table is opened. Any ring opens larger, with the key, in
 * a dialog. Reads the same laps.json as the charts.
 */
(function () {
	const NS = "http://www.w3.org/2000/svg";
	const css = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
	const NIGHT = "#b8b8bd";

	// "53:24" or "1:02:10" -> seconds
	function toSeconds(t) {
		if (typeof t === "number") return t;
		const p = String(t).split(":").map(Number);
		return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
	}

	function clock(s) {
		const m = Math.floor(s / 60);
		const sec = Math.round(s % 60);
		return `${m}:${String(sec).padStart(2, "0")}`;
	}

	function restLabel(s) {
		const h = Math.floor(s / 3600);
		const m = Math.round((s % 3600) / 60);
		return h ? `${h} h ${m} min` : `${m} min`;
	}

	// Same night rule as the charts: a loop that starts from 9 pm to 5 am.
	const isNight = (startHour, i) => {
		const h = (startHour + i) % 24;
		return h >= 21 || h < 6;
	};

	function el(tag, cls, text) {
		const e = document.createElement(tag);
		if (cls) e.className = cls;
		if (text != null) e.textContent = text;
		return e;
	}

	function drawRings(laps, startHour, size) {
		const ink = css("--ink", "#1d1d1f");
		const accent = css("--accent", "#d9822b");
		const n = laps.length;
		const c = size / 2;
		const inner = size * 0.08;
		const outer = size / 2 - 2;
		const step = n > 1 ? (outer - inner) / (n - 1) : 0;
		const width = Math.max(0.5, Math.min(2.6, step * 0.5));

		const svg = document.createElementNS(NS, "svg");
		svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
		svg.setAttribute("class", "ring-svg");

		laps.forEach((s, i) => {
			const r = inner + i * step;
			const frac = Math.min(s, 3599) / 3600;
			const a = 2 * Math.PI * frac;
			const x = c + r * Math.sin(a);
			const y = c - r * Math.cos(a);
			const path = document.createElementNS(NS, "path");
			path.setAttribute("d", `M ${c} ${c - r} A ${r} ${r} 0 ${frac > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}`);
			path.setAttribute("fill", "none");
			path.setAttribute("stroke", i === n - 1 ? accent : isNight(startHour, i) ? NIGHT : ink);
			path.setAttribute("stroke-width", i === n - 1 ? Math.max(width * 1.8, 1.5) : width);
			svg.appendChild(path);
		});
		return svg;
	}

	function summary(laps) {
		const rest = laps.reduce((sum, s) => sum + Math.max(0, 3600 - s), 0);
		let slow = 0;
		laps.forEach((s, i) => { if (s > laps[slow]) slow = i; });
		return { rest, slowest: laps[slow], slowestLoop: slow + 1 };
	}

	// One loop, drawn large and labeled: the picture that explains all the others.
	function exampleLoop() {
		const ink = css("--ink", "#1d1d1f");
		const muted = css("--ink-3", "#86868b");
		const svg = document.createElementNS(NS, "svg");
		svg.setAttribute("viewBox", "0 0 150 128");
		svg.setAttribute("class", "ring-example");
		svg.setAttribute("aria-hidden", "true");
		const c = 64, r = 38, frac = 50 / 60;
		const a = 2 * Math.PI * frac;
		svg.innerHTML =
			`<path d="M ${c} ${c - r} A ${r} ${r} 0 1 1 ${(c + r * Math.sin(a)).toFixed(2)} ${(c - r * Math.cos(a)).toFixed(2)}" fill="none" stroke="${ink}" stroke-width="5"/>` +
			`<line x1="${c}" y1="${c - r - 9}" x2="${c}" y2="${c - r + 6}" stroke="${ink}" stroke-width="1.5"/>` +
			`<text x="${c}" y="${c - r - 13}" text-anchor="middle" font-size="11" font-weight="600" fill="${ink}">Bell</text>` +
			`<text x="${c + r + 10}" y="${c + 4}" font-size="11" fill="${muted}">Running</text>` +
			`<text x="${c - r - 6}" y="${c - r + 4}" text-anchor="end" font-size="11" fill="${muted}">Rest</text>` +
			`<text x="${c}" y="${c + 4}" text-anchor="middle" font-size="11" fill="${muted}">50 min</text>`;
		return svg;
	}

	function key(full) {
		const box = el("div", "ring-key");
		if (full) {
			box.appendChild(el("p", "ring-key-title", "How to read the rings"));
			const row = el("div", "ring-key-example");
			row.appendChild(exampleLoop());
			row.appendChild(el("p", "ring-key-text", "Each ring is one loop. The line starts at the bell at the top and shows the time spent running. The gap before the top is the rest before the next bell."));
			box.appendChild(row);
			box.appendChild(el("p", "ring-key-text", "Loop 1 is the small ring in the middle. Every loop after it is one ring further out."));
		}
		const list = el("ul", "ring-key-list");
		[["Day loop", css("--ink", "#1d1d1f")], ["Night loop, from 9 pm to 5 am", NIGHT], ["Last loop", css("--accent", "#d9822b")]].forEach(([label, color]) => {
			const li = el("li");
			const sw = el("span", "ring-swatch");
			sw.style.background = color;
			li.appendChild(sw);
			li.appendChild(document.createTextNode(label));
			list.appendChild(li);
		});
		box.appendChild(list);
		return box;
	}

	// ── The larger view ──────────────────────────────────────────────────────
	let dialog;
	function openLarge(runner, startHour, raceLabel) {
		if (!dialog) {
			dialog = el("dialog", "ring-dialog");
			dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
			document.body.appendChild(dialog);
		}
		dialog.replaceChildren();
		const s = summary(runner.laps);
		const close = el("button", "ring-close", "Close");
		close.type = "button";
		close.addEventListener("click", () => dialog.close());
		const ring = el("div", "ring-large");
		const svg = drawRings(runner.laps, startHour, 720);
		svg.setAttribute("role", "img");
		svg.setAttribute("aria-label", `${runner.name}: ${runner.laps.length} loops, one ring per loop`);
		ring.appendChild(svg);
		const side = el("div", "ring-side");
		side.appendChild(el("p", "ring-dialog-race", raceLabel));
		side.appendChild(el("h2", "ring-dialog-name", runner.name));
		side.appendChild(el("p", "ring-dialog-stats", `${runner.laps.length} loops. ${restLabel(s.rest)} of rest banked. Slowest loop ${clock(s.slowest)}, on loop ${s.slowestLoop}.`));
		side.appendChild(key(true));
		dialog.append(close, ring, side);
		dialog.showModal();
		close.focus();
	}

	function ringFigure(runner, opts, size, caption) {
		const fig = el("figure", "ring-figure");
		const btn = el("button", "ring-open");
		btn.type = "button";
		btn.setAttribute("aria-label", `See ${runner.name}'s rings larger, with the key`);
		btn.appendChild(drawRings(runner.laps, opts.startHour, size));
		btn.addEventListener("click", (e) => { e.stopPropagation(); openLarge(runner, opts.startHour, opts.raceLabel); });
		fig.appendChild(btn);
		const cap = el("figcaption");
		if (caption) cap.appendChild(el("span", "ring-caption", caption));
		const more = el("button", "ring-more", "See it larger, with the key");
		more.type = "button";
		more.addEventListener("click", (e) => { e.stopPropagation(); openLarge(runner, opts.startHour, opts.raceLabel); });
		cap.appendChild(more);
		fig.appendChild(cap);
		return fig;
	}

	async function init(opts) {
		const res = await fetch(opts.dataUrl);
		if (!res.ok) return;
		const json = await res.json();
		const byName = new Map();
		(json.runners || []).forEach((r) => {
			const name = r.d || r.n;
			const laps = (r.l || []).map(toSeconds).filter((s) => s > 0);
			if (laps.length) byName.set(name.toLowerCase(), { name, laps });
		});

		// 1. The winner, in the hero.
		const hero = document.querySelector("[data-hero-ring]");
		if (hero) {
			const runner = byName.get((hero.dataset.heroRing || "").toLowerCase());
			if (runner) {
				hero.appendChild(ringFigure(runner, opts, 360, `${runner.name}'s ${runner.laps.length} loops.`));
				hero.hidden = false;
			}
		}

		// 2. Any runner, from the results table.
		const table = document.querySelector(".standings");
		if (!table) return;
		const cols = table.querySelectorAll("thead th").length;

		function closeAll() {
			table.querySelectorAll("tr.ring-row").forEach((r) => r.remove());
			table.querySelectorAll("tr.is-open").forEach((r) => { r.classList.remove("is-open"); r.setAttribute("aria-expanded", "false"); });
		}

		table.querySelectorAll("tbody tr[data-name]").forEach((row) => {
			const runner = byName.get(row.dataset.name);
			if (!runner) return;
			row.classList.add("has-ring");
			row.tabIndex = 0;
			row.setAttribute("aria-expanded", "false");
			const toggle = () => {
				const open = row.classList.contains("is-open");
				closeAll();
				if (open) return;
				const s = summary(runner.laps);
				const tr = el("tr", "ring-row");
				const td = el("td");
				td.colSpan = cols;
				const wrap = el("div", "ring-detail");
				wrap.appendChild(ringFigure(runner, opts, 220));
				const side = el("div", "ring-detail-side");
				const facts = el("dl", "ring-facts");
				[["Loops", runner.laps.length], ["Rest banked", restLabel(s.rest)], ["Slowest loop", `${clock(s.slowest)}, on loop ${s.slowestLoop}`]].forEach(([k, v]) => {
					const d = el("div");
					d.append(el("dt", null, k), el("dd", null, String(v)));
					facts.appendChild(d);
				});
				side.appendChild(facts);
				side.appendChild(key(false));
				wrap.appendChild(side);
				td.appendChild(wrap);
				tr.appendChild(td);
				row.after(tr);
				row.classList.add("is-open");
				row.setAttribute("aria-expanded", "true");
			};
			row.addEventListener("click", toggle);
			row.addEventListener("keydown", (e) => {
				if (e.target !== row) return;
				if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
			});
		});

		// Filtering or showing more rows closes any open ring.
		document.querySelectorAll(".standings-search, [data-standings-group] button, [data-standings-toggle]").forEach((node) => {
			node.addEventListener(node.matches("input") ? "input" : "click", closeAll);
		});
	}

	window.HourRings = { init };
})();
