import { getCachedCountersData } from '$lib/server/cache';
import { addDays, todayInParis } from './calendar';
import { fetchCeremaMeasures, type CeremaMeasure } from './cerema';
import { getCountersDb, transaction } from './db';

const HISTORY_START = '2018-01-01';
const OVERLAP_DAYS = 7;
const HOURLY_BACKFILL_DAYS = 365;
const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
const LIVE_INTERVAL_MS = 20 * 60 * 1000;
const SCHEDULER_KEY = '__carteVeloLyonCarCountersSync';

type HourlyDay = { hourly: (number | null)[]; predicted: (number | null)[] };

let running: Promise<void> | null = null;
let liveSnapshot: Map<number, Map<string, (number | null)[]>> | null = null;

// Count points of the car counters displayed on cyclopolis
export async function getTrackedCarPoints(): Promise<number[]> {
	const { voiture } = await getCachedCountersData();
	const ids = (voiture as { idsPdc?: number[] }[]).flatMap((counter) => counter.idsPdc ?? []);
	return [...new Set(ids)].sort((a, b) => a - b);
}

export function getCarLiveSnapshot() {
	return liveSnapshot;
}

function average(values: (number | null)[]): number | null {
	const known = values.filter((value): value is number => value !== null);
	return known.length > 0 ? known.reduce((sum, value) => sum + value, 0) / known.length : null;
}

// The fall-back DST day returns two rows for 2am: they are added up
function groupByPointDay(measures: CeremaMeasure[]): Map<string, HourlyDay> {
	const days = new Map<string, HourlyDay>();
	for (const measure of measures) {
		const key = `${measure.pointId}|${measure.day}`;
		const day = days.get(key) ?? { hourly: Array(24).fill(null), predicted: Array(24).fill(null) };
		if (measure.count !== null) {
			day.hourly[measure.hour] = (day.hourly[measure.hour] ?? 0) + measure.count;
		}
		if (measure.predicted !== null) {
			day.predicted[measure.hour] = measure.predicted;
		}
		days.set(key, day);
	}
	return days;
}

function storeDaily(measures: CeremaMeasure[]): void {
	const db = getCountersDb();
	const upsert = db.prepare(`
		INSERT INTO car_point_days (point_id, day, total, predicted) VALUES (?, ?, ?, ?)
		ON CONFLICT (point_id, day) DO UPDATE SET total = excluded.total, predicted = excluded.predicted
	`);
	transaction(db, () => {
		for (const measure of measures) {
			if (measure.count !== null) {
				upsert.run(measure.pointId, measure.day, measure.count, measure.predicted);
			}
		}
	});
}

function storeHourly(measures: CeremaMeasure[]): void {
	const db = getCountersDb();
	const upsert = db.prepare(`
		INSERT INTO car_point_days (point_id, day, total, predicted, hourly, hourly_predicted)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT (point_id, day) DO UPDATE SET
			hourly = excluded.hourly, hourly_predicted = excluded.hourly_predicted
	`);
	transaction(db, () => {
		for (const [key, day] of groupByPointDay(measures)) {
			const [pointId, date] = key.split('|');
			upsert.run(
				Number(pointId),
				date,
				day.hourly.reduce<number>((sum, count) => sum + (count ?? 0), 0),
				average(day.predicted),
				JSON.stringify(day.hourly),
				JSON.stringify(day.predicted),
			);
		}
	});
}

// Newest year first, so that recent hourly profiles are available early
async function backfillHours(pointIds: number[]): Promise<void> {
	const db = getCountersDb();
	const placeholders = pointIds.map(() => '?').join(', ');
	const setCursor = db.prepare('UPDATE car_points SET hourly_from = ? WHERE id = ?');

	for (;;) {
		const pending = db
			.prepare(
				`SELECT p.id, p.hourly_from AS hourlyFrom, MAX(MIN(d.day), ?) AS floor
				FROM car_points p JOIN car_point_days d ON d.point_id = p.id
				WHERE p.id IN (${placeholders}) AND p.hourly_from IS NOT NULL
				GROUP BY p.id HAVING p.hourly_from > floor`,
			)
			.all(HISTORY_START, ...pointIds) as { id: number; hourlyFrom: string; floor: string }[];
		if (pending.length === 0) {
			return;
		}

		const byCursor = Map.groupBy(pending, (point) => point.hourlyFrom);
		for (const [cursor, points] of byCursor) {
			const floor = points.map((point) => point.floor).sort()[0];
			const yearBefore = addDays(cursor, -HOURLY_BACKFILL_DAYS);
			const from = yearBefore > floor ? yearBefore : floor;
			storeHourly(
				await fetchCeremaMeasures(
					points.map((point) => point.id),
					'hour',
					from,
					cursor,
				),
			);
			transaction(db, () => {
				for (const point of points) {
					setCursor.run(from, point.id);
				}
			});
			console.log(`[car counters] hourly data from ${from} for ${points.length} count points`);
		}
	}
}

async function runCarSync(): Promise<void> {
	const startedAt = Date.now();
	const db = getCountersDb();
	const today = todayInParis();
	const pointIds = await getTrackedCarPoints();
	if (pointIds.length === 0) {
		return;
	}

	const insertPoint = db.prepare('INSERT INTO car_points (id) VALUES (?) ON CONFLICT DO NOTHING');
	transaction(db, () => {
		for (const id of pointIds) {
			insertPoint.run(id);
		}
	});

	const placeholders = pointIds.map(() => '?').join(', ');
	const lastDays = new Map(
		(
			db
				.prepare(
					`SELECT point_id AS id, MAX(day) AS lastDay FROM car_point_days
					WHERE point_id IN (${placeholders}) GROUP BY point_id`,
				)
				.all(...pointIds) as { id: number; lastDay: string }[]
		).map((row) => [row.id, row.lastDay]),
	);

	const newPoints = pointIds.filter((id) => !lastDays.has(id));
	if (newPoints.length > 0) {
		storeDaily(await fetchCeremaMeasures(newPoints, 'day', HISTORY_START, today));
	}
	const oldestLastDay = [...lastDays.values()].sort()[0];
	if (oldestLastDay) {
		storeDaily(
			await fetchCeremaMeasures(
				[...lastDays.keys()],
				'day',
				addDays(oldestLastDay, -OVERLAP_DAYS),
				today,
			),
		);
	}

	const recentHoursFrom = addDays(today, -OVERLAP_DAYS);
	storeHourly(await fetchCeremaMeasures(pointIds, 'hour', recentHoursFrom, today));
	db.prepare(
		`UPDATE car_points SET synced_at = ?, hourly_from = COALESCE(hourly_from, ?)
		WHERE id IN (${placeholders})`,
	).run(new Date().toISOString(), recentHoursFrom, ...pointIds);

	const seconds = Math.round((Date.now() - startedAt) / 1000);
	console.log(`[car counters] synced ${pointIds.length} count points in ${seconds}s`);

	await backfillHours(pointIds);
}

async function refreshLiveSnapshot(): Promise<void> {
	const pointIds = await getTrackedCarPoints();
	const today = todayInParis();
	const snapshot = new Map<number, Map<string, (number | null)[]>>();
	for (const [key, day] of groupByPointDay(
		await fetchCeremaMeasures(pointIds, 'hour', addDays(today, -1), addDays(today, 1)),
	)) {
		const [pointId, date] = key.split('|');
		const days = snapshot.get(Number(pointId)) ?? new Map<string, (number | null)[]>();
		days.set(date, day.hourly);
		snapshot.set(Number(pointId), days);
	}
	liveSnapshot = snapshot;
}

export function syncCarCounters(): Promise<void> {
	if (!running) {
		running = runCarSync().finally(() => {
			running = null;
		});
	}
	return running;
}

export function startCarCountersSync(): void {
	const scope = globalThis as Record<string, unknown>;
	if (scope[SCHEDULER_KEY]) {
		return;
	}
	scope[SCHEDULER_KEY] = true;

	const refreshLive = () => {
		refreshLiveSnapshot().catch((error) => {
			console.error('[car counters] live refresh failed:', error);
		});
	};
	const sync = () => {
		syncCarCounters().catch((error) => {
			console.error('[car counters] sync failed:', error);
		});
	};
	refreshLive();
	sync();
	setInterval(refreshLive, LIVE_INTERVAL_MS).unref();
	setInterval(sync, SYNC_INTERVAL_MS).unref();
}
