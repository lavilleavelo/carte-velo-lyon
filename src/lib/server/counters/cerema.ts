import { addDays } from './calendar';

// Cerema Avatar API (car counters): https://avatar.cerema.fr/api/doc. The CSV download returns up
// to 1 million rows per request, the JSON version only 10 000
const BASE_URL = 'https://avatar.cerema.fr/api/aggregated_measures/download';
const MAX_ROWS = 1_000_000;
// Unauthenticated requests are limited to 5 per minute
const MIN_REQUEST_INTERVAL_MS = 15_000;
const RATE_LIMIT_DELAY_MS = 90_000;
const MAX_ATTEMPTS = 4;
const FETCH_TIMEOUT_MS = 5 * 60 * 1000;

// predicted: share of the values reconstructed by the Cerema model because the sensor data was
// missing or filtered (%) - https://avatar.cerema.fr/documentation/module-ia#qualite
export type CeremaMeasure = {
	pointId: number;
	day: string;
	hour: number;
	count: number | null;
	predicted: number | null;
};

let nextSlotAt = 0;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// Requests from the sync and the live refresh share the same pace
async function waitForSlot(): Promise<void> {
	const now = Date.now();
	const slot = Math.max(now, nextSlotAt);
	nextSlotAt = slot + MIN_REQUEST_INTERVAL_MS;
	if (slot > now) {
		await sleep(slot - now);
	}
}

function parseNumber(value: string | undefined): number | null {
	return value === undefined || value === '' ? null : Number(value);
}

// Header: count_point_id;measure_datetime;flow[veh/h];…;perc_flow_predicted;…, with the datetime
// in local time, e.g. 2026-09-28T08:00:00+02:00
function parseCsv(csv: string): CeremaMeasure[] {
	const [header, ...lines] = csv.trim().split('\n');
	const columns = header.split(';');
	const countColumn = columns.findIndex((column) => column.startsWith('flow['));
	const predictedColumn = columns.indexOf('perc_flow_predicted');
	return lines.map((line) => {
		const values = line.split(';');
		return {
			pointId: Number(values[0]),
			day: values[1].slice(0, 10),
			hour: Number(values[1].slice(11, 13)),
			count: parseNumber(values[countColumn]),
			predicted: parseNumber(values[predictedColumn]),
		};
	});
}

// `to` is exclusive. Hourly measures are limited to one year per request
export async function fetchCeremaMeasures(
	pointIds: number[],
	period: 'hour' | 'day',
	from: string,
	to: string,
): Promise<CeremaMeasure[]> {
	const params = new URLSearchParams({
		count_point_ids: pointIds.join(','),
		start_time: `${from}T00:00:00`,
		end_time: `${addDays(to, -1)}T23:59:59`,
		time_zone: 'Europe/Paris',
		aggregation_period: period,
		limit: String(MAX_ROWS),
	});
	const url = `${BASE_URL}?${params}`;

	let lastError: unknown;
	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		await waitForSlot();
		try {
			const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
			if (response.status === 429) {
				nextSlotAt = Date.now() + RATE_LIMIT_DELAY_MS;
				throw new Error('HTTP 429 Too Many Requests');
			}
			if (!response.ok) {
				throw new Error(`HTTP ${response.status} ${response.statusText}`);
			}

			const measures = parseCsv(await response.text());
			if (measures.length >= MAX_ROWS) {
				throw new Error(`${measures.length} rows: the request window is too large`);
			}
			return measures;
		} catch (error) {
			lastError = error;
			console.warn(`[cerema] attempt ${attempt}/${MAX_ATTEMPTS} failed: ${error}`);
		}
	}
	throw new Error(`[cerema] ${url} failed after ${MAX_ATTEMPTS} attempts`, { cause: lastError });
}
