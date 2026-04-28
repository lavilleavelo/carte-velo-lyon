import { error } from '@sveltejs/kit';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { EntryGenerator, PageServerLoad } from './$types';
import communesIndex from '$lib/data/communes/_index.json';
import communesGeoJSON from '$lib/data/communes_limit_arrondissements.json';
import communeMetadataJson from '$lib/data/communeMetadata.json';
import { absoluteUrl } from '$lib/config/site';
import { getVille30StatsForCommune } from '$lib/server/ville30Stats';
import { getCommuneStatsForInsee } from '$lib/server/communeStats';

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

export interface CommuneArticle {
	url: string;
	title: string;
	date: string;
	author: string;
}

export interface Ville30Status {
	adoptedAt?: string;
	partial?: boolean;
	partialNote?: string;
}

export interface CommuneMetadata {
	insee: string;
	name: string;
	codePostal: string | null;
	population: number | null;
	populationYear: number | null;
	wikipediaUrl: string | null;
	articles: CommuneArticle[];
	ville30?: Ville30Status;
}

const metadataByInsee = communeMetadataJson as Record<string, CommuneMetadata>;

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

	const metadata = metadataByInsee[commune.insee] ?? null;
	const [ville30Stats, communeStats] = await Promise.all([
		getVille30StatsForCommune(commune.insee),
		getCommuneStatsForInsee(commune.insee),
	]);

	return {
		commune: { ...commune, codePostal: metadata?.codePostal ?? null },
		boundary,
		metadata,
		ville30: metadata?.ville30 ?? null,
		ville30Stats,
		communeStats,
		seo: {
			title: `Carte vélo ${commune.name}`,
			description: buildCommuneSeoDescription(commune.name, communeStats),
			image: absoluteUrl(`/og/communes/${commune.slug}.jpg`),
		},
	};
};

const numberFormatter = new Intl.NumberFormat('fr-FR');

function buildCommuneSeoDescription(
	name: string,
	stats: { totalBikeLanesKm: number; parkingPlaces: number } | null,
): string {
	if (!stats || stats.totalBikeLanesKm <= 0) {
		return `Carte interactive des infrastructures cyclables à ${name} : aménagements, stationnements, Voies Lyonnaises et services vélo.`;
	}
	const km = numberFormatter.format(Math.round(stats.totalBikeLanesKm));
	const parking = numberFormatter.format(stats.parkingPlaces);
	return `Carte interactive des infrastructures cyclables à ${name} : ${km} km d'aménagements, ${parking} places de stationnement, Voies Lyonnaises et services vélo.`;
}
