import { error } from '@sveltejs/kit';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { EntryGenerator, PageServerLoad } from './$types';
import communesIndex from '$lib/data/communes/_index.json';
import communesGeoJSON from '$lib/data/communes_limit_arrondissements.json';
import { codePostalBySlug } from '$lib/data/codePostalBySlug';

export interface Commune {
	slug: string;
	name: string;
	nomReduit: string | null;
	insee: string;
	surfaceKm2: number | null;
	bbox: [number, number, number, number];
	center: [number, number];
	codePostal?: string | null;
}

export const entries: EntryGenerator = () => {
	return communesIndex.map(({ slug }) => ({ slug }));
};

export const load: PageServerLoad = async ({ params }) => {
	const entry = communesIndex.find((c) => c.slug === params.slug);
	if (!entry) throw error(404, 'Commune introuvable');

	const commune = (await import(`$lib/data/communes/${entry.slug}.json`)).default as Commune;

	const features = communesGeoJSON.features as unknown as Feature<Geometry>[];
	const feature = features.find((f) => (f.properties as { insee: string }).insee === commune.insee);
	if (!feature) throw error(500, 'Géométrie introuvable pour cette commune');

	const boundary: FeatureCollection = {
		type: 'FeatureCollection',
		features: [feature],
	};

	return {
		commune: { ...commune, codePostal: codePostalBySlug[commune.slug] ?? null },
		boundary,
	};
};
