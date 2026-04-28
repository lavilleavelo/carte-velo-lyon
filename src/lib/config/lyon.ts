/**
 * Single source of truth for Lyon-related identifiers.
 *
 * Lyon (the city) has INSEE 69123 but is split into 9 arrondissement INSEE codes
 * (69381-69389) in the GeoJSON commune boundaries. Server-side aggregations use
 * the arrondissement list to build the city-level boundary; the slug "lyon" is
 * the canonical URL for the aggregated view.
 */

export const LYON_INSEE = '69123';

export const LYON_SLUG = 'lyon';

export const LYON_ARRONDISSEMENT_INSEE = [
	'69381',
	'69382',
	'69383',
	'69384',
	'69385',
	'69386',
	'69387',
	'69388',
	'69389',
] as const;

export const LYON_ARRONDISSEMENT_INSEE_SET: ReadonlySet<string> = new Set(
	LYON_ARRONDISSEMENT_INSEE,
);

export function isLyonArrondissementInsee(insee: string): boolean {
	return LYON_ARRONDISSEMENT_INSEE_SET.has(insee);
}

export function isLyonAggregateInsee(insee: string): boolean {
	return insee === LYON_INSEE;
}
