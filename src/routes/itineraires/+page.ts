import { getItineraires, getItineraireColor } from '$lib/config/itineraires';
import type { PageLoad } from './$types';

export const prerender = true;

export const load: PageLoad = () => {
	const itineraires = getItineraires().map((f) => ({
		slug: f.slug,
		title: f.title,
		subtitle: f.subtitle ?? null,
		ref: f.ref ?? null,
		color: getItineraireColor(f),
		summary: f.summary ?? null,
		endpoints: f.endpoints ?? null,
		totalLengthKm: f.totalLengthKm ?? null,
	}));

	return {
		itineraires,
		seo: {
			title: 'Itinéraires cyclables – Carte vélo Lyon',
			description: "Itinéraires cyclables qui passent par la Métropole de Lyon ou s'y connectent.",
		},
	};
};
