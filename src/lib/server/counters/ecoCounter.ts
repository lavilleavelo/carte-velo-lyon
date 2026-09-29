import { fetchJson, type FetchOptions } from './http';

// Public Eco-Counter API used by https://data.eco-counter.com/ParcPublic/?id=3902
const BASE_URL = 'https://www.eco-visio.net/api/aladdin/1.0.0/pbl/publicwebpageplus';
const ORGANISME_ID = '3902';

const INTERVALS = {
	hour: '3',
	day: '4',
} as const;

export type EcoCounter = {
	idPdc: number;
	name: string;
	flowIds: string;
	lat: number | null;
	lon: number | null;
};

type EcoCounterListItem = {
	idPdc: number;
	nom: string;
	lat: number | null;
	lon: number | null;
	pratique: { pratique: number; id: number }[];
};

// '2026-09-29' -> '29/09/2026'
function toApiDate(day: string): string {
	const [year, month, date] = day.split('-');
	return `${date}/${month}/${year}`;
}

// '09/29/2026' -> '2026-09-29'
function fromApiDate(value: string): string {
	const [month, date, year] = value.split('/');
	return `${year}-${month}-${date}`;
}

export async function fetchEcoCounters(): Promise<EcoCounter[]> {
	const list = await fetchJson<EcoCounterListItem[]>(
		`${BASE_URL}/${ORGANISME_ID}?withNull=true&pratiques=2,13`,
	);
	return list.map((item) => ({
		idPdc: item.idPdc,
		name: item.nom,
		flowIds: item.pratique.map((p) => p.id).join(';'),
		lat: item.lat ?? null,
		lon: item.lon ?? null,
	}));
}

// `to` is exclusive. Returns [day, count] rows; hourly rows come as 24 rows per day
// (23 on the spring DST day), in chronological order, without the hour.
export async function fetchEcoCounts(
	counter: Pick<EcoCounter, 'idPdc' | 'flowIds'>,
	interval: keyof typeof INTERVALS,
	from: string,
	to: string,
	options?: FetchOptions,
): Promise<[string, number][]> {
	const params = new URLSearchParams({
		idOrganisme: ORGANISME_ID,
		idPdc: String(counter.idPdc),
		flowIds: counter.flowIds,
		debut: toApiDate(from),
		fin: toApiDate(to),
		interval: INTERVALS[interval],
	});
	const rows = await fetchJson<[string, string][]>(
		`${BASE_URL}/data/${counter.idPdc}?${params}`,
		options,
	);
	return rows.map(([date, count]) => [fromApiDate(date), Number(count)]);
}
