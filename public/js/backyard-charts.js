(function () {
	const PALETTE = [
		{ color: "#C0392B", dash: [] },
		{ color: "#922B21", dash: [6, 3] },
		{ color: "#1A5276", dash: [] },
		{ color: "#2471A3", dash: [5, 3] },
		{ color: "#D35400", dash: [] },
		{ color: "#1E8449", dash: [4, 2] },
		{ color: "#117A65", dash: [] },
		{ color: "#0E6655", dash: [6, 2] },
		{ color: "#7D3C98", dash: [] },
		{ color: "#6C3483", dash: [4, 2] },
		{ color: "#4A235A", dash: [2, 2] },
		{ color: "#B7950B", dash: [] },
		{ color: "#935116", dash: [5, 2] },
		{ color: "#616A6B", dash: [] },
		{ color: "#2C3E50", dash: [3, 3] },
	];

	const LEGEND_INITIAL = 15;
	const TEXT_COLOR = "#999";
	const GRID_COLOR = "rgba(0,0,0,0.06)";

	function toLapMin(time) {
		if (!time) {
			return null;
		}
		const parts = time.split(":").map(Number);
		if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) {
			return null;
		}
		return parts[0] + parts[1] / 60;
	}

	function fmtMin(minutes) {
		const mins = Math.floor(minutes);
		const secs = Math.round((minutes - mins) * 60);
		return `${mins}:${String(secs).padStart(2, "0")}`;
	}

	function todStr(lapNum, startHour) {
		const hour = (startHour + lapNum - 1) % 24;
		if (hour === 0) {
			return "12 am";
		}
		if (hour < 12) {
			return `${hour} am`;
		}
		if (hour === 12) {
			return "12 pm";
		}
		return `${hour - 12} pm`;
	}

	function nightBands(startHour, maxLap) {
		const bands = [];
		let open = null;

		for (let i = 1; i <= maxLap + 1; i++) {
			const hour = (startHour + i - 1) % 24;
			const isNight = hour >= 21 || hour < 6;
			if (isNight && open === null) {
				open = i - 1.5;
			}
			if (!isNight && open !== null) {
				bands.push([open, i - 1.5]);
				open = null;
			}
		}

		if (open !== null) {
			bands.push([open, maxLap - 0.5]);
		}

		return bands;
	}

	function fullDisplayName(stored) {
		const parts = stored.trim().split(" ");
		if (parts.length < 2) {
			return stored;
		}
		return `${parts.slice(1).join(" ")} ${parts[0]}`;
	}

	function buildRaceresultUrl(race) {
		const host = race.host || "my4";
		const extra = race.extraParams || "";
		return `https://${host}.raceresult.com/${race.eventId}/${race.page}/list?key=${race.apiKey}&listname=${encodeURIComponent(race.listname)}&page=${race.page}${extra}`;
	}

	function parseRaceresultData(apiData, race) {
		const rows = [];

		Object.entries(apiData).forEach(([key, lapRows]) => {
			if (!Array.isArray(lapRows)) {
				return;
			}

			let athleteName;
			let totalLaps;

			if (key.includes(" /// ")) {
				const namePart = key.split(" /// ")[0]
					.replace(/^#\d+_/, "")   // strip "#123_" rank prefix
					.replace(/^#/, "")         // strip bare "#" if no rank
					.replace(/\s*\|.*$/, "")   // strip " | AUS" nationality suffix
					.trim();
				const commaIdx = namePart.indexOf(", ");
				athleteName =
					commaIdx !== -1
						? `${namePart.substring(0, commaIdx)} ${namePart.substring(commaIdx + 2)}`
						: namePart;
				const match = key.match(/(\d+) Laps?/i);
				totalLaps = match ? parseInt(match[1], 10) : lapRows.length;
			} else {
				const parts = key.split("///");
				const displayName = (parts[1] || "").trim();
				const nameParts = displayName.split(" ");
				athleteName =
					nameParts.length >= 2
						? `${nameParts[nameParts.length - 1]} ${nameParts.slice(0, -1).join(" ")}`
						: displayName;
				const match = (parts[2] || "").match(/(\d+)/);
				totalLaps = match ? parseInt(match[1], 10) : lapRows.length;
			}

			lapRows.forEach((row) => {
				if (!Array.isArray(row)) {
					return;
				}

				let lapNum;
				let finishTime;
				let restTime;

				if (row.length >= 7 && String(row[3]).startsWith("Lap")) {
					// G1M format: [col, bib, flag, "LapN", cp, finishTime, rest]
					lapNum = parseInt(String(row[3]).replace(/\D/g, ""), 10);
					finishTime = row[5];
					restTime = row[6];
				} else if (String(row[1]).startsWith("Yard")) {
					// Sydney format: [icon, "Yard N", startTime, lapTime, ...]
					lapNum = parseInt(String(row[1]).replace(/\D/g, ""), 10);
					finishTime = row[3];
					restTime = row[4];
				} else if (row.length >= 6) {
					// Big's format: [flag, bib, lapNum, cumulativeTime, finishTime, rest]
					lapNum = parseInt(row[2], 10);
					finishTime = row[4];
					restTime = row[5];
				} else {
					return;
				}

				if (!isNaN(lapNum) && finishTime) {
					rows.push({
						athlete: athleteName,
						race: race.id,
						total_laps: totalLaps,
						lap: `Lap${lapNum}`,
						finish_time: finishTime,
						rest_time: restTime,
					});
				}
			});
		});

		return rows;
	}

	function buildPaceData(rows) {
		const athleteMap = {};

		rows.forEach((row) => {
			if (!athleteMap[row.athlete]) {
				athleteMap[row.athlete] = {
					total: +row.total_laps,
					laps: {},
				};
			}

			const lapNum = parseInt((row.lap || "").replace(/\D/g, ""), 10);
			if (!isNaN(lapNum)) {
				athleteMap[row.athlete].laps[lapNum] = toLapMin(row.finish_time);
			}
		});

		const sorted = Object.entries(athleteMap).sort(([, a], [, b]) => b.total - a.total);
		const maxLap = Math.max(...sorted.map(([, athlete]) => athlete.total));
		const labels = Array.from({ length: maxLap }, (_, i) => `L${i + 1}`);
		const datasets = sorted.map(([name, athlete], index) => {
			const style = PALETTE[index % PALETTE.length];
			return {
				label: `${name.split(" ")[0]} (${athlete.total})`,
				fullName: name,
				totalLaps: athlete.total,
				data: Array.from({ length: maxLap }, (_, i) => athlete.laps[i + 1] ?? null),
				borderColor: style.color,
				backgroundColor: "transparent",
				borderWidth: 2,
				pointRadius: 0,
				pointHoverRadius: 5,
				tension: 0.3,
				borderDash: style.dash,
				spanGaps: false,
			};
		});

		return { sorted, maxLap, labels, datasets };
	}

	function chartStep(maxLap) {
		if (maxLap > 60) {
			return 10;
		}
		if (maxLap > 30) {
			return 5;
		}
		if (maxLap > 15) {
			return 2;
		}
		return 1;
	}

	function buildStatsHtml(rows, sorted, maxLap, maxLabel) {
		const winnerName = sorted[0] ? fullDisplayName(sorted[0][0]) : "";
		const allTimes = rows.map((row) => toLapMin(row.finish_time)).filter(Boolean);
		const avgTime = allTimes.reduce((sum, time) => sum + time, 0) / allTimes.length;

		return `
	<div class="stat"><div class="stat-label">Runners</div><div class="stat-value">${sorted.length}</div></div>
	<div class="stat"><div class="stat-label">${maxLabel}</div><div class="stat-value">${maxLap}</div><div class="stat-sub">${winnerName}</div></div>
	<div class="stat"><div class="stat-label">Avg lap (all)</div><div class="stat-value">${fmtMin(avgTime)}</div></div>
	<div class="stat"><div class="stat-label">Race duration</div><div class="stat-value">${maxLap}h</div><div class="stat-sub">~${(maxLap / 24).toFixed(1)} days</div></div>
`;
	}

	function buildNightAnnotations(race, maxLap) {
		const annotations = {};
		if (race.startHour === undefined) {
			return annotations;
		}

		nightBands(race.startHour, maxLap).forEach(([start, end], index) => {
			annotations[`night${index}`] = {
				type: "box",
				xMin: start,
				xMax: end,
				yMin: 38,
				yMax: 62,
				backgroundColor: "rgba(20,30,90,0.07)",
				borderWidth: 0,
			};

			const mid = Math.round((start + end) / 2);
			if (mid < maxLap - 1) {
				annotations[`nightLabel${index}`] = {
					type: "label",
					xValue: mid,
					yValue: 61.3,
					content: `Night ${index + 1}`,
					font: { size: 9 },
					color: "rgba(20,40,120,0.35)",
				};
			}
		});

		return annotations;
	}

	function makePaceChartConfig({ labels, datasets, race, maxLap }) {
		const step = chartStep(maxLap);
		const hasStartTime = race.startHour !== undefined;

		return {
			type: "line",
			data: { labels, datasets },
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: false,
				interaction: {
					mode: "index",
					intersect: false,
				},
				plugins: {
					legend: { display: false },
					annotation: {
						annotations: buildNightAnnotations(race, maxLap),
					},
					tooltip: {
						callbacks: {
							title: (ctx) => {
								const lap = ctx[0].dataIndex + 1;
								return hasStartTime ? `Loop ${lap} · ${todStr(lap, race.startHour)}` : `Loop ${lap}`;
							},
							label: (ctx) => (ctx.parsed.y != null ? ` ${ctx.dataset.label}: ${fmtMin(ctx.parsed.y)}` : null),
							filter: (item) => item.parsed.y != null,
						},
					},
				},
				scales: {
					x: {
						min: "L1",
						max: "L3",
						ticks: {
							color: TEXT_COLOR,
							font: { size: 10 },
							maxRotation: 0,
							autoSkip: false,
							callback(_value, index) {
								return (index + 1) % step === 0 || index === 0 ? labels[index] : "";
							},
						},
						grid: { color: GRID_COLOR },
					},
					y: {
						min: 38,
						max: 62,
						title: {
							display: true,
							text: "Lap finish time (min)",
							color: TEXT_COLOR,
							font: { size: 11 },
						},
						ticks: {
							color: TEXT_COLOR,
							font: { size: 11 },
							callback: (value) => `${value} min`,
						},
						grid: { color: GRID_COLOR },
					},
				},
			},
		};
	}

	function createLegendController({ chartRef, datasetsRef, maxLapRef, legendEl, searchInput }) {
		function applyVisibleRange() {
			const chart = chartRef();
			if (!chart) {
				return;
			}

			let max = 0;
			datasetsRef().forEach((dataset, index) => {
				if (chart.isDatasetVisible(index)) {
					max = Math.max(max, dataset.totalLaps);
				}
			});
			chart.options.scales.x.max = `L${max || maxLapRef()}`;
			chart.update("none");
		}

		function syncLegendItems() {
			const chart = chartRef();
			if (!chart) {
				return;
			}

			legendEl.querySelectorAll(".leg-item[data-idx]").forEach((item) => {
				const index = parseInt(item.dataset.idx, 10);
				const visible = chart.isDatasetVisible(index);
				item.classList.toggle("on", visible);
				item.classList.toggle("off", !visible);
			});
		}

		function setVisibility(predicate) {
			const chart = chartRef();
			if (!chart) {
				return;
			}

			datasetsRef().forEach((dataset, index) => {
				chart.setDatasetVisibility(index, predicate(dataset, index));
			});
			applyVisibleRange();
			syncLegendItems();
		}

		function buildLegend() {
			const chart = chartRef();
			legendEl.innerHTML = "";

			datasetsRef().forEach((dataset, index) => {
				const item = document.createElement("div");
				item.className = "leg-item";
				item.dataset.idx = index;
				item.dataset.name = `${dataset.fullName} ${dataset.label}`.toLowerCase();
				if (index >= LEGEND_INITIAL) {
					item.style.display = "none";
				}

				const swatch = document.createElement("canvas");
				swatch.width = 24;
				swatch.height = 12;
				swatch.className = "leg-swatch";
				swatch.style.cssText = "width:24px;height:12px";

				const ctx = swatch.getContext("2d");
				ctx.strokeStyle = dataset.borderColor;
				ctx.lineWidth = 2.5;
				if (dataset.borderDash && dataset.borderDash.length) {
					ctx.setLineDash(dataset.borderDash);
				}
				ctx.beginPath();
				ctx.moveTo(0, 6);
				ctx.lineTo(24, 6);
				ctx.stroke();

				const name = document.createElement("span");
				name.className = "leg-name";
				name.textContent = dataset.label;

				item.appendChild(swatch);
				item.appendChild(name);
				item.style.setProperty("border-left-color", dataset.borderColor);
				item.addEventListener("click", () => {
					const isVisible = chart.isDatasetVisible(index);
					chart.setDatasetVisibility(index, !isVisible);
					item.classList.toggle("on", !isVisible);
					item.classList.toggle("off", isVisible);
					applyVisibleRange();
				});

				legendEl.appendChild(item);
			});

			if (datasetsRef().length > LEGEND_INITIAL) {
				const more = document.createElement("button");
				more.className = "show-more-btn";
				more.id = "showMoreBtn";
				more.textContent = `+${datasetsRef().length - LEGEND_INITIAL} more runners`;
				more.addEventListener("click", () => {
					legendEl.querySelectorAll(".leg-item[data-idx]").forEach((item) => {
						item.style.display = "";
					});
					more.remove();
				});
				legendEl.appendChild(more);
			}
		}

		if (searchInput) {
			searchInput.addEventListener("input", () => {
				const term = searchInput.value.toLowerCase().trim();
				const showMoreBtn = legendEl.querySelector("#showMoreBtn");

				if (term) {
					if (showMoreBtn) {
						showMoreBtn.style.display = "none";
					}
					legendEl.querySelectorAll(".leg-item[data-idx]").forEach((item) => {
						item.style.display = (item.dataset.name || "").includes(term) ? "" : "none";
					});
					return;
				}

				if (showMoreBtn) {
					showMoreBtn.style.display = "";
					legendEl.querySelectorAll(".leg-item[data-idx]").forEach((item) => {
						item.style.display = parseInt(item.dataset.idx, 10) >= LEGEND_INITIAL ? "none" : "";
					});
				} else {
					legendEl.querySelectorAll(".leg-item[data-idx]").forEach((item) => {
						item.style.display = "";
					});
				}
			});
		}

		return { applyVisibleRange, buildLegend, setVisibility, syncLegendItems };
	}

	function renderDNFChart({ rows, race, canvas, existingChart }) {
		const athleteTotals = {};
		rows.forEach((row) => {
			athleteTotals[row.athlete] = Math.max(athleteTotals[row.athlete] || 0, +row.total_laps + 1);
		});

		const maxLap = Math.max(...Object.values(athleteTotals));
		const counts = {};
		Object.values(athleteTotals).forEach((total) => {
			counts[total] = (counts[total] || 0) + 1;
		});

		const labels = Array.from({ length: maxLap }, (_, i) => `L${i + 1}`);
		const data = labels.map((_, i) => counts[i + 1] || 0);
		const colors = data.map((_value, i) => (i + 1 === maxLap ? "#C0392B" : "rgba(26,26,26,0.75)"));
		const step = maxLap > 60 ? 10 : maxLap > 30 ? 5 : 1;
		const plugins = window.ChartDataLabels ? [window.ChartDataLabels] : [];

		if (existingChart) {
			existingChart.destroy();
		}

		return new Chart(canvas, {
			type: "bar",
			plugins,
			data: {
				labels,
				datasets: [
					{
						data,
						backgroundColor: colors,
						borderRadius: 2,
						borderSkipped: false,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: false,
				plugins: {
					legend: { display: false },
					datalabels: {
						anchor: "end",
						align: "top",
						color: "#777",
						font: {
							size: 9,
							weight: "600",
						},
						formatter: (value) => (value === 0 ? "" : value),
					},
					tooltip: {
						callbacks: {
							title: (ctx) =>
								`Loop ${ctx[0].dataIndex + 1}` +
								(race.startHour !== undefined ? ` · ${todStr(ctx[0].dataIndex + 1, race.startHour)}` : ""),
							label: (ctx) => {
								const count = ctx.parsed.y;
								if (count === 0) {
									return null;
								}
								const noun = `runner${count > 1 ? "s" : ""}`;
								return ctx.dataIndex + 1 === maxLap
									? ` ${count} ${noun} won the race`
									: ` ${count} ${noun} finished their race here`;
							},
							filter: (item) => item.parsed.y > 0,
						},
					},
				},
				scales: {
					x: {
						grid: { display: false },
						ticks: {
							color: TEXT_COLOR,
							font: { size: 9 },
							maxRotation: 0,
							autoSkip: false,
							callback(_value, index) {
								return (index + 1) % step === 0 || index === 0 ? labels[index] : "";
							},
						},
					},
					y: {
						beginAtZero: true,
						max: Math.max(...data) + 1,
						ticks: {
							color: TEXT_COLOR,
							font: { size: 10 },
							stepSize: 1,
						},
						grid: { color: GRID_COLOR },
					},
				},
			},
		});
	}

	function registerChartPlugins() {
		if (window.Chart && window["chartjs-plugin-annotation"]) {
			Chart.register(window["chartjs-plugin-annotation"]);
		}
	}

	function createPaceRenderer(options) {
		let paceChart = null;
		let currentDatasets = [];
		let globalMaxLap = 0;
		const canvas = document.getElementById(options.canvasId);
		const legendEl = document.getElementById(options.legendId || "legend");
		const searchInput = document.getElementById(options.searchInputId || "runnerSearch");

		const legend = createLegendController({
			chartRef: () => paceChart,
			datasetsRef: () => currentDatasets,
			maxLapRef: () => globalMaxLap,
			legendEl,
			searchInput,
		});

		const btnTop = document.getElementById("btnTop2");
		const btnAll = document.getElementById("btnAll");
		const btnNone = document.getElementById("btnNone");
		if (btnTop) btnTop.addEventListener("click", () => legend.setVisibility((_d, i) => i < 2));
		if (btnAll) btnAll.addEventListener("click", () => legend.setVisibility(() => true));
		if (btnNone) btnNone.addEventListener("click", () => legend.setVisibility(() => false));

		function render(rows, race) {
			const paceData = buildPaceData(rows);
			currentDatasets = paceData.datasets;
			globalMaxLap = paceData.maxLap;

			if (options.statsEl) {
				options.statsEl.innerHTML = buildStatsHtml(rows, paceData.sorted, paceData.maxLap, options.maxStatLabel || "Most laps");
			}

			if (paceChart) {
				paceChart.destroy();
			}

			paceChart = new Chart(canvas, makePaceChartConfig({
				labels: paceData.labels,
				datasets: currentDatasets,
				race,
				maxLap: paceData.maxLap,
			}));

			legend.buildLegend();
			legend.setVisibility((_dataset, index) => index < 2);
		}

		return { render };
	}

	async function fetchRows(race) {
		const response = await fetch(buildRaceresultUrl(race));
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}

		const json = await response.json();
		if (!json.data) {
			throw new Error("'data' field missing");
		}

		const rows = parseRaceresultData(json.data, race);
		if (!rows.length) {
			throw new Error("No lap rows parsed");
		}

		return rows;
	}

	function showLoadError(statusEl, message, localFileHint) {
		let displayMessage = message;
		if (message.includes("Failed to fetch")) {
			displayMessage += localFileHint;
		}
		statusEl.textContent = displayMessage;
		statusEl.className = "status error";
	}

	function createRacePage({ race, paceCanvasId = "paceChart", dnfCanvasId = "dnfChart" }) {
		registerChartPlugins();

		const statusEl = document.getElementById("status");
		const mainEl = document.getElementById("main");
		const statsEl = document.getElementById("statsRow");
		const pace = createPaceRenderer({
			canvasId: paceCanvasId,
			statsEl,
			maxStatLabel: "Winning loops",
		});
		let dnfChart = null;

		fetchRows(race)
			.then((rows) => {
				pace.render(rows, race);
				dnfChart = renderDNFChart({
					rows,
					race,
					canvas: document.getElementById(dnfCanvasId),
					existingChart: dnfChart,
				});
				statusEl.style.display = "none";
				mainEl.style.display = "block";
			})
			.catch((error) => {
				showLoadError(statusEl, `Could not load data: ${error.message}.`, " Possible CORS issue - open from backyards.run.");
			});
	}

	function createPaceTool({ races, canvasId = "chart" }) {
		registerChartPlugins();

		let allRows = [];
		const statusEl = document.getElementById("status");
		const mainEl = document.getElementById("main");
		const statsEl = document.getElementById("statsRow");
		const raceSelect = document.getElementById("raceSelect");
		const searchInput = document.getElementById("runnerSearch");
		const pace = createPaceRenderer({
			canvasId,
			statsEl,
			maxStatLabel: "Most laps",
		});

		raceSelect.innerHTML = races.map((race) => `<option value="${race.id}">${race.label}</option>`).join("");

		async function loadRace(race) {
			statusEl.textContent = `Loading ${race.label}...`;
			statusEl.className = "status";
			statusEl.style.display = "block";
			mainEl.style.display = "none";
			searchInput.value = "";

			try {
				const raceRows = await fetchRows(race);
				allRows = allRows.filter((row) => row.race !== race.id).concat(raceRows);
				pace.render(allRows.filter((row) => row.race === race.id), race);
				statusEl.style.display = "none";
				mainEl.style.display = "block";
			} catch (error) {
				showLoadError(
					statusEl,
					`Could not load ${race.label}: ${error.message}.`,
					" Possible CORS issue - open from backyards.run, not a local file.",
				);
			}
		}

		raceSelect.addEventListener("change", () => {
			const race = races.find((item) => item.id === raceSelect.value);
			if (race) {
				loadRace(race);
			}
		});

		if (races.length > 0) {
			loadRace(races[0]);
		}
	}

	window.BackyardCharts = {
		createPaceTool,
		createRacePage,
		parseRaceresultData,
	};
})();
