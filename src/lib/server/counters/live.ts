import { addDays, currentHourInParis, isSpringDstDay, todayInParis } from './calendar';
import { getCountersDb } from './db';
import { fetchEcoCounts } from './ecoCounter';

const CACHE_TTL_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS = 3;
// Most counters publish with a 1 hour lag, others only once a day: partial days that are
// hours behind are not shown
const MAX_LAG_HOURS = 3;

// Days not in the database yet: complete days since the last sync, and days being published
// (today, or yesterday just after midnight). hours: data published until `hours`h
export type LiveDay = {
	day: string;
	count: number;
	hours: number;
	hourly: (number | null)[];
	partial: boolean;
};

const cache = new Map<number, { expiresAt: number; promise: Promise<LiveDay[] | null> }>();

async function fetchLiveDays(idPdc: number): Promise<LiveDay[] | null> {
	const { flowIds, lastDay } = getCountersDb()
		.prepare(
			`SELECT c.flow_ids AS flowIds, MAX(d.day) AS lastDay
			FROM counters c LEFT JOIN counter_days d USING (id_pdc)
			WHERE c.id_pdc = ?`,
		)
		.get(idPdc) as { flowIds: string | null; lastDay: string | null };
	if (!flowIds) {
		return null;
	}

	const today = todayInParis();
	const earliest = addDays(today, -(MAX_DAYS - 1));
	const from = lastDay && addDays(lastDay, 1) > earliest ? addDays(lastDay, 1) : earliest;
	const rows = await fetchEcoCounts({ idPdc, flowIds }, 'hour', from, addDays(today, 1), {
		timeoutMs: 10_000,
		attempts: 1,
	});

	const countsByDay = new Map<string, number[]>();
	for (const [day, count] of rows) {
		countsByDay.set(day, [...(countsByDay.get(day) ?? []), count]);
	}

	const liveDays: LiveDay[] = [];
	for (const [day, counts] of countsByDay) {
		const count = counts.reduce((sum, value) => sum + value, 0);
		// Rows carry no hour: on the spring DST day, 2am is missing
		const hourly =
			isSpringDstDay(day) && counts.length > 2
				? [...counts.slice(0, 2), null, ...counts.slice(2)]
				: counts;
		const hours = hourly.length;
		const elapsedHours =
			((Date.parse(today) - Date.parse(day)) / DAY_MS) * 24 + currentHourInParis();
		if (hours === 24 && day !== today) {
			liveDays.push({ day, count, hours, hourly, partial: false });
		} else if (hours > 0 && elapsedHours - hours <= MAX_LAG_HOURS) {
			liveDays.push({ day, count, hours, hourly, partial: true });
		}
	}
	return liveDays;
}

export function getLiveDays(idPdc: number): Promise<LiveDay[] | null> {
	const cached = cache.get(idPdc);
	if (cached && cached.expiresAt > Date.now()) {
		return cached.promise;
	}

	const promise = fetchLiveDays(idPdc);
	cache.set(idPdc, { expiresAt: Date.now() + CACHE_TTL_MS, promise });
	promise.catch(() => {
		cache.delete(idPdc);
	});
	return promise;
}
