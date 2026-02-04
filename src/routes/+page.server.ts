import type { PageServerLoad } from './$types';
import communesLimit from '$lib/data/communes_limit_arrondissements.json';
import voirieData from '$lib/data/metropole-de-lyon_pvo_patrimoine_voirie.pvoamenagementcyclable.json';
import arrondissementsLyon from '$lib/data/metropole-de-lyon_adr_voie_lieu.adrarrond.json';

async function fetchVoieLyonnaise(lineNumber: number) {
	const url = `https://raw.githubusercontent.com/lavilleavelo/cyclopolis/refs/heads/main/content/voies-cyclables/ligne-${lineNumber}.json`;
	try {
		const response = await fetch(url);
		if (!response.ok) {
			console.error(`Failed to fetch VL ${lineNumber}: ${response.statusText}`);
			return null;
		}
		return await response.json();
	} catch (error) {
		console.error(`Error fetching VL ${lineNumber}:`, error);
		return null;
	}
}

export const load: PageServerLoad = async () => {
	const vlPromises = Array.from({ length: 12 }, (_, i) => fetchVoieLyonnaise(i + 1));
	const vlData = await Promise.all(vlPromises);

	const voiesLyonnaises = vlData.reduce(
		(acc, data, index) => {
			if (data) {
				acc[index + 1] = data;
			}
			return acc;
		},
		{} as Record<number, any>,
	);

	return {
		communesLimit,
		arrondissementsLyon,
		voirieData: voirieData,
		voiesLyonnaises,
	};
};
