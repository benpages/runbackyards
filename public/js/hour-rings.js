/*
 * Hour rings: one runner's whole race, one ring per loop.
 * Each ring starts at 12 o'clock (the bell) and runs clockwise for the loop
 * time. The gap before 12 is the rest. Loop 1 is the smallest ring.
 *
 * Draws the winner's rings in the race hero, and any runner's rings when their
 * row in the results table is opened. Reads the same laps.json as the charts.
 */
(function () {
	const NS = "http://www.w3.org/2000/svg";
	const css = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

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

	// Same night rule as the charts: a loop that starts from 9 pm to before 6 am.
	const isNight = (startHour, i) => {
		const h = (startHour + i) % 24;
		return h >= 21 || h < 6;
	};

	function drawRings(laps, startHour, size) {
		const ink = css("--ink", "#1d1d1f");
		const night = "#b8b8bd";
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
			path.setAttribute("stroke", i === n - 1 ? accent : isNight(startHour, i) ? night : ink);
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

	function ringFigure(runner, startHour, size, caption) {
		const fig = document.createElement("figure");
		fig.className = "ring-figure";
		const svg = drawRings(runner.laps, startHour, size);
		svg.setAttribute("role", "img");
		svg.setAttribute("aria-label", `${runner.name}: ${runner.laps.length} loops, one ring per loop`);
		fig.appendChild(svg);
		if (caption) {
			const cap = document.createElement("figcaption");
			cap.textContent = caption;
			fig.appendChild(cap);
		}
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

		// 1. Winner in the hero.
		const hero = document.querySelector("[data-hero-ring]");
		if (hero) {
			const runner = byName.get((hero.dataset.heroRing || "").toLowerCase());
			if (runner) {
				hero.appendChild(ringFigure(runner, opts.startHour, 360, `${runner.name}'s race. One ring per loop, the first in the middle. The gap before the top is rest.`));
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
				const tr = document.createElement("tr");
				tr.className = "ring-row";
				const td = document.createElement("td");
				td.colSpan = cols;
				const wrap = document.createElement("div");
				wrap.className = "ring-detail";
				wrap.appendChild(ringFigure(runner, opts.startHour, 220));
				const facts = document.createElement("dl");
				facts.className = "ring-facts";
				[["Loops", runner.laps.length], ["Rest banked", restLabel(s.rest)], ["Slowest loop", `${clock(s.slowest)}, on loop ${s.slowestLoop}`]].forEach(([k, v]) => {
					const d = document.createElement("div");
					d.innerHTML = `<dt>${k}</dt><dd>${v}</dd>`;
					facts.appendChild(d);
				});
				const note = document.createElement("p");
				note.className = "ring-note";
				note.textContent = "One ring per loop, the first in the middle. The gap before the top is rest. Gray rings are night loops.";
				facts.appendChild(note);
				wrap.appendChild(facts);
				td.appendChild(wrap);
				tr.appendChild(td);
				row.after(tr);
				row.classList.add("is-open");
				row.setAttribute("aria-expanded", "true");
			};
			row.addEventListener("click", toggle);
			row.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
		});

		// Filtering or showing more rows closes any open ring.
		document.querySelectorAll(".standings-search, [data-standings-group] button, [data-standings-toggle]").forEach((el) => {
			el.addEventListener(el.matches("input") ? "input" : "click", closeAll);
		});
	}

	window.HourRings = { init };
})();
