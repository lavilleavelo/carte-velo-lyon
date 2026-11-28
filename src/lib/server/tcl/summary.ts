import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { todayInParis } from '$lib/server/counters/calendar';
import { transaction } from '$lib/server/counters/db';
import { grenetteLines } from './collector';
import { getTclDb } from './db';
import { readRecords, tclDataDir } from './files';
import { refreshGtfs } from './gtfs';
import { createPassageDetector, refreshStops, type Passage } from './passages';
import { createReplayWriter } from './replay';
import { directionOf, journeyKey, lineCode, parseDuration, recordedAt, vehicleKey } from './siri';

export const SUMMARY_VERSION = 7;

export const GRENETTE = {
	westLon: 4.8327,
	eastLon: 4.8362,
	minLat: 45.7622,
	maxLat: 45.7645,
	box: { minLat: 45.76, maxLat: 45.7665, minLon: 4.829, maxLon: 4.84 },
};

export const CELL = { lat: 0.0009, lon: 0.0013 };

export const DELAY_BUCKETS = { min: -5, max: 30 };

export const GROUP_LINES = { network: '_reseau', strong: '_fortes', trams: '_trams' };

const MAX_SAMPLE_GAP_S = 95;
const MAX_TRAVERSAL_S = 20 * 60;
const MAX_DELAY_S = 2 * 60 * 60;
const MAX_SEGMENT_M = 1500;
const REFRESH_MS = 15 * 60 * 1000;
const FEEDS = ['vm', 'et', 'sx', 'stops'] as const;
const SCHEDULER_KEY = '__carteVeloLyonTclSummaries';

export type Direction = 'east' | 'west';

type Crossing = { line: string; direction: Direction; enteredAt: number; seconds: number };

type Point = { t: number; lat: number; lon: number; line: string };

type Track = {
	last: Point | null;
	route: (Point & { delay: number | null; journey: string; cell: string | null }) | null;
	west: number | null;
	east: number | null;
	counted: number;
};

type CellTotals = {
	latIndex: number;
	lonIndex: number;
	journeys: number;
	lost: number;
	seconds: number;
};

type HourDelays = { count: number; total: number; histogram: number[] };

type DaySummary = {
	day: string;
	complete: boolean;
	vmRecords: number;
	vmMaxGapS: number | null;
	bytes: Record<(typeof FEEDS)[number], number>;
	crossings: Crossing[];
	delays: Map<string, HourDelays[]>;
	cells: Map<string, Map<string, CellTotals>>;
	passages: Passage[];
};

const state = {
	running: false,
	lastRunAt: null as string | null,
	lastError: null as string | null,
};

const PARIS_HOUR = new Intl.DateTimeFormat('en-GB', {
	timeZone: 'Europe/Paris',
	hour: '2-digit',
	hourCycle: 'h23',
});

export function parisHour(epochMs: number): number {
	return Number(PARIS_HOUR.format(epochMs)) % 24;
}

function gateCrossing(a: Point, b: Point, lon: number): number | null {
	if ((a.lon - lon) * (b.lon - lon) > 0 || a.lon === b.lon) {
		return null;
	}
	const ratio = (lon - a.lon) / (b.lon - a.lon);
	const lat = a.lat + ratio * (b.lat - a.lat);
	if (lat < GRENETTE.minLat || lat > GRENETTE.maxLat) {
		return null;
	}
	return a.t + ratio * (b.t - a.t);
}

function distanceMeters(a: Point, b: Point): number {
	const dLat = (b.lat - a.lat) * 111_320;
	const dLon = (b.lon - a.lon) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
	return Math.hypot(dLat, dLon);
}

function inBox(lat: number, lon: number): boolean {
	const { box } = GRENETTE;
	return lat >= box.minLat && lat <= box.maxLat && lon >= box.minLon && lon <= box.maxLon;
}

async function fileSize(feed: (typeof FEEDS)[number], day: string): Promise<number> {
	try {
		return (await stat(join(tclDataDir(), feed, `${day}.jsonl.gz`))).size;
	} catch {
		return 0;
	}
}

function emptyHour(): HourDelays {
	return {
		count: 0,
		total: 0,
		histogram: Array.from({ length: DELAY_BUCKETS.max - DELAY_BUCKETS.min + 1 }, () => 0),
	};
}

function addDelay(slot: HourDelays, delay: number): void {
	const bucket = Math.min(DELAY_BUCKETS.max, Math.max(DELAY_BUCKETS.min, Math.floor(delay / 60)));
	slot.count++;
	slot.total += delay;
	slot.histogram[bucket - DELAY_BUCKETS.min]++;
}

function mergeHour(target: HourDelays, source: HourDelays): void {
	target.count += source.count;
	target.total += source.total;
	source.histogram.forEach((value, index) => (target.histogram[index] += value));
}

function groupDelays(delays: DaySummary['delays']): Map<string, HourDelays[]> {
	const study = new Set(grenetteLines());
	const groups = new Map<string, HourDelays[]>(
		Object.values(GROUP_LINES).map((key) => [`${key}|`, Array.from({ length: 24 }, emptyHour)]),
	);
	for (const [lineKey, hours] of delays) {
		const line = lineKey.split('|')[0];
		const targets = [GROUP_LINES.network];
		if (!study.has(line) && /^(C|TB)\d+/.test(line)) {
			targets.push(GROUP_LINES.strong);
		}
		if (!study.has(line) && /^T\d+$/.test(line)) {
			targets.push(GROUP_LINES.trams);
		}
		for (const target of targets) {
			const sums = groups.get(`${target}|`)!;
			hours.forEach((slot, hour) => mergeHour(sums[hour], slot));
		}
	}
	return groups;
}

function addCell(cells: DaySummary['cells'], line: string, lat: number, lon: number): CellTotals {
	const latIndex = Math.floor(lat / CELL.lat);
	const lonIndex = Math.floor(lon / CELL.lon);
	const key = `${latIndex}:${lonIndex}`;
	let byCell = cells.get(line);
	if (!byCell) {
		byCell = new Map();
		cells.set(line, byCell);
	}
	let totals = byCell.get(key);
	if (!totals) {
		totals = { latIndex, lonIndex, journeys: 0, lost: 0, seconds: 0 };
		byCell.set(key, totals);
	}
	return totals;
}

async function summarizeDay(day: string): Promise<DaySummary> {
	const vmPath = join(tclDataDir(), 'vm', `${day}.jsonl.gz`);
	const tracks = new Map<string, Track>();
	const summary: DaySummary = {
		day,
		complete: day < todayInParis(),
		vmRecords: 0,
		vmMaxGapS: null,
		bytes: {
			vm: await fileSize('vm', day),
			et: await fileSize('et', day),
			sx: await fileSize('sx', day),
			stops: await fileSize('stops', day),
		},
		crossings: [],
		delays: new Map(),
		cells: new Map(),
		passages: [],
	};
	const detector = createPassageDetector();
	const replay = createReplayWriter(day);
	if (summary.bytes.vm === 0) {
		return summary;
	}

	let previousReceived: number | null = null;
	for await (const record of readRecords(vmPath)) {
		summary.vmRecords++;
		let hour: number | null = null;
		if (typeof record.received === 'string') {
			const at = Date.parse(record.received);
			if (previousReceived !== null) {
				summary.vmMaxGapS = Math.max(
					summary.vmMaxGapS ?? 0,
					Math.round((at - previousReceived) / 1000),
				);
			}
			previousReceived = at;
			hour = parisHour(at);
			await replay.add(at / 1000, Array.isArray(record.items) ? record.items : []);
		}

		for (const item of Array.isArray(record.items) ? record.items : []) {
			const activity = item as Record<string, unknown>;
			const journey = (activity.MonitoredVehicleJourney ?? {}) as Record<string, unknown>;
			const key = vehicleKey(activity);
			const line = lineCode(activity);
			const time = recordedAt(activity);
			if (!key || !line || !time) {
				continue;
			}
			const t = Date.parse(time) / 1000;
			let track = tracks.get(key);
			if (!track) {
				track = { last: null, route: null, west: null, east: null, counted: 0 };
				tracks.set(key, track);
			}
			if (t <= track.counted) {
				continue;
			}
			track.counted = t;

			const parsedDelay = parseDuration(journey.Delay);
			const delay =
				parsedDelay !== null &&
				Math.abs(parsedDelay) <= MAX_DELAY_S &&
				journey.VehicleStatus !== 'CANCELLED' &&
				journey.VehicleStatus !== 'AT_ORIGIN'
					? parsedDelay
					: null;
			const lineKey = `${line}|${directionOf(journey)}`;
			if (delay !== null) {
				let hours = summary.delays.get(lineKey);
				if (!hours) {
					hours = Array.from({ length: 24 }, emptyHour);
					summary.delays.set(lineKey, hours);
				}
				addDelay(hours[hour ?? parisHour(t * 1000)], delay);
			}

			const location = (journey.VehicleLocation ?? {}) as Record<string, unknown>;
			const lat = Number(location.Latitude);
			const lon = Number(location.Longitude);
			if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
				track.last = null;
				track.route = null;
				continue;
			}
			const point: Point = { t, lat, lon, line };
			const journeyId = journeyKey(journey) ?? key;
			detector.add(journey, line, t, lat, lon);

			const before = track.route;
			let cell: string | null = before?.journey === journeyId ? before.cell : null;
			if (
				before &&
				before.line === line &&
				before.journey === journeyId &&
				before.delay !== null &&
				delay !== null &&
				t - before.t <= MAX_SAMPLE_GAP_S &&
				distanceMeters(before, point) <= MAX_SEGMENT_M
			) {
				const midLat = (before.lat + lat) / 2;
				const midLon = (before.lon + lon) / 2;
				const totals = addCell(summary.cells, lineKey, midLat, midLon);
				const cellId = `${totals.latIndex}:${totals.lonIndex}`;
				if (cellId !== cell) {
					totals.journeys++;
					cell = cellId;
				}
				totals.lost += delay - before.delay;
				totals.seconds += t - before.t;
			}
			track.route = { ...point, delay, journey: journeyId, cell };

			if (!inBox(lat, lon)) {
				track.last = null;
				continue;
			}
			const previous = track.last;
			track.last = point;
			if (!previous || previous.line !== line || t - previous.t > MAX_SAMPLE_GAP_S) {
				track.west = null;
				track.east = null;
				continue;
			}
			const west = gateCrossing(previous, point, GRENETTE.westLon);
			const east = gateCrossing(previous, point, GRENETTE.eastLon);
			const events = [
				...(west !== null ? [{ gate: 'west' as const, at: west }] : []),
				...(east !== null ? [{ gate: 'east' as const, at: east }] : []),
			].sort((a, b) => a.at - b.at);
			for (const event of events) {
				const opposite = event.gate === 'west' ? track.east : track.west;
				if (opposite !== null && event.at - opposite <= MAX_TRAVERSAL_S) {
					summary.crossings.push({
						line,
						direction: event.gate === 'east' ? 'east' : 'west',
						enteredAt: Math.round(opposite),
						seconds: Math.round(event.at - opposite),
					});
					track.west = null;
					track.east = null;
				} else {
					track[event.gate] = event.at;
					track[event.gate === 'west' ? 'east' : 'west'] = null;
				}
			}
		}
	}
	await replay.finish();
	summary.passages = detector.passages;
	return summary;
}

function store(summary: DaySummary): void {
	const db = getTclDb();
	const insertCrossing = db.prepare(
		'INSERT INTO crossings (day, line, direction, entered_at, hour, seconds) VALUES (?, ?, ?, ?, ?, ?)',
	);
	const insertDelay = db.prepare(
		'INSERT INTO delays (line, direction, day, hour, count, total_s, histogram) VALUES (?, ?, ?, ?, ?, ?, ?)',
	);
	const insertCell = db.prepare(
		'INSERT INTO cells (line, direction, day, lat_index, lon_index, journeys, lost_s, bus_s) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
	);
	const insertPassage = db.prepare(
		'INSERT INTO passages (day, line, direction, journey, stop_id, stop_order, aimed, actual) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
	);
	transaction(db, () => {
		for (const table of ['crossings', 'delays', 'cells', 'passages', 'days']) {
			db.prepare(`DELETE FROM ${table} WHERE day = ?`).run(summary.day);
		}
		db.prepare(
			`INSERT INTO days (day, version, computed_at, complete, vm_records, vm_max_gap_s, vm_bytes, et_bytes, sx_bytes, stops_bytes)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		).run(
			summary.day,
			SUMMARY_VERSION,
			new Date().toISOString(),
			summary.complete ? 1 : 0,
			summary.vmRecords,
			summary.vmMaxGapS,
			summary.bytes.vm,
			summary.bytes.et,
			summary.bytes.sx,
			summary.bytes.stops,
		);
		for (const crossing of summary.crossings) {
			insertCrossing.run(
				summary.day,
				crossing.line,
				crossing.direction,
				crossing.enteredAt,
				parisHour(crossing.enteredAt * 1000),
				crossing.seconds,
			);
		}
		for (const [lineKey, hours] of [...summary.delays, ...groupDelays(summary.delays)]) {
			const [line, direction] = lineKey.split('|');
			hours.forEach((slot, hour) => {
				if (slot.count > 0) {
					insertDelay.run(
						line,
						direction,
						summary.day,
						hour,
						slot.count,
						Math.round(slot.total),
						JSON.stringify(slot.histogram),
					);
				}
			});
		}
		for (const [lineKey, cells] of summary.cells) {
			const [line, direction] = lineKey.split('|');
			for (const totals of cells.values()) {
				if (totals.journeys > 0) {
					insertCell.run(
						line,
						direction,
						summary.day,
						totals.latIndex,
						totals.lonIndex,
						totals.journeys,
						Math.round(totals.lost),
						Math.round(totals.seconds),
					);
				}
			}
		}
		for (const passage of summary.passages) {
			insertPassage.run(
				summary.day,
				passage.line,
				passage.direction,
				passage.journey,
				passage.stopId,
				passage.order,
				passage.aimed,
				passage.actual,
			);
		}
	});
}

async function days(): Promise<string[]> {
	const found = new Set<string>();
	for (const feed of FEEDS) {
		try {
			for (const file of await readdir(join(tclDataDir(), feed))) {
				const match = file.match(/^(\d{4}-\d{2}-\d{2})\.jsonl\.gz$/);
				if (match) {
					found.add(match[1]);
				}
			}
		} catch {
			continue;
		}
	}
	return [...found].sort();
}

export async function refreshTclSummaries(): Promise<void> {
	if (state.running) {
		return;
	}
	state.running = true;
	try {
		await refreshStops();
		await refreshGtfs();
		const db = getTclDb();
		const known = new Map(
			(
				db.prepare('SELECT day, version, computed_at, complete FROM days').all() as {
					day: string;
					version: number;
					computed_at: string;
					complete: number;
				}[]
			).map((row) => [row.day, row]),
		);
		const today = todayInParis();
		for (const day of await days()) {
			const row = known.get(day);
			const stale =
				!row ||
				row.version !== SUMMARY_VERSION ||
				(!row.complete && (day < today || Date.now() - Date.parse(row.computed_at) >= REFRESH_MS));
			if (stale) {
				store(await summarizeDay(day));
			}
		}
		state.lastError = null;
	} catch (error) {
		state.lastError = error instanceof Error ? error.message : String(error);
		console.error('[tcl] summaries failed:', error);
	} finally {
		state.running = false;
		state.lastRunAt = new Date().toISOString();
	}
}

export function getTclSummaryStatus() {
	const scope = globalThis as Record<string, unknown>;
	const shared = (scope[SCHEDULER_KEY] as typeof state | undefined) ?? state;
	return { running: shared.running, lastRunAt: shared.lastRunAt, lastError: shared.lastError };
}

export function startTclSummaries(): void {
	const scope = globalThis as Record<string, unknown>;
	if (scope[SCHEDULER_KEY]) {
		return;
	}
	scope[SCHEDULER_KEY] = state;
	const run = async () => {
		await refreshTclSummaries();
		setTimeout(run, REFRESH_MS).unref();
	};
	setTimeout(run, 5_000).unref();
}
