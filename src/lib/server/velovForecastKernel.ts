import { parentPort, workerData } from 'node:worker_threads';
import type {
	VelovForecastKind,
	VelovForecastSeries,
	VelovForecastState,
} from '$lib/utils/velovForecast';

export type VelovForecastForest = {
	binary: boolean;
	roots: Int32Array;
	column: Int32Array;
	missingLeft: Uint8Array;
	left: Int32Array;
	right: Int32Array;
	threshold: Float64Array;
	leaf: Float64Array;
};

export type VelovForecastCountKind = Exclude<VelovForecastKind, 'bornes'>;

export type VelovForecastPlan = {
	kinds: readonly VelovForecastKind[];
	stepMs: number;
	slots: number[];
	blanked: boolean;
	shownRanks: number[];
	decileForests: Record<VelovForecastCountKind, VelovForecastForest[]>;
	anyForests: Record<VelovForecastKind, VelovForecastForest>;
	sites: Map<number, Float64Array>;
	habits: Map<number, Float64Array>;
	holidays: Set<string>;
	schoolHolidays: number[][];
};

export type VelovForecastStation = { id: number; state: VelovForecastState };

export type VelovForecastThreadRequest =
	| { plan: VelovForecastPlan }
	| { id: number; stations: VelovForecastStation[]; originMs: number; steps: number[] };

export type VelovForecastThreadReply = { id: number; ranges?: number[][]; error?: string };

type Moment = {
	hour: number;
	decimalHour: number;
	weekday: number;
	month: number;
	holiday: boolean;
	schoolHoliday: boolean;
	dayType: number;
};

type Outlook = Record<VelovForecastKind, { deciles: number[]; probability: number }>;

export const VELOV_FORECAST_THREAD = 'velov-forecast';
export const VELOV_FORECAST_HABIT_KEYS = [
	'hab_velos',
	'hab1_velos',
	'hab1_bornes',
	'hab_part_elec',
] as const;
export const VELOV_FORECAST_SITE_KEYS = [
	'altitude',
	'dist_metro_km',
	'dist_tram_km',
	'dist_gare_km',
	'lat',
	'lon',
] as const;
export const VELOV_FORECAST_INPUTS = [
	'velos0',
	'elec0',
	'meca0',
	'bornes0',
	'capacite',
	'part_elec0',
	'horizon_h',
	'heure_origine',
	'heure_cible',
	'jour_sem',
	'mois',
	'ferie',
	'vacances',
	'type_jour',
	...VELOV_FORECAST_HABIT_KEYS,
	...VELOV_FORECAST_SITE_KEYS,
] as const;
export const VELOV_FORECAST_DAY_TYPES = 3;
export const VELOV_FORECAST_HOURS_PER_DAY = 24;

const ZERO_THRESHOLD = 1e-35;
const AT = Object.fromEntries(VELOV_FORECAST_INPUTS.map((name, rank) => [name, rank])) as Record<
	(typeof VELOV_FORECAST_INPUTS)[number],
	number
>;
const WEEKDAYS: Record<string, number> = {
	Mon: 1,
	Tue: 2,
	Wed: 3,
	Thu: 4,
	Fri: 5,
	Sat: 6,
	Sun: 7,
};

const lyonFormat = new Intl.DateTimeFormat('en-US', {
	timeZone: 'Europe/Paris',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	weekday: 'short',
	hourCycle: 'h23',
});

function momentOf(plan: VelovForecastPlan, epochMs: number): Moment {
	const parts: Record<string, string> = {};
	for (const part of lyonFormat.formatToParts(epochMs)) {
		parts[part.type] = part.value;
	}

	const hour = Number(parts.hour);
	const weekday = WEEKDAYS[parts.weekday];
	const holiday = plan.holidays.has(`${parts.year}-${parts.month}-${parts.day}`);

	return {
		hour,
		decimalHour: hour + Number(parts.minute) / 60,
		weekday,
		month: Number(parts.month),
		holiday,
		schoolHoliday: plan.schoolHolidays.some((span) => epochMs >= span[0] && epochMs < span[1]),
		dayType: holiday || weekday === 7 ? 2 : weekday === 6 ? 1 : 0,
	};
}

function inputRows(
	plan: VelovForecastPlan,
	stations: VelovForecastStation[],
	originMs: number,
	steps: number[],
): Float64Array {
	const { slots } = plan;
	const width = slots.length;
	const stride = plan.blanked ? width * 2 : width;
	const origin = momentOf(plan, originMs);
	const targets = steps.map((step) => momentOf(plan, originMs + step * plan.stepMs));
	const values = new Float64Array(VELOV_FORECAST_INPUTS.length + 1);
	const rows = new Float64Array(stations.length * steps.length * stride);
	let base = 0;

	for (const { id, state } of stations) {
		const bikes = state.elec + state.meca;
		const habit = plan.habits.get(id);
		const site = plan.sites.get(id);

		values.fill(NaN);
		values[AT.velos0] = bikes;
		values[AT.elec0] = state.elec;
		values[AT.meca0] = state.meca;
		values[AT.bornes0] = state.docks;
		values[AT.capacite] = state.capacity;
		if (bikes !== 0) {
			values[AT.part_elec0] = state.elec / bikes;
		}
		values[AT.heure_origine] = origin.decimalHour;
		if (site) {
			VELOV_FORECAST_SITE_KEYS.forEach((key, nth) => {
				values[AT[key]] = site[nth];
			});
		}

		for (let rank = 0; rank < steps.length; rank += 1) {
			const target = targets[rank];
			values[AT.horizon_h] = steps[rank] * 0.25;
			values[AT.heure_cible] = target.decimalHour;
			values[AT.jour_sem] = target.weekday;
			values[AT.mois] = target.month;
			values[AT.ferie] = target.holiday ? 1 : 0;
			values[AT.vacances] = target.schoolHoliday ? 1 : 0;
			values[AT.type_jour] = target.dayType;
			if (habit) {
				const offset =
					(target.dayType * VELOV_FORECAST_HOURS_PER_DAY + target.hour) *
					VELOV_FORECAST_HABIT_KEYS.length;
				VELOV_FORECAST_HABIT_KEYS.forEach((key, nth) => {
					values[AT[key]] = habit[offset + nth];
				});
			}
			for (let column = 0; column < width; column += 1) {
				const value = values[slots[column]];
				rows[base + column] = value;
				if (plan.blanked) {
					rows[base + width + column] = Math.abs(value) <= ZERO_THRESHOLD ? NaN : value;
				}
			}
			base += stride;
		}
	}

	return rows;
}

function scores(
	forest: VelovForecastForest,
	rows: Float64Array,
	stride: number,
	count: number,
): Float64Array {
	const { roots, column, missingLeft, left, right, threshold, leaf } = forest;
	const out = new Float64Array(count);

	for (let rank = 0; rank < roots.length; rank += 1) {
		const root = roots[rank];
		for (let row = 0, base = 0; row < count; row += 1, base += stride) {
			let node = root;
			while (node >= 0) {
				const value = rows[base + column[node]];
				node = (value !== value ? missingLeft[node] === 1 : value <= threshold[node])
					? left[node]
					: right[node];
			}
			out[row] += leaf[~node];
		}
	}

	if (forest.binary) {
		for (let row = 0; row < count; row += 1) {
			out[row] = 1 / (1 + Math.exp(-out[row]));
		}
	}

	return out;
}

function outlooks(
	plan: VelovForecastPlan,
	stations: VelovForecastStation[],
	originMs: number,
	steps: number[],
): (station: number, step: number) => Outlook {
	const count = stations.length * steps.length;
	const stride = plan.blanked ? plan.slots.length * 2 : plan.slots.length;
	const rows = inputRows(plan, stations, originMs, steps);
	const score = (forest: VelovForecastForest) => scores(forest, rows, stride, count);
	const deciles = {
		velos: plan.decileForests.velos.map(score),
		elec: plan.decileForests.elec.map(score),
		meca: plan.decileForests.meca.map(score),
	};
	const any = {
		velos: score(plan.anyForests.velos),
		elec: score(plan.anyForests.elec),
		meca: score(plan.anyForests.meca),
		bornes: score(plan.anyForests.bornes),
	};

	return (station, step) => {
		const row = station * steps.length + step;
		const { state } = stations[station];
		const ceiling = Math.max(1, state.capacity);
		const total = state.docks + state.elec + state.meca;
		const counted = (kind: VelovForecastCountKind) => {
			const present = kind === 'velos' ? state.elec + state.meca : state[kind];
			return deciles[kind]
				.map((changes) => changes[row] + present)
				.sort((a, b) => a - b)
				.map((value) => Math.min(ceiling, Math.max(0, value)));
		};
		const velos = counted('velos');
		const bornes = velos
			.slice()
			.reverse()
			.map((value) => Math.min(ceiling, Math.max(0, total - value)));

		return {
			velos: { deciles: velos, probability: any.velos[row] },
			elec: { deciles: counted('elec'), probability: any.elec[row] },
			meca: { deciles: counted('meca'), probability: any.meca[row] },
			bornes: { deciles: bornes, probability: any.bornes[row] },
		};
	};
}

export function velovForecastSeries(
	plan: VelovForecastPlan,
	station: VelovForecastStation,
	originMs: number,
	stepCount: number,
): Record<VelovForecastKind, VelovForecastSeries> {
	const steps = Array.from({ length: stepCount }, (_, rank) => rank + 1);
	const outlookAt = outlooks(plan, [station], originMs, steps);
	const empty = (): VelovForecastSeries => ({ q10: [], q30: [], q50: [], q70: [], q90: [], p: [] });
	const out = { velos: empty(), elec: empty(), meca: empty(), bornes: empty() };

	for (let step = 0; step < stepCount; step += 1) {
		const outlook = outlookAt(0, step);
		for (const kind of plan.kinds) {
			const series = out[kind];
			const { deciles } = outlook[kind];
			series.q10.push(deciles[plan.shownRanks[0]]);
			series.q30.push(deciles[plan.shownRanks[1]]);
			series.q50.push(deciles[plan.shownRanks[2]]);
			series.q70.push(deciles[plan.shownRanks[3]]);
			series.q90.push(deciles[plan.shownRanks[4]]);
			series.p.push(outlook[kind].probability);
		}
	}

	return out;
}

export function velovForecastRanges(
	plan: VelovForecastPlan,
	stations: VelovForecastStation[],
	originMs: number,
	steps: number[],
): number[][] {
	const outlookAt = outlooks(plan, stations, originMs, steps);
	const ranks = [plan.shownRanks[0], plan.shownRanks[2], plan.shownRanks[4]];

	return steps.map((_, step) => {
		const out: number[] = [];
		for (let station = 0; station < stations.length; station += 1) {
			const outlook = outlookAt(station, step);
			for (const kind of plan.kinds) {
				for (const rank of ranks) {
					out.push(Math.round(outlook[kind].deciles[rank]));
				}
				out.push(Math.round(outlook[kind].probability * 100));
			}
		}

		return out;
	});
}

if (parentPort && workerData === VELOV_FORECAST_THREAD) {
	const port = parentPort;
	let plan: VelovForecastPlan | null = null;

	port.on('message', (request: VelovForecastThreadRequest) => {
		if ('plan' in request) {
			plan = request.plan;
			return;
		}

		const reply: VelovForecastThreadReply = { id: request.id };
		try {
			if (!plan) {
				throw new Error('No forecast plan');
			}

			reply.ranges = velovForecastRanges(plan, request.stations, request.originMs, request.steps);
		} catch (error) {
			reply.error = String(error);
		}
		port.postMessage(reply);
	});
}
