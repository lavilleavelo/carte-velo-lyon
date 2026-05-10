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

export function itinerairesOffsetMatch(itineraires: readonly ItineraireFiche[]) {
	const n = itineraires.length;
	const tFor = (idx: number) => (n > 1 ? idx / (n - 1) - 0.5 : 0);

	const matchAtScale = (scale: number) => {
		const expr: any[] = ['match', ['get', 'slug']];
		itineraires.forEach((i, idx) => {
			expr.push(i.slug, tFor(idx) * scale);
		});
		expr.push(0);
		return expr;
	};

	return [
		'interpolate',
		['linear'],
		['zoom'],
		8,
		matchAtScale(3),
		12,
		matchAtScale(7),
		15,
		matchAtScale(12),
	];
}
