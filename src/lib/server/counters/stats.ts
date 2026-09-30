import { addDays, dayOfWeek, isFrenchHoliday, isWorkingDay, todayInParis } from './calendar';
import { getCountersDb } from './db';
import type { SchoolHoliday } from './schoolHolidays';

const PROFILE_DAYS = 365;
const TOP_DAYS = 10;
// Days below this share of the median day are considered as counter outages
const OUTAGE_THRESHOLD = 0.2;
const MORNING_HOURS = [5, 12];
const EVENING_HOURS = [12, 22];

export type DayRow = { day: string; total: number; hourly: (number | null)[] | null };

// weekday: working day during school periods, schoolHoliday: working day during school
// holidays, weekend: weekends and public holidays
type DayType = 'weekday' | 'schoolHoliday' | 'weekend';
const DAY_TYPES: DayType[] = ['weekday', 'schoolHoliday', 'weekend'];

export type DayCount = { day: string; count: number };
export type HourPeak = { hour: number; count: number };

export type DetailedStats = {
	firstDay: string;
	lastDay: string;
	daily: {
		start: string;
		values: (number | null)[];
		holidays: string[];
		schoolHolidays: SchoolHoliday[];
	};
	period: { from: string; to: string };
	averages: Record<DayType, number | null>;
	hourlyProfile: Record<DayType, (number | null)[]>;
	// lundi … dimanche, en période scolaire, hors jours fériés
	weekdayProfile: (number | null)[];
	peakHours: { morning: HourPeak | null; evening: HourPeak | null; weekend: HourPeak | null };
	records: {
		allTime: DayCount | null;
		byYear: (DayCount & { year: number })[];
		top: DayCount[];
		hour: (DayCount & { hour: number }) | null;
	};
};

export type CounterStats = DetailedStats & { idPdc: number; name: string; syncedAt: string | null };

type Profile = Pick<DetailedStats, 'averages' | 'hourlyProfile' | 'weekdayProfile' | 'peakHours'>;

export type YearlyStats = Profile & { year: number; days: number };

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function average(values: number[], digits = 0): number | null {
	if (values.length === 0) {
		return null;
	}
	const factor = 10 ** digits;
	return (
		Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * factor) / factor
	);
}

function withoutOutages(rows: DayRow[]): DayRow[] {
	if (rows.length === 0) {
		return rows;
	}
	const threshold = median(rows.map((row) => row.total)) * OUTAGE_THRESHOLD;
	return rows.filter((row) => row.total >= threshold);
}

function hourlyAverages(rows: DayRow[]): (number | null)[] {
	const valuesByHour: number[][] = Array.from({ length: 24 }, () => []);
	for (const row of rows) {
		row.hourly?.forEach((count, hour) => {
			if (count !== null) {
				valuesByHour[hour].push(count);
			}
		});
	}
	return valuesByHour.map((values) => average(values, 1));
}

function peakHour(profile: (number | null)[], [start, end]: number[]): HourPeak | null {
	let peak: HourPeak | null = null;
	for (let hour = start; hour < end; hour++) {
		const count = profile[hour];
		if (count !== null && (!peak || count > peak.count)) {
			peak = { hour, count };
		}
	}
	return peak;
}

function expandSchoolHolidays(holidays: SchoolHoliday[]): Set<string> {
	const days = new Set<string>();
	for (const holiday of holidays) {
		for (let day = holiday.start; day < holiday.end; day = addDays(day, 1)) {
			days.add(day);
		}
	}
	return days;
}

function dayType(day: string, schoolHolidayDays: Set<string>): DayType {
	if (!isWorkingDay(day)) {
		return 'weekend';
	}
	return schoolHolidayDays.has(day) ? 'schoolHoliday' : 'weekday';
}

// Holidays go up to today, to classify the days not synced yet (see live.ts)
function buildDailySeries(rows: DayRow[], schoolHolidays: SchoolHoliday[]): DetailedStats['daily'] {
	const firstDay = rows[0].day;
	const lastDay = rows[rows.length - 1].day;
	const today = todayInParis();
	const values: (number | null)[] = [];
	const holidays: string[] = [];
	let index = 0;
	for (let day = firstDay; day <= lastDay || day <= today; day = addDays(day, 1)) {
		if (day <= lastDay) {
			if (rows[index]?.day === day) {
				values.push(rows[index].total);
				index++;
			} else {
				values.push(null);
			}
		}
		if (isFrenchHoliday(day)) {
			holidays.push(day);
		}
	}
	return {
		start: firstDay,
		values,
		holidays,
		schoolHolidays: schoolHolidays.filter(
			(holiday) => holiday.end > firstDay && holiday.start <= today,
		),
	};
}

function buildRecords(rows: DayRow[]): DetailedStats['records'] {
	const sorted = [...rows].sort((a, b) => b.total - a.total);
	const toDayCount = (row: DayRow): DayCount => ({ day: row.day, count: row.total });

	const bestByYear = new Map<number, DayRow>();
	for (const row of rows) {
		const year = Number(row.day.slice(0, 4));
		const best = bestByYear.get(year);
		if (!best || row.total > best.total) {
			bestByYear.set(year, row);
		}
	}

	let hour: DetailedStats['records']['hour'] = null;
	for (const row of rows) {
		row.hourly?.forEach((count, index) => {
			if (count !== null && (!hour || count > hour.count)) {
				hour = { day: row.day, hour: index, count };
			}
		});
	}

	return {
		allTime: sorted.length > 0 ? toDayCount(sorted[0]) : null,
		byYear: [...bestByYear.entries()].map(([year, row]) => ({ year, ...toDayCount(row) })),
		top: sorted.slice(0, TOP_DAYS).map(toDayCount),
		hour,
	};
}

export type StatsOptions = { from?: string; to?: string };

function loadSchoolHolidays(): SchoolHoliday[] {
	return getCountersDb()
		.prepare('SELECT start, end, name FROM school_holidays ORDER BY start')
		.all() as SchoolHoliday[];
}

function computeProfile(periodRows: DayRow[], schoolHolidayDays: Set<string>): Profile {
	const rowsByType = Object.fromEntries(
		DAY_TYPES.map((type) => [
			type,
			withoutOutages(periodRows.filter((row) => dayType(row.day, schoolHolidayDays) === type)),
		]),
	) as Record<DayType, DayRow[]>;

	const averages = Object.fromEntries(
		DAY_TYPES.map((type) => [type, average(rowsByType[type].map((row) => row.total))]),
	) as Record<DayType, number | null>;
	const hourlyProfile = Object.fromEntries(
		DAY_TYPES.map((type) => [type, hourlyAverages(rowsByType[type])]),
	) as Record<DayType, (number | null)[]>;

	const totalsByDayOfWeek: number[][] = Array.from({ length: 7 }, () => []);
	for (const row of [...rowsByType.weekday, ...rowsByType.weekend]) {
		if (!isFrenchHoliday(row.day) && !schoolHolidayDays.has(row.day)) {
			totalsByDayOfWeek[dayOfWeek(row.day)].push(row.total);
		}
	}

	return {
		averages,
		hourlyProfile,
		weekdayProfile: totalsByDayOfWeek.map((totals) => average(totals)),
		peakHours: {
			morning: peakHour(hourlyProfile.weekday, MORNING_HOURS),
			evening: peakHour(hourlyProfile.weekday, EVENING_HOURS),
			weekend: peakHour(hourlyProfile.weekend, [0, 24]),
		},
	};
}

// rows: days with data, sorted by day
export function computeStats(rows: DayRow[], options: StatsOptions = {}): DetailedStats {
	const schoolHolidays = loadSchoolHolidays();
	const lastDay = rows[rows.length - 1].day;
	const to = options.to ?? lastDay;
	const from = options.from ?? addDays(to, -(PROFILE_DAYS - 1));

	return {
		firstDay: rows[0].day,
		lastDay,
		daily: buildDailySeries(rows, schoolHolidays),
		period: { from, to },
		...computeProfile(
			rows.filter((row) => row.day >= from && row.day <= to),
			expandSchoolHolidays(schoolHolidays),
		),
		records: buildRecords(rows),
	};
}

export function computeYearlyStats(rows: DayRow[]): YearlyStats[] {
	const schoolHolidayDays = expandSchoolHolidays(loadSchoolHolidays());
	return [...Map.groupBy(rows, (row) => Number(row.day.slice(0, 4)))].map(([year, yearRows]) => ({
		year,
		days: yearRows.length,
		...computeProfile(yearRows, schoolHolidayDays),
	}));
}

function loadCounterRows(idPdc: number): DayRow[] {
	// Days at 0 are counter outages, not days without any bike
	return (
		getCountersDb()
			.prepare(
				'SELECT day, total, hourly FROM counter_days WHERE id_pdc = ? AND total > 0 ORDER BY day',
			)
			.all(idPdc) as { day: string; total: number; hourly: string | null }[]
	).map((row) => ({
		...row,
		hourly: row.hourly ? (JSON.parse(row.hourly) as (number | null)[]) : null,
	}));
}

export function getCounterStats(idPdc: number, options: StatsOptions = {}): CounterStats | null {
	const db = getCountersDb();
	const counter = db.prepare('SELECT name, synced_at FROM counters WHERE id_pdc = ?').get(idPdc) as
		| { name: string; synced_at: string | null }
		| undefined;
	if (!counter) {
		return null;
	}

	const rows = loadCounterRows(idPdc);
	if (rows.length === 0) {
		return null;
	}

	return { idPdc, name: counter.name, syncedAt: counter.synced_at, ...computeStats(rows, options) };
}

export function getCounterYearlyStats(idPdc: number): YearlyStats[] | null {
	const rows = loadCounterRows(idPdc);
	return rows.length > 0 ? computeYearlyStats(rows) : null;
}
