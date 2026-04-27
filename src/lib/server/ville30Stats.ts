import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { filterFeaturesInsideBoundary } from '$lib/utils/geoFilter';
import { computeVille30Stats, type Ville30Stats } from '$lib/utils/speedLimits';
import { getCachedGrandLyonData } from '$lib/server/cache';
import communesGeoJSON from '$lib/data/communes_limit_arrondissements.json';

const features = communesGeoJSON.features as unknown as Feature<Geometry>[];

const featureByInsee = new Map<string, Feature<Geometry>>();
for (const f of features) {
	const insee = (f.properties as { insee?: string } | null)?.insee;
	if (insee) featureByInsee.set(insee, f);
}

const LYON_ARRONDISSEMENT_INSEE = [
	'69381',
	'69382',
	'69383',
	'69384',
	'69385',
	'69386',
	'69387',
	'69388',
	'69389',
] as const;

let cachedAllData: FeatureCollection | null = null;
let cachedAllPromise: Promise<FeatureCollection> | null = null;
const statsCache = new Map<string, Ville30Stats | null>();

async function getSpeedLimitsData(): Promise<FeatureCollection> {
	if (cachedAllData) return cachedAllData;
	if (cachedAllPromise) return cachedAllPromise;
	cachedAllPromise = (async () => {
		const raw = (await getCachedGrandLyonData('speedLimits')) as FeatureCollection;
		cachedAllData = raw;
		return raw;
	})();
	return cachedAllPromise;
}

function buildBoundary(insees: readonly string[]): FeatureCollection | null {
	const matched = insees.map((i) => featureByInsee.get(i)).filter(Boolean) as Feature<Geometry>[];
	if (matched.length === 0) return null;
	return { type: 'FeatureCollection', features: matched };
}

export async function getVille30StatsForCommune(insee: string): Promise<Ville30Stats | null> {
	if (statsCache.has(insee)) return statsCache.get(insee) ?? null;

	let boundary: FeatureCollection | null;
	if (insee === '69123') {
		boundary = buildBoundary(LYON_ARRONDISSEMENT_INSEE);
	} else {
		boundary = buildBoundary([insee]);
	}
	if (!boundary) {
		statsCache.set(insee, null);
		return null;
	}

	try {
		const data = await getSpeedLimitsData();
		const inside = filterFeaturesInsideBoundary(data, boundary);
		const stats = computeVille30Stats(inside.features);
		statsCache.set(insee, stats);
		return stats;
	} catch (error) {
		console.error(`Failed to compute Ville 30 stats for INSEE ${insee}:`, error);
		statsCache.set(insee, null);
		return null;
	}
}
