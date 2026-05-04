import type { ItineraireFiche } from '$lib/content/fiches';
import { getItineraireColor } from '$lib/config/itineraires';

export function itinerairesColorMatch(itineraires: readonly ItineraireFiche[]) {
	const expr: (string | string[])[] = ['match', ['get', 'slug']];
	for (const i of itineraires) {
		expr.push(i.slug, getItineraireColor(i));
	}
	expr.push('#888');
	return expr;
}

export function itinerairesEnabledFilter(slugs: readonly string[]): unknown {
	return ['in', ['get', 'slug'], ['literal', slugs]];
}
