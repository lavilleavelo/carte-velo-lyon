export const VELOV_FORECAST_KINDS = ['velos', 'elec', 'meca', 'bornes'] as const;
export type VelovForecastKind = (typeof VELOV_FORECAST_KINDS)[number];

export const VELOV_FORECAST_STEP_COUNT = 96;
export const VELOV_FORECAST_STEP_MINUTES = 15;
export const VELOV_FORECAST_STEP_MS = VELOV_FORECAST_STEP_MINUTES * 60_000;
export const VELOV_FORECAST_CREDIT_URL = 'https://lyon-pocket.netlify.app/';

export type VelovForecastState = { elec: number; meca: number; docks: number; capacity: number };

export type VelovForecastSeries = {
	q10: number[];
	q30: number[];
	q50: number[];
	q70: number[];
	q90: number[];
	p: number[];
};

export type VelovForecast = {
	version: string;
	origin: number;
	state: VelovForecastState;
	coverage: Partial<Record<VelovForecastKind, number>>;
	series: Record<VelovForecastKind, VelovForecastSeries>;
};

export type VelovForecastResponse = { forecast: VelovForecast | null };

export type VelovForecastMap = {
	version: string;
	origin: number;
	ids: number[];
	steps: Record<string, number[]>;
};

export type VelovForecastMapResponse = { forecast: VelovForecastMap | null };

export const VELOV_CHANCE_LEVELS = ['near-certain', 'likely', 'uncertain', 'unlikely'] as const;
export type VelovChanceLevel = (typeof VELOV_CHANCE_LEVELS)[number];
export type VelovChance = { percent: number; level: VelovChanceLevel; label: string };

export const VELOV_CHANCE_LABELS: Record<VelovChanceLevel, string> = {
	'near-certain': 'quasi sûr',
	likely: 'probable',
	uncertain: 'incertain',
	unlikely: 'peu probable',
};

export const VELOV_FORECAST_KIND_INFO: Record<
	VelovForecastKind,
	{ label: string; title: string; any: string }
> = {
	velos: { label: 'Vélos', title: 'Tous les vélos', any: 'de trouver un vélo' },
	elec: { label: 'Électriques', title: 'Vélos électriques', any: 'de trouver un vélo électrique' },
	meca: { label: 'Mécaniques', title: 'Vélos mécaniques', any: 'de trouver un vélo mécanique' },
	bornes: { label: 'Places', title: 'Places libres', any: 'de trouver une place' },
};

const UNITS: Record<VelovForecastKind, string> = {
	velos: 'vélo',
	elec: 'électrique',
	meca: 'mécanique',
	bornes: 'place',
};

const SHORTAGES: Record<VelovForecastKind, string> = {
	velos: 'Souvent vide',
	elec: 'Souvent sans électrique',
	meca: 'Souvent sans mécanique',
	bornes: 'Souvent pleine',
};

const HOUR_MS = 3_600_000;
const ROUNDING_MS = 300_000;
const SPAN_MS = VELOV_FORECAST_STEP_COUNT * VELOV_FORECAST_STEP_MS;
const SOON_STEPS = 8;

const lyonFormat = new Intl.DateTimeFormat('fr-FR', {
	timeZone: 'Europe/Paris',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: 'numeric',
	minute: 'numeric',
	weekday: 'long',
	hourCycle: 'h23',
});

function lyonTime(epochMs: number) {
	const parts: Record<string, string> = {};
	for (const part of lyonFormat.formatToParts(epochMs)) {
		parts[part.type] = part.value;
	}

	return {
		date: `${parts.year}-${parts.month}-${parts.day}`,
		hour: Number(parts.hour),
		minute: Number(parts.minute),
		weekday: parts.weekday,
	};
}

export async function fetchVelovForecast(stationId: number): Promise<VelovForecast | null> {
	const response = await fetch(`/api/velov/forecast/${stationId}`);
	if (!response.ok) {
		throw new Error('Failed to fetch Vélo’v forecast');
	}

	const data: VelovForecastResponse = await response.json();
	return data.forecast;
}

export async function fetchVelovForecastSteps(steps: number[]): Promise<VelovForecastMap | null> {
	const response = await fetch(`/api/velov/forecast?steps=${steps.join(',')}`);
	if (!response.ok) {
		throw new Error('Failed to fetch Vélo’v map forecast');
	}

	const data: VelovForecastMapResponse = await response.json();
	return data.forecast;
}

export function velovMapRange(
	values: number[],
	rank: number,
	kind: VelovForecastKind,
): { low: number; median: number; high: number; chance: VelovChance } {
	const offset = (rank * VELOV_FORECAST_KINDS.length + VELOV_FORECAST_KINDS.indexOf(kind)) * 4;
	return {
		low: values[offset],
		median: values[offset + 1],
		high: values[offset + 2],
		chance: velovChance(values[offset + 3] / 100),
	};
}

export function velovShortRange(low: number, high: number): string {
	return low === high ? `${low}` : `${low}–${high}`;
}

export function velovStateCount(state: VelovForecastState, kind: VelovForecastKind): number {
	if (kind === 'velos') {
		return state.elec + state.meca;
	}

	if (kind === 'bornes') {
		return state.docks;
	}

	return state[kind];
}

export function velovChance(probability: number): VelovChance {
	const percent = Math.min(99, Math.max(1, Math.round(probability * 100)));
	const level: VelovChanceLevel =
		percent >= 90
			? 'near-certain'
			: percent >= 70
				? 'likely'
				: percent >= 40
					? 'uncertain'
					: 'unlikely';

	return { percent, level, label: VELOV_CHANCE_LABELS[level] };
}

export function velovCountText(count: number, kind: VelovForecastKind): string {
	return `${count} ${UNITS[kind]}${count > 1 ? 's' : ''}`;
}

export function velovRangeText(low: number, high: number, kind: VelovForecastKind): string {
	const from = Math.round(low);
	const to = Math.round(high);
	return from === to
		? velovCountText(from, kind)
		: `${from} à ${to} ${UNITS[kind]}${to > 1 ? 's' : ''}`;
}

export function velovReliabilityText(coverage: number | undefined): string | null {
	return coverage === undefined ? null : `${Math.min(9, Math.round(coverage * 10))} fois sur 10`;
}

export function velovSmoothed(values: number[]): number[] {
	const last = values.length - 1;
	return values.map(
		(value, rank) => (values[Math.max(0, rank - 1)] + value + values[Math.min(last, rank + 1)]) / 3,
	);
}

export type VelovTimeline = ReturnType<typeof createVelovTimeline>;

export function createVelovTimeline(originMs: number) {
	const originDate = lyonTime(originMs).date;

	const shown = (step: number) => {
		const exact = originMs + step * VELOV_FORECAST_STEP_MS;
		return lyonTime(Math.floor((exact + ROUNDING_MS / 2) / ROUNDING_MS) * ROUNDING_MS);
	};

	const clock = (step: number) => {
		const time = shown(step);
		return time.minute === 0
			? `${time.hour} h`
			: `${time.hour} h ${String(time.minute).padStart(2, '0')}`;
	};

	const isNextDay = (step: number) => shown(step).date !== originDate;

	const delay = (step: number) => {
		const minutes = step * VELOV_FORECAST_STEP_MINUTES;
		if (minutes < 60) {
			return `${minutes} min`;
		}

		return minutes % 60 === 0
			? `${minutes / 60} h`
			: `${Math.floor(minutes / 60)} h ${minutes % 60}`;
	};

	const wholeHours: { position: number; hour: number; weekday: string }[] = [];
	const first = (Math.floor(originMs / HOUR_MS) + 1) * HOUR_MS;
	for (let at = first; at <= originMs + SPAN_MS; at += HOUR_MS) {
		const time = lyonTime(at);
		wholeHours.push({
			position: (at - originMs) / SPAN_MS,
			hour: time.hour,
			weekday: time.weekday,
		});
	}

	const midnight = wholeHours.find((tick) => tick.hour === 0);

	return {
		clock,
		isNextDay,
		ticks: wholeHours
			.filter((tick) => tick.hour % 6 === 0)
			.map((tick) => ({ position: tick.position, label: `${tick.hour} h` })),
		midnight: midnight ? { position: midnight.position, label: midnight.weekday } : null,
		dayLabel(step: number): string {
			if (step === 0) {
				return 'Maintenant';
			}

			return `${isNextDay(step) ? 'Demain' : 'Aujourd’hui'} à ${clock(step)}`;
		},
		label(step: number): string {
			if (step === 0) {
				return 'Maintenant';
			}

			return isNextDay(step) && step > SOON_STEPS
				? `Demain · ${clock(step)}`
				: `Dans ${delay(step)} · ${clock(step)}`;
		},
		risk(levels: VelovChanceLevel[], kind: VelovForecastKind): string | null {
			const start = levels.indexOf('unlikely');
			if (start < 0) {
				return null;
			}

			let length = 0;
			while (levels[start + length] === 'unlikely') {
				length += 1;
			}

			const firstStep = start + 1;
			const lastStep = start + length;
			const day = isNextDay(firstStep) ? ' demain' : '';
			const hours =
				lastStep === VELOV_FORECAST_STEP_COUNT
					? `à partir de ${clock(firstStep)}`
					: firstStep === lastStep
						? `vers ${clock(firstStep)}`
						: `de ${clock(firstStep)} à ${clock(lastStep)}`;

			return `${SHORTAGES[kind]}${day} ${hours}`;
		},
	};
}
