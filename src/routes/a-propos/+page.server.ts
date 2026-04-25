import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {
		seo: {
			title: 'À propos – Carte vélo de la Métropole de Lyon',
			description:
				"Découvrez la carte des aménagements cyclables de la Métropole de Lyon : services, équipements et projets vélo recensés par l'association La Ville à Vélo.",
		},
	};
};
