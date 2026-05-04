import {
	getFichesByType,
	type ItineraireFiche,
	type ItineraireFicheMeta,
} from '$lib/content/fiches';

export const ITINERAIRES_CATEGORY = 'Itinéraires';
export const ITINERAIRES_FICHE_TYPE = 'itineraire' as const;

const DEFAULT_COLOR = '#1e3a5f';

export function itineraireLayerId(slug: string): string {
	return `itineraire-${slug}`;
}

export function getItineraires(): ItineraireFiche[] {
	return getFichesByType(ITINERAIRES_FICHE_TYPE).sort((a, b) =>
		a.title.localeCompare(b.title, 'fr'),
	);
}

export function getItineraireColor(fiche: Pick<ItineraireFicheMeta, 'color'>): string {
	return fiche.color ?? DEFAULT_COLOR;
}

export function getItineraireLabel(fiche: Pick<ItineraireFicheMeta, 'title' | 'ref'>): string {
	return fiche.ref ? `${fiche.title} (${fiche.ref})` : fiche.title;
}

export function buildCartesAppUrl(
	fiche: Pick<ItineraireFicheMeta, 'title' | 'geometry'>,
	bbox: [number, number, number, number],
): string | null {
	const osmRel = fiche.geometry?.osmRelation;
	if (!osmRel) {
		return null;
	}

	const lng = (bbox[0] + bbox[2]) / 2;
	const lat = (bbox[1] + bbox[3]) / 2;
	const lngStr = lng.toFixed(5);
	const latStr = lat.toFixed(5);
	const params = new URLSearchParams({
		sports: 'oui-bicycle',
		terrain: 'non',
		allez: `${fiche.title}|r${osmRel}|${lngStr}|${latStr}`,
	});

	return `https://cartes.app/?${params.toString()}#12/${latStr}/${lngStr}`;
}
