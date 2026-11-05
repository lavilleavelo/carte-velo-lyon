import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {
		seo: {
			title: 'Légende – Carte vélo de la Métropole de Lyon',
			description:
				'Les aménagements cyclables de la carte : définitions et largeurs recommandées dans la Métropole de Lyon',
		},
	};
};
