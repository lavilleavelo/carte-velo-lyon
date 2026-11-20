import { addDays, currentHourInParis, isSpringDstDay, todayInParis } from './calendar';
import { getCountersDb } from './db';
import { fetchEcoCounts } from './ecoCounter';
import { fetchGrandLyonMeasures, groupHours } from './grandLyon';

const CACHE_TTL_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS = 3;
// Most counters publish with a 1 hour lag, others only once a day: partial days that are
// hours behind are not shown
const MAX_LAG_HOURS = 3;
const FETCH_OPTIONS = { timeoutMs: 10_000, attempts: 1 };

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

// Rows carry no hour: on the spring DST day, 2am is missing
async function fetchEcoHours(
	idPdc: number,
	flowIds: string,
	from: string,
	to: string,
): Promise<Map<string, (number | null)[]>> {
	const rows = await fetchEcoCounts({ idPdc, flowIds }, 'hour', from, to, FETCH_OPTIONS);
	const countsByDay = new Map<string, number[]>();
	for (const [day, count] of rows) {
		countsByDay.set(day, [...(countsByDay.get(day) ?? []), count]);
	}
	return new Map(
		[...countsByDay].map(([day, counts]) => [
			day,
			isSpringDstDay(day) && counts.length > 2
				? [...counts.slice(0, 2), null, ...counts.slice(2)]
				: counts,
		]),
	);
}

async function fetchGrandLyonHours(
	flowIds: string,
	from: string,
	to: string,
): Promise<Map<string, (number | null)[]>> {
	const measures = await fetchGrandLyonMeasures(
		flowIds.split(';').map(Number),
		from,
		to,
		FETCH_OPTIONS,
	);
	return new Map(
		[...groupHours(measures)].map(([day, hours]) => [
			day,
			hours.slice(0, hours.findLastIndex((count) => count !== null) + 1),
		]),
	);
}

async function fetchLiveDays(idPdc: number): Promise<LiveDay[] | null> {
	const { flowIds, source, lastDay } = getCountersDb()
		.prepare(
			`SELECT c.flow_ids AS flowIds, c.source, MAX(d.day) AS lastDay
			FROM counters c LEFT JOIN counter_days d USING (id_pdc)
			WHERE c.id_pdc = ?`,
		)
		.get(idPdc) as { flowIds: string | null; source: string | null; lastDay: string | null };
	if (!flowIds) {
		return null;
	}

	const today = todayInParis();
	const earliest = addDays(today, -(MAX_DAYS - 1));
	const from = lastDay && addDays(lastDay, 1) > earliest ? addDays(lastDay, 1) : earliest;
	const to = addDays(today, 1);
	const hoursByDay =
		source === 'grand-lyon'
			? await fetchGrandLyonHours(flowIds, from, to)
			: await fetchEcoHours(idPdc, flowIds, from, to);

	const liveDays: LiveDay[] = [];
	for (const [day, hourly] of hoursByDay) {
		const count = hourly.reduce<number>((sum, value) => sum + (value ?? 0), 0);
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
