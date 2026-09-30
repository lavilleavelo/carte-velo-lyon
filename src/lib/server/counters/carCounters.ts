import { addDays, currentHourInParis, todayInParis } from './calendar';
import { getCarLiveSnapshot } from './carSync';
import { getCountersDb } from './db';
import type { DayHours } from './hours';
import type { LiveDay } from './live';
import { computeStats, type DayRow, type DetailedStats, type StatsOptions } from './stats';

const MAX_POINTS = 10;
const MAX_LAG_HOURS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

// measuredShare: share of the traffic actually measured over the period, the rest being
// reconstructed by the Cerema model
export type CarCounterStats = DetailedStats & {
	pointIds: number[];
	syncedAt: string | null;
	quality: { measuredShare: number | null };
};

type Quality = { measured: number; all: number };

export function parsePointIds(value: string | null): number[] | null {
	const ids = (value ?? '').split(',').filter(Boolean).map(Number);
	if (ids.length === 0 || ids.length > MAX_POINTS || !ids.every(Number.isInteger)) {
		return null;
	}
	return [...new Set(ids)];
}

// A car counter on cyclopolis adds up several count points (usually one per direction): a day is
// kept only when every point has data, an hour only when every point has a value
function combineHourly(
	hourlyByPoint: ((number | null)[] | null | undefined)[],
): (number | null)[] | null {
	if (hourlyByPoint.some((hourly) => !hourly)) {
		return null;
	}
	return Array.from({ length: 24 }, (_, hour) => {
		const values = hourlyByPoint.map((hourly) => hourly![hour]);
		return values.some((value) => value === null)
			? null
			: values.reduce((sum, value) => sum! + value!, 0);
	});
}

function loadDays(
	pointIds: number[],
	days?: string[],
): { rows: DayRow[]; quality: Map<string, Quality> } {
	const pointPlaceholders = pointIds.map(() => '?').join(', ');
	const dayFilter = days ? `AND day IN (${days.map(() => '?').join(', ')})` : '';
	const pointDays = getCountersDb()
		.prepare(
			`SELECT point_id AS pointId, day, total, predicted, hourly FROM car_point_days
			WHERE point_id IN (${pointPlaceholders}) ${dayFilter} ORDER BY day`,
		)
		.all(...pointIds, ...(days ?? [])) as {
		pointId: number;
		day: string;
		total: number;
		predicted: number | null;
		hourly: string | null;
	}[];

	const byDay = new Map<string, typeof pointDays>();
	for (const pointDay of pointDays) {
		byDay.set(pointDay.day, [...(byDay.get(pointDay.day) ?? []), pointDay]);
	}

	const rows: DayRow[] = [];
	const quality = new Map<string, Quality>();
	for (const [day, values] of byDay) {
		if (values.length !== pointIds.length) {
			continue;
		}
		rows.push({
			day,
			total: values.reduce((sum, value) => sum + value.total, 0),
			hourly: combineHourly(
				values.map((value) =>
					value.hourly ? (JSON.parse(value.hourly) as (number | null)[]) : null,
				),
			),
		});
		const known = values.filter((value) => value.predicted !== null);
		quality.set(day, {
			measured: known.reduce((sum, value) => sum + value.total * (1 - value.predicted! / 100), 0),
			all: known.reduce((sum, value) => sum + value.total, 0),
		});
	}
	return { rows, quality };
}

export function getCarCounterStats(
	pointIds: number[],
	options: StatsOptions = {},
): CarCounterStats | null {
	const { rows, quality } = loadDays(pointIds);
	const days = rows.filter((row) => row.total > 0);
	if (days.length === 0) {
		return null;
	}

	const stats = computeStats(days, options);
	let measured = 0;
	let all = 0;
	for (const [day, dayQuality] of quality) {
		if (day >= stats.period.from && day <= stats.period.to) {
			measured += dayQuality.measured;
			all += dayQuality.all;
		}
	}
	const { syncedAt } = getCountersDb()
		.prepare(
			`SELECT MIN(synced_at) AS syncedAt FROM car_points WHERE id IN (${pointIds.map(() => '?').join(', ')})`,
		)
		.get(...pointIds) as { syncedAt: string | null };

	return {
		pointIds,
		syncedAt,
		...stats,
		quality: { measuredShare: all > 0 ? Math.round((measured / all) * 1000) / 1000 : null },
	};
}

// Days after the last synced day, from the snapshot refreshed every 20 minutes
export function getCarLiveDays(pointIds: number[]): LiveDay[] {
	const snapshot = getCarLiveSnapshot();
	if (!snapshot) {
		return [];
	}

	const { lastDay } = getCountersDb()
		.prepare(
			`SELECT MIN(lastDay) AS lastDay FROM (
				SELECT MAX(day) AS lastDay FROM car_point_days
				WHERE point_id IN (${pointIds.map(() => '?').join(', ')}) GROUP BY point_id
			)`,
		)
		.get(...pointIds) as { lastDay: string | null };
	const today = todayInParis();

	return [addDays(today, -1), today]
		.filter((day) => !lastDay || day > lastDay)
		.flatMap((day): LiveDay[] => {
			const combined = combineHourly(pointIds.map((id) => snapshot.get(id)?.get(day)));
			if (!combined) {
				return [];
			}
			const hours = combined.findLastIndex((count) => count !== null) + 1;
			const hourly = combined.slice(0, hours);
			const count = hourly.reduce<number>((sum, value) => sum + (value ?? 0), 0);
			const elapsedHours =
				((Date.parse(today) - Date.parse(day)) / DAY_MS) * 24 + currentHourInParis();
			if (hours === 24 && day !== today) {
				return [{ day, count, hours, hourly, partial: false }];
			}
			if (hours > 0 && elapsedHours - hours <= MAX_LAG_HOURS) {
				return [{ day, count, hours, hourly, partial: true }];
			}
			return [];
		});
}

export function getCarCounterHours(pointIds: number[], days: string[]): DayHours[] {
	const stored = new Map(
		loadDays(pointIds, days)
			.rows.filter((row) => row.hourly)
			.map((row) => [row.day, row.hourly!]),
	);
	const liveDays = days.some((day) => !stored.has(day)) ? getCarLiveDays(pointIds) : [];

	return days.flatMap((day) => {
		const hourly = stored.get(day);
		if (hourly) {
			return [{ day, hourly, partial: false }];
		}
		const live = liveDays.find((liveDay) => liveDay.day === day);
		return live ? [{ day, hourly: live.hourly, partial: live.partial }] : [];
	});
}
