// Static SVG charts for the mockups. Geometry only: every color, font and weight
// comes from the direction's CSS via these classes:
//   .ch-night .ch-night-label .ch-grid .ch-axis .ch-tick .ch-ytick
//   .ch-bar (.is-night .is-peak .is-milestone .is-last) .ch-val .ch-ann .ch-ann-line
//   .ch-line (.s0 .s1 ...) .ch-dot .ch-end-label
// Size the viewBox close to the rendered width so CSS px font sizes stay true.

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const n = (v) => Math.round(v * 10) / 10;

function frame({ w, h, pad }) {
	const [t, rt, b, l] = pad;
	return { x0: l, x1: w - rt, y0: t, y1: h - b, iw: w - l - rt, ih: h - t - b };
}

function nightBands(f, nights, xOf, band, { label = true, labelY } = {}) {
	return nights.map(([a, z], i) => {
		const x = xOf(a) - band / 2, xe = xOf(z) + band / 2;
		return `<rect class="ch-night" x="${n(x)}" y="${f.y0}" width="${n(xe - x)}" height="${f.ih}"/>` +
			(label ? `<text class="ch-night-label" x="${n(x + 4)}" y="${labelY ?? f.y0 + 12}">Night ${i + 1}</text>` : "");
	}).join("");
}

function xTicks(f, loops, xOf, every, y, prefix = "L") {
	let s = "";
	for (let k = 1; k <= loops; k++) {
		if (k === 1 || k % every === 0) s += `<text class="ch-tick" x="${n(xOf(k))}" y="${y}" text-anchor="middle">${prefix}${k}</text>`;
	}
	return s;
}

/**
 * Dropouts bar chart.
 * opts: w, h, pad [t,r,b,l], gap (0..1), radius, every (x tick step), yStep, values ("all" | "big" | "none"),
 *       valueMin, milestones [{loop,label}], annotate [{loop,text,dy}], nightLabels, yAxis, grid, prefix
 */
export function dnfChart(data, opts) {
	const o = { gap: 0.28, radius: 0, every: 10, yStep: 20, values: "big", valueMin: 15, milestones: [], annotate: [], nightLabels: true, yAxis: true, grid: true, prefix: "L", peak: true, ...opts };
	const f = frame(o);
	const bars = data.dnf, loops = bars.length;
	const max = Math.max(...bars.map((b) => b.stopped));
	const yMax = Math.ceil(max / o.yStep) * o.yStep;
	const band = f.iw / loops, bw = band * (1 - o.gap);
	const xOf = (k) => f.x0 + band * (k - 0.5);
	const yOf = (v) => f.y1 - (v / yMax) * f.ih;
	const ms = new Map(o.milestones.map((m) => [m.loop, m.label]));
	let s = `<svg class="ch ch-dnf" viewBox="0 0 ${o.w} ${o.h}" role="img" aria-label="Bar chart of how many runners stopped at each loop.">`;
	s += nightBands(f, data.nights, xOf, band, { label: o.nightLabels });
	if (o.grid) for (let v = o.yStep; v <= yMax; v += o.yStep) s += `<line class="ch-grid" x1="${f.x0}" x2="${f.x1}" y1="${n(yOf(v))}" y2="${n(yOf(v))}"/>`;
	if (o.yAxis) for (let v = 0; v <= yMax; v += o.yStep) s += `<text class="ch-ytick" x="${f.x0 - 8}" y="${n(yOf(v) + 3.5)}" text-anchor="end">${v}</text>`;
	bars.forEach((b) => {
		const x = xOf(b.loop) - bw / 2, y = yOf(b.stopped), hh = f.y1 - y;
		const cls = ["ch-bar", b.night && "is-night", o.peak && b.stopped === max && "is-peak", ms.has(b.loop - 1) && "is-milestone"].filter(Boolean).join(" ");
		if (b.stopped > 0) s += `<rect class="${cls}" x="${n(x)}" y="${n(y)}" width="${n(bw)}" height="${n(hh)}" rx="${o.radius}"/>`;
		const show = o.values === "all" ? b.stopped > 0 : o.values === "big" ? b.stopped >= o.valueMin : false;
		if (show) s += `<text class="ch-val${b.stopped === max ? " is-peak" : ""}" x="${n(xOf(b.loop))}" y="${n(y - 5)}" text-anchor="middle">${b.stopped}</text>`;
	});
	// Winner: the last loop, finished alone.
	s += `<circle class="ch-winner" cx="${n(xOf(loops))}" cy="${f.y1 - 4}" r="4"/>`;
	o.annotate.forEach((a) => {
		const b = bars[a.loop - 1], x = xOf(a.loop), y = yOf(b.stopped) - (a.dy ?? 26);
		s += `<line class="ch-ann-line" x1="${n(x)}" x2="${n(x)}" y1="${n(y + 4)}" y2="${n(yOf(b.stopped) - 16)}"/>`;
		s += `<text class="ch-ann" x="${n(x + (a.dx ?? 0))}" y="${n(y)}" text-anchor="${a.anchor || "middle"}">${esc(a.text)}</text>`;
	});
	s += `<line class="ch-axis" x1="${f.x0}" x2="${f.x1}" y1="${f.y1}" y2="${f.y1}"/>`;
	s += xTicks(f, loops, xOf, o.every, f.y1 + 16, o.prefix);
	return s + "</svg>";
}

/**
 * Line chart of loop times (seconds).
 * series: [{ values, cls, label }]. opts: w, h, pad, yMin, yMax (minutes), yStep, every, dots, endLabels, curve
 */
export function lineChart(data, series, opts) {
	const o = { yMin: 38, yMax: 62, yStep: 5, every: 10, dots: false, endLabels: false, grid: true, nightLabels: true, loops: data.winnerLoops, prefix: "L", aria: "Line chart of loop times.", ...opts };
	const f = frame(o);
	const band = f.iw / o.loops;
	const xOf = (k) => f.x0 + band * (k - 0.5);
	const yOf = (sec) => f.y1 - ((sec / 60 - o.yMin) / (o.yMax - o.yMin)) * f.ih;
	let s = `<svg class="ch ch-line-chart" viewBox="0 0 ${o.w} ${o.h}" role="img" aria-label="${esc(o.aria)}">`;
	s += nightBands(f, data.nights.filter(([a]) => a <= o.loops).map(([a, z]) => [a, Math.min(z, o.loops)]), xOf, band, { label: o.nightLabels });
	for (let v = Math.ceil(o.yMin / o.yStep) * o.yStep; v <= o.yMax; v += o.yStep) {
		if (o.grid) s += `<line class="ch-grid" x1="${f.x0}" x2="${f.x1}" y1="${n(yOf(v * 60))}" y2="${n(yOf(v * 60))}"/>`;
		s += `<text class="ch-ytick" x="${f.x0 - 8}" y="${n(yOf(v * 60) + 3.5)}" text-anchor="end">${v}${o.yUnit ?? ""}</text>`;
	}
	series.forEach((se) => {
		const pts = se.values.map((v, i) => [xOf(i + 1), yOf(v)]);
		s += `<polyline class="ch-line ${se.cls}" points="${pts.map(([x, y]) => `${n(x)},${n(y)}`).join(" ")}"/>`;
		if (o.dots) pts.forEach(([x, y]) => (s += `<circle class="ch-dot ${se.cls}" cx="${n(x)}" cy="${n(y)}" r="${o.dots}"/>`));
		if (o.endLabels && se.label) {
			const [x, y] = pts[pts.length - 1];
			s += `<text class="ch-end-label ${se.cls}" x="${n(x + 8)}" y="${n(y + (se.labelDy || 0) + 4)}">${esc(se.label)}</text>`;
		}
	});
	(o.marks || []).forEach((m) => {
		const x = xOf(m.loop), y = yOf(m.sec);
		s += `<circle class="ch-mark" cx="${n(x)}" cy="${n(y)}" r="${m.r || 5}"/>`;
		s += `<text class="ch-ann" x="${n(x + (m.dx ?? 0))}" y="${n(y + (m.dy ?? -12))}" text-anchor="${m.anchor || "middle"}">${esc(m.text)}</text>`;
	});
	s += `<line class="ch-axis" x1="${f.x0}" x2="${f.x1}" y1="${f.y1}" y2="${f.y1}"/>`;
	s += xTicks(f, o.loops, xOf, o.every, f.y1 + 16, o.prefix);
	return s + "</svg>";
}

/**
 * One dot per runner who stopped, stacked per loop. Vertical (columns) or horizontal (rows, for phones).
 * opts: w, pad, across (dots side by side per loop, vertical only), pitch, r, horizontal, every
 */
export function dotChart(data, opts) {
	const o = { across: 3, every: 10, horizontal: false, ...opts };
	const bars = data.dnf, loops = bars.length, [t, rt, b, l] = o.pad;
	let s = "", w, h;
	if (!o.horizontal) {
		const band = (o.w - l - rt) / loops, pitch = band / o.across, rows = Math.ceil(Math.max(...bars.map((x) => x.stopped)) / o.across);
		h = t + rows * pitch + b; w = o.w;
		const y1 = h - b, xOf = (k) => l + band * (k - 1);
		data.nights.forEach(([a, z]) => (s += `<rect class="ch-night" x="${n(xOf(a))}" y="${t}" width="${n(band * (z - a + 1))}" height="${n(rows * pitch)}"/>`));
		bars.forEach((bar) => {
			for (let i = 0; i < bar.stopped; i++) {
				const cx = xOf(bar.loop) + pitch * (i % o.across + 0.5), cy = y1 - pitch * (Math.floor(i / o.across) + 0.5);
				s += `<circle class="ch-dot-r${bar.night ? " is-night" : ""}" cx="${n(cx)}" cy="${n(cy)}" r="${o.r}"/>`;
			}
			if (bar.stopped >= (o.valueMin ?? 40)) s += `<text class="ch-val" x="${n(xOf(bar.loop) + band / 2)}" y="${n(y1 - pitch * Math.ceil(bar.stopped / o.across) - 6)}" text-anchor="middle">${bar.stopped}</text>`;
		});
		s += `<circle class="ch-winner" cx="${n(xOf(loops) + band / 2)}" cy="${n(y1 - pitch / 2)}" r="${n(pitch * 0.9)}"/>`;
		s += `<line class="ch-axis" x1="${l}" x2="${w - rt}" y1="${n(y1 + 2)}" y2="${n(y1 + 2)}"/>`;
		for (let k = 1; k <= loops; k++) if (k === 1 || k % o.every === 0) s += `<text class="ch-tick" x="${n(xOf(k) + band / 2)}" y="${n(y1 + 18)}" text-anchor="middle">${k}</text>`;
	} else {
		const pitch = o.pitch, rowH = o.rowH ?? pitch;
		w = o.w; h = t + loops * rowH + b;
		const yOf = (k) => t + rowH * (k - 1);
		data.nights.forEach(([a, z]) => (s += `<rect class="ch-night" x="0" y="${n(yOf(a))}" width="${w}" height="${n(rowH * (z - a + 1))}"/>`));
		bars.forEach((bar) => {
			for (let i = 0; i < bar.stopped; i++) s += `<circle class="ch-dot-r${bar.night ? " is-night" : ""}" cx="${n(l + pitch * (i + 0.5))}" cy="${n(yOf(bar.loop) + rowH / 2)}" r="${o.r}"/>`;
			if (bar.stopped >= (o.valueMin ?? 40)) s += `<text class="ch-val" x="${n(l + pitch * bar.stopped + 6)}" y="${n(yOf(bar.loop) + rowH / 2 + 3.5)}">${bar.stopped}</text>`;
			if (bar.loop === 1 || bar.loop % o.every === 0) s += `<text class="ch-tick" x="${l - 8}" y="${n(yOf(bar.loop) + rowH / 2 + 3.5)}" text-anchor="end">${bar.loop}</text>`;
		});
		s += `<circle class="ch-winner" cx="${n(l + pitch / 2)}" cy="${n(yOf(loops) + rowH / 2)}" r="${n(rowH * 0.45)}"/>`;
		s += `<line class="ch-axis" x1="${l - 2}" x2="${l - 2}" y1="${t}" y2="${n(h - b)}"/>`;
	}
	return `<svg class="ch ch-dots" viewBox="0 0 ${w} ${n(h)}" role="img" aria-label="Dot chart. Each dot is one runner, placed at the loop they did not finish.">${s}</svg>`;
}

/** Loop-by-loop table. cell(sec, loopIndex, row) returns a class name for heat coloring. */
export function lapTable(data, { rows = data.lapTable, from = 1, to = data.winnerLoops, cell = () => "", nameFmt = (r) => r.name, cls = "laps" } = {}) {
	const head = Array.from({ length: to - from + 1 }, (_, i) => from + i)
		.map((k) => `<th scope="col" class="${data.isNight(k) ? "is-night" : ""}">${k}</th>`).join("");
	const body = rows.map((r) => {
		let tds = "";
		for (let k = from; k <= to; k++) {
			const sec = r.laps[k - 1];
			tds += sec == null ? `<td class="is-out${data.isNight(k) ? " is-night" : ""}"></td>` : `<td class="${cell(sec, k, r)}${data.isNight(k) ? " is-night" : ""}">${data.mmss(sec)}</td>`;
		}
		return `<tr><th scope="row"><span class="laps-place">${r.place}</span> ${nameFmt(r)}<span class="laps-total">${r.loops}</span></th>${tds}</tr>`;
	}).join("");
	return `<table class="${cls}"><thead><tr><th scope="col" class="laps-corner">Runner</th>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/** Relative speed of a loop for heat coloring: 0 fastest (<= 45:00) .. 4 slowest (>= 55:00). */
export const heat = (sec) => (sec < 2700 ? 0 : sec < 2880 ? 1 : sec < 3060 ? 2 : sec < 3240 ? 3 : 4);
