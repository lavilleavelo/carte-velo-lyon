// Days are local dates formatted as 'YYYY-MM-DD'.

function toDate(day: string): Date {
	return new Date(`${day}T00:00:00Z`);
}

function formatDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}

export function addDays(day: string, days: number): string {
	const date = toDate(day);
	date.setUTCDate(date.getUTCDate() + days);
	return formatDate(date);
}

export function todayInParis(): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
}

export function currentHourInParis(): number {
	return Number(
		new Intl.DateTimeFormat('en-GB', {
			timeZone: 'Europe/Paris',
			hour: '2-digit',
			hourCycle: 'h23',
		}).format(new Date()),
	);
}

// 0 = lundi … 6 = dimanche
export function dayOfWeek(day: string): number {
	return (toDate(day).getUTCDay() + 6) % 7;
}

// Last Sunday of March: 2am does not exist, the API returns 23 hourly rows
export function isSpringDstDay(day: string): boolean {
	return day.slice(5, 7) === '03' && Number(day.slice(8, 10)) >= 25 && dayOfWeek(day) === 6;
}

// Anonymous Gregorian algorithm
function easterSunday(year: number): Date {
	const a = year % 19;
	const b = Math.floor(year / 100);
	const c = year % 100;
	const d = Math.floor(b / 4);
	const e = b % 4;
	const f = Math.floor((b + 8) / 25);
	const g = Math.floor((b - f + 1) / 3);
	const h = (19 * a + b - d - g + 15) % 30;
	const i = Math.floor(c / 4);
	const k = c % 4;
	const l = (32 + 2 * e + 2 * i - h - k) % 7;
	const m = Math.floor((a + 11 * h + 22 * l) / 451);
	const month = Math.floor((h + l - 7 * m + 114) / 31);
	const date = ((h + l - 7 * m + 114) % 31) + 1;
	return new Date(Date.UTC(year, month - 1, date));
}

const holidaysByYear = new Map<number, Set<string>>();

function frenchHolidays(year: number): Set<string> {
	let holidays = holidaysByYear.get(year);
	if (!holidays) {
		const easter = formatDate(easterSunday(year));
		holidays = new Set([
			...['01-01', '05-01', '05-08', '07-14', '08-15', '11-01', '11-11', '12-25'].map(
				(monthDay) => `${year}-${monthDay}`,
			),
			addDays(easter, 1), // lundi de Pâques
			addDays(easter, 39), // Ascension
			addDays(easter, 50), // lundi de Pentecôte
		]);
		holidaysByYear.set(year, holidays);
	}
	return holidays;
}

export function isFrenchHoliday(day: string): boolean {
	return frenchHolidays(Number(day.slice(0, 4))).has(day);
}

export function isWorkingDay(day: string): boolean {
	return dayOfWeek(day) < 5 && !isFrenchHoliday(day);
}
