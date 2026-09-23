const { DateTime } = require("luxon");
const { genderSummary } = require("./lib/gender");
const { lapFile, raceModel } = require("./lib/race");

module.exports = function (eleventyConfig) {
	eleventyConfig.addPassthroughCopy("./src/css");
	eleventyConfig.addPassthroughCopy("./src/js");
	eleventyConfig.addPassthroughCopy("./src/assets");
	eleventyConfig.addPassthroughCopy("src/_redirects");
	eleventyConfig.addPassthroughCopy("src/favicon.svg");

	eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

	// Fixed decimal places, so numeric columns line up (536.0 km, not 536 km).
	eleventyConfig.addFilter("fixed", (value, places = 1) =>
		Number(value).toFixed(places),
	);

	// Women vs men numbers for the shared race-gender include.
	// Usage: {% set gender = someRaceLaps | genderSummary({ loopDistance: 6.7056, distanceUnit: "km" }) %}
	eleventyConfig.addFilter("genderSummary", (payload, opts) => genderSummary(payload, opts));

	// The race page model (lib/race.js). Used by _includes/race-page.njk:
	// {% set r = raceData[race.slug] | raceModel(race) %}
	eleventyConfig.addFilter("raceModel", (data, race) => raceModel(data, race));

	// Compact per-race lap file for the charts (src/race-laps.njk).
	eleventyConfig.addFilter("lapFile", (data) => lapFile(data));

	eleventyConfig.addFilter("postDate", (dateObj) => {
		return DateTime.fromJSDate(dateObj).toLocaleString(DateTime.DATE_MED);
	});

	// Add a filter to format dates for structured data
	eleventyConfig.addFilter("isoDate", function (date) {
		return date.toISOString();
	});

	eleventyConfig.addFilter(
		"excludeFromCollection",
		(collection = [], pageUrl = this.ctx.page.url) => {
			return collection.filter((post) => post.url !== pageUrl);
		},
	);

	return {
		dir: {
			input: "src",
			output: "public",
		},
	};
};
