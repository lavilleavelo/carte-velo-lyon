import { getTclStatus, grenetteLines } from './collector';
import { getTclDb } from './db';
import { getGtfsStatus } from './gtfs';
import { getTclRoutes, type RouteCollection } from './routes';
import {
	CELL,
	DELAY_BUCKETS,
	GROUP_LINES,
	getTclSummaryStatus,
	parisHour,
	type Direction,
} from './summary';

export const REOPENING_DAY = '2026-12-09';

export const WINDOWS = {
	day: { label: 'Toute la journée', hours: null },
	morning: { label: 'Pointe du matin (7 h à 9 h)', hours: [7, 8] },
	evening: { label: 'Pointe du soir (16 h à 19 h)', hours: [16, 17, 18] },
} as const;

export type WindowKey = keyof typeof WINDOWS;

const WINDOW_KEYS = Object.keys(WINDOWS) as WindowKey[];
const DIRECTIONS: Direction[] = ['east', 'west'];
const MIN_HOURLY_SAMPLES = 3;
const MAX_ROUTE_LINES = 8;
const BUCKET_COUNT = DELAY_BUCKETS.max - DELAY_BUCKETS.min + 1;

export type Period = 'before' | 'after';

export type Quantiles = { n: number; median: number | null; p90: number | null };

export type TravelDirection = 'outbound' | 'inbound';

export type Selection = {
	key: string;
	label: string;
	lines: string[] | null;
	direction: TravelDirection | null;
};

type DayRow = {
	day: string;
	complete: number;
	computed_at: string;
	vm_records: number;
	vm_max_gap_s: number | null;
	vm_bytes: number;
	et_bytes: number;
	sx_bytes: number;
	stops_bytes: number;
};

type CellRow = [latIndex: number, lonIndex: number, journeys: number, lost: number, spent: number];

const cellCache = new Map<string, CellRow[]>();

function inWindow(hour: number, window: WindowKey): boolean {
	const hours = WINDOWS[window].hours as readonly number[] | null;
	return hours === null || hours.includes(hour);
}

export type Ranges = Record<Period, { from: string; to: string }>;

function periodOf(day: string, ranges: Ranges): Period | null {
	if (day >= ranges.before.from && day <= ranges.before.to) {
		return 'before';
	}
	if (day >= ranges.after.from && day <= ranges.after.to) {
		return 'after';
	}
	return null;
}

function isoDay(value: string | null): string | null {
	return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
		? value
		: null;
}

function previousDay(day: string): string {
	const date = new Date(`${day}T12:00:00Z`);
	date.setUTCDate(date.getUTCDate() - 1);
	return date.toISOString().slice(0, 10);
}

export function parseRanges(params: URLSearchParams, days: string[]): Ranges {
	const first = days[0] ?? REOPENING_DAY;
	const last = days.at(-1) ?? REOPENING_DAY;
	const ranges: Ranges = {
		before: {
			from: isoDay(params.get('ref_du')) ?? first,
			to: isoDay(params.get('ref_au')) ?? previousDay(REOPENING_DAY),
		},
		after: {
			from: isoDay(params.get('cmp_du')) ?? REOPENING_DAY,
			to: isoDay(params.get('cmp_au')) ?? (last > REOPENING_DAY ? last : REOPENING_DAY),
		},
	};
	for (const range of Object.values(ranges)) {
		if (range.from > range.to) {
			[range.from, range.to] = [range.to, range.from];
		}
	}
	return ranges;
}

function quantile(sorted: number[], q: number): number | null {
	if (sorted.length === 0) {
		return null;
	}
	const position = (sorted.length - 1) * q;
	const low = Math.floor(position);
	const high = Math.ceil(position);
	return Math.round(sorted[low] + (sorted[high] - sorted[low]) * (position - low));
}

function quantiles(values: number[]): Quantiles {
	const sorted = [...values].sort((a, b) => a - b);
	return { n: sorted.length, median: quantile(sorted, 0.5), p90: quantile(sorted, 0.9) };
}

function emptyHistogram(): number[] {
	return Array.from({ length: BUCKET_COUNT }, () => 0);
}

function addHistogram(target: number[], source: number[]): void {
	source.forEach((value, index) => (target[index] += value));
}

function histogramQuantile(histogram: number[], total: number, q: number): number {
	const target = q * total;
	let cumulative = 0;
	for (let index = 0; index < histogram.length; index++) {
		const count = histogram[index];
		if (count > 0 && cumulative + count >= target) {
			const value = DELAY_BUCKETS.min + index + (target - cumulative) / count;
			return Math.round(value * 10) / 10;
		}
		cumulative += count;
	}
	return DELAY_BUCKETS.max + 1;
}

function histogramQuantiles(histogram: number[]): Quantiles {
	const n = histogram.reduce((sum, value) => sum + value, 0);
	if (n === 0) {
		return { n, median: null, p90: null };
	}
	return {
		n,
		median: histogramQuantile(histogram, n, 0.5),
		p90: histogramQuantile(histogram, n, 0.9),
	};
}

function compareLines(a: string, b: string): number {
	return a.localeCompare(b, 'fr', { numeric: true });
}

export function studyLines(): string[] {
	return grenetteLines();
}

export function lineGroups() {
	const rows = getTclDb()
		.prepare("SELECT DISTINCT line FROM delays WHERE line NOT LIKE '\\_%' ESCAPE '\\'")
		.all() as { line: string }[];
	const lines = rows.map((row) => row.line).sort(compareLines);
	const tram = (line: string) => /^T\d+$/.test(line);
	const strong = (line: string) => /^(C|TB)\d+/.test(line);
	return [
		{ label: 'Trams', lines: lines.filter(tram) },
		{ label: 'Lignes fortes', lines: lines.filter(strong) },
		{ label: 'Autres lignes', lines: lines.filter((line) => !tram(line) && !strong(line)) },
	].filter((group) => group.lines.length > 0);
}

export function parseSelection(values: string[], grenette: string[]): Selection {
	const codes = [
		...new Set(
			values
				.flatMap((value) => value.split(','))
				.map((value) => value.trim().toUpperCase())
				.filter((value) => /^[A-Z0-9]+$/.test(value)),
		),
	];
	if (codes.includes('RESEAU')) {
		return { key: 'reseau', label: 'Tout le réseau', lines: null, direction: null };
	}
	const lines = codes.filter((code) => code !== 'GRENETTE').sort(compareLines);
	if (
		lines.length === 0 ||
		(lines.length === grenette.length && lines.every((line) => grenette.includes(line)))
	) {
		return {
			key: 'grenette',
			label: 'Lignes de la rue Grenette',
			lines: grenette,
			direction: null,
		};
	}
	const label =
		lines.length === 1
			? `Ligne ${lines[0]}`
			: lines.length <= 6
				? `Lignes ${lines.join(', ')}`
				: `${lines.length} lignes`;
	return { key: lines.join(','), label, lines, direction: null };
}

function placeholders(values: unknown[]): string {
	return values.map(() => '?').join(',');
}

function delayData(selection: Selection, days: string[], ranges: Ranges) {
	const series = [
		{
			key: 'selection',
			label: selection.label,
			lines: selection.lines ?? [GROUP_LINES.network],
		},
		...(selection.lines
			? [
					{
						key: 'fortes',
						label: 'Autres lignes fortes (C, TB)',
						lines: [GROUP_LINES.strong],
					},
					{ key: 'trams', label: 'Trams', lines: [GROUP_LINES.trams] },
				]
			: []),
	];
	const allLines = series.flatMap((item) => item.lines);
	const filtered = selection.lines !== null && selection.direction !== null;
	const rows = getTclDb()
		.prepare(
			`SELECT line, day, hour, histogram FROM delays WHERE line IN (${placeholders(allLines)})
			 ${filtered ? `AND (direction = ? OR line LIKE '\\_%' ESCAPE '\\')` : ''}`,
		)
		.all(...allLines, ...(filtered ? [selection.direction] : [])) as {
		line: string;
		day: string;
		hour: number;
		histogram: string;
	}[];

	const seriesOf = new Map<string, string[]>();
	for (const item of series) {
		for (const line of item.lines) {
			seriesOf.set(line, [...(seriesOf.get(line) ?? []), item.key]);
		}
	}

	const byDayHour = new Map<string, Map<string, number[]>>();
	for (const row of rows) {
		const histogram = JSON.parse(row.histogram) as number[];
		for (const key of seriesOf.get(row.line) ?? []) {
			const slotKey = `${row.day}|${row.hour}`;
			const perSeries = byDayHour.get(slotKey) ?? new Map<string, number[]>();
			byDayHour.set(slotKey, perSeries);
			const target = perSeries.get(key) ?? emptyHistogram();
			perSeries.set(key, target);
			addHistogram(target, histogram);
		}
	}

	const sumWhere = (key: string, predicate: (day: string, hour: number) => boolean) => {
		const total = emptyHistogram();
		for (const [slotKey, perSeries] of byDayHour) {
			const [day, hour] = slotKey.split('|');
			const histogram = perSeries.get(key);
			if (histogram && predicate(day, Number(hour))) {
				addHistogram(total, histogram);
			}
		}
		return histogramQuantiles(total);
	};

	const daily = Object.fromEntries(
		WINDOW_KEYS.map((window) => [
			window,
			days.map((day) => ({
				day,
				...Object.fromEntries(
					series.map((item) => [
						item.key,
						sumWhere(item.key, (d, hour) => d === day && inWindow(hour, window)),
					]),
				),
			})),
		]),
	) as Record<WindowKey, ({ day: string } & Record<string, Quantiles>)[]>;

	const heatmap = days.map((day) => ({
		day,
		hours: Array.from({ length: 24 }, (_, hour) => {
			const histogram = byDayHour.get(`${day}|${hour}`)?.get('selection');
			return histogram ? histogramQuantiles(histogram) : null;
		}),
	}));

	const hourly = Array.from({ length: 24 }, (_, hour) => ({
		hour,
		before: sumWhere('selection', (day, h) => h === hour && periodOf(day, ranges) === 'before'),
		after: sumWhere('selection', (day, h) => h === hour && periodOf(day, ranges) === 'after'),
	})).filter((row) => row.before.n > 0 || row.after.n > 0);

	const periods = Object.fromEntries(
		WINDOW_KEYS.map((window) => [
			window,
			{
				before: sumWhere(
					'selection',
					(day, hour) => periodOf(day, ranges) === 'before' && inWindow(hour, window),
				),
				after: sumWhere(
					'selection',
					(day, hour) => periodOf(day, ranges) === 'after' && inWindow(hour, window),
				),
			},
		]),
	) as Record<WindowKey, Record<Period, Quantiles>>;

	return {
		series: series.map(({ key, label }) => ({ key, label })),
		daily,
		heatmap,
		hourly,
		periods,
	};
}

function crossingData(selection: Selection, days: string[], ranges: Ranges) {
	const lines = selection.lines;
	const rows = getTclDb()
		.prepare(
			`SELECT day, direction, hour, seconds FROM crossings ${lines ? `WHERE line IN (${placeholders(lines)})` : ''}`,
		)
		.all(...(lines ?? [])) as {
		day: string;
		direction: Direction;
		hour: number;
		seconds: number;
	}[];

	const pick = (predicate: (row: (typeof rows)[number]) => boolean, source: typeof rows = rows) =>
		quantiles(source.filter(predicate).map((row) => row.seconds));
	const byDay = new Map<string, typeof rows>();
	for (const row of rows) {
		const list = byDay.get(row.day) ?? [];
		list.push(row);
		byDay.set(row.day, list);
	}

	return {
		total: rows.length,
		daily: Object.fromEntries(
			WINDOW_KEYS.map((window) => [
				window,
				Object.fromEntries(
					DIRECTIONS.map((direction) => [
						direction,
						days.map((day) => ({
							day,
							...pick(
								(row) => row.direction === direction && inWindow(row.hour, window),
								byDay.get(day) ?? [],
							),
						})),
					]),
				),
			]),
		) as Record<WindowKey, Record<Direction, ({ day: string } & Quantiles)[]>>,
		hourly: Object.fromEntries(
			DIRECTIONS.map((direction) => [
				direction,
				Array.from({ length: 24 }, (_, hour) => {
					const before = pick(
						(row) =>
							row.direction === direction &&
							row.hour === hour &&
							periodOf(row.day, ranges) === 'before',
					);
					const after = pick(
						(row) =>
							row.direction === direction &&
							row.hour === hour &&
							periodOf(row.day, ranges) === 'after',
					);
					return {
						hour,
						before: before.n >= MIN_HOURLY_SAMPLES ? before.median : null,
						after: after.n >= MIN_HOURLY_SAMPLES ? after.median : null,
					};
				}).filter((row) => row.before !== null || row.after !== null),
			]),
		) as Record<Direction, { hour: number; before: number | null; after: number | null }[]>,
		periods: Object.fromEntries(
			WINDOW_KEYS.map((window) => [
				window,
				Object.fromEntries(
					DIRECTIONS.map((direction) => [
						direction,
						{
							before: pick(
								(row) =>
									row.direction === direction &&
									periodOf(row.day, ranges) === 'before' &&
									inWindow(row.hour, window),
							),
							after: pick(
								(row) =>
									row.direction === direction &&
									periodOf(row.day, ranges) === 'after' &&
									inWindow(row.hour, window),
							),
						},
					]),
				),
			]),
		) as Record<WindowKey, Record<Direction, Record<Period, Quantiles>>>,
	};
}

type StopOption = { id: number; name: string; order: number };

function mapStops(selection: Selection) {
	if (!selection.lines || selection.lines.length > MAX_ROUTE_LINES) {
		return [];
	}
	const wanted = new Set(selection.lines);
	const suffix =
		selection.direction === 'outbound' ? 'A' : selection.direction === 'inbound' ? 'R' : null;
	const rows = getTclDb().prepare('SELECT id, name, lat, lon, lines FROM stops').all() as {
		id: number;
		name: string;
		lat: number;
		lon: number;
		lines: string;
	}[];
	return rows
		.filter((row) =>
			row.lines.split(',').some((entry) => {
				const [line, side] = entry.split(':');
				return wanted.has(line) && (suffix === null || side === suffix);
			}),
		)
		.map(({ id, name, lat, lon }) => ({ id, name, lat, lon }));
}

function stopOptions(selection: Selection) {
	if (!selection.lines) {
		return [];
	}
	const rows = getTclDb()
		.prepare(
			`SELECT p.line, p.direction, p.stop_id AS id, AVG(p.stop_order) AS stop_order, COUNT(*) AS n,
			        COALESCE(s.name, CAST(p.stop_id AS TEXT)) AS name
			 FROM passages p LEFT JOIN stops s ON s.id = p.stop_id
			 WHERE p.line IN (${placeholders(selection.lines)}) ${selection.direction ? 'AND p.direction = ?' : ''}
			 GROUP BY p.line, p.direction, p.stop_id`,
		)
		.all(...selection.lines, ...(selection.direction ? [selection.direction] : [])) as {
		line: string;
		direction: string;
		id: number;
		stop_order: number;
		n: number;
		name: string;
	}[];
	const groups = new Map<string, { line: string; direction: string; stops: StopOption[] }>();
	for (const row of rows) {
		const key = `${row.line}|${row.direction}`;
		const group = groups.get(key) ?? { line: row.line, direction: row.direction, stops: [] };
		groups.set(key, group);
		group.stops.push({ id: row.id, name: row.name, order: row.stop_order });
	}
	return [...groups.values()]
		.map((group) => {
			const stops = group.stops.sort((a, b) => a.order - b.order);
			return {
				...group,
				label: `${group.line} vers ${stops.at(-1)?.name ?? group.direction}`,
				stops,
			};
		})
		.sort((a, b) => compareLines(a.line, b.line) || a.direction.localeCompare(b.direction));
}

function segment(
	selection: Selection,
	fromParam: string | null,
	toParam: string | null,
	days: string[],
	ranges: Ranges,
) {
	const from = Number(fromParam);
	const to = Number(toParam);
	if (!Number.isInteger(from) || !Number.isInteger(to) || from <= 0 || to <= 0 || from === to) {
		return null;
	}
	const db = getTclDb();
	const lines = selection.lines;
	const rows = db
		.prepare(
			`SELECT a.day, a.line, a.aimed AS a_aimed, a.actual AS a_actual, b.aimed AS b_aimed, b.actual AS b_actual
			 FROM passages a
			 JOIN passages b ON b.day = a.day AND b.journey = a.journey AND b.stop_id = ? AND b.stop_order > a.stop_order
			 WHERE a.stop_id = ? ${lines ? `AND a.line IN (${placeholders(lines)})` : ''}`,
		)
		.all(to, from, ...(lines ?? [])) as {
		day: string;
		line: string;
		a_aimed: number;
		a_actual: number;
		b_aimed: number;
		b_actual: number;
	}[];
	const names = new Map(
		(
			db.prepare('SELECT id, name FROM stops WHERE id IN (?, ?)').all(from, to) as {
				id: number;
				name: string;
			}[]
		).map((row) => [row.id, row.name]),
	);
	const trips = rows
		.map((row) => ({
			day: row.day,
			line: row.line,
			hour: parisHour(row.a_aimed * 1000),
			planned: row.b_aimed - row.a_aimed,
			actual: row.b_actual - row.a_actual,
			delayFrom: row.a_actual - row.a_aimed,
			delayTo: row.b_actual - row.b_aimed,
		}))
		.filter((trip) => trip.actual > 0 && trip.actual < trip.planned * 3 + 600);

	const summarize = (list: typeof trips) => ({
		n: list.length,
		planned: quantiles(list.map((trip) => trip.planned)).median,
		actual: quantiles(list.map((trip) => trip.actual)).median,
		actualP90: quantiles(list.map((trip) => trip.actual)).p90,
		lost: quantiles(list.map((trip) => trip.actual - trip.planned)).median,
		lostP90: quantiles(list.map((trip) => trip.actual - trip.planned)).p90,
		delayFrom: quantiles(list.map((trip) => trip.delayFrom)).median,
		delayTo: quantiles(list.map((trip) => trip.delayTo)).median,
	});

	const byDay = new Map<string, typeof trips>();
	for (const trip of trips) {
		const list = byDay.get(trip.day) ?? [];
		list.push(trip);
		byDay.set(trip.day, list);
	}

	return {
		from: { id: from, name: names.get(from) ?? String(from) },
		to: { id: to, name: names.get(to) ?? String(to) },
		lines: [...new Set(trips.map((trip) => trip.line))].sort(compareLines),
		periods: Object.fromEntries(
			WINDOW_KEYS.map((window) => [
				window,
				Object.fromEntries(
					(['before', 'after'] as Period[]).map((which) => [
						which,
						summarize(
							trips.filter(
								(trip) => periodOf(trip.day, ranges) === which && inWindow(trip.hour, window),
							),
						),
					]),
				),
			]),
		) as Record<WindowKey, Record<Period, ReturnType<typeof summarize>>>,
		daily: Object.fromEntries(
			WINDOW_KEYS.map((window) => [
				window,
				days.map((day) => ({
					day,
					...summarize((byDay.get(day) ?? []).filter((trip) => inWindow(trip.hour, window))),
				})),
			]),
		) as Record<WindowKey, ({ day: string } & ReturnType<typeof summarize>)[]>,
		hourly: Array.from({ length: 24 }, (_, hour) => {
			const atHour = trips.filter((trip) => trip.hour === hour);
			const before = summarize(atHour.filter((trip) => periodOf(trip.day, ranges) === 'before'));
			const after = summarize(atHour.filter((trip) => periodOf(trip.day, ranges) === 'after'));
			return {
				hour,
				planned: quantiles(atHour.map((trip) => trip.planned)).median,
				before: before.n >= MIN_HOURLY_SAMPLES ? before.actual : null,
				after: after.n >= MIN_HOURLY_SAMPLES ? after.actual : null,
			};
		}).filter((row) => row.before !== null || row.after !== null),
	};
}

function cells(
	selection: Selection,
	range: { from: string; to: string },
	minJourneys: number,
	stamp: string,
) {
	const cacheKey = `${selection.key}|${selection.direction}|${range.from}|${range.to}|${minJourneys}|${stamp}`;
	const cached = cellCache.get(cacheKey);
	if (cached) {
		return cached;
	}
	const lines = selection.lines;
	const conditions = [
		'day BETWEEN ? AND ?',
		...(lines ? [`line IN (${placeholders(lines)})`] : []),
		...(selection.direction ? ['direction = ?'] : []),
	];
	const rows = getTclDb()
		.prepare(
			`SELECT lat_index, lon_index, SUM(journeys) AS journeys, SUM(lost_s) AS lost, SUM(bus_s) AS spent FROM cells
			 WHERE ${conditions.join(' AND ')}
			 GROUP BY lat_index, lon_index HAVING SUM(journeys) >= ?`,
		)
		.all(
			range.from,
			range.to,
			...(lines ?? []),
			...(selection.direction ? [selection.direction] : []),
			minJourneys,
		) as {
		lat_index: number;
		lon_index: number;
		journeys: number;
		lost: number;
		spent: number;
	}[];
	const result = rows.map(
		(row): CellRow => [
			row.lat_index,
			row.lon_index,
			row.journeys,
			Math.round(row.lost / row.journeys),
			Math.round(row.spent / row.journeys),
		],
	);
	if (cellCache.size > 40) {
		cellCache.clear();
	}
	cellCache.set(cacheKey, result);
	return result;
}

function directionNames(selection: Selection): Record<TravelDirection, string> {
	const fallback: Record<TravelDirection, string> = { outbound: 'aller', inbound: 'retour' };
	if (!selection.lines || selection.lines.length !== 1) {
		return fallback;
	}
	const line = selection.lines[0];
	const rows = getTclDb()
		.prepare(
			`SELECT p.direction, s.name, AVG(p.stop_order) AS stop_order
			 FROM passages p JOIN stops s ON s.id = p.stop_id
			 WHERE p.line = ? GROUP BY p.direction, p.stop_id ORDER BY stop_order DESC`,
		)
		.all(line) as { direction: TravelDirection; name: string }[];
	const names = { ...fallback };
	for (const direction of ['outbound', 'inbound'] as TravelDirection[]) {
		const last = rows.find((row) => row.direction === direction);
		if (last) {
			names[direction] = `vers ${last.name}`;
		}
	}
	return names;
}

function filterRoutes(routes: RouteCollection, direction: TravelDirection | null): RouteCollection {
	if (!direction) {
		return routes;
	}
	const wanted = direction === 'outbound' ? 'aller' : 'retour';
	return {
		...routes,
		features: routes.features.filter(
			(feature) => feature.properties.direction.toLowerCase() === wanted,
		),
	};
}

export async function buildTclReport(params: URLSearchParams) {
	const db = getTclDb();
	const grenette = studyLines();
	const parsed = parseSelection(params.getAll('ligne'), grenette);
	const sens = params.get('sens');
	const direction: TravelDirection | null =
		parsed.lines !== null && sens === 'aller'
			? 'outbound'
			: parsed.lines !== null && sens === 'retour'
				? 'inbound'
				: null;
	const directionLabels = directionNames(parsed);
	const selection: Selection = {
		...parsed,
		direction,
		label: direction ? `${parsed.label}, ${directionLabels[direction]}` : parsed.label,
	};
	const dayRows = db.prepare('SELECT * FROM days ORDER BY day').all() as DayRow[];
	const days = dayRows.map((row) => row.day);
	const ranges = parseRanges(params, days);
	const stamp = dayRows.reduce(
		(latest, row) => (row.computed_at > latest ? row.computed_at : latest),
		'',
	);
	const minJourneys = Math.max(3, Math.min(20, days.length * 2));
	const collector = getTclStatus();
	const showRoutes = selection.lines !== null && selection.lines.length <= MAX_ROUTE_LINES;

	return {
		reopeningDay: REOPENING_DAY,
		ranges,
		windows: Object.fromEntries(WINDOW_KEYS.map((key) => [key, WINDOWS[key].label])) as Record<
			WindowKey,
			string
		>,
		selection,
		grenette,
		groups: lineGroups(),
		cell: CELL,
		minJourneys,
		collector: {
			enabled: collector.enabled,
			startedAt: collector.startedAt,
			feeds: collector.feeds,
		},
		summaries: getTclSummaryStatus(),
		lastComputedAt: stamp || null,
		days: dayRows.map((row) => ({
			day: row.day,
			complete: row.complete === 1,
			coverage: Math.min(1, (row.vm_records * 30) / 86400),
			vmMaxGapS: row.vm_max_gap_s,
			bytes: row.vm_bytes + row.et_bytes + row.sx_bytes + row.stops_bytes,
		})),
		delays: delayData(selection, days, ranges),
		crossings: crossingData(selection, days, ranges),
		cells: {
			before: cells(selection, ranges.before, minJourneys, stamp),
			after: cells(selection, ranges.after, minJourneys, stamp),
		},
		directionLabels,
		routes: showRoutes
			? filterRoutes(await getTclRoutes(selection.lines ?? []), selection.direction)
			: { type: 'FeatureCollection' as const, features: [] },
		showRoutes,
		stops: mapStops(selection),
		selectedStops: {
			from: Number(params.get('de')) || null,
			to: Number(params.get('a')) || null,
		},
		gtfs: getGtfsStatus(),
		stopOptions: stopOptions(selection),
		segment: segment(selection, params.get('de'), params.get('a'), days, ranges),
	};
}

export type TclReport = Awaited<ReturnType<typeof buildTclReport>>;
