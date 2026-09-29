import { getCountersDb } from './db';
import { getLiveDays } from './live';

export type DayHours = { day: string; hourly: (number | null)[]; partial: boolean };

// Recent days come from Eco-Counter until the next sync stores them
export async function getCounterHours(idPdc: number, days: string[]): Promise<DayHours[] | null> {
	const db = getCountersDb();
	if (!db.prepare('SELECT 1 FROM counters WHERE id_pdc = ?').get(idPdc)) {
		return null;
	}

	const rows = db
		.prepare(
			`SELECT day, hourly FROM counter_days
			WHERE id_pdc = ? AND hourly IS NOT NULL AND day IN (${days.map(() => '?').join(', ')})`,
		)
		.all(idPdc, ...days) as { day: string; hourly: string }[];
	const stored = new Map(rows.map((row) => [row.day, JSON.parse(row.hourly) as (number | null)[]]));

	const liveDays = days.some((day) => !stored.has(day))
		? await getLiveDays(idPdc).catch(() => null)
		: null;

	return days.flatMap((day) => {
		const hourly = stored.get(day);
		if (hourly) {
			return [{ day, hourly, partial: false }];
		}
		const live = liveDays?.find((liveDay) => liveDay.day === day);
		return live ? [{ day, hourly: live.hourly, partial: live.partial }] : [];
	});
}
