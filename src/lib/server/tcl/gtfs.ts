import { createHash } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DatabaseSync, StatementSync } from 'node:sqlite';
import { getTclDb } from './db';
import { tclDataDir } from './files';
import { readZipCsv, readZipEntry } from './zip';

const GTFS_URLS = [
	'https://www.data.gouv.fr/api/1/datasets/r/abebedc6-28cf-4e2e-9c64-db57a40156f8',
	'https://download.data.grandlyon.com/files/rdata/tcl_sytral.tcltheorique/GTFS_TCL.ZIP',
];
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 50_000;
const RECOMPUTE_DAYS = 14;
const CONTENT_FILES = [
	'routes.txt',
	'stops.txt',
	'trips.txt',
	'stop_times.txt',
	'calendar.txt',
	'calendar_dates.txt',
];
const MAX_CALL_DIFF_S = 120;

export type TripStop = { seq: number; stopId: number; arrival: number; lat: number; lon: number };

export type GtfsVersion = {
	importedAt: string;
	validFrom: string | null;
	validTo: string | null;
	trips: number;
	lines: number;
	changes: { line: string; before: number; after: number }[] | null;
	recomputedFrom: string | null;
	recomputedTo: string | null;
};

export type GtfsStatus = {
	importedAt: string | null;
	feedVersion: string | null;
	validFrom: string | null;
	validTo: string | null;
	trips: number;
	lastCheckAt: string | null;
	lastError: string | null;
	versions: GtfsVersion[];
};

const status: GtfsStatus = {
	importedAt: null,
	feedVersion: null,
	validFrom: null,
	validTo: null,
	trips: 0,
	lastCheckAt: null,
	lastError: null,
	versions: [],
};

let lastCheck = 0;
const activeCache = new Map<string, Set<string>>();

function meta(db: DatabaseSync, key: string): string | null {
	const row = db.prepare('SELECT value FROM gtfs_meta WHERE key = ?').get(key) as
		| { value: string }
		| undefined;
	return row?.value ?? null;
}

function setMeta(db: DatabaseSync, key: string, value: string): void {
	db.prepare(
		'INSERT INTO gtfs_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
	).run(key, value);
}

function seconds(time: string): number | null {
	const match = time.trim().match(/^(\d+):(\d{2}):(\d{2})$/);
	return match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) : null;
}

async function download(path: string): Promise<void> {
	let lastError: unknown = null;
	for (const url of GTFS_URLS) {
		try {
			const response = await fetch(url, {
				headers: { 'User-Agent': 'carte-velo-lyon' },
				redirect: 'follow',
				signal: AbortSignal.timeout(5 * 60_000),
			});
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}
			const body = Buffer.from(await response.arrayBuffer());
			if (body.length < 1_000_000 || body.readUInt32LE(0) !== 0x04034b50) {
				throw new Error('not a GTFS archive');
			}
			await writeFile(path, body);
			return;
		} catch (error) {
			lastError = error;
		}
	}
	throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function batched(db: DatabaseSync) {
	let pending = 0;
	db.exec('BEGIN');
	return {
		tick() {
			pending++;
			if (pending >= BATCH_SIZE) {
				db.exec('COMMIT');
				db.exec('BEGIN');
				pending = 0;
			}
		},
		done() {
			db.exec('COMMIT');
		},
		abort() {
			db.exec('ROLLBACK');
		},
	};
}

async function importArchive(path: string): Promise<void> {
	const db = getTclDb();
	const lines = new Map<string, string>();
	for await (const row of readZipCsv(path, 'routes.txt')) {
		lines.set(row.route_id, (row.route_short_name || row.route_id).toUpperCase());
	}

	for (const table of [
		'gtfs_stop_times',
		'gtfs_trips',
		'gtfs_stops',
		'gtfs_calendar',
		'gtfs_calendar_dates',
	]) {
		db.exec(`DELETE FROM ${table}`);
	}

	const batch = batched(db);
	try {
		const insertStop = db.prepare(
			'INSERT OR REPLACE INTO gtfs_stops (id, name, lat, lon) VALUES (?, ?, ?, ?)',
		);
		for await (const row of readZipCsv(path, 'stops.txt')) {
			const id = Number(row.stop_id);
			if (Number.isInteger(id)) {
				insertStop.run(id, row.stop_name, Number(row.stop_lat), Number(row.stop_lon));
				batch.tick();
			}
		}

		const tripIds = new Map<string, number>();
		const insertTrip = db.prepare(
			'INSERT INTO gtfs_trips (id, trip_id, line, direction, service_id) VALUES (?, ?, ?, ?, ?)',
		);
		for await (const row of readZipCsv(path, 'trips.txt')) {
			const id = tripIds.size + 1;
			tripIds.set(row.trip_id, id);
			insertTrip.run(
				id,
				row.trip_id,
				lines.get(row.route_id) ?? row.route_id.toUpperCase(),
				row.direction_id === '1' ? 'inbound' : 'outbound',
				row.service_id,
			);
			batch.tick();
		}

		const insertStopTime: StatementSync = db.prepare(
			'INSERT OR REPLACE INTO gtfs_stop_times (trip, seq, stop_id, arrival) VALUES (?, ?, ?, ?)',
		);
		for await (const row of readZipCsv(path, 'stop_times.txt')) {
			const trip = tripIds.get(row.trip_id);
			const arrival = seconds(row.arrival_time || row.departure_time);
			const stopId = Number(row.stop_id);
			if (trip !== undefined && arrival !== null && Number.isInteger(stopId)) {
				insertStopTime.run(trip, Number(row.stop_sequence), stopId, arrival);
				batch.tick();
			}
		}

		const insertCalendar = db.prepare(
			'INSERT OR REPLACE INTO gtfs_calendar (service_id, days, start_date, end_date) VALUES (?, ?, ?, ?)',
		);
		for await (const row of readZipCsv(path, 'calendar.txt')) {
			const days = [
				row.monday,
				row.tuesday,
				row.wednesday,
				row.thursday,
				row.friday,
				row.saturday,
				row.sunday,
			].join('');
			insertCalendar.run(row.service_id, days, row.start_date, row.end_date);
			batch.tick();
		}

		const insertDate = db.prepare(
			'INSERT OR REPLACE INTO gtfs_calendar_dates (service_id, date, type) VALUES (?, ?, ?)',
		);
		for await (const row of readZipCsv(path, 'calendar_dates.txt')) {
			insertDate.run(row.service_id, row.date, Number(row.exception_type));
			batch.tick();
		}

		let feedVersion = '';
		let validFrom = '';
		let validTo = '';
		for await (const row of readZipCsv(path, 'feed_info.txt')) {
			feedVersion = row.feed_version ?? '';
			validFrom = row.feed_start_date ?? '';
			validTo = row.feed_end_date ?? '';
		}
		setMeta(db, 'feed_version', feedVersion);
		setMeta(db, 'valid_from', validFrom);
		setMeta(db, 'valid_to', validTo);
		setMeta(db, 'imported_at', new Date().toISOString());
		batch.done();
	} catch (error) {
		batch.abort();
		throw error;
	}
	activeCache.clear();
}

function loadStatus(): void {
	const db = getTclDb();
	status.importedAt = meta(db, 'imported_at');
	status.feedVersion = meta(db, 'feed_version');
	status.validFrom = meta(db, 'valid_from');
	status.validTo = meta(db, 'valid_to');
	status.trips = (db.prepare('SELECT COUNT(*) AS n FROM gtfs_trips').get() as { n: number }).n;
	status.versions = (
		db
			.prepare(
				`SELECT imported_at, valid_from, valid_to, trips, lines, changes, recomputed_from, recomputed_to
				 FROM gtfs_versions ORDER BY id DESC LIMIT 20`,
			)
			.all() as {
			imported_at: string;
			valid_from: string | null;
			valid_to: string | null;
			trips: number;
			lines: number;
			changes: string | null;
			recomputed_from: string | null;
			recomputed_to: string | null;
		}[]
	).map((row) => ({
		importedAt: row.imported_at,
		validFrom: row.valid_from,
		validTo: row.valid_to,
		trips: row.trips,
		lines: row.lines,
		changes: row.changes ? JSON.parse(row.changes) : null,
		recomputedFrom: row.recomputed_from,
		recomputedTo: row.recomputed_to,
	}));
}

function isoDate(value: string | null): string | null {
	return value && /^\d{8}$/.test(value)
		? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`
		: null;
}

function shiftDay(day: string, days: number): string {
	const date = new Date(`${day}T12:00:00Z`);
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().slice(0, 10);
}

function parisToday(): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
}

async function contentHash(path: string): Promise<string> {
	const hash = createHash('sha256');
	for (const name of CONTENT_FILES) {
		hash.update(name);
		for await (const chunk of readZipEntry(path, name)) {
			hash.update(chunk);
		}
	}
	return hash.digest('hex');
}

function tripsPerLine(db: DatabaseSync): Map<string, number> {
	return new Map(
		(
			db.prepare('SELECT line, COUNT(*) AS n FROM gtfs_trips GROUP BY line').all() as {
				line: string;
				n: number;
			}[]
		).map((row) => [row.line, row.n]),
	);
}

function recordVersion(
	db: DatabaseSync,
	hash: string,
	before: Map<string, number>,
	archive: string,
): void {
	const after = tripsPerLine(db);
	const changes = [...new Set([...before.keys(), ...after.keys()])]
		.map((line) => ({ line, before: before.get(line) ?? 0, after: after.get(line) ?? 0 }))
		.filter((change) => change.before !== change.after)
		.sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before));
	const validFrom = isoDate(meta(db, 'valid_from'));
	const validTo = isoDate(meta(db, 'valid_to'));
	const today = parisToday();
	let recomputedFrom: string | null = null;
	let recomputedTo: string | null = null;
	if (before.size > 0) {
		const lowest = shiftDay(today, -RECOMPUTE_DAYS);
		recomputedFrom = validFrom && validFrom > lowest ? validFrom : lowest;
		recomputedTo = shiftDay(today, -1);
		if (validTo && validTo < recomputedTo) {
			recomputedTo = validTo;
		}
		if (recomputedFrom <= recomputedTo) {
			db.prepare('UPDATE days SET complete = 0 WHERE day >= ? AND day <= ?').run(
				recomputedFrom,
				recomputedTo,
			);
		} else {
			recomputedFrom = null;
			recomputedTo = null;
		}
	}
	db.prepare(
		`INSERT INTO gtfs_versions (imported_at, content_hash, feed_version, valid_from, valid_to, trips, lines, changes, recomputed_from, recomputed_to, archive)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(
		new Date().toISOString(),
		hash,
		meta(db, 'feed_version'),
		validFrom,
		validTo,
		[...after.values()].reduce((sum, n) => sum + n, 0),
		after.size,
		before.size > 0 ? JSON.stringify(changes) : null,
		recomputedFrom,
		recomputedTo,
		archive,
	);
}

export async function refreshGtfs(): Promise<void> {
	loadStatus();
	if (Date.now() - lastCheck < CHECK_INTERVAL_MS) {
		return;
	}
	lastCheck = Date.now();
	status.lastCheckAt = new Date().toISOString();
	const dir = join(tclDataDir(), 'gtfs');
	const temporary = join(dir, 'download.zip.tmp');
	try {
		await mkdir(join(dir, 'archive'), { recursive: true });
		await download(temporary);
		const hash = await contentHash(temporary);
		const db = getTclDb();
		if (hash === meta(db, 'content_hash') && status.trips > 0) {
			await rm(temporary, { force: true });
		} else {
			const before = tripsPerLine(db);
			await importArchive(temporary);
			const archive = join(dir, 'archive', `${parisToday()}-${hash.slice(0, 8)}.zip`);
			await rename(temporary, archive);
			setMeta(db, 'content_hash', hash);
			recordVersion(db, hash, before, archive);
			console.log('[tcl] GTFS imported');
		}
		status.lastError = null;
	} catch (error) {
		status.lastError = error instanceof Error ? error.message : String(error);
		console.error('[tcl] GTFS refresh failed:', error);
		await rm(temporary, { force: true }).catch(() => undefined);
	} finally {
		loadStatus();
	}
}

export function getGtfsStatus(): GtfsStatus {
	return { ...status };
}

function compactDate(day: string): string {
	return day.replaceAll('-', '');
}

export function activeServices(day: string): Set<string> {
	const cached = activeCache.get(day);
	if (cached) {
		return cached;
	}
	const db = getTclDb();
	const date = compactDate(day);
	const weekday = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
	const services = new Set(
		(
			db
				.prepare(
					'SELECT service_id, days FROM gtfs_calendar WHERE start_date <= ? AND end_date >= ?',
				)
				.all(date, date) as { service_id: string; days: string }[]
		)
			.filter((row) => row.days[weekday] === '1')
			.map((row) => row.service_id),
	);
	for (const row of db
		.prepare('SELECT service_id, type FROM gtfs_calendar_dates WHERE date = ?')
		.all(date) as { service_id: string; type: number }[]) {
		if (row.type === 1) {
			services.add(row.service_id);
		} else {
			services.delete(row.service_id);
		}
	}
	if (activeCache.size > 10) {
		activeCache.clear();
	}
	activeCache.set(day, services);
	return services;
}

export function serviceDayStart(day: string): number {
	const noonUtc = Date.UTC(
		Number(day.slice(0, 4)),
		Number(day.slice(5, 7)) - 1,
		Number(day.slice(8, 10)),
		12,
	);
	const parisHour = Number(
		new Intl.DateTimeFormat('en-GB', {
			timeZone: 'Europe/Paris',
			hour: '2-digit',
			hourCycle: 'h23',
		}).format(noonUtc),
	);
	return Math.round((noonUtc - (parisHour - 12) * 3_600_000) / 1000) - 12 * 3600;
}

export function createTripMatcher(day: string) {
	const db = getTclDb();
	const services = activeServices(day);
	const byTripId = db.prepare('SELECT id, line, service_id FROM gtfs_trips WHERE trip_id = ?');
	const byCall = db.prepare(
		`SELECT t.id, t.service_id FROM gtfs_stop_times st JOIN gtfs_trips t ON t.id = st.trip
		 WHERE st.stop_id = ? AND st.arrival = ? AND t.line = ? AND t.direction = ?`,
	);
	const arrivalAt = db.prepare(
		'SELECT arrival FROM gtfs_stop_times WHERE trip = ? AND stop_id = ?',
	);
	const stopsOf = db.prepare(
		`SELECT st.seq, st.stop_id AS stopId, st.arrival, s.lat, s.lon
		 FROM gtfs_stop_times st JOIN gtfs_stops s ON s.id = st.stop_id
		 WHERE st.trip = ? ORDER BY st.seq`,
	);
	const base = serviceDayStart(day);
	const cache = new Map<string, number | null>();
	const stopsCache = new Map<number, TripStop[]>();

	return {
		base,
		match(
			cacheKey: string,
			tripId: string,
			line: string,
			direction: string,
			call: { stopId: number | null; aimed: number | null },
		): number | null {
			if (cache.has(cacheKey)) {
				return cache.get(cacheKey) ?? null;
			}
			let trip: number | null = null;
			const direct = byTripId.get(tripId) as
				| { id: number; line: string; service_id: string }
				| undefined;
			const offset = call.aimed === null ? null : call.aimed - base;
			const directValid =
				direct &&
				direct.line === line &&
				services.has(direct.service_id) &&
				(call.stopId === null ||
					offset === null ||
					(arrivalAt.all(direct.id, call.stopId) as { arrival: number }[]).some(
						(row) => Math.abs(row.arrival - offset) <= MAX_CALL_DIFF_S,
					));
			if (direct && directValid) {
				trip = direct.id;
			} else if (call.stopId !== null && offset !== null) {
				const candidates = byCall.all(call.stopId, offset, line, direction) as {
					id: number;
					service_id: string;
				}[];
				trip = candidates.find((candidate) => services.has(candidate.service_id))?.id ?? null;
			}
			cache.set(cacheKey, trip);
			return trip;
		},
		stops(trip: number): TripStop[] {
			let stops = stopsCache.get(trip);
			if (!stops) {
				stops = stopsOf.all(trip) as TripStop[];
				stopsCache.set(trip, stops);
			}
			return stops;
		},
	};
}

let colorCache: {
	archive: string;
	colors: Record<string, { color: string; text: string }>;
} | null = null;

export async function lineColors(): Promise<Record<string, { color: string; text: string }>> {
	const row = getTclDb()
		.prepare('SELECT archive FROM gtfs_versions WHERE archive IS NOT NULL ORDER BY id DESC LIMIT 1')
		.get() as { archive: string } | undefined;
	if (!row) {
		return {};
	}
	if (colorCache?.archive === row.archive) {
		return colorCache.colors;
	}
	const colors: Record<string, { color: string; text: string }> = {};
	try {
		for await (const route of readZipCsv(row.archive, 'routes.txt')) {
			const line = (route.route_short_name || route.route_id).toUpperCase();
			if (/^[0-9A-Fa-f]{6}$/.test(route.route_color ?? '')) {
				colors[line] = {
					color: `#${route.route_color}`,
					text: /^[0-9A-Fa-f]{6}$/.test(route.route_text_color ?? '')
						? `#${route.route_text_color}`
						: '#FFFFFF',
				};
			}
		}
	} catch {
		return {};
	}
	colorCache = { archive: row.archive, colors };
	return colors;
}
