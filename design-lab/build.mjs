// Builds every direction mockup: node design-lab/build.mjs [n ...]
import { writeFileSync } from "node:fs";
import { data } from "./lib/data.mjs";
import { page } from "./lib/html.mjs";

const which = process.argv.slice(2).length ? process.argv.slice(2) : ["1", "2", "3", "4", "5", "6"];
for (const n of which) {
	const dir = new URL(`./direction-${n}/`, import.meta.url);
	const mod = await import(new URL("page.mjs", dir));
	writeFileSync(new URL("index.html", dir), page({ title: mod.title, fonts: mod.fonts, css: "style.css", body: mod.render(data) }));
	console.log(`direction-${n}: ${mod.title}`);
}
