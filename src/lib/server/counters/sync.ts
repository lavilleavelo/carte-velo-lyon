import { addDays, isSpringDstDay, todayInParis } from './calendar';
import { startCarCountersSync } from './carSync';
import { getCountersDb, transaction } from './db';
import { fetchEcoCounters, fetchEcoCounts, SCOOTER_PRACTICE, type EcoCounter } from './ecoCounter';
import { syncCounterPhotos } from './photos';
import { fetchSchoolHolidays } from './schoolHolidays';

const HISTORY_START = '2015-01-01';
// Counters upload their data late and Eco-Counter corrects it afterwards
const OVERLAP_DAYS = 7;
const HOURLY_CHUNK_DAYS = 366;
const CONCURRENCY = 4;
const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
const MIN_RESYNC_MS = 60 * 60 * 1000;
const SCHEDULER_KEY = '__carteVeloLyonCountersSync';

let running: Promise<void> | null = null;

// Rows carry no hour: days with missing hours cannot be aligned and are skipped
function groupHourly(rows: [string, number][]): {
	hoursByDay: Map<string, (number | null)[]>;
	incompleteDays: string[];
} {
	const rowsByDay = new Map<string, number[]>();
	for (const [day, count] of rows) {
		const hours = rowsByDay.get(day) ?? [];
		hours.push(count);
		rowsByDay.set(day, hours);
	}

	const hoursByDay = new Map<string, (number | null)[]>();
	const incompleteDays: string[] = [];
	for (const [day, hours] of rowsByDay) {
		if (hours.length === 24) {
			hoursByDay.set(day, hours);
		} else if (hours.length === 23 && isSpringDstDay(day)) {
			hoursByDay.set(day, [...hours.slice(0, 2), null, ...hours.slice(2)]);
		} else {
			incompleteDays.push(`${day} (${hours.length}h)`);
		}
	}
	return { hoursByDay, incompleteDays };
}

async function syncCounter(counter: EcoCounter, today: string): Promise<void> {
	const db = getCountersDb();

	const { lastDay } = db
		.prepare('SELECT MAX(day) AS lastDay FROM counter_days WHERE id_pdc = ?')
		.get(counter.idPdc) as { lastDay: string | null };
	const dailyRows = await fetchEcoCounts(
		counter,
		'day',
		lastDay ? addDays(lastDay, -OVERLAP_DAYS) : HISTORY_START,
		today,
	);
	const upsertDay = db.prepare(`
		INSERT INTO counter_days (id_pdc, day, total) VALUES (?, ?, ?)
		ON CONFLICT (id_pdc, day) DO UPDATE SET total = excluded.total
	`);
	transaction(db, () => {
		for (const [day, count] of dailyRows) {
			upsertDay.run(counter.idPdc, day, count);
		}
	});

	await syncScooterDays(counter, today);

	const { lastHourlyDay, firstDay } = db
		.prepare(
			`SELECT
				MAX(CASE WHEN hourly IS NOT NULL THEN day END) AS lastHourlyDay,
				MIN(CASE WHEN total > 0 THEN day END) AS firstDay
			FROM counter_days WHERE id_pdc = ?`,
		)
		.get(counter.idPdc) as { lastHourlyDay: string | null; firstDay: string | null };
	const hourlyFrom = lastHourlyDay ? addDays(lastHourlyDay, -OVERLAP_DAYS) : firstDay;

	if (hourlyFrom) {
		const upsertHours = db.prepare(`
			INSERT INTO counter_days (id_pdc, day, total, hourly) VALUES (?, ?, ?, ?)
			ON CONFLICT (id_pdc, day) DO UPDATE SET hourly = excluded.hourly
		`);
		const incompleteDays: string[] = [];
		for (let from = hourlyFrom; from < today; from = addDays(from, HOURLY_CHUNK_DAYS)) {
			const chunkEnd = addDays(from, HOURLY_CHUNK_DAYS);
			const rows = await fetchEcoCounts(counter, 'hour', from, chunkEnd < today ? chunkEnd : today);
			const grouped = groupHourly(rows);
			incompleteDays.push(...grouped.incompleteDays);
			transaction(db, () => {
				for (const [day, hours] of grouped.hoursByDay) {
					const total = hours.reduce<number>((sum, count) => sum + (count ?? 0), 0);
					upsertHours.run(counter.idPdc, day, total, JSON.stringify(hours));
				}
			});
		}
		if (incompleteDays.length > 0) {
			console.warn(
				`[counters] ${counter.name}: ${incompleteDays.length} days with incomplete hourly data ` +
					`(${incompleteDays.slice(0, 3).join(', ')}…)`,
			);
		}
	}

	db.prepare('UPDATE counters SET synced_at = ? WHERE id_pdc = ?').run(
		new Date().toISOString(),
		counter.idPdc,
	);
}

// E-scooters are counted with the bikes in counter_days, their own flows give their share
async function syncScooterDays(counter: EcoCounter, today: string): Promise<void> {
	const flowIds = counter.flows
		.filter((flow) => flow.practice === SCOOTER_PRACTICE)
		.map((flow) => flow.id)
		.join(';');
	if (!flowIds) {
		return;
	}

	const db = getCountersDb();
	const { lastDay } = db
		.prepare('SELECT MAX(day) AS lastDay FROM counter_scooter_days WHERE id_pdc = ?')
		.get(counter.idPdc) as { lastDay: string | null };
	const rows = await fetchEcoCounts(
		{ idPdc: counter.idPdc, flowIds },
		'day',
		lastDay ? addDays(lastDay, -OVERLAP_DAYS) : HISTORY_START,
		today,
	);
	const upsert = db.prepare(`
		INSERT INTO counter_scooter_days (id_pdc, day, total) VALUES (?, ?, ?)
		ON CONFLICT (id_pdc, day) DO UPDATE SET total = excluded.total
	`);
	transaction(db, () => {
		for (const [day, count] of rows) {
			upsert.run(counter.idPdc, day, count);
		}
	});
}

async function runWithConcurrency<T>(
	items: T[],
	concurrency: number,
	fn: (item: T) => Promise<void>,
): Promise<void> {
	let next = 0;
	const workers = Array.from({ length: concurrency }, async () => {
		while (next < items.length) {
			await fn(items[next++]);
		}
	});
	await Promise.all(workers);
}

// Keeps the previous calendar when the Éducation nationale API is unavailable
async function syncSchoolHolidays(): Promise<void> {
	const holidays = await fetchSchoolHolidays();
	if (holidays.length === 0) {
		return;
	}

	const db = getCountersDb();
	const insert = db.prepare('INSERT INTO school_holidays (start, end, name) VALUES (?, ?, ?)');
	transaction(db, () => {
		db.exec('DELETE FROM school_holidays');
		for (const holiday of holidays) {
			insert.run(holiday.start, holiday.end, holiday.name);
		}
	});
}

async function runSync(): Promise<void> {
	const startedAt = Date.now();
	const db = getCountersDb();

	try {
		await syncSchoolHolidays();
	} catch (error) {
		console.error('[counters] school holidays sync failed:', error);
	}

	const counters = await fetchEcoCounters();

	const upsertCounter = db.prepare(`
		INSERT INTO counters (id_pdc, name, flow_ids, lat, lon) VALUES (?, ?, ?, ?, ?)
		ON CONFLICT (id_pdc) DO UPDATE SET
			name = excluded.name, flow_ids = excluded.flow_ids, lat = excluded.lat, lon = excluded.lon
	`);
	const deleteFlows = db.prepare('DELETE FROM counter_flows WHERE id_pdc = ?');
	const insertFlow = db.prepare(
		'INSERT INTO counter_flows (id_pdc, flow_id, practice) VALUES (?, ?, ?)',
	);
	transaction(db, () => {
		for (const counter of counters) {
			upsertCounter.run(counter.idPdc, counter.name, counter.flowIds, counter.lat, counter.lon);
			deleteFlows.run(counter.idPdc);
			for (const flow of counter.flows) {
				insertFlow.run(counter.idPdc, flow.id, flow.practice);
			}
		}
	});

	const syncedAt = new Map(
		(
			db.prepare('SELECT id_pdc, synced_at FROM counters').all() as {
				id_pdc: number;
				synced_at: string | null;
			}[]
		).map((row) => [row.id_pdc, row.synced_at]),
	);
	const toSync = counters.filter((counter) => {
		const lastSync = syncedAt.get(counter.idPdc);
		return !lastSync || Date.now() - Date.parse(lastSync) > MIN_RESYNC_MS;
	});

	const today = todayInParis();
	let failures = 0;
	await runWithConcurrency(toSync, CONCURRENCY, async (counter) => {
		try {
			await syncCounter(counter, today);
		} catch (error) {
			failures++;
			console.error(`[counters] sync failed for ${counter.name} (${counter.idPdc}):`, error);
		}
	});

	const seconds = Math.round((Date.now() - startedAt) / 1000);
	console.log(
		`[counters] synced ${toSync.length - failures}/${toSync.length} counters in ${seconds}s`,
	);

	try {
		await syncCounterPhotos(counters);
	} catch (error) {
		console.error('[counters] photos sync failed:', error);
	}
}

export function syncCounters(): Promise<void> {
	if (!running) {
		running = runSync().finally(() => {
			running = null;
		});
	}
	return running;
}

export function startCountersSync(): void {
	if (process.env.COUNTERS_SYNC === 'false') {
		return;
	}

	// Survives module reloads in dev
	const scope = globalThis as Record<string, unknown>;
	if (scope[SCHEDULER_KEY]) {
		return;
	}
	scope[SCHEDULER_KEY] = true;

	const run = () => {
		syncCounters().catch((error) => {
			console.error('[counters] sync failed:', error);
		});
	};
	run();
	setInterval(run, SYNC_INTERVAL_MS).unref();

	startCarCountersSync();
}
