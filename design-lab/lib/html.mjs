// Small HTML helpers shared by the direction mockups.
export const ul = (items, cls = "") =>
	`<ul class="${cls}">${items.map(([a, b]) => `<li><strong>${a}</strong> ${b}</li>`).join("")}</ul>`;
export const ps = (arr, cls = "") => arr.map((p) => `<p${cls ? ` class="${cls}"` : ""}>${p}</p>`).join("");
export const both = (desk, mob) => `<div class="only-d">${desk}</div><div class="only-m">${mob}</div>`;
export const standingsRows = (d, fmt = (s) => s) =>
	d.top10.map((s, i) => `<tr class="${i === 0 ? "is-winner" : ""}${s.sex === "F" ? " is-f" : ""}"><td class="st-place">${s.place}</td><td class="st-name">${fmt(s.name, s)}</td><td class="st-loops">${s.loops}</td><td class="st-dist">${s.distance}</td><td class="st-time">${s.time}</td></tr>`).join("");
export const standoutLines = (d) => d.standout.lines.map((l) => `<p>${l}</p>`).join("");

export function page({ title, fonts, css, body }) {
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?${fonts}&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${css}">
</head>
<body>
${body}
</body>
</html>`;
}
