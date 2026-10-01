import { addDays } from './calendar';
import { getCountersDb } from './db';
import { BIKE_PRACTICE, SCOOTER_PRACTICE } from './ecoCounter';

const PERIOD_DAYS = 365;
const MIN_MONTH_DAYS = 7;
// Days below this share of the median day are considered as outages of the e-scooter flows
const OUTAGE_THRESHOLD = 0.2;

// share: share of the e-scooters in the counts of the counter (bikes and e-scooters)
export type ScooterStats = {
	firstDay: string;
	period: { from: string; to: string };
	share: number | null;
	average: number | null;
	monthly: { month: string; share: number | null }[];
};

export type CounterSensor = {
	idPdc: number;
	name: string;
	coordinates: [number, number] | null;
	firstDay: string | null;
	lastDay: string | null;
	flows: { bikes: number; scooters: number };
	scooters: ScooterStats | null;
};

type ScooterDay = { day: string; total: number; scooters: number };

function ratio(part: number, total: number): number | null {
	return total > 0 ? Math.round((part / total) * 1000) / 1000 : null;
}

function shareOf(days: ScooterDay[]): number | null {
	return ratio(
		days.reduce((sum, day) => sum + day.scooters, 0),
		days.reduce((sum, day) => sum + day.total, 0),
	);
}

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function monthsBetween(firstMonth: string, lastMonth: string): string[] {
	const months: string[] = [];
	for (let month = firstMonth; month <= lastMonth; ) {
		months.push(month);
		const next = new Date(`${month}-01T00:00:00Z`);
		next.setUTCMonth(next.getUTCMonth() + 1);
		month = next.toISOString().slice(0, 7);
	}
	return months;
}

function scooterStats(days: ScooterDay[], lastDay: string): ScooterStats | null {
	const firstDay = days.find((day) => day.scooters > 0)?.day;
	if (!firstDay) {
		return null;
	}

	const since = days.filter((day) => day.day >= firstDay);
	const threshold = OUTAGE_THRESHOLD * median(since.map((day) => day.scooters));
	const counted = since.filter((day) => day.scooters >= threshold);
	const from = addDays(lastDay, -(PERIOD_DAYS - 1));
	const recent = counted.filter((day) => day.day >= from && day.day <= lastDay);
	const months = Map.groupBy(counted, (day) => day.day.slice(0, 7));

	return {
		firstDay,
		period: { from, to: lastDay },
		share: shareOf(recent),
		average:
			recent.length > 0
				? Math.round(recent.reduce((sum, day) => sum + day.scooters, 0) / recent.length)
				: null,
		monthly: monthsBetween(firstDay.slice(0, 7), lastDay.slice(0, 7)).map((month) => {
			const monthDays = months.get(month) ?? [];
			return { month, share: monthDays.length >= MIN_MONTH_DAYS ? shareOf(monthDays) : null };
		}),
	};
}

export function getCounterSensor(idPdc: number): CounterSensor | null {
	const db = getCountersDb();
	const counter = db.prepare('SELECT name, lat, lon FROM counters WHERE id_pdc = ?').get(idPdc) as
		| { name: string; lat: number | null; lon: number | null }
		| undefined;
	if (!counter) {
		return null;
	}

	const flows = new Map(
		(
			db
				.prepare(
					'SELECT practice, COUNT(*) AS count FROM counter_flows WHERE id_pdc = ? GROUP BY practice',
				)
				.all(idPdc) as { practice: number; count: number }[]
		).map((row) => [row.practice, row.count]),
	);
	const { firstDay, lastDay } = db
		.prepare(
			`SELECT MIN(CASE WHEN total > 0 THEN day END) AS firstDay, MAX(day) AS lastDay
			FROM counter_days WHERE id_pdc = ?`,
		)
		.get(idPdc) as { firstDay: string | null; lastDay: string | null };
	const scooterDays = db
		.prepare(
			`SELECT d.day, d.total, s.total AS scooters
			FROM counter_scooter_days s JOIN counter_days d ON d.id_pdc = s.id_pdc AND d.day = s.day
			WHERE s.id_pdc = ? AND d.total > 0 ORDER BY d.day`,
		)
		.all(idPdc) as ScooterDay[];

	return {
		idPdc,
		name: counter.name,
		coordinates: counter.lat !== null && counter.lon !== null ? [counter.lon, counter.lat] : null,
		firstDay,
		lastDay,
		flows: { bikes: flows.get(BIKE_PRACTICE) ?? 0, scooters: flows.get(SCOOTER_PRACTICE) ?? 0 },
		scooters: lastDay ? scooterStats(scooterDays, lastDay) : null,
	};
}
