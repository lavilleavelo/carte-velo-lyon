import type { PageLoad } from './$types';
import { SITE } from '$lib/config/site';

export const prerender = true;

export const load: PageLoad = () => {
	return {
		seo: {
			title: 'Accidents vélo dans la Métropole de Lyon. Carte vélo Lyon',
			description:
				'Cartographie interactive des accidents impliquant un vélo, une trottinette ou un piéton dans la Métropole de Lyon. Données BAAC du ministère de l’Intérieur, 2019-2024 : filtrer par gravité, type de victime, commune ou rue.',
			image: `${SITE.url}/og/accidents.jpg`,
			imageAlt:
				'Carte des accidents impliquant un vélo ou edpm dans la Métropole de Lyon, depuis 2019',
		},
	};
};
