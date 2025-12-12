import type { PageServerLoad } from './$types';
import communesLimit from '$lib/data/communes_limit_arrondissements.json';
import clusterStationnements from '$lib/data/clusters-stationnements-200046977.geojson?raw';
import clustersRouges from '$lib/data/clusters-rouges-200046977.geojson?raw';
import pointsRouges from '$lib/data/points-rouges-200046977.geojson?raw';
import clustersVerts from '$lib/data/clusters-verts-200046977.geojson?raw';
import pointsVerts from '$lib/data/points-verts-200046977.geojson?raw';
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
		{} as Record<number, any>
	);

	return {
		communesLimit,
		arrondissementsLyon,
		clusterStationnements: JSON.parse(clusterStationnements),
		clustersRouges: JSON.parse(clustersRouges),
		pointsRouges: JSON.parse(pointsRouges),
		clustersVerts: JSON.parse(clustersVerts),
		pointsVerts: JSON.parse(pointsVerts),
		voirieData: voirieData,
		voiesLyonnaises
	};
};
