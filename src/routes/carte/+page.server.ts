import type { PageServerLoad } from './$types';
import communesLimit from '$lib/data/communes_limit_arrondissements.json';
import clusterStationnements from '$lib/data/clusters-stationnements-200046977.geojson?raw';
import clustersRouges from '$lib/data/clusters-rouges-200046977.geojson?raw';
import pointsRouges from '$lib/data/points-rouges-200046977.geojson?raw';
import clustersVerts from '$lib/data/clusters-verts-200046977.geojson?raw';
import pointsVerts from '$lib/data/points-verts-200046977.geojson?raw';
import voirieData from '$lib/data/metropole-de-lyon_pvo_patrimoine_voirie.pvoamenagementcyclable.json';
import arrondissementsLyon from '$lib/data/metropole-de-lyon_adr_voie_lieu.adrarrond.json';

export const load: PageServerLoad = async () => {
	return {
		communesLimit,
		arrondissementsLyon,
		clusterStationnements: JSON.parse(clusterStationnements),
		clustersRouges: JSON.parse(clustersRouges),
		pointsRouges: JSON.parse(pointsRouges),
		clustersVerts: JSON.parse(clustersVerts),
		pointsVerts: JSON.parse(pointsVerts),
		voirieData: voirieData
	};
};
