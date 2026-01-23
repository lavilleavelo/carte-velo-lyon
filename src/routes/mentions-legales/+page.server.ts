import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {
		seo: {
			title: 'Mentions légales - Vélo-score Lyon Métropole',
			description:
				"Mentions légales du site Vélo-score Lyon Métropole. Informations sur l'hébergement, la protection des données et les conditions d'utilisation.",
			robots: 'noindex, follow',
		},
	};
};
