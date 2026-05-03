import type { PageLoad } from './$types';
import { SITE } from '$lib/config/site';

export const prerender = true;

export const load: PageLoad = () => {
	return {
		seo: {
			title: 'Stations Vélo’v à Lyon. Carte vélo Lyon',
			description: 'Carte des stations Vélo’v de la Métropole de Lyon.',
			image: `${SITE.url}/og/og-image.png`,
			imageAlt: 'Carte des stations Vélo’v à Lyon avec leurs disponibilités',
		},
	};
};
