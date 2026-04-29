import { error } from '@sveltejs/kit';
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';
import type { PageServerLoad } from './$types';
import communesGeoJSON from '$lib/data/communes_limit_arrondissements.json';
import communeMetadataJson from '$lib/data/communeMetadata.json';
import { getVille30StatsForCommune } from '$lib/server/ville30Stats';
import { getCommuneStatsForInsee } from '$lib/server/communeStats';
import { getCommuneOsmCyclewaysKm } from '$lib/server/communeOsmStats';
import { buildBikeMapSeoDescription } from '$lib/server/communeSeo';
import { LYON_ARRONDISSEMENT_INSEE_SET, LYON_INSEE } from '$lib/config/lyon';

const lyonMetadata = (communeMetadataJson as Record<string, { ville30?: { adoptedAt?: string } }>)[
	LYON_INSEE
];

export const prerender = true;

function walkCoords(coords: unknown, visit: (lng: number, lat: number) => void): void {
	if (!Array.isArray(coords)) return;
	if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
		visit(coords[0], coords[1]);
		return;
	}
	for (const c of coords) walkCoords(c, visit);
}

function bboxOfFeatures(features: Feature<Geometry>[]): [number, number, number, number] {
	let minLng = Infinity,
		minLat = Infinity,
		maxLng = -Infinity,
		maxLat = -Infinity;
	for (const f of features) {
		walkCoords((f.geometry as { coordinates: Position | Position[] }).coordinates, (lng, lat) => {
			if (lng < minLng) minLng = lng;
			if (lat < minLat) minLat = lat;
			if (lng > maxLng) maxLng = lng;
			if (lat > maxLat) maxLat = lat;
		});
	}
	return [minLng, minLat, maxLng, maxLat];
}

export const load: PageServerLoad = async () => {
	const all = communesGeoJSON.features as unknown as Feature<Geometry>[];
	const features = all.filter((f) =>
		LYON_ARRONDISSEMENT_INSEE_SET.has((f.properties as { insee: string }).insee),
	);
	if (features.length === 0) throw error(500, 'Géométrie de Lyon introuvable');

	const boundary: FeatureCollection = {
		type: 'FeatureCollection',
		features,
	};

	const bbox = bboxOfFeatures(features);
	const [ville30Stats, communeStats, osmCyclewaysKm] = await Promise.all([
		getVille30StatsForCommune(LYON_INSEE),
		getCommuneStatsForInsee(LYON_INSEE),
		getCommuneOsmCyclewaysKm(LYON_INSEE),
	]);

	return {
		boundary,
		bbox,
		arrondissementCount: features.length,
		ville30: lyonMetadata?.ville30 ?? null,
		ville30Stats,
		communeStats,
		seo: {
			title: 'Carte vélo Lyon',
			description: buildBikeMapSeoDescription({
				name: 'Lyon',
				osmCyclewaysKm,
				parkingPlaces: communeStats?.parkingPlaces ?? null,
				trailingItemsWithData: ['Voies Lyonnaises'],
				fallbackItemsWithoutData: [
					'aménagements',
					'stationnements',
					'Voies Lyonnaises',
					'services vélo',
				],
				suffix: 'sur les 9 arrondissements',
			}),
		},
	};
};
