import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { transaction } from '$lib/server/counters/db';
import { getTclDb } from './db';
import { readRecords, tclDataDir } from './files';
import { createTripMatcher, getGtfsStatus, type TripStop } from './gtfs';
import { directionOf, journeyKey, stopIdOf } from './siri';

const MAX_STOP_DISTANCE_M = 40;
const MAX_GAP_S = 120;
const MAX_SEGMENT_M = 1500;
const LOOKAHEAD = 8;
const RESYNC_DISTANCE_M = 300;
const RETRY_MATCH_S = 600;
const MAX_PASSAGE_DELAY_S = 60 * 60;
const METERS_PER_DEGREE = 111_320;
const LON_SCALE = Math.cos((45.76 * Math.PI) / 180);

export type Passage = {
	line: string;
	direction: string;
	journey: string;
	stopId: number;
	order: number;
	aimed: number;
	actual: number;
};

type Point = { t: number; x: number; y: number };

type Track = {
	line: string;
	direction: string;
	journey: string;
	trip: number | null;
	retryAt: number;
	base: number;
	stops: (TripStop & { x: number; y: number })[];
	next: number;
	last: Point | null;
	seen: Set<number>;
};

let stopsSignature = '';

function project(lat: number, lon: number): { x: number; y: number } {
	return { x: lon * METERS_PER_DEGREE * LON_SCALE, y: lat * METERS_PER_DEGREE };
}

function epoch(value: unknown): number | null {
	if (typeof value !== 'string') {
		return null;
	}
	const time = Date.parse(value);
	return Number.isNaN(time) ? null : Math.round(time / 1000);
}

function serviceDay(journey: Record<string, unknown>): string | null {
	const frame = (journey.FramedVehicleJourneyRef ?? {}) as Record<string, unknown>;
	const value = (frame.DataFrameRef as { value?: unknown } | undefined)?.value;
	const match = typeof value === 'string' ? value.match(/(\d{4})\.(\d{2})\.(\d{2})/) : null;
	return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

export function createPassageDetector() {
	const matchers = new Map<string, ReturnType<typeof createTripMatcher>>();
	const tracks = new Map<string, Track>();
	const passages: Passage[] = [];
	const enabled = getGtfsStatus().trips > 0;

	function matcherFor(day: string) {
		let matcher = matchers.get(day);
		if (!matcher) {
			matcher = createTripMatcher(day);
			matchers.set(day, matcher);
		}
		return matcher;
	}

	function nearestIndex(track: Track, point: { x: number; y: number }, from: number): number {
		let best = -1;
		let bestDistance = Infinity;
		for (let index = from; index < track.stops.length; index++) {
			const stop = track.stops[index];
			const distance = Math.hypot(stop.x - point.x, stop.y - point.y);
			if (distance < bestDistance) {
				bestDistance = distance;
				best = index;
			}
		}
		return bestDistance <= RESYNC_DISTANCE_M ? best : -1;
	}

	function record(track: Track, index: number, time: number) {
		const stop = track.stops[index];
		const aimed = track.base + stop.arrival;
		if (track.seen.has(stop.seq) || Math.abs(time - aimed) > MAX_PASSAGE_DELAY_S) {
			return;
		}
		track.seen.add(stop.seq);
		passages.push({
			line: track.line,
			direction: track.direction,
			journey: track.journey,
			stopId: stop.stopId,
			order: stop.seq,
			aimed,
			actual: Math.round(time),
		});
	}

	function resolve(track: Track, journey: Record<string, unknown>, t: number) {
		if (track.trip !== null || t < track.retryAt) {
			return;
		}
		const day = serviceDay(journey);
		if (!day) {
			track.retryAt = Infinity;
			return;
		}
		const matcher = matcherFor(day);
		const call = (journey.MonitoredCall ?? {}) as Record<string, unknown>;
		const inner = track.journey.replace(/^.*VehicleJourney::/, '').replace(/:[^:]*$/, '');
		const trip = matcher.match(
			`${inner}|${t - (t % RETRY_MATCH_S)}`,
			inner,
			track.line,
			track.direction,
			{
				stopId: stopIdOf(call),
				aimed: epoch(call.AimedArrivalTime) ?? epoch(call.AimedDepartureTime),
			},
		);
		if (trip === null) {
			track.retryAt = t + RETRY_MATCH_S;
			return;
		}
		track.trip = trip;
		track.base = matcher.base;
		track.stops = matcher.stops(trip).map((stop) => ({ ...stop, ...project(stop.lat, stop.lon) }));
	}

	return {
		passages,
		add(journey: Record<string, unknown>, line: string, t: number, lat: number, lon: number) {
			if (!enabled) {
				return;
			}
			const key = journeyKey(journey);
			if (!key) {
				return;
			}
			let track = tracks.get(key);
			if (!track) {
				track = {
					line,
					direction: directionOf(journey),
					journey: key,
					trip: null,
					retryAt: 0,
					base: 0,
					stops: [],
					next: 0,
					last: null,
					seen: new Set(),
				};
				tracks.set(key, track);
			}
			resolve(track, journey, t);
			if (track.trip === null || track.stops.length === 0) {
				return;
			}
			const point = { t, ...project(lat, lon) };
			const last = track.last;
			track.last = point;
			const gap = last ? t - last.t : Infinity;
			const length = last ? Math.hypot(point.x - last.x, point.y - last.y) : 0;
			if (!last || gap > MAX_GAP_S || gap <= 0 || length > MAX_SEGMENT_M) {
				const index = nearestIndex(track, point, track.next);
				if (index >= 0) {
					const stop = track.stops[index];
					if (Math.hypot(stop.x - point.x, stop.y - point.y) <= MAX_STOP_DISTANCE_M) {
						record(track, index, t);
						track.next = index + 1;
					} else {
						track.next = index;
					}
				}
				return;
			}
			const dx = point.x - last.x;
			const dy = point.y - last.y;
			const squared = dx * dx + dy * dy;
			const end = Math.min(track.stops.length, track.next + LOOKAHEAD);
			for (let index = track.next; index < end; index++) {
				const stop = track.stops[index];
				const u =
					squared === 0
						? 0
						: Math.max(0, Math.min(1, ((stop.x - last.x) * dx + (stop.y - last.y) * dy) / squared));
				const distance = Math.hypot(last.x + u * dx - stop.x, last.y + u * dy - stop.y);
				if (distance <= MAX_STOP_DISTANCE_M) {
					record(track, index, last.t + u * gap);
					track.next = index + 1;
				}
			}
		},
	};
}

export async function refreshStops(): Promise<void> {
	const dir = join(tclDataDir(), 'stops');
	let files: string[];
	try {
		files = (await readdir(dir)).filter((file) => file.endsWith('.jsonl.gz')).sort();
	} catch {
		return;
	}
	const latest = files.at(-1);
	if (!latest) {
		return;
	}
	const path = join(dir, latest);
	const signature = `${latest}:${(await stat(path)).mtimeMs}`;
	if (signature === stopsSignature) {
		return;
	}
	let values: Record<string, unknown>[] = [];
	for await (const record of readRecords(path)) {
		if (Array.isArray(record.values)) {
			values = record.values as Record<string, unknown>[];
		}
	}
	if (values.length === 0) {
		return;
	}
	const db = getTclDb();
	const upsert = db.prepare(
		`INSERT INTO stops (id, name, lat, lon, lines) VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(id) DO UPDATE SET name = excluded.name, lat = excluded.lat, lon = excluded.lon, lines = excluded.lines`,
	);
	transaction(db, () => {
		for (const stop of values) {
			const id = Number(stop.id);
			const lat = Number(stop.lat);
			const lon = Number(stop.lon);
			if (!Number.isFinite(id) || !Number.isFinite(lat) || !Number.isFinite(lon)) {
				continue;
			}
			const lines = String(stop.desserte ?? '')
				.split(',')
				.map((entry) => entry.trim().toUpperCase())
				.filter(Boolean);
			upsert.run(id, String(stop.nom ?? id), lat, lon, [...new Set(lines)].join(','));
		}
	});
	stopsSignature = signature;
}
