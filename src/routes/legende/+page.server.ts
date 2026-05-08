import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {
		seo: {
			title: 'Légende – Carte vélo de la Métropole de Lyon',
			description: 'Documentation des aménagements cyclables affichés sur la carte / légende',
		},
	};
};
