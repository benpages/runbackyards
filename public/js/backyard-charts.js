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
		// HH:MM:SS (e.g. "00:43:58" from Sydney Yard Time) → convert to minutes
		if (parts.length === 3) {
			return parts[0] * 60 + parts[1] + parts[2] / 60;
		}
		// MM:SS (e.g. "43:58" from G1M / Big's)
		return parts[0] + parts[1] / 60;
	}

	// ── Women vs men ──────────────────────────────────────────────────────
	// Same rules as lib/gender.js (build time). Kept in step by hand: the
	// browser cannot require() that file.
	const GROUP_STYLE = {
		F: { label: "Women", color: "#C0392B" },
		M: { label: "Men", color: "#1A1A1A" },
	};
	// Fallback only. The page passes the real cutoff from lib/gender.js on the
	// canvas as data-min-runners, so the copy and the chart always agree.
	const MIN_RUNNERS_FOR_MEDIAN = 10;

	function normSex(value) {
		if (value == null) return null;
		const s = String(value).trim().toLowerCase();
		if (!s) return null;
		if (["f", "w", "female", "women", "woman"].includes(s)) return "F";
		if (["m", "male", "men", "man"].includes(s)) return "M";
		return "X";
	}

	function median(values) {
		const v = values.slice().sort((a, b) => a - b);
		const mid = Math.floor(v.length / 2);
		return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
	}

	/** True when the rows carry both women and men, so the gender views make sense. */
	function hasGender(rows) {
		const seen = new Set(rows.map((row) => row.sex));
		return seen.has("F") && seen.has("M");
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

	function toTitleCase(str) {
		return str.replace(/\S+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
	}

	// Names the timing system published in a form we would rather not show.
	// Keyed by the stored "Last First" name, value is the full display name.
	let displayOverrides = {};

	function fullDisplayName(stored) {
		if (displayOverrides[stored]) {
			return displayOverrides[stored];
		}
		const parts = stored.trim().split(" ");
		if (parts.length < 2) {
			return stored;
		}
		return `${parts.slice(1).join(" ")} ${parts[0]}`;
	}

	// The short name used on legend pills — normally the surname.
	function legendLabel(stored) {
		const override = displayOverrides[stored];
		if (override) {
			const parts = override.trim().split(" ");
			return parts.length > 1 ? parts.slice(1).join(" ") : override;
		}
		return stored.split(" ")[0];
	}

	function buildRaceresultUrl(race) {
		const host = race.host || "my4";
		const extra = race.extraParams || "";
		return `https://${host}.raceresult.com/${race.eventId}/${race.page}/list?key=${race.apiKey}&listname=${encodeURIComponent(race.listname)}&page=${race.page}${extra}`;
	}

	function parseRaceresultData(apiData, race) {
		const rows = [];

		Object.entries(apiData).forEach(([key, lapRows]) => {
			// Flatten nested structure (Sydney wraps rows in a sub-object)
			let actualRows;
			if (Array.isArray(lapRows)) {
				actualRows = lapRows;
			} else if (lapRows && typeof lapRows === "object") {
				actualRows = Object.values(lapRows).flat();
			} else {
				return;
			}

			let athleteName;

			if (key.includes(" /// ")) {
				const namePart = key.split(" /// ")[0]
					.replace(/^#\d+_/, "")   // strip "#123_" rank prefix
					.replace(/^#/, "")         // strip bare "#" if no rank
					.replace(/\s*\|.*$/, "")   // strip " | AUS" nationality suffix
					.trim();
				const commaIdx = namePart.indexOf(", ");
				if (commaIdx !== -1) {
					// "Last, First" → store as "Last First"
					athleteName = toTitleCase(`${namePart.substring(0, commaIdx)} ${namePart.substring(commaIdx + 2)}`);
				} else {
					// "First Last" (no comma) → reverse to "Last First" for consistent pill display
					const parts = namePart.split(" ");
					athleteName = toTitleCase(parts.length >= 2
						? `${parts[parts.length - 1]} ${parts.slice(0, -1).join(" ")}`
						: namePart);
				}
			} else {
				const parts = key.split("///");
				const displayName = (parts[1] || "").trim();
				const commaIdx = displayName.indexOf(", ");
				if (commaIdx !== -1) {
					// "Last, First" → store as "Last First"
					athleteName = toTitleCase(`${displayName.substring(0, commaIdx)} ${displayName.substring(commaIdx + 2)}`);
				} else {
					// "First Last" → reverse to "Last First"
					const nameParts = displayName.split(" ");
					athleteName =
						nameParts.length >= 2
							? `${nameParts[nameParts.length - 1]} ${nameParts.slice(0, -1).join(" ")}`
							: displayName;
				}
			}

			// Parse every row into a candidate lap first, without pushing yet. The
			// key text's own "N Laps" (or "N Ronden") count is loops *started*, not
			// completed — raceresult labels it that way even for a DNF whose last
			// attempted loop never got a finish time. A runner's real total is the
			// highest lap number that actually has one, so we compute totalLaps from
			// the parsed rows themselves rather than trusting that label. (The
			// winner is unaffected either way, since their last attempted loop is
			// always their last completed one.)
			const candidates = actualRows
				.map((row) => {
					if (!Array.isArray(row)) {
						return null;
					}

					let lapNum;
					let finishTime;
					let restTime;

					if (String(row[3]).startsWith("Yard")) {
						// Sydney format: [bib, pid, flag, "Yard N", start, s1, s2, s3, finish, yardTime, ...]
						lapNum = parseInt(String(row[3]).replace(/\D/g, ""), 10);
						finishTime = row[9]; // "Yard Time" elapsed HH:MM:SS e.g. "00:43:58"
						restTime = row[10];
					} else if (row.length >= 10 && /^\d+$/.test(String(row[3]))) {
						// Sydney's Backyard Ultra Sept 2026 format (different raceresult host/list
						// config than the April Sydney race above): [bib, id, flag, lapNum,
						// loopStartClock, cp1, cp2, cp3, finishClock, lapSplit, cumDistanceKm, ...].
						// lapNum here is a bare number, not "Yard N" or "LapN", so it's matched on
						// shape: long row, numeric row[3]. finishTime is the lap split at row[9] —
						// empty when the runner started this loop but didn't complete it in time,
						// which correctly drops that row below (they get credit for loops actually
						// finished, not loops merely started).
						lapNum = parseInt(row[3], 10);
						finishTime = row[9];
						restTime = null;
					} else if (row.length >= 7 && String(row[3]).startsWith("Lap")) {
						// G1M format: [col, bib, flag, "LapN", cp, finishTime, rest]
						lapNum = parseInt(String(row[3]).replace(/\D/g, ""), 10);
						finishTime = row[5];
						restTime = row[6];
					} else if (row.length >= 6) {
						// Big's format: [flag, bib, lapNum, cumulativeTime, finishTime, rest]
						lapNum = parseInt(row[2], 10);
						finishTime = row[4];
						restTime = row[5];
					} else if (row.length >= 5) {
						// Two 5-column formats:
						// Legends 2026: [bib, id, lapNum, finishTime, distance]
						// Legends 2025: [bib, id, lapNum, distance, finishTime]
						lapNum = parseInt(row[2], 10);
						finishTime = String(row[3]).includes("km") ? row[4] : row[3];
						restTime = null;
					} else {
						return null;
					}

					if (isNaN(lapNum) || !finishTime) {
						return null;
					}

					return { lapNum, finishTime, restTime };
				})
				.filter(Boolean);

			if (!candidates.length) {
				return;
			}

			const totalLaps = Math.max(...candidates.map((c) => c.lapNum));

			candidates.forEach(({ lapNum, finishTime, restTime }) => {
				rows.push({
					athlete: athleteName,
					race: race.id,
					total_laps: totalLaps,
					lap: `Lap${lapNum}`,
					finish_time: finishTime,
					rest_time: restTime,
				});
			});
		});

		return rows;
	}

	// One key per runner. Lap files give every runner their own key, so two
	// runners with the same name (Sydney Sept 2026 had two Jack Woods) stay
	// two runners. Live raceresult rows fall back to the name.
	const runnerKey = (row) => row.key || row.athlete;

	function buildPaceData(rows) {
		const athleteMap = {};

		rows.forEach((row) => {
			const key = runnerKey(row);
			if (!athleteMap[key]) {
				athleteMap[key] = {
					name: row.athlete,
					total: +row.total_laps,
					laps: {},
				};
			}

			const lapNum = parseInt((row.lap || "").replace(/\D/g, ""), 10);
			if (!isNaN(lapNum)) {
				athleteMap[key].laps[lapNum] = toLapMin(row.finish_time);
			}
		});

		// [name, athlete] pairs, most loops first.
		const sorted = Object.values(athleteMap)
			.sort((a, b) => b.total - a.total)
			.map((athlete) => [athlete.name, athlete]);
		const maxLap = Math.max(...sorted.map(([, athlete]) => athlete.total));
		const labels = Array.from({ length: maxLap }, (_, i) => `L${i + 1}`);
		const datasets = sorted.map(([name, athlete], index) => {
			const style = PALETTE[index % PALETTE.length];
			return {
				label: `${legendLabel(name)} (${athlete.total})`,
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

	function buildNightAnnotations(race, maxLap, yMin = 38, yMax = 62, labelY = 61.3) {
		const annotations = {};
		if (race.startHour === undefined) {
			return annotations;
		}

		nightBands(race.startHour, maxLap).forEach(([start, end], index) => {
			annotations[`night${index}`] = {
				type: "box",
				xMin: start,
				xMax: end,
				yMin,
				yMax,
				backgroundColor: "rgba(20,30,90,0.07)",
				borderWidth: 0,
			};

			const mid = Math.round((start + end) / 2);
			if (mid < maxLap - 1) {
				annotations[`nightLabel${index}`] = {
					type: "label",
					xValue: mid,
					yValue: labelY,
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

	const MI_PER_KM = 0.621371;
	const KM_PER_MI = 1.60934;
	const STANDARD_LOOP_MI = 4.16667; // Backyard Ultra standard: 4.16667 mi (6.7056 km) per loop

	// Resolves a race's loop distance in both units, regardless of which unit
	// the race config was authored in.
	function loopDistances(race) {
		if (race.distanceUnit === "km" && race.loopDistance) {
			const km = race.loopDistance;
			return { mi: km * MI_PER_KM, km };
		}
		const mi = race.loopDistance || STANDARD_LOOP_MI;
		return { mi, km: mi * KM_PER_MI };
	}

	function renderDNFChart({ rows, race, canvas, existingChart, unitToggleId = "dnfUnitToggle", group = "all" }) {
		// Use the highest lap number actually parsed per athlete (completed laps only),
		// so DNF runners who started but didn't finish a lap don't get counted one loop too late.
		const athleteMaxLap = {};
		const athleteSex = {};
		rows.forEach((row) => {
			const lapNum = parseInt((row.lap || "").replace(/\D/g, ""), 10);
			if (!isNaN(lapNum)) {
				const key = runnerKey(row);
				athleteMaxLap[key] = Math.max(athleteMaxLap[key] || 0, lapNum);
				athleteSex[key] = row.sex;
			}
		});

		// The x-axis always spans the whole race, whichever group is showing, so
		// Women / Men / All line up bar for bar. Only the counts change.
		const maxLap = Math.max(...Object.values(athleteMaxLap)) + 1;
		const winnerLoops = maxLap - 1;
		const inGroup = (name) => group === "all" || athleteSex[name] === group;
		const groupNames = Object.keys(athleteMaxLap).filter(inGroup);
		const groupSize = groupNames.length;
		const winnerInGroup = groupNames.some((name) => athleteMaxLap[name] === winnerLoops);
		const groupLabel = group === "all" ? null : GROUP_STYLE[group].label.toLowerCase();
		const counts = {};
		groupNames.map((name) => athleteMaxLap[name]).forEach((maxL) => {
			const bucket = maxL + 1;
			counts[bucket] = (counts[bucket] || 0) + 1;
		});

		const { mi: loopMi, km: loopKm } = loopDistances(race);
		// Keep whichever unit the toggle already shows (the chart is rebuilt when
		// the Women / Men / All filter changes).
		const activeUnitBtn = document.querySelector(`#${unitToggleId} button.active`);
		let unit = activeUnitBtn ? activeUnitBtn.dataset.unit : "mi";
		// Distance completed when a runner's race ended at bar index `i` (Loop i+1):
		// they finished i full loops (a DNF on Loop 1 means 0 loops completed).
		const distanceAt = (index) => (unit === "km" ? index * loopKm : index * loopMi);

		const labels = Array.from({ length: maxLap }, (_, i) => `L${i + 1}`);
		const data = labels.map((_, i) => counts[i + 1] || 0);
		const winnerIndex = maxLap - 1;
		// The winner didn't DNF, they won — so their column gets no bar at all;
		// see winnerAnnotation below for how that column is marked instead.
		const colors = data.map((_value, i) => (i === winnerIndex ? "transparent" : "rgba(26,26,26,0.75)"));
		const step = maxLap > 60 ? 10 : maxLap > 30 ? 5 : 1;
		const plugins = window.ChartDataLabels ? [window.ChartDataLabels] : [];
		const dataMax = Math.max(1, ...data);
		// Headroom above the tallest bar, for the count printed on top of it.
		// The WINNER tag sits near the axis now, so it needs none.
		const headroom = Math.max(2, Math.ceil(dataMax * 0.07));
		const nightAnnotations = buildNightAnnotations(race, maxLap, 0, dataMax + headroom);
		// The winner's column is marked, not barred: a dot on the axis with a
		// WINNER tag just above it, low enough to read with the axis label.
		//
		// winnerIndex (0-based) is numerically equal to the winner's own loop
		// count — maxLap is winnerMaxLap + 1, so maxLap - 1 = winnerMaxLap — but
		// as an ARRAY INDEX it points at labels[winnerIndex], which reads
		// "L{winnerIndex + 1}", one loop past what the winner actually ran (there
		// was no loop after the one they won on). Anywhere this column's loop
		// number is displayed, use the literal value `winnerIndex`, not the
		// label array or a "+1" index-to-loop conversion.
		const winnerAnnotation = {
			winnerDot: {
				type: "point",
				xValue: winnerIndex,
				yValue: 0,
				backgroundColor: "#C0392B",
				borderColor: "#F7F4EF",
				borderWidth: 1.5,
				radius: 5,
				// Draw the full dot even though it straddles the axis line.
				clip: false,
			},
			winnerTag: {
				type: "label",
				xValue: winnerIndex,
				yValue: 0,
				content: "WINNER",
				// Bottom-right corner of the tag sits just above and left of the dot.
				// The winner is always the last column, so hanging left keeps it in the plot.
				position: { x: "end", y: "end" },
				xAdjust: -4,
				// About two lines above the axis: clear of a 1-runner bar's count next door.
				yAdjust: -26,
				backgroundColor: "#C0392B",
				borderRadius: 3,
				color: "#fff",
				font: { size: 11, weight: "700", family: "Inter, sans-serif" },
				padding: { top: 4, bottom: 4, left: 7, right: 7 },
				clip: false,
			},
		};

		if (existingChart) {
			existingChart.destroy();
		}

		const chart = new Chart(canvas, {
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
					annotation: {
						// The winner marker only shows when the winner is in the group on screen.
						annotations: { ...nightAnnotations, ...(winnerInGroup ? winnerAnnotation : {}) },
					},
					datalabels: {
						anchor: "end",
						align: "top",
						color: "#777",
						font: {
							size: 9,
							weight: "600",
						},
						formatter: (value, ctx) => (value === 0 || ctx.dataIndex === winnerIndex ? "" : value),
					},
					tooltip: {
						callbacks: {
							title: (ctx) => {
								// winnerIndex is the winner's actual loop count, not
								// (index + 1) — see comment above winnerAnnotation.
								const lap = ctx[0].dataIndex === winnerIndex ? winnerIndex : ctx[0].dataIndex + 1;
								return `Loop ${lap}` + (race.startHour !== undefined ? ` · ${todStr(lap, race.startHour)}` : "");
							},
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
							afterLabel: (ctx) => {
								if (ctx.parsed.y === 0) {
									return null;
								}
								const lines = [` ${distanceAt(ctx.dataIndex).toFixed(1)} ${unit} completed`];
								if (groupLabel) {
									const share = ((ctx.parsed.y / groupSize) * 100).toFixed(1);
									lines.push(` ${share}% of the ${groupSize} ${groupLabel}`);
								}
								return lines;
							},
							filter: (item) => item.parsed.y > 0,
						},
					},
				},
				scales: {
					x: {
						grid: { display: false },
						ticks: {
							color: (ctx) => (winnerInGroup && ctx.index === winnerIndex ? "#C0392B" : TEXT_COLOR),
							font: (ctx) => ({ size: 9, weight: winnerInGroup && ctx.index === winnerIndex ? "700" : "400" }),
							maxRotation: 0,
							autoSkip: false,
							callback(_value, index) {
								if (index === winnerIndex) {
									// winnerIndex *is* the winner's loop count (see comment
									// above winnerAnnotation) — not an index into labels[].
									return `L${winnerIndex}`;
								}
								return (index + 1) % step === 0 || index === 0 ? labels[index] : "";
							},
						},
					},
					y: {
						beginAtZero: true,
						max: dataMax + headroom,
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

		const unitToggle = document.getElementById(unitToggleId);
		if (unitToggle) {
			unitToggle.querySelectorAll("button").forEach((btn) => {
				// Assign onclick (not addEventListener) so re-rendering the chart
				// on the same page doesn't stack duplicate listeners.
				btn.onclick = () => {
					if (btn.dataset.unit === unit) {
						return;
					}
					unit = btn.dataset.unit;
					unitToggle.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
					chart.update();
				};
			});
		}

		return chart;
	}

	/**
	 * Women vs men, loop by loop. Each point is the median loop time of every
	 * runner in that group who finished that loop. A line stops at the first
	 * loop that fewer than `minRunners` of them finished.
	 */
	function buildGroupMedians(rows, minRunners = MIN_RUNNERS_FOR_MEDIAN) {
		const byGroupLoop = { F: {}, M: {} };
		rows.forEach((row) => {
			if (!byGroupLoop[row.sex]) {
				return;
			}
			const lapNum = parseInt((row.lap || "").replace(/\D/g, ""), 10);
			const minutes = toLapMin(row.finish_time);
			if (isNaN(lapNum) || minutes == null) {
				return;
			}
			(byGroupLoop[row.sex][lapNum] = byGroupLoop[row.sex][lapNum] || []).push(minutes);
		});

		const series = {};
		Object.entries(byGroupLoop).forEach(([group, loops]) => {
			const points = [];
			for (let lap = 1; loops[lap] && loops[lap].length >= minRunners; lap++) {
				points.push({ lap, median: median(loops[lap]), n: loops[lap].length });
			}
			series[group] = points;
		});
		return series;
	}

	function renderGenderPaceChart({ rows, race, canvas, keysEl, existingChart }) {
		const series = buildGroupMedians(rows, Number(canvas.dataset.minRunners) || MIN_RUNNERS_FOR_MEDIAN);
		const lastLap = Math.max(...Object.values(series).map((points) => points.length));
		if (!lastLap) {
			return null;
		}
		const labels = Array.from({ length: lastLap }, (_, i) => `L${i + 1}`);
		const allMedians = Object.values(series).flat().map((p) => p.median);
		const yMin = Math.floor(Math.min(...allMedians)) - 2;
		const yMax = Math.ceil(Math.max(...allMedians)) + 2;

		const datasets = ["F", "M"].map((group) => {
			const byLap = {};
			series[group].forEach((p) => {
				byLap[p.lap] = p;
			});
			return {
				label: GROUP_STYLE[group].label,
				data: labels.map((_, i) => (byLap[i + 1] ? byLap[i + 1].median : null)),
				counts: labels.map((_, i) => (byLap[i + 1] ? byLap[i + 1].n : null)),
				borderColor: GROUP_STYLE[group].color,
				backgroundColor: GROUP_STYLE[group].color,
				borderWidth: 2.5,
				pointRadius: 2,
				pointHoverRadius: 5,
				tension: 0.25,
				spanGaps: false,
			};
		});

		if (keysEl) {
			keysEl.innerHTML = datasets
				.map((d) => `<span class="chart-key"><span class="chart-key-line" style="background:${d.borderColor}"></span>${d.label}</span>`)
				.join("");
		}

		if (existingChart) {
			existingChart.destroy();
		}

		const step = chartStep(lastLap);
		const hasStartTime = race.startHour !== undefined;

		return new Chart(canvas, {
			type: "line",
			data: { labels, datasets },
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: false,
				interaction: { mode: "index", intersect: false },
				plugins: {
					legend: { display: false },
					annotation: {
						annotations: buildNightAnnotations(race, lastLap, yMin, yMax, yMax - 0.5),
					},
					tooltip: {
						callbacks: {
							title: (ctx) => {
								const lap = ctx[0].dataIndex + 1;
								return hasStartTime ? `Loop ${lap} · ${todStr(lap, race.startHour)}` : `Loop ${lap}`;
							},
							label: (ctx) => {
								if (ctx.parsed.y == null) {
									return null;
								}
								const n = ctx.dataset.counts[ctx.dataIndex];
								return ` ${ctx.dataset.label}: ${fmtMin(ctx.parsed.y)}, middle time of ${n} runners`;
							},
							filter: (item) => item.parsed.y != null,
						},
					},
				},
				scales: {
					x: {
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
						min: yMin,
						max: yMax,
						title: {
							display: true,
							text: "Middle loop time (min)",
							color: TEXT_COLOR,
							font: { size: 11 },
						},
						ticks: {
							color: TEXT_COLOR,
							font: { size: 11 },
							stepSize: 1,
							callback: (value) => `${value} min`,
						},
						grid: { color: GRID_COLOR },
					},
				},
			},
		});
	}

	/** The winner and runner-up only, full race, with a colour key. */
	function renderTopPaceChart({ rows, race, canvas, keysEl }) {
		const paceData = buildPaceData(rows);
		const datasets = paceData.datasets.slice(0, 2).map((d) => ({ ...d, pointRadius: 0 }));
		if (keysEl) {
			keysEl.innerHTML = datasets
				.map((d, i) => `<span class="chart-key"><span class="chart-key-line" style="background:${d.borderColor}"></span>${fullDisplayName(paceData.sorted[i][0])}</span>`)
				.join("");
		}
		const config = makePaceChartConfig({
			labels: paceData.labels,
			datasets,
			race,
			maxLap: paceData.maxLap,
		});
		config.options.scales.x.max = `L${paceData.maxLap}`;
		return new Chart(canvas, config);
	}

	/**
	 * Results table on template race pages: top 10, "show all", a name search
	 * and an All / Women / Men switch. Rows are rendered at build time.
	 */
	const STANDINGS_INITIAL = 10;

	function initStandings(root) {
		const rows = Array.from(root.querySelectorAll("tbody tr"));
		const search = root.querySelector(".standings-search");
		const toggle = root.querySelector("[data-standings-toggle]");
		const groupBar = root.querySelector("[data-standings-group]");
		const empty = root.querySelector(".standings-empty");
		let expanded = false;
		let group = "all";

		function apply() {
			const term = search ? search.value.trim().toLowerCase() : "";
			let shown = 0;
			let matches = 0;
			rows.forEach((row) => {
				const match = (group === "all" || row.dataset.sex === group) && (!term || row.dataset.name.includes(term));
				if (match) matches++;
				// While searching, every match shows. Otherwise the top 10 of the group.
				const visible = match && (expanded || term || shown < STANDINGS_INITIAL);
				if (visible) shown++;
				row.hidden = !visible;
			});
			if (empty) empty.hidden = matches > 0;
			if (toggle) {
				toggle.hidden = Boolean(term) || matches <= STANDINGS_INITIAL;
				toggle.textContent = expanded ? `Show top ${STANDINGS_INITIAL} only` : `Show all ${matches} runners`;
			}
		}

		if (search) search.addEventListener("input", apply);
		if (toggle) {
			toggle.addEventListener("click", () => {
				expanded = !expanded;
				apply();
			});
		}
		if (groupBar) {
			groupBar.querySelectorAll("button").forEach((btn) => {
				btn.addEventListener("click", () => {
					group = btn.dataset.group;
					groupBar.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
					apply();
				});
			});
		}
		apply();
	}

	/**
	 * Sticky "on this page" chips: highlight the section being read, which is
	 * the last one whose top has passed a line 30% down the screen.
	 */
	function initToc(nav) {
		const chips = Array.from(nav.querySelectorAll("a[href^='#']"));
		const sections = chips.map((a) => document.getElementById(a.getAttribute("href").slice(1)));
		let current = null;
		let queued = false;

		function update() {
			queued = false;
			const line = window.innerHeight * 0.3;
			let index = -1;
			sections.forEach((section, i) => {
				if (section && section.getBoundingClientRect().top <= line) index = i;
			});
			// At the very bottom the last section may never reach the line.
			if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
				index = sections.length - 1;
			}
			const chip = chips[index] || null;
			if (chip === current) return;
			current = chip;
			chips.forEach((a) => a.classList.toggle("is-active", a === chip));
			// Keep the active chip in view on phones, where the row scrolls sideways.
			if (chip) nav.firstElementChild.scrollTo({ left: chip.offsetLeft - 16, behavior: "smooth" });
		}

		window.addEventListener("scroll", () => {
			if (!queued) {
				queued = true;
				requestAnimationFrame(update);
			}
		}, { passive: true });
		update();
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

	/**
	 * Some races publish no usable lap list, so their splits are collected
	 * ahead of time and served as a compact file alongside the page:
	 *   { runners: [ { n: "Last First", g: "m", t: 94,
	 *                  l: ["48:30", …], r: ["11:29", …] } ] }
	 */
	function expandLapFile(payload, race) {
		const rows = [];

		(payload.runners || []).forEach((runner, runnerIndex) => {
			const laps = runner.l || [];
			const rests = runner.r || [];
			laps.forEach((finishTime, index) => {
				if (!finishTime) {
					return;
				}
				rows.push({
					athlete: runner.n,
					key: `r${runnerIndex}`,
					race: race.id,
					total_laps: runner.t ?? laps.length,
					lap: `Lap${index + 1}`,
					finish_time: finishTime,
					rest_time: rests[index] || null,
					sex: normSex(runner.g),
				});
			});
		});

		return rows;
	}

	async function fetchRows(race) {
		const isLapFile = Boolean(race.dataUrl);
		const response = await fetch(isLapFile ? race.dataUrl : buildRaceresultUrl(race));
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}

		const json = await response.json();

		let rows;
		if (isLapFile) {
			rows = expandLapFile(json, race);
		} else {
			if (!json.data) {
				throw new Error("'data' field missing");
			}
			rows = parseRaceresultData(json.data, race);
		}

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
		displayOverrides = race.displayNames || {};

		// Template race pages (_includes/race-page.njk): build-time parts.
		document.querySelectorAll("[data-standings]").forEach(initStandings);
		document.querySelectorAll(".race-toc").forEach(initToc);

		// Older race pages wrap the charts in #main and show #status while loading.
		const statusEl = document.getElementById("status");
		const mainEl = document.getElementById("main");
		const statsEl = document.getElementById("statsRow");
		const pace = createPaceRenderer({
			canvasId: paceCanvasId,
			statsEl,
			maxStatLabel: "Winning loops",
		});
		let dnfChart = null;
		let topChart = null;
		let genderChart = null;

		fetchRows(race)
			.then((rows) => {
				const paceData = buildPaceData(rows);
				const winner = paceData.sorted[0];
				const winnerName = winner ? fullDisplayName(winner[0]) : "—";
				const winnerLoops = winner ? winner[1].total : "—";
				const loopDistance = race.loopDistance || 4.167;
				const distanceUnit = race.distanceUnit || "mi";
				const distanceDecimals = race.distanceDecimals || 0;
				const winnerDist = winner
					? `${distanceDecimals ? "" : "~"}${(winner[1].total * loopDistance).toFixed(distanceDecimals)} ${distanceUnit}`
					: "—";

				const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
				set("heroWinner", winnerName);
				set("heroLoops", winnerLoops);
				set("heroDist", winnerDist);
				set("heroRunners", paceData.sorted.length);

				pace.render(rows, race);
				dnfChart = renderDNFChart({
					rows,
					race,
					canvas: document.getElementById(dnfCanvasId),
					existingChart: dnfChart,
				});

				// Women vs men. On when the race config opts in (genderViews: true)
				// and its data carries both women and men. Opt-in so a race's
				// gender field is checked before it is published.
				if (race.genderViews && hasGender(rows)) {
					const groupToggle = document.getElementById("dnfGroupToggle");
					if (groupToggle) {
						groupToggle.hidden = false;
						groupToggle.querySelectorAll("button").forEach((btn) => {
							btn.onclick = () => {
								if (btn.classList.contains("active")) {
									return;
								}
								groupToggle.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
								dnfChart = renderDNFChart({
									rows,
									race,
									canvas: document.getElementById(dnfCanvasId),
									existingChart: dnfChart,
									group: btn.dataset.group,
								});
							};
						});
					}
					const genderCanvas = document.getElementById("genderPaceChart");
					if (genderCanvas) {
						const card = document.getElementById("genderPaceCard");
						// Show the card before drawing, so Chart.js measures a visible box.
						if (card) card.hidden = false;
						genderChart = renderGenderPaceChart({
							rows,
							race,
							canvas: genderCanvas,
							keysEl: document.getElementById("genderPaceKeys"),
							existingChart: genderChart,
						});
					}
				}

				const topCanvas = document.getElementById("topPaceChart");
				if (topCanvas && !topChart) {
					topChart = renderTopPaceChart({
						rows,
						race,
						canvas: topCanvas,
						keysEl: document.getElementById("topPaceKeys"),
					});
				}

				if (statusEl) statusEl.style.display = "none";
				if (mainEl) mainEl.style.display = "block";
			})
			.catch((error) => {
				if (statusEl) {
					showLoadError(statusEl, `Could not load data: ${error.message}.`, " Possible CORS issue - open from backyards.run.");
				} else {
					console.error("Could not load race data", error);
				}
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
