import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {
		seo: {
			title: 'Mentions légales – Carte vélo de la Métropole de Lyon',
			description:
				"Mentions légales du site Carte vélo Lyon : hébergement, protection des données et conditions d'utilisation.",
			robots: 'noindex, follow',
		},
	};
};
