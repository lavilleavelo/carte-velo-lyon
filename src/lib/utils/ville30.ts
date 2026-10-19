import { type } from 'arktype';
import type { useSearchParams } from 'runed/kit';
import { MAP_STYLE_IDS } from '$lib/utils/mapStyleToggle.svelte';
import type { SpeedBucket } from '$lib/utils/speedLimits';

export type Ville30Status = 'full' | 'partial' | 'none';

export interface Ville30CommuneRow {
	insee: string;
	slug: string;
	name: string;
	status: Ville30Status;
	adoptedAt: string | null;
	partialNote: string | null;
	/** Share of streets limited to 30 km/h or less, excluding fast roads (≥ 70) and pedestrian areas (≤ 5). */
	pct: number | null;
	eligibleKm: number;
	eligibleUnder30Km: number;
	kmByBucket: Record<SpeedBucket, number>;
	bbox: [number, number, number, number] | null;
	/** INSEE codes of the boundary features making up this commune (Lyon → its arrondissements). */
	featureInsees: string[];
	/**
	 * `insee1` codes of the street data belonging to this commune. Differs from `featureInsees`
	 * for merged communes whose streets still carry the former code (Pierre-Bénite in Oullins-Pierre-Bénite).
	 */
	streetInsees: string[];
}

export const ville30ParamsSchema = type({
	tab: type.enumerated('explication', 'communes').default(() => 'explication'),
	commune: type('string').default(() => ''),
	q: type('string').default(() => ''),
	filter: type.enumerated('all', 'ville30', 'other').default(() => 'all'),
	sort: type.enumerated('pct', 'name', 'date').default(() => 'pct'),
	mode: type.enumerated('status', 'pct').default(() => 'status'),
	speedLimits: type('string[]').default(() => []),
	allSpeeds: type('boolean').default(() => false),
	fullscreen: type('boolean').default(() => false),
	mapStyle: type.enumerated(...MAP_STYLE_IDS).default(() => MAP_STYLE_IDS[0]),
	zoom: type('number').default(() => 0),
	lat: type('number').default(() => 0),
	lng: type('number').default(() => 0),
});

export type Ville30SearchParams = ReturnType<typeof useSearchParams<typeof ville30ParamsSchema>>;

/** Sequential ramp (light → dark) for the share of streets at 30 km/h, from 0 to 100 %. */
export const PCT_RAMP: [number, string][] = [
	[0, '#f3f0ff'],
	[25, '#d4cafc'],
	[50, '#a693f6'],
	[75, '#785ef0'],
	[100, '#3d2a9e'],
];

export function pctColor(pct: number | null): string {
	if (pct === null) return '#e5e7eb';
	for (let i = 1; i < PCT_RAMP.length; i++) {
		const [stop, color] = PCT_RAMP[i];
		if (pct <= stop) {
			const [prevStop, prevColor] = PCT_RAMP[i - 1];
			return mixHex(prevColor, color, (pct - prevStop) / (stop - prevStop));
		}
	}
	return PCT_RAMP[PCT_RAMP.length - 1][1];
}

function mixHex(a: string, b: string, t: number): string {
	const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
	const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
	return `#${pa
		.map((v, i) =>
			Math.round(v + (pb[i] - v) * t)
				.toString(16)
				.padStart(2, '0'),
		)
		.join('')}`;
}
