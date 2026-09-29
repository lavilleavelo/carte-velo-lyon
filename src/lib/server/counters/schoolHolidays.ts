import { fetchJson } from './http';

// Calendrier scolaire de l'Éducation nationale, académie de Lyon (zone A), publié depuis 2017-2018
const URL =
	'https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records';
const PAGE_SIZE = 100;

// start: first day of holidays, end: day classes resume (exclusive)
export type SchoolHoliday = { start: string; end: string; name: string };

type CalendarRecord = {
	description: string;
	population: string;
	start_date: string;
	end_date: string;
};

function toParisDay(isoDate: string): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(isoDate));
}

export async function fetchSchoolHolidays(): Promise<SchoolHoliday[]> {
	const records: CalendarRecord[] = [];
	for (let offset = 0; ; offset += PAGE_SIZE) {
		const params = new URLSearchParams({
			where: 'location="Lyon"',
			limit: String(PAGE_SIZE),
			offset: String(offset),
		});
		const page = await fetchJson<{ total_count: number; results: CalendarRecord[] }>(
			`${URL}?${params}`,
		);
		records.push(...page.results);
		if (page.results.length < PAGE_SIZE || records.length >= page.total_count) {
			break;
		}
	}

	const holidays = new Map<string, SchoolHoliday>();
	for (const record of records) {
		// Teachers' summer holidays end before the pupils' ones
		if (record.population === 'Enseignants') {
			continue;
		}
		const start = toParisDay(record.start_date);
		const end = toParisDay(record.end_date);
		// Future summer holidays are only announced with their first day
		if (start < end) {
			holidays.set(start, { start, end, name: record.description });
		}
	}
	return [...holidays.values()].sort((a, b) => a.start.localeCompare(b.start));
}
